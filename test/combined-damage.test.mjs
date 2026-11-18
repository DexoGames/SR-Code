import test from 'node:test';
import assert from 'node:assert/strict';
import {encode,shapeVariant,TYPES,LEVELS,plan} from '../src/format.js';
import {toSVG} from '../src/render.js';
import {decodeImage} from '../src/vision.js';
import {raster} from '../scripts/runtime.mjs';
import {damagedCapture} from '../scripts/combined-damage.mjs';

test('Every small style recovers with rotation, blur and 6% cover together',async()=>{
  for(let type=0;type<TYPES.length;type++){
    const code=encode('Rotation proof',{type,size:0,level:2});
    const frame=await damagedCapture(await raster(toSVG(code),360),{angle:37,blur:.9});
    assert.equal(decodeImage(frame,{camera:true}).text,'Rotation proof',TYPES[type].name);
  }
});

for(const [level,protection] of LEVELS.entries()){
  test(`Small Constellation recovers every layout under combined damage at ${protection.name}`,async t=>{
    const opts={type:5,size:0,level,binary:true},variants=new Map(),length=plan(5,0,level).capacity;
    for(let seed=0;seed<256&&variants.size<4;seed++){
      const bytes=Uint8Array.from({length},(_,i)=>(seed+i*71)&255),code=encode(bytes,opts);
      variants.set(shapeVariant(code),code);
    }
    assert.equal(variants.size,4);
    const cases=[
      [19,[.50,.50]],[-37,[.241,.202]],[71,[.790,.228]],
      [-119,[.50,.50]],[143,[.791,.771]],[177,[.200,.731]]
    ];
    for(const [variant,code] of variants){
      const image=await raster(toSVG(code),360);
      for(const [angle,center] of cases)await t.test(`variant ${variant}, ${angle}°, cover at ${center}`,async()=>{
        const frame=await damagedCapture(image,{angle,blur:1,center});
        const result=decodeImage(frame,{camera:true});
        assert.deepEqual(result.data,code.payload);
      });
    }
  });
}

test('Combined damage remains readable at M, L and XL',async()=>{
  for(const [size,width,angle] of [[1,480,-28],[2,640,43],[3,800,-137]]){
    const code=encode('Across the night sky',{type:5,size,level:2});
    const frame=await damagedCapture(await raster(toSVG(code),width),{angle,blur:1,center:[.52,.48]});
    assert.equal(decodeImage(frame,{camera:true}).text,'Across the night sky');
  }
});

test('Small Constellation reads through dark and grey occlusion at Light correction',async()=>{
  const code=encode('RS Code',{type:5,size:0,level:0}),image=await raster(toSVG(code),360);
  for(const coverGray of [0,128]){
    const frame=await damagedCapture(image,{angle:37,blur:1,coverGray});
    assert.equal(decodeImage(frame,{camera:true}).text,'RS Code');
  }
});
