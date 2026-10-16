// Open world generator: the town in the middle, biome rings that get harder further out,
// roads, lakes, lava rivers, rift cracks, forests, and a mini-boss lair per biome.
// Pure (no DOM) so connectivity is unit tested.
import { T } from '../config.js';
import { TileMap, floodReachable } from './tilemap.js';
import { buildHub, HUB_W, HUB_H } from './hub.js';
import { BIOMES } from '../content/regions.js';
import { RNG, mulberry32 } from '../util.js';

export const WORLD = 232;
export const THEME_IDS = ['mossW', 'cinderW', 'prismW', 'frostW', 'hub'];
export const TOWN_BIOME = 4;
const MINI_FOR_REGION = ['gnarl', 'pyrewing', 'geode', 'rimefang'];

function makeNoise(seed) {
  const rnd = mulberry32(seed);
  const perm = new Uint8Array(512), vals = new Float32Array(256);
  for (let i = 0; i < 256; i++) { perm[i] = i; vals[i] = rnd(); }
  for (let i = 255; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [perm[i], perm[j]] = [perm[j], perm[i]]; }
  for (let i = 0; i < 256; i++) perm[i + 256] = perm[i];
  const v = (x, y) => vals[perm[(perm[x & 255] + y) & 255]];
  const s = (t) => t * t * (3 - 2 * t);
  const n = (x, y) => {
    const xi = Math.floor(x), yi = Math.floor(y), xf = s(x - xi), yf = s(y - yi);
    const a = v(xi, yi), b = v(xi + 1, yi), c = v(xi, yi + 1), d = v(xi + 1, yi + 1);
    return a + (b - a) * xf + (c - a) * yf + (a - b - c + d) * xf * yf;
  };
  return (x, y) => n(x, y) * 0.65 + n(x * 2.1 + 31, y * 2.1 + 17) * 0.35;
}

export function generateWorld(seed) {
  const rng = new RNG(seed);
  const map = new TileMap(WORLD, WORLD, T.FLOOR);
  map.biome = new Uint8Array(WORLD * WORLD);
  map.shotsPassProps = true;
  const cx = WORLD / 2, cy = WORLD / 2;
  const warp = makeNoise(seed + 1), terr = makeNoise(seed + 2), feat = makeNoise(seed + 3);
  const R = WORLD / 2 - 4;

  // biome + outer mountains
  for (let y = 0; y < WORLD; y++)
    for (let x = 0; x < WORLD; x++) {
      const i = map.idx(x, y);
      const d = Math.hypot(x - cx, y - cy);
      const dw = d + (warp(x * 0.05, y * 0.05) - 0.5) * 26;
      let b = 0;
      while (b < BIOMES.length - 1 && dw >= BIOMES[b].until) b++;
      map.biome[i] = BIOMES[b].region;
      if (d + (warp(x * 0.09 + 9, y * 0.09) - 0.5) * 10 > R) map.t[i] = T.WALL;
    }

  // terrain features per biome
  for (let y = 1; y < WORLD - 1; y++)
    for (let x = 1; x < WORLD - 1; x++) {
      const i = map.idx(x, y);
      if (map.t[i] !== T.FLOOR) continue;
      const b = map.biome[i];
      const n = terr(x * 0.07, y * 0.07), f = feat(x * 0.11, y * 0.11), r = rng.next();
      if (b === 0) {
        if (n > 0.74) map.t[i] = T.WATER;
        else if (f > 0.8 && r < 0.5) map.t[i] = T.HAZARD;
        else if (r < 0.035 + (f > 0.6 ? 0.05 : 0)) map.t[i] = T.PILLAR;
      } else if (b === 1) {
        if (Math.abs(n - 0.5) < 0.035) map.t[i] = T.HAZARD;      // lava rivers
        else if (f > 0.82) map.t[i] = T.HAZARD;                  // lava pools
        else if (r < 0.025) map.t[i] = T.PILLAR;
      } else if (b === 2) {
        if (Math.abs(n - 0.5) < 0.022) map.t[i] = T.HAZARD;      // rift cracks
        else if (r < 0.03 + (f > 0.7 ? 0.05 : 0)) map.t[i] = T.PILLAR;
      } else {
        if (f > 0.82 && r < 0.6) map.t[i] = T.HAZARD;            // black ice
        else if (n > 0.78) map.t[i] = T.WATER;                   // frozen-over chasms
        else if (r < 0.032) map.t[i] = T.PILLAR;
      }
      if (rng.chance(0.08)) map.deco[i] = rng.int(1, 4);
    }

  // stamp the town
  const hub = buildHub(new RNG(7));
  const ox = Math.floor(cx - HUB_W / 2), oy = Math.floor(cy - HUB_H / 2);
  for (let y = 0; y < HUB_H; y++)
    for (let x = 0; x < HUB_W; x++) {
      const i = map.idx(ox + x, oy + y);
      map.t[i] = hub.map.get(x, y);
      map.deco[i] = hub.map.deco[hub.map.idx(x, y)];
      map.biome[i] = TOWN_BIOME;
    }
  // clear a ring of grass around the town
  for (let y = oy - 4; y < oy + HUB_H + 4; y++)
    for (let x = ox - 4; x < ox + HUB_W + 4; x++) {
      const i = map.idx(x, y);
      if (map.biome[i] === TOWN_BIOME) continue;
      map.t[i] = T.FLOOR;
      map.biome[i] = 0;
    }

  // town gates + roads out into the world
  const roads = [];
  const gate = (gx, gy, dx, dy) => {
    for (let k = -1; k <= 1; k++) {
      const x = dx ? gx : gx + k, y = dy ? gy : gy + k;
      map.set(x, y, T.PATH);
      // remove any town tree blocking the gate
      for (let s = 1; s <= 3; s++) map.set(x - dx * s, y - dy * s, map.get(x - dx * s, y - dy * s) === T.PILLAR ? T.FLOOR : map.get(x - dx * s, y - dy * s));
    }
    let x = gx, y = gy, len = 0;
    while (len < 115) {
      x += dx; y += dy; len++;
      if (map.get(x, y) === T.WALL || !map.inBounds(x, y)) break;
      for (let k = -1; k <= 1; k++) {
        const tx = dx ? x : x + k, ty = dy ? y : y + k;
        if (map.biome[map.idx(tx, ty)] === TOWN_BIOME) continue;
        map.set(tx, ty, T.PATH);
        roads.push([tx, ty]);
      }
      // gentle wiggle
      if (len % 9 === 0) { if (dx) y += rng.int(-1, 1); else x += rng.int(-1, 1); }
    }
  };
  const midX = ox + Math.floor(HUB_W / 2), midY = oy + Math.floor(HUB_H / 2);
  gate(ox + HUB_W - 1, midY + 0, 1, 0);
  gate(ox, midY, -1, 0);
  gate(midX, oy + HUB_H - 1, 0, 1);
  gate(midX + 6, oy, 0, -1);

  // connectivity: anything unreachable from town becomes forest/rock
  const startX = ox + hub.spawn.tx, startY = oy + hub.spawn.ty;
  const seen = floodReachable(map, startX, startY);
  for (let i = 0; i < map.t.length; i++) {
    const v = map.t[i];
    if (!seen[i] && (v === T.FLOOR || v === T.PATH || v === T.HAZARD)) map.t[i] = T.PILLAR;
  }

  // props for every obstacle tile (trees, obsidian, crystals, frozen pines); town props come from the hub
  const props = [];
  const KIND = ['tree', 'pillar_cinder', 'pillar_prism', 'icetree'];
  for (let y = 0; y < WORLD; y++)
    for (let x = 0; x < WORLD; x++) {
      const i = map.idx(x, y);
      if (map.t[i] !== T.PILLAR || map.biome[i] === TOWN_BIOME) continue;
      props.push({ kind: KIND[map.biome[i]], tx: x, ty: y });
    }
  for (const p of hub.props) props.push({ ...p, tx: p.tx + ox, ty: p.ty + oy });
  const npcs = hub.npcs.map((n) => ({ ...n, tx: n.tx + ox, ty: n.ty + oy }));

  // mini-boss lairs: one per biome, mid-band, away from roads and town
  const lairs = [];
  for (let region = 0; region < 4; region++) {
    const lo = region === 0 ? 36 : BIOMES[region - 1].until + 6, hi = BIOMES[region].until === 999 ? R - 10 : BIOMES[region].until - 6;
    let best = null;
    for (let tries = 0; tries < 4000 && !best; tries++) {
      const a = rng.range(0, Math.PI * 2), d = rng.range(lo, hi);
      const x = Math.round(cx + Math.cos(a) * d), y = Math.round(cy + Math.sin(a) * d);
      if (!map.inBounds(x, y) || !seen[map.idx(x, y)] || map.biome[map.idx(x, y)] !== region) continue;
      if (map.get(x, y) !== T.FLOOR) continue;
      if (roads.some(([rx, ry]) => Math.abs(rx - x) + Math.abs(ry - y) < 14)) continue;
      best = { region, bossId: MINI_FOR_REGION[region], tx: x, ty: y };
    }
    if (best) {
      // clear an arena around the lair
      for (let yy = best.ty - 7; yy <= best.ty + 7; yy++)
        for (let xx = best.tx - 9; xx <= best.tx + 9; xx++) {
          if (!map.inBounds(xx, yy)) continue;
          const i = map.idx(xx, yy);
          if (map.t[i] === T.PILLAR || map.t[i] === T.HAZARD || map.t[i] === T.WATER) map.t[i] = T.FLOOR;
        }
      lairs.push(best);
    }
  }
  // lairs may have removed obstacles: drop props that are no longer pillars
  const props2 = props.filter((p) => p.kind && (map.get(p.tx, p.ty) === T.PILLAR || ['fountain', 'stall', 'fence', 'fencev', 'statue', 'lamp'].includes(p.kind)));

  return {
    map, props: props2, npcs, lairs, roads,
    spawn: { tx: startX, ty: startY },
    town: { x0: ox, y0: oy, x1: ox + HUB_W - 1, y1: oy + HUB_H - 1 },
    center: { tx: cx, ty: cy },
  };
}

// Region index for a world tile (town counts as region 0 for difficulty purposes)
export function regionAt(world, px, py) {
  const tx = Math.floor(px / 16), ty = Math.floor(py / 16);
  if (!world.map.inBounds(tx, ty)) return 0;
  const b = world.map.biome[world.map.idx(tx, ty)];
  return b === TOWN_BIOME ? -1 : b;
}
