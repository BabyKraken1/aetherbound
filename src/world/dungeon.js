// Room-and-corridor dungeon generator. Pure (no DOM) so connectivity can be unit tested.
//
// Layout: rooms sit on a coarse cell grid and grow as a random tree from the start room.
// The boss room is the farthest leaf. A few extra loops are added, plus one secret room hidden
// behind a breakable wall. Combat rooms lock their gates until cleared.
import { T } from '../config.js';
import { TileMap, floodReachable } from './tilemap.js';

export const GW = 6, GH = 5;     // cell grid
export const CW = 26, CH = 21;   // cell size in tiles
const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1]];

export function generateDungeon(region, rng, attempt = 0) {
  const d = tryGenerate(region, rng);
  if (d && verifyDungeon(d).ok) return d;
  if (attempt > 30) throw new Error('Dungeon generation failed');
  return generateDungeon(region, rng, attempt + 1);
}

function tryGenerate(region, rng) {
  const target = rng.int(region.rooms[0], region.rooms[1]);
  const grid = new Map();
  const rooms = [];
  const edges = [];
  const key = (x, y) => x + ',' + y;
  const addRoom = (cx, cy) => {
    const r = { id: rooms.length, cx, cy, type: 'combat', links: [] };
    rooms.push(r);
    grid.set(key(cx, cy), r);
    return r;
  };
  const link = (a, b, secret = false) => {
    edges.push({ a: a.id, b: b.id, secret });
    a.links.push(b.id);
    b.links.push(a.id);
  };

  const start = addRoom(rng.int(1, GW - 2), rng.int(1, GH - 2));
  let guard = 0;
  while (rooms.length < target && guard++ < 2000) {
    // bias toward extending recent rooms so we get branches rather than blobs
    const r = rng.chance(0.6) ? rooms[rooms.length - 1 - rng.int(0, Math.min(2, rooms.length - 1))] : rng.pick(rooms);
    const [dx, dy] = rng.pick(DIRS);
    const nx = r.cx + dx, ny = r.cy + dy;
    if (nx < 0 || ny < 0 || nx >= GW || ny >= GH || grid.has(key(nx, ny))) continue;
    link(r, addRoom(nx, ny));
  }
  if (rooms.length < target) return null;

  // distances from start over the room graph
  const distTo = bfsRooms(rooms, start.id);
  const leaves = rooms.filter((r) => r.links.length === 1 && r !== start);
  const bossPick = (leaves.length ? leaves : rooms.filter((r) => r !== start)).sort((a, b) => distTo[b.id] - distTo[a.id])[0];
  if (distTo[bossPick.id] < 3) return null;
  bossPick.type = 'boss';
  start.type = 'start';

  // a couple of loops (never into the boss room)
  for (const r of rooms) {
    for (const [dx, dy] of DIRS) {
      const n = grid.get(key(r.cx + dx, r.cy + dy));
      if (!n || n.id < r.id || n.type === 'boss' || r.type === 'boss') continue;
      if (r.links.includes(n.id)) continue;
      if (rng.chance(0.18)) link(r, n);
    }
  }

  // special room types
  const free = () => rooms.filter((r) => r.type === 'combat');
  const leafFree = free().filter((r) => r.links.length === 1);
  if (leafFree.length) rng.pick(leafFree).type = 'treasure';
  const far = free().filter((r) => distTo[r.id] >= 2);
  if (far.length) rng.pick(far).type = 'elite';
  if (free().length > 2) rng.pick(free()).type = 'shrine';
  if (rooms.length >= 8 && free().length > 2) rng.pick(free()).type = 'trial';

  // secret room off a non-boss room, in an empty neighboring cell
  const secretCandidates = [];
  for (const r of rooms) {
    if (r.type === 'boss' || r.type === 'start') continue;
    for (const [dx, dy] of DIRS) {
      const nx = r.cx + dx, ny = r.cy + dy;
      if (nx < 0 || ny < 0 || nx >= GW || ny >= GH || grid.has(key(nx, ny))) continue;
      secretCandidates.push([r, nx, ny]);
    }
  }
  if (secretCandidates.length) {
    const [parent, nx, ny] = rng.pick(secretCandidates);
    const s = addRoom(nx, ny);
    s.type = 'secret';
    link(parent, s, true);
  }

  // ── carve tiles ──
  const map = new TileMap(GW * CW + 2, GH * CH + 2, T.VOID);
  for (const r of rooms) {
    let w, h;
    if (r.type === 'boss') { w = CW - 4; h = CH - 4; }
    else if (r.type === 'secret') { w = 9; h = 8; }
    else if (r.type === 'start' || r.type === 'shrine' || r.type === 'treasure') { w = rng.int(11, 14); h = rng.int(9, 11); }
    else { w = rng.int(14, CW - 7); h = rng.int(11, CH - 7); }
    const jitter = r.type === 'boss' ? 0 : 1;
    r.x0 = 1 + r.cx * CW + Math.floor((CW - w) / 2) + rng.int(-jitter, jitter);
    r.y0 = 1 + r.cy * CH + Math.floor((CH - h) / 2) + rng.int(-jitter, jitter);
    r.x1 = r.x0 + w - 1;
    r.y1 = r.y0 + h - 1;
    r.w = w; r.h = h;
    r.centerX = (r.x0 + r.x1 + 1) / 2;
    r.centerY = (r.y0 + r.y1 + 1) / 2;
    r.cleared = r.type !== 'combat' && r.type !== 'elite' && r.type !== 'boss';
    r.visited = false;
    for (let y = r.y0; y <= r.y1; y++)
      for (let x = r.x0; x <= r.x1; x++) {
        map.set(x, y, T.FLOOR);
        map.room[map.idx(x, y)] = r.id;
      }
  }

  for (const e of edges) carveCorridor(map, rooms[e.a], rooms[e.b], e.secret);

  // walls around everything walkable
  for (let y = 0; y < map.h; y++)
    for (let x = 0; x < map.w; x++) {
      if (map.get(x, y) !== T.VOID) continue;
      let near = false;
      for (let dy = -1; dy <= 1 && !near; dy++)
        for (let dx = -1; dx <= 1; dx++) {
          const v = map.get(x + dx, y + dy);
          if (v !== T.VOID && v !== T.WALL) { near = true; break; }
        }
      if (near) map.set(x, y, T.WALL);
    }

  // obstacles, hazards and decoration
  for (const r of rooms) decorateRoom(map, r, region, rng);

  // a pillar must never cut a room apart: verify and strip if needed
  const startTile = [Math.floor(start.centerX), Math.floor(start.centerY)];
  let seen = floodReachable(map, startTile[0], startTile[1], { openGates: true, crackPassable: true });
  for (const r of rooms) {
    if (!roomFullyReachable(map, r, seen)) {
      for (let y = r.y0; y <= r.y1; y++)
        for (let x = r.x0; x <= r.x1; x++)
          if (map.get(x, y) === T.PILLAR) map.set(x, y, T.FLOOR);
      seen = floodReachable(map, startTile[0], startTile[1], { openGates: true, crackPassable: true });
    }
  }

  return { map, rooms, edges, startRoom: start.id, bossRoom: bossPick.id, region };
}

function bfsRooms(rooms, from) {
  const d = new Array(rooms.length).fill(Infinity);
  d[from] = 0;
  const q = [from];
  while (q.length) {
    const id = q.shift();
    for (const n of rooms[id].links) if (d[n] === Infinity) { d[n] = d[id] + 1; q.push(n); }
  }
  return d;
}

function carveCorridor(map, a, b, secret) {
  if (a.cx !== b.cx) {
    // horizontal neighbors
    const [L, R] = a.cx < b.cx ? [a, b] : [b, a];
    const lo = Math.max(L.y0 + 1, R.y0 + 1), hi = Math.min(L.y1 - 1, R.y1 - 1);
    const c = Math.floor((lo + hi) / 2);
    for (let x = L.x1 + 1; x <= R.x0 - 1; x++)
      for (let y = c - 1; y <= c + 1; y++) setCorridor(map, x, y);
    gateLine(map, L.x1 + 1, c, true, L.id, secret);
    gateLine(map, R.x0 - 1, c, true, R.id, secret);
    if (secret) {
      // gate tiles belonging to the parent are a crack; the secret room's side stays open floor
      const parentEdgeX = a === L ? L.x1 + 1 : R.x0 - 1;
      const secretEdgeX = a === L ? R.x0 - 1 : L.x1 + 1;
      for (let y = c - 1; y <= c + 1; y++) { map.set(parentEdgeX, y, T.CRACK); map.set(secretEdgeX, y, T.FLOOR); }
    }
  } else {
    const [U, D] = a.cy < b.cy ? [a, b] : [b, a];
    const lo = Math.max(U.x0 + 1, D.x0 + 1), hi = Math.min(U.x1 - 1, D.x1 - 1);
    const c = Math.floor((lo + hi) / 2);
    for (let y = U.y1 + 1; y <= D.y0 - 1; y++)
      for (let x = c - 1; x <= c + 1; x++) setCorridor(map, x, y);
    gateLine(map, c, U.y1 + 1, false, U.id, secret);
    gateLine(map, c, D.y0 - 1, false, D.id, secret);
    if (secret) {
      const parentEdgeY = a === U ? U.y1 + 1 : D.y0 - 1;
      const secretEdgeY = a === U ? D.y0 - 1 : U.y1 + 1;
      for (let x = c - 1; x <= c + 1; x++) { map.set(x, parentEdgeY, T.CRACK); map.set(x, secretEdgeY, T.FLOOR); }
    }
  }
}

function setCorridor(map, x, y) {
  map.set(x, y, T.FLOOR);
  map.room[map.idx(x, y)] = -2;
}

// three gate tiles across a corridor mouth, owned by `roomId`
function gateLine(map, x, y, vertical, roomId, skip) {
  if (skip || roomId == null) return;
  for (let k = -1; k <= 1; k++) {
    const gx = vertical ? x : x + k, gy = vertical ? y + k : y;
    map.set(gx, gy, T.GATE);
    map.gateRoom[map.idx(gx, gy)] = roomId;
  }
}

function decorateRoom(map, r, region, rng) {
  const cx = Math.floor(r.centerX), cy = Math.floor(r.centerY);
  const inCross = (x, y) => Math.abs(x - cx) <= 2 || Math.abs(y - cy) <= 2;
  // decorative floor detail everywhere
  for (let y = r.y0; y <= r.y1; y++)
    for (let x = r.x0; x <= r.x1; x++)
      if (rng.chance(0.1)) map.deco[map.idx(x, y)] = rng.int(1, 4);

  if (r.type === 'boss') {
    // four symmetric pillars give cover from boss patterns
    const ox = Math.floor(r.w / 4), oy = Math.floor(r.h / 4);
    for (const [sx, sy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) map.set(cx + sx * ox, cy + sy * oy, T.PILLAR);
    return;
  }
  if (r.type === 'secret' || r.type === 'start') return;

  if (r.type === 'combat' || r.type === 'elite' || r.type === 'trial') {
    const clusters = rng.int(1, 4);
    for (let i = 0; i < clusters; i++) {
      const x = rng.int(r.x0 + 3, r.x1 - 3), y = rng.int(r.y0 + 3, r.y1 - 3);
      if (inCross(x, y)) continue;
      map.set(x, y, T.PILLAR);
      if (rng.chance(0.4)) {
        const [dx, dy] = rng.pick(DIRS);
        if (!inCross(x + dx, y + dy) && x + dx > r.x0 + 1 && x + dx < r.x1 - 1 && y + dy > r.y0 + 1 && y + dy < r.y1 - 1) map.set(x + dx, y + dy, T.PILLAR);
      }
    }
    const patches = region.theme === 'cinder' ? rng.int(1, 3) : rng.int(0, 2);
    for (let i = 0; i < patches; i++) {
      const x = rng.int(r.x0 + 3, r.x1 - 3), y = rng.int(r.y0 + 3, r.y1 - 3);
      if (Math.abs(x - cx) <= 3 && Math.abs(y - cy) <= 3) continue;
      const rad = rng.int(1, 2);
      for (let yy = y - rad; yy <= y + rad; yy++)
        for (let xx = x - rad; xx <= x + rad; xx++) {
          if (xx <= r.x0 || yy <= r.y0 || xx >= r.x1 || yy >= r.y1) continue;
          if (Math.abs(xx - cx) <= 1 || Math.abs(yy - cy) <= 1) continue; // keep door-to-door lanes clear
          if ((xx - x) ** 2 + (yy - y) ** 2 > rad * rad + 0.5) continue;
          if (map.get(xx, yy) === T.FLOOR) map.set(xx, yy, T.HAZARD);
        }
    }
  }
}

function roomFullyReachable(map, r, seen) {
  for (let y = r.y0; y <= r.y1; y++)
    for (let x = r.x0; x <= r.x1; x++) {
      const v = map.get(x, y);
      if (v === T.PILLAR || v === T.WALL) continue;
      if (!seen[map.idx(x, y)]) return false;
    }
  return true;
}

// Every room must be reachable from the start (with gates open; cracks breakable),
// every non-secret room must be reachable without breaking cracks, and spawn space must exist.
export function verifyDungeon(d) {
  const { map, rooms } = d;
  const s = rooms[d.startRoom];
  const sx = Math.floor(s.centerX), sy = Math.floor(s.centerY);
  const all = floodReachable(map, sx, sy, { openGates: true, crackPassable: true });
  const noCrack = floodReachable(map, sx, sy, { openGates: true, crackPassable: false });
  const problems = [];
  for (const r of rooms) {
    if (!roomFullyReachable(map, r, all)) problems.push(`room ${r.id} (${r.type}) unreachable`);
    if (r.type !== 'secret' && !roomFullyReachable(map, r, noCrack)) problems.push(`room ${r.id} needs a crack`);
  }
  if (!rooms.some((r) => r.type === 'boss')) problems.push('no boss room');
  return { ok: problems.length === 0, problems };
}
