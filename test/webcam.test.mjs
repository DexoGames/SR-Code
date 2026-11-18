import{test}from'node:test';import assert from'node:assert/strict';import{encode,TYPES}from'../src/format.js';import{toSVG}from'../src/render.js';import {nativeMarks} from '../src/native/index.js';
import{decodeImage}from'../src/vision.js';import{raster}from'../scripts/runtime.mjs';import{webcamFrame}from'../scripts/webcam-fixtures.mjs';
test('All six languages read a tilted, blurred code inside an unrelated frame',async()=>{
 for(let type=0;type<6;type++){const image=await raster(toSVG(encode('https://dexo.games',{type,size:0,level:2}))),frame=await webcamFrame(image,{quad:[[235,130],[980,240],[875,880],[290,800]],blur:.55,shadow:true,jpeg:true});const result=decodeImage(frame,{camera:true});assert.equal(result.text,'https://dexo.games',TYPES[type].name);assert.equal(result.markers,4);assert.equal(result.registration,'pattern features');}
});
test('An obscured yarn loop can be recovered; guide stones alone never verify',async()=>{
 const code=encode('hidden loop',{type:0,size:0,level:2}),image=await raster(toSVG(code),600);
 const [cx,cy]=nativeMarks(0,0)[0].center.map(x=>Math.round(x*.6));
 for(let y=cy-25;y<=cy+25;y++)for(let x=cx-25;x<=cx+25;x++)image.data.fill(255,(y*600+x)*4,(y*600+x)*4+4);
 const read=decodeImage(image,{camera:true});
 assert.equal(read.markers,3);assert.equal(read.text,'hidden loop');
 const stones=nativeMarks(1,0).map(m=>m.draw('black','white')).join('');
 const empty=await raster(`<svg xmlns="http://www.w3.org/2000/svg" width="1000" height="1000"><rect width="100%" height="100%" fill="white"/>${stones}</svg>`,600);
 assert.throws(()=>decodeImage(empty,{camera:true}));
});

test('Small tilted codes and faded oblique prints recover for every style',async()=>{
 const capture={quad:[[412,289],[791,316],[743,648],[427,619]],blur:.62,moire:true};
 for(let type=0;type<6;type++){
   const text='Paper trial 17',code=encode(text,{type,size:0,level:2}),image=await raster(toSVG(code));
   for(const options of [capture,{quad:[[202,193],[940,300],[846,840],[320,738]],print:'spread',shadow:true,jpeg:true,blur:.72}]){
     const frame=await webcamFrame(image,options);
     assert.equal(decodeImage(frame,{camera:true}).text,text,TYPES[type].name);
   }
 }
});

test('A snapshot burst recovers a moving code without mixing different exposures',async()=>{
 const {decodeBurst}=await import('../src/burst-reader.js');
 const a=await raster(toSVG(encode('first exposure',{type:5,size:0,level:2}))),b=await raster(toSVG(encode('moving code',{type:5,size:0,level:2})));
 const blurred=await webcamFrame(a,{blur:7}),moving=await webcamFrame(b,{quad:[[325,150],[1020,205],[915,865],[300,790]],blur:.55});
 const result=decodeBurst([{image:blurred,quality:100},{image:moving,quality:50}],{camera:true});
 assert.equal(result.frameIndex,1);assert.equal(result.result.text,'moving code');assert.equal(result.result.markers,4);
});
