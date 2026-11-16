import{decodeImage}from'./vision.js';
import{decodeBurst}from'./burst-reader.js';
self.onmessage=({data:{id,image,frames,camera=false}})=>{try{const decoded=frames?decodeBurst(frames,{camera}):{result:decodeImage(image,{camera}),width:image.width,height:image.height};self.postMessage({id,...decoded});}catch(error){self.postMessage({id,error:error.message,found:error.found??0,outline:error.outline??null,frameIndex:error.frameIndex,width:error.width??image?.width,height:error.height??image?.height});}};
