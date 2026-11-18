import {ANCHORS, TAU, nearAnchor, polar, path, xy, dot, stroke, takeEvenly, symbolValue, strongest} from './common.js';

function field(count, variant, reef, reserved) {
  // A phyllotactic field gives every chamber or star room on all sides.
  // Slightly overfill it so the four reference sites displace actual neighbours.
  const n = Math.ceil(count * 1.14) + 12;
  const spacing = 440 * Math.sqrt(Math.PI / n);
  const nodes = [];
  for (let i = 0; i < n; i++) {
    const a = i * 2.3999632297 + variant * .38, r = 440 * Math.sqrt((i + .5) / n);
    const warp = reef ? 1 + .065*Math.sin(3*a+variant) + .035*Math.cos(5*a-.8) : 1+.03*Math.sin(3*a+.7);
    const base = [500 + r*warp*Math.cos(a), 500 + .96*r*warp*Math.sin(a)];
    const clear=reserved?reserved.every(m=>Math.hypot(base[0]-m.center[0],base[1]-m.center[1])>m.clearance+spacing*.40):!nearAnchor(base,spacing*(reef?.42:.36));
    if(clear)nodes.push({base,angle:a});
  }
  return {nodes:takeEvenly(nodes,count),spacing};
}

// Clip the chamber against the perpendicular bisector to each near neighbour.
function chamber(center, neighbours, spacing) {
  let cell = Array.from({length:12}, (_,i) => polar(center,spacing*.69,TAU*i/12));
  for (const p of neighbours) {
    const dx=p[0]-center[0], dy=p[1]-center[1], d2=dx*dx+dy*dy;
    if (!d2 || d2 > (spacing*1.5)**2) continue;
    const side = q => (q[0]-center[0])*dx+(q[1]-center[1])*dy-d2/2;
    const clipped=[];
    for (let i=0;i<cell.length;i++) {
      const a=cell[i], b=cell[(i+1)%cell.length], u=side(a), v=side(b);
      if (u<=0) clipped.push(a);
      if ((u<0)!==(v<0)) clipped.push([a[0]+(b[0]-a[0])*u/(u-v),a[1]+(b[1]-a[1])*u/(u-v)]);
    }
    cell=clipped;
  }
  return cell;
}

export function coral(grid,variant,reserved) {
  const {nodes,spacing} = field(grid*grid/4,variant,true,reserved);
  const neighbours=nodes.map(n=>n.base).concat(reserved?reserved.map(m=>m.center):ANCHORS);
  const cups=nodes.map(({base,angle})=>{
    const polygon=chamber(base,neighbours,spacing);
    const midpoints=polygon.map((p,i)=>p.map((x,k)=>(x+polygon[(i+1)%polygon.length][k])/2));
    const rim='M'+xy(midpoints.at(-1))+polygon.map((p,i)=>'Q'+xy(p)+' '+xy(midpoints[i])).join('')+'Z';
    // Each septum starts on its own chamber wall. A long septum reaches
    // into the lumen, leaving enough white space between opposing tips.
    const rays=Array.from({length:8},(_,j)=>{
      const a=angle+j*TAU/8, dir=[Math.cos(a),Math.sin(a)];
      let reach=spacing*.69;
      for(let i=0;i<polygon.length;i++){
        const p=polygon[i], q=polygon[(i+1)%polygon.length], dx=q[0]-p[0],dy=q[1]-p[1];
        const den=dir[0]*dy-dir[1]*dx;
        if(Math.abs(den)<1e-6)continue;
        const t=((p[0]-base[0])*dy-(p[1]-base[1])*dx)/den;
        const u=((p[0]-base[0])*dir[1]-(p[1]-base[1])*dir[0])/den;
        if(t>0&&u>=0&&u<=1)reach=Math.min(reach,t);
      }
      // Rounded septa grow wide at the common wall and taper into the cup.
      // The curve passes through the same centreline used by the reader.
      const rib=long=>{
        const end=reach*(long?.26:.75);
        const tip=polar(base,end,a),bend=polar(base,(end+reach)*.50,a+.095);
        const left=polar(base,reach*.97,a-.15),right=polar(base,reach*.97,a+.15);
        const offset=(p,d)=>[p[0]-d*Math.sin(a),p[1]+d*Math.cos(a)];
        return 'M'+xy(left)+'Q'+xy(offset(bend,-spacing*.063))+' '+xy(offset(tip,-spacing*.045))+
          'Q'+xy(polar(base,end-spacing*.055,a))+' '+xy(offset(tip,spacing*.045))+
          'Q'+xy(offset(bend,spacing*.067))+' '+xy(right)+'Z';
      };
      return {root:polar(base,reach*.89,a+.018),short:rib(false),long:rib(true),probes:[.39,.47,.54].map(r=>polar(base,reach*r,a+.035))};
    });
    return {rim,rays};
  });
  return {render(code,ink) {
    const walls=[],septa=[];
    cups.forEach(({rim,rays},i)=>{
      walls.push(rim);
      rays.forEach((r,j)=>{
        const long=j%2===0 && symbolValue(code,i*4+j/2,1);
        septa.push(long?r.long:r.short);
      });
    });
    return stroke(walls.join(''),spacing*.105,ink)+`<path d="${septa.join('')}" fill="${ink}"/>`;
  },read(at,out) {
    for(const cup of cups)for(let j=0;j<8;j+=2){
      const ray=cup.rays[j], ink=ray.probes.reduce((s,p)=>s+at(...p),0)/3;
      const root=at(...ray.root);
      out.put(ink>root*.45,Math.min(root,Math.abs(ink-root*.45)*2));
    }
  }};
}

export function constellation(grid,variant) {
  const {nodes,spacing}=field(grid*grid/4,variant,false);
  const shift=spacing*.178, radius=spacing*.158;
  for(const n of nodes)n.positions=[0,1,2,3].map(v=>[n.base[0]+(v&2?shift:-shift),n.base[1]+(v&1?shift:-shift)]);
  const used=new Set();
  const links=nodes.map((n,i)=>{
    const sorted=nodes.map((m,j)=>({j,d:Math.hypot(m.base[0]-n.base[0],m.base[1]-n.base[1])})).sort((a,b)=>a.d-b.d);
    const picked=[];
    for(const {j} of sorted){
      const key=Math.min(i,j)*nodes.length+Math.max(i,j);
      if(j===i||used.has(key))continue;
      const p=nodes[j].base;
      if(nearAnchor([(p[0]+n.base[0])/2,(p[1]+n.base[1])/2],spacing*.12))continue;
      used.add(key);picked.push(j);
      if(picked.length===2)break;
    }
    return picked;
  });
  // The four guide stars belong to the same graph as the payload.
  const companions=ANCHORS.map(p=>nodes.map((n,i)=>({i,d:Math.hypot(n.base[0]-p[0],n.base[1]-p[1])})).sort((a,b)=>a.d-b.d).slice(0,2));
  return {render(code,ink) {
    const pos=nodes.map((n,i)=>n.positions[symbolValue(code,4*i,2)]), edges=[], stars=[];
    pos.forEach((p,i)=>{
      links[i].forEach((j,k)=>{if(symbolValue(code,i*4+2+k,1))edges.push(path([p,pos[j]]));});
      const r=radius*(i%9===0?1.28:1);
      stars.push(dot(p,r,ink));
      if(i%13===0) stars.push(stroke(path([[p[0]-r*1.52,p[1]],[p[0]+r*1.52,p[1]]])+path([[p[0],p[1]-r*1.52],[p[0],p[1]+r*1.52]]),r*.55,ink));
    });
    companions.forEach((ns,i)=>ns.forEach(n=>edges.push(path([ANCHORS[i],pos[n.i]]))));
    return stroke(edges.join(''),spacing*.108,ink)+stars.join('');
  },read(at,out) {
    const pos=[], strengths=[], starBits=[];
    for(const n of nodes){
      const scores=n.positions.map(([x,y])=>(2*at(x,y)+at(x-radius*.53,y)+at(x+radius*.53,y)+at(x,y-radius*.53)+at(x,y+radius*.53))/6);
      const bits=[],confidence=[];
      strongest(scores,{put(v,c){bits.push(v);confidence.push(c);}});
      pos.push(n.positions[bits[0]*2+bits[1]]);strengths.push(Math.min(...confidence));starBits.push({bits,confidence});
    }
    pos.forEach((a,i)=>{
      const {bits,confidence}=starBits[i];out.put(bits[0],confidence[0]);out.put(bits[1],confidence[1]);
      for(const j of links[i]){
        const b=pos[j], samples=[];
        for(const t of [.30,.36,.43,.5,.57,.64,.70])samples.push(at(a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t));
        samples.sort((a,b)=>a-b);
        const ink=samples[3];
        out.put(ink>.40,Math.min(Math.abs(ink-.40)*2,strengths[i],strengths[j]));
      }
    });
  }};
}
