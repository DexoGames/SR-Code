import {nativePattern} from './native/index.js';
import {geometry,toSVG as legacySVG} from './v4-render.js';
import {shapeVariant} from './format.js';
import {pattern} from './patterns/index.js';
import {referenceSVG} from './reference.js';
import {EXTENT} from './patterns/common.js';
export {geometry};
function svgDocument(size, paper, art) {
  const {width}=geometry(size);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${EXTENT} ${EXTENT}" width="${width}" height="${width}"><rect width="100%" height="100%" fill="${paper}"/>${art}</svg>`;
}
export function toNativeSVG(code, {ink='#171714', paper='#ffffff'}={}) {
  const art=nativePattern(code.type,code.size,shapeVariant(code)).render(code,ink,paper);
  return svgDocument(code.size,paper,art);
}
export function toSVG(code,{ink='#171714',paper='#ffffff',landmarks=true}={}) {
  if(code.version===4)return legacySVG(code,{ink,paper,landmarks});
  if(code.version!==5)return toNativeSVG(code,{ink,paper});
  const variant=shapeVariant(code);
  const art=pattern(code.type,code.size,variant).render(code,ink,paper)+(landmarks?referenceSVG(code,variant,ink,paper):'');
  return svgDocument(code.size,paper,art);
}
