// Inventory / equipment / vendor screen rendering (HTML strings). Actions are handled in ui.js.
import { CLASSES } from '../content/classes.js';
import { getBase, EFFECT_TEXT } from '../content/items.js';
import { RARITY_COLOR, RARITY_LABEL, SLOTS, MAX_LEVEL } from '../config.js';
import { computeStats, summarizeStats, xpForLevel, itemStats, weaponOf } from '../systems/stats.js';
import { canEquip } from '../systems/inventory.js';
import { sellPrice, buyPrice } from '../systems/loot.js';
import { itemIcon, toURL, goldIcon } from '../render/sprites.js';

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const SLOT_LABEL = { weapon: 'Weapon', helm: 'Helm', armor: 'Armor', ring: 'Ring', relic: 'Relic', consumable: 'Consumable' };
const STAT_LABEL = { hp: 'Max HP', mp: 'Max MP', def: 'Defense', spd: 'Speed', crit: 'Crit chance', ap: 'Ability power', cdr: 'Cooldown reduction', hpRegen: 'HP regen/s', mpRegen: 'MP regen/s', dmgPct: 'Damage', rate: 'Attack speed' };
const PCT = new Set(['crit', 'cdr', 'dmgPct', 'rate']);
const CONSUMABLES_FOR_SALE = ['hp_potion', 'mp_potion', 'fury_tonic', 'swift_draught', 'return_scroll', 'phoenix_feather'];

function slotHtml(item, where, key, selected, extra = '') {
  if (!item) return `<div class="slot empty ${selected ? 'sel' : ''}" data-act="inv:select" data-where="${where}" data-key="${key}">${extra}</div>`;
  const b = getBase(item.base);
  const c = RARITY_COLOR[b.rarity];
  return `<div class="slot ${selected ? 'sel' : ''} r-${b.rarity}" style="--rc:${c}" data-act="inv:select" data-dbl="inv:quick" data-hover="1" data-where="${where}" data-key="${key}">
    <img src="${toURL(itemIcon(b, c))}">${(item.qty || 1) > 1 ? `<span class="qty">${item.qty}</span>` : ''}${extra}</div>`;
}

export function renderInventory(g, st) {
  const save = g.save, cls = save.currentClass, cs = save.classes[cls], c = CLASSES[cls];
  const isSel = (where, key) => st.sel && st.sel.where === where && String(st.sel.key) === String(key);
  const equip = SLOTS.map((s) => `<div class="eqrow">${slotHtml(cs.equip[s], 'equip', s, isSel('equip', s))}<span>${SLOT_LABEL[s]}</span></div>`).join('');
  const grid = save.inventory.map((it, i) => slotHtml(it, 'inv', i, isSel('inv', i))).join('');
  const stats = summarizeStats(g.player.stats);
  const statRows = Object.entries(stats).map(([k, v]) => `<div class="kv"><span>${k}</span><b>${v}</b></div>`).join('');
  const need = xpForLevel(cs.level);
  const gold = `<span class="goldline"><img src="${toURL(goldIcon())}">${save.gold}</span>`;

  let right = `<div class="grid">${grid}</div>`;
  let left = `
    <div class="charhead"><b style="color:${c.color}">${c.name}</b> <span>Level ${cs.level}</span></div>
    <div class="bar xp big"><i style="width:${cs.level >= MAX_LEVEL ? 100 : (100 * cs.xp) / need}%"></i><span>${cs.level >= MAX_LEVEL ? 'MAX LEVEL' : `${cs.xp} / ${need} XP`}</span></div>
    <div class="equip">${equip}</div>
    <div class="stats">${statRows}</div>`;
  if (st.mode === 'vendor') {
    const stock = g.vendorStock.map((it, i) => {
      const b = getBase(it.base);
      return `<div class="shoprow ${isSel('shop', i) ? 'sel' : ''}">${slotHtml(it, 'shop', i, isSel('shop', i))}
        <div class="sname" style="color:${RARITY_COLOR[b.rarity]}">${esc(b.name)}<small>${RARITY_LABEL[b.rarity]} ${SLOT_LABEL[b.slot]}${b.cls ? ' (' + CLASSES[b.cls].name + ')' : ''}</small></div>
        <button class="btn small ${save.gold < buyPrice(it) ? 'disabled' : ''}" data-act="inv:buy" data-key="${i}">${buyPrice(it)}g</button></div>`;
    }).join('') || '<div class="dim">Sold out. New stock arrives after your next expedition.</div>';
    const cons = CONSUMABLES_FOR_SALE.map((id) => {
      const b = getBase(id);
      return `<div class="shoprow">${slotHtml({ base: id }, 'con', id, false)}
        <div class="sname">${esc(b.name)}<small>${esc(b.desc)}</small></div>
        <button class="btn small ${save.gold < b.price ? 'disabled' : ''}" data-act="inv:buy" data-consumable="${id}">${b.price}g</button></div>`;
    }).join('');
    left = `<h4>Pell's wares</h4><div class="shop">${stock}</div><h4>Supplies</h4><div class="shop">${cons}</div>`;
    right = `<h4>Your bag (click an item to sell it)</h4><div class="grid">${grid}</div>
      <button class="btn small ${st.confirmSellAll ? 'danger' : ''}" data-act="inv:sellAll">${st.confirmSellAll ? 'Click again to confirm' : 'Sell all Common &amp; Uncommon gear'}</button>`;
  }
  return `
    <div class="invhead"><h2>${st.mode === 'vendor' ? 'Pell the Peddler' : 'Inventory'}</h2>${gold}
      <button class="btn small" data-act="inv:sort">Sort</button><button class="btn small" data-act="close">Close [Esc]</button></div>
    <div class="invbody">
      <div class="invleft">${left}</div>
      <div class="invright">${right}<div id="inv-detail" class="detail">${renderItemDetail(g, st)}</div></div>
    </div>`;
}

export function renderItemDetail(g, st) {
  const save = g.save, cls = save.currentClass, cs = save.classes[cls];
  const ref = st.hover || (st.sel ? { where: st.sel.where, key: String(st.sel.key) } : null);
  if (!ref) return '<div class="dim">Select an item to inspect it. Double-click to equip or use it.</div>';
  let item = null;
  if (ref.where === 'inv') item = save.inventory[Number(ref.key)];
  else if (ref.where === 'equip') item = cs.equip[ref.key];
  else if (ref.where === 'shop') item = g.vendorStock[Number(ref.key)];
  else if (ref.where === 'con') item = { base: ref.key };
  if (!item) return '<div class="dim">Empty slot</div>';
  const b = getBase(item.base);
  const col = RARITY_COLOR[b.rarity];
  const lines = [];
  const w = weaponOf(item);
  if (w) {
    lines.push(`<div class="kv"><span>Damage</span><b>${w.dmg[0]}–${w.dmg[1]}${w.shots > 1 ? ` x${w.shots}` : ''}</b></div>`);
    lines.push(`<div class="kv"><span>Attacks/sec</span><b>${w.rate}</b></div>`);
    lines.push(`<div class="kv"><span>Range</span><b>${(w.range / 16).toFixed(1)} tiles</b></div>`);
    if (w.pierce) lines.push(`<div class="kv"><span>Pierces</span><b>${w.pierce} enemies</b></div>`);
  }
  for (const [k, v] of Object.entries(itemStats(item))) {
    const val = PCT.has(k) ? `${v > 0 ? '+' : ''}${Math.round(v * 100)}%` : `${v > 0 ? '+' : ''}${Math.round(v * 10) / 10}`;
    lines.push(`<div class="kv ${v < 0 ? 'neg' : ''}"><span>${STAT_LABEL[k]}</span><b>${val}</b></div>`);
  }
  for (const e of b.effects || []) if (EFFECT_TEXT[e] && !(w && (e === 'pierce' || e === 'homing'))) lines.push(`<div class="effect">${esc(EFFECT_TEXT[e])}</div>`);
  if (b.mods) lines.push(`<div class="effect">${esc(b.desc)}</div>`);

  // comparison: how the character sheet changes if this item is equipped
  let compare = '';
  const check = canEquip(item, cls);
  if (ref.where !== 'equip' && check.ok) {
    const now = summarizeStats(computeStats(CLASSES[cls], cs.level, cs.equip, g.player.buffs));
    const swapped = { ...cs.equip, [b.slot]: item };
    const then = summarizeStats(computeStats(CLASSES[cls], cs.level, swapped, g.player.buffs));
    const diffs = [];
    for (const k of Object.keys(now)) {
      const a = parseFloat(now[k]), z = parseFloat(then[k]);
      if (a === z) continue;
      const up = z > a;
      diffs.push(`<div class="kv"><span>${k}</span><b class="${up ? 'up' : 'down'}">${now[k]} → ${then[k]}</b></div>`);
    }
    const cur = cs.equip[b.slot];
    compare = `<div class="compare"><h5>If equipped${cur ? ` (replacing ${esc(getBase(cur.base).name)})` : ''}</h5>${diffs.join('') || '<div class="dim">No change</div>'}</div>`;
  } else if (!check.ok && b.slot !== 'consumable') compare = `<div class="warn">${esc(check.reason)}</div>`;

  const q = item.q ? `<span class="q">${Math.round(item.q * 100)}% quality</span>` : '';
  let buttons = '';
  if (st.sel && String(st.sel.key) === String(ref.key) && st.sel.where === ref.where) {
    if (ref.where === 'inv') {
      if (b.slot === 'consumable') buttons += `<button class="btn small primary" data-act="inv:use">Use</button>`;
      else buttons += `<button class="btn small primary ${check.ok ? '' : 'disabled'}" data-act="inv:equip">Equip</button>`;
      if (st.mode === 'vendor') buttons += `<button class="btn small" data-act="inv:sell">Sell for ${sellPrice(item)}g</button>`;
      else buttons += `<button class="btn small ${st.confirmDrop ? 'danger' : ''}" data-act="inv:drop">${st.confirmDrop ? 'Confirm discard' : 'Discard'}</button>`;
    }
    if (ref.where === 'equip' && ref.key !== 'weapon') buttons += `<button class="btn small" data-act="inv:unequip">Unequip</button>`;
  }
  return `
    <div class="dname" style="color:${col}">${esc(b.name)}</div>
    <div class="dtype">${RARITY_LABEL[b.rarity]} ${SLOT_LABEL[b.slot]}${b.cls ? ' &middot; ' + CLASSES[b.cls].name + ' only' : ''} ${q}</div>
    ${lines.join('')}
    <div class="desc">${esc(b.mods ? '' : b.desc)}</div>
    ${compare}
    <div class="dbuttons">${buttons}</div>`;
}
