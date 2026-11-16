import{test}from'node:test';import assert from'node:assert/strict';
import{encode,TYPES,plan}from'../src/format.js';import{toSVG,geometry}from'../src/render.js';
import{decodeImage,readRegistered,grayscale,homography,findMarkers}from'../src/vision.js';import{raster,sharp}from'../scripts/runtime.mjs';
test('Six types decode actual raster pixels without metadata',async()=>{
 for(let type=0;type<TYPES.length;type++){
  const code=encode('https://dexo.games/rs',{type,size:1,level:2}),image=await raster(toSVG(code));
  const g=grayscale(image),direct=readRegistered(image,g,[1,0,0,0,1,0,0,0,1],code);assert.equal(direct.text,'https://dexo.games/rs',TYPES[type].name+' registered');
  const result=decodeImage(image);assert.equal(result.text,'https://dexo.games/rs',TYPES[type].name);assert.ok(result.markers>=3);
 }
});
test('Every size, language and protection level reads a capacity-bound raster',async()=>{
 for(let type=0;type<TYPES.length;type++)for(let size=0;size<4;size++)for(let level=0;level<4;level++){
  const p=plan(type,size,level),bytes=Uint8Array.from({length:p.capacity},(_,i)=>(i*43+type*17+size)&255);
  const image=await raster(toSVG(encode(bytes,{type,size,level,binary:true})));
  assert.deepEqual(decodeImage(image).data,bytes,`${TYPES[type].name} size ${size} level ${level}`);
 }
});
test('Mirrored images decode and blank images are rejected',async()=>{
 for(let type=0;type<TYPES.length;type++){
  const svg=toSVG(encode('mirror',{type,size:0,level:2}));
  const {data,info}=await sharp(Buffer.from(svg)).flop().ensureAlpha().raw().toBuffer({resolveWithObject:true});
  assert.equal(decodeImage({data,width:info.width,height:info.height}).text,'mirror');
 }
 assert.throws(()=>decodeImage({width:400,height:400,data:new Uint8Array(400*400*4).fill(255)}));
});
