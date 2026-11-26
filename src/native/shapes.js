import {TAU, path, stroke, dot} from '../patterns/common.js';

export const mix=(a,b,t)=>[a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t];
export const around=(p,a,x,y)=>[p[0]+x*Math.cos(a)-y*Math.sin(a),p[1]+x*Math.sin(a)+y*Math.cos(a)];
export const ellipse=(p,rx,ry,a=0)=>Array.from({length:64},(_,i)=>around(p,a,rx*Math.cos(i*TAU/64),ry*Math.sin(i*TAU/64)));
export const filled=(points,color)=>`<path d="${path(points)}Z" fill="${color}"/>`;
export function polygonMetrics(ps) {
  let area=0,x=0,y=0;
  for(let i=0;i<ps.length;i++){
    const a=ps[i],b=ps[(i+1)%ps.length],w=a[0]*b[1]-a[1]*b[0];
    area+=w;x+=(a[0]+b[0])*w;y+=(a[1]+b[1])*w;
  }
  return {center:[x/(3*area),y/(3*area)],area:Math.abs(area/2)};
}

// A landmark describes an actual connected ink island or paper window in the
// design. The template samples both sides of its contour. No common artwork
// is placed on top of the six layouts.
export function feature(contour,positive,{band=6,draw=null,outer=null}={}) {
  const {center,area}=polygonMetrics(contour);
  const bright=[],dark=[];
  const n=contour.length;
  for(let j=0;j<16;j++){
    const t=(j+.37)*n/16,k=Math.floor(t),edge=mix(contour[k],contour[(k+1)%n],t-k);
    const len=Math.hypot(edge[0]-center[0],edge[1]-center[1]);
    const inside=mix(center,edge,Math.max(.3,1-band*.62/len));
    const outside=mix(center,edge,1+band*.55/len);
    (positive?dark:bright).push(inside);
    (positive?bright:dark).push(outside);
  }
  return {center,area,positive,contour,bright,dark,draw,outer};
}

export function stone(center,r,angle,seed=0) {
  // Keep the width and height close. Asymmetry only softens the outline.
  const [cx,cy]=center,cos=Math.cos(angle),sin=Math.sin(angle);
  return Array.from({length:40},(_,i)=>{
    const a=TAU*i/40,w=r*(1+.040*Math.cos(3*a+seed)+.021*Math.sin(2*a-seed));
    const x=w*Math.cos(a),y=w*.96*Math.sin(a);
    return [cx+x*cos-y*sin,cy+x*sin+y*cos];
  });
}

export function triangle(center,r,angle,skew) {
  const points=[[1,0],[-.66,.86],[-.54,-.83]].map(([x,y])=>around(center,angle,x*r,y*r*skew));
  const width=5.4;
  // The inner contour of a stroked triangle is a homothetic copy about
  // its incenter, which also preserves the centroid measurement under tilt.
  const lengths=points.map((p,i)=>Math.hypot(p[0]-points[(i+1)%3][0],p[1]-points[(i+1)%3][1]));
  const perimeter=lengths.reduce((a,b)=>a+b),ic=[0,1].map(k=>points.reduce((s,p,i)=>s+p[k]*lengths[(i+1)%3],0)/perimeter);
  const inradius=2*polygonMetrics(points).area/perimeter;
  const contour=points.map(p=>mix(ic,p,1-width/(2*inradius)));
  return feature(contour,false,{band:width,outer:points,draw:ink=>stroke(path(points)+'Z',width,ink)+points.map((p,i)=>dot(p,[7.5,5.1,6.3][i],ink)).join('')});
}

export function corallite(center,r,angle) {
  // The reader follows the continuous, scalloped lumen of this mature cup.
  const ray=(a,k)=>around(center,angle,r*(1+.045*Math.cos(5*a))*Math.cos(a)*1.15*k,r*(1+.045*Math.cos(5*a))*Math.sin(a)*.91*k);
  const contour=Array.from({length:140},(_,i)=>{
    const a=i*TAU/140;return ray(a,.87-.43*Math.max(0,Math.cos(7*a+angle))**6);
  });
  const outer=Array.from({length:90},(_,i)=>ray(i*TAU/90,1));
  const m=feature(contour,false,{band:r*.11,outer,draw:(ink,paper)=>filled(outer,ink)+filled(contour,paper)});
  for(let i=0;i<7;i++){
    const a=(i*TAU-angle)/7;
    m.dark.push(ray(a,.67),ray(a,.74));m.bright.push(ray(a,.30),ray(a+.25,.59));
  }
  return m;
}
