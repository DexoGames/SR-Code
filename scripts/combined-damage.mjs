import {sharp} from './runtime.mjs';
import {EXTENT,FIELD} from '../src/patterns/common.js';

// Cover a fraction of the unrotated pattern field. Rotate onto matching paper
// before applying lens blur at the capture resolution.
export async function damagedCapture(image,{angle,blur,center=[.5,.5],cover=.06,coverGray=255}){
  const {width,height}=image, pixels=Buffer.from(image.data);
  const side=Math.round(width*FIELD/EXTENT*Math.sqrt(cover));
  const left=Math.round(width*center[0]-side/2),top=Math.round(height*center[1]-side/2);
  const color=Buffer.from([coverGray,coverGray,coverGray,255]);
  for(let y=Math.max(0,top);y<Math.min(height,top+side);y++){
    const start=y*width+Math.max(0,left),end=y*width+Math.min(width,left+side);
    if(start<end)pixels.fill(color,4*start,4*end);
  }
  const rotated=await sharp(pixels,{raw:{width,height,channels:4}})
    .rotate(angle,{background:'#fff'}).png().toBuffer();
  const {data,info}=await sharp(rotated).blur(blur).ensureAlpha().raw().toBuffer({resolveWithObject:true});
  return {data,width:info.width,height:info.height};
}
