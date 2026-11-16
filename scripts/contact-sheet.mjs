import{sharp}from'./runtime.mjs';
import{encode,TYPES}from'../src/format.js';
import{toSVG}from'../src/render.js';
const tiles=[];
for(let type=0;type<6;type++){
 const left=(type%3)*420,top=Math.floor(type/3)*455;
 const png=await sharp(Buffer.from(toSVG(encode('https://dexo.games',{type,size:0,level:2})))).resize(400).png().toBuffer();
 tiles.push({input:png,left:left+10,top:top+10});
 const title=Buffer.from(`<svg width="420" height="35"><text x="210" y="25" text-anchor="middle" font-family="sans-serif" font-size="20" font-weight="bold" fill="#171714">${TYPES[type].name}</text></svg>`);
 tiles.push({input:title,left,top:top+413});
}
await sharp({create:{width:1260,height:910,channels:4,background:'#efede5'}}).composite(tiles).png().toFile('public/themed-landmarks.png');
