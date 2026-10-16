// Procedural 16x16 tile textures per theme, plus the level pre-renderer.
import { T, TILE } from '../config.js';
import { mulberry32 } from '../util.js';

export const THEMES = {
  hub: {
    bg: '#1a2a1a', floor: ['#5a9e4b', '#539445', '#62a853'], speck: ['#6fb85d', '#4a8a3e', '#79c266'],
    path: ['#a39b8b', '#958d7e', '#aea697'], pathLine: '#7a7365',
    wallTop: '#3d3a4a', wallFace: '#6b6577', wallLine: '#4f4a5c', wallHi: '#8e889b',
    hazard: ['#7a3b5a'], water: ['#3d7fc4', '#4f8fd2', '#6ea8e0'],
    deco: ['grass', 'flower', 'pebble', 'flower2'], dark: 0, ambient: null,
  },
  moss: {
    bg: '#0f170f', floor: ['#4d6b3c', '#486538', '#527242'], speck: ['#5f8048', '#3e5a30', '#6b8f52'],
    path: ['#4d6b3c'], pathLine: '#3e5a30',
    wallTop: '#22301d', wallFace: '#56634a', wallLine: '#3e4a35', wallHi: '#6f7d60', moss: '#5aa04a',
    hazard: ['#5a2e45', '#7a3b5a', '#a04a6a'], water: ['#2f5f6b', '#3d7380', '#4f8a96'],
    deco: ['grass', 'flower', 'pebble', 'mushroom'], dark: 0.18, ambient: '#0a1408',
  },
  cinder: {
    bg: '#0d0607', floor: ['#3b2a2e', '#36262a', '#413034'], speck: ['#4a3539', '#2e2023', '#5a3a2a'],
    path: ['#3b2a2e'], pathLine: '#2e2023',
    wallTop: '#170e10', wallFace: '#4a2e2e', wallLine: '#331f20', wallHi: '#5e3b3b', vein: '#ff7a1a',
    hazard: ['#d9480f', '#ff7a1a', '#ffb02e'], water: ['#d9480f', '#ff7a1a', '#ffb02e'],
    deco: ['bone', 'ember', 'crack', 'ash'], dark: 0.42, ambient: '#120404',
  },
  prism: {
    bg: '#07061a', floor: ['#2a2547', '#262142', '#2e294d'], speck: ['#3a3466', '#211c3b', '#463f7a'],
    path: ['#2a2547'], pathLine: '#211c3b',
    wallTop: '#110e24', wallFace: '#36306a', wallLine: '#272254', wallHi: '#4a429a', vein: '#7ae0ff',
    hazard: ['#ff7ae6', '#c94fd8', '#ffb3f2'], water: ['#3b3470'],
    deco: ['crystal', 'sparkle', 'crystal2', 'pebble'], dark: 0.62, ambient: '#04030f',
  },
};

function canvas(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }

// Builds texture variants for a theme. Deterministic per theme.
export function buildTiles(themeId) {
  const th = THEMES[themeId];
  const rnd = mulberry32(themeId.length * 977 + 13);
  const tiles = { floor: [], path: [], face: [], top: null, crack: null, deco: [], hazard: [], water: [] };
  for (let v = 0; v < 4; v++) {
    const c = canvas(TILE, TILE), x = c.getContext('2d');
    x.fillStyle = th.floor[v % th.floor.length]; x.fillRect(0, 0, TILE, TILE);
    for (let i = 0; i < 18; i++) { x.fillStyle = th.speck[Math.floor(rnd() * th.speck.length)]; x.fillRect(Math.floor(rnd() * 16), Math.floor(rnd() * 16), 1 + (rnd() < 0.2 ? 1 : 0), 1); }
    if (themeId !== 'hub') { // stone slab seams
      x.fillStyle = th.speck[1];
      if (v === 0) { x.fillRect(0, 15, 16, 1); x.fillRect(15, 0, 1, 16); }
    }
    if (themeId === 'moss' && v === 3) { x.fillStyle = th.moss; for (let i = 0; i < 10; i++) x.fillRect(Math.floor(rnd() * 14), Math.floor(rnd() * 14), 2, 1); }
    if (themeId === 'cinder' && v === 2) { x.fillStyle = '#ff7a1a'; x.fillRect(4, 6, 1, 1); x.fillRect(11, 12, 1, 1); }
    if (themeId === 'prism' && v === 1) { x.fillStyle = '#7ae0ff'; x.fillRect(5, 9, 1, 1); x.fillStyle = '#b46cff'; x.fillRect(12, 3, 1, 1); }
    tiles.floor.push(c);
  }
  for (let v = 0; v < 3; v++) {
    const c = canvas(TILE, TILE), x = c.getContext('2d');
    x.fillStyle = th.path[0]; x.fillRect(0, 0, TILE, TILE);
    x.fillStyle = th.pathLine;
    // cobblestones
    const off = v * 3;
    for (let row = 0; row < 4; row++) {
      x.fillRect(0, row * 4 + 3, 16, 1);
      for (let k = 0; k < 3; k++) x.fillRect(((k * 6 + row * 3 + off) % 16), row * 4, 1, 3);
    }
    x.fillStyle = th.path[1] || th.path[0]; x.fillRect(2 + v, 1, 2, 1); x.fillRect(9, 9, 2, 1);
    tiles.path.push(c);
  }
  // wall top
  {
    const c = canvas(TILE, TILE), x = c.getContext('2d');
    x.fillStyle = th.wallTop; x.fillRect(0, 0, TILE, TILE);
    x.fillStyle = th.wallLine; for (let i = 0; i < 6; i++) x.fillRect(Math.floor(rnd() * 15), Math.floor(rnd() * 15), 1, 1);
    tiles.top = c;
  }
  // wall faces (brick) with variants
  for (let v = 0; v < 3; v++) {
    const c = canvas(TILE, TILE), x = c.getContext('2d');
    x.fillStyle = th.wallFace; x.fillRect(0, 0, TILE, TILE);
    x.fillStyle = th.wallHi; x.fillRect(0, 0, 16, 1);
    x.fillStyle = th.wallLine;
    for (let row = 0; row < 4; row++) {
      x.fillRect(0, row * 4 + 3, 16, 1);
      const o = row % 2 ? 4 : 0;
      x.fillRect(o, row * 4, 1, 3); x.fillRect(o + 8, row * 4, 1, 3);
    }
    x.fillStyle = 'rgba(0,0,0,0.25)'; x.fillRect(0, 13, 16, 3);
    if (th.moss && v === 1) { x.fillStyle = th.moss; x.fillRect(2, 0, 5, 2); x.fillRect(3, 2, 2, 3); x.fillRect(11, 0, 3, 1); }
    if (th.vein && v === 2) { x.fillStyle = th.vein; x.fillRect(6, 2, 1, 4); x.fillRect(7, 5, 1, 4); x.fillRect(8, 8, 1, 3); }
    tiles.face.push(c);
  }
  // breakable crack wall
  {
    const c = canvas(TILE, TILE), x = c.getContext('2d');
    x.drawImage(tiles.face[0], 0, 0);
    x.fillStyle = '#0a0710';
    for (const [a, b] of [[7, 1], [8, 2], [8, 3], [7, 4], [6, 5], [7, 6], [9, 6], [10, 7], [7, 7], [8, 8], [8, 9], [9, 10], [7, 11], [6, 12]]) x.fillRect(a, b, 1, 1);
    x.fillStyle = 'rgba(255,255,255,0.18)'; x.fillRect(9, 3, 1, 1); x.fillRect(5, 9, 1, 1);
    tiles.crack = c;
  }
  // decorations (transparent overlays)
  for (const kind of th.deco) {
    const c = canvas(TILE, TILE), x = c.getContext('2d');
    const P = (px, py, col) => { x.fillStyle = col; x.fillRect(px, py, 1, 1); };
    const ox = 3 + Math.floor(rnd() * 8), oy = 4 + Math.floor(rnd() * 8);
    switch (kind) {
      case 'grass': for (const [a, b] of [[0, 2], [1, 0], [1, 1], [2, 2], [3, 1], [4, 2]]) P(ox + a, oy + b, '#3f7f3a'); P(ox + 1, oy, '#7fcf6a'); break;
      case 'flower': P(ox, oy, '#ff5d73'); P(ox + 1, oy + 1, '#ffd36b'); P(ox + 2, oy, '#ff5d73'); P(ox + 1, oy - 1, '#ff5d73'); P(ox + 1, oy + 2, '#3f7f3a'); break;
      case 'flower2': P(ox, oy, '#f2e6c9'); P(ox + 1, oy, '#ffd36b'); P(ox + 2, oy, '#f2e6c9'); P(ox + 1, oy + 1, '#3f7f3a'); P(ox + 5, oy + 3, '#7a9cff'); break;
      case 'pebble': P(ox, oy, '#8e889b'); P(ox + 1, oy, '#6b6577'); P(ox + 4, oy + 2, '#8e889b'); break;
      case 'mushroom': P(ox, oy, '#ff5d73'); P(ox + 1, oy, '#ff5d73'); P(ox - 1, oy, '#ff5d73'); P(ox, oy + 1, '#f2e6c9'); P(ox, oy - 1, '#ffd0d6'); break;
      case 'bone': x.fillStyle = '#d9cfb8'; x.fillRect(ox, oy, 4, 1); P(ox - 1, oy - 1, '#d9cfb8'); P(ox + 4, oy + 1, '#d9cfb8'); break;
      case 'ember': P(ox, oy, '#ff7a1a'); P(ox + 3, oy + 2, '#ffb02e'); P(ox + 1, oy + 4, '#d9480f'); break;
      case 'crack': x.fillStyle = '#1e1416'; for (let i = 0; i < 6; i++) x.fillRect(ox + i, oy + (i % 2), 1, 1); break;
      case 'ash': P(ox, oy, '#5a4a4a'); P(ox + 2, oy + 1, '#4a3a3a'); P(ox + 1, oy + 3, '#5a4a4a'); break;
      case 'crystal': x.fillStyle = '#7ae0ff'; x.fillRect(ox, oy - 2, 1, 3); x.fillRect(ox + 1, oy - 1, 1, 2); P(ox, oy - 3, '#effbff'); break;
      case 'crystal2': x.fillStyle = '#b46cff'; x.fillRect(ox, oy - 1, 1, 2); x.fillRect(ox + 1, oy - 2, 1, 3); P(ox + 1, oy - 3, '#e6c9ff'); break;
      case 'sparkle': P(ox, oy, '#effbff'); P(ox + 6, oy + 3, '#7ae0ff'); break;
    }
    tiles.deco.push(c);
  }
  // hazard frames (animated)
  for (let f = 0; f < 4; f++) {
    const c = canvas(TILE, TILE), x = c.getContext('2d');
    const r2 = mulberry32(f * 31 + 7);
    if (themeId === 'cinder') {
      x.fillStyle = th.hazard[0]; x.fillRect(0, 0, 16, 16);
      x.fillStyle = th.hazard[1];
      for (let i = 0; i < 5; i++) { const yy = (i * 4 + f) % 16; x.fillRect((i * 7 + f * 2) % 13, yy, 4, 2); }
      x.fillStyle = th.hazard[2]; for (let i = 0; i < 3; i++) x.fillRect(Math.floor(r2() * 15), Math.floor(r2() * 15), 1, 1);
    } else if (themeId === 'prism') {
      x.fillStyle = th.floor[0]; x.fillRect(0, 0, 16, 16);
      x.fillStyle = th.hazard[f % 2 ? 0 : 1];
      for (const [a, b] of [[1, 8], [2, 7], [3, 7], [4, 8], [5, 9], [6, 8], [7, 7], [8, 6], [9, 6], [10, 7], [11, 8], [12, 8], [13, 7], [14, 8]]) x.fillRect(a, b, 1, 2);
      x.fillStyle = th.hazard[2]; x.fillRect(4 + f * 2, 8, 1, 1);
    } else {
      // thorns
      x.fillStyle = th.floor[0]; x.fillRect(0, 0, 16, 16);
      x.fillStyle = th.hazard[0]; x.fillRect(0, 10, 16, 6);
      x.fillStyle = th.hazard[1];
      for (let i = 0; i < 5; i++) { const bx = i * 3 + 1, h = 4 + ((i + f) % 3); x.fillRect(bx, 14 - h, 1, h); x.fillRect(bx + 1, 15 - h + 2, 1, h - 2); }
      x.fillStyle = th.hazard[2]; x.fillRect(4, 6 + (f % 2), 1, 1); x.fillRect(10, 7, 1, 1);
    }
    tiles.hazard.push(c);
  }
  // water frames
  for (let f = 0; f < 4; f++) {
    const c = canvas(TILE, TILE), x = c.getContext('2d');
    x.fillStyle = th.water[0]; x.fillRect(0, 0, 16, 16);
    x.fillStyle = th.water[1] || th.water[0];
    x.fillRect((f * 4) % 16, 4, 5, 1); x.fillRect((f * 4 + 8) % 16, 11, 4, 1);
    x.fillStyle = th.water[2] || th.water[0];
    x.fillRect((f * 4 + 3) % 16, 4, 2, 1);
    tiles.water.push(c);
  }
  return tiles;
}

const isWallish = (v) => v === T.WALL || v === T.VOID;

// Pre-render the static part of a level to one big canvas.
export function renderLevel(map, themeId) {
  const tiles = buildTiles(themeId);
  const th = THEMES[themeId];
  const c = canvas(map.w * TILE, map.h * TILE);
  const ctx = c.getContext('2d');
  ctx.fillStyle = th.bg;
  ctx.fillRect(0, 0, c.width, c.height);
  for (let y = 0; y < map.h; y++) for (let x = 0; x < map.w; x++) drawTile(ctx, map, tiles, th, x, y);
  return { canvas: c, tiles, theme: th };
}

export function drawTile(ctx, map, tiles, th, x, y) {
  const v = map.get(x, y);
  const px = x * TILE, py = y * TILE;
  const hash = (x * 73856093) ^ (y * 19349663);
  ctx.fillStyle = th.bg;
  ctx.fillRect(px, py, TILE, TILE);
  if (v === T.VOID) return;
  if (v === T.WALL) {
    const below = map.get(x, y + 1);
    if (!isWallish(below)) ctx.drawImage(tiles.face[Math.abs(hash) % 3], px, py);
    else {
      ctx.drawImage(tiles.top, px, py);
      // rim highlight where the top meets open ground
      ctx.fillStyle = th.wallHi;
      if (!isWallish(map.get(x, y - 1))) ctx.fillRect(px, py, TILE, 1);
      if (!isWallish(map.get(x - 1, y))) ctx.fillRect(px, py, 1, TILE);
      if (!isWallish(map.get(x + 1, y))) ctx.fillRect(px + TILE - 1, py, 1, TILE);
    }
    return;
  }
  if (v === T.CRACK) { ctx.drawImage(tiles.crack, px, py); return; }
  if (v === T.WATER) { ctx.drawImage(tiles.water[0], px, py); return; }
  if (v === T.PATH) ctx.drawImage(tiles.path[Math.abs(hash) % tiles.path.length], px, py);
  else ctx.drawImage(tiles.floor[Math.abs(hash >> 3) % 4], px, py);
  if (v === T.HAZARD) ctx.drawImage(tiles.hazard[0], px, py);
  const d = map.deco[map.idx(x, y)];
  if (d && v !== T.HAZARD && tiles.deco[d - 1]) ctx.drawImage(tiles.deco[d - 1], px, py);
  // contact shadows under walls
  ctx.fillStyle = 'rgba(0,0,0,0.28)';
  if (isWallish(map.get(x, y - 1))) ctx.fillRect(px, py, TILE, 4);
  if (isWallish(map.get(x - 1, y))) ctx.fillRect(px, py, 2, TILE);
}
