import {logicalGrid} from '../format.js';
import {clothOrStone} from './cloth-stone.js';
import {coral,constellation} from './reef-sky.js';
import {knot} from './knot.js';
import {fingerprint} from './ridge-pattern.js';

const cache=new Map();
export function pattern(type,size,variant=0) {
  const key=type+'/'+size+'/'+variant;
  if(cache.has(key))return cache.get(key);
  const n=logicalGrid(type,size);
  const layout=type<2?clothOrStone(type,n):[coral,knot,fingerprint,constellation][type-2](n,variant);
  // Geometry contains functions and sampled curves. Bound the live set on phones
  // even if the user explores every size or scans unrecognisable images.
  if(cache.size>=10)cache.delete(cache.keys().next().value);
  cache.set(key,layout);
  return layout;
}
