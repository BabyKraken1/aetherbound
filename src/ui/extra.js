// Extra screens: item index, wardrobe (skins), admin panel, rare-drop popup, and the bottom hotbar.
import { CLASSES } from '../content/classes.js';
import { ITEMS, getBase, EFFECT_TEXT } from '../content/items.js';
import { ALL_BOSSES, BOSSES, MINIBOSSES } from '../content/bosses.js';
import { SKINS, skinUnlocked, unlockText, skinSpriteName } from '../content/skins.js';
import { RARITY_COLOR, RARITY_LABEL, SLOTS, RARITIES } from '../config.js';
import { itemIcon, abilityIcon, toURL, drawSprite } from '../render/sprites.js';
import { weaponOf, itemStats } from '../systems/stats.js';

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const icon = (b) => toURL(itemIcon(b, RARITY_COLOR[b.rarity]));

function sourceOf(b) {
  if (b.boss === 'any') return 'Any boss (rare)';
  if (b.boss && ALL_BOSSES[b.boss]) return (MINIBOSSES[b.boss] ? 'Mini-boss: ' : 'Boss: ') + ALL_BOSSES[b.boss].name;
  return 'Anywhere';
}

function shortStats(b) {
  const parts = [];
  const w = weaponOf({ base: b.id, q: 1 });
  if (w) parts.push(`${w.dmg[0]}–${w.dmg[1]} dmg${w.shots > 1 ? ' x' + w.shots : ''}`);
  for (const [k, v] of Object.entries(itemStats({ base: b.id, q: 1 }))) {
    const pct = ['crit', 'cdr', 'dmgPct', 'rate'].includes(k);
    parts.push(`${v > 0 ? '+' : ''}${pct ? Math.round(v * 100) + '%' : v} ${{ hp: 'HP', mp: 'MP', def: 'DEF', spd: 'SPD', crit: 'Crit', ap: 'AP', cdr: 'CDR', hpRegen: 'HP/s', mpRegen: 'MP/s', dmgPct: 'DMG', rate: 'Atk spd' }[k]}`);
  }
  for (const e of b.effects || []) if (EFFECT_TEXT[e]) parts.push(EFFECT_TEXT[e]);
  return parts.join(' · ');
}

// ───────── Index ─────────
export function indexHtml(g) {
  const found = new Set(g.save.discovered);
  const legend = ITEMS.filter((b) => b.rarity === 'legendary');
  const myth = ITEMS.filter((b) => b.rarity === 'mythic');
  const card = (b) => {
    const got = found.has(b.id);
    if (b.rarity === 'mythic' && !got)
      return `<div class="idx-card unknown" style="--rc:${RARITY_COLOR.mythic}"><div class="idx-icon q">?</div><div><b>???</b><small>Mythic · ${esc(sourceOf(b))}</small></div></div>`;
    return `<div class="idx-card ${got ? 'got' : 'missing'}" style="--rc:${RARITY_COLOR[b.rarity]}">
      <div class="idx-icon"><img src="${icon(b)}"></div>
      <div><b>${esc(b.name)}</b>${got ? ' <span class="ok">✓</span>' : ''}<small>${RARITY_LABEL[b.rarity]} ${b.cls ? CLASSES[b.cls].name + ' ' : ''}${b.slot} · ${esc(sourceOf(b))}</small><small class="st">${esc(shortStats(b))}</small></div></div>`;
  };
  const nl = legend.filter((b) => found.has(b.id)).length, nm = myth.filter((b) => found.has(b.id)).length;
  return `<div class="panel wide">
    <h2>Item Index</h2>
    <div class="sub">Legendaries ${nl} / ${legend.length} · Mythics ${nm} / ${myth.length}. Mythics stay a mystery until you find one.</div>
    <h4 style="color:${RARITY_COLOR.mythic}">Mythic</h4><div class="idx-grid">${myth.map(card).join('')}</div>
    <h4 style="color:${RARITY_COLOR.legendary}">Legendary</h4><div class="idx-grid">${legend.map(card).join('')}</div>
    <div class="menu row"><button class="btn primary" data-act="close">Close [K]</button></div>
  </div>`;
}

// ───────── Wardrobe ─────────
export function wardrobeHtml(g) {
  const save = g.save, cls = save.currentClass;
  const sel = save.selectedSkins[cls] || 'default';
  const cards = SKINS[cls].map((skin) => {
    const unlocked = skinUnlocked(save, cls, skin);
    const buy = skin.unlock?.type === 'buy' && !unlocked;
    const active = sel === skin.id;
    return `<div class="card ${unlocked ? '' : 'locked'} ${active ? 'current' : ''}" style="--accent:${CLASSES[cls].color}" ${unlocked ? `data-act="pickSkin" data-skin="${skin.id}"` : ''}>
      <canvas class="preview" data-skinpreview="${skinSpriteName(cls, skin.id)}" width="32" height="28"></canvas>
      <h3>${esc(skin.name)}</h3>
      <div class="role">${active ? 'Equipped' : unlocked ? 'Click to wear' : esc(unlockText(cls, skin))}</div>
      ${buy ? `<button class="btn small primary ${save.gold < skin.unlock.price ? 'disabled' : ''}" data-act="buySkin" data-skin="${skin.id}">Buy ${skin.unlock.price}g</button>` : ''}
    </div>`;
  }).join('');
  return `<div class="panel wide">
    <h2>Wardrobe: ${CLASSES[cls].name}</h2>
    <div class="sub">Skins are cosmetic. Unlock them by leveling, beating bosses, hunting mini-bosses, finding Mythics, or buying them.</div>
    <div class="cards">${cards}</div>
    <button class="btn primary" data-act="close">Close</button>
  </div>`;
}

export function drawSkinPreviews(root) {
  const cans = root.querySelectorAll('[data-skinpreview]');
  let f = 0;
  const draw = () => {
    f++;
    cans.forEach((c) => {
      const x = c.getContext('2d');
      x.imageSmoothingEnabled = false;
      x.clearRect(0, 0, c.width, c.height);
      drawSprite(x, c.dataset.skinpreview, 2 + (Math.floor(f / 4) % 2), 16, 25);
    });
  };
  draw();
  return setInterval(draw, 60);
}

// ───────── Admin panel ─────────
export function adminRows(filter = '') {
  const f = filter.trim().toLowerCase();
  const order = Object.fromEntries(RARITIES.map((r, i) => [r, -i]));
  return ITEMS.filter((b) => !f || b.name.toLowerCase().includes(f) || b.rarity.includes(f) || (b.cls || '').includes(f) || b.slot.includes(f))
    .sort((a, b) => order[a.rarity] - order[b.rarity] || a.name.localeCompare(b.name))
    .map((b) => `<div class="adm-row"><img src="${icon(b)}"><span style="color:${RARITY_COLOR[b.rarity]}">${esc(b.name)}</span><small>${b.rarity} ${b.cls || ''} ${b.slot}</small>
    <button class="btn small" data-act="adminGive" data-item="${b.id}">Give</button></div>`).join('') || '<div class="dim">No matches</div>';
}

export function adminHtml(g, filter = '') {
  const rows = adminRows(filter);
  const bossBtn = (id, b) => `<button class="btn small" data-act="adminBoss" data-boss="${id}" style="border-color:${b.color}">${esc(b.name)}</button>`;
  return `<div class="panel wide admin">
    <div class="invhead"><h2>Admin Panel</h2><span class="dim">Toggle with the \` key</span><button class="btn small" data-act="close">Close</button></div>
    <div class="cols">
      <div>
        <h4>Give item</h4>
        <input class="adm-search" data-admin-search placeholder="Search items (name, rarity, class, slot)..." value="${esc(filter)}">
        <div class="adm-list" id="adm-list">${rows}</div>
      </div>
      <div>
        <h4>Spawn boss (near you)</h4>
        <div class="adm-btns">${Object.entries(BOSSES).map(([id, b]) => bossBtn(id, b)).join('')}</div>
        <h4>Spawn mini-boss</h4>
        <div class="adm-btns">${Object.entries(MINIBOSSES).map(([id, b]) => bossBtn(id, b)).join('')}</div>
        <h4>Cheats</h4>
        <div class="adm-btns">
          <button class="btn small" data-act="adminCheat" data-cheat="gold">+1000 gold</button>
          <button class="btn small" data-act="adminCheat" data-cheat="level">+5 levels</button>
          <button class="btn small" data-act="adminCheat" data-cheat="heal">Full heal</button>
          <button class="btn small ${g.god ? 'primary' : ''}" data-act="adminCheat" data-cheat="god">God mode: ${g.god ? 'ON' : 'OFF'}</button>
          <button class="btn small" data-act="adminCheat" data-cheat="unlock">Unlock everything</button>
          <button class="btn small" data-act="adminCheat" data-cheat="clear">Kill all enemies</button>
        </div>
      </div>
    </div>
  </div>`;
}
// ───────── Rare drop popup ─────────
export function lootPopupHtml(b, isNew) {
  const mythic = b.rarity === 'mythic';
  return `<div class="lp-rays"></div>
    <div class="lp-card ${mythic ? 'mythic' : 'legendary'}">
      <div class="lp-title">${mythic ? 'MYTHIC DROP!!' : 'LEGENDARY DROP!'}</div>
      <img class="lp-icon" src="${icon(b)}">
      <div class="lp-name" style="color:${RARITY_COLOR[b.rarity]}">${esc(b.name)}</div>
      <div class="lp-sub">${esc(b.desc || '')}</div>
      ${isNew ? '<div class="lp-new">NEW: added to your Index</div>' : ''}
    </div>`;
}

// ───────── Hotbar (equipped + first bag slots + compact ability chips) ─────────
export const HOTBAR_BAG = 8;
export function hotbarSignature(g) {
  const cs = g.classState();
  return g.save.currentClass + '|' + SLOTS.map((s) => cs.equip[s]?.uid || '-').join(',') + '|' +
    g.save.inventory.slice(0, HOTBAR_BAG).map((it) => (it ? it.uid + ':' + (it.qty || 1) : '-')).join(',');
}
export function hotbarHtml(g) {
  const cs = g.classState(), c = CLASSES[g.save.currentClass];
  const slot = (it, where, key, label) => {
    if (!it) return `<div class="hb-slot empty" data-act="hot" data-where="${where}" data-key="${key}"><span class="hb-label">${label}</span></div>`;
    const b = getBase(it.base);
    return `<div class="hb-slot" style="--rc:${RARITY_COLOR[b.rarity]}" data-act="hot" data-where="${where}" data-key="${key}" title="${esc(b.name)}${where === 'inv' ? ' (click to ' + (b.slot === 'consumable' ? 'use' : 'equip') + ')' : ''}">
      <img src="${icon(b)}">${(it.qty || 1) > 1 ? `<span class="qty">${it.qty}</span>` : ''}<span class="hb-label">${label}</span></div>`;
  };
  const equip = SLOTS.map((s) => slot(cs.equip[s], 'equip', s, s[0].toUpperCase() + s.slice(1, 4))).join('');
  const bag = g.save.inventory.slice(0, HOTBAR_BAG).map((it, i) => slot(it, 'inv', i, '')).join('');
  const chips = c.abilities.map((ab, i) => `<div class="chip" id="chip-${i}" title="${esc(ab.name + ': ' + ab.desc)}"><img src="${toURL(abilityIcon(ab.id))}"><span>${i === 0 ? 'Q' : ab.key}</span><i class="cd"></i></div>`).join('') +
    `<div class="chip" id="chip-dodge" title="Dodge roll"><b>»</b><span>SPC</span><i class="cd"></i></div>`;
  return `<div class="hb-chips">${chips}</div><div class="hb-row"><div class="hb-group">${equip}</div><div class="sep"></div><div class="hb-group">${bag}</div><button class="hb-more" data-act="inventory" title="Open full inventory (I)">BAG</button></div>`;
}
