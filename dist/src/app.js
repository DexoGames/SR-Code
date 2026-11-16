import { organicLayout, organicSVG } from './organic.js';
import { TYPES, SIZES, LEVELS, plan, encode, encodeSequence, assemble } from './format.js';
import { toSVG, motif, geometry } from './render.js';

const $ = id => document.getElementById(id);
const state = { type: 0, size: 0, level: 2, codes: [], part: 0, file: null, fileName: '', stream: null, base: null, testSize: null, decoded: null, parts: new Map() };
const worker = new Worker(new URL('./reader-worker.js', import.meta.url), { type: 'module' });
let job = 0, activeJob = 0, busy = false, queued = null, damageTimer, cameraTimer, capturing=false, burstCanvases=null, trackedRegion=null;

function options(select, values, selected) {
  values.forEach((value, i) => select.add(new Option(value, i)));
  select.value = selected;
}
options($('size'), SIZES.map(s => s.name), state.size);
options($('level'), LEVELS.map(l => l.name), state.level);
options($('compare-level'), LEVELS.map(l => l.name), state.level);

function icon(type) {
  if(type>=2){const c=encode("RS",{type,size:0,level:2}),w=geometry(0).width;return `<svg aria-hidden="true" viewBox="0 0 ${w} ${w}">${organicSVG(organicLayout(type,0,c.grid,w),c.values,"currentColor")}</svg>`;}
  const m = motif(type, type === 5 ? 5 : 1, 0, 0);
  const items = [ ...m.ellipses.map(e => `<ellipse cx="${e.x}" cy="${e.y}" rx="${e.rx}" ry="${e.ry}" fill="currentColor"/>`),
    ...m.p.map(p => `<path d="${p.d}" stroke="${p.white ? 'var(--paper)' : 'currentColor'}" stroke-width="${p.w}" fill="none" stroke-linecap="round"/>`),
    ...m.circles.map(c => `<circle cx="${c.x}" cy="${c.y}" r="${c.r}" fill="${c.white ? 'var(--paper)' : 'currentColor'}"/>`) ];
  return `<svg aria-hidden="true" viewBox="-.1 -.1 1.2 1.2">${items.join('')}</svg>`;
}
TYPES.forEach((type, i) => {
  const button = document.createElement('button');
  button.className = 'format-option';
  button.innerHTML = icon(i) + `<span>${type.name}</span>`;
  button.setAttribute('aria-pressed', String(i === state.type));
  button.onclick = () => { state.type = i; generate(); };
  $('format-options').append(button);
});

function setTab(name) {
  for (const button of document.querySelectorAll('[data-tab]')) {
    const active = button.dataset.tab === name;
    button.classList.toggle('active', active);
    button.setAttribute('aria-selected', String(active));
    button.tabIndex = active ? 0 : -1;
    $('panel-' + button.dataset.tab).hidden = !active;
  }
  if (name !== 'read') stopCamera();
}
document.querySelector('nav').setAttribute('role', 'tablist');
for (const button of document.querySelectorAll('[data-tab]')) {
  button.onclick = () => setTab(button.dataset.tab);
  button.onkeydown = e => {
    const tabs = [...document.querySelectorAll('[data-tab]')], i = tabs.indexOf(button);
    const next = e.key === 'ArrowRight' ? (i + 1) % 3 : e.key === 'ArrowLeft' ? (i + 2) % 3 : e.key === 'Home' ? 0 : e.key === 'End' ? 2 : -1;
    if (next >= 0) { e.preventDefault(); setTab(tabs[next].dataset.tab); tabs[next].focus(); }
  };
}

function dl(element, pairs) {
  element.replaceChildren();
  for (const [key, value] of pairs) {
    const dt = document.createElement('dt'), dd = document.createElement('dd');
    dt.textContent = key; dd.textContent = value; element.append(dt, dd);
  }
}
function generate() {
  state.size = Number($('size').value); state.level = Number($('level').value);
  const payload = state.file || $('message').value;
  const bytes = state.file?.length ?? new TextEncoder().encode(payload).length;
  const p = plan(state.type, state.size, state.level), g = geometry(state.size);
  $('byte-count').textContent = `${bytes} / ${p.capacity} bytes`;
  [...$('format-options').children].forEach((b, i) => b.setAttribute('aria-pressed', String(i === state.type)));
  $('format-description').textContent = TYPES[state.type].probe + ' ' + TYPES[state.type].risk;
  dl($('format-stats'), [['Payload per code', `${p.capacity} bytes`], ['Encoded bits', p.total * 8], ['Physical features', state.type===5?`${p.grid*p.grid/4} stars + ${p.grid*p.grid/2} possible links`:state.type===3?`${p.grid*p.grid/2} strand routings`:state.type===4?`${p.grid*p.grid/2} ridge endings`:`${p.grid*p.grid} symbols`], ['Parity bytes', `${p.parity} / ${p.total}`], ['Export size', `${g.width} × ${g.width} px`]]);
  try {
    const opts = { type: state.type, size: state.size, level: state.level, binary: !!state.file };
    state.codes = $('split').checked ? encodeSequence(payload, opts) : [encode(payload, opts)];
    state.part = 0; $('make-error').hidden = true; $('code-preview').classList.remove('invalid');
    for (const id of ['test-code', 'download-png', 'download-svg','show-code']) $(id).disabled = false;
    showCode();
  } catch (error) {
    state.codes = []; $('code-preview').textContent = 'Message exceeds this size.'; $('preview-name').textContent = `${TYPES[state.type].name.toUpperCase()} / ${SIZES[state.size].name}`; $('make-error').hidden = false; $('make-error').textContent = error.message + ' Choose a larger size or enable splitting.';
    $('code-preview').classList.add('invalid'); $('parts-control').hidden = true;
    for (const id of ['test-code', 'download-png', 'download-svg','show-code']) $(id).disabled = true;
  }
}
function showCode() {
  $('code-preview').innerHTML = toSVG(state.codes[state.part]);
  $('preview-name').textContent = `${TYPES[state.type].name.toUpperCase()} / ${SIZES[state.size].name}`;
  $('parts-control').hidden = state.codes.length < 2;
  $('part-counter').textContent = `${state.part + 1} / ${state.codes.length}`;
  $('part-prev').disabled = state.part === 0; $('part-next').disabled = state.part === state.codes.length - 1;
}
for (const id of ['message', 'size', 'level', 'split']) $(id).addEventListener('input', generate);
$('part-prev').onclick = () => { state.part--; showCode(); };
$('part-next').onclick = () => { state.part++; showCode(); };
$('encode-file').onclick = () => $('payload-file').click();
$('payload-file').onchange = async e => {
  const file = e.target.files[0]; if (!file) return;
  if (file.size > 26000) { $('make-error').hidden = false; $('make-error').textContent = 'This prototype supports files up to 26 KB across multiple codes.'; return; }
  state.file = new Uint8Array(await file.arrayBuffer()); state.fileName = file.name;
  $('file-name').textContent = file.name; $('clear-file').hidden = false; $('message').disabled = true; generate();
};
$('clear-file').onclick = () => {
  state.file = null; state.fileName = ''; $('payload-file').value = ''; $('file-name').textContent = '';
  $('clear-file').hidden = true; $('message').disabled = false; generate();
};
function download(blob, name) {
  const a = document.createElement('a'), url = URL.createObjectURL(blob); a.href = url; a.download = name;
  document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function codeName() { return `rs-${TYPES[state.type].id}-${SIZES[state.size].name.toLowerCase()}${state.codes.length > 1 ? '-' + (state.part + 1) : ''}`; }
function canvas(width, height = width) { const c = document.createElement('canvas'); c.width = width; c.height = height; return c; }
async function imageCanvas(blob) {
  const url = URL.createObjectURL(blob), image = new Image();
  try {
    image.src = url; await image.decode();
    if (!image.naturalWidth || !image.naturalHeight) throw Error('This image has no dimensions.');
    const scale = Math.min(1, 3600 / Math.max(image.naturalWidth, image.naturalHeight));
    const c = canvas(Math.round(image.naturalWidth * scale), Math.round(image.naturalHeight * scale));
    const ctx = c.getContext('2d'); ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, c.width, c.height); ctx.drawImage(image, 0, 0, c.width, c.height);
    return c;
  } finally { URL.revokeObjectURL(url); }
}
const svgBlob = () => new Blob([toSVG(state.codes[state.part])], { type: 'image/svg+xml' });
const saveCanvas = (c, name) => c.toBlob(blob => blob && download(blob, name), 'image/png');
$('download-svg').onclick = () => download(svgBlob(), codeName() + '.svg');
$('download-png').onclick = async () => saveCanvas(await imageCanvas(svgBlob()), codeName() + '.png');
$('test-code').onclick = async () => {
  stopCamera(); state.base = await imageCanvas(svgBlob()); state.testSize = state.size;
  resetDamage(); setTab('read'); $('damage-controls').hidden = false; $('damage-controls').open = true; applyDamage();
};

function clearResult() {
  state.decoded = null; document.querySelector('.scan-result').classList.remove('success', 'failure');
  for (const id of ['decoded-text', 'copy-result', 'open-result', 'save-payload', 'scan-details']) $(id).hidden = true;
}
function invalidateReading() { job++; queued = null; }
function scan(c, camera = false) {
  if(!camera){clearResult(); $('scan-status').textContent = 'Reading…'; $('scan-message').textContent = 'Finding the corner motifs and recovering the message.';}
  const ctx = c.getContext('2d', { willReadFrequently: true }), image = ctx.getImageData(0, 0, c.width, c.height);
  const request = { id: ++job, image: { data: image.data, width: image.width, height: image.height }, camera };
  if (busy) queued = request; else sendScan(request);
}
function sendScan(request) {
  busy = true; activeJob = request.id; $('scan-busy').hidden = false;
  worker.postMessage(request, request.frames ? request.frames.map(f=>f.image.data.buffer) : [request.image.data.buffer]);
}
worker.onmessage = ({ data }) => {
  busy = false;
  if (data.id === job) {
    if(data.frameIndex!==undefined&&burstCanvases?.id===data.id){state.base=burstCanvases.frames[data.frameIndex];showCameraFrame(state.base);}
    const outline=data.result?.outline??data.outline;if(outline)trackedRegion={outline,width:data.width,height:data.height,at:performance.now()};
    $('scan-busy').hidden = true;
    if (data.error) {
      if (!state.stream) {
        document.querySelector('.scan-result').classList.add('failure'); $('scan-status').textContent = 'No verified read.';
        $('scan-message').textContent = data.error + ' Try a larger, sharper image or reduce the damage.';
      } else { $('scan-status').textContent = data.found===4 ? 'Code located.' : 'Looking for a code…'; $('scan-message').textContent = data.error; drawCameraOutline(data.outline,data.width,data.height); }
    } else {
      showResult(data.result); if(state.stream)drawCameraOutline(data.result.outline,data.width,data.height);
      if (state.stream && data.result.parts === 1) stopCamera();
    }
  }
  if (queued) { const next = queued; queued = null; sendScan(next); }
};
worker.onerror = () => { busy = false; $('scan-busy').hidden = true; $('scan-status').textContent = 'Reader unavailable.'; $('scan-message').textContent = 'Reload this page to restart the reader.'; };
function showResult(result) {
  clearResult();
  $('scan-details').hidden = false;
  dl($('scan-stats'), [['Format', TYPES[result.type].name], ['Size / protection', `${SIZES[result.size].name} / ${LEVELS[result.level].name}`], ['Alignment', result.registration || 'whole shape'], ['Shape variant', (result.variant ?? 0) + 1], ['Changed codewords', result.corrected], ['Erased codewords', result.erasures], ['Reader time', `${Math.round(result.elapsedMs)} ms`]]);
  let decoded = result;
  if (result.parts > 1) {
    const key = `${result.group}:${result.parts}:${result.totalLength}:${result.binary}`;
    if (!state.parts.has(key)) state.parts.set(key, new Map());
    const parts = state.parts.get(key); parts.set(result.part, result); $('clear-parts').hidden = false;
    if (parts.size < result.parts) {
      $('scan-status').textContent = `${parts.size} of ${result.parts} parts.`;
      $('scan-message').textContent = `Part ${result.part + 1} verified. Read the remaining codes to assemble the message.`; return;
    }
    try { decoded = { ...result, ...assemble([...parts.values()]) }; }
    catch (error) { $('scan-status').textContent = 'Parts do not match.'; $('scan-message').textContent = error.message; return; }
    if (state.stream) stopCamera();
  }
  state.decoded = decoded; document.querySelector('.scan-result').classList.add('success');
  $('scan-status').textContent = 'Message recovered.';
  $('scan-message').textContent = `${decoded.data.length} bytes · checksum verified${result.parts > 1 ? ' · all parts assembled' : ''}`;
  $('save-payload').hidden = false;
  if (decoded.text !== null) {
    $('decoded-text').textContent = decoded.text || '(empty message)'; $('decoded-text').hidden = false; $('copy-result').hidden = false;
    try { const url = new URL(decoded.text); if (['http:', 'https:'].includes(url.protocol)) { $('open-result').href = url.href; $('open-result').hidden = false; } } catch { /* Plain text is not a link. */ }
  }
}
$('copy-result').onclick = async () => {
  try { await navigator.clipboard.writeText(state.decoded.text); $('copy-result').textContent = 'Copied'; setTimeout(() => $('copy-result').textContent = 'Copy', 1500); }
  catch { $('scan-message').textContent = 'Select the decoded message to copy it.'; }
};
$('save-payload').onclick = () => download(new Blob([state.decoded.data], { type: state.decoded.text === null ? 'application/octet-stream' : 'text/plain;charset=utf-8' }), state.decoded.text === null ? 'rs-payload.bin' : 'rs-message.txt');
$('clear-parts').onclick = () => { state.parts.clear(); $('clear-parts').hidden = true; clearResult(); $('scan-status').textContent = 'Parts cleared.'; $('scan-message').textContent = 'Read another code to start a new message.'; };

async function openImage(file) {
  if (!file) return; stopCamera(); invalidateReading();
  try {
    if (file.size > 25 * 1024 * 1024) throw Error('Choose an image smaller than 25 MB.');
    state.base = await imageCanvas(file); state.testSize = null; $('damage-controls').hidden = true;
    showCanvas(state.base); scan($('scan-canvas')); setTab('read');
  } catch (error) { clearResult(); $('scan-status').textContent = 'Could not open image.'; $('scan-message').textContent = error.message; }
}
$('choose-image').onclick = () => $('image-file').click();
$('image-file').onchange = e => { openImage(e.target.files[0]); e.target.value = ''; };
for (const name of ['dragenter', 'dragover']) $('drop-zone').addEventListener(name, e => { e.preventDefault(); $('drop-zone').classList.add('drag-over'); });
for (const name of ['dragleave', 'drop']) $('drop-zone').addEventListener(name, e => { e.preventDefault(); $('drop-zone').classList.remove('drag-over'); if (name === 'drop') openImage(e.dataTransfer.files[0]); });
function showCanvas(source) {
  const c = $('scan-canvas'); c.width = source.width; c.height = source.height; c.getContext('2d').drawImage(source, 0, 0);
  c.hidden = false; $('scan-placeholder').hidden = true; $('camera').hidden = true; $('camera-guide').hidden = true;
}
function resetDamage() { for (const id of ['cover', 'crop', 'rotation', 'blur']) $(id).value = 0; }
function applyDamage() {
  if (!state.base || state.testSize === null) return;
  stopCamera(); invalidateReading();
  const cover = Number($('cover').value) / 100, crop = Number($('crop').value) / 100, angle = Number($('rotation').value), blur = Number($('blur').value);
  $('cover-output').textContent = `${Math.round(cover * 100)}%`; $('crop-output').textContent = `${Math.round(crop * 100)}%`;
  $('rotation-output').textContent = `${angle}°`; $('blur-output').textContent = `${blur} px`;
  const base = state.base, marked = canvas(base.width, base.height), m = marked.getContext('2d'); m.drawImage(base, 0, 0);
  const side = Math.sqrt(cover) * geometry(state.testSize).inner * .72;
  m.fillStyle = '#fff'; m.fillRect((base.width - side) / 2, (base.height - side) / 2, side, side);
  const cut = Math.floor(base.width * crop), size = base.width - cut, rad = angle * Math.PI / 180, extent = Math.ceil(size * (Math.abs(Math.sin(rad)) + Math.abs(Math.cos(rad))));
  const out = canvas(extent), ctx = out.getContext('2d'); ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, extent, extent);
  ctx.translate(extent / 2, extent / 2); ctx.rotate(rad); ctx.filter = blur ? `blur(${blur}px)` : 'none';
  ctx.drawImage(marked, cut, cut, size, size, -size / 2, -size / 2, size, size);
  showCanvas(out); scan($('scan-canvas'));
}
for (const id of ['cover', 'crop', 'rotation', 'blur']) $(id).oninput = () => { invalidateReading(); clearTimeout(damageTimer); damageTimer = setTimeout(applyDamage, 140); };
$('reset-damage').onclick = () => { resetDamage(); applyDamage(); };
$('save-test-image').onclick = () => saveCanvas($('scan-canvas'), 'rs-damage-test.png');

function stopCamera() {
  if (!state.stream) return;
  state.stream.getTracks().forEach(t => t.stop()); state.stream = null; clearTimeout(cameraTimer);
  $('camera').srcObject = null; $('camera').hidden = true; $('camera-guide').hidden = true;
  $('stop-camera').hidden = true; $('start-camera').hidden = false; $('camera-overlay').hidden=true; $('save-camera-frame').hidden=true;
  if ($('scan-canvas').width > 0 && state.base) $('scan-canvas').hidden = false; else $('scan-placeholder').hidden = false;
}
$('stop-camera').onclick = () => { invalidateReading(); stopCamera(); $('scan-busy').hidden = true; };
$('start-camera').onclick = async () => {
  try {
    if (!navigator.mediaDevices?.getUserMedia) throw Error('Camera access needs HTTPS or localhost and a supported browser.');
    stopCamera(); invalidateReading(); clearResult(); trackedRegion=null;
    const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' }, width: { ideal: 2560 }, height: { ideal: 1440 } }, audio: false });
    if ($('panel-read').hidden) { stream.getTracks().forEach(t => t.stop()); return; }
    state.stream = stream;
    try{const track=stream.getVideoTracks()[0],caps=track.getCapabilities?.();if(caps?.focusMode?.includes('continuous'))await track.applyConstraints({advanced:[{focusMode:'continuous'}]});}catch{}
    $('scan-status').textContent='Looking for a code…'; $('scan-message').textContent='Keep all four corner motifs visible. Move closer until the pattern is sharp.';
    $('camera').srcObject = stream; await $('camera').play();
    $('camera').hidden = false; $('scan-canvas').hidden = true; $('scan-placeholder').hidden = true; $('camera-guide').hidden = true; $('camera-overlay').hidden=false;
    $('damage-controls').hidden = true; $('start-camera').hidden = true; $('stop-camera').hidden = false; $('save-camera-frame').hidden=false;
    const frame = async () => {
      if (!state.stream) return;
      if (!busy && !capturing && $('camera').videoWidth) {
        capturing=true; const streamAtStart=state.stream,frames=[];
        try{
          for(let i=0;i<3;i++){
            if(i)await new Promise(resolve=>setTimeout(resolve,45));
            if(state.stream!==streamAtStart)return;
            const v=$('camera'),scale=Math.min(1,2560/v.videoWidth),c=canvas(Math.round(v.videoWidth*scale),Math.round(v.videoHeight*scale));
            c.getContext('2d').drawImage(v,0,0,c.width,c.height);frames.push(c);
          }
          state.base=frames[0];showCameraFrame(frames[0]);
          const id=++job;burstCanvases={id,frames};
          sendScan({id,camera:true,frames:frames.map(c=>{const quality=frameSharpness(c),pixels=c.getContext('2d').getImageData(0,0,c.width,c.height);return{quality,image:{data:pixels.data,width:c.width,height:c.height}};})});
        }finally{capturing=false;}
      }
      if(state.stream)cameraTimer=setTimeout(frame,180);
    };
    frame();
  } catch (error) { stopCamera(); $('scan-status').textContent = 'Camera unavailable.'; $('scan-message').textContent = error.name === 'NotAllowedError' ? 'Camera permission was declined. You can open an image instead.' : error.message; }
};
function showCameraFrame(c) { const target = $('scan-canvas'); target.width = c.width; target.height = c.height; target.getContext('2d').drawImage(c, 0, 0); }
window.addEventListener('pagehide', stopCamera);
document.addEventListener('visibilitychange', () => { if (document.hidden) stopCamera(); });

function capacityTable() {
  const level = Number($('compare-level').value), table = $('capacity-table');
  table.innerHTML = '<thead><tr><th>Language</th>' + SIZES.map(s => `<th>${s.name}</th>`).join('') + '</tr></thead>';
  const body = table.createTBody();
  TYPES.forEach((t, type) => { const row = body.insertRow(); row.insertCell().textContent = t.name; SIZES.forEach((_, size) => row.insertCell().textContent = `${plan(type, size, level).capacity.toLocaleString()} B`); });
}
$('compare-level').onchange = capacityTable;
const reads = ['Thick curves and a simple alphabet.', 'Separated shapes remain the practical baseline.', 'A sea-fan tree with larger, readable branch tips.', 'Strand routings and visible over–under crossings carry the data.', 'Core geometry and the positions of broad ridge endings carry data.', 'Star positions and actual connections form chains, loops and triangles.'];
TYPES.forEach((t, i) => { const card = document.createElement('article'), title = document.createElement('h3'), p = document.createElement('p'), risk = document.createElement('p'); title.textContent = t.name; p.textContent = t.potential; risk.textContent = reads[i] + ' ' + t.risk; risk.className = 'tradeoff'; card.append(title, p, risk); $('potential-grid').append(card); });
async function benchmarks(path, tableId, methodId) {
  try {
    const response = await fetch(path); if (!response.ok) throw Error(); const report = await response.json();
    $(methodId).textContent = typeof report.method==='string' ? `S size · Strong protection · ${report.samples} messages per condition · synthetic frames` : `${report.method.size} size · ${report.method.level} protection · ${report.method.samplesPerScenario} messages per condition · synthetic images`;
    const table = $(tableId); table.innerHTML = '<thead><tr><th>Condition</th>' + TYPES.map(t => `<th>${t.name}</th>`).join('') + '</tr></thead>';
    const body = table.createTBody();
    report.scenarios.forEach(scenario => {
      const row = body.insertRow(); row.insertCell().textContent = scenario.name;
      TYPES.forEach(t => { const trials = report.results.find(r => r.type === t.id).rows.filter(r => r.scenario === scenario.id), passed = trials.filter(r => r.pass).length, cell = row.insertCell(); cell.textContent = `${passed} / ${trials.length}`; cell.className = passed === trials.length ? 'pass' : 'fail'; });
    });
  } catch { $(methodId).textContent = 'Measured results could not be loaded. Download the report or reload the page.'; }
}
$('scan-status').setAttribute('aria-live', 'polite');
setTab('make'); generate(); capacityTable(); benchmarks('/benchmark.json','benchmark-table','benchmark-method'); benchmarks('/webcam-benchmark.json','webcam-table','webcam-method');

function drawCameraOutline(points,width,height){
 const c=$('camera-overlay'),stage=$('drop-zone');c.width=stage.clientWidth;c.height=stage.clientHeight;const ctx=c.getContext('2d');ctx.clearRect(0,0,c.width,c.height);if(!points)return;
 const scale=Math.min(c.width/width,c.height/height),ox=(c.width-width*scale)/2,oy=(c.height-height*scale)/2;ctx.strokeStyle='#f06a38';ctx.lineWidth=3;ctx.beginPath();points.forEach(([x,y],i)=>i?ctx.lineTo(ox+x*scale,oy+y*scale):ctx.moveTo(ox+x*scale,oy+y*scale));ctx.closePath();ctx.stroke();
}
$('show-code').onclick=()=>{if(!state.codes.length)return;$('large-code').innerHTML=toSVG(state.codes[state.part]);$('display-code').showModal();};
$('close-display').onclick=()=>$('display-code').close();

$('save-camera-frame').onclick=()=>{if(state.base)saveCanvas(state.base,'rs-camera-frame.png');};

function frameSharpness(source){
 let x=source.width*.1,y=source.height*.1,w=source.width*.8,h=source.height*.8;
 if(trackedRegion&&performance.now()-trackedRegion.at<1500){const p=trackedRegion.outline.map(([a,b])=>[a*source.width/trackedRegion.width,b*source.height/trackedRegion.height]),xs=p.map(q=>q[0]),ys=p.map(q=>q[1]);x=Math.max(0,Math.min(...xs)-source.width*.05);y=Math.max(0,Math.min(...ys)-source.height*.05);w=Math.min(source.width-x,Math.max(...xs)-x+source.width*.05);h=Math.min(source.height-y,Math.max(...ys)-y+source.height*.05);}
 const c=canvas(160),ctx=c.getContext('2d',{willReadFrequently:true});ctx.drawImage(source,x,y,w,h,0,0,160,160);const d=ctx.getImageData(0,0,160,160).data,g=new Float32Array(160*160);for(let i=0;i<g.length;i++)g[i]=(d[i*4]+d[i*4+1]+d[i*4+2])/3;let sum=0,count=0;for(let yy=1;yy<159;yy++)for(let xx=1;xx<159;xx++){const i=yy*160+xx,v=4*g[i]-g[i-1]-g[i+1]-g[i-160]-g[i+160];sum+=v*v;count++;}return sum/count;
}
