import {nativePattern} from './native/index.js';
import {geometry,toSVG as legacySVG} from './v4-render.js';
import {shapeVariant} from './format.js';
import {pattern} from './patterns/index.js';
import {referenceSVG} from './reference.js';
import {EXTENT} from './patterns/common.js';
export {geometry};
export function toSVG(code,{ink='#171714',paper='#ffffff',landmarks=true}={}) {
  if(code.version===4)return legacySVG(code,{ink,paper,landmarks});
  const {width}=geometry(code.size), variant=shapeVariant(code);
  const art=code.version===5?pattern(code.type,code.size,variant).render(code,ink,paper)+(landmarks?referenceSVG(code,variant,ink,paper):''):nativePattern(code.type,code.size,variant).render(code,ink,paper);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${EXTENT} ${EXTENT}" width="${width}" height="${width}"><rect width="100%" height="100%" fill="${paper}"/>${art}</svg>`;
}
