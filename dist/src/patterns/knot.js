import {TAU, nearAnchor, path, stroke, takeEvenly, symbolValue} from './common.js';

// Follow a trefoil through its three self-intersections at constant arclength.
// Each rope in the cable exchanges neighbours along this guide. Its endpoint
// determines which rope to visit next when following the closed knot.
export function trefoil(variant,native=false) {
  const samples=[], length=[0], over=[];
  const count=1440;
  for(let i=0;i<=count;i++){
    const shape=native?1.5:variant, t=TAU*i/count, a=2*t-.5+(shape-1.5)*.045, r=250+(137+5*shape)*Math.cos(3*t);
    const x=500+r*Math.cos(a), y=500+r*Math.sin(a);
    const dr=-3*(137+5*shape)*Math.sin(3*t),dx=dr*Math.cos(a)-2*r*Math.sin(a),dy=dr*Math.sin(a)+2*r*Math.cos(a);
    const speed=Math.hypot(dx,dy);
    samples.push([x,y,-dy/speed,dx/speed]);
    if(i)length.push(length.at(-1)+Math.hypot(x-samples[i-1][0],y-samples[i-1][1]));
    if(i%480===120){
      // The protected shape bits also select the upper cable at the three
      // large crossovers, before allocating any of the local crossing sites.
      const crossing=(i-120)/480;
      const reverse=variant===1||(variant===2&&crossing===0)||(variant===3&&crossing!==0);
      over.push(reverse?(i+count/2)%count:i);
    }
  }
  const total=length.at(-1);
  const point=(u,offset=0)=>{
    const d=Math.min(1,Math.max(0,u))*total;
    let lo=1,hi=count;
    while(lo<hi){const m=(lo+hi)>>1;if(length[m]<d)lo=m+1;else hi=m;}
    const a=samples[lo-1],b=samples[lo],f=(d-length[lo-1])/(length[lo]-length[lo-1]);
    return [a[0]+f*(b[0]-a[0])+offset*(a[2]+f*(b[2]-a[2])),a[1]+f*(b[1]-a[1])+offset*(a[3]+f*(b[3]-a[3]))];
  };
  return {point,total,over:over.map(i=>length[i]/total)};
}

export function knot(grid,variant,native=false) {
  const guide=trefoil(variant,native), lanes=Math.round(grid*.375), pitch=148/(lanes-1), thickness=pitch*.39;
  const beats=Math.ceil(grid*grid*(native?1.96:1.72)/(lanes-1));
  const order=Array.from({length:lanes},(_,i)=>i), ropes=order.map(()=>[]), events=[];
  const crosses=guide.over.map(u=>guide.point(u));
  const blocked=(p,u)=>crosses.some((q,i)=>Math.abs(u-guide.over[i])*guide.total>160 && Math.hypot(p[0]-q[0],p[1]-q[1])<155);
  for(let beat=0;beat<beats;beat++){
    const segments=order.map((id,lane)=>({id,lane,dir:0,beat}));
    for(let lane=beat%2;lane<lanes-1;lane+=2){
      if((beat*13+lane*7+variant)%23===0)continue;
      if(native&&guide.over.some(u=>Math.abs((beat+.5)/beats-u)*guide.total<93))continue;
      const arms=[segments[lane],segments[lane+1]];
      const point=(t,offset)=>guide.point((beat+t)/beats,(lane+.5-(lanes-1)/2+offset)*pitch);
      const event={point,arms,defaultValue:(beat+lane*3)%4};
      arms.forEach((s,k)=>{s.dir=k?-1:1;s.arm=k;s.event=event;});
      if([.25,.5,.75].every(t=>(native||!nearAnchor(point(t,0),pitch*.66))&&!blocked(point(t,0),(beat+t)/beats)))events.push(event);
      [order[lane],order[lane+1]]=[order[lane+1],order[lane]];
    }
    segments.forEach(s=>ropes[s.id].push(s));
  }
  const eligible=new Set(events), visited=new Set(), traversal=[], closed=[];
  for(let start=0;start<lanes;start++){
    if(visited.has(start))continue;
    const rope=[];
    for(let id=start;!visited.has(id);id=order.indexOf(id)){
      visited.add(id);
      for(const s of ropes[id]){
        rope.push(s);
        if(eligible.delete(s.event))traversal.push(s.event);
      }
    }
    closed.push(rope);
  }
  const symbols=takeEvenly(traversal,grid*grid/2);
  symbols.forEach((c,i)=>{c.index=i;});
  const timing=v=>v&2?.69:.31;
  const curve=(s,t,mid)=>{
    const f=Math.min(1,Math.max(0,(t-mid)/.68+.5)),ease=f*f*(3-2*f);
    return guide.point((s.beat+t)/beats,(s.lane+s.dir*ease-(lanes-1)/2)*pitch);
  };
  function draw(code,ink,paper) {
    const values=symbols.map((s,i)=>symbolValue(code,i*2,2));
    function strands(first,last) {
      const paths=[];
      for(const rope of closed){
        let line=[];
        const flush=()=>{if(line.length>1)paths.push(path(line));line=[];};
        for(const s of rope){
          if(s.beat<first||s.beat>=last){flush();continue;}
          const e=s.event, v=e?.index===undefined?(e?.defaultValue??0):values[e.index], mid=timing(v);
          const append=(a,b)=>{for(let j=line.length?1:0;j<=7;j++)line.push(curve(s,a+(b-a)*j/7,mid));};
          if(!e||s.arm===(v&1)){append(0,1);continue;}
          append(0,mid-.225);flush();append(mid+.225,1);
        }
        flush();
      }
      return stroke(paths.join(''),thickness,ink,'butt');
    }
    // Two continuous cable edges bound the three lobes and central window.
    const rails=(from,to)=>{
      const steps=Math.max(12,Math.ceil(650*(to-from)/beats));
      return [-78,78].map(offset=>stroke(path(Array.from({length:steps+1},(_,i)=>guide.point((from+(to-from)*i/steps)/beats,offset))),5,ink,'butt')).join('');
    };
    let output=(native?rails(0,beats):'')+strands(0,beats);
    for(const u of guide.over){
      const from=Math.floor((u-106/guide.total)*beats),to=Math.ceil((u+106/guide.total)*beats);
      const center=Array.from({length:41},(_,j)=>guide.point((from+(to-from)*j/40)/beats));
      output+=stroke(path(center),native?162:148+thickness*2,paper,'butt')+(native?rails(from,to):'')+strands(from,to);
    }
    return output;
  }
  return {render:draw,read(at,out){
    for(const e of symbols){
      const scores=[.31,.69].map(t=>(2*at(...e.point(t,0))+at(...e.point(t-.025,0))+at(...e.point(t+.025,0)))/4);
      const late=scores[1]>scores[0], mid=late?.69:.31;
      const strength=Math.abs(scores[1]-scores[0]);
      out.put(late,strength);
      const shoulders=e.arms.map(s=>[-.176,-.135,.135,.176].reduce((sum,t)=>sum+at(...curve(s,mid+t,mid)),0)/4);
      out.put(shoulders[1]>shoulders[0],Math.min(strength,Math.abs(shoulders[0]-shoulders[1])));
    }
  }};
}
