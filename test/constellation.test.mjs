import test from 'node:test';
import assert from 'node:assert/strict';
import {sky,MIN_ANGLE} from '../src/native/sky.js';

test('All possible constellation junctions meet the 30 degree minimum',()=>{
  assert.equal(MIN_ANGLE,30);
  let lowest=180;
  for(const n of [24,28,32,36])for(let variant=0;variant<4;variant++){
    const {nodes,edges}=sky(n,variant),adj=nodes.map(()=>[]);
    for(const {i,j} of edges){adj[i].push(j);adj[j].push(i);}
    for(const [k,neighbors] of adj.entries()){
      for(let i=0;i<neighbors.length;i++)for(let j=0;j<i;j++){
        for(const p of nodes[k].positions)for(const q of nodes[neighbors[i]].positions)for(const r of nodes[neighbors[j]].positions){
          const a=[q[0]-p[0],q[1]-p[1]],b=[r[0]-p[0],r[1]-p[1]];
          const cos=(a[0]*b[0]+a[1]*b[1])/(Math.hypot(...a)*Math.hypot(...b));
          lowest=Math.min(lowest,Math.acos(Math.max(-1,Math.min(1,cos)))*180/Math.PI);
        }
      }
    }
  }
  assert.ok(lowest>=30-1e-8,`Smallest possible junction is ${lowest} degrees`);
  assert.ok(lowest<40,'The layout should allow sharper constellations above the floor');
});

test('The reader accepts the earlier v6 triangular guides and payload order',async()=>{
  const {encode,shapeVariant}=await import('../src/format.js');
  const {raster}=await import('../scripts/runtime.mjs');
  const {decodeImage}=await import('../src/vision.js');
  const code=encode('Triangle print',{type:5,size:0,level:2});
  const legacy=sky(code.grid,shapeVariant(code),true);
  const artwork=`<svg xmlns="http://www.w3.org/2000/svg" width="1000" height="1000"><rect width="1000" height="1000" fill="white"/>${legacy.render(code,'black','white')}</svg>`;
  assert.equal(decodeImage(await raster(artwork,480),{camera:true}).text,'Triangle print');
});
