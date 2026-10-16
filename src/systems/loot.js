// Loot generation: rarity rolls, enemy/boss drop tables, chests and vendor stock (unit tested).
import { ITEMS, getBase } from '../content/items.js';
import { RARITIES } from '../config.js';
import { uid } from '../util.js';

// Base rarity weights by source. Index matches RARITIES.
const RARITY_WEIGHTS = {
  enemy:  [62, 28, 9, 1, 0, 0],
  elite:  [12, 44, 34, 9, 1, 0],
  chest:  [18, 42, 30, 9, 1, 0],
  secret: [0, 24, 46, 26, 4, 0],
  boss:   [0, 16, 46, 32, 6, 0],
};

export function rollRarity(rng, source, bump = 0) {
  const w = RARITY_WEIGHTS[source] || RARITY_WEIGHTS.enemy;
  let idx = rng.weighted(w.map((x, i) => ({ w: x, v: i })));
  idx = Math.min(4, idx + bump); // bumps never create mythics; those come from the chase roll
  return RARITIES[idx];
}

export function makeItem(baseId, rng, qty) {
  const base = getBase(baseId);
  if (!base) throw new Error('Unknown item ' + baseId);
  const item = { uid: uid(), base: baseId };
  if (base.slot === 'consumable') item.qty = qty || 1;
  else item.q = Math.round(rng.range(0.9, 1.12) * 100) / 100; // roll quality ±
  return item;
}

// Equipment pool usable from a region (items from that region or earlier), excluding boss/mythic exclusives.
function pool(regionIndex, rarity) {
  return ITEMS.filter((b) => b.slot !== 'consumable' && !b.boss && b.rarity === rarity && b.region <= regionIndex);
}

export function rollEquipment(rng, regionIndex, rarity) {
  // fall back to nearby rarities if a pool is empty
  const order = RARITIES.indexOf(rarity);
  for (let d = 0; d < RARITIES.length; d++) {
    for (const idx of [order - d, order + d]) {
      if (idx < 0 || idx >= 5) continue;
      const p = pool(regionIndex, RARITIES[idx]);
      if (p.length) return makeItem(rng.pick(p).id, rng);
    }
  }
  return null;
}

// ctx: {region, elite, tierBump, role}
export function rollEnemyDrop(rng, ctx) {
  const out = { items: [], gold: 0 };
  out.gold = rng.int(1, 3) * (ctx.region + 1) * (ctx.elite ? 4 : 1);
  if (ctx.noDrop) return out;
  const itemChance = ctx.elite ? 1 : 0.11;
  if (rng.chance(itemChance)) {
    const r = rollRarity(rng, ctx.elite ? 'elite' : 'enemy', ctx.tierBump || 0);
    const it = rollEquipment(rng, ctx.region, r);
    if (it) out.items.push(it);
  }
  const potionChance = ctx.elite ? 0.6 : 0.09;
  if (rng.chance(potionChance)) out.items.push(makeItem(rng.chance(0.6) ? 'hp_potion' : 'mp_potion', rng, 1));
  return out;
}

export function rollChest(rng, ctx) {
  const out = { items: [], gold: rng.int(8, 16) * (ctx.region + 1) };
  const count = ctx.secret ? 2 : 1;
  for (let i = 0; i < count; i++) {
    const it = rollEquipment(rng, ctx.region, rollRarity(rng, ctx.secret ? 'secret' : 'chest', (ctx.tierBump || 0) + (ctx.bonus || 0)));
    if (it) out.items.push(it);
  }
  out.items.push(makeItem(rng.pick(['hp_potion', 'hp_potion', 'mp_potion', 'fury_tonic', 'swift_draught']), rng, rng.int(1, 2)));
  return out;
}

// Boss drops. Signature legendaries are rare, but a pity counter guarantees one after a few
// unlucky kills. Mythics can drop anywhere a boss dies; Heroic dungeons raise every chance.
// ctx: {bossId, region, pity, heroic, mythicChance}
export const SIGNATURE_CHANCE = 0.18, SIGNATURE_PITY_STEP = 0.1, SIGNATURE_PITY_MAX = 6, HEROIC_SIGNATURE_BONUS = 0.15;

export function rollBossDrop(rng, ctx) {
  const out = { items: [], gold: rng.int(40, 70) * (ctx.region + 1), pity: ctx.pity || 0 };
  const signature = ITEMS.filter((b) => b.boss === ctx.bossId && !b.mythic);
  let gotLegendary = false;
  const chance = SIGNATURE_CHANCE + SIGNATURE_PITY_STEP * out.pity + (ctx.heroic ? HEROIC_SIGNATURE_BONUS : 0);
  if (signature.length && (rng.chance(chance) || out.pity >= SIGNATURE_PITY_MAX)) {
    out.items.push(makeItem(rng.pick(signature).id, rng));
    gotLegendary = true;
  }
  const extra = ctx.heroic ? 3 : 2;
  for (let i = 0; i < extra; i++) {
    const it = rollEquipment(rng, ctx.region, rollRarity(rng, 'boss', ctx.heroic ? 1 : 0));
    if (it) out.items.push(it);
  }
  // mythics: the boss's own mythic (mini-bosses) plus the shared pool
  const mythics = ITEMS.filter((b) => b.mythic && (b.boss === 'any' || b.boss === ctx.bossId));
  if (mythics.length && rng.chance(ctx.mythicChance ?? 0.015)) {
    const own = mythics.filter((b) => b.boss === ctx.bossId);
    out.items.push(makeItem(rng.pick(own.length && rng.chance(0.6) ? own : mythics).id, rng));
  }
  out.items.push(makeItem('hp_potion', rng, 2));
  out.pity = gotLegendary ? 0 : out.pity + 1;
  return out;
}

export function vendorStock(rng, maxRegion) {
  const stock = [];
  const rarities = ['uncommon', 'uncommon', 'rare', 'rare', 'epic'];
  for (const r of rarities) {
    const it = rollEquipment(rng, maxRegion, r);
    if (it && !stock.some((s) => s.base === it.base)) stock.push(it);
  }
  return stock;
}

export function sellPrice(item) {
  const base = getBase(item.base);
  return Math.max(1, Math.round((base?.value || 1) * (item.q || 1))) * (item.qty || 1);
}

export function buyPrice(item) {
  const base = getBase(item.base);
  if (base.price) return base.price;
  return Math.round((base.value || 5) * 3.5 * (item.q || 1));
}
