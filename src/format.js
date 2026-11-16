import{rsEncode,rsDecode,crc32}from'./ecc.js';
export const TYPES=[
{id:'weave',name:'Weave',bits:1,potential:'Flowing textile patterns.',risk:'Curves merge under heavy blur.',probe:'Two curved connection states.'},
{id:'pebble',name:'Pebble',bits:2,potential:'Varied stone sizes with separated openings.',risk:'Small openings fill under blur.',probe:'The position of each opening.'},
{id:'coral',name:'Coral',bits:1,potential:'One connected branching specimen.',risk:'Fine tips need resolution.',probe:'Branch structure and the direction of larger branch tips.'},
{id:'knot',name:'Knot',bits:1,potential:'An interlaced ornament with four strand routings.',risk:'Crossings constrain where data can live.',probe:'Over–under crossings and turning strand pairs.'},
{id:'fingerprint',name:'Fingerprint',bits:1,potential:'Oval ridges flowing around a small core.',risk:'A central mask affects many ridge sections.',probe:'Core geometry and four possible ridge-ending positions.'},
{id:'constellation',name:'Constellation',bits:1,potential:'Stars connected into an irregular sky map.',risk:'Fine links need resolution.',probe:'Four possible star positions plus two connection decisions per star.'}
];
export const SIZES=[{name:'S',grid:24},{name:'M',grid:36},{name:'L',grid:52},{name:'XL',grid:72}];
export const LEVELS=[{name:'Light',ratio:.16},{name:'Balanced',ratio:.28},{name:'Strong',ratio:.40},{name:'Maximum',ratio:.52}];
export const logicalGrid=(type,size)=>type>=2?[24,28,32,36][size]:SIZES[size].grid;
export const shapeOffset=(type,size)=>64*plan(type,size,0).blocks.length;
export const shapeVariant=code=>code.type>=2?(code.values[shapeOffset(code.type,code.size)]<<1)|code.values[shapeOffset(code.type,code.size)+1]:0;
export const HEADER=24,MAX_PARTS=16;
export function plan(type,size,level){
  const t=TYPES[type],s=SIZES[size],l=LEVELS[level];if(!t||!s||!l)throw Error('Unsupported RS Code format');
  const grid=logicalGrid(type,size),total=Math.floor(grid*grid*t.bits/8),count=Math.ceil(total/128);
  const blocks=Array.from({length:count},(_,i)=>{const n=Math.floor(total/count)+(i<total%count?1:0),p=Math.ceil(n*l.ratio);return{n,p,k:n-p};});
  return{type,size,level,grid,bits:t.bits,total,blocks,capacity:blocks.reduce((s,b)=>s+b.k,0)-HEADER,parity:blocks.reduce((s,b)=>s+b.p,0)};
}
export function whiten(i){let x=(i+1)*0x45d9f3b;x=Math.imul(x^(x>>>16),0x45d9f3b);return(x^(x>>>16))&255;}
function packet(payload,p,{part=0,parts=1,totalLength=payload.length,group=crc32(payload),binary=false}={}){
  if(payload.length>p.capacity)throw Error(`This size holds ${p.capacity} bytes; the payload needs ${payload.length}.`);
  const a=new Uint8Array(p.capacity+HEADER),v=new DataView(a.buffer);
  a.set([82,83,4,p.type,p.size,p.level,binary?0:1,0]);v.setUint32(8,group);a[12]=part;a[13]=parts;
  v.setUint32(14,totalLength);v.setUint16(18,payload.length);a.set(payload,HEADER);
  const check=new Uint8Array(20+payload.length);check.set(a.subarray(0,20));check.set(payload,20);v.setUint32(20,crc32(check));
  return a;
}
export function encode(payload,{type=0,size=1,level=2,...meta}={}){
  const bytes=typeof payload==='string'?new TextEncoder().encode(payload):Uint8Array.from(payload),p=plan(type,size,level);
  const pack=packet(bytes,p,meta),blocks=[];let offset=0;
  for(const b of p.blocks){blocks.push(rsEncode(pack.slice(offset,offset+b.k),b.p));offset+=b.k;}
  const stream=new Uint8Array(p.total);let out=0;
  for(let col=0;col<Math.max(...blocks.map(b=>b.length));col++)for(const b of blocks)if(col<b.length)stream[out]=b[col]^whiten(out++);
  const values=[];
  for(let i=0;i<p.grid*p.grid;i++){let value=0;for(let bit=0;bit<p.bits;bit++){const q=i*p.bits+bit;value=(value<<1)|((stream[q>>>3]||0)>>(7-(q&7))&1);}values.push(value);}
  return{...p,values,payload:bytes,meta};
}
export function encodeSequence(payload,options={}){
  const bytes=typeof payload==='string'?new TextEncoder().encode(payload):Uint8Array.from(payload),p=plan(options.type??0,options.size??1,options.level??2);
  const count=Math.max(1,Math.ceil(bytes.length/p.capacity));if(count>MAX_PARTS)throw Error(`Use a larger size: this selection supports at most ${p.capacity*MAX_PARTS} bytes across 16 parts.`);
  return Array.from({length:count},(_,part)=>encode(bytes.slice(part*p.capacity,(part+1)*p.capacity),{...options,part,parts:count,totalLength:bytes.length,group:crc32(bytes)}));
}
export function decodeValues(values,valid,{type,size,level}){
  const p=plan(type,size,level),stream=new Uint8Array(p.total),missing=new Uint8Array(p.total);
  for(let i=0;i<values.length;i++)for(let bit=0;bit<p.bits;bit++){
    const q=i*p.bits+bit,b=q>>>3;if(b>=p.total)continue;
    stream[b]|=((values[i]>>(p.bits-1-bit))&1)<<(7-(q&7));if(!valid[i])missing[b]=1;
  }
  for(let i=0;i<stream.length;i++)stream[i]^=whiten(i);
  const blocks=p.blocks.map(b=>new Uint8Array(b.n)),erased=p.blocks.map(()=>[]);let offset=0;
  for(let col=0;col<Math.max(...p.blocks.map(b=>b.n));col++)for(let b=0;b<blocks.length;b++)if(col<blocks[b].length){blocks[b][col]=stream[offset];if(missing[offset])erased[b].push(col);offset++;}
  const bytes=new Uint8Array(p.capacity+HEADER);let at=0,corrected=0,erasures=0;
  for(let i=0;i<blocks.length;i++){const d=rsDecode(blocks[i],p.blocks[i].p,erased[i]);bytes.set(d.data,at);at+=d.data.length;corrected+=d.corrected;erasures+=d.erasures;}
  const v=new DataView(bytes.buffer),length=v.getUint16(18),parts=bytes[13],part=bytes[12],totalLength=v.getUint32(14);
  if(bytes[0]!==82||bytes[1]!==83||bytes[2]!==4||bytes[3]!==type||bytes[4]!==size||bytes[5]!==level||length>p.capacity||parts<1||parts>16||part>=parts||totalLength>p.capacity*parts)throw Error('Invalid decoded header');
  const data=bytes.slice(HEADER,HEADER+length),check=new Uint8Array(20+length);check.set(bytes.subarray(0,20));check.set(data,20);
  if(crc32(check)!==v.getUint32(20))throw Error('Checksum mismatch; scan rejected');
  if(parts===1&&(totalLength!==length||crc32(data)!==v.getUint32(8)))throw Error('Payload integrity check failed');
  return{data,text:bytes[6]===1&&parts===1?new TextDecoder('utf-8',{fatal:true}).decode(data):null,binary:bytes[6]===0,group:v.getUint32(8),part,parts,totalLength,corrected,erasures,...p};
}
export function assemble(parts){
  if(!parts.length)throw Error('No parts');const first=parts[0],map=new Map();
  for(const p of parts){if(p.group!==first.group||p.parts!==first.parts||p.totalLength!==first.totalLength||p.binary!==first.binary)throw Error('Parts belong to different messages');map.set(p.part,p);}
  if(map.size!==first.parts)throw Error(`Received ${map.size} of ${first.parts} parts`);
  const data=new Uint8Array(first.totalLength);let offset=0;
  for(let i=0;i<first.parts;i++){const part=map.get(i);if(!part||offset+part.data.length>data.length)throw Error('Invalid part sequence');data.set(part.data,offset);offset+=part.data.length;}
  if(offset!==data.length||crc32(data)!==first.group)throw Error('Assembled payload failed integrity check');
  return{data,text:first.binary?null:new TextDecoder('utf-8',{fatal:true}).decode(data)};
}
