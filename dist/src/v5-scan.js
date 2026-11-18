import {CORNERS} from './landmarks.js';
import {findLandmarkFrames} from './landmark-reader.js';
import {decodeLegacyImage} from './registration.js';
import {grayscale,homography,project,sample} from './vision.js';
import {decodeValues,plan,whiten} from './format.js';
import {ANCHORS,EXTENT,RADIUS,bitSink} from './patterns/common.js';
import {signature,tickPoint,INNER,PUPIL} from './reference.js';
import {pattern} from './patterns/index.js';

const formats=[];
for(let type=0;type<6;type++)for(let size=0;size<4;size++)for(let variant=0;variant<(type<2?1:4);variant++)
  formats.push({type,size,variant,word:signature(type,size,variant)});

function sampler(image,g,H,marks) {
  // Interpolate exposure from the rings themselves. A shadow over one side of
  // a print should not change the decision threshold on the other.
  const fit=key=>{
    if(!marks?.length)return key==='dark'?[15,0,0]:[245,0,0];
    const avg=marks.reduce((s,m)=>s+m[key],0)/marks.length;
    let xx=0,xy=0,yy=0,vx=0,vy=0;
    const centers=marks.map(m=>ANCHORS[m.id]),mx=centers.reduce((s,p)=>s+p[0],0)/centers.length,my=centers.reduce((s,p)=>s+p[1],0)/centers.length;
    centers.forEach(([x,y],i)=>{x-=mx;y-=my;xx+=x*x;xy+=x*y;yy+=y*y;vx+=x*(marks[i][key]-avg);vy+=y*(marks[i][key]-avg);});
    const det=xx*yy-xy*xy;
    if(det<1)return [avg,0,0];
    const dx=(vx*yy-vy*xy)/det,dy=(vy*xx-vx*xy)/det;
    return [avg-mx*dx-my*dy,dx,dy];
  };
  const black=fit('dark'),white=fit('light'),w=image.width,h=image.height;
  return (x,y)=>{
    const z=H[6]*x+H[7]*y+H[8],u=(H[0]*x+H[1]*y+H[2])/z,v=(H[3]*x+H[4]*y+H[5])/z;
    if(u<.5||v<.5||u>=w-.5||v>=h-.5)return NaN;
    const light=white[0]+x*white[1]+y*white[2], dark=black[0]+x*black[1]+y*black[2];
    return Math.min(1,Math.max(0,(light-sample(g,w,h,u,v))/Math.max(24,light-dark)));
  };
}

function formatCandidates(at,marks) {
  const bits=[];
  for(let i=0;i<8;i++){
    const readings=marks.map(m=>{
      const p=ANCHORS[m.id];
      return [-.15,0,.15].reduce((s,t)=>s+at(...tickPoint(p,i,t)),0)/3;
    }).filter(Number.isFinite).sort((a,b)=>a-b);
    const middle=Math.floor(readings.length/2);
    bits.push(readings.length?(readings[middle]+readings[Math.floor((readings.length-1)/2)])/2:.5);
  }
  if(bits[7]<.40)return [];
  return formats.map(f=>({...f,error:bits.reduce((s,x,i)=>s+Math.abs(x-((f.word>>i)&1)),0)/8}))
    .filter(f=>f.error<.32).sort((a,b)=>a.error-b.error);
}

export function recover(optical,meta) {
  const p=plan(meta.type,meta.size,meta.level),values=[],strength=[];
  for(let i=0;i<optical.bits.length;i+=p.bits){
    let v=0,c=1;
    for(let j=0;j<p.bits;j++){v=v*2+optical.bits[i+j];c=Math.min(c,optical.confidence[i+j]);}
    values.push(v);strength.push(c);
  }
  // Under a defocused lens many correct decisions have low contrast. Retry the
  // cached optical read with a lower erasure threshold and with hard decisions.
  let last;
  function attempt(){
    for(const threshold of [.22,.10,0]){
      const valid=strength.map(s=>threshold===0||s>threshold);
      try{
        const result=decodeValues(values,valid,meta);
        return {...result,variant:meta.variant,symbols:values.length,unreadableSymbols:valid.filter(v=>!v).length};
      }catch(e){last=e;}
    }
  }
  const decoded=attempt();
  if(decoded)return decoded;
  if(meta.version===6&&meta.type===5){
    // A central stain can erase the packet prefix. Its first six bytes are
    // fixed by the format and the candidate being tested. Restore only faint
    // prefix bits, then require the usual parity, header and payload checks.
    const prefix=[82,83,meta.version,meta.type,meta.size,meta.level];
    let restored=false;
    for(const [col,byte] of prefix.entries()){
      const index=col*p.blocks.length,encoded=byte^whiten(index);
      for(let bit=0;bit<8;bit++){
        const pos=8*index+bit;
        if(strength[pos]>.22)continue;
        values[pos]=(encoded>>(7-bit))&1;
        strength[pos]=1;
        restored=true;
      }
    }
    if(restored){
      const repaired=attempt();
      if(repaired)return repaired;
    }
  }
  throw last;
}

// H maps the 1000-unit drawing plane to image pixels.
export function readRegistered(image,g,H,meta,marks) {
  const optical=bitSink();
  pattern(meta.type,meta.size,meta.variant??0).read(sampler(image,g,H,marks),optical);
  return {...recover(optical,meta),H};
}

// For equal physical circles the area of the projected ellipse varies as
// 1/z³. Three measured areas supply the two missing projective constraints.
// Verify the extrapolated pose against the repeated ticks and payload CRC.
function threeMarkPose(marks) {
  const points=marks.map(m=>ANCHORS[m.id]), missing=[0,1,2,3].find(i=>marks.every(m=>m.id!==i));
  const [a,b,c]=points, p=ANCHORS[missing], cross=(x,y,u,v)=>x*v-y*u;
  const bx=b[0]-a[0],by=b[1]-a[1],cx=c[0]-a[0],cy=c[1]-a[1],px=p[0]-a[0],py=p[1]-a[1],det=cross(bx,by,cx,cy);
  const v=cross(px,py,cx,cy)/det,w=cross(bx,by,px,py)/det,weights=[1-v-w,v,w];
  const scaled=weights.map((b,i)=>b/Math.cbrt(marks[i].area)),sum=scaled.reduce((a,b)=>a+b,0);
  const guess=[0,1].map(k=>marks.reduce((s,m,i)=>s+scaled[i]*m.center[k],0)/sum);
  return homography(points.map((p,i)=>[p,marks[i].center]).concat([[p,guess]]));
}
// Check the locally projected circle as well as its centre. Four accidental
// holes can form a quadrilateral but rarely have all four corresponding sizes.
function scaleError(H,marks,centers=ANCHORS,radius=RADIUS,step=1) {
  let error=0;
  for(const m of marks){
    const [x,y]=centers[m.id], [u,v]=project(H,x,y), a=project(H,x+step,y), b=project(H,x,y+step);
    const jacobian=Math.abs((a[0]-u)*(b[1]-v)-(a[1]-v)*(b[0]-u));
    error+=Math.abs(Math.log(m.area/(Math.PI*(radius*INNER/step)**2*jacobian)));
  }
  return error/marks.length;
}

function poses(located) {
  // Rank pupil sizes against each other. Ink gain affects every printed
  // pupil and can otherwise put two neighbours in the same absolute bin.
  const rings=located.candidates.slice().sort((a,b)=>a.quality-b.quality).slice(0,16).sort((a,b)=>a.ratio-b.ratio);
  const full=[],partial=[];
  for(let a=0;a<rings.length;a++)for(let b=a+1;b<rings.length;b++)for(let c=b+1;c<rings.length;c++){
    const three=[rings[a],rings[b],rings[c]];
    for(let d=c+1;d<rings.length;d++){
      const marks=[...three,rings[d]].map((m,id)=>({...m,id}));
      if(marks.some((m,i)=>i&&m.ratio-marks[i-1].ratio<.065))continue;
      const turns=marks.map((m,i)=>{
        const p=m.center,q=marks[(i+1)%4].center,r=marks[(i+2)%4].center;
        return (q[0]-p[0])*(r[1]-q[1])-(q[1]-p[1])*(r[0]-q[0]);
      });
      if(!turns.every(t=>t>0)&&!turns.every(t=>t<0))continue;
      try{
        const H=homography(marks.map(m=>[ANCHORS[m.id],m.center])), error=scaleError(H,marks);
        if(error<.42)full.push({marks,H,error});
      }catch{}
    }
    for(let missing=0;missing<4;missing++){
      const marks=three.map((m,i)=>({...m,id:i+(i>=missing?1:0)}));
      if(marks.some(m=>Math.abs(m.ratio-PUPIL[m.id]/INNER)>.15))continue;
      try{
        const H=threeMarkPose(marks),error=scaleError(H,marks);
        if(error<.31)partial.push({marks,H,error});
      }catch{}
    }
  }
  return (full.length?full:partial).sort((a,b)=>a.error-b.error).slice(0,6);
}

// A square export may lose several internal rings to a central stain while
// retaining its original canvas. Check the eight exact canvas orientations
// against surviving rings before trusting that alignment.
function exportPoses(image,located) {
  if(image.width!==image.height||!located.candidates.length)return [];
  const width=image.width, axis=width/EXTENT, results=[];
  for(const mirror of [1,-1])for(let i=0;i<4;i++){
    const cos=[1,0,-1,0][i],sin=[0,1,0,-1][i];
    const a=axis*cos*mirror,b=-axis*sin,c=axis*sin*mirror,d=axis*cos;
    const H=[a,b,(width-(a+b)*EXTENT)/2,c,d,(width-(c+d)*EXTENT)/2,0,0,1];
    const marks=[];
    ANCHORS.forEach((p,id)=>{
      const q=project(H,...p);
      const ring=located.candidates.find(m=>Math.hypot(m.center[0]-q[0],m.center[1]-q[1])<Math.max(1.6,width*.0015)
        &&Math.abs(m.ratio-PUPIL[id]/INNER)<.16);
      if(ring)marks.push({...ring,id});
    });
    if(marks.length)results.push({H,marks,registration:'export bounds'});
  }
  return results;
}

export function decodeImage(image,{camera=false,quick=false}={}) {
  const start=performance.now(), gray=grayscale(image),detections=[];
  let lo=255,hi=0;
  for(let i=0;i<gray.length;i+=4){lo=Math.min(lo,gray[i]);hi=Math.max(hi,gray[i]);}
  if(hi-lo<18)throw Error('No readable pattern found.');
  let best=null, likelyCurrent=false;
  for(const invert of [false,true]){
    const g=invert?gray.map(v=>255-v):gray, located=findLandmarkFrames(image,g);
    detections.push(located);
    if(!best||located.found>best.found)best=located;
    const ranked=[];
    const candidates=poses(located);
    if(!camera&&candidates.every(c=>c.marks.length<4))candidates.push(...exportPoses(image,located));
    for(const {H,marks,registration='embedded landmarks'} of candidates){
      const at=sampler(image,g,H,marks);
      for(const meta of formatCandidates(at,marks).slice(0,3))ranked.push({H,marks,at,meta,registration});
    }
    ranked.sort((a,b)=>a.meta.error-b.meta.error);
    for(const {H,marks,at,meta,registration} of ranked.slice(0,6)){
      if(meta.error<.10)likelyCurrent=true;
      const optical=bitSink();
      pattern(meta.type,meta.size,meta.variant).read(at,optical);
      for(const level of [2,1,3,0])try{
        const result=recover(optical,{...meta,level,version:5});
        return {...result,H,registration,markers:marks.length,
          outline:ANCHORS.map(p=>project(H,...p)),elapsedMs:performance.now()-start};
      }catch{}
    }
  }
  const hasLegacyFrame=detections.some(d=>d.frames.some(f=>scaleError(f.H,f.marks,CORNERS,.038,.001)<.32));
  if(hasLegacyFrame||(!likelyCurrent&&(!camera||detections.some(d=>d.frames.length)))){
    try{
      const result=decodeLegacyImage(image,{quick,camera,gray,detections});
      return {...result,elapsedMs:performance.now()-start};
    }catch{}
  }
  const error=Error(best.found>=3?'Pattern located. Move closer or bring the print into focus.':
    best.found?`${best.found}/4 reference rings visible. Show more of the pattern.`:'Show the full pattern and bring it into focus.');
  error.found=best.found;
  error.outline=best.frames[0]?.marks.map(m=>m.center);
  throw error;
}
