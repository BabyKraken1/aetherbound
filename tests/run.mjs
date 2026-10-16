// Run with: node tests/run.mjs
import assert from 'node:assert/strict';
import { RNG } from '../src/util.js';
import { applyDefense, rollPlayerHit, damageToEnemy, abilityDamage } from '../src/systems/damage.js';
import { computeStats, addXp, xpForLevel } from '../src/systems/stats.js';
import { addItem, removeAt, equipFromInventory, unequip, canEquip, countItem, consumeOne, emptyInventory } from '../src/systems/inventory.js';
import { rollEnemyDrop, rollBossDrop, rollChest, makeItem, vendorStock, rollRarity } from '../src/systems/loot.js';
import { defaultSave, validateSave, loadSave, writeSave } from '../src/systems/save.js';
import { generateDungeon, verifyDungeon } from '../src/world/dungeon.js';
import { buildHub } from '../src/world/hub.js';
import { floodReachable } from '../src/world/tilemap.js';
import { REGIONS } from '../src/content/regions.js';
import { CLASSES, CLASS_ORDER } from '../src/content/classes.js';
import { ITEMS, getBase } from '../src/content/items.js';
import { ARCHETYPES, ROSTERS } from '../src/content/enemies.js';
import { BOSSES } from '../src/content/bosses.js';
import { T } from '../src/config.js';

let passed = 0, failed = 0;
function test(name, fn) {
  try { fn(); passed++; console.log('  ok  ' + name); }
  catch (e) { failed++; console.log('  FAIL ' + name + '\n       ' + (e.stack || e).toString().split('\n').slice(0, 3).join('\n       ')); }
}

console.log('content');
test('every item has required fields', () => {
  const ids = new Set();
  for (const it of ITEMS) {
    assert.ok(it.id && it.name && it.slot && it.rarity, it.id);
    assert.ok(!ids.has(it.id), 'duplicate ' + it.id);
    ids.add(it.id);
    if (it.slot === 'weapon') assert.ok(it.weapon && it.cls && it.weapon.dmg.length === 2, it.id);
  }
  assert.ok(ITEMS.filter((i) => i.slot !== 'consumable').length >= 20);
});
test('every class starter item exists and fits', () => {
  for (const c of CLASS_ORDER) for (const id of CLASSES[c].starter) {
    const b = getBase(id);
    assert.ok(b, id);
    if (b.cls) assert.equal(b.cls, c);
  }
});
test('8+ enemy archetypes, rosters cover all', () => {
  const roles = Object.keys(ARCHETYPES).filter((k) => k !== 'minion');
  assert.ok(roles.length >= 8);
  for (const r of Object.values(ROSTERS)) for (const k of Object.keys(ARCHETYPES)) assert.ok(r[k]?.name, k);
});
test('3 bosses with 2 phases and signature loot', () => {
  assert.equal(Object.keys(BOSSES).length, 3);
  for (const [id, b] of Object.entries(BOSSES)) {
    assert.ok(b.phases.length >= 2, id);
    assert.ok(ITEMS.some((i) => i.boss === id), 'loot for ' + id);
  }
});

console.log('damage');
test('defense subtracts but floors at 15%', () => {
  assert.equal(applyDefense(100, 10), 90);
  assert.equal(applyDefense(100, 99), 15);
  assert.equal(applyDefense(3, 50), 1);
});
test('crit multiplies, mark adds 30%', () => {
  const w = { dmg: [10, 10] };
  const s = { dmgMult: 1, crit: 1 };
  assert.deepEqual(rollPlayerHit(w, s, () => 0), { dmg: 18, crit: true });
  assert.equal(damageToEnemy(100, 0, true), 130);
});
test('ability damage scales with AP', () => {
  assert.equal(abilityDamage(50, { ap: 10, dmgMult: 1 }), 58);
});

console.log('stats + progression');
test('equipment changes stats', () => {
  const save = defaultSave();
  const cs = save.classes.vanguard;
  const before = computeStats(CLASSES.vanguard, 1, cs.equip);
  cs.equip.ring = { base: 'ring_vigor', q: 1 };
  const after = computeStats(CLASSES.vanguard, 1, cs.equip);
  assert.equal(after.maxHp, before.maxHp + 35);
  assert.ok(after.weapon && after.weapon.kind === 'melee');
});
test('drawbacks are applied (Glass Heart)', () => {
  const eq = { weapon: { base: 'apprentice_staff', q: 1 }, ring: { base: 'glass_heart', q: 1.1 } };
  const s = computeStats(CLASSES.arcanist, 1, eq);
  assert.equal(s.maxHp, 100 - 50);
  assert.ok(Math.abs(s.dmgMult - 1.33) < 1e-6);
});
test('relic mods merge', () => {
  const s = computeStats(CLASSES.ranger, 1, { weapon: { base: 'shortbow' }, relic: { base: 'hunters_quiver' } });
  assert.equal(s.mods.volley.arrows, 4);
});
test('xp levels up and caps', () => {
  const p = { level: 1, xp: 0 };
  assert.equal(addXp(p, xpForLevel(1)), 1);
  assert.equal(p.level, 2);
  addXp(p, 1e9);
  assert.equal(p.level, 20);
  assert.equal(p.xp, 0);
});

console.log('inventory');
test('add, stack, remove, consume', () => {
  const inv = emptyInventory();
  assert.ok(addItem(inv, { base: 'hp_potion', qty: 5 }));
  assert.ok(addItem(inv, { base: 'hp_potion', qty: 6 }));
  assert.equal(countItem(inv, 'hp_potion'), 11);
  assert.equal(inv.filter(Boolean).length, 2);
  assert.ok(consumeOne(inv, 'hp_potion'));
  assert.equal(countItem(inv, 'hp_potion'), 10);
  removeAt(inv, 0);
  assert.equal(countItem(inv, 'hp_potion'), 2);
});
test('full inventory rejects items', () => {
  const inv = emptyInventory().map(() => ({ base: 'ring_vigor' }));
  assert.equal(addItem(inv, { base: 'iron_helm' }), false);
});
test('equip swaps and respects class', () => {
  const save = defaultSave();
  const inv = save.inventory;
  inv[5] = { base: 'kingsfall', q: 1 };
  inv[6] = { base: 'shortbow', q: 1 };
  assert.equal(canEquip(inv[6], 'vanguard').ok, false);
  const r = equipFromInventory(inv, save.classes.vanguard, 'vanguard', 5);
  assert.ok(r.ok);
  assert.equal(save.classes.vanguard.equip.weapon.base, 'kingsfall');
  assert.equal(inv[5].base, 'rusty_sword');
  assert.equal(unequip(inv, save.classes.vanguard, 'weapon').ok, false);
  assert.ok(unequip(inv, save.classes.vanguard, 'armor').ok);
  assert.equal(save.classes.vanguard.equip.armor, null);
});

console.log('loot');
test('enemy drops are valid items', () => {
  const rng = new RNG(1);
  let items = 0;
  for (let i = 0; i < 2000; i++) {
    const d = rollEnemyDrop(rng, { region: 1, elite: i % 10 === 0 });
    for (const it of d.items) { assert.ok(getBase(it.base)); items++; }
    assert.ok(d.gold > 0);
  }
  assert.ok(items > 100);
});
test('elite always drops equipment', () => {
  const rng = new RNG(2);
  for (let i = 0; i < 200; i++) {
    const d = rollEnemyDrop(rng, { region: 0, elite: true });
    assert.ok(d.items.some((it) => getBase(it.base).slot !== 'consumable'));
  }
});
test('region 0 never drops later-region gear', () => {
  const rng = new RNG(3);
  for (let i = 0; i < 1000; i++)
    for (const it of rollChest(rng, { region: 0 }).items) assert.ok(getBase(it.base).region <= 0, it.base);
});
test('boss: signature guaranteed on first kill, pity guarantees later', () => {
  const rng = new RNG(4);
  const first = rollBossDrop(rng, { bossId: 'bramblemaw', region: 0, firstKill: true, pity: 0 });
  assert.ok(first.items.some((i) => getBase(i.base).boss === 'bramblemaw'));
  const pity = rollBossDrop(rng, { bossId: 'kragmor', region: 1, firstKill: false, pity: 4 });
  assert.ok(pity.items.some((i) => getBase(i.base).boss === 'kragmor'));
  assert.equal(pity.pity, 0);
});
test('rarity bump shifts distribution upward', () => {
  const rng = new RNG(5);
  const score = (bump) => { let s = 0; for (let i = 0; i < 3000; i++) s += ['common', 'uncommon', 'rare', 'epic', 'legendary'].indexOf(rollRarity(rng, 'enemy', bump)); return s; };
  assert.ok(score(1) > score(0));
});
test('vendor stock has unique items', () => {
  const s = vendorStock(new RNG(6), 2);
  assert.equal(new Set(s.map((i) => i.base)).size, s.length);
});

console.log('save');
test('default save round-trips', () => {
  const d = defaultSave();
  const { save, warnings } = validateSave(JSON.parse(JSON.stringify(d)));
  assert.deepEqual(warnings, []);
  assert.deepEqual(save.classes.ranger.equip.weapon.base, 'shortbow');
});
test('garbage and corrupted saves are repaired, never throw', () => {
  for (const raw of [null, 42, 'x', [], { v: 1 }, { classes: 'no', inventory: [{ base: 'nope' }, 7, null] }]) {
    const { save } = validateSave(raw);
    assert.ok(save.classes.vanguard.equip.weapon);
  }
  const bad = { v: 2, gold: -50, classes: { arcanist: { level: 999, equip: { weapon: { base: 'shortbow' } } } } };
  const { save } = validateSave(bad);
  assert.equal(save.gold, 0);
  assert.equal(save.classes.arcanist.level, 20);
  assert.equal(save.classes.arcanist.equip.weapon.base, 'apprentice_staff'); // wrong-class weapon rejected
});
test('localStorage-style load/write and corrupt JSON', () => {
  const mem = new Map();
  const storage = { getItem: (k) => mem.get(k) ?? null, setItem: (k, v) => mem.set(k, v) };
  const d = defaultSave(); d.gold = 77;
  assert.ok(writeSave(storage, 'k', d));
  assert.equal(loadSave(storage, 'k').save.gold, 77);
  mem.set('k', '{not json');
  const r = loadSave(storage, 'k');
  assert.equal(r.save, null);
  assert.ok(r.corrupt);
  assert.equal(mem.get('k.corrupt'), '{not json');
});

console.log('world');
test('500 dungeons per region are fully connected', () => {
  for (const region of REGIONS) {
    for (let seed = 0; seed < 500; seed++) {
      const d = generateDungeon(region, new RNG(seed * 7 + region.index));
      const v = verifyDungeon(d);
      assert.ok(v.ok, `${region.id} seed ${seed}: ${v.problems.join(', ')}`);
      assert.ok(d.rooms.length >= region.rooms[0]);
      assert.equal(d.rooms.filter((r) => r.type === 'boss').length, 1);
      const boss = d.rooms[d.bossRoom];
      assert.ok(boss.w >= 20 && boss.h >= 15, 'boss arena too small');
    }
  }
});
test('gates lock rooms and only open gates allow passage', () => {
  const d = generateDungeon(REGIONS[0], new RNG(99));
  const boss = d.rooms[d.bossRoom];
  d.map.closedRooms.add(boss.id);
  const s = d.rooms[d.startRoom];
  const seen = floodReachable(d.map, Math.floor(s.centerX), Math.floor(s.centerY));
  assert.equal(seen[d.map.idx(Math.floor(boss.centerX), Math.floor(boss.centerY))], 0);
});
test('hub: every NPC and portal is reachable from spawn', () => {
  const hub = buildHub(new RNG(1));
  const seen = floodReachable(hub.map, hub.spawn.tx, hub.spawn.ty);
  for (const n of hub.npcs) {
    const tx = Math.floor(n.tx), ty = Math.floor(n.ty);
    let ok = false;
    for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++)
      if (hub.map.inBounds(tx + dx, ty + dy) && seen[hub.map.idx(tx + dx, ty + dy)]) ok = true;
    assert.ok(ok, n.kind + ' unreachable');
  }
  assert.equal(hub.map.get(hub.spawn.tx, hub.spawn.ty) !== T.WALL, true);
});

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
