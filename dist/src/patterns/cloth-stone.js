import {FIELD, nearAnchor, num, xy, stroke, symbolValue, takeEvenly} from './common.js';

export function clothOrStone(type, grid) {
  const pebble = type === 1;
  // Leave the ends of the textile open at its selvedge. Stagger the riverbed
  // and vary its outline without varying the optical alphabet.
  const symbolCount = pebble ? grid * grid : grid * grid / 2;
  const side = Math.ceil(Math.sqrt(symbolCount));
  const count = side + Math.ceil(side * .04) + 1;
  const pitch = FIELD / (count + (pebble ? .5 : 0));
  const sites = [];
  for (let row = 0; row < count; row++) for (let col = 0; col < count; col++) {
    const x = 40 + pitch * (col + .5 + (pebble ? .25 + .23 * (row % 2 ? 1 : -1) + .06 * Math.sin(7 * row + col) : 0));
    const y = 40 + pitch * (row + .5 + (pebble ? .07 * Math.cos(row + 5 * col) : 0));
    const corner = Math.hypot(Math.max(0, Math.abs(x - 500) - 370), Math.max(0, Math.abs(y - 500) - 370));
    if (corner < 91) sites.push({x, y, row, col, angle:pebble ? .46*Math.sin(row*2.1+col*.79)+.12*Math.cos(col*4.3) : 0});
  }
  const symbols = takeEvenly(sites.filter(s => !nearAnchor([s.x, s.y], pitch * .49)), symbolCount);
  symbols.forEach((s, i) => { s.index = i; });

  function render(code, ink) {
    if (!pebble) {
      const curves = [];
      for (const s of sites) {
        const v = s.index === undefined ? ((s.row + s.col) % 2)*2 : symbolValue(code,s.index*2,2);
        const {x,y}=s, h=pitch/2, flip=v&2?1:-1;
        for(const sign of [-1,1]){
          const q=a=>[x+sign*flip*h*(Math.cos(a)-1),y+sign*h*(Math.sin(a)-1)];
          const split=sign===1 && (v&1);
          const ranges=split?[[0,Math.PI/4-.37],[Math.PI/4+.37,Math.PI/2]]:[[0,Math.PI/2]];
          for(const [a,b] of ranges)curves.push(`M${xy(q(a))}A${num(h)} ${num(h)} 0 0 ${flip>0?1:0} ${xy(q(b))}`);
        }
      }
      return stroke(curves.join(''), pitch * .15, ink);
    }
    const stones = [];
    for (const s of sites) {
      const v = s.index === undefined ? 0 : code.values[s.index];
      const shapes=[];
      const cols = v & 2 ? 2 : 1, rows = v & 1 ? 2 : 1;
      for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
        const x = s.x + (c + .5 - cols / 2) * pitch * .51, y = s.y + (r + .5 - rows / 2) * pitch * .51;
        const rx = pitch * (cols === 2 ? .18 : .458), ry = pitch * (rows === 2 ? .18 : .448);
        // A softly asymmetric stone silhouette; seams alone carry the bits.
        shapes.push(`M${xy([x-rx,y])}C${xy([x-rx*1.02,y-ry*.58])} ${xy([x-rx*.53,y-ry*1.04])} ${xy([x,y-ry])}S${xy([x+rx,y-ry*.54])} ${xy([x+rx,y])}S${xy([x+rx*.54,y+ry])} ${xy([x,y+ry])}S${xy([x-rx,y+ry*.54])} ${xy([x-rx,y])}Z`);
      }
      stones.push(`<path d="${shapes.join('')}" transform="rotate(${num(s.angle*180/Math.PI)} ${xy([s.x,s.y])})"/>`);
    }
    return `<g fill="${ink}">${stones.join('')}</g>`;
  }

  function read(at, out) {
    for (const {x,y,angle} of symbols) {
      const c=Math.cos(angle),s=Math.sin(angle);
      const get = (dx,dy) => at(x + (dx*c-dy*s)*pitch, y + (dx*s+dy*c)*pitch);
      if (pebble) {
        const ink = (get(-.24,-.24)+get(.24,.24)+get(-.24,.24)+get(.24,-.24))/4;
        for (const seam of [(get(0,-.24)+get(0,.24))/2, (get(-.24,0)+get(.24,0))/2]) {
          const split = ink * .52 - seam;
          out.put(split > 0, Math.min(ink, Math.abs(split)*2));
        }
      } else {
        // One arc always survives the underpass, so it can identify the
        // routing before we inspect the gap in its paired yarn.
        const sum=(flip,sign,angles)=>angles.reduce((total,a)=>total+get(sign*flip*.5*(Math.cos(a)-1),sign*.5*(Math.sin(a)-1)),0)/angles.length;
        const angles=[.56,.70,Math.PI/4,.87,1.01];
        const left=sum(-1,-1,angles),right=sum(1,-1,angles),flip=right>left?1:-1;
        const full=Math.max(left,right),optional=sum(flip,1,[.70,Math.PI/4,.87]);
        out.put(flip===1,Math.abs(right-left));
        out.put(optional<full*.54,Math.min(Math.abs(right-left),Math.abs(full*.54-optional)*2));
      }
    }
  }
  return {render,read};
}
