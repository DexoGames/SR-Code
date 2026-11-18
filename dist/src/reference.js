import {ANCHORS,RADIUS,CLEARANCE,TAU,polar,dot,stroke,xy,num} from './patterns/common.js';
export const INNER=.74;
export const PUPIL=[.15,.275,.40,.53];
export function signature(type,size,variant) {
  return 128 | type<<4 | size<<2 | variant;
}
export function tickPoint(center, bit, offset=0, radius=1.205) {
  return polar(center,radius*RADIUS,(bit+.5+offset)*TAU/8);
}
export function referenceSVG(code,variant,ink,paper) {
  const word=signature(code.type,code.size,variant),parts=[];
  ANCHORS.forEach((p,i)=>{
    parts.push(dot(p,CLEARANCE,paper),dot(p,RADIUS,ink),dot(p,RADIUS*INNER,paper),dot(p,RADIUS*PUPIL[i],ink));
    const arcs=[];
    for(let bit=0;bit<8;bit++)if(word&(1<<bit)){
      const r=num(1.205*RADIUS);
      arcs.push(`M${xy(tickPoint(p,bit,-.31))}A${r} ${r} 0 0 1 ${xy(tickPoint(p,bit,.31))}`);
    }
    parts.push(stroke(arcs.join(''),RADIUS*.195,ink));
  });
  return parts.join('');
}
