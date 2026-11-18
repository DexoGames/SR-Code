import {triangleMarks} from './sky.js';
import {homography,project} from '../vision.js';
import {nativeMarks} from './index.js';
import {polygonMetrics} from './shapes.js';

const corners=[[0,0],[1000,0],[1000,1000],[0,1000]];
const dist=(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1]);
const cross=(a,b,c)=>(b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]);

export const models=[];
for(let type=0;type<6;type++)for(let size=0;size<(type<2?4:1);size++)
  models.push({type,size,marks:nativeMarks(type,size)});

models.push({type:5,size:0,marks:triangleMarks(),classic:true});

function hull(points){
  const hull=[];
  const push=p=>{while(hull.length>=2&&cross(hull.at(-2),hull.at(-1),p)<=0)hull.pop();hull.push(p);};
  points.sort((a,b)=>a[0]-b[0]||a[1]-b[1]);
  for(const p of points)push(p);
  const top=hull.slice(0,-1);hull.length=0;
  for(let i=points.length-1;i>=0;i--)push(points[i]);
  return top.concat(hull.slice(0,-1));
}
function quad(points){
  const h=hull(points);
  while(h.length>4){
    let best=Infinity,index=0;
    for(let i=0;i<h.length;i++){
      const area=Math.abs(cross(h[(i+h.length-1)%h.length],h[i],h[(i+1)%h.length]));
      if(area<best){best=area;index=i;}
    }
    h.splice(index,1);
  }
  return h;
}

// Find both ink islands and enclosed paper windows. Work at a reduced scale
// for discovery; all final optical samples use the original image.
export function regions(gray,width,height){
  const scale=Math.max(1,Math.max(width,height)/850),w=Math.ceil(width/scale),h=Math.ceil(height/scale);
  const pixels=new Uint8Array(w*h),hist=new Uint32Array(256);
  let total=0;
  for(let y=0;y<h;y++)for(let x=0;x<w;x++){
    const k=y*w+x,v=gray[Math.min(height-1,Math.floor((y+.5)*scale))*width+Math.min(width-1,Math.floor((x+.5)*scale))];
    pixels[k]=v;hist[v]++;total+=v;
  }
  let low=0,count=0,best=-1,threshold=128;
  for(let t=0;t<255;t++){
    count+=hist[t];low+=hist[t]*t;
    if(!count||count===pixels.length)continue;
    const d=low/count-(total-low)/(pixels.length-count),v=count*(pixels.length-count)*d*d;
    if(v>best){best=v;threshold=t;}
  }
  const seen=new Uint8Array(w*h),queue=new Int32Array(w*h),features=[],pages=[];
  for(let i=0;i<pixels.length;i++)pixels[i]=pixels[i]>threshold?1:0;
  for(let start=0;start<pixels.length;start++){
    if(seen[start])continue;
    const color=pixels[start];let tail=1,sx=0,sy=0,minx=w,miny=h,maxx=0,maxy=0;
    queue[0]=start;seen[start]=1;
    for(let head=0;head<tail;head++){
      const k=queue[head],x=k%w,y=Math.floor(k/w);
      sx+=x;sy+=y;minx=Math.min(minx,x);maxx=Math.max(maxx,x);miny=Math.min(miny,y);maxy=Math.max(maxy,y);
      if(x>0&&!seen[k-1]&&pixels[k-1]===color){seen[k-1]=1;queue[tail++]=k-1;}
      if(x<w-1&&!seen[k+1]&&pixels[k+1]===color){seen[k+1]=1;queue[tail++]=k+1;}
      if(y>0&&!seen[k-w]&&pixels[k-w]===color){seen[k-w]=1;queue[tail++]=k-w;}
      if(y<h-1&&!seen[k+w]&&pixels[k+w]===color){seen[k+w]=1;queue[tail++]=k+w;}
    }
    const area=tail*scale*scale;
    if(tail>pixels.length*.028){
      const limits=Array.from({length:maxy-miny+1},()=>[w,-1]);
      for(let j=0;j<tail;j++){const k=queue[j],x=k%w,l=limits[Math.floor(k/w)-miny];l[0]=Math.min(l[0],x);l[1]=Math.max(l[1],x);}
      const points=limits.flatMap(([a,b],row)=>[[(a+.5)*scale,(row+miny+.5)*scale],[(b+.5)*scale,(row+miny+.5)*scale]]);
      const q=quad(points);
      if(q.length===4&&polygonMetrics(q).area>width*height*.07)pages.push(q);
    }
    if(tail<7||tail>pixels.length*.13||minx===0||miny===0||maxx===w-1||maxy===h-1)continue;
    const ratio=(maxx-minx+1)/(maxy-miny+1);
    if(ratio<.08||ratio>12)continue;
    features.push({center:[(sx/tail+.5)*scale,(sy/tail+.5)*scale],area,positive:color===0});
  }
  const limits=[];
  for(let y=0;y<h;y++){
    let left=0,right=w-1;
    while(left<w&&pixels[y*w+left])left++;
    while(right>=left&&pixels[y*w+right])right--;
    if(left<=right)limits.push([(left+.5)*scale,(y+.5)*scale],[(right+.5)*scale,(y+.5)*scale]);
  }
  const inkHull=hull(limits);
  const sides=inkHull.map((p,i)=>({p,q:inkHull[(i+1)%inkHull.length],i})).sort((a,b)=>dist(b.p,b.q)-dist(a.p,a.q)).slice(0,4).sort((a,b)=>a.i-b.i);
  const inkQuad=sides.map((line,i)=>{
    const prev=sides[(i+3)%4],u=line.q.map((v,k)=>v-line.p[k]),v=prev.q.map((x,k)=>x-prev.p[k]);
    const t=((prev.p[0]-line.p[0])*v[1]-(prev.p[1]-line.p[1])*v[0])/(u[0]*v[1]-u[1]*v[0]);
    return [line.p[0]+u[0]*t,line.p[1]+u[1]*t];
  });
  return {features,pages,threshold,inkQuad:inkQuad.length===4&&inkQuad.flat().every(Number.isFinite)?inkQuad:null};
}

export function pagePoses(page,source=corners) {
  const poses=[];
  for(const sign of [1,-1])for(let k=0;k<4;k++){
    const p=source.map((v,i)=>[v,page[(4+k+i*sign)%4]]);
    try{poses.push(homography(p));}catch{}
  }
  return poses;
}
export function testPose(H,model,at){
  const scores=model.marks.map(m=>{
    let ink=0,paper=0;
    for(let i=0;i<m.dark.length;i+=2){
      ink+=at(...project(H,...m.dark[i]));paper+=at(...project(H,...m.bright[i]));
    }
    return (ink-paper)/(m.dark.length/2);
  });
  const good=scores.filter(x=>x>.055).length;
  const ranked=scores.map(s=>Number.isFinite(s)?s:-1).sort((a,b)=>b-a);
  let score=(ranked[0]+ranked[1]+ranked[2])/3;
  if(model.type===0&&good>=2){
    const n=[24,36,52,72][model.size]+1,pitch=920/n;
    let support=0,samples=0;
    for(let k=0;k<32;k++){
      const row=(k*13+Math.floor(k/4)*7)%n,col=(k*19+Math.floor(k/3)*5)%n;
      const x=40+(col+.5)*pitch,y=40+(row+.5)*pitch;
      const contrast=at(...project(H,x,y-pitch*.5))-at(...project(H,x,y));
      if(Number.isFinite(contrast)){support+=contrast;samples++;}
    }
    score=.4*score+.6*support/Math.max(samples,1);
  }
  return {H,model,good,score};
}

function jacobian(H,p) {
  const [x,y]=p,q=project(H,x,y),a=project(H,x+1,y),b=project(H,x,y+1);
  return Math.abs(cross(q,a,b));
}
function fit(model,ms,H) {
  const pairs=[];
  ms.forEach((f,i)=>{
    if(!f)return;
    const m=model.marks[i];
    // Elliptical and triangular windows have a biased image centroid under
    // foreshortening. Subtract the predicted shift before fitting the plane.
    const pc=polygonMetrics(m.contour).center,warped=polygonMetrics(m.contour.map(p=>project(H,...p))).center;
    const original=project(H,...pc);
    pairs.push([m.center,[f.center[0]-warped[0]+original[0],f.center[1]-warped[1]+original[1]]]);
  });
  if(pairs.length<4)return H;
  return homography(pairs);
}
export function refineFeatures(H,model,features){
  const matches=model.marks.map(m=>{
    const p=project(H,...m.center),area=m.area*jacobian(H,m.center);
    let best=null,score=Infinity;
    for(const f of features){
      if(f.positive!==m.positive)continue;
      const delta=dist(f.center,p),ratio=Math.abs(Math.log(f.area/area));
      if(delta>Math.max(3,Math.sqrt(area)*.76)||ratio>.72)continue;
      const cost=delta/Math.sqrt(area)+ratio*.26;
      if(cost<score){score=cost;best=f;}
    }
    return best;
  });
  try{return fit(model,matches,H);}catch{return H;}
}

// Recover a frame when paper and background have the same colour. A pair of
// matching native features proposes orientation and scale; two others finish
// the projective fit. Optical contour checks reject accidental matches.
export function featurePoses(model,features,width,height,at) {
  const {marks}=model;
  const lists=marks.map(m=>{
    const expected=m.area*(Math.min(width,height)/1000)**2;
    return features.filter(f=>f.positive===m.positive&&f.area>expected*.043&&f.area<expected*3.2)
      .sort((a,b)=>Math.abs(Math.log(a.area/expected))-Math.abs(Math.log(b.area/expected))).slice(0,64);
  });
  const results=[];
  for(const [first,second] of [[0,2],[1,3]]){
    const p=marks[first].center,q=marks[second].center,dx=q[0]-p[0],dy=q[1]-p[1],d2=dx*dx+dy*dy;
    for(const a of lists[first])for(const b of lists[second]){
      if(a===b)continue;
      const ux=b.center[0]-a.center[0],uy=b.center[1]-a.center[1],scale=(ux*ux+uy*uy)/d2;
      if(Math.abs(Math.log(scale*marks[first].area/a.area))>.66||Math.abs(Math.log(scale*marks[second].area/b.area))>.66)continue;
      for(const sign of [1,-1]){
        const c=(ux*dx+uy*sign*dy)/d2,s=(uy*dx-ux*sign*dy)/d2;
        const ms=marks.map((m,i)=>{
          if(i===first)return a;if(i===second)return b;
          const x=m.center[0]-p[0],y=(m.center[1]-p[1])*sign;
          const predicted=[a.center[0]+c*x-s*y,a.center[1]+s*x+c*y],area=m.area*scale;
          let best=null,cost=Infinity;
          for(const f of lists[i]){
            if(f===a||f===b)continue;
            const ratio=Math.abs(Math.log(f.area/area)),delta=dist(predicted,f.center)/Math.sqrt(scale);
            if(ratio>.76||delta>100)continue;
            const score=delta+ratio*30;if(score<cost){best=f;cost=score;}
          }
          return best;
        });
        const affine=[c,-s*sign,a.center[0]-c*p[0]+s*sign*p[1],s,c*sign,a.center[1]-s*p[0]-c*sign*p[1],0,0,1];
        if(ms.some((f,i)=>i!==first&&i!==second&&f&&dist(f.center,project(affine,...marks[i].center))<3)){
          const trial=testPose(affine,model,at);
          if(trial.good>=2&&trial.score>.35)results.push(trial);
        }
        if(ms.some(m=>!m)||new Set(ms).size<4)continue;
        try{
          const H=homography(marks.map((m,i)=>[m.center,ms[i].center]));
          if(marks.some((m,i)=>Math.abs(Math.log(jacobian(H,m.center)*m.area/ms[i].area))>.55))continue;
          const trial=testPose(fit(model,ms,H),model,at);
          if(trial.good>=3&&trial.score>.27)results.push(trial);
        }catch{}
      }
    }
  }
  const unique=[];
  for(const trial of results.sort((a,b)=>b.score-a.score)){
    if(unique.some(t=>corners.every(p=>dist(project(t.H,...p),project(trial.H,...p))<3)))continue;
    unique.push(trial);
    if(unique.length===12)break;
  }
  return unique;
}

// The hull of a thresholded page can round off its corners in a shadow.
// Locate the long edges at full resolution, fit lines after rejecting outliers,
// then intersect them. Natural pattern features still verify the resulting pose.
export function refinePage(page,lum,w,h){
  const lines=page.map((a,i)=>{
    const b=page[(i+1)%4],dx=b[0]-a[0],dy=b[1]-a[1],len=Math.hypot(dx,dy);
    const nx=-dy/len,ny=dx/len,range=Math.min(20,Math.max(5,len*.017));
    let points=[];
    for(let k=1;k<=30;k++){
      const t=k/31,x=a[0]+dx*t,y=a[1]+dy*t;
      if(x<range||y<range||x>=w-range||y>=h-range)continue;
      const contrast=d=>Math.abs(lum(x+nx*(d+1.2),y+ny*(d+1.2))-lum(x+nx*(d-1.2),y+ny*(d-1.2)));
      let best=0,offset=0;
      for(let d=-range;d<=range;d+=.5){const score=contrast(d);if(score>best){best=score;offset=d;}}
      if(best<.035)continue;
      const left=contrast(offset-.5),right=contrast(offset+.5),den=2*best-left-right;
      if(den>.0001)offset+=.25*(right-left)/den;
      points.push([t,offset]);
    }
    let d0=0,d1=0;
    for(let pass=0;pass<3&&points.length>=8;pass++){
      const count=points.length,t=points.reduce((s,p)=>s+p[0],0)/count,d=points.reduce((s,p)=>s+p[1],0)/count;
      const slope=points.reduce((s,p)=>s+(p[0]-t)*(p[1]-d),0)/points.reduce((s,p)=>s+(p[0]-t)**2,0);
      d0=d-slope*t;d1=d0+slope;
      points=points.filter(([x,y])=>Math.abs(y-d0-slope*x)<(pass===0?3:1.25));
    }
    return [[a[0]+nx*d0,a[1]+ny*d0],[b[0]+nx*d1,b[1]+ny*d1]];
  });
  return lines.map(([p,q],i)=>{
    const [a,b]=lines[(i+3)%4],u=[q[0]-p[0],q[1]-p[1]],v=[b[0]-a[0],b[1]-a[1]];
    const t=((a[0]-p[0])*v[1]-(a[1]-p[1])*v[0])/(u[0]*v[1]-u[1]*v[0]);
    return [p[0]+t*u[0],p[1]+t*u[1]];
  });
}

export function refineContours(H,model,at) {
  // Register each paper/ink edge along its normal. Translation is fitted from
  // opposing edges, so uniform print gain usually cancels rather than shifting
  // a landmark towards the darkest side.
  for(let pass=0;pass<2;pass++){
    const pairs=[];
    for(const m of model.marks){
      const center=project(H,...m.center),contour=m.contour,n=contour.length,lines=[];
      for(let j=0;j<40;j++){
        const t=(j+.41)*n/40,k=Math.floor(t),p=project(H,...contour[k]),q=project(H,...contour[(k+1)%n]);
        const x=p[0]+(q[0]-p[0])*(t-k),y=p[1]+(q[1]-p[1])*(t-k),len=dist(p,q);
        if(len<.001)continue;
        let nx=(q[1]-p[1])/len,ny=(p[0]-q[0])/len;
        if(nx*(x-center[0])+ny*(y-center[1])<0){nx=-nx;ny=-ny;}
        const contrast=d=>(m.positive?-1:1)*(at(x+(d+.85)*nx,y+(d+.85)*ny)-at(x+(d-.85)*nx,y+(d-.85)*ny));
        const range=pass?2:4.5;
        let strength=.06,offset=0;
        for(let d=-range;d<=range;d+=.5){
          const c=contrast(d);
          if(c>strength){strength=c;offset=d;}
        }
        if(strength>.07)lines.push([nx,ny,offset,strength]);
      }
      let dx=0,dy=0;
      for(let iter=0;iter<2;iter++){
        let xx=0,xy=0,yy=0,vx=0,vy=0;
        for(const [a,b,d,w] of lines){
          if(iter&&Math.abs(d-a*dx-b*dy)>1.5)continue;
          xx+=w*a*a;xy+=w*a*b;yy+=w*b*b;vx+=w*a*d;vy+=w*b*d;
        }
        const det=xx*yy-xy*xy;if(det>.01){dx=(vx*yy-vy*xy)/det;dy=(vy*xx-vx*xy)/det;}
      }
      pairs.push([m.center,[center[0]+dx,center[1]+dy]]);
    }
    try{H=homography(pairs);}catch{break;}
  }
  return H;
}
