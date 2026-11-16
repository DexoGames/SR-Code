// Reed–Solomon over GF(256), primitive polynomial 0x11d, roots alpha^0 onward.
// Polynomials for codewords are highest-degree first; BM locators are ascending.
const EXP=new Uint8Array(512), LOG=new Uint8Array(256);
let a=1;
for(let i=0;i<255;i++){EXP[i]=a;LOG[a]=i;a<<=1;if(a&256)a^=0x11d;}
for(let i=255;i<512;i++)EXP[i]=EXP[i-255];
const mul=(a,b)=>a&&b?EXP[LOG[a]+LOG[b]]:0;
const div=(a,b)=>{if(!b)throw Error('GF division by zero');return a?EXP[(LOG[a]-LOG[b]+255)%255]:0;};
const pow=i=>EXP[(i%255+255)%255];
const evaluate=(p,x)=>p.reduce((v,c)=>mul(v,x)^c,0);
const generatorCache=new Map();
function generator(p){
  if(generatorCache.has(p))return generatorCache.get(p);
  let g=[1];
  for(let i=0;i<p;i++){
    const next=new Array(g.length+1).fill(0);
    for(let j=0;j<g.length;j++){next[j]^=g[j];next[j+1]^=mul(g[j],pow(i));}
    g=next;
  }
  generatorCache.set(p,g);return g;
}
export function rsEncode(data,parity){
  if(data.length+parity>255||parity<1)throw Error('Invalid RS block size');
  const work=new Uint8Array(data.length+parity);work.set(data);
  const g=generator(parity);
  for(let i=0;i<data.length;i++){
    const c=work[i];if(!c)continue;
    for(let j=1;j<g.length;j++)work[i+j]^=mul(g[j],c);
  }
  work.set(data);return work;
}
function locator(s){
  let c=[1],b=[1],L=0,m=1,last=1;
  for(let n=0;n<s.length;n++){
    let d=s[n];for(let i=1;i<=L;i++)d^=mul(c[i]||0,s[n-i]);
    if(!d){m++;continue;}
    const old=c.slice(),scale=div(d,last);
    while(c.length<b.length+m)c.push(0);
    for(let j=0;j<b.length;j++)c[j+m]^=mul(scale,b[j]);
    if(2*L<=n){L=n+1-L;b=old;last=d;m=1;}else m++;
  }
  return c.slice(0,L+1);
}
export function rsDecode(input,parity,erasures=[]){
  const code=Uint8Array.from(input),n=code.length;
  const erased=[...new Set(erasures)].sort((a,b)=>a-b);
  if(n>255||parity>=n||erased.length>parity||erased.some(i=>i<0||i>=n))throw Error('Too much damage in an error-correction block');
  const s=Array.from({length:parity},(_,j)=>evaluate(code,pow(j)));
  if(s.every(x=>!x))return{data:code.slice(0,n-parity),corrected:0,erasures:erased.length};
  let f=s.slice();
  for(const pos of erased){const x=pow(n-1-pos);for(let j=0;j<f.length-1;j++)f[j]=mul(f[j],x)^f[j+1];f.pop();}
  const loc=locator(f),unknown=[];
  for(let i=0;i<n;i++){
    const x=pow(-(n-1-i));let y=0;
    for(let j=loc.length-1;j>=0;j--)y=mul(y,x)^loc[j];
    if(!y&&!erased.includes(i))unknown.push(i);
  }
  if(unknown.length!==loc.length-1||unknown.length*2+erased.length>parity)throw Error('Damage exceeds error-correction capacity');
  const positions=erased.concat(unknown),t=positions.length;
  if(!t)throw Error('Uncorrectable codeword');
  // Solve error magnitudes from S_j = sum(e_i * X_i^j).
  const matrix=Array.from({length:t},(_,row)=>positions.map(pos=>pow((n-1-pos)*row)).concat(s[row]));
  for(let col=0;col<t;col++){
    let pivot=col;while(pivot<t&&!matrix[pivot][col])pivot++;
    if(pivot===t)throw Error('Singular error pattern');
    [matrix[pivot],matrix[col]]=[matrix[col],matrix[pivot]];
    const q=matrix[col][col];for(let j=col;j<=t;j++)matrix[col][j]=div(matrix[col][j],q);
    for(let row=0;row<t;row++)if(row!==col&&matrix[row][col]){
      const q=matrix[row][col];for(let j=col;j<=t;j++)matrix[row][j]^=mul(q,matrix[col][j]);
    }
  }
  let corrected=0;
  for(let i=0;i<t;i++){if(matrix[i][t])corrected++;code[positions[i]]^=matrix[i][t];}
  if(Array.from({length:parity},(_,j)=>evaluate(code,pow(j))).some(Boolean))throw Error('Error-correction verification failed');
  return{data:code.slice(0,n-parity),corrected,erasures:erased.length};
}
const CRC_TABLE=Uint32Array.from({length:256},(_,i)=>{let c=i;for(let j=0;j<8;j++)c=c&1?0xedb88320^(c>>>1):c>>>1;return c>>>0;});
export function crc32(bytes){let c=0xffffffff;for(const b of bytes)c=CRC_TABLE[(c^b)&255]^(c>>>8);return(c^0xffffffff)>>>0;}
