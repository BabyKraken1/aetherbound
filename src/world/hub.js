// Emberlight Haven: the hand-built safe hub town.
import { T } from '../config.js';
import { TileMap } from './tilemap.js';

export const HUB_W = 46, HUB_H = 34;

export function buildHub(rng) {
  const m = new TileMap(HUB_W, HUB_H, T.FLOOR);
  const rect = (x0, y0, x1, y1, v) => { for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) m.set(x, y, v); };
  const reserved = new Set();
  const reserve = (x0, y0, x1, y1) => { for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) reserved.add(x + ',' + y); };

  // border
  rect(0, 0, HUB_W - 1, 0, T.WALL); rect(0, HUB_H - 1, HUB_W - 1, HUB_H - 1, T.WALL);
  rect(0, 0, 0, HUB_H - 1, T.WALL); rect(HUB_W - 1, 0, HUB_W - 1, HUB_H - 1, T.WALL);

  // plaza + paths
  rect(16, 13, 29, 21, T.PATH); reserve(15, 12, 30, 22);
  rect(22, 6, 23, 12, T.PATH); reserve(21, 3, 24, 12);       // north road to portals
  rect(8, 6, 38, 7, T.PATH); reserve(6, 2, 40, 8);           // portal walk
  rect(8, 17, 15, 18, T.PATH); reserve(5, 13, 15, 20);       // west to vendor
  rect(30, 17, 33, 18, T.PATH); reserve(30, 12, 43, 23);     // east to training yard
  rect(22, 22, 23, 26, T.PATH); reserve(19, 22, 26, 30);     // south to shrine
  rect(19, 27, 26, 29, T.PATH);

  // fountain (2 tiles, solid)
  m.set(22, 16, T.PILLAR); m.set(23, 16, T.PILLAR);

  // vendor stall (solid counter behind the vendor)
  rect(7, 14, 11, 14, T.PILLAR);

  // training yard fence
  for (let x = 32; x <= 42; x++) { m.set(x, 12, T.PILLAR); m.set(x, 23, T.PILLAR); }
  for (let y = 12; y <= 23; y++) { if (y !== 17 && y !== 18) m.set(32, y, T.PILLAR); m.set(42, y, T.PILLAR); }

  // shrine statue
  m.set(22, 28, T.PILLAR); m.set(23, 28, T.PILLAR);

  // pond
  rect(4, 24, 11, 29, T.WATER); reserve(3, 23, 12, 30);

  // trees: border band + scattered
  const props = [];
  const trees = [];
  for (let y = 1; y < HUB_H - 1; y++)
    for (let x = 1; x < HUB_W - 1; x++) {
      if (reserved.has(x + ',' + y) || m.get(x, y) !== T.FLOOR) continue;
      const edge = x <= 2 || y <= 1 || x >= HUB_W - 3 || y >= HUB_H - 3;
      if ((edge && rng.chance(0.55)) || (!edge && rng.chance(0.045))) {
        m.set(x, y, T.PILLAR);
        trees.push([x, y]);
      } else if (rng.chance(0.12)) m.deco[m.idx(x, y)] = rng.int(1, 4);
    }
  for (const [x, y] of trees) props.push({ kind: 'tree', tx: x, ty: y });
  props.push({ kind: 'fountain', tx: 22, ty: 16 });
  props.push({ kind: 'stall', tx: 7, ty: 14 });
  for (let x = 32; x <= 42; x++) { props.push({ kind: 'fence', tx: x, ty: 12 }); props.push({ kind: 'fence', tx: x, ty: 23 }); }
  for (let y = 13; y <= 22; y++) { if (y !== 17 && y !== 18) props.push({ kind: 'fencev', tx: 32, ty: y }); props.push({ kind: 'fencev', tx: 42, ty: y }); }
  props.push({ kind: 'statue', tx: 22, ty: 28 });
  props.push({ kind: 'lamp', tx: 15, ty: 12, solid: false }, { kind: 'lamp', tx: 30, ty: 12, solid: false },
    { kind: 'lamp', tx: 15, ty: 22, solid: false }, { kind: 'lamp', tx: 30, ty: 22, solid: false });

  const npcs = [
    { kind: 'vendor', tx: 9, ty: 15.6, name: 'Pell the Peddler', prompt: 'Trade with Pell' },
    { kind: 'shrine', tx: 23, ty: 28.6, name: 'Shrine of Echoes', prompt: 'Change class' },
    { kind: 'dummy', tx: 36, ty: 15.5, name: 'Training Dummy' },
    { kind: 'dummy', tx: 39, ty: 18, name: 'Training Dummy' },
    { kind: 'dummy', tx: 36, ty: 20.5, name: 'Training Dummy' },
    { kind: 'board', tx: 27.5, ty: 12.3, name: 'Notice Board', prompt: 'Read the notice board' },
    { kind: 'portal', tx: 9, ty: 4, region: 0 },
    { kind: 'portal', tx: 23, ty: 4, region: 1 },
    { kind: 'portal', tx: 37, ty: 4, region: 2 },
  ];
  return { map: m, props, npcs, spawn: { tx: 23, ty: 24 } };
}
