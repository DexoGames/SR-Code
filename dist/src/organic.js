import{ridgeLayout,ridgeSVG}from'./ridge-layout.js';
import{knotLayout,knotSVG}from'./knot-layout.js';
import{constellationLayout,constellationSVG}from'./constellation.js';
import{coralLayout}from'./coral-layout.js';
const cache=new Map();
export function organicLayout(type,size,grid,width,variant=0){
 const key=[type,size,grid,width,variant].join('/');if(cache.has(key))return cache.get(key);
 const layout=type===2?coralLayout(size,grid,width,variant):type===3?knotLayout(size,grid,width,variant):type===4?ridgeLayout(size,grid,width,variant):type===5?constellationLayout(grid,width,variant):null;
 if(!layout)throw Error('Unknown structural language');cache.set(key,layout);return layout;
}
export function organicSVG(layout,values,ink,shapeOffset=-1,paper='#fff'){
 if(layout.kind==='ridge')return ridgeSVG(layout,values,ink,shapeOffset);
 if(layout.kind==='knot')return knotSVG(layout,values,ink,paper,shapeOffset);
 if(layout.kind==='graph')return constellationSVG(layout,values,ink,shapeOffset);
 const path=pts=>pts.map((p,i)=>`${i?'L':'M'}${p[0].toFixed(3)} ${p[1].toFixed(3)}`).join(' ');
 return layout.decor.map(p=>`<path d="${path(p)}" fill="none" stroke="${ink}" stroke-width="${layout.decorStroke??1}"/>`).join('')+layout.bits.map((b,i)=>`<path d="${path(b.points(i===shapeOffset||i===shapeOffset+1?0:values[i]?1:-1))}" fill="none" stroke="${ink}" stroke-width="${b.stroke}" stroke-linecap="round"/>`).join('');
}
