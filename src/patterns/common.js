// All layouts share a 1000-unit drawing plane. The surrounding clear edge is
// part of the export. No payload samples are assigned beneath a reference mark.
export const EXTENT = 1000;
export const FIELD = 920;
export const ANCHORS = [[234, 240], [760, 215], [721, 746], [274, 757]];
export const RADIUS = 31;
export const CLEARANCE = RADIUS * 1.37;
export const TAU = Math.PI * 2;
export const nearAnchor = (p, margin = 0) => ANCHORS.some(a => Math.hypot(p[0] - a[0], p[1] - a[1]) < CLEARANCE + margin);
export const polar = (p, r, a) => [p[0] + r * Math.cos(a), p[1] + r * Math.sin(a)];
export const num = x => +x.toFixed(2);
export const xy = ([x, y]) => `${num(x)} ${num(y)}`;
export const path = ps => 'M' + ps.map(xy).join('L');
export const dot = (p, r, fill) => `<circle cx="${num(p[0])}" cy="${num(p[1])}" r="${num(r)}" fill="${fill}"/>`;
export const stroke = (d, w, ink, caps = 'round') => `<path d="${d}" fill="none" stroke="${ink}" stroke-width="${num(w)}" stroke-linecap="${caps}" stroke-linejoin="round"/>`;

// Pick a uniformly distributed subset without shifting later symbols when an
// anchor interrupts a run. Surplus motifs can still complete a decorative line.
export function takeEvenly(items, n) {
  if (items.length < n) throw Error(`Layout has ${items.length} sites for ${n} symbols`);
  return Array.from({length:n}, (_, i) => items[Math.floor((i + .5) * items.length / n)]);
}

export function symbolValue(code, start, count) {
  let value = 0;
  for (let i = start; i < start + count; i++) {
    const q = Math.floor(i / code.bits);
    value = value * 2 + ((code.values[q] >> (code.bits - 1 - i % code.bits)) & 1);
  }
  return value;
}

export function bitSink() {
  const bits = [], confidence = [];
  return {bits, confidence, put(value, strength) {
    bits.push(+value);
    confidence.push(Number.isFinite(strength) ? Math.max(0, strength) : 0);
  }};
}

// Confidence is the optical separation of the two bit states, measured on a
// local paper-to-ink scale. Missing pixels yield NaN and hence an erasure.
export function strongest(scores, sink) {
  const order = scores.map((s, i) => i).sort((a, b) => scores[b] - scores[a]);
  const best = order[0];
  for (const mask of [2, 1]) {
    const rival = order.find(i => (i & mask) !== (best & mask));
    sink.put(best & mask ? 1 : 0, scores[best] - scores[rival]);
  }
}
