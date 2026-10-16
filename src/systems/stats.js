// Pure stat math: class base + level growth + equipment + temporary buffs.
import { getBase } from '../content/items.js';
import { MAX_LEVEL } from '../config.js';

export const BASE_SPEED = 78; // px/s before the spd stat

export function xpForLevel(level) {
  // xp required to go from `level` to `level + 1`
  return Math.round(45 + 30 * Math.pow(level, 1.55));
}

// Adds xp to a class progress record {level, xp}. Returns number of levels gained.
export function addXp(progress, amount) {
  let gained = 0;
  if (progress.level >= MAX_LEVEL) return 0;
  progress.xp += amount;
  while (progress.level < MAX_LEVEL && progress.xp >= xpForLevel(progress.level)) {
    progress.xp -= xpForLevel(progress.level);
    progress.level++;
    gained++;
  }
  if (progress.level >= MAX_LEVEL) progress.xp = 0;
  return gained;
}

// Stats contributed by one item instance (rolled quality scales its numbers).
export function itemStats(item) {
  const base = getBase(item.base);
  if (!base || !base.stats) return {};
  const q = item.q ?? 1;
  const out = {};
  for (const [k, v] of Object.entries(base.stats)) {
    // only positive stats scale with roll quality; drawbacks stay fixed
    out[k] = v > 0 ? round2(v * q) : v;
  }
  return out;
}

export function weaponOf(item) {
  const base = item && getBase(item.base);
  if (!base || !base.weapon) return null;
  const q = item.q ?? 1;
  const w = base.weapon;
  return {
    ...w,
    dmg: [Math.round(w.dmg[0] * q), Math.round(w.dmg[1] * q)],
    shots: w.shots ?? 1,
    spread: w.spread ?? 0,
    pierce: w.pierce ?? 0,
    size: w.size ?? 3,
  };
}

const round2 = (v) => Math.round(v * 100) / 100;

// classDef: from content/classes.js; level: number; equipped: {slot: item|null}; buffs: [{stats}]
export function computeStats(classDef, level, equipped, buffs = []) {
  const b = classDef.base, g = classDef.growth;
  const s = {
    maxHp: b.hp + g.hp * (level - 1),
    maxMp: b.mp + g.mp * (level - 1),
    def: b.def + g.def * (level - 1),
    spd: b.spd,
    crit: b.crit,
    ap: b.ap,
    cdr: b.cdr,
    hpRegen: b.hpRegen + 0.1 * (level - 1),
    mpRegen: b.mpRegen + 0.1 * (level - 1),
    dmgMult: 1 + 0.04 * (level - 1),
    rate: 0,
    effects: new Set(),
    mods: {},
    weapon: null,
  };
  for (const item of Object.values(equipped || {})) {
    if (!item) continue;
    const base = getBase(item.base);
    if (!base) continue;
    const st = itemStats(item);
    if (st.hp) s.maxHp += st.hp;
    if (st.mp) s.maxMp += st.mp;
    if (st.def) s.def += st.def;
    if (st.spd) s.spd += st.spd;
    if (st.crit) s.crit += st.crit;
    if (st.ap) s.ap += st.ap;
    if (st.cdr) s.cdr += st.cdr;
    if (st.hpRegen) s.hpRegen += st.hpRegen;
    if (st.mpRegen) s.mpRegen += st.mpRegen;
    if (st.dmgPct) s.dmgMult += st.dmgPct;
    if (st.rate) s.rate += st.rate;
    for (const e of base.effects || []) s.effects.add(e);
    if (base.mods) {
      for (const [ab, m] of Object.entries(base.mods)) {
        s.mods[ab] = { ...(s.mods[ab] || {}) };
        for (const [k, v] of Object.entries(m)) s.mods[ab][k] = (s.mods[ab][k] || 0) + v;
      }
    }
    if (base.slot === 'weapon') s.weapon = weaponOf(item);
  }
  for (const buff of buffs) {
    const st = buff.stats || {};
    if (st.dmgPct) s.dmgMult += st.dmgPct;
    if (st.spd) s.spd += st.spd;
    if (st.rate) s.rate += st.rate;
    if (st.def) s.def += st.def;
  }
  s.maxHp = Math.max(30, Math.round(s.maxHp));
  s.maxMp = Math.max(10, Math.round(s.maxMp));
  s.def = Math.round(s.def * 10) / 10;
  s.crit = Math.min(0.75, s.crit);
  s.cdr = Math.min(0.45, s.cdr);
  s.speed = Math.max(40, BASE_SPEED + s.spd);
  return s;
}

// The headline numbers shown in the stats panel
export function summarizeStats(s) {
  const w = s.weapon;
  const avg = w ? ((w.dmg[0] + w.dmg[1]) / 2) * s.dmgMult * (w.shots || 1) : 0;
  const rate = w ? w.rate * (1 + s.rate) : 0;
  return {
    'Max HP': s.maxHp,
    'Max MP': s.maxMp,
    Damage: Math.round(avg),
    'Atk/sec': Math.round(rate * 10) / 10,
    Defense: s.def,
    Speed: Math.round(s.speed),
    Crit: Math.round(s.crit * 100) + '%',
    'Ability Pwr': Math.round(s.ap),
    'Cooldown -': Math.round(s.cdr * 100) + '%',
  };
}
