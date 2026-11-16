import{createRequire}from'node:module';
const local=createRequire(import.meta.url);
export function dependency(name){try{return local(name);}catch{
 const root=process.env.RS_NODE_MODULES||'/Users/dexter/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules';
 try{return createRequire(root+'/package.json')(name);}catch{throw Error(`Install development dependency ${name}, or set RS_NODE_MODULES.`);}
}}
export const sharp=dependency('sharp');
export async function raster(svg,size){let p=sharp(Buffer.from(svg));if(size)p=p.resize(size,size);const{data,info}=await p.ensureAlpha().raw().toBuffer({resolveWithObject:true});return{data,width:info.width,height:info.height};}
