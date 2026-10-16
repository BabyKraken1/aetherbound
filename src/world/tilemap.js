import { T, TILE } from '../config.js';

// Tile grid plus per-tile metadata (room ownership, gates, breakable walls, decoration ids).
export class TileMap {
  constructor(w, h, fill = T.VOID) {
    this.w = w;
    this.h = h;
    this.t = new Uint8Array(w * h).fill(fill);
    this.deco = new Uint8Array(w * h);        // decorative overlay id (0 = none)
    this.room = new Int16Array(w * h).fill(-1); // room id that owns the tile (-2 corridor)
    this.gateRoom = new Int16Array(w * h).fill(-1);
    this.closedRooms = new Set();
    this.crackHp = new Map(); // idx -> hp
    this.dirty = [];          // tiles that changed and need re-rendering
  }
  idx(x, y) { return y * this.w + x; }
  inBounds(x, y) { return x >= 0 && y >= 0 && x < this.w && y < this.h; }
  get(x, y) { return this.inBounds(x, y) ? this.t[y * this.w + x] : T.VOID; }
  set(x, y, v) { if (this.inBounds(x, y)) this.t[y * this.w + x] = v; }

  isSolid(x, y) {
    const v = this.get(x, y);
    if (v === T.GATE) return this.closedRooms.has(this.gateRoom[this.idx(x, y)]);
    return v === T.VOID || v === T.WALL || v === T.CRACK || v === T.WATER || v === T.PILLAR;
  }
  // Shots fly over water, but not walls or closed gates.
  isShotSolid(x, y) {
    const v = this.get(x, y);
    if (v === T.WATER) return false;
    return this.isSolid(x, y);
  }
  isSolidAt(px, py) { return this.isSolid(Math.floor(px / TILE), Math.floor(py / TILE)); }
  isShotSolidAt(px, py) { return this.isShotSolid(Math.floor(px / TILE), Math.floor(py / TILE)); }
  tileAt(px, py) { return this.get(Math.floor(px / TILE), Math.floor(py / TILE)); }
  roomAt(px, py) {
    const x = Math.floor(px / TILE), y = Math.floor(py / TILE);
    return this.inBounds(x, y) ? this.room[this.idx(x, y)] : -1;
  }

  // Damage a breakable wall; returns true when it breaks.
  damageCrack(tx, ty, amount) {
    const i = this.idx(tx, ty);
    if (this.t[i] !== T.CRACK) return false;
    const hp = (this.crackHp.get(i) ?? 40) - amount;
    if (hp <= 0) {
      // the whole crack line breaks together
      const stack = [[tx, ty]];
      while (stack.length) {
        const [x, y] = stack.pop();
        const j = this.idx(x, y);
        if (this.t[j] !== T.CRACK) continue;
        this.t[j] = T.FLOOR;
        this.crackHp.delete(j);
        this.dirty.push([x, y]);
        stack.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]);
      }
      return true;
    }
    this.crackHp.set(i, hp);
    return false;
  }
}

export function collides(map, x, y, r) {
  const x0 = Math.floor((x - r) / TILE), x1 = Math.floor((x + r - 0.001) / TILE);
  const y0 = Math.floor((y - r) / TILE), y1 = Math.floor((y + r - 0.001) / TILE);
  for (let ty = y0; ty <= y1; ty++)
    for (let tx = x0; tx <= x1; tx++)
      if (map.isSolid(tx, ty)) return true;
  return false;
}

// Axis-separated movement that slides along walls. Returns {hitX, hitY}.
export function moveWithCollision(map, e, dx, dy) {
  let hitX = false, hitY = false;
  if (dx) {
    if (!collides(map, e.x + dx, e.y, e.r)) e.x += dx;
    else {
      hitX = true;
      const s = Math.sign(dx);
      let step = Math.abs(dx);
      while (step > 0.05) {
        step /= 2;
        if (!collides(map, e.x + s * step, e.y, e.r)) e.x += s * step;
      }
    }
  }
  if (dy) {
    if (!collides(map, e.x, e.y + dy, e.r)) e.y += dy;
    else {
      hitY = true;
      const s = Math.sign(dy);
      let step = Math.abs(dy);
      while (step > 0.05) {
        step /= 2;
        if (!collides(map, e.x, e.y + s * step, e.r)) e.y += s * step;
      }
    }
  }
  return { hitX, hitY };
}

// Flood fill over walkable tiles. `opts.openGates` treats gates as open; `opts.crackPassable` lets
// flood pass breakable walls (they can be destroyed by the player).
export function floodReachable(map, sx, sy, opts = {}) {
  const seen = new Uint8Array(map.w * map.h);
  const passable = (x, y) => {
    const v = map.get(x, y);
    if (v === T.GATE) return opts.openGates ? true : !map.isSolid(x, y);
    if (v === T.CRACK) return !!opts.crackPassable;
    return !map.isSolid(x, y);
  };
  if (!passable(sx, sy)) return seen;
  const q = [sx, sy];
  seen[map.idx(sx, sy)] = 1;
  while (q.length) {
    const y = q.pop(), x = q.pop();
    const n = [[x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]];
    for (const [nx, ny] of n) {
      if (!map.inBounds(nx, ny)) continue;
      const i = map.idx(nx, ny);
      if (seen[i] || !passable(nx, ny)) continue;
      seen[i] = 1;
      q.push(nx, ny);
    }
  }
  return seen;
}
