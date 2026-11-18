import{readRidges}from'./ridge-layout.js';
import{readKnots}from'./knot-layout.js';
import{readConstellation}from'./constellation.js';
import{organicLayout}from'./organic.js';
import{decodeValues,logicalGrid,shapeOffset}from'./format.js';
import{geometry,probes,dataPoint}from'./v4-render.js';
export function project(h,x,y){const z=h[6]*x+h[7]*y+h[8];return[(h[0]*x+h[1]*y+h[2])/z,(h[3]*x+h[4]*y+h[5])/z];}
function solve(a,b){
 const n=b.length,m=a.map((r,i)=>r.concat(b[i]));
 for(let j=0;j<n;j++){
  let k=j;for(let r=j+1;r<n;r++)if(Math.abs(m[r][j])>Math.abs(m[k][j]))k=r;
  if(Math.abs(m[k][j])<1e-12)throw Error('Insufficient independent reference points');
  [m[k],m[j]]=[m[j],m[k]];const f=m[j][j];for(let c=j;c<=n;c++)m[j][c]/=f;
  for(let r=0;r<n;r++)if(r!==j){const f=m[r][j];for(let c=j;c<=n;c++)m[r][c]-=f*m[j][c];}
 }
 return m.map(r=>r[n]);
}
const multiply=(a,b)=>Array.from({length:9},(_,i)=>[0,1,2].reduce((v,k)=>v+a[Math.floor(i/3)*3+k]*b[k*3+i%3],0));
export function homography(pairs){
 const normal=points=>{const x=points.reduce((s,p)=>s+p[0],0)/points.length,y=points.reduce((s,p)=>s+p[1],0)/points.length,d=Math.sqrt(points.reduce((s,p)=>s+(p[0]-x)**2+(p[1]-y)**2,0)/points.length)||1;return{x,y,d};};
 const a=normal(pairs.map(p=>p[0])),b=normal(pairs.map(p=>p[1])),rows=[],vals=[];
 for(const[src,dst]of pairs){const x=(src[0]-a.x)/a.d,y=(src[1]-a.y)/a.d,u=(dst[0]-b.x)/b.d,v=(dst[1]-b.y)/b.d;rows.push([x,y,1,0,0,0,-u*x,-u*y],[0,0,0,x,y,1,-v*x,-v*y]);vals.push(u,v);}
 const ata=Array.from({length:8},()=>new Array(8).fill(0)),atb=new Array(8).fill(0);
 for(let r=0;r<rows.length;r++)for(let i=0;i<8;i++){atb[i]+=rows[r][i]*vals[r];for(let j=0;j<8;j++)ata[i][j]+=rows[r][i]*rows[r][j];}
 const h=solve(ata,atb).concat(1);
 return multiply(multiply([b.d,0,b.x,0,b.d,b.y,0,0,1],h),[1/a.d,0,-a.x/a.d,0,1/a.d,-a.y/a.d,0,0,1]);
}
export function grayscale(image){const{width,height,data}=image,g=new Uint8Array(width*height);const channels=data.length/g.length;for(let i=0;i<g.length;i++){const a=channels===4?data[i*4+3]/255:1;g[i]=Math.round((.299*data[i*channels]+.587*data[i*channels+1]+.114*data[i*channels+2])*a+255*(1-a));}return g;}
export function sample(g,w,h,x,y){x-=.5;y-=.5;if(x<0||y<0||x>=w-1||y>=h-1)return 255;const i=Math.floor(x),j=Math.floor(y),dx=x-i,dy=y-j;return g[j*w+i]*(1-dx)*(1-dy)+g[j*w+i+1]*dx*(1-dy)+g[(j+1)*w+i]*(1-dx)*dy+g[(j+1)*w+i+1]*dx*dy;}
export function readLegacyRegistered(image,g,H,meta,{dark=15,light=245}={}){
 const grid=logicalGrid(meta.type,meta.size),values=[],valid=[];let confidences=0;
 const organic=meta.type>=2?organicLayout(meta.type,meta.size,grid,geometry(meta.size).width,meta.variant??0):null;
 const at=(row,col,p)=>{
  let total=0,inside=0;
  for(const[dx,dy]of[[0,0],[-.02,0],[.02,0],[0,-.02],[0,.02]]){
   const[x,y]=project(H,...(organic?[p[0]+dx*3,p[1]+dy*3]:dataPoint(meta.type,meta.size,row,col,[p[0]+dx,p[1]+dy])));
   if(x>=0&&y>=0&&x<image.width-1&&y<image.height-1)inside++;
   total+=sample(g,image.width,image.height,x,y);
  }
  return{ink:Math.max(0,Math.min(1,(light-total/5)/(light-dark))),inside:inside===5};
 };
 if(organic?.kind==='graph'||organic?.kind==='ridge'||organic?.kind==='knot'){const read=(organic.kind==='graph'?readConstellation:organic.kind==='ridge'?readRidges:readKnots)(organic,p=>at(0,0,p),shapeOffset(meta.type,meta.size),meta.variant??0),result=decodeValues(read.values,read.valid,{...meta,version:4});return{...result,variant:meta.variant??0,unreadableSymbols:read.valid.filter(v=>!v).length,symbols:read.values.length,H};}
 for(let row=0;row<grid;row++)for(let col=0;col<grid;col++){
  const p=organic?{kind:'pairs',pairs:[organic.bits[row*grid+col].pair]}:probes(meta.type,row,col);let value=0,confidence=1,visible=true;
  if(p.kind==='hole'){
   const samples=p.points.map(point=>at(row,col,point)),sorted=samples.map((s,i)=>({...s,i})).sort((a,b)=>a.ink-b.ink);
   value=sorted[0].i;confidence=Math.min(sorted[1].ink-sorted[0].ink,sorted[1].ink);visible=samples.every(s=>s.inside);
  }else{
   for(const pair of p.pairs){const a=at(row,col,pair[0]),b=at(row,col,pair[1]);value=(value<<1)|(a.ink>b.ink?1:0);confidence=Math.min(confidence,Math.abs(a.ink-b.ink));visible&&=a.inside&&b.inside;}
  }
  if(organic&&(row*grid+col===shapeOffset(meta.type,meta.size)||row*grid+col===shapeOffset(meta.type,meta.size)+1)){value=((meta.variant??0)>>(row*grid+col===shapeOffset(meta.type,meta.size)?1:0))&1;confidence=1;visible=true;}
  values.push(value);valid.push(visible&&confidence>.22);confidences+=confidence;
 }
 const result=decodeValues(values,valid,{...meta,version:4});
 return{...result,variant:meta.variant??0,unreadableSymbols:valid.filter(v=>!v).length,symbols:values.length,meanConfidence:confidences/values.length,H};
}
export {decodeImage,readRegistered} from './scan.js';
