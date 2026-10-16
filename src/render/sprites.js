// Procedural pixel-art sprites.
//
// Each sprite is painted onto a tiny pixel grid by a painter function, then "baked": an automatic
// dark outline is added and the result is cached as a canvas. Flipped and white-flash variants are
// derived lazily. Adding a new creature means writing one painter, not touching the renderer.

const OUTLINE = '#120d1a';

class Pix {
  constructor(w, h) { this.w = w; this.h = h; this.d = new Array(w * h).fill(null); }
  px(x, y, c) { x = Math.round(x); y = Math.round(y); if (x >= 0 && y >= 0 && x < this.w && y < this.h) this.d[y * this.w + x] = c; }
  rect(x, y, w, h, c) { for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) this.px(x + i, y + j, c); }
  circ(cx, cy, r, c) {
    for (let y = Math.floor(cy - r); y <= Math.ceil(cy + r); y++)
      for (let x = Math.floor(cx - r); x <= Math.ceil(cx + r); x++)
        if ((x - cx) ** 2 + (y - cy) ** 2 <= r * r) this.px(x, y, c);
  }
  ell(cx, cy, rx, ry, c) {
    for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++)
      for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++)
        if (((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1) this.px(x, y, c);
  }
  line(x0, y0, x1, y1, c) {
    const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0)) || 1;
    for (let i = 0; i <= n; i++) this.px(x0 + ((x1 - x0) * i) / n, y0 + ((y1 - y0) * i) / n, c);
  }
  get(x, y) { return x >= 0 && y >= 0 && x < this.w && y < this.h ? this.d[y * this.w + x] : null; }
}

function makeCanvas(w, h) {
  const c = typeof document !== 'undefined' ? document.createElement('canvas') : { width: w, height: h };
  c.width = w; c.height = h;
  return c;
}

function bake(pix, outline = OUTLINE) {
  const c = makeCanvas(pix.w, pix.h);
  const ctx = c.getContext('2d');
  for (let y = 0; y < pix.h; y++)
    for (let x = 0; x < pix.w; x++) {
      let col = pix.get(x, y);
      if (!col && outline) {
        if (pix.get(x + 1, y) || pix.get(x - 1, y) || pix.get(x, y + 1) || pix.get(x, y - 1)) col = outline;
      }
      if (col) { ctx.fillStyle = col; ctx.fillRect(x, y, 1, 1); }
    }
  return c;
}

const flipCache = new WeakMap(), flashCache = new WeakMap();
export function flipped(c) {
  let f = flipCache.get(c);
  if (!f) {
    f = makeCanvas(c.width, c.height);
    const x = f.getContext('2d');
    x.translate(c.width, 0); x.scale(-1, 1); x.drawImage(c, 0, 0);
    flipCache.set(c, f);
  }
  return f;
}
const tintCache = new Map();
export function tinted(c, color) {
  let m = tintCache.get(color);
  if (!m) { m = new WeakMap(); tintCache.set(color, m); }
  let f = m.get(c);
  if (!f) {
    f = makeCanvas(c.width, c.height);
    const x = f.getContext('2d');
    x.drawImage(c, 0, 0);
    x.globalCompositeOperation = 'source-in';
    x.fillStyle = color;
    x.fillRect(0, 0, c.width, c.height);
    m.set(c, f);
  }
  return f;
}
export function flashed(c) {
  let f = flashCache.get(c);
  if (!f) {
    f = makeCanvas(c.width, c.height);
    const x = f.getContext('2d');
    x.drawImage(c, 0, 0);
    x.globalCompositeOperation = 'source-in';
    x.fillStyle = '#ffffff';
    x.fillRect(0, 0, c.width, c.height);
    flashCache.set(c, f);
  }
  return f;
}

// ───────────────────────── palettes ─────────────────────────
export const PAL = {
  moss:   { a: '#6dbb4f', b: '#3f7f3a', c: '#24401f', d: '#d4ec7a', e: '#ff5d73', eye: '#fff3b0', acc: '#8a5a32', acc2: '#5e3b22' },
  cinder: { a: '#ff7a3a', b: '#b23a2a', c: '#3b1616', d: '#ffd36b', e: '#ffe14d', eye: '#fff6c2', acc: '#4a3434', acc2: '#2a1e1e' },
  prism:  { a: '#7ae0ff', b: '#4f7bd8', c: '#221f55', d: '#effbff', e: '#ff7ae6', eye: '#ffffff', acc: '#9a6cff', acc2: '#5a3fb0' },
};

const HERO = {
  vanguard: { body: '#d84a4a', bodyD: '#93303b', trim: '#ffd36b', arm: '#9aa3b5', leg: '#5a5f73', boot: '#3a2b2b', helm: '#c9d1e0', helmL: '#eef2f8', helmD: '#7d8799', visor: '#1b1b2b', plume: '#ff5d5d' },
  arcanist: { body: '#4f6fe0', bodyD: '#33479b', trim: '#ffd36b', arm: '#4f6fe0', leg: '#33479b', boot: '#2a2440', hat: '#3c4fb8', skin: '#f2c9a0', eye: '#1b1b2b', beard: '#e8e8f0' },
  ranger: { body: '#4f9e4f', bodyD: '#2f6b3a', trim: '#a8743a', arm: '#4f9e4f', leg: '#5c4632', boot: '#3a2b20', hood: '#3d7f3d', hoodD: '#2b5a2b', skin: '#f2c9a0', eye: '#1b1b2b', cape: '#2b5a2b' },
  warden: { body: '#7b4fc4', bodyD: '#4f2f8a', trim: '#7ae0ff', arm: '#7b4fc4', leg: '#4f2f8a', boot: '#2a1f40', mask: '#ece6d6', horn: '#cfc4a8', glow: '#7ae0ff', hood: '#4f2f8a' },
  vendor: { body: '#c9853a', bodyD: '#8a5a26', trim: '#f2e6c9', arm: '#c9853a', leg: '#5c4632', boot: '#3a2b20', skin: '#f2c9a0', eye: '#1b1b2b', cap: '#b23a2a', beard: '#8a5a32' },
};

// ───────────────────────── painters ─────────────────────────
// Heroes: 16x20, feet at y=18. frames: 0 idle, 1 idle-breathe, 2 walk-a, 3 walk-b
function paintHero(p, k, f) {
  const C = HERO[k];
  const b = f === 1 ? 1 : 0;
  const robe = k === 'arcanist' || k === 'warden';
  const leg = (x, up) => { p.rect(x, 15 - up, 2, 3, C.leg); p.rect(x, 17 - up, 2, 1, C.boot); };
  if (!robe) { leg(5, f === 2 ? 1 : 0); leg(9, f === 3 ? 1 : 0); }
  else { p.rect(5, 17 - (f === 2 ? 1 : 0), 2, 1, C.boot); p.rect(9, 17 - (f === 3 ? 1 : 0), 2, 1, C.boot); }
  if (k === 'ranger') p.rect(3, 9 + b, 2, 7 - b, C.cape);
  // torso
  const bodyH = robe ? 8 - b : 6 - b;
  p.rect(4, 9 + b, 8, bodyH, C.body);
  p.rect(10, 9 + b, 2, bodyH, C.bodyD);
  if (robe) p.rect(4, 15, 8, 1, C.bodyD);
  p.rect(4, 13, 8, 1, C.trim);
  p.rect(3, 10 + b, 1, 4, C.arm); p.rect(12, 10 + b, 1, 4, C.arm);
  // heads
  if (k === 'vanguard') {
    p.rect(4, 3 + b, 8, 6, C.helm); p.rect(4, 3 + b, 8, 1, C.helmL); p.rect(10, 4 + b, 2, 5, C.helmD);
    p.rect(6, 6 + b, 6, 1, C.visor); p.rect(7, 1 + b, 3, 2, C.plume); p.px(6, 2 + b, C.plume);
    p.rect(4, 9 + b, 2, 1, C.helmD); p.rect(10, 9 + b, 2, 1, C.helmD); // pauldrons
  } else if (k === 'arcanist') {
    p.rect(5, 6 + b, 6, 3, C.skin); p.px(8, 7 + b, C.eye); p.px(10, 7 + b, C.eye);
    p.rect(6, 9 + b, 5, 2, C.beard);
    p.rect(2, 5 + b, 12, 1, C.hat); p.rect(4, 3 + b, 7, 2, C.hat); p.rect(5, 1 + b, 4, 2, C.hat); p.rect(3, 0 + b, 3, 1, C.hat);
    p.rect(4, 4 + b, 7, 1, C.trim);
  } else if (k === 'ranger') {
    p.rect(4, 3 + b, 8, 6, C.hood); p.rect(5, 2 + b, 6, 1, C.hood); p.rect(4, 3 + b, 2, 6, C.hoodD);
    p.rect(7, 5 + b, 4, 3, C.skin); p.px(8, 6 + b, C.eye); p.px(10, 6 + b, C.eye);
    p.px(12, 11 + b, C.trim); p.px(2, 6 + b, C.trim); p.line(1, 4 + b, 3, 11 + b, C.trim); // quiver strap
  } else if (k === 'warden') {
    p.rect(4, 2 + b, 9, 7, C.hood);
    p.rect(5, 3 + b, 7, 6, C.mask);
    p.rect(4, 0 + b, 1, 3, C.horn); p.rect(12, 0 + b, 1, 3, C.horn);
    p.rect(7, 5 + b, 1, 2, C.glow); p.rect(10, 5 + b, 1, 2, C.glow);
    p.rect(7, 8 + b, 4, 1, C.horn);
  } else if (k === 'vendor') {
    p.rect(5, 4 + b, 6, 5, C.skin); p.px(8, 6 + b, C.eye); p.px(10, 6 + b, C.eye);
    p.rect(5, 8 + b, 6, 2, C.beard);
    p.rect(4, 2 + b, 8, 2, C.cap); p.rect(10, 3 + b, 3, 1, C.cap);
    p.rect(5, 10 + b, 6, 5, C.trim); // apron
  }
}

function paintBlob(p, P, f) {
  const ry = f ? 3.6 : 4.4, rx = f ? 6.5 : 5.8;
  p.ell(7, 11 - ry, rx, ry, P.a);
  p.ell(7, 11 - ry + 2, rx - 1, ry - 2, P.b);
  p.ell(7, 11 - ry - 0.5, rx - 1.5, ry - 1.5, P.a);
  p.px(4, 11 - ry * 2 + 2, P.d); p.px(5, 11 - ry * 2 + 2, P.d);
  p.px(6, 9 - ry + 1, P.eye); p.px(9, 9 - ry + 1, P.eye); p.px(6, 10 - ry + 1, P.c); p.px(9, 10 - ry + 1, P.c);
}
function paintSpitter(p, P, f) {
  p.rect(6, 9, 2, 6, P.b); p.px(4, 12, P.a); p.px(5, 11, P.a); p.px(9, 12, P.a); p.px(8, 11, P.a);
  const y = f ? 5 : 6;
  p.circ(7, y, 4.5, P.a); p.circ(6, y - 1, 2.5, P.d);
  p.circ(7, y, 4.5 - 1, P.a);
  p.rect(9, y - 1, 3, 3, P.c); p.px(12, y, P.e);
  p.px(6, y - 2, P.eye); p.px(6, y - 1, P.c);
}
function paintBat(p, P, f) {
  p.circ(8, 6, 3, P.a); p.px(7, 5, P.e); p.px(9, 5, P.e);
  p.px(6, 2, P.b); p.px(10, 2, P.b); p.px(6, 3, P.a); p.px(10, 3, P.a);
  if (f) { p.line(5, 6, 1, 9, P.b); p.line(5, 7, 2, 10, P.b); p.line(11, 6, 15, 9, P.b); p.line(11, 7, 14, 10, P.b); }
  else { p.line(5, 6, 1, 2, P.b); p.line(5, 5, 2, 1, P.b); p.line(5, 7, 2, 4, P.c); p.line(11, 6, 15, 2, P.b); p.line(11, 5, 14, 1, P.b); p.line(11, 7, 14, 4, P.c); }
}
function paintGolem(p, P, f) {
  const up = f ? 1 : 0;
  p.rect(5, 17, 4, 3, P.c); p.rect(12, 17, 4, 3, P.c);
  p.rect(4, 7, 13, 11, P.b); p.rect(4, 7, 13, 2, P.acc); p.rect(14, 9, 3, 9, P.c);
  p.rect(6, 2, 9, 6, P.a); p.rect(6, 2, 9, 1, P.d);
  p.rect(8, 4, 2, 2, P.e); p.rect(12, 4, 2, 2, P.e);
  p.rect(1, 8 - up, 3, 9, P.a); p.rect(17, 8 - up, 3, 9, P.a); p.rect(1, 15 - up, 3, 2, P.c); p.rect(17, 15 - up, 3, 2, P.c);
  p.px(8, 11, P.c); p.px(9, 12, P.c); p.px(10, 13, P.c); p.px(12, 10, P.e);
}
function paintShroom(p, P, f) {
  const y = f ? 1 : 0;
  p.rect(5, 8, 5, 5, P.eye); p.rect(8, 8, 2, 5, P.d);
  p.px(6, 10, P.c); p.px(8, 10, P.c);
  p.ell(7, 5 + y, 6.5, 3.5, P.e); p.ell(7, 4 + y, 5, 2.4, P.e);
  p.px(4, 4 + y, P.d); p.px(9, 3 + y, P.d); p.px(11, 5 + y, P.d); p.px(6, 6 + y, P.d);
}
function paintShaman(p, P, f) {
  p.rect(4, 7, 7, 9, P.b); p.rect(3, 13, 9, 3, P.b); p.rect(9, 7, 2, 9, P.c);
  p.rect(4, 2, 7, 6, P.a); p.rect(5, 4, 5, 4, P.c); p.px(6, 5, P.e); p.px(8, 5, P.e);
  p.line(12, 3, 12, 16, P.acc); p.circ(12, 2, f ? 2.2 : 1.5, f ? P.d : P.e);
}
function paintSentinel(p, P, f) {
  p.rect(3, 17, 9, 3, P.c); p.rect(4, 6, 7, 11, P.b); p.rect(9, 6, 2, 11, P.c);
  p.rect(5, 3, 5, 3, P.a); p.rect(6, 1, 3, 2, P.a); p.px(7, 0, P.d);
  p.rect(6, 9, 3, 4, f ? P.d : P.e); p.px(7, 8, P.e); p.px(7, 13, P.e);
}
function paintBoar(p, P, f) {
  const l = f ? 1 : 0;
  p.rect(4, 11 - l, 2, 3, P.c); p.rect(8, 11, 2, 3, P.c); p.rect(11, 11 - l, 2, 3, P.c);
  p.ell(8, 8, 6.5, 3.8, P.acc); p.ell(8, 7, 5.5, 2.5, P.b);
  for (let x = 4; x < 12; x += 2) p.px(x, 4, P.a);
  p.circ(14, 8, 3, P.acc); p.px(15, 7, P.e); p.rect(16, 9, 2, 1, P.d); p.px(17, 8, P.d);
}
function paintWisp(p, P, f) {
  p.circ(5, 4, 3, P.a); p.circ(5, 4, 1.5, P.d); p.px(f ? 2 : 3, 8, P.b); p.px(4, 7, P.b); p.px(f ? 6 : 7, 8, P.b);
  p.px(4, 4, P.c); p.px(6, 4, P.c);
}
function paintWolf(p, P, f) {
  const l = f ? 1 : 0;
  p.rect(4, 10 - l, 2, 3, '#7a9cff'); p.rect(12, 10, 2, 3, '#7a9cff'); p.rect(8, 10 - (1 - l), 2, 3, '#7a9cff');
  p.ell(9, 8, 6, 3, '#9fc0ff'); p.ell(9, 7, 5, 2, '#c9dcff');
  p.circ(15, 6, 3, '#c9dcff'); p.rect(16, 7, 3, 2, '#9fc0ff'); p.px(15, 2, '#c9dcff'); p.px(14, 3, '#c9dcff');
  p.px(16, 5, '#7ae0ff'); p.line(3, 7, 0, 4 + l, '#9fc0ff');
}
function paintClone(p, P, f) { paintLumen(p, PAL.prism, f, 0.5); }

// Bosses
function paintBramblemaw(p, P, f) {
  const open = f ? 2 : 0;
  for (const [x, y] of [[6, 36], [12, 38], [32, 38], [38, 36], [20, 38], [26, 39]]) p.line(22, 30, x, y, P.acc2);
  p.ell(22, 27, 16, 11, P.acc); p.ell(26, 28, 11, 9, P.acc2); p.ell(20, 26, 13, 9, P.acc);
  for (let x = 10; x < 34; x += 5) p.line(x, 20, x + 1, 34, P.acc2);
  p.circ(11, 12, 7, P.b); p.circ(22, 8, 8, P.b); p.circ(33, 12, 7, P.b);
  p.circ(12, 11, 5.5, P.a); p.circ(22, 7, 6.5, P.a); p.circ(32, 11, 5.5, P.a);
  p.px(9, 9, P.d); p.px(20, 4, P.d); p.px(31, 8, P.d); p.px(24, 6, P.e); p.px(14, 13, P.e); p.px(34, 13, P.e);
  p.ell(22, 28, 9, 3 + open, '#1a0f0a');
  for (let x = 15; x <= 29; x += 3) { p.px(x, 26 - open + 1, P.d); p.px(x + 1, 30 + open - 1, P.d); }
  p.rect(14, 19, 4, 3, '#ffde59'); p.rect(26, 19, 4, 3, '#ffde59'); p.px(16, 20, '#1a0f0a'); p.px(28, 20, '#1a0f0a');
}
function paintKragHead(p, P, f) {
  p.line(8, 9, 2, 2, P.d); p.line(9, 9, 4, 1, P.d); p.line(22, 9, 28, 2, P.d); p.line(21, 9, 26, 1, P.d);
  p.ell(15, 15, 12, 10, P.b); p.ell(15, 14, 11, 8, P.a);
  p.ell(15, 22 + (f ? 1 : 0), 9, 3 + (f ? 2 : 0), P.c);
  if (f) { p.ell(15, 23, 6, 2.5, P.e); p.ell(15, 23, 3, 1.2, '#ffffff'); }
  for (let x = 8; x <= 22; x += 3) p.px(x, 20, P.d);
  p.rect(8, 11, 4, 3, P.e); p.rect(19, 11, 4, 3, P.e); p.px(10, 12, P.c); p.px(20, 12, P.c);
  p.px(13, 17, P.c); p.px(17, 17, P.c);
  for (let x = 9; x <= 21; x += 4) p.px(x, 6, P.d);
}
function paintKragSeg(p, P, f) {
  p.circ(10, 10, 8, P.b); p.circ(10, 9, 6.5, P.a); p.rect(6, 4, 8, 2, P.b);
  p.px(10, 1, P.d); p.px(9, 2, P.d); p.px(11, 2, P.d);
  p.px(7, 9, P.e); p.px(13, 11, P.e);
}
function paintLumen(p, P, f, s = 1) {
  const cx = 18 * s, H = 40 * s, top = 2;
  for (let y = 0; y < H; y++) {
    const hw = y < H * 0.4 ? (y / (H * 0.4)) * 13 * s : ((H - y) / (H * 0.6)) * 13 * s;
    for (let x = -hw; x <= hw; x++) p.px(cx + x, top + y, x < 0 ? P.b : P.a);
  }
  p.line(cx, top, cx, top + H - 1, P.d);
  p.line(cx - 6 * s, top + H * 0.4, cx + 6 * s, top + H * 0.4, P.d);
  p.circ(cx, top + H * 0.42, (f ? 5 : 3.6) * s, P.e);
  p.circ(cx, top + H * 0.42, (f ? 2.5 : 1.8) * s, '#ffffff');
}

// Props / NPCs
function paintDummy(p, P, f) {
  p.rect(7, 10, 2, 10, '#7a5230');
  p.rect(3, 9, 10, 2, '#7a5230');
  p.ell(8, 12, 4, 4, '#d9b56c'); p.ell(8, 12, 3, 3, '#c9a35a');
  p.circ(8, 5, 3.5, '#e2c88a'); p.px(7, 5, '#3a2b20'); p.px(9, 5, '#3a2b20'); p.px(8, 7, '#b23a2a');
  p.line(5, 10, 11, 14, '#b23a2a');
}
function paintTree(p, P, f) {
  p.rect(10, 20, 4, 9, '#6b4a2b'); p.rect(12, 20, 2, 9, '#4f351f'); p.px(9, 28, '#6b4a2b'); p.px(14, 28, '#6b4a2b');
  p.circ(12, 12, 9, '#2f6b3a'); p.circ(8, 15, 6, '#2f6b3a'); p.circ(16, 15, 6, '#2f6b3a');
  p.circ(11, 10, 7, '#3f8a45'); p.circ(15, 13, 5, '#3f8a45'); p.circ(9, 8, 3, '#5fae55'); p.px(14, 6, '#7fcf6a'); p.px(7, 12, '#7fcf6a');
}
function paintFountain(p, P, f) {
  p.ell(16, 20, 15, 6, '#7d8799'); p.ell(16, 19, 13, 4.5, f ? '#5aa9e6' : '#4f9be0');
  p.rect(14, 6, 4, 13, '#9aa3b5'); p.ell(16, 7, 6, 2, '#9aa3b5'); p.ell(16, 6.5, 4.5, 1.2, '#5aa9e6');
  p.px(16, 3 + (f ? 1 : 0), '#bfe6ff'); p.px(15, 4, '#bfe6ff'); p.px(17, 4, '#bfe6ff');
  p.px(10, 18, '#bfe6ff'); p.px(22, 19 - (f ? 1 : 0), '#bfe6ff');
}
function paintStall(p, P, f) {
  p.rect(1, 10, 78, 12, '#8a5a32'); p.rect(1, 10, 78, 2, '#a8743a'); p.rect(1, 20, 78, 2, '#5e3b22');
  for (let x = 0; x < 80; x += 10) { p.rect(x, 0, 5, 7, '#b23a2a'); p.rect(x + 5, 0, 5, 7, '#f2e6c9'); }
  p.rect(2, 7, 2, 3, '#5e3b22'); p.rect(76, 7, 2, 3, '#5e3b22');
  p.circ(14, 9, 2, '#ff5d73'); p.circ(20, 9, 2, '#5b8cff'); p.rect(56, 7, 6, 3, '#c9d1e0'); p.rect(66, 7, 3, 3, '#ffd36b');
}
function paintFence(p, P, f) { p.rect(0, 3, 16, 2, '#8a5a32'); p.rect(0, 7, 16, 2, '#8a5a32'); p.rect(2, 1, 2, 9, '#6b4a2b'); p.rect(12, 1, 2, 9, '#6b4a2b'); }
function paintFenceV(p, P, f) { p.rect(6, 0, 3, 16, '#8a5a32'); p.rect(5, 0, 5, 2, '#6b4a2b'); }
function paintStatue(p, P, f) {
  p.rect(4, 22, 24, 8, '#6b6577'); p.rect(4, 22, 24, 2, '#8e889b');
  p.rect(10, 8, 12, 14, '#8e889b'); p.rect(18, 8, 4, 14, '#6b6577');
  p.circ(16, 6, 4, '#8e889b');
  const y = f ? 0 : 1;
  p.ell(16, -1 + y + 2, 3, 4, '#7ae0ff'); p.px(16, 1 + y, '#ffffff');
}
function paintLamp(p, P, f) { p.rect(3, 6, 2, 18, '#3a3546'); p.rect(1, 2, 6, 5, '#3a3546'); p.rect(2, 3, 4, 3, f ? '#ffe28a' : '#ffd36b'); p.rect(1, 23, 6, 1, '#3a3546'); }
function paintBoard(p, P, f) { p.rect(1, 2, 14, 10, '#8a5a32'); p.rect(2, 3, 12, 8, '#c9a35a'); p.rect(3, 4, 5, 3, '#f2e6c9'); p.rect(9, 5, 4, 4, '#f2e6c9'); p.rect(3, 12, 2, 6, '#6b4a2b'); p.rect(11, 12, 2, 6, '#6b4a2b'); }
function paintChest(p, P, f) {
  if (!f) {
    p.rect(1, 4, 14, 9, '#8a5a32'); p.rect(1, 4, 14, 3, '#a8743a'); p.rect(1, 7, 14, 1, '#5e3b22');
    p.rect(7, 6, 2, 3, '#ffd36b'); p.rect(1, 4, 1, 9, '#c9a35a'); p.rect(14, 4, 1, 9, '#c9a35a');
  } else {
    p.rect(1, 7, 14, 6, '#8a5a32'); p.rect(1, 2, 14, 3, '#5e3b22'); p.rect(2, 5, 12, 2, '#1a0f0a'); p.rect(1, 7, 14, 1, '#a8743a');
  }
}
function paintPillar(theme) {
  return (p, P, f) => {
    if (theme === 'moss') {
      p.rect(2, 4, 12, 20, '#7d8a6b'); p.rect(10, 4, 4, 20, '#5b6b4f'); p.rect(1, 1, 14, 4, '#93a07f'); p.rect(1, 22, 14, 3, '#5b6b4f');
      p.rect(2, 6, 3, 9, '#5aa04a'); p.rect(3, 15, 2, 4, '#4a8a3c'); p.px(11, 9, '#5aa04a'); p.px(12, 10, '#5aa04a');
    } else if (theme === 'cinder') {
      p.rect(2, 4, 12, 20, '#2e2328'); p.rect(10, 4, 4, 20, '#1e1416'); p.rect(1, 1, 14, 4, '#45313a'); p.rect(1, 22, 14, 3, '#1e1416');
      p.line(6, 6, 8, 12, '#ff7a1a'); p.line(8, 12, 6, 18, '#ff7a1a'); p.px(7, 9, '#ffd36b');
    } else {
      p.ell(8, 22, 7, 3, '#3b3470');
      p.rect(5, 4, 6, 19, '#7ae0ff'); p.rect(8, 4, 3, 19, '#4f7bd8'); p.rect(6, 1, 4, 3, '#7ae0ff'); p.px(7, 0, '#effbff');
      p.rect(1, 12, 4, 10, '#b46cff'); p.rect(2, 9, 2, 3, '#b46cff'); p.rect(11, 14, 4, 8, '#7ae0ff'); p.rect(12, 11, 2, 3, '#7ae0ff');
      p.line(6, 6, 6, 20, '#effbff');
    }
  };
}

// Items (12x12 icons). color = main color for the item's look
function paintIcon(kind, col, col2) {
  return (p) => {
    switch (kind) {
      case 'sword': p.line(2, 10, 9, 3, col); p.line(3, 10, 10, 3, col2); p.line(1, 7, 5, 11, '#8a5a32'); p.px(1, 11, '#ffd36b'); p.px(10, 2, '#ffffff'); break;
      case 'staff': p.line(2, 11, 8, 4, '#8a5a32'); p.line(3, 11, 9, 4, '#6b4a2b'); p.circ(9, 3, 2.2, col); p.px(9, 2, '#ffffff'); break;
      case 'bow': for (let i = 0; i <= 10; i++) { const a = -1.2 + (2.4 * i) / 10; p.px(5 + Math.cos(a) * 5, 6 + Math.sin(a) * 5, col); } p.line(6, 1, 6, 11, '#e8e8f0'); p.line(2, 6, 10, 6, col2); p.px(10, 6, '#ffffff'); break;
      case 'lantern': p.rect(4, 3, 5, 7, '#3a3546'); p.rect(5, 4, 3, 5, col); p.px(6, 6, '#ffffff'); p.rect(5, 1, 3, 2, '#3a3546'); p.rect(4, 10, 5, 1, '#3a3546'); break;
      case 'helm': p.ell(6, 6, 4.5, 4, col); p.rect(2, 6, 9, 4, col); p.rect(4, 7, 5, 1, '#1b1b2b'); p.rect(3, 2, 3, 1, col2); break;
      case 'armor': p.rect(2, 2, 8, 8, col); p.rect(1, 2, 2, 4, col2); p.rect(9, 2, 2, 4, col2); p.rect(4, 2, 4, 2, '#1b1b2b'); p.rect(3, 6, 6, 1, col2); break;
      case 'ring': p.circ(6, 7, 3.5, col); p.circ(6, 7, 2, null); p.px(6, 7, null); p.rect(5, 2, 3, 2, col2); p.px(6, 2, '#ffffff'); break;
      case 'relic': p.line(3, 1, 6, 4, '#c9a35a'); p.line(9, 1, 6, 4, '#c9a35a'); p.circ(6, 7, 3.5, col); p.circ(6, 7, 1.8, col2); p.px(5, 6, '#ffffff'); break;
      case 'potion': p.rect(5, 1, 2, 2, '#c9a35a'); p.rect(4, 3, 4, 1, '#e8e8f0'); p.circ(6, 7, 3.5, col); p.px(5, 6, '#ffffff'); p.rect(4, 4, 4, 1, col); break;
      case 'scroll': p.rect(2, 3, 8, 7, '#f2e6c9'); p.rect(1, 2, 10, 2, '#c9a35a'); p.rect(1, 9, 10, 2, '#c9a35a'); p.rect(4, 5, 4, 1, col); p.rect(4, 7, 3, 1, col); break;
      case 'feather': p.line(2, 10, 9, 2, '#ffd36b'); p.line(3, 10, 10, 3, col); p.line(4, 9, 9, 4, col2); p.px(1, 11, '#c9a35a'); break;
      case 'gold': p.circ(6, 6, 3.5, '#ffd36b'); p.circ(6, 6, 2, '#e8a92a'); p.px(5, 5, '#fff3b0'); break;
    }
  };
}

// ───────────────────────── registry ─────────────────────────
const SPRITES = {};

function define(name, w, h, frames, painter, pal, anchor) {
  const list = [];
  for (let f = 0; f < frames; f++) {
    const pix = new Pix(w, h);
    painter(pix, pal, f);
    list.push(bake(pix));
  }
  SPRITES[name] = { frames: list, w, h, ax: anchor ? anchor[0] : w / 2, ay: anchor ? anchor[1] : h - 2 };
}

const ENEMY_PAINTERS = {
  blob: [14, 13, paintBlob], spitter: [14, 16, paintSpitter], bat: [17, 12, paintBat], golem: [21, 21, paintGolem],
  shroom: [14, 14, paintShroom], shaman: [15, 18, paintShaman], sentinel: [15, 21, paintSentinel], boar: [19, 15, paintBoar],
  wisp: [11, 10, paintWisp],
};

let built = false;
export function buildSprites() {
  if (built) return;
  built = true;
  for (const k of ['vanguard', 'arcanist', 'ranger', 'warden', 'vendor'])
    define('hero_' + k, 16, 20, 4, (p, P, f) => paintHero(p, k, f), null, [8, 18]);
  for (const [pal, P] of Object.entries(PAL))
    for (const [name, [w, h, fn]] of Object.entries(ENEMY_PAINTERS)) define(`${name}_${pal}`, w, h, 2, fn, P);
  define('lumenClone', 20, 24, 2, paintClone, PAL.prism);
  define('wolf', 20, 14, 2, paintWolf, null, [10, 12]);
  define('bramblemaw', 44, 42, 2, paintBramblemaw, PAL.moss, [22, 38]);
  define('kragmor', 30, 28, 2, paintKragHead, PAL.cinder, [15, 22]);
  define('kragseg', 20, 20, 1, paintKragSeg, PAL.cinder, [10, 14]);
  define('lumen', 37, 44, 2, paintLumen, PAL.prism, [18, 40]);
  define('dummy', 16, 21, 1, paintDummy, null, [8, 19]);
  define('tree', 24, 30, 1, paintTree, null, [12, 28]);
  define('fountain', 32, 27, 2, paintFountain, null, [16, 24]);
  define('stall', 80, 23, 1, paintStall, null, [0, 15]);
  define('fence', 16, 11, 1, paintFence, null, [0, 8]);
  define('fencev', 16, 16, 1, paintFenceV, null, [0, 12]);
  define('statue', 32, 31, 2, paintStatue, null, [16, 26]);
  define('lamp', 8, 25, 2, paintLamp, null, [4, 24]);
  define('board', 16, 19, 1, paintBoard, null, [8, 17]);
  define('chest', 16, 14, 2, paintChest, null, [8, 12]);
  for (const t of ['moss', 'cinder', 'prism']) define('pillar_' + t, 16, 26, 1, paintPillar(t), null, [8, 22]);
}

export function sprite(name) { return SPRITES[name]; }

// Draw a sprite with its anchor at (x, y) in world/screen space.
export function drawSprite(ctx, name, frame, x, y, opts = {}) {
  const s = SPRITES[name];
  if (!s) return;
  let c = s.frames[frame % s.frames.length];
  if (opts.flash) c = flashed(c);
  else if (opts.tint) c = tinted(c, opts.tint);
  if (opts.flip) c = flipped(c);
  const scale = opts.scale || 1;
  const ax = opts.flip ? s.w - s.ax : s.ax;
  if (opts.alpha != null) ctx.globalAlpha = opts.alpha;
  if (scale === 1) ctx.drawImage(c, Math.round(x - ax), Math.round(y - s.ay));
  else ctx.drawImage(c, Math.round(x - ax * scale), Math.round(y - s.ay * scale), Math.round(s.w * scale), Math.round(s.h * scale));
  if (opts.alpha != null) ctx.globalAlpha = 1;
}

// Item icons, cached per base item
const iconCache = new Map();
const ICON_FOR = {
  vanguard: 'sword', arcanist: 'staff', ranger: 'bow', warden: 'lantern',
};
export function iconKind(base) {
  if (base.slot === 'weapon') return ICON_FOR[base.cls];
  if (base.slot === 'consumable') {
    if (base.use === 'return') return 'scroll';
    if (base.use === 'passive') return 'feather';
    return 'potion';
  }
  return base.slot;
}
const STYLE_COL = {
  steel: ['#c9d1e0', '#8e97a8'], moss: ['#6dbb4f', '#3f7f3a'], fire: ['#ff7a3a', '#ffd36b'], crystal: ['#7ae0ff', '#b46cff'],
  gold: ['#ffd36b', '#ffa630'], arcane: ['#7a9cff', '#c9d6ff'], nature: ['#6dbb4f', '#d4ec7a'], arrow: ['#c9a35a', '#e8e8f0'],
  firearrow: ['#ff7a3a', '#ffd36b'], crystalarrow: ['#7ae0ff', '#effbff'], spirit: ['#b46cff', '#7ae0ff'],
};
export function itemIcon(base, rarityColor) {
  const key = base.id;
  let c = iconCache.get(key);
  if (c) return c;
  let col = rarityColor, col2 = '#ffffff';
  if (base.weapon) [col, col2] = STYLE_COL[base.weapon.style] || [rarityColor, '#ffffff'];
  if (base.use === 'heal') col = '#ff4f5e';
  if (base.use === 'mana') col = '#4f8bff';
  if (base.use === 'fury') col = '#ffa630';
  if (base.use === 'swift') col = '#5fd068';
  if (base.slot === 'consumable' && base.use === 'return') col = '#4f8bff';
  if (base.slot === 'consumable' && base.use === 'passive') { col = '#ff7a3a'; col2 = '#ffd36b'; }
  if (['helm', 'armor', 'ring', 'relic'].includes(base.slot)) col2 = shade(rarityColor);
  const pix = new Pix(12, 12);
  paintIcon(iconKind(base), col, col2)(pix);
  c = bake(pix);
  iconCache.set(key, c);
  return c;
}
export function goldIcon() {
  if (!iconCache.has('$gold')) { const pix = new Pix(12, 12); paintIcon('gold')(pix); iconCache.set('$gold', bake(pix)); }
  return iconCache.get('$gold');
}
function shade(hex) {
  const n = parseInt(hex.slice(1), 16);
  const r = Math.max(0, (n >> 16) - 50), g = Math.max(0, ((n >> 8) & 255) - 50), b = Math.max(0, (n & 255) - 50);
  return '#' + ((r << 16) | (g << 8) | b).toString(16).padStart(6, '0');
}

// Weapon held in hand, drawn rotated toward the aim. Returns a cached small canvas pointing right.
const weaponCache = new Map();
export function weaponSprite(cls, style) {
  const key = cls + style;
  if (weaponCache.has(key)) return weaponCache.get(key);
  const [col, col2] = STYLE_COL[style] || ['#c9d1e0', '#ffffff'];
  let pix;
  if (cls === 'vanguard') { pix = new Pix(16, 5); pix.rect(0, 2, 3, 1, '#8a5a32'); pix.rect(3, 0, 1, 5, '#ffd36b'); pix.rect(4, 1, 10, 3, col); pix.rect(4, 2, 11, 1, col2); pix.px(15, 2, col2); }
  else if (cls === 'arcanist') { pix = new Pix(16, 6); pix.rect(0, 2, 12, 2, '#8a5a32'); pix.circ(13, 3, 2.3, col); pix.px(13, 2, '#ffffff'); }
  else if (cls === 'ranger') { pix = new Pix(7, 15); for (let i = 0; i <= 12; i++) { const a = -1.2 + (2.4 * i) / 12; pix.px(1 + Math.cos(a) * 5, 7 + Math.sin(a) * 6.5, col); } pix.line(1, 1, 1, 13, '#e8e8f0'); }
  else { pix = new Pix(9, 10); pix.rect(0, 4, 3, 1, '#3a3546'); pix.rect(3, 2, 5, 7, '#3a3546'); pix.rect(4, 3, 3, 5, col); pix.px(5, 5, '#ffffff'); pix.rect(4, 0, 3, 2, '#3a3546'); }
  const c = bake(pix);
  weaponCache.set(key, c);
  return c;
}

// Tiny 3x5 bitmap font for floating damage numbers (crisp at low resolution).
const DIGITS = {
  '0': '111101101101111', '1': '010110010010111', '2': '111001111100111', '3': '111001111001111', '4': '101101111001001',
  '5': '111100111001111', '6': '111100111101111', '7': '111001010010010', '8': '111101111101111', '9': '111101111001111',
  '+': '000010111010000', '-': '000000111000000', '!': '010010010000010', ' ': '000000000000000', '.': '000000000000010',
  ':': '000010000010000', '/': '001001010100100', "'": '010010000000000', '%': '101001010100101', '?': '110001010000010',
  A: '010101111101101', B: '110101110101110', C: '011100100100011', D: '110101101101110', E: '111100110100111',
  F: '111100110100100', G: '011100101101011', H: '101101111101101', I: '111010010010111', J: '001001001101010',
  K: '101101110101101', L: '100100100100111', M: '101111111101101', N: '110101101101101', O: '010101101101010',
  P: '110101110100100', Q: '010101101110011', R: '110101110101101', S: '011100010001110', T: '111010010010010',
  U: '101101101101111', V: '101101101101010', W: '101101111111101', X: '101101010101101', Y: '101101010010010',
  Z: '111001010100111',
};
export function drawNumber(ctx, text, x, y, color, scale = 1) {
  const s = String(text).toUpperCase();
  const w = s.length * 4 * scale - scale;
  let cx = Math.round(x - w / 2), cy = Math.round(y);
  for (const pass of [0, 1]) {
    let px = cx;
    for (const ch of s) {
      const g = DIGITS[ch];
      if (g) {
        for (let i = 0; i < 15; i++) {
          if (g[i] !== '1') continue;
          const gx = (i % 3) * scale, gy = Math.floor(i / 3) * scale;
          if (pass === 0) { ctx.fillStyle = OUTLINE; ctx.fillRect(px + gx - 1, cy + gy - 1, scale + 2, scale + 2); }
          else { ctx.fillStyle = color; ctx.fillRect(px + gx, cy + gy, scale, scale); }
        }
      }
      px += 4 * scale;
    }
  }
}

// Ability icons (12x12) for the HUD
const ABILITY_ICON = {
  bulwark: (p) => { p.rect(3, 2, 6, 7, '#ffd36b'); p.rect(4, 9, 4, 1, '#ffd36b'); p.rect(5, 10, 2, 1, '#ffd36b'); p.rect(5, 3, 2, 5, '#c9853a'); },
  whirlwind: (p) => { for (let i = 0; i < 14; i++) { const a = i * 0.55, r = 1 + i * 0.32; p.px(6 + Math.cos(a) * r, 6 + Math.sin(a) * r, i % 2 ? '#e8eef8' : '#9aa3b5'); } },
  leap: (p) => { p.line(2, 10, 6, 3, '#ffd36b'); p.line(6, 3, 10, 10, '#ffd36b'); p.rect(1, 10, 11, 1, '#c9d1e0'); p.px(6, 2, '#ffffff'); },
  frostNova: (p) => { p.line(6, 1, 6, 11, '#9fe6ff'); p.line(1, 6, 11, 6, '#9fe6ff'); p.line(2, 2, 10, 10, '#ffffff'); p.line(10, 2, 2, 10, '#ffffff'); },
  arcaneOrb: (p) => { p.circ(6, 6, 4, '#b46cff'); p.circ(6, 6, 2, '#e6c9ff'); p.px(5, 5, '#ffffff'); },
  blink: (p) => { p.circ(3, 8, 2, '#7a9cff'); p.circ(9, 4, 2, '#ffffff'); p.line(4, 7, 8, 5, '#c9d6ff'); },
  volley: (p) => { for (const a of [-0.5, 0, 0.5]) p.line(2, 6, 2 + Math.cos(a) * 9, 6 + Math.sin(a) * 9, '#e8e8f0'); p.px(11, 6, '#ffffff'); },
  snareTrap: (p) => { p.rect(1, 8, 10, 2, '#8a5a32'); for (let x = 1; x < 11; x += 2) p.rect(x, 5, 1, 3, '#c9d1e0'); },
  rollShot: (p) => { p.circ(5, 6, 3.5, '#5fd068'); p.circ(5, 6, 1.5, null); p.line(7, 6, 11, 6, '#e8e8f0'); p.px(11, 5, '#ffffff'); },
  spiritWard: (p) => { for (let i = 0; i < 3; i++) { const a = i * 2.1; p.circ(6 + Math.cos(a) * 4, 6 + Math.sin(a) * 4, 1.6, '#c48bff'); } p.px(6, 6, '#ffffff'); },
  spiritWolf: (p) => { p.circ(6, 7, 3.5, '#9fc0ff'); p.line(3, 4, 3, 1, '#9fc0ff'); p.line(9, 4, 9, 1, '#9fc0ff'); p.px(5, 6, '#7ae0ff'); p.px(7, 6, '#7ae0ff'); },
  sanctuary: (p) => { p.ell(6, 8, 5, 2.5, '#7ae0ff'); p.rect(5, 2, 2, 6, '#effbff'); p.rect(3, 4, 6, 2, '#effbff'); },
};
const abilityCache = new Map();
export function abilityIcon(id) {
  if (!abilityCache.has(id)) {
    const pix = new Pix(12, 12);
    (ABILITY_ICON[id] || ABILITY_ICON.arcaneOrb)(pix);
    abilityCache.set(id, bake(pix));
  }
  return abilityCache.get(id);
}

// Data URL helper for DOM <img> icons
const urlCache = new WeakMap();
export function toURL(c) {
  if (!urlCache.has(c)) urlCache.set(c, c.toDataURL());
  return urlCache.get(c);
}
