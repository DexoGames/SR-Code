import{test}from'node:test';import assert from'node:assert/strict';
import{rsEncode,rsDecode,crc32}from'../src/ecc.js';
import{encode,decodeValues,encodeSequence,assemble,TYPES,SIZES,LEVELS,plan}from'../src/format.js';
let seed=123;const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/2**32;};
test('CRC-32 standard check vector',()=>assert.equal(crc32(new TextEncoder().encode('123456789')),0xcbf43926));
test('RS randomized errors and erasures up to algebraic boundary',()=>{
 for(let trial=0;trial<180;trial++){
  const n=32+Math.floor(random()*180),parity=8+Math.floor(random()*Math.min(55,n-10));
  const data=Uint8Array.from({length:n-parity},()=>Math.floor(random()*256)),code=rsEncode(data,parity);
  const positions=Array.from({length:n},(_,i)=>i).sort(()=>random()-.5),s=Math.floor(random()*(parity+1)),errors=Math.floor((parity-s)/2);
  for(let i=0;i<s+errors;i++)code[positions[i]]^=1+Math.floor(random()*255);
  assert.deepEqual(rsDecode(code,parity,positions.slice(0,s)).data,data);
 }
});
test('All types, sizes and correction levels round-trip capacity-bound payloads',()=>{
 for(let t=0;t<TYPES.length;t++)for(let s=0;s<SIZES.length;s++)for(let l=0;l<LEVELS.length;l++){
  const p=plan(t,s,l),data=Uint8Array.from({length:p.capacity},(_,i)=>i*17&255),e=encode(data,{type:t,size:s,level:l,binary:true});
  assert.deepEqual(decodeValues(e.values,e.values.map(()=>true),e).data,data);
  assert.throws(()=>encode(new Uint8Array(p.capacity+1),{type:t,size:s,level:l}));
 }
});
test('Structured append preserves arbitrary Unicode across byte boundaries',()=>{
 const message='Hello 🌿 — RS Code. '.repeat(20),parts=encodeSequence(message,{type:1,size:0,level:2});
 const decoded=parts.map(e=>decodeValues(e.values,e.values.map(()=>true),e));
 assert.equal(assemble(decoded.reverse()).text,message);
});
test('Uncorrectable corruption never silently yields a valid packet',()=>{
 const e=encode('Test',{type:0,size:0,level:0}),values=e.values.map(v=>v^1);
 assert.throws(()=>decodeValues(values,values.map(()=>true),e));
});
