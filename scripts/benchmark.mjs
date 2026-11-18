import {FIELD,EXTENT} from '../src/patterns/common.js';
import{writeFileSync,mkdirSync}from'node:fs';
import{encode,TYPES,SIZES,LEVELS,plan}from'../src/format.js';import{toSVG}from'../src/render.js';
import{decodeImage,homography,project}from'../src/vision.js';import{sharp,raster}from'./runtime.mjs';
const args=new Set(process.argv.slice(2)),samples=args.has('--quick')?1:3;
const clone=i=>({...i,data:Uint8Array.from(i.data)});
const rawOpts=i=>({raw:{width:i.width,height:i.height,channels:4}});
async function sharpImage(image,change){const{data,info}=await change(sharp(image.data,rawOpts(image))).ensureAlpha().raw().toBuffer({resolveWithObject:true});return{data,width:info.width,height:info.height};}
function rectangle(image,x,y,w,h,color=255){const out=clone(image);for(let yy=Math.max(0,Math.floor(y));yy<Math.min(out.height,y+h);yy++)for(let xx=Math.max(0,Math.floor(x));xx<Math.min(out.width,x+w);xx++){const p=(yy*out.width+xx)*4;out.data[p]=out.data[p+1]=out.data[p+2]=color;out.data[p+3]=255;}return out;}
function occlude(image,fraction){const inner=image.width*FIELD/EXTENT,side=Math.sqrt(fraction)*inner;return rectangle(image,(image.width-side)/2,(image.height-side)/2,side,side);}
function perspective(image){
 const w=image.width,h=image.height,dst=[[w*.13,h*.03],[w*.94,h*.15],[w*.98,h*.91],[w*.02,h*.98]],src=[[0,0],[w,0],[w,h],[0,h]],inverse=homography(dst.map((p,i)=>[p,src[i]])),data=new Uint8Array(w*h*4).fill(255);
 for(let y=0;y<h;y++)for(let x=0;x<w;x++){const[a,b]=project(inverse,x+.5,y+.5),xx=Math.floor(a),yy=Math.floor(b);if(xx<0||yy<0||xx>=w-1||yy>=h-1)continue;const dx=a-xx,dy=b-yy;for(let c=0;c<3;c++)data[(y*w+x)*4+c]=image.data[(yy*w+xx)*4+c]*(1-dx)*(1-dy)+image.data[(yy*w+xx+1)*4+c]*dx*(1-dy)+image.data[((yy+1)*w+xx)*4+c]*(1-dx)*dy+image.data[((yy+1)*w+xx+1)*4+c]*dx*dy;}
 return{data,width:w,height:h};
}
const scenarios=[
 {id:'clean',name:'Original',run:async i=>i},
 {id:'resize480',name:'480 px image',run:i=>sharpImage(i,p=>p.resize(480,480))},
 {id:'resize320',name:'320 px image',run:i=>sharpImage(i,p=>p.resize(320,320))},
 {id:'print600',name:'600 px + blur σ 1.0 px',run:i=>sharpImage(i,p=>p.resize(600,600).blur(1))},
 {id:'print480',name:'480 px + blur σ 1.0 px',run:i=>sharpImage(i,p=>p.resize(480,480).blur(1))},
 {id:'blur06',name:'Blur σ 0.6 px',run:i=>sharpImage(i,p=>p.blur(.6))},
 {id:'blur12',name:'Blur σ 1.2 px',run:i=>sharpImage(i,p=>p.blur(1.2))},
 {id:'rotate37',name:'Rotation 37°',run:i=>sharpImage(i,p=>p.rotate(37,{background:'#ffffff'}))},
 {id:'perspective',name:'Perspective warp',run:async i=>perspective(i)},
 {id:'occlusion10',name:'10% data covered',run:async i=>occlude(i,.10)},
 {id:'occlusion20',name:'20% data covered',run:async i=>occlude(i,.20)},
 {id:'occlusion30',name:'30% data covered',run:async i=>occlude(i,.30)},
 {id:'corner',name:'Corner covered',run:async i=>rectangle(i,0,0,i.width*.23,i.height*.23)},
 {id:'crop',name:'12% top + left crop',run:i=>{const a=Math.floor(i.width*.12);return sharpImage(i,p=>p.extract({left:a,top:a,width:i.width-a,height:i.height-a}));}},
 {id:'jpeg',name:'JPEG quality 40',run:async i=>{const data=await sharp(i.data,rawOpts(i)).jpeg({quality:40}).toBuffer();const{data:out,info}=await sharp(data).ensureAlpha().raw().toBuffer({resolveWithObject:true});return{data:out,width:info.width,height:info.height};}},
 {id:'shadow',name:'Uneven lighting',run:async i=>{const o=clone(i);for(let y=0;y<i.height;y++)for(let x=0;x<i.width;x++)for(let c=0;c<3;c++)o.data[(y*i.width+x)*4+c]*=.45+.55*x/i.width;return o;}},
 {id:'invert',name:'Inverted colours',run:async i=>{const o=clone(i);for(let p=0;p<o.data.length;p+=4)for(let c=0;c<3;c++)o.data[p+c]=255-o.data[p+c];return o;}}
];
const results=[],size=1,level=2;
mkdirSync('test-output',{recursive:true});
for(let type=0;type<TYPES.length;type++){
 const rows=[];
 for(let sample=0;sample<samples;sample++){
  const message=['https://dexo.games','🌿 RS Code — test 02','third payload 0123456789'][sample],code=encode(message,{type,size,level}),base=await raster(toSVG(code));
  for(const scenario of scenarios){const image=await scenario.run(base);let result;
   try{const d=decodeImage(image);result={pass:d.text===message,wrongDecode:d.text!==message,ms:d.elapsedMs,markers:d.markers,corrected:d.corrected,erasures:d.erasures};}
   catch(e){result={pass:false,wrongDecode:false,error:e.message};}
   rows.push({scenario:scenario.id,sample,...result});
   if(sample===0&&['clean','perspective','crop','occlusion20'].includes(scenario.id))await sharp(image.data,rawOpts(image)).png().toFile(`test-output/${TYPES[type].id}-${scenario.id}.png`);
  }
 }
 results.push({type:TYPES[type].id,rows});console.log(`${TYPES[type].name}: ${rows.filter(r=>r.pass).length}/${rows.length}; failures: ${[...new Set(rows.filter(r=>!r.pass).map(r=>r.scenario))].join(', ')||'none'}`);
}
const negative=[];for(const kind of['blank','noise']){const width=420,height=420,data=new Uint8Array(width*height*4).fill(255);let s=139;for(let i=0;i<data.length;i+=4){s=(Math.imul(s,1664525)+1013904223)>>>0;const c=kind==='noise'?s&255:255;data[i]=data[i+1]=data[i+2]=c;}try{decodeImage({width,height,data});negative.push({kind,rejected:false});}catch{negative.push({kind,rejected:true});}}
const capacities=TYPES.map((type,t)=>({
 type:type.id,
 levels:LEVELS.map((level,l)=>({
  level:level.name,
  sizes:SIZES.map((size,s)=>({...plan(t,s,l),name:size.name}))
 }))
}));
const report={format:'RS Code v6 experimental',createdAt:new Date().toISOString(),method:{size:SIZES[size].name,logicalPositions:TYPES.map((t,i)=>({type:t.id,count:plan(i,size,level).grid**2})),level:LEVELS[level].name,samplesPerScenario:samples,source:'Rasterized generated SVG; no embedded-payload reading; synthetic transforms only. No physical camera or print validation.',occlusion:'Centered square mask as a fraction of the nominal 920-unit pattern field, including embedded reference marks.'},scenarios:scenarios.map(({id,name})=>({id,name})),results,negative,capacities};
mkdirSync('public',{recursive:true});writeFileSync('public/benchmark.json',JSON.stringify(report,null,2));
console.log('Saved public/benchmark.json; incorrect decoded payloads:',results.flatMap(t=>t.rows).filter(r=>r.wrongDecode).length);
