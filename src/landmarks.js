// The same reliable circular eye is dressed as a motif from each visual language.
// Four different pupil ratios identify the corners without an encoded square grid.
export const CONTENT_INSET=.14, CONTENT_SCALE=.72;
export const CORNERS=[[.075,.075],[.925,.075],[.925,.925],[.075,.925]];
export const PUPILS=[.12,.28,.44,.60];
export function landmarkSVG(type,width,ink,paper){
 const R=width*.038,parts=[];
 const circle=(x,y,r,fill,stroke='',sw=0)=>`<circle cx="${x}" cy="${y}" r="${r}" fill="${fill}"${stroke?` stroke="${stroke}" stroke-width="${sw}"`:''}/>`;
 for(let id=0;id<4;id++){
  const[cx,cy]=CORNERS[id].map(v=>v*width);parts.push(`<g transform="translate(${cx} ${cy})">`,circle(0,0,R*1.6,paper));
  if(type===5){for(let i=0;i<6;i++){const a=i*Math.PI/3,x=R*1.4*Math.cos(a),y=R*1.4*Math.sin(a);parts.push(`<path d="M0 0L${x} ${y}" stroke="${ink}" stroke-width="${R*.08}"/>`,circle(x,y,R*.10,ink));}}
  else if(type===4){for(const r of[1.23,1.43])parts.push(`<ellipse rx="${R*r}" ry="${R*r*.96}" fill="none" stroke="${ink}" stroke-width="${R*.075}"/>`);}
  else if(type===1){parts.push(`<path d="M${-R*1.35} 0C${-R*1.6} ${-R*1.5} ${R*.8} ${-R*1.6} ${R*1.4} ${-R*.3}C${R*1.8} ${R} ${-R*.9} ${R*1.8} ${-R*1.35} 0Z" fill="none" stroke="${ink}" stroke-width="${R*.14}"/>`);}
  else{const petals=type===2?7:type===3?4:6;for(let j=0;j<petals;j++){const a=j*360/petals;parts.push(`<ellipse cx="0" cy="${-R*1.2}" rx="${R*(type===2?.17:.30)}" ry="${R*.30}" fill="none" stroke="${ink}" stroke-width="${R*.10}" transform="rotate(${a})"/>`);}}
  parts.push(circle(0,0,R,ink),circle(0,0,R*.74,paper),circle(0,0,R*PUPILS[id],ink),'</g>');
 }
 return parts.join('');
}
