// Pure inventory / equipment operations on the save profile (unit tested).
import { getBase } from '../content/items.js';
import { INVENTORY_SIZE, SLOTS } from '../config.js';

export function emptyInventory() {
  return new Array(INVENTORY_SIZE).fill(null);
}

export function freeSlots(inv) {
  return inv.filter((x) => !x).length;
}

// Adds an item, stacking consumables. Returns true if fully added.
export function addItem(inv, item) {
  const base = getBase(item.base);
  if (!base) return false;
  if (base.stack) {
    for (const it of inv) {
      if (it && it.base === item.base && (it.qty || 1) < base.stack) {
        const room = base.stack - (it.qty || 1);
        const moving = Math.min(room, item.qty || 1);
        it.qty = (it.qty || 1) + moving;
        item.qty = (item.qty || 1) - moving;
        if (item.qty <= 0) return true;
      }
    }
  }
  const i = inv.indexOf(null);
  if (i === -1) return false;
  inv[i] = item;
  return true;
}

export function countItem(inv, baseId) {
  let n = 0;
  for (const it of inv) if (it && it.base === baseId) n += it.qty || 1;
  return n;
}

// Removes `qty` from the stack at index i (or the whole item). Returns removed item or null.
export function removeAt(inv, i, qty = Infinity) {
  const it = inv[i];
  if (!it) return null;
  const have = it.qty || 1;
  if (qty >= have) {
    inv[i] = null;
    return it;
  }
  it.qty = have - qty;
  return { ...it, qty };
}

// Consumes one of baseId from the first matching stack; returns true if one was consumed.
export function consumeOne(inv, baseId) {
  const i = inv.findIndex((it) => it && it.base === baseId);
  if (i === -1) return false;
  removeAt(inv, i, 1);
  return true;
}

export function canEquip(item, classId) {
  const base = item && getBase(item.base);
  if (!base || !SLOTS.includes(base.slot)) return { ok: false, reason: 'Not equipment' };
  if (base.cls && base.cls !== classId) return { ok: false, reason: `${cap(base.cls)} only` };
  return { ok: true };
}

// Swap inventory[i] into the class's equipment slot. classState: {equip: {slot:item}}
export function equipFromInventory(inv, classState, classId, i) {
  const item = inv[i];
  const check = canEquip(item, classId);
  if (!check.ok) return check;
  const slot = getBase(item.base).slot;
  const prev = classState.equip[slot] || null;
  classState.equip[slot] = item;
  inv[i] = prev;
  return { ok: true, slot, prev };
}

export function unequip(inv, classState, slot) {
  const item = classState.equip[slot];
  if (!item) return { ok: false, reason: 'Nothing equipped' };
  if (slot === 'weapon') return { ok: false, reason: 'You always need a weapon' };
  const i = inv.indexOf(null);
  if (i === -1) return { ok: false, reason: 'Inventory full' };
  inv[i] = item;
  classState.equip[slot] = null;
  return { ok: true };
}

export function sortInventory(inv) {
  const order = { weapon: 0, helm: 1, armor: 2, ring: 3, relic: 4, consumable: 5 };
  const rar = { mythic: 0, legendary: 1, epic: 2, rare: 3, uncommon: 4, common: 5 };
  const items = inv.filter(Boolean).sort((a, b) => {
    const A = getBase(a.base), B = getBase(b.base);
    return (order[A.slot] - order[B.slot]) || (rar[A.rarity] - rar[B.rarity]) || A.name.localeCompare(B.name);
  });
  for (let i = 0; i < inv.length; i++) inv[i] = items[i] || null;
}

const cap = (s) => s[0].toUpperCase() + s.slice(1);
