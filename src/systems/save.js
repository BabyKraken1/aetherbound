// Save data: defaults, validation/repair, and localStorage persistence (validation is unit tested).
import { SAVE_VERSION, INVENTORY_SIZE, SLOTS, MAX_LEVEL } from '../config.js';
import { CLASSES, CLASS_ORDER } from '../content/classes.js';
import { getBase } from '../content/items.js';
import { uid } from '../util.js';

export const DEFAULT_SETTINGS = { master: 0.7, sfx: 0.8, music: 0.5, shake: true, damageNumbers: true };

export function newClassState(classId) {
  const c = CLASSES[classId];
  const equip = Object.fromEntries(SLOTS.map((s) => [s, null]));
  for (const id of c.starter) {
    const b = getBase(id);
    equip[b.slot] = { uid: uid(), base: id, q: 1 };
  }
  return { level: 1, xp: 0, equip };
}

export function defaultSave() {
  const inventory = new Array(INVENTORY_SIZE).fill(null);
  inventory[0] = { uid: uid(), base: 'hp_potion', qty: 3 };
  inventory[1] = { uid: uid(), base: 'mp_potion', qty: 2 };
  return {
    v: SAVE_VERSION,
    created: Date.now(),
    currentClass: null,
    gold: 25,
    unlockedClasses: CLASS_ORDER.filter((c) => CLASSES[c].unlocked),
    regionsUnlocked: 1,
    bossesDefeated: [],
    heroicUnlocked: false,
    pity: 0,
    classes: Object.fromEntries(CLASS_ORDER.map((c) => [c, newClassState(c)])),
    inventory,
    settings: { ...DEFAULT_SETTINGS },
    tutorialDone: false,
    stats: { kills: 0, deaths: 0, runs: 0, clears: 0, playTime: 0 },
    discovered: [],          // every item base id ever picked up (for the index)
    skinsOwned: [],          // purchased skins as "class:skinId"
    selectedSkins: {},       // class -> skin id
    minibossesDefeated: [],
    worldSeed: Math.floor(Math.random() * 1e9),
  };
}

function validItem(it) {
  if (!it || typeof it !== 'object' || typeof it.base !== 'string') return null;
  const base = getBase(it.base);
  if (!base) return null;
  const out = { uid: typeof it.uid === 'string' ? it.uid : uid(), base: it.base };
  if (base.slot === 'consumable') out.qty = clampInt(it.qty, 1, base.stack || 1, 1);
  else out.q = typeof it.q === 'number' && isFinite(it.q) ? Math.min(1.3, Math.max(0.5, it.q)) : 1;
  return out;
}

const clampInt = (v, lo, hi, def) => (Number.isFinite(v) ? Math.max(lo, Math.min(hi, Math.round(v))) : def);
const num = (v, def) => (typeof v === 'number' && isFinite(v) ? v : def);

// Returns {save, warnings}. Never throws: anything unusable falls back to defaults.
export function validateSave(raw) {
  const warnings = [];
  const d = defaultSave();
  if (!raw || typeof raw !== 'object') return { save: d, warnings: ['No save data'] };
  if (raw.v !== SAVE_VERSION) warnings.push(`Save version ${raw.v} migrated`);
  const s = d;
  s.created = num(raw.created, d.created);
  s.gold = clampInt(raw.gold, 0, 1e7, d.gold);
  s.regionsUnlocked = clampInt(raw.regionsUnlocked, 1, 4, 1);
  s.heroicUnlocked = !!raw.heroicUnlocked;
  s.pity = clampInt(raw.pity, 0, 50, 0);
  s.tutorialDone = !!raw.tutorialDone;
  s.bossesDefeated = Array.isArray(raw.bossesDefeated) ? raw.bossesDefeated.filter((b) => typeof b === 'string') : [];
  if (Array.isArray(raw.unlockedClasses)) {
    const u = raw.unlockedClasses.filter((c) => CLASSES[c]);
    s.unlockedClasses = [...new Set([...d.unlockedClasses, ...u])];
  }
  s.currentClass = CLASSES[raw.currentClass] && s.unlockedClasses.includes(raw.currentClass) ? raw.currentClass : null;

  if (raw.classes && typeof raw.classes === 'object') {
    for (const c of CLASS_ORDER) {
      const rc = raw.classes[c];
      if (!rc || typeof rc !== 'object') continue;
      const cs = s.classes[c];
      cs.level = clampInt(rc.level, 1, MAX_LEVEL, 1);
      cs.xp = clampInt(rc.xp, 0, 1e9, 0);
      if (rc.equip && typeof rc.equip === 'object') {
        for (const slot of SLOTS) {
          const it = validItem(rc.equip[slot]);
          const base = it && getBase(it.base);
          if (it && base.slot === slot && (!base.cls || base.cls === c)) cs.equip[slot] = it;
          else if (rc.equip[slot]) warnings.push(`Dropped invalid ${slot} on ${c}`);
          else if (slot !== 'weapon' && slot !== 'armor') cs.equip[slot] = null;
        }
      }
    }
  } else warnings.push('Class data missing');

  if (Array.isArray(raw.inventory)) {
    s.inventory = new Array(INVENTORY_SIZE).fill(null);
    raw.inventory.slice(0, INVENTORY_SIZE).forEach((it, i) => {
      if (!it) return;
      const v = validItem(it);
      if (v) s.inventory[i] = v;
      else warnings.push('Dropped unknown item');
    });
  }
  if (raw.settings && typeof raw.settings === 'object') {
    for (const k of ['master', 'sfx', 'music']) s.settings[k] = Math.min(1, Math.max(0, num(raw.settings[k], DEFAULT_SETTINGS[k])));
    for (const k of ['shake', 'damageNumbers']) s.settings[k] = typeof raw.settings[k] === 'boolean' ? raw.settings[k] : DEFAULT_SETTINGS[k];
  }
  const strList = (v) => (Array.isArray(v) ? [...new Set(v.filter((x) => typeof x === 'string'))] : []);
  s.discovered = strList(raw.discovered).filter((id) => getBase(id));
  s.skinsOwned = strList(raw.skinsOwned);
  s.minibossesDefeated = strList(raw.minibossesDefeated);
  if (raw.selectedSkins && typeof raw.selectedSkins === 'object')
    for (const c of CLASS_ORDER) if (typeof raw.selectedSkins[c] === 'string') s.selectedSkins[c] = raw.selectedSkins[c];
  s.worldSeed = clampInt(raw.worldSeed, 0, 1e9, s.worldSeed);
  // older saves: everything already in the bag/equipped counts as discovered
  for (const it of s.inventory) if (it && !s.discovered.includes(it.base)) s.discovered.push(it.base);
  for (const c of CLASS_ORDER) for (const it of Object.values(s.classes[c].equip)) if (it && !s.discovered.includes(it.base)) s.discovered.push(it.base);
  if (raw.stats && typeof raw.stats === 'object') {
    for (const k of Object.keys(s.stats)) s.stats[k] = clampInt(raw.stats[k], 0, 1e9, 0);
  }
  return { save: s, warnings };
}

export function loadSave(storage, key) {
  try {
    const txt = storage.getItem(key);
    if (!txt) return { save: null, warnings: [] };
    const raw = JSON.parse(txt);
    return validateSave(raw);
  } catch (e) {
    try { storage.setItem(key + '.corrupt', storage.getItem(key) || ''); } catch {}
    return { save: null, warnings: ['Save file was corrupted and has been reset (a backup was kept).'], corrupt: true };
  }
}

export function writeSave(storage, key, save) {
  try {
    storage.setItem(key, JSON.stringify(save));
    return true;
  } catch {
    return false;
  }
}
