import{organicLayout}from'./organic.js';
import{MARKERS}from'./markers.js';
import{decodeValues,logicalGrid}from'./format.js';
import{geometry,markerPositions,markerMeta,MARKER,probes,dataPoint}from'./render.js';
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
function otsu(g){const h=new Uint32Array(256);let sum=0;for(const p of g){h[p]++;sum+=p;}let count=0,partial=0,best=-1,threshold=128;for(let t=0;t<255;t++){count+=h[t];partial+=t*h[t];if(!count||count===g.length)continue;const delta=partial/count-(sum-partial)/(g.length-count),variance=count*(g.length-count)*delta*delta;if(variance>best){best=variance;threshold=t;}}return Math.max(35,Math.min(220,threshold+1));}
function sample(g,w,h,x,y){x-=.5;y-=.5;if(x<0||y<0||x>=w-1||y>=h-1)return 255;const i=Math.floor(x),j=Math.floor(y),dx=x-i,dy=y-j;return g[j*w+i]*(1-dx)*(1-dy)+g[j*w+i+1]*dx*(1-dy)+g[(j+1)*w+i]*(1-dx)*dy+g[(j+1)*w+i+1]*dx*dy;}
const cross=(o,a,b)=>(a[0]-o[0])*(b[1]-o[1])-(a[1]-o[1])*(b[0]-o[0]);
function quad(points){
 points.sort((a,b)=>a[0]-b[0]||a[1]-b[1]);const lower=[],upper=[];
 for(const p of points){while(lower.length>1&&cross(lower.at(-2),lower.at(-1),p)<=0)lower.pop();lower.push(p);}
 for(let i=points.length-1;i>=0;i--){const p=points[i];while(upper.length>1&&cross(upper.at(-2),upper.at(-1),p)<=0)upper.pop();upper.push(p);}
 const q=lower.slice(0,-1).concat(upper.slice(0,-1));
 while(q.length>4){let at=0,min=Infinity;for(let i=0;i<q.length;i++){const area=Math.abs(cross(q[(i+q.length-1)%q.length],q[i],q[(i+1)%q.length]));if(area<min){min=area;at=i;}}q.splice(at,1);}
 return q;
}
function components(binary,w,h){
 const seen=new Uint8Array(binary.length),queue=new Int32Array(binary.length),out=[];
 for(let start=0;start<binary.length;start++){
  if(seen[start]||!binary[start])continue;let head=0,tail=1,minX=w,minY=h,maxX=0,maxY=0;queue[0]=start;seen[start]=1;const edge=[];
  while(head<tail){const i=queue[head++],x=i%w,y=Math.floor(i/w);minX=Math.min(x,minX);maxX=Math.max(x,maxX);minY=Math.min(y,minY);maxY=Math.max(y,maxY);let boundary=false;
   for(const[dx,dy]of[[1,0],[-1,0],[0,1],[0,-1]]){const xx=x+dx,yy=y+dy;if(xx<0||yy<0||xx>=w||yy>=h){boundary=true;continue;}const j=yy*w+xx;if(!binary[j])boundary=true;else if(!seen[j]){seen[j]=1;queue[tail++]=j;}}
   if(boundary)edge.push([x+.5,y+.5]);
  }
  const bw=maxX-minX+1,bh=maxY-minY+1,fill=tail/(bw*bh);
  if(tail>=35&&bw>=12&&bh>=12&&bw<Math.max(w,h)*.38&&bh<Math.max(w,h)*.38&&bw/bh>.28&&bw/bh<3.6&&fill>.12&&fill<.76)out.push({edge,area:tail});
 }
 return out.sort((a,b)=>b.area-a.area).slice(0,12000);
}
const pop=n=>{n-=(n>>>1)&0x55555555;n=(n&0x33333333)+((n>>>2)&0x33333333);return(((n+(n>>>4))&0x0f0f0f0f)*0x01010101)>>>24;};
const exact=new Map(Array.from(MARKERS,(w,i)=>[w,i]));
function orient(x,y,r,mirror){if(mirror)x=1-x;for(let i=0;i<r;i++)[x,y]=[1-y,x];return[x,y];}
function readMarker(g,w,h,q){
 let H;try{H=homography(q.map((p,i)=>[[[0,0],[1,0],[1,1],[0,1]][i],p]));}catch{return null;}
 const at=(x,y)=>sample(g,w,h,...project(H,x,y));
 const black=[[.055,.5],[.945,.5],[.5,.055],[.5,.945]].map(p=>at(...p)),white=[[.16,.5],[.84,.5],[.5,.16],[.5,.84]].map(p=>at(...p));
 const dark=black.reduce((a,b)=>a+b)/4,light=white.reduce((a,b)=>a+b)/4;if(light-dark<45)return null;
 const threshold=(dark+light)/2;let best=null;
 for(let m=0;m<2;m++)for(let r=0;r<4;r++){
  let word=0;for(let y=0;y<5;y++)for(let x=0;x<5;x++){const p=orient((2.5+x)/9,(2.5+y)/9,r,m);if(at(...p)<threshold)word|=1<<(y*5+x);}
  let index=exact.get(word),distance=0;
  if(index===undefined){distance=3;for(let i=0;i<MARKERS.length;i++){const d=pop(MARKERS[i]^word);if(d<distance){distance=d;index=i;}}}
  if(index!==undefined&&(!best||distance<best.distance)){
   best={...markerMeta(index),distance,center:project(H,.5,.5),corners:[[0,0],[1,0],[1,1],[0,1]].map(p=>project(H,...orient(...p,r,m))),dark,light};
  }
 }
 return best;
}
export function findMarkers(image,g=grayscale(image),adaptive=false){
 const{width:w,height:h}=image,threshold=otsu(g),binary=new Uint8Array(g.length);
 if(!adaptive){for(let i=0;i<g.length;i++)binary[i]=g[i]<threshold?1:0;}
 else{
  const stride=w+1,sum=new Float64Array((w+1)*(h+1));for(let y=0;y<h;y++){let row=0;for(let x=0;x<w;x++){row+=g[y*w+x];sum[(y+1)*stride+x+1]=sum[y*stride+x+1]+row;}}
  const radius=Math.max(9,Math.floor(Math.min(w,h)/45));
  for(let y=0;y<h;y++)for(let x=0;x<w;x++){const a=Math.max(0,x-radius),b=Math.min(w,x+radius+1),c=Math.max(0,y-radius),d=Math.min(h,y+radius+1),mean=(sum[d*stride+b]-sum[c*stride+b]-sum[d*stride+a]+sum[c*stride+a])/((b-a)*(d-c));binary[y*w+x]=g[y*w+x]<mean-12?1:0;}
 }
 const found=[];for(const c of components(binary,w,h)){const q=quad(c.edge);if(q.length!==4)continue;const mark=readMarker(g,w,h,q);if(mark)found.push({...mark,area:c.area});}return found;
}
function registration(markers,meta,affine=false){
 const positions=markerPositions(meta.size),pairs=markers.map(m=>[positions[m.id],m.center]);
 if(affine){const rows=pairs.map(([p])=>[p[0],p[1],1]),x=solve(rows,pairs.map(p=>p[1][0])),y=solve(rows,pairs.map(p=>p[1][1]));return[...x,...y,0,0,1];}
 if(markers.length>=4)return homography(pairs);
 // Three distinct locator centres plus their orientation-bearing corners permit
 // a projective fit when a crop removes a side. Small locators limit precision.
 const offsets=[[-1,-1],[1,-1],[1,1],[-1,1]];
 for(const m of markers)for(let j=0;j<4;j++)pairs.push([[positions[m.id][0]+offsets[j][0]*(MARKER-1)/2,positions[m.id][1]+offsets[j][1]*(MARKER-1)/2],m.corners[j]]);
 return homography(pairs);
}
export function readRegistered(image,g,H,meta,{dark=15,light=245}={}){
 const grid=logicalGrid(meta.type,meta.size),values=[],valid=[];let confidences=0;
 const organic=meta.type>=2?organicLayout(meta.type,meta.size,grid,geometry(meta.size).width):null;
 const at=(row,col,p)=>{
  let total=0,inside=0;
  for(const[dx,dy]of[[0,0],[-.02,0],[.02,0],[0,-.02],[0,.02]]){
   const[x,y]=project(H,...(organic?[p[0]+dx*3,p[1]+dy*3]:dataPoint(meta.type,meta.size,row,col,[p[0]+dx,p[1]+dy])));
   if(x>=0&&y>=0&&x<image.width-1&&y<image.height-1)inside++;
   total+=sample(g,image.width,image.height,x,y);
  }
  return{ink:Math.max(0,Math.min(1,(light-total/5)/(light-dark))),inside:inside===5};
 };
 for(let row=0;row<grid;row++)for(let col=0;col<grid;col++){
  const p=organic?{kind:'pairs',pairs:[organic.bits[row*grid+col].pair]}:probes(meta.type,row,col);let value=0,confidence=1,visible=true;
  if(p.kind==='hole'){
   const samples=p.points.map(point=>at(row,col,point)),sorted=samples.map((s,i)=>({...s,i})).sort((a,b)=>a.ink-b.ink);
   value=sorted[0].i;confidence=Math.min(sorted[1].ink-sorted[0].ink,sorted[1].ink);visible=samples.every(s=>s.inside);
  }else{
   for(const pair of p.pairs){const a=at(row,col,pair[0]),b=at(row,col,pair[1]);value=(value<<1)|(a.ink>b.ink?1:0);confidence=Math.min(confidence,Math.abs(a.ink-b.ink));visible&&=a.inside&&b.inside;}
  }
  values.push(value);valid.push(visible&&confidence>.26);confidences+=confidence;
 }
 const result=decodeValues(values,valid,meta);
 return{...result,unreadableSymbols:valid.filter(v=>!v).length,symbols:values.length,meanConfidence:confidences/values.length,H};
}
export function decodeImage(image,{quick=false}={}){
 const started=performance.now(),base=grayscale(image);let lastError='No RS reference marks found',bestCount=0;
 for(let pass=0;pass<(quick?1:3);pass++){
  const g=pass===2?base.map(v=>255-v):base,marks=findMarkers(image,g,pass===1),groups=new Map();
  for(const m of marks){const key=[m.type,m.size,m.level].join('/');if(!groups.has(key))groups.set(key,new Map());const group=groups.get(key),old=group.get(m.id);if(!old||m.distance<old.distance||m.distance===old.distance&&m.area>old.area)group.set(m.id,m);}
  for(const group of [...groups.values()].sort((a,b)=>b.size-a.size)){
   bestCount=Math.max(bestCount,group.size);if(group.size<3)continue;
   const markers=[...group.values()],meta=markers[0];
   for(const affine of markers.length===3?[false,true]:[false])try{
    const H=registration(markers,meta,affine),dark=markers.reduce((s,m)=>s+m.dark,0)/markers.length,light=markers.reduce((s,m)=>s+m.light,0)/markers.length;
    const result=readRegistered(image,g,H,meta,{dark,light});return{...result,markers:markers.length,elapsedMs:performance.now()-started,thresholdPass:pass};
   }catch(error){lastError=error.message;}
  }
 }
 throw Error(bestCount<3?`Found ${bestCount} of at least 3 required reference marks. Try a larger, sharper image.`:lastError);
}
