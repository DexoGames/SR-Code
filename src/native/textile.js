import {path,stroke,xy,num,dot,takeEvenly,symbolValue} from '../patterns/common.js';
import {feature,ellipse,filled,stone} from './shapes.js';

function weaveSites(n){
  const count=n+1,pitch=920/count;
  // These are ordinary closed turns in the same yarn, with uninterrupted
  // neighbours on all four sides. Nothing is stamped over the fabric.
  const centers=[[.17,.17],[.78,.12],[.88,.78],[.18,.86]].map(([x,y])=>[Math.round(count*x),Math.round(count*y)]);
  const marks=centers.map(([x,y])=>feature(ellipse([40+x*pitch,40+y*pitch],pitch*.413,pitch*.413),false,{band:pitch*.174}));
  return {count,pitch,centers,marks};
}
export const weaveMarks=n=>weaveSites(n).marks;
export function weave(n){
  const {count,pitch,centers,marks}=weaveSites(n),sites=[],free=[];
  for(let row=0;row<count;row++)for(let col=0;col<count;col++){
    const site={x:40+(col+.5)*pitch,y:40+(row+.5)*pitch,defaultValue:(col+row)%2};
    let reserved=false;
    for(const [cx,cy] of centers){
      if((cx===col||cx===col+1)&&(cy===row||cy===row+1)){
        site.defaultValue=Number((cx===col)===(cy===row));reserved=true;
      }
    }
    sites.push(site);if(!reserved)free.push(site);
  }
  const symbols=takeEvenly(free,n*n);symbols.forEach((s,i)=>{s.index=i;});
  const h=pitch/2,radius=num(h),up=xy([h,-h]),down=xy([h,h]);
  const arc=(x,y,sweep,end)=>`M${xy([x,y])}a${radius} ${radius} 0 0 ${sweep} ${end}`;
  return {marks,render(code,ink){
    const curves=[];
    for(const site of sites){
      const {x,y,index,defaultValue}=site;
      const value=index===undefined?defaultValue:code.values[index];
      const paths=site.paths??=[];
      paths[value]??=value?arc(x-h,y,0,up)+arc(x,y+h,1,up):arc(x,y-h,0,down)+arc(x-h,y,1,down);
      curves.push(paths[value]);
    }
    return stroke(curves.join(''),pitch*.174,ink);
  },read(at,out){
    for(const {x,y} of symbols){
      let sum=0;
      for(const a of [.58,Math.PI/4,.99]){
        const dx=(Math.cos(a)-1)*pitch/2,dy=(Math.sin(a)-1)*pitch/2;
        sum+=at(x+dx,y+dy)+at(x-dx,y-dy)-at(x-dx,y+dy)-at(x+dx,y-dy);
      }
      out.put(sum>0,Math.abs(sum)/6);
    }
  }};
}

export function pebbleMarks(n){
  const pitch=920/(Math.ceil(n*1.12)+2);
  return [[[167,218],pitch*.98,.3],[[719,126],pitch*.91,-.7],[[851,667],pitch*.95,.6],[[319,851],pitch*.90,1.2]].map(([p,r,a],i)=>{
    const outline=stone(p,r,a,i*.8);
    const highlight=[p[0]+r*.48*Math.cos(a+i),p[1]+r*.48*Math.sin(a+i)];
    const m=feature(outline,true,{band:8,draw:(ink,paper)=>filled(outline,ink)+dot(highlight,r*.26,paper)});
    const hole=Math.PI*(r*.26)**2;
    m.center=m.center.map((v,k)=>(v*m.area-highlight[k]*hole)/(m.area-hole));m.area-=hole;
    return {...m,clearance:r};
  });
}
export function pebbles(n) {
  const marks=pebbleMarks(n), count=Math.ceil(n*1.12)+2,pitch=920/count;
  const units=[],used=new Set(),key=(r,c)=>r*count+c;
  const center=(r,c)=>[42+(c+.5+.15*(r%2)+.055*Math.sin(r*7+c))*pitch,42+(r+.5+.065*Math.cos(c*4-r))*pitch];
  const clear=(p,r)=>marks.every(m=>Math.hypot(p[0]-m.center[0],p[1]-m.center[1])>m.clearance+r);
  const make=(p,r,seed)=>({p,r,seed});
  // A merger consumes four ordinary packing sites. Only these sites change
  // size. The rest of the riverbed retains its full baseline stone diameter.
  for(let row=0;row<count-1;row++)for(let col=0;col<count-1;col++){
    if((col*13+row*17+Math.floor(row/4)*3)%13!==((col+2*row)%7)||((col+row)%3===0))continue;
    const cells=[[row,col],[row,col+1],[row+1,col],[row+1,col+1]];
    if(cells.some(([r,c])=>used.has(key(r,c))))continue;
    const centers=cells.map(([r,c])=>center(r,c)),p=[0,1].map(k=>centers.reduce((s,q)=>s+q[k],0)/4);
    if(!clear(p,pitch*1.02))continue;
    cells.forEach(([r,c])=>used.add(key(r,c)));
    units.push({large:make(p,pitch*.90,row+col),stones:centers.map((q,i)=>make(q,pitch*.415,row+col+i)),width:3});
  }
  for(let row=0;row<count;row++)for(let col=0;col<count;col++){
    const p=center(row,col);if(used.has(key(row,col))||!clear(p,pitch*.48))continue;
    units.push({stones:[make(p,pitch*(.408+.026*Math.sin(col-row)),row*3+col)],width:2});
  }
  // Keep neighbouring damage in neighbouring codewords.
  const packingRow=u=>Math.round((u.stones[0].p[1]-42)/pitch-.5);
  units.sort((a,b)=>packingRow(a)-packingRow(b)||a.stones[0].p[0]-b.stones[0].p[0]);
  const required=2*n*n;
  let bit=0;
  for(const u of units){u.start=bit;bit+=u.width;}
  if(bit<required)throw Error('Insufficient pebble packing');
  const dirs=[[0,-1],[1,0],[0,1],[-1,0]],q=(s,k)=>[s.p[0]+dirs[k][0]*s.r*.53,s.p[1]+dirs[k][1]*s.r*.53];
  function pore(s,direction) {
    const [x,y]=q(s,direction), radius=num(s.r*.295), diameter=num(s.r*.59);
    return `M${xy([x-s.r*.295,y])}a${radius} ${radius} 0 1 0 ${diameter} 0a${radius} ${radius} 0 1 0 ${-diameter} 0Z`;
  }
  return {marks,render(code,ink,paper){
    const bodies=[],pores=[];
    for(const u of units){
      const v=u.start<required?symbolValue(code,u.start,u.width):(Math.imul(u.start,2654435761)>>>27)&((1<<u.width)-1),stones=u.large&&(v&4)?[u.large]:u.stones;
      for(const s of stones){
        s.body??=path(stone(s.p,s.r,s.seed*.27,s.seed))+'Z';
        s.pores??=[];
        const direction=v&3;
        s.pores[direction]??=pore(s,direction);
        bodies.push(s.body);
        pores.push(s.pores[direction]);
      }
    }
    return `<path d="${bodies.join('')}" fill="${ink}"/><path d="${pores.join('')}" fill="${paper}"/>`+marks.map(m=>m.draw(ink,paper)).join('');
  },read(at,out){
    // Prevent a partial last optical symbol from adding padding to the packet.
    const put=(v,c)=>{if(out.bits.length<required)out.put(v,c);};
    for(const u of units){
      if(u.start>=required)break;
      let stones=u.stones;
      if(u.large){
        const [x,y]=u.large.p;
        const center=(at(x,y)+at(x-pitch*.075,y)+at(x+pitch*.075,y))/3;
        put(center>.47,Math.abs(center-.47)*2);
        if(center>.47)stones=[u.large];
      }
      const score=dirs.map((_,k)=>stones.reduce((sum,s)=>sum+at(...q(s,k)),0)/stones.length);
      const ranks=[0,1,2,3].sort((a,b)=>score[a]-score[b]),best=ranks[0];
      for(const mask of [2,1]){
        const other=ranks.find(i=>(i&mask)!==(best&mask));put(Boolean(best&mask),score[other]-score[best]);
      }
    }
  }};
}
