import {PUPIL} from './reference.js';
import {homography,project} from './vision.js';
import {CORNERS,PUPILS,CONTENT_INSET,CONTENT_SCALE} from './landmarks.js';
const NEIGHBORS=[[1,0],[-1,0],[0,1],[0,-1]];
function solve(A,b){const m=A.map((r,i)=>[...r,b[i]]),n=b.length;for(let j=0;j<n;j++){let p=j;for(let k=j+1;k<n;k++)if(Math.abs(m[k][j])>Math.abs(m[p][j]))p=k;if(Math.abs(m[p][j])<1e-10)throw Error('singular');[m[p],m[j]]=[m[j],m[p]];const d=m[j][j];for(let k=j;k<=n;k++)m[j][k]/=d;for(let i=0;i<n;i++)if(i!==j){const f=m[i][j];for(let k=j;k<=n;k++)m[i][k]-=f*m[j][k];}}return m.map(r=>r[n]);}
const cross=(a,b,c)=>(b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]);
function hull(points){points.sort((a,b)=>a[0]-b[0]||a[1]-b[1]);const a=[],b=[];for(const p of points){while(a.length>1&&cross(a.at(-2),a.at(-1),p)<=0)a.pop();a.push(p);}for(let i=points.length-1;i>=0;i--){const p=points[i];while(b.length>1&&cross(b.at(-2),b.at(-1),p)<=0)b.pop();b.push(p);}return a.slice(0,-1).concat(b.slice(0,-1));}
function ellipse(points){const h=hull(points);if(h.length<8)return null;const mx=h.reduce((s,p)=>s+p[0],0)/h.length,my=h.reduce((s,p)=>s+p[1],0)/h.length,z=Math.max(...h.map(p=>Math.hypot(p[0]-mx,p[1]-my)));const A=Array.from({length:5},()=>Array(5).fill(0)),b=Array(5).fill(0);for(const p of h){const x=(p[0]-mx)/z,y=(p[1]-my)/z,r=[x*x,x*y,y*y,x,y];for(let i=0;i<5;i++){b[i]+=r[i];for(let j=0;j<5;j++)A[i][j]+=r[i]*r[j];}}let q;try{q=solve(A,b);}catch{return null;}const[a,bb,c,d,e]=q,det=4*a*c-bb*bb;if(det<=0)return null;const x=(bb*e-2*c*d)/det,y=(bb*d-2*a*e)/det,K=1-a*x*x-bb*x*y-c*y*y-d*x-e*y,delta=Math.hypot(a-c,bb),l1=(a+c+delta)/2,l2=(a+c-delta)/2;if(l2<=0||K<=0)return null;const u=z*Math.sqrt(K/l1),v=z*Math.sqrt(K/l2),angle=.5*Math.atan2(bb,a-c);if(u<4||v/u>3)return null;return{center:[mx+x*z,my+y*z],u,v,angle,area:Math.PI*u*v};}
function sample(g,w,h,x,y){x-=.5;y-=.5;const a=Math.floor(x),b=Math.floor(y);if(a<0||b<0||a>=w-1||b>=h-1)return 255;const dx=x-a,dy=y-b,k=b*w+a;return g[k]*(1-dx)*(1-dy)+g[k+1]*dx*(1-dy)+g[k+w]*(1-dx)*dy+g[k+w+1]*dx*dy;}
function inspect(e,g,w,h){
 const c=Math.cos(e.angle),s=Math.sin(e.angle);
 const at=(r,a)=>sample(g,w,h,e.center[0]+r*(e.u*Math.cos(a)*c-e.v*Math.sin(a)*s),e.center[1]+r*(e.u*Math.cos(a)*s+e.v*Math.sin(a)*c));
 const radial=r=>{let sum=0;for(let i=0;i<24;i++)sum+=at(r,i*Math.PI/12);return sum/24;};
 const dark=radial(1.18),light=Math.max(radial(.925),radial(1.45)),contrast=light-dark;
 if(contrast<28||radial(0)>dark+contrast*.53)return null;
 const threshold=(light+dark)/2;
 let last=radial(.04),radius=0;
 for(let r=.08;r<=.99;r+=.04){
   const value=radial(r);
   if(value>threshold){radius=r-.04+.04*(threshold-last)/(value-last);break;}
   last=value;
 }
 if(!radius)return null;
 const dist=PUPILS.map((p,i)=>Math.min(Math.abs(radius-p/.74),Math.abs(radius-PUPIL[i]/.74)));
 const id=dist.indexOf(Math.min(...dist));
 if(dist[id]>.135)return null;
 // A chamber in the pattern can enclose paper, too. Require a dark ring and
 // a light annulus around most of the ellipse, including along the short axis.
 let misses=0;
 for(let i=0;i<24;i++){
   const a=i*Math.PI/12;
   if(at(1.18,a)>threshold||at((1+radius)/2,a)<threshold||at(radius*.52,a)>threshold)misses++;
 }
 if(misses>6)return null;
 return {...e,id,dark,light,ratio:radius,quality:dist[id]+misses/24};
}
function detect(image,g,adaptive){const{width:w,height:h}=image,n=w*h,white=new Uint8Array(n),seen=new Uint8Array(n),queue=new Int32Array(n),found=[];
 if(adaptive){const stride=w+1,sum=new Float64Array((w+1)*(h+1));for(let y=0;y<h;y++){let row=0;for(let x=0;x<w;x++){row+=g[y*w+x];sum[(y+1)*stride+x+1]=sum[y*stride+x+1]+row;}}const r=Math.max(8,Math.round(Math.min(w,h)/35));for(let y=0;y<h;y++)for(let x=0;x<w;x++){const a=Math.max(0,x-r),b=Math.min(w,x+r+1),c=Math.max(0,y-r),d=Math.min(h,y+r+1),mean=(sum[d*stride+b]-sum[c*stride+b]-sum[d*stride+a]+sum[c*stride+a])/((b-a)*(d-c));white[y*w+x]=g[y*w+x]>mean-15?1:0;}}
 else{let lo=255,hi=0;for(let i=0;i<n;i++){lo=Math.min(lo,g[i]);hi=Math.max(hi,g[i]);}const t=(lo+hi)/2;for(let i=0;i<n;i++)white[i]=g[i]>t?1:0;}
 for(let start=0;start<n;start++){
  if(seen[start]||!white[start])continue;let head=0,tail=1,touch=false,minx=w,miny=h,maxx=0,maxy=0;const edges=[];queue[0]=start;seen[start]=1;
  while(head<tail){const p=queue[head++],x=p%w,y=Math.floor(p/w);if(x===0||y===0||x===w-1||y===h-1)touch=true;minx=Math.min(minx,x);maxx=Math.max(maxx,x);miny=Math.min(miny,y);maxy=Math.max(maxy,y);for(const[dx,dy]of NEIGHBORS){const xx=x+dx,yy=y+dy;if(xx<0||yy<0||xx>=w||yy>=h)continue;const k=yy*w+xx;if(!white[k]){if(!touch)edges.push([x+.5+dx*.5,y+.5+dy*.5]);}else if(!seen[k]){seen[k]=1;queue[tail++]=k;}}}
  if(touch||tail<24||maxx-minx<8||maxy-miny<8||maxx-minx>w*.2||maxy-miny>h*.2)continue;
  const e=ellipse(edges);if(!e)continue;const candidate=inspect(e,g,w,h);if(candidate)found.push(candidate);
 }
 return found;
}
export function findLandmarkFrames(image,g){let candidates=detect(image,g,false);if(new Set(candidates.map(c=>c.id)).size<4){const extra=detect(image,g,true);for(const e of extra)if(!candidates.some(c=>Math.hypot(c.center[0]-e.center[0],c.center[1]-e.center[1])<e.u*.5))candidates.push(e);}
 const groups=[0,1,2,3].map(id=>candidates.filter(c=>c.id===id).sort((a,b)=>a.quality-b.quality).slice(0,5)),frames=[];
 for(const a of groups[0])for(const b of groups[1])for(const c of groups[2])for(const d of groups[3]){const marks=[a,b,c,d],p=marks.map(m=>m.center),turns=p.map((v,i)=>cross(v,p[(i+1)%4],p[(i+2)%4]));if(!(turns.every(t=>t>0)||turns.every(t=>t<0)))continue;const area=Math.abs(p.reduce((s,v,i)=>s+v[0]*p[(i+1)%4][1]-v[1]*p[(i+1)%4][0],0))/2,mean=marks.reduce((s,m)=>s+m.area,0)/4;if(area/mean<100||area/mean>700||Math.max(...marks.map(m=>m.area))/Math.min(...marks.map(m=>m.area))>7)continue;try{const H=homography(p.map((v,i)=>[CORNERS[i],v]));frames.push({H,marks,area,dark:marks.reduce((s,m)=>s+m.dark,0)/4,light:marks.reduce((s,m)=>s+m.light,0)/4});}catch{}}
 return{frames:frames.sort((a,b)=>b.area-a.area).slice(0,4),found:new Set(candidates.map(c=>c.id)).size,candidates};
}
export function contentHomography(H,width){const a=CONTENT_SCALE/width,b=CONTENT_INSET;return[H[0]*a,H[1]*a,H[0]*b+H[1]*b+H[2],H[3]*a,H[4]*a,H[3]*b+H[4]*b+H[5],H[6]*a,H[7]*a,H[6]*b+H[7]*b+H[8]];}
