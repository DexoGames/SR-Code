import {TAU, nearAnchor, path, stroke, takeEvenly, strongest, symbolValue} from './common.js';

export function fingerprint(grid,variant) {
  const rings=Math.round(grid*.67), pitch=440/rings, lanes=[], candidates=[];
  const point=(r,a)=>{
    const warp=1+.044*Math.sin(3*a+.7)+.025*Math.cos(2*a-variant*.7);
    const drift=(1-r/460)**2;
    return [500+.91*r*warp*Math.cos(a)*(1-.09*Math.sin(a))+(variant-1.5)*25*drift+48*Math.sin(a)*r/460+28*drift,
      500+1.035*r*warp*Math.sin(a)+75*drift];
  };
  for(let i=0;i<rings;i++){
    const r=17+pitch*i;
    // Parameterise each ridge by actual arclength so gap widths stay comparable
    // around the sides and ends of the print.
    const curve=Array.from({length:361},(_,k)=>point(r,TAU*k/360));
    const length=[0];
    for(let k=1;k<curve.length;k++)length.push(length[k-1]+Math.hypot(curve[k][0]-curve[k-1][0],curve[k][1]-curve[k-1][1]));
    const total=length.at(-1);
    const at=t=>{
      t+=i*.381966;
      const d=(t-Math.floor(t))*total;
      let lo=1,hi=360;
      while(lo<hi){const m=(lo+hi)>>1;if(length[m]<d)lo=m+1;else hi=m;}
      const k=lo,f=(d-length[k-1])/(length[k]-length[k-1]);
      return curve[k].map((v,j)=>curve[k-1][j]+(v-curve[k-1][j])*f);
    };
    const count=i<2?0:Math.ceil(total/(68*24/grid));
    const lane={curve,at,count,sections:[]};lanes.push(lane);
    for(let j=0;j<count;j++){
      const q=t=>at((j+t)/count), s={q};
      lane.sections.push(s);
      if([.09,.30,.5,.70,.91].every(t=>!nearAnchor(q(t),pitch*.33)))candidates.push(s);
    }
  }
  takeEvenly(candidates,grid*grid/2).forEach((s,i)=>{s.index=i;});
  return {render(code,ink){
    const curves=[];
    for(const lane of lanes){
      if(!lane.count){curves.push(path(lane.curve)+'Z');continue;}
      const gaps=lane.sections.flatMap((s,j)=>{
        if(s.index===undefined)return [];
        const mid=j+.125+symbolValue(code,s.index*2,2)*.25;
        return [[(mid-.102)/lane.count,(mid+.102)/lane.count]];
      });
      if(!gaps.length){curves.push(path(lane.curve)+'Z');continue;}
      for(let k=0;k<gaps.length;k++){
        const start=gaps[k][1],end=gaps[(k+1)%gaps.length][0]+(k===gaps.length-1?1:0);
        const steps=Math.max(2,Math.ceil((end-start)*200));
        curves.push(path(Array.from({length:steps+1},(_,j)=>lane.at(start+(end-start)*j/steps))));
      }
    }
    return stroke(curves.join(''),pitch*.43,ink,'butt');
  },read(at,out){
    const symbols=lanes.flatMap(l=>l.sections).filter(s=>s.index!==undefined);
    for(const s of symbols){
      const scores=[.125,.375,.625,.875].map(t=>-(at(...s.q(t-.035))+2*at(...s.q(t))+at(...s.q(t+.035)))/4);
      strongest(scores,out);
    }
  }};
}
