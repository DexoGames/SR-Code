import {grayscale,project,sample} from './vision.js';
import {decodeImage as readEarlier,readRegistered as registeredV5,recover} from './v5-scan.js';
import {nativePattern} from './native/index.js';
import {models,regions,pagePoses,refinePage,refineContours,refineFeatures,testPose,featurePoses} from './native/localize.js';
import {whiten} from './format.js';
import {ANCHORS as previousCenters,bitSink} from './patterns/common.js';

const outline=[[0,0],[1000,0],[1000,1000],[0,1000]];
const median=a=>a.sort((a,b)=>a-b)[Math.floor(a.length/2)];
function pixelReader(image,g,invert){
  return (x,y)=>{
    if(x<.5||y<.5||x>=image.width-.5||y>=image.height-.5)return NaN;
    const v=sample(g,image.width,image.height,x,y)/255;
    return invert?v:1-v;
  };
}
function opticalSampler(at,H,marks) {
  const samples=[];
  for(const m of marks){
    const dark=median(m.dark.map(p=>at(...project(H,...p))).filter(Number.isFinite));
    const light=median(m.bright.map(p=>at(...project(H,...p))).filter(Number.isFinite));
    if(dark-light>.13)samples.push({p:m.center,dark,light});
  }
  // Weight nearby reference features more heavily when the page is shadowed.
  return (x,y)=>{
    const value=at(...project(H,x,y));
    let dark=0,light=0,sum=0;
    for(const s of samples){
      const weight=1/((x-s.p[0])**2+(y-s.p[1])**2+18000);
      dark+=s.dark*weight;light+=s.light*weight;sum+=weight;
    }
    return sum?Math.max(0,Math.min(1,(value*sum-light)/(dark-light))):value;
  };
}
export function readRegistered(image,g,H,meta){
  if(meta.version===5)return registeredV5(image,g,H,meta);
  const out=bitSink(),layout=nativePattern(meta.type,meta.size,meta.variant??0);
  layout.read(opticalSampler(pixelReader(image,g,false),H,layout.marks),out);
  return {...recover(out,{...meta,version:6}),H};
}

function attempt(trial,at,start){
  const {model,H}=trial, optical=opticalSampler(at,H,model.marks);
  const sizes=model.type<2?[model.size]:[0,1,2,3];
  for(const size of sizes)for(let variant=0;variant<(model.type<2?1:4);variant++){
    const out=bitSink();
    nativePattern(model.type,size,variant,model.classic).read(optical,out);
    let sum=0;for(const c of out.confidence)sum+=c;
    if(sum/out.bits.length<.22)continue;
    for(const level of [2,1,3,0])try{
      const result=recover(out,{type:model.type,size,variant,level,version:6});
      if(model.type>=2&&(((result.group>>>24)^whiten(8*result.blocks.length))>>>6)!==variant)continue;
      return {...result,H,markers:trial.good,registration:'pattern features',
        outline:outline.map(p=>project(H,...p)),elapsedMs:performance.now()-start};
    }catch{}
  }
  return null;
}

function previousExport(at,width){
  const frames=[[previousCenters,31],[[[75,75],[925,75],[925,925],[75,925]],38]];
  return frames.some(([centers,r])=>centers.every(([x,y])=>{
    let contrast=0;
    for(let i=0;i<12;i++){
      const a=i*Math.PI/6,dx=r*Math.cos(a),dy=r*Math.sin(a),scale=width/1000;
      contrast+=at(scale*(x+.87*dx),scale*(y+.87*dy))-at(scale*(x+.68*dx),scale*(y+.68*dy));
    }
    return contrast/12>.30;
  }));
}

function croppedExports(size,at){
  const edge=(x,y,dx,dy)=>Array.from({length:64},(_,i)=>at(x+dx*i,y+dy*i)).some(v=>v>.50);
  const left=edge(1,1,0,(size-3)/64),right=edge(size-2,1,0,(size-3)/64);
  const top=edge(1,1,(size-3)/64,0),bottom=edge(1,size-2,(size-3)/64,0);
  if(left===right||top===bottom)return [];
  return [968,1400,1976,2696].filter(w=>w>size&&w<size*1.45).flatMap(w=>{
    const x=left?size-w:0,y=top?size-w:0;
    return pagePoses([[x,y],[x+w,y],[x+w,y+w],[x,y+w]]);
  });
}

export function decodeImage(image,{camera=false,quick=false}={}){
  const start=performance.now(),g=grayscale(image);
  let lo=255,hi=0;
  for(let i=0;i<g.length;i+=4){lo=Math.min(lo,g[i]);hi=Math.max(hi,g[i]);}
  if(hi-lo<18)throw Error('No readable pattern found.');
  const square=image.width===image.height;
  const canvas=[[0,0],[image.width,0],[image.width,image.height],[0,image.height]];
  let located=null,discovery=null;
  for(const invert of [false,true]){
    const at=pixelReader(image,g,invert),tried=new Set();
    const run=trials=>{
      for(const trial of trials.sort((a,b)=>b.score-a.score).slice(0,22)){
        if(trial.good<2||trial.score<.075)continue;
        const key=Number(Boolean(trial.model.classic))+'/'+trial.model.type+'/'+trial.model.size+'/'+outline.flatMap(p=>project(trial.H,...p).map(v=>Math.round(v*2))).join(',');
        if(tried.has(key))continue;tried.add(key);
        if(!located||trial.score>located.score)located=trial;
        const result=attempt(trial,at,start);if(result)return result;
      }
    };
    const rank=poses=>poses.flatMap(H=>models.map(m=>testPose(H,m,at))).filter(t=>t.good>=2&&t.score>.075);
    if(square){
      const result=run(rank(pagePoses(canvas)));if(result)return result;
      if(previousExport(at,image.width)){
        try{return readEarlier(image,{camera,quick:true});}catch{}
      }
      if(!camera){const cropped=run(rank(croppedExports(image.width,at)));if(cropped)return cropped;}
    }
    if(!discovery)discovery=regions(g,image.width,image.height);
    const features=invert?discovery.features.map(f=>({...f,positive:!f.positive})):discovery.features;
    const rough=rank(discovery.pages.flatMap(page=>pagePoses(refinePage(page,at,image.width,image.height)).concat(pagePoses(page)))).sort((a,b)=>b.score-a.score).slice(0,12);
    const refined=rough.map(t=>testPose(refineFeatures(t.H,t.model,features),t.model,at));
    const result=run(refined.concat(rough));if(result)return result;
    if(discovery.inkQuad&&!invert){
      const squareField=[[40,40],[960,40],[960,960],[40,960]];
      const guesses=pagePoses(discovery.inkQuad,squareField).flatMap(H=>models.filter(m=>m.type<2).map(m=>testPose(refineFeatures(H,m,features),m,at)));
      const result=run(guesses);if(result)return result;
    }
    // A small rotated sky can score below accidental loops in another
    // language. Give its own matched guide stars a decode attempt before
    // pooling hypotheses from the other languages.
    const skyModel=models.find(m=>m.type===5&&!m.classic);
    const starPoses=featurePoses(skyModel,features,image.width,image.height,at);
    const starRead=run(starPoses.filter(t=>t.good>=3&&t.score>.35));
    if(starRead)return starRead;
    const natural=starPoses.concat(models.filter(m=>m!==skyModel).flatMap(m=>featurePoses(m,features,image.width,image.height,at))).sort((a,b)=>b.score-a.score);
    const aligned=natural.map(t=>testPose(refineContours(t.H,t.model,at),t.model,at));
    const found=run(aligned.concat(natural));
    if(found)return found;
  }
  // Earlier images have different optical alphabets and their own reader.
  try{return readEarlier(image,{camera,quick:quick||Boolean(located&&located.score>.65)});}catch(error){
    if(located&&located.score>.35){
      const e=Error('Pattern located. Move closer or bring the print into focus.');
      e.found=located.good;e.outline=outline.map(p=>project(located.H,...p));throw e;
    }
    error.message='Show the full pattern and bring it into focus.';throw error;
  }
}
