import {corallite} from './shapes.js';
import {coral as cups} from '../patterns/reef-sky.js';
export function reefMarks(){
  return [[[240,223],40,.4],[[738,167],47,1.3],[[848,685],42,.1],[[237,799],46,-.8]].map(([p,r,a])=>({...corallite(p,r,a),clearance:r*.81}));
}
export function reef(n,v) {
  const marks=reefMarks(),layout=cups(n,v,marks);
  return {marks,read:layout.read,render:(code,ink,paper)=>layout.render(code,ink,paper)+marks.map(m=>m.draw(ink,paper)).join('')};
}
