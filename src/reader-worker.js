import{decodeImage}from'./vision.js';
self.onmessage=({data:{id,image}})=>{try{const result=decodeImage(image);self.postMessage({id,result});}catch(error){self.postMessage({id,error:error.message});}};
