// A graph alphabet: two bits choose each star position; two bits choose edges.
// Triangles, chains and polygons are consequences of those real graph choices.
export function constellationLayout(grid,width,variant){
 const count=grid*grid/4,R=(width-140)*.43,cx=width/2,cy=width/2,spacing=Math.sqrt(Math.PI*R*R/count),shift=spacing*.17,radius=spacing*.105;
 const nodes=Array.from({length:count},(_,i)=>{const a=i*2.399963229728653+variant*.29,r=R*Math.sqrt((i+.5)/count),base=[cx+Math.cos(a)*r*(1+.035*Math.sin(a*3+variant)),cy+Math.sin(a)*r*.94];return{base,positions:[0,1,2,3].map(v=>[base[0]+(v&2?1:-1)*shift,base[1]+(v&1?1:-1)*shift])};});
 const used=new Set(),links=[];for(let i=0;i<count;i++){const nearest=nodes.map((n,j)=>({j,d:(n.base[0]-nodes[i].base[0])**2+(n.base[1]-nodes[i].base[1])**2})).filter(n=>n.j!==i).sort((a,b)=>a.d-b.d),chosen=[];for(const{j}of nearest){const key=Math.min(i,j)+','+Math.max(i,j);if(used.has(key))continue;used.add(key);chosen.push(j);if(chosen.length===2)break;}links.push(chosen);}
 return{kind:'graph',nodes,links,radius,stroke:spacing*.055,shift,bounds:[cx-R-shift-radius,cy-R-shift-radius,cx+R+shift+radius,cy+R+shift+radius],stars:[]};
}
export function constellationSVG(layout,values,ink,shapeOffset){const positions=layout.nodes.map((n,i)=>i*4===shapeOffset?n.base:n.positions[(values[i*4]<<1)|values[i*4+1]]),out=[];
 for(let i=0;i<positions.length;i++)for(let k=0;k<2;k++)if(values[i*4+2+k]){const a=positions[i],b=positions[layout.links[i][k]];out.push(`<path d="M${a[0]} ${a[1]}L${b[0]} ${b[1]}" fill="none" stroke="${ink}" stroke-width="${layout.stroke}" stroke-linecap="round"/>`);}
 for(let i=0;i<positions.length;i++){const[x,y]=positions[i],r=layout.radius*(i%11===0?1.25:1);out.push(`<circle cx="${x}" cy="${y}" r="${r}" fill="${ink}"/>`);if(i%17===0)out.push(`<path d="M${x-r*1.8} ${y}H${x+r*1.8}M${x} ${y-r*1.8}V${y+r*1.8}" stroke="${ink}" stroke-width="${r*.45}"/>`);}
 return out.join('');
}
export function readConstellation(layout,at,shapeOffset,variant){const values=[],valid=[],positions=[],confidence=[];
 for(let i=0;i<layout.nodes.length;i++){const node=layout.nodes[i];if(i*4===shapeOffset){positions.push(node.base);confidence.push(1);values.push((variant>>1)&1,variant&1,0,0);valid.push(true,true,false,false);continue;}
  const scores=node.positions.map(p=>{let sum=0,inside=true;for(const[dx,dy]of[[0,0],[-.45,0],[.45,0],[0,-.45],[0,.45]]){const q=at([p[0]+dx*layout.radius,p[1]+dy*layout.radius]);sum+=q.ink;inside&&=q.inside;}return{ink:sum/5,inside};}),ranked=scores.map((s,v)=>({...s,v})).sort((a,b)=>b.ink-a.ink),v=ranked[0].v,c=ranked[0].ink-ranked[1].ink;positions.push(node.positions[v]);confidence.push(c);values.push((v>>1)&1,v&1,0,0);valid.push(c>.20&&ranked[0].inside,c>.20&&ranked[0].inside,false,false);
 }
 for(let i=0;i<positions.length;i++)for(let k=0;k<2;k++){const j=layout.links[i][k],a=positions[i],b=positions[j],samples=[];let inside=true;for(let n=0;n<9;n++){const t=.20+.60*n/8,p=at([a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t]);samples.push(p.ink);inside&&=p.inside;}samples.sort((a,b)=>a-b);const ink=samples[4],index=i*4+2+k;values[index]=ink>.30?1:0;valid[index]=inside&&confidence[i]>.20&&confidence[j]>.20&&Math.abs(ink-.30)>.08;}
 return{values,valid};
}
