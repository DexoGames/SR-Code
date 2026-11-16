// Data follows arc length on whole shapes. No Cartesian cells are rendered.
// A bit deflects a short section of a continuous stroke to either side.
const cache = new Map();
const TAU = Math.PI * 2;
const lerp = (a,b,t) => [a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t];
export function organicLayout(type, size, grid, width) {
 const key=[type,size,grid,width].join('/'); if(cache.has(key))return cache.get(key);
 const paths=[],stars=[],scale=(width-120)/240,center=width/2;
 const convert=p=>[(p[0]-120)*scale+center,(p[1]-120)*scale+center];
 const add=points=>paths.push(points.map(convert));
 if(type===4){
  const rings=18+size*8;
  for(let i=0;i<rings;i++){
   const r=7+i*98/rings;
   add(Array.from({length:601},(_,j)=>{const a=j/600*TAU,w=r*(1+.055*Math.sin(3*a+.6)+.025*Math.cos(5*a));return[120+Math.cos(a)*w*.77+Math.sin(r*.025)*7,120+Math.sin(a)*w*1.04];}));
  }
 }else if(type===3){
  const strands=5+size*2;
  for(let k=0;k<strands;k++)add(Array.from({length:1801},(_,j)=>{const t=j/1800*TAU,r=65+25*Math.cos(5*t)+(k-(strands-1)/2)*4.8;return[120+r*Math.cos(3*t),120+r*Math.sin(3*t)];}));
 }else if(type===2){
  let seed=91;const rand=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
  function branch(x,y,a,len,depth){const bend=(rand()-.5)*.26,b=a+bend,end=[x+Math.cos(b)*len,y+Math.sin(b)*len],control=[x+Math.cos(a)*len*.5,y+Math.sin(a)*len*.5];add(Array.from({length:31},(_,i)=>{const t=i/30;return[(1-t)**2*x+2*t*(1-t)*control[0]+t*t*end[0],(1-t)**2*y+2*t*(1-t)*control[1]+t*t*end[1]];}));if(depth){const spread=.42+rand()*.22;branch(...end,b-spread,len*.73,depth-1);branch(...end,b+spread,len*.73,depth-1);}}
  branch(120,227,-Math.PI/2,54,5+Math.floor(size/2));branch(120,187,-2.35,44,3+Math.floor(size/2));branch(120,175,-.70,43,3+Math.floor(size/2));
 }else{
  const nodes=[[34,57],[64,35],[91,62],[121,40],[153,63],[198,42],[211,87],[176,105],[132,91],[92,109],[50,96],[25,132],[63,151],[108,144],[146,135],[193,153],[215,191],[168,210],[135,181],[99,204],[62,195],[31,178],[172,30],[111,20],[210,124],[78,171]];
  const edges=[[0,1],[1,2],[2,3],[2,9],[3,4],[4,5],[5,6],[6,7],[7,8],[8,9],[9,10],[10,0],[10,11],[11,12],[12,13],[13,14],[14,7],[14,15],[15,16],[16,17],[17,18],[18,13],[18,19],[19,20],[20,21],[21,12],[20,25],[3,23],[4,22],[15,24]];
  for(const[a,b]of edges){const A=nodes[a],B=nodes[b],d=Math.hypot(B[0]-A[0],B[1]-A[1]),n=[-(B[1]-A[1])/d,(B[0]-A[0])/d];for(let strand=0;strand<1+size;strand++){const off=(strand-size/2)*2.4;add(Array.from({length:81},(_,i)=>{const t=.07+.86*i/80,p=lerp(A,B,t),o=off;return[p[0]+n[0]*o,p[1]+n[1]*o];}));}}
  nodes.forEach((p,i)=>stars.push({p:convert(p),r:(i%5===0?2.6:1.5)*scale}));
 }
 const lengths=paths.map(p=>{let total=0;const sums=[0];for(let i=1;i<p.length;i++){total+=Math.hypot(p[i][0]-p[i-1][0],p[i][1]-p[i-1][1]);sums.push(total);}return{sums,total};});
 const totalLength=lengths.reduce((s,l)=>s+l.total,0),count=grid*grid*(type===3?3:2);
 const counts=lengths.map(l=>Math.floor(l.total/totalLength*count));let remain=count-counts.reduce((a,b)=>a+b,0);
 const order=lengths.map((l,i)=>({i,frac:l.total/totalLength*count-counts[i]})).sort((a,b)=>b.frac-a.frac);for(let i=0;i<remain;i++)counts[order[i].i]++;
 const bits=[],decor=[];
 for(let pi=0;pi<paths.length;pi++){
  const path=paths[pi],{sums,total}=lengths[pi],n=counts[pi];
  const at=t=>{const d=Math.max(0,Math.min(total,t*total));let lo=1,hi=sums.length-1;while(lo<hi){const mid=(lo+hi)>>1;if(sums[mid]<d)lo=mid+1;else hi=mid;}return lerp(path[lo-1],path[lo],(d-sums[lo-1])/(sums[lo]-sums[lo-1]||1));};
  if(!n){decor.push(path);continue;}
  for(let j=0;j<n;j++){
   const a=j/n,b=(j+1)/n,m=(a+b)/2,p=at(m),p0=at(m-.001),p1=at(m+.001),len=Math.hypot(p1[0]-p0[0],p1[1]-p0[1]),normal=[-(p1[1]-p0[1])/len,(p1[0]-p0[0])/len];
   const amp=Math.min(0.65*scale,total/n*.22),stroke=Math.max(.85,amp*.9);
   bits.push({pi,along:m*total,center:p,amp,pair:[1,-1].map(sign=>[p[0]+normal[0]*amp*sign,p[1]+normal[1]*amp*sign]),stroke,points:sign=>Array.from({length:9},(_,k)=>{const t=k/8,base=at(a+(b-a)*t),off=sign*amp*Math.sin(Math.PI*t)**2;return[base[0]+normal[0]*off,base[1]+normal[1]*off];})});
  }
 }
 // Reserve data only where both possible deflections have clear optical space.
 const bucket=8, bins=new Map();
 paths.forEach((path,pi)=>{let along=0;for(let j=1;j<path.length;j++){const A=path[j-1],B=path[j],len=Math.hypot(B[0]-A[0],B[1]-A[1]),steps=Math.max(1,Math.ceil(len));for(let k=0;k<steps;k++){const p=lerp(A,B,k/steps),key=Math.floor(p[0]/bucket)+','+Math.floor(p[1]/bucket);if(!bins.has(key))bins.set(key,[]);bins.get(key).push({p,pi,along:along+len*k/steps});}along+=len;}});
 const eligible=bits.filter(b=>{const radius=b.amp*1.25+b.stroke*1.1+.3,[x,y]=b.center,bx=Math.floor(x/bucket),by=Math.floor(y/bucket),range=Math.ceil(radius/bucket);for(let dx=-range;dx<=range;dx++)for(let dy=-range;dy<=range;dy++)for(const q of bins.get((bx+dx)+','+(by+dy))||[]){if(q.pi===b.pi&&Math.abs(q.along-b.along)<radius*2)continue;if(Math.hypot(q.p[0]-x,q.p[1]-y)<radius)return false;}return true;});
 if(eligible.length<grid*grid)throw Error('Not enough clear carrier positions: '+eligible.length+' / '+grid*grid);
 const selected=Array.from({length:grid*grid},(_,i)=>eligible[Math.floor(i*eligible.length/(grid*grid))]);
 const chosen=new Set(selected);for(const b of bits)if(!chosen.has(b))decor.push(b.points(0));
 const layout={bits:selected,stars,decor};cache.set(key,layout);return layout;
}
export function organicSVG(layout,values,ink){const path=pts=>pts.map((p,i)=>`${i?'L':'M'}${p[0].toFixed(3)} ${p[1].toFixed(3)}`).join(' ');return layout.decor.map(p=>`<path d="${path(p)}" fill="none" stroke="${ink}" stroke-width="1"/>`).join('')+layout.bits.map((b,i)=>`<path d="${path(b.points(values[i]?1:-1))}" fill="none" stroke="${ink}" stroke-width="${b.stroke}" stroke-linecap="round"/>`).join('')+layout.stars.map(s=>`<circle cx="${s.p[0]}" cy="${s.p[1]}" r="${s.r}" fill="${ink}"/>`).join('');}
