import {logicalGrid} from '../format.js';
import {weave,weaveMarks,pebbles,pebbleMarks} from './textile.js';
import {reef,reefMarks} from './reef.js';
import {knot,knotMarks} from './knot.js';
import {fingerprint,fingerprintMarks} from './print.js';
import {sky,skyMarks} from './sky.js';

const factories=[weave,pebbles,reef,knot,fingerprint,sky];
const guides=[weaveMarks,pebbleMarks,reefMarks,knotMarks,fingerprintMarks,skyMarks];
const cache=new Map(),guideCache=new Map();
export function nativePattern(type,size,variant=0,classic=false){
  const key=[type,size,variant,classic].join('/');
  if(!cache.has(key)){
    if(cache.size>=12)cache.delete(cache.keys().next().value);
    cache.set(key,factories[type](logicalGrid(type,size),variant,classic));
  }
  return cache.get(key);
}
export function nativeMarks(type,size){
  const key=type<2?type+'/'+size:type;
  if(!guideCache.has(key))guideCache.set(key,guides[type](logicalGrid(type,size)));
  return guideCache.get(key);
}
