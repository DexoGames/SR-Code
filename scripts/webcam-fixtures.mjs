import{homography,project}from'../src/vision.js';
import{sharp}from'./runtime.mjs';
export async function webcamFrame(image,{quad=[[290,155],[970,195],[925,850],[320,825]],width=1280,height=960,blur=.55,shadow=false,moire=false,jpeg=false}={}){
 const data=new Uint8Array(width*height*4),H=homography(quad.map((p,i)=>[p,[[0,0],[image.width,0],[image.width,image.height],[0,image.height]][i]]));
 for(let y=0;y<height;y++)for(let x=0;x<width;x++){const k=(y*width+x)*4;let bg=85+30*y/height+12*Math.sin(x/110)*Math.sin(y/80);data[k]=bg+15;data[k+1]=bg+8;data[k+2]=bg;data[k+3]=255;const[a,b]=project(H,x+.5,y+.5),xx=Math.floor(a-.5),yy=Math.floor(b-.5);if(xx<0||yy<0||xx>=image.width-1||yy>=image.height-1)continue;const dx=a-.5-xx,dy=b-.5-yy;
  for(let c=0;c<3;c++){let value=image.data[(yy*image.width+xx)*4+c]*(1-dx)*(1-dy)+image.data[(yy*image.width+xx+1)*4+c]*dx*(1-dy)+image.data[((yy+1)*image.width+xx)*4+c]*(1-dx)*dy+image.data[((yy+1)*image.width+xx+1)*4+c]*dx*dy;if(shadow)value*=.55+.45*x/width;if(moire)value+=7*Math.sin(x*2.3)*Math.sin(y*2.7);data[k+c]=Math.max(0,Math.min(255,value));}
 }
 let p=sharp(data,{raw:{width,height,channels:4}});if(blur)p=p.blur(blur);if(jpeg)p=sharp(await p.jpeg({quality:78}).toBuffer());const out=await p.ensureAlpha().raw().toBuffer({resolveWithObject:true});return{data:out.data,width:out.info.width,height:out.info.height};
}
export const webcamScenarios=[
 {id:'offset',name:'Phone within a larger frame',options:{quad:[[350,140],[1050,140],[1050,840],[350,840]],blur:0}},
 {id:'tilted',name:'Tilt + lens blur',options:{}},
 {id:'shadow',name:'Tilt + shadow + JPEG',options:{shadow:true,jpeg:true,blur:.65}},
 {id:'moire',name:'Tilt + simulated screen interference',options:{moire:true,blur:.55}},
 {id:'medium',name:'Code about 520 px wide',options:{quad:[[370,250],[900,280],[870,790],[390,780]],blur:.5}},
 {id:'small',name:'Code about 360 px wide',options:{quad:[[470,330],[835,350],[815,700],[480,700]],blur:.65}}
];
