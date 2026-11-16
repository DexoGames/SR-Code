import{organicLayout,organicSVG}from'./organic.js';
import{SIZES,shapeOffset,shapeVariant}from'./format.js';
export const CELL=36,PAD=52,MARKER=36;
export function geometry(size){const grid=SIZES[size].grid,inner=grid*CELL,width=inner+2*PAD;return{grid,inner,width,pad:PAD,cell:CELL};}
const f=x=>Math.round(x*1000)/1000;
export function dataPoint(type,size,row,col,p){
 const{grid,inner,width}=geometry(size);let[x,y]=p;
 if(type===4){
  const angle=2*Math.PI*(col+x)/grid,r=inner*(.11+.37*(row+y)/grid),wave=1+.04*Math.sin(3*angle+.4);
  return[width/2+r*wave*Math.cos(angle),width/2+r*wave*Math.sin(angle)*.97];
 }
 if(type===1){x+=(row%2?.075:-.075)+.015*Math.sin(row*31+col*17);y+=.02*Math.cos(col*19+row*11);}
 return[PAD+(col+x)*CELL,PAD+(row+y)*CELL];
}
export function motif(type,value,row,col){
 const p=[],circles=[],ellipses=[],cuts=[];
 const path=(d,w=.12,white=false)=>p.push({d,w,white});
 const dot=(x,y,r=.075,white=false)=>circles.push({x,y,r,white});
 if(type===0){
  path(value?'M0 .5 A.5 .5 0 0 0 .5 0 M.5 1 A.5 .5 0 0 1 1 .5':'M.5 0 A.5 .5 0 0 0 1 .5 M0 .5 A.5 .5 0 0 1 .5 1',.18);
 }else if(type===1){
  ellipses.push({x:.5,y:.5,rx:.425+.015*Math.sin(row*13+col),ry:.425+.015*Math.cos(col*7+row)});
  const spots=[[.5,.27],[.73,.5],[.5,.73],[.27,.5]];dot(...spots[value],.14,true);
 }else if(type===2){
  path('M.5 1 C.60 .73 .40 .27 .5 0',.095);
  for(let j=0;j<2;j++){const right=(value>>(1-j))&1,y=.27+j*.43,x=right?.78:.22;
   path(`M.5 ${f(y+.22)} Q${right?.7:.3} ${f(y+.20)} ${x} ${y}`,.13);dot(x,y,.085);
  }
 }else if(type===3){
  path('M0 0 L1 1 M0 1 L1 0',.21);
  path(value?'M.20 .20 L.80 .80':'M.20 .80 L.80 .20',.60,true);
  path(value?'M0 0 L1 1':'M0 1 L1 0',.21);
 }else if(type===4){
  for(let j=0;j<2;j++){
   const y=.28+j*.44,phase=(row%4)*.35,amp=.065;
   const curve=x=>y+amp*Math.sin((col+x)*Math.PI/3+phase);
   const gap=(value>>(1-j))&1?.7:.3;
   const segments=[[0,gap-.115],[gap+.115,1]];
   for(const [a,b]of segments){const pts=Array.from({length:13},(_,i)=>{const x=a+(b-a)*i/12;return`${i?'L':'M'}${f(x)} ${f(curve(x))}`;});path(pts.join(' '),.105);}
  }
 }else{
  const phase=((row*17+col*11)%12)*Math.PI/6;
  dot(.5,.5,.07);
  for(let j=0;j<6;j++){const a=phase+j*Math.PI/3,x=.5+.39*Math.cos(a),y=.5+.39*Math.sin(a);dot(x,y,.045);}
  for(let j=0;j<3;j++){
   const b=(value>>(2-j))&1,a=phase+(2*j+b)*Math.PI/3;
   path(`M.5 .5 L${f(.5+.39*Math.cos(a))} ${f(.5+.39*Math.sin(a))}`,.085);
  }
 }
 return{p,circles,ellipses,cuts};
}
export function probes(type,row,col){
 if(type===0)return{kind:'pairs',pairs:[[[.35355,.35355],[.64645,.35355]]],positive:1};
 if(type===1)return{kind:'hole',points:[[.5,.27],[.73,.5],[.5,.73],[.27,.5]]};
 if(type===2)return{kind:'pairs',pairs:[[[.78,.27],[.22,.27]],[[.78,.70],[.22,.70]]],positive:1};
 if(type===3)return{kind:'pairs',pairs:[[[.35,.35],[.35,.65]]],positive:1};
 if(type===4){const phase=(row%4)*.35,curve=(x,j)=>.28+j*.44+.065*Math.sin((col+x)*Math.PI/3+phase);return{kind:'pairs',pairs:[0,1].map(j=>[[.3,curve(.3,j)],[.7,curve(.7,j)]]),positive:1};}
 const phase=((row*17+col*11)%12)*Math.PI/6;
 return{kind:'pairs',pairs:[0,1,2].map(j=>[1,0].map(b=>{const a=phase+(2*j+b)*Math.PI/3;return[.5+.23*Math.cos(a),.5+.23*Math.sin(a)];})),positive:1};
}
export function toSVG(code,{ink='#171714',paper='#ffffff'}={}){
 const{width}=geometry(code.size),grid=code.grid,out=[`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${width}" width="${width}" height="${width}"><rect width="100%" height="100%" fill="${paper}"/>`];
 if(code.type>=2)out.push(organicSVG(organicLayout(code.type,code.size,grid,width,shapeVariant(code)),code.values,ink,shapeOffset(code.type,code.size)));
 if(code.type<2)for(let row=0;row<grid;row++)for(let col=0;col<grid;col++){
  if(code.type===4){
   const value=code.values[row*grid+col];
   for(let j=0;j<2;j++){
    const gap=(value>>(1-j))&1?.7:.3;
    for(const[a,b]of[[0,gap-.115],[gap+.115,1]]){
     const points=Array.from({length:13},(_,i)=>{const x=a+(b-a)*i/12,y=.28+j*.44+.065*Math.sin((col+x)*Math.PI/3+(row%4)*.35),p=dataPoint(4,code.size,row,col,[x,y]);return`${i?'L':'M'}${f(p[0])} ${f(p[1])}`;});
     out.push(`<path d="${points.join(' ')}" fill="none" stroke="${ink}" stroke-width="${CELL*.075}" stroke-linecap="round"/>`);
    }
   }continue;
  }
  const m=motif(code.type,code.values[row*grid+col],row,col);
  const origin=dataPoint(code.type,code.size,row,col,[0,0]);
  out.push(`<g transform="translate(${origin[0]} ${origin[1]}) scale(${CELL})">`);
  for(const e of m.ellipses)out.push(`<ellipse cx="${e.x}" cy="${e.y}" rx="${e.rx}" ry="${e.ry}" fill="${ink}"/>`);
  for(const p of m.p)out.push(`<path d="${p.d}" fill="none" stroke="${p.white?paper:ink}" stroke-width="${p.w}" stroke-linecap="round" stroke-linejoin="round"/>`);
  for(const c of m.circles)out.push(`<circle cx="${c.x}" cy="${c.y}" r="${c.r}" fill="${c.white?paper:ink}"/>`);
  out.push('</g>');
 }
 out.push('</svg>');return out.join('');
}
