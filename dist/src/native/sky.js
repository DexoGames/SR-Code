import {dot,stroke,path,symbolValue,strongest,takeEvenly} from '../patterns/common.js';
import {triangle,ellipse,feature,filled,around} from './shapes.js';

export const MIN_ANGLE=30;
const cosine=Math.cos(MIN_ANGLE*Math.PI/180);
export function triangleMarks(){
  return [[[241,202],34,.45,.99],[[790,228],39,-.8,1.03],[[791,771],34,1.65,.98],[[200,731],40,2.10,1.02]].map(([p,r,a,k])=>triangle(p,r,a,k));
}
// The graph keeps its original attachment points. The light window inside
// each stellar body is a separate connected component, even on a busy graph.
export function skyMarks(){
  const specs=[
    {points:4,r:39,waist:.34,rx:9,ry:12,tilt:0},
    {points:5,r:33,waist:.53,rx:10,ry:10,tilt:.22},
    {points:8,r:33,waist:.72,rx:13,ry:13,tilt:.08},
    {points:0,r:31,rx:15,ry:9,tilt:-.60}
  ];
  return triangleMarks().map((group,i)=>{
    const {points,r,waist,rx,ry,tilt}=specs[i],p=group.center;
    const body=points?Array.from({length:2*points},(_,j)=>{
      const a=j*Math.PI/points-Math.PI/2,rad=j%2?r*waist:r;
      return around(p,tilt,rad*Math.cos(a),rad*Math.sin(a)*(i===0?1.16:1));
    }):ellipse(p,r*.72,r*.72);
    const window=i===0?[[-rx,0],[0,-ry],[rx,0],[0,ry]].map(([x,y])=>around(p,tilt,x,y)):ellipse(p,rx,ry,tilt);
    const m=feature(window,false,{band:5,outer:group.outer});
    // Sample the rays as well as the window so orientation participates in scoring.
    if(points)for(let j=0;j<points;j++){
      const a=j*2*Math.PI/points-Math.PI/2;
      const ray=(angle,length)=>around(p,tilt,length*Math.cos(angle),length*Math.sin(angle)*(i===0?1.16:1));
      m.dark.push(ray(a,r*(waist+.12)));m.bright.push(ray(a+Math.PI/points,r*(waist+.21)));
    }
    m.draw=(ink,paper='#fff')=>{
      const orbit=points?'':stroke(path(ellipse(p,39,12,tilt))+'Z',5,ink);
      return group.outer.map(q=>dot(q,4,ink)).join('')+orbit+filled(body,ink)+filled(window,paper);
    };
    return m;
  });
}
const distance=(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1]);
function distanceToSegment(p,a,b){
  const x=b[0]-a[0],y=b[1]-a[1],t=Math.max(0,Math.min(1,((p[0]-a[0])*x+(p[1]-a[1])*y)/(x*x+y*y)));
  return Math.hypot(p[0]-a[0]-x*t,p[1]-a[1]-y*t);
}
const turn=(a,b,c)=>(b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]);
function segmentDistance(a,b,c,d){
  if(turn(a,b,c)*turn(a,b,d)<0&&turn(c,d,a)*turn(c,d,b)<0)return 0;
  return Math.min(distanceToSegment(a,c,d),distanceToSegment(b,c,d),distanceToSegment(c,a,b),distanceToSegment(d,a,b));
}
export function angleAllowed(a,b,c){
  // Check every possible position of all three stars, even when both links
  // are optional. The resulting guarantee is independent of payload.
  for(const p of a.positions)for(const q of b.positions)for(const r of c.positions){
    const ux=q[0]-p[0],uy=q[1]-p[1],vx=r[0]-p[0],vy=r[1]-p[1];
    if(ux*vx+uy*vy>cosine*Math.hypot(ux,uy)*Math.hypot(vx,vy))return false;
  }
  return true;
}

export function sky(n,variant,classic=false){
  const groups=triangleMarks(),marks=classic?groups:skyMarks(),count=Math.ceil(n*n*.345),nodes=[],edges=[],field=[];
  const total=Math.ceil(count*1.20)+10,spacing=441*Math.sqrt(Math.PI/total);
  const shift=spacing*.124,radius=spacing*.142;
  for(let i=0;i<total;i++){
    const a=i*2.3999632297+variant*.34,r=443*Math.sqrt((i+.5)/total);
    const p=[500+r*Math.cos(a)*(1+.025*Math.cos(3*a)),500+r*Math.sin(a)*.97];
    if(groups.some(m=>distance(p,m.center)<Math.sqrt(m.area)*1.14+spacing*.38))continue;
    field.push(p);
  }
  for(const p of takeEvenly(field,count)){
    const positions=[0,1,2,3].map(v=>[p[0]+(v&2?shift:-shift),p[1]+(v&1?shift:-shift)]);
    nodes.push({p,positions,adj:[],motion:Math.SQRT2*shift,rad:radius});
  }
  function add(i,j,fixed){
    nodes[i].adj.push(j);nodes[j].adj.push(i);edges.push({i,j,fixed});
  }
  for(const m of marks){
    const start=nodes.length;
    for(const [k,p] of m.outer.entries())nodes.push({p,positions:[p],adj:[],motion:0,rad:[7.5,5.1,6.3][k]});
    for(let k=0;k<3;k++)add(start+k,start+(k+1)%3,true);
  }
  const candidates=[];
  for(let i=0;i<nodes.length;i++)for(let j=i+1;j<nodes.length;j++){
    const d=distance(nodes[i].p,nodes[j].p);
    if(d<spacing*2.05&&(i<count||j<count))candidates.push({i,j,d});
  }
  candidates.sort((a,b)=>a.d-b.d);
  for(const {i,j} of candidates){
    const a=nodes[i],b=nodes[j];
    if(a.adj.length>=4||b.adj.length>=4)continue;
    if(a.adj.some(k=>!angleAllowed(a,b,nodes[k]))||b.adj.some(k=>!angleAllowed(b,a,nodes[k])))continue;
    const drift=Math.max(a.motion,b.motion);
    if(nodes.some((s,k)=>k!==i&&k!==j&&distanceToSegment(s.p,a.p,b.p)<s.rad+s.motion+drift+spacing*.070))continue;
    if(edges.some(e=>e.i!==i&&e.i!==j&&e.j!==i&&e.j!==j&&segmentDistance(a.p,b.p,nodes[e.i].p,nodes[e.j].p)<drift+Math.max(nodes[e.i].motion,nodes[e.j].motion)+spacing*.14))continue;
    add(i,j,false);
  }
  const links=takeEvenly(edges.filter(e=>!e.fixed),n*n-2*count);
  // Data comes from the two position bits of each star and an independently
  // selectable subset of the legal edges. Other edges are absent.
  const dataEdges=new Set(links);
  const spare=edges.filter(e=>!e.fixed&&!dataEdges.has(e));
  const permanent=takeEvenly(spare,Math.min(spare.length,Math.round(count*.26)));
  const visible=edges.filter(e=>e.fixed).concat(permanent,links);
  // Walk concentric bands so nearby star and link bits share codewords.
  // The two position bits of each star travel together.
  const symbols=nodes.slice(0,count).map((node,i)=>({p:node.p,offset:2*i,width:2}));
  links.forEach(({i,j},k)=>symbols.push({p:nodes[i].p.map((x,d)=>(x+nodes[j].p[d])/2),offset:2*count+k,width:1}));
  if(!classic){
    const bandWidth=spacing*1.6;
    for(const symbol of symbols){
      const x=symbol.p[0]-500,y=symbol.p[1]-500;
      symbol.band=Math.floor(Math.hypot(x,y)/bandWidth);
      symbol.angle=Math.atan2(y,x);
    }
    symbols.sort((a,b)=>a.band-b.band||a.angle-b.angle||a.offset-b.offset);
  }
  const offsets=[];
  let next=0;
  for(const s of symbols)for(let k=0;k<s.width;k++)offsets[s.offset+k]=next++;
  return {marks,nodes,edges:visible,render(code,ink,paper){
    const pos=nodes.map((s,i)=>s.positions[i<count?symbolValue(code,offsets[i*2],2):0]);
    const lines=permanent.map(e=>path([pos[e.i],pos[e.j]]));
    links.forEach((e,i)=>{if(symbolValue(code,offsets[2*count+i],1))lines.push(path([pos[e.i],pos[e.j]]));});
    return stroke(lines.join(''),spacing*.105,ink)+pos.slice(0,count).map((p,i)=>dot(p,radius*(i%13===0?1.16:1),ink)).join('')+marks.map(m=>m.draw(ink,paper)).join('');
  },read(at,out){
    const pos=[],confidence=[];
    nodes.forEach((node,i)=>{
      if(i>=count){pos.push(node.p);confidence.push(1);return;}
      const scores=node.positions.map(([x,y])=>(2*at(x,y)+at(x-radius*.53,y)+at(x+radius*.53,y)+at(x,y-radius*.53)+at(x,y+radius*.53))/6);
      const best=scores.indexOf(Math.max(...scores));pos.push(node.positions[Math.max(0,best)]);
      strongest(scores,out);confidence.push(Math.min(...out.confidence.slice(-2)));
    });
    for(const {i,j} of links){
      const a=pos[i],b=pos[j],probes=[];
      for(const t of [.32,.38,.44,.50,.56,.62,.68])probes.push(at(a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t));
      probes.sort((a,b)=>a-b);
      out.put(probes[3]>.40,Math.min(confidence[i],confidence[j],Math.abs(probes[3]-.40)*2));
    }
    if(!classic){
      const bits=out.bits.slice(),strength=out.confidence.slice();
      offsets.forEach((to,from)=>{out.bits[to]=bits[from];out.confidence[to]=strength[from];});
    }
  }};
}
