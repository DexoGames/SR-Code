import {encode,TYPES} from '../src/format.js';
import {toSVG} from '../src/render.js';
import {decodeImage} from '../src/vision.js';
import {raster,sharp} from './runtime.mjs';
import {damagedCapture} from './combined-damage.mjs';
import {webcamFrame,webcamScenarios} from './webcam-fixtures.mjs';
import {writeFileSync,mkdirSync} from 'node:fs';

const samples=process.argv.includes('--quick')?1:3,results=[];
mkdirSync('test-output',{recursive:true});
for(const [type,style] of TYPES.entries()){
  const rows=[];
  for(let n=0;n<samples;n++){
    const text=['https://dexo.games','https://example.com','RS webcam test 003'][n];
    const svg=toSVG(encode(text,{type,size:0,level:2})),image=await raster(svg);
    for(const scenario of webcamScenarios){
      const frame=scenario.damage
        ?await damagedCapture(await raster(svg,scenario.captureWidth),scenario.damage)
        :await webcamFrame(image,scenario.options);
      let row;
      try{
        const result=decodeImage(frame,{camera:true});
        row={pass:result.text===text,wrongDecode:result.text!==text,ms:result.elapsedMs};
      }catch(e){row={pass:false,error:e.message,found:e.found??0};}
      rows.push({sample:n,scenario:scenario.id,...row});
      if(!row.pass&&scenario.required)process.exitCode=1;
      if(n===0&&scenario.id==='tilted')await sharp(frame.data,{raw:{width:frame.width,height:frame.height,channels:4}}).png().toFile(`test-output/webcam-${style.id}.png`);
    }
  }
  results.push({type:style.id,rows});
  console.log(style.name,rows.filter(r=>r.pass).length+'/'+rows.length,[...new Set(rows.filter(r=>!r.pass).map(r=>r.scenario))]);
}
const method='Synthetic S/Strong camera captures and a required 360-pixel rotated, blurred and partially covered read on white paper.';
writeFileSync('public/webcam-benchmark.json',JSON.stringify({format:'RS Code v6',method,samples,scenarios:webcamScenarios,results},null,2));
