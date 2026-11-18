import {trefoil,knot as braid} from '../patterns/knot.js';
import {feature} from './shapes.js';
import {TAU} from '../patterns/common.js';

let windows;
export function knotMarks(){
  if(windows)return windows;
  // Measure the four genuine windows enclosed by the swept trefoil cable.
  // Sampling its fixed silhouette only once keeps the reader independent
  // of all local crossing decisions and of which cable lies uppermost.
  const guide=trefoil(0,true),step=1.5,N=668,mask=new Uint8Array(N*N),r=80.5;
  for(let i=0;i<1800;i++){
    const [x,y]=guide.point(i/1800);
    for(let row=Math.max(0,Math.ceil((y-r)/step));row<=Math.min(N-1,Math.floor((y+r)/step));row++){
      const dx=Math.sqrt(r*r-(row*step-y)**2);
      mask.fill(1,row*N+Math.max(0,Math.ceil((x-dx)/step)),row*N+Math.min(N,1+Math.floor((x+dx)/step)));
    }
  }
  const queue=new Int32Array(N*N),found=[];
  for(let i=0;i<mask.length;i++){
    if(mask[i])continue;
    let size=1,sx=0,sy=0,border=false;queue[0]=i;mask[i]=2;
    for(let at=0;at<size;at++){
      const p=queue[at],x=p%N,y=Math.floor(p/N);sx+=x;sy+=y;
      if(x===0||x===N-1||y===0||y===N-1)border=true;
      for(const q of [x? p-1:-1,x<N-1?p+1:-1,p-N,p+N])if(q>=0&&q<mask.length&&!mask[q]){mask[q]=2;queue[size++]=q;}
    }
    if(border||size<40)continue;
    const cx=sx/size,cy=sy/size,contour=[];
    for(let j=0;j<96;j++){
      const a=j*TAU/96,dx=Math.cos(a),dy=Math.sin(a);let d=0;
      while(d<320&&mask[Math.round(cy+d*dy)*N+Math.round(cx+d*dx)]!==1)d+=.25;
      contour.push([(cx+dx*(d-.125))*step,(cy+dy*(d-.125))*step]);
    }
    const m=feature(contour,false,{band:4.2});m.area=size*step*step;m.center=[cx*step,cy*step];found.push(m);
  }
  if(found.length!==4)throw Error('Expected four trefoil windows');
  windows=found;return windows;
}
export const knot=(n,v)=>({...braid(n,v,true),marks:knotMarks()});
