import{writeFileSync,mkdirSync}from'node:fs';
let seed=0x52734331;const rand=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed&0x1ffffff;};
const pop=n=>{n-=(n>>>1)&0x55555555;n=(n&0x33333333)+((n>>>2)&0x33333333);return(((n+(n>>>4))&0x0f0f0f0f)*0x01010101)>>>24;};
function transform(word,rot,mirror){let v=0;for(let y=0;y<5;y++)for(let x=0;x<5;x++){let a=mirror?4-x:x,b=y;for(let i=0;i<rot;i++)[a,b]=[4-b,a];v|=((word>>>(y*5+x))&1)<<(b*5+a);}return v;}
const words=[],orbit=[];
for(let i=0;i<768;i++){
 let attempts=0;
 while(true){
  if(++attempts>1000000)throw Error('Codebook search exhausted');
  const w=rand();if(pop(w)<8||pop(w)>17)continue;
  const variants=Array.from({length:8},(_,j)=>transform(w,j%4,j>=4));
  if(variants.slice(1).some(v=>pop(v^w)<5)||orbit.some(v=>pop(v^w)<5))continue;
  words.push(w);orbit.push(...variants);break;
 }
}
mkdirSync('src',{recursive:true});writeFileSync('src/markers.js',`// Fixed v1 locator codebook. All identities and D4 transforms differ by >=5 bits.\nexport const MARKERS=Uint32Array.from(${JSON.stringify(words)});\n`);
console.log('Generated 768 locator identities with rotation/reflection separation.');
