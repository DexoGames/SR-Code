import {EXTENT} from '../src/patterns/common.js';
import{test}from'node:test';import assert from'node:assert/strict';
import{encode,TYPES,plan,shapeVariant}from'../src/format.js';import{toSVG}from'../src/render.js';
import{decodeImage,readRegistered,grayscale}from'../src/vision.js';import{raster,sharp}from'../scripts/runtime.mjs';
test('Six types decode actual raster pixels without metadata',async()=>{
 for(let type=0;type<TYPES.length;type++){
  const code=encode('https://dexo.games/rs',{type,size:1,level:2}),image=await raster(toSVG(code));
  const g=grayscale(image),direct=readRegistered(image,g,[image.width/EXTENT,0,0,0,image.width/EXTENT,0,0,0,1],{...code,variant:shapeVariant(code)});assert.equal(direct.text,'https://dexo.games/rs',TYPES[type].name+' registered');
  const result=decodeImage(image);assert.equal(result.text,'https://dexo.games/rs',TYPES[type].name);assert.equal(result.markers,4);
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

test('Messages change actual paths; exports have no square locator blocks',async()=>{
 for(let type=0;type<6;type++){
  const a=encode('https://dexo.games',{type,size:1,level:2}),b=encode('https://example.com',{type,size:1,level:2}),sa=toSVG(a),sb=toSVG(b);
  assert.notEqual(sa,sb);assert.equal((sa.match(/<rect/g)||[]).length,1);
  if(type>=2)assert.notEqual(shapeVariant(a),shapeVariant(b));
  assert.equal(decodeImage(await raster(sb)).text,'https://example.com');
 }
});

test('Previously exported v4 and v5 artwork still reads in camera mode',async()=>{
 for(const version of [4,5])for(let type=0;type<6;type++){
  const text='previous print', code=encode(text,{type,size:0,level:2,version});
  const image=await raster(toSVG(code),720), result=decodeImage(image,{camera:true});
  assert.equal(result.version,version); assert.equal(result.text,text,TYPES[type].name);
 }
});
