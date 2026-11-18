import {findLandmarkFrames,contentHomography} from './landmark-reader.js';
// Themed landmarks establish a projective frame; whole-shape search is a fallback.
// Every candidate must pass Reed–Solomon and CRC validation.
import {organicLayout} from './organic.js';
import {logicalGrid,shapeOffset} from './format.js';
import {geometry,probes,dataPoint,PAD,CELL} from './v4-render.js';
import {grayscale,readLegacyRegistered as readRegistered} from './vision.js';
const templates=[];
let prepared=false;
function prepare(){if(prepared)return;templates.length=0;for(let type=0;type<6;type++)for(let size=0;size<4;size++)for(let variant=0;variant<(type>=2?4:1);variant++){
 const grid=logicalGrid(type,size),width=geometry(size).width,organic=type>=2?organicLayout(type,size,grid,width,variant):null,pairs=[];
 for(let i=0;i<grid*grid;i++){if(organic?.kind==='ridge'||organic?.kind==='knot'){if(i%2===0){const symbol=organic.symbols[i/2];pairs.push(symbol.probes||[symbol.center,...symbol.cross,...symbol.turns]);}continue;}if(organic?.kind==='graph'){if(i%4<2)pairs.push(organic.nodes[Math.floor(i/4)].positions);continue;}if(type>=2){if(i===shapeOffset(type,size)||i===shapeOffset(type,size)+1)continue;pairs.push(organic.bits[i].pair);}else{let r=Math.floor(i/grid),c=i%grid,p=probes(type,r,c);pairs.push(p.kind==='hole'?p.points.map(q=>dataPoint(type,size,r,c,q)):p.pairs[0].map(q=>dataPoint(type,size,r,c,q)));}}
 let bounds=organic?[...organic.bounds]:[PAD-CELL*.09,PAD-CELL*.09,width-PAD+CELL*.09,width-PAD+CELL*.09];
 if(organic)for(const star of organic.stars){bounds[0]=Math.min(bounds[0],star.p[0]-star.r);bounds[1]=Math.min(bounds[1],star.p[1]-star.r);bounds[2]=Math.max(bounds[2],star.p[0]+star.r);bounds[3]=Math.max(bounds[3],star.p[1]+star.r);}
 templates.push({type,size,variant,width,bounds,pairs,coarse:Array.from({length:64},(_,i)=>pairs[Math.floor((i+.37)*pairs.length/64)]),fine:Array.from({length:160},(_,i)=>pairs[Math.floor((i+.37)*pairs.length/160)])});
}prepared=true;}
function pixel(g,w,h,x,y){x-=.5;y-=.5;const ix=Math.floor(x),iy=Math.floor(y);if(ix<0||iy<0||ix>=w-1||iy>=h-1)return 255;const dx=x-ix,dy=y-iy,k=iy*w+ix;return g[k]*(1-dx)*(1-dy)+g[k+1]*dx*(1-dy)+g[k+w]*(1-dx)*dy+g[k+w+1]*dx*dy;}
function matrix(p,t){const a=p.angle*Math.PI/180,c=Math.cos(a),s=Math.sin(a),m=p.mirror?-1:1,z=t.width/2;return[c*p.scale*m,-s*p.scale,p.x-c*p.scale*m*z+s*p.scale*z,s*p.scale*m,c*p.scale,p.y-s*p.scale*m*z-c*p.scale*z,0,0,1];}
function score(p,t,g,w,h,fine=false){const H=matrix(p,t);let total=0;for(const pair of fine?t.fine:t.coarse){const samples=pair.map(([x,y])=>pixel(g,w,h,H[0]*x+H[1]*y+H[2],H[3]*x+H[4]*y+H[5]));total+=(Math.max(...samples)-Math.min(...samples))/255;}return total/(fine?t.fine.length:t.coarse.length);}
function refine(p,t,g,w,h){let best={...p},value=score(best,t,g,w,h,true);for(const step of [3,1,.35,.12,.04])for(let round=0;round<3;round++){
 let improved=false;for(const key of ['angle','x','y','scale'])for(const sign of [-1,1]){let q={...best};q[key]+=sign*(key==='scale'?step*.002*best.scale:key==='angle'?step:step);const v=score(q,t,g,w,h,true);if(v>value){best=q;value=v;improved=true;}}if(!improved)break;
 }return{...best,score:value};}
function attempt(p,t,g,image,started){const H=matrix(p,t);for(const level of [2,1,3,0])try{const result=readRegistered(image,g,H,{type:t.type,size:t.size,level,variant:t.variant});return{...result,registration:'whole shape',markers:0,elapsedMs:performance.now()-started};}catch{}return null;}
export function decodeLegacyImage(image,{quick=false,camera=false,gray=null,detections=[]}={}){
 const started=performance.now(),base=gray??grayscale(image);let cameraError=null,dark=0;for(let i=0;i<base.length;i+=4)if(base[i]<160)dark++;if(dark<8)throw Error('No readable shape found.');prepare();
 for(const invert of [false,true]){
  const g=invert?base.map(v=>255-v):base,w=image.width,h=image.height,candidates=[];
  const located=detections[Number(invert)]??findLandmarkFrames(image,g);
  if(located.frames.length){
   const ranked=[];
   for(const frame of located.frames)for(const t of templates){const H=contentHomography(frame.H,t.width);let sum=0;for(const pair of t.coarse){const values=pair.map(([x,y])=>{const z=H[6]*x+H[7]*y+H[8];return pixel(g,w,h,(H[0]*x+H[1]*y+H[2])/z,(H[3]*x+H[4]*y+H[5])/z);});sum+=Math.max(...values)-Math.min(...values);}ranked.push({frame,t,H,score:sum/t.coarse.length});}
   ranked.sort((a,b)=>b.score-a.score);
   for(const candidate of ranked.slice(0,16))for(const level of [2,1,3,0])try{const result=readRegistered(image,g,candidate.H,{type:candidate.t.type,size:candidate.t.size,variant:candidate.t.variant,level},{dark:candidate.frame.dark,light:candidate.frame.light});return{...result,registration:'themed landmarks',markers:4,outline:candidate.frame.marks.map(m=>m.center),elapsedMs:performance.now()-started};}catch{}
   if(camera){const error=Error('Code located. Move closer and hold steady; the data is not sharp enough yet.');error.found=4;error.outline=located.frames[0].marks.map(m=>m.center);cameraError=error;continue;}
  }
  if(camera){const error=Error(located.found?`${located.found}/4 corner motifs visible. Keep all four in view.`:'Looking for corner motifs. Show a newly generated code and move closer.');error.found=located.found;if(!cameraError||error.found>(cameraError.found??0))cameraError=error;continue;}

  // Fast path for complete exported images, including quarter-turns and mirrors.
  for(const t of templates)for(const mirror of [false,true])for(const angle of [0,90,180,270]){
   const p={x:w/2,y:h/2,scale:Math.min(w,h)/t.width,angle,mirror};const s=score(p,t,g,w,h);if(s>.35)candidates.push({t,p,score:s});
  }
  candidates.sort((a,b)=>b.score-a.score);
  for(const c of candidates.slice(0,12)){let result=attempt(c.p,c.t,g,image,started);if(result)return result;}
  if(quick)continue;
  // Align visible silhouette extents before a wider orientation search. This
  // handles removed whitespace without depending on the original canvas size.
  let bb=[w,h,0,0];for(let y=0;y<h;y++)for(let x=0;x<w;x++)if(g[y*w+x]<135){bb[0]=Math.min(bb[0],x+.5);bb[1]=Math.min(bb[1],y+.5);bb[2]=Math.max(bb[2],x+.5);bb[3]=Math.max(bb[3],y+.5);}
  const fitted=[];
  for(const t of templates)for(const mirror of [false,true]){const b=t.bounds,z=t.width/2,scale=((bb[2]-bb[0])/(b[2]-b[0])+(bb[3]-bb[1])/(b[3]-b[1]))/2,p={angle:0,mirror,scale,x:(bb[0]+bb[2])/2-scale*((b[0]+b[2])/2-z)*(mirror?-1:1),y:(bb[1]+bb[3])/2-scale*((b[1]+b[3])/2-z)};fitted.push({t,p:refine(p,t,g,w,h)});}
  fitted.sort((a,b)=>b.p.score-a.p.score);for(const c of fitted.slice(0,8)){const r=attempt(c.p,c.t,g,image,started);if(r)return r;}

  const full=[];
  // Whole silhouette yields candidates even when blank margins were cropped.
  const ink=[];const step=Math.max(1,Math.floor(Math.min(w,h)/200));for(let y=0;y<h;y+=step)for(let x=0;x<w;x+=step)if(g[y*w+x]<135)ink.push([x+.5-w/2,y+.5-h/2]);
  if(ink.length<5||ink.length>30000)continue;
  for(let angle=0;angle<360;angle+=6){const a=angle*Math.PI/180,co=Math.cos(a),si=Math.sin(a),b=[Infinity,Infinity,-Infinity,-Infinity];for(const[x,y]of ink){const u=co*x+si*y,v=-si*x+co*y;b[0]=Math.min(b[0],u);b[1]=Math.min(b[1],v);b[2]=Math.max(b[2],u);b[3]=Math.max(b[3],v);}
   for(const t of templates)for(const mirror of [false,true])for(const mode of [0,1]){
    let p;if(!mode)p={x:w/2,y:h/2,scale:Math.min(w,h)/(t.width*(Math.abs(co)+Math.abs(si))),angle,mirror};
    else{const q=t.bounds,z=t.width/2,scale=((b[2]-b[0])/(q[2]-q[0])+(b[3]-b[1])/(q[3]-q[1]))/2,ox=(b[0]+b[2])/2-scale*((q[0]+q[2])/2-z)*(mirror?-1:1),oy=(b[1]+b[3])/2-scale*((q[1]+q[3])/2-z);p={x:w/2+co*ox-si*oy,y:h/2+si*ox+co*oy,scale,angle,mirror};}
    const s=score(p,t,g,w,h);if(s>.45)full.push({t,p,score:s});
   }
  }
  full.sort((a,b)=>b.score-a.score);const best=full.slice(0,20).map(c=>({...c,p:refine(c.p,c.t,g,w,h)})).sort((a,b)=>b.p.score-a.p.score);
  for(const c of best){const result=attempt(c.p,c.t,g,image,started);if(result)return result;}
 }
 if(cameraError)throw cameraError;
 throw Error('The shape could not be aligned or verified. Try a larger, sharper, straight-on image with the outer shape visible.');
}
