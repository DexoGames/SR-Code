import {TAU,path,stroke,strongest,symbolValue,takeEvenly} from '../patterns/common.js';
import {feature} from './shapes.js';

function ridge(r,a,variant) {
  const f=r/446, drift=(1-f)**2, wave=1+.042*Math.sin(3*a+.65)+.024*Math.cos(5*a-.15);
  return [500+Math.cos(a)*r*.855*wave+39*f*Math.sin(a)+(35+variant*13)*drift,
    496+Math.sin(a)*r*1.02*wave+(68-variant*13)*drift];
}
const curve=(fn,from,to,count)=>Array.from({length:count+1},(_,i)=>fn(from+(to-from)*i/count));
const lakes=[[-2.49,.14,29],[-.79,.117,24],[.59,.142,27],[2.14,.154,26]];
function lake(a,half,h){
  const point=(t,offset)=>ridge(446+offset,a-half+2*half*t,0);
  const height=t=>h*Math.sin(Math.PI*t)**2;
  const band=7,lo=Math.asin(Math.sqrt(band/h))/Math.PI,hi=1-lo;
  const contour=curve(t=>point(t,band/2),lo,hi,28).concat(curve(t=>point(t,height(t)-band/2),hi,lo,28));
  return feature(contour,false,{band,draw:ink=>stroke(path(curve(t=>point(t,height(t)),0,1,36)),band,ink)});
}
export const fingerprintMarks=()=>lakes.map(m=>lake(...m));
export function fingerprint(n,variant) {
  const marks=fingerprintMarks(), rings=Math.round(n*.74),pitch=414/(rings-1),weight=pitch*.33;
  const lanes=[],sites=[];
  for(let i=0;i<rings;i++){
    const r=12+i*pitch;
    const circumference=TAU*r*.96,sections=i<2?0:Math.ceil(circumference/(70*24/n));
    const angle=t=>TAU*(t+i*.381966);
    const q=(t,d=0)=>ridge(r+d,angle(t),variant);
    const lane={q,sections:[],count:sections};lanes.push(lane);
    for(let j=0;j<sections;j++){
      const at=(t,d=0)=>q((j+t)/sections,d),s={at,branch:(j+2*i)%3!==0};
      lane.sections.push(s);sites.push(s);
    }
  }
  const symbols=takeEvenly(sites,n*n/2);
  symbols.forEach((s,i)=>{s.index=i;});
  return {marks,render(code,ink){
    const lines=[],branches=[];
    for(const lane of lanes){
      const gaps=[];
      for(let j=0;j<lane.count;j++){
        const s=lane.sections[j];if(s.index===undefined)continue;
        const t=.125+symbolValue(code,s.index*2,2)*.25;
        if(s.branch){
          // A minutia leaves the ridge tangentially and ends in the valley.
          branches.push(path(curve(u=>s.at(t-.15+.15*u,pitch*.51*u*u*(3-2*u)),0,1,8)));
        }else gaps.push([(j+t-.105)/lane.count,(j+t+.105)/lane.count]);
      }
      if(!gaps.length){lines.push(path(curve(lane.q,0,1,240))+'Z');continue;}
      for(let k=0;k<gaps.length;k++){
        const start=gaps[k][1],end=gaps[(k+1)%gaps.length][0]+(k===gaps.length-1?1:0);
        lines.push(path(curve(lane.q,start,end,Math.max(3,Math.ceil((end-start)*240)))));
      }
    }
    const outside=path(curve(t=>ridge(446,TAU*t,0),0,1,420))+'Z';
    return stroke(lines.join(''),weight,ink,'butt')+stroke(branches.join(''),weight*.87,ink)+stroke(outside,7,ink)+marks.map(m=>m.draw(ink)).join('');
  },read(at,out){
    for(const s of symbols){
      const scores=[.125,.375,.625,.875].map(t=>s.branch?
        (at(...s.at(t,pitch*.51))+at(...s.at(t-.018,pitch*.49)))/2:
        -(at(...s.at(t-.035))+2*at(...s.at(t))+at(...s.at(t+.035)))/4);
      strongest(scores,out);
    }
  }};
}
