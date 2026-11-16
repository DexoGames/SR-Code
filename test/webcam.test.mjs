import{test}from'node:test';import assert from'node:assert/strict';import{encode,TYPES}from'../src/format.js';import{toSVG,geometry}from'../src/render.js';import{landmarkSVG}from'../src/landmarks.js';import{decodeImage}from'../src/vision.js';import{raster}from'../scripts/runtime.mjs';import{webcamFrame}from'../scripts/webcam-fixtures.mjs';
test('All six languages read a tilted, blurred code inside an unrelated frame',async()=>{
 for(let type=0;type<6;type++){const image=await raster(toSVG(encode('https://dexo.games',{type,size:0,level:2}))),frame=await webcamFrame(image,{quad:[[235,130],[980,240],[875,880],[290,800]],blur:.55,shadow:true,jpeg:true});const result=decodeImage(frame,{camera:true});assert.equal(result.text,'https://dexo.games',TYPES[type].name);assert.equal(result.markers,4);assert.equal(result.registration,'themed landmarks');}
});
test('A missing corner yields useful guidance, and landmarks alone never yield a message',async()=>{
 const code=encode('https://dexo.games',{type:0,size:0,level:2}),image=await raster(toSVG(code),600);for(let y=0;y<100;y++)for(let x=0;x<100;x++)image.data.fill(255,(y*600+x)*4,(y*600+x)*4+4);
 assert.throws(()=>decodeImage(image,{camera:true}),e=>e.found===3&&/3\/4/.test(e.message));
 const w=geometry(0).width,svg=`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${w}"><rect width="100%" height="100%" fill="white"/>${landmarkSVG(5,w,'black','white')}</svg>`;
 const empty=await raster(svg,600);assert.throws(()=>decodeImage(empty,{camera:true}));
});

test('A snapshot burst recovers a moving code without mixing different exposures',async()=>{
 const {decodeBurst}=await import('../src/burst-reader.js');
 const a=await raster(toSVG(encode('first exposure',{type:5,size:0,level:2}))),b=await raster(toSVG(encode('moving code',{type:5,size:0,level:2})));
 const blurred=await webcamFrame(a,{blur:7}),moving=await webcamFrame(b,{quad:[[325,150],[1020,205],[915,865],[300,790]],blur:.55});
 const result=decodeBurst([{image:blurred,quality:100},{image:moving,quality:50}],{camera:true});
 assert.equal(result.frameIndex,1);assert.equal(result.result.text,'moving code');assert.equal(result.result.markers,4);
});
