// A space-filling sea-fan tree. Bits choose the direction of a visible branch tip,
// rather than subpixel ripples on long stems.
export function coralLayout(size,grid,width,variant){
 const n=grid*grid,R=(width-120)*.43,spacing=Math.sqrt(Math.PI*R*R/n),cx=width/2,cy=width*.48;
 const nodes=Array.from({length:n},(_,i)=>{const a=i*2.399963229728653+variant*.43,r=R*Math.sqrt((i+.5)/n);return[cx+r*Math.cos(a)*(1+.04*Math.sin(a*3+variant)),cy+r*Math.sin(a)*.92];}).sort((a,b)=>b[1]-a[1]);
 const edges=[],parent=[];
 for(let i=1;i<n;i++){let best=Infinity,k=0;for(let j=0;j<i;j++){const d=(nodes[i][0]-nodes[j][0])**2+(nodes[i][1]-nodes[j][1])**2;if(d<best){best=d;k=j;}}parent[i]=k;edges.push([nodes[k],nodes[i]]);}
 const cell=spacing*2,bins=new Map();for(const e of edges){const loX=Math.floor(Math.min(e[0][0],e[1][0])/cell)-1,hiX=Math.floor(Math.max(e[0][0],e[1][0])/cell)+1,loY=Math.floor(Math.min(e[0][1],e[1][1])/cell)-1,hiY=Math.floor(Math.max(e[0][1],e[1][1])/cell)+1;for(let x=loX;x<=hiX;x++)for(let y=loY;y<=hiY;y++){const key=x+','+y;if(!bins.has(key))bins.set(key,[]);bins.get(key).push(e);}}
 const distance=(p,e)=>{const dx=e[1][0]-e[0][0],dy=e[1][1]-e[0][1],t=Math.max(0,Math.min(1,((p[0]-e[0][0])*dx+(p[1]-e[0][1])*dy)/(dx*dx+dy*dy||1)));return Math.hypot(p[0]-e[0][0]-t*dx,p[1]-e[0][1]-t*dy);};
 const amp=spacing*.31,stroke=spacing*.20,bits=[];
 for(let i=0;i<n;i++){const p=nodes[i],previous=nodes[parent[i]??1],angle=Math.atan2(p[1]-previous[1],p[0]-previous[0])+Math.PI/2,near=bins.get(Math.floor(p[0]/cell)+','+Math.floor(p[1]/cell))||[];let chosen=null,best=-1;
  for(const da of[0,.35,-.35,.7,-.7,1.05,-1.05]){const normal=[Math.cos(angle+da),Math.sin(angle+da)],pair=[1,-1].map(s=>[p[0]+s*normal[0]*amp,p[1]+s*normal[1]*amp]);let clear=Infinity;for(const q of pair)for(const e of near)clear=Math.min(clear,distance(q,e));if(clear>best){best=clear;chosen={normal,pair};}}
  const {normal,pair}=chosen;bits.push({center:p,amp,stroke,pair,points:sign=>[p,[p[0]+normal[0]*amp*.6*sign,p[1]+normal[1]*amp*.6*sign],[p[0]+normal[0]*amp*sign,p[1]+normal[1]*amp*sign]]});
 }
 const decor=[...edges,[[cx,width*.94],nodes[0]]],bounds=[cx-R-spacing,cy-R-spacing,cx+R+spacing,width*.94];
 return{bits,decor,decorStroke:spacing*.085,stars:[],bounds};
}
