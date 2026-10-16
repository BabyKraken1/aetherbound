// DOM user interface: HUD, menus and overlays. One delegated listener per event type, so screens
// can re-render freely without leaking handlers.
import { CLASSES, CLASS_ORDER } from '../content/classes.js';
import { REGIONS } from '../content/regions.js';
import { BOSSES } from '../content/bosses.js';
import { getBase } from '../content/items.js';
import { RARITY_COLOR, ABILITY3_LEVEL, MAX_LEVEL, TILE } from '../config.js';
import { computeStats, xpForLevel } from '../systems/stats.js';
import { equipFromInventory, unequip, removeAt, sortInventory, countItem, addItem } from '../systems/inventory.js';
import { sellPrice, buyPrice, makeItem } from '../systems/loot.js';
import { itemIcon, abilityIcon, toURL, drawSprite, goldIcon } from '../render/sprites.js';
import { formatTime, RNG } from '../util.js';
import { renderInventory, renderItemDetail } from './inventory.js';
import { indexHtml, wardrobeHtml, drawSkinPreviews, adminHtml, adminRows, lootPopupHtml, hotbarHtml, hotbarSignature } from './extra.js';
import { SKINS, skinUnlocked, skinSpriteName } from '../content/skins.js';
import { THEME_IDS } from '../world/overworld.js';

const $ = (sel, root = document) => root.querySelector(sel);
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

export class UI {
  constructor(root) {
    this.root = root;
    this.game = null;
    this.cache = {};
    this.toasts = [];
    this.minimapOn = true;
    root.innerHTML = TEMPLATE;
    this.el = {
      hud: $('#hud', root), hp: $('#hp-fill', root), hpBar: $('#hp-barrier', root), hpText: $('#hp-text', root),
      mp: $('#mp-fill', root), mpText: $('#mp-text', root), xp: $('#xp-fill', root), lvl: $('#hud-level', root), cls: $('#hud-class', root),
      portrait: $('#hud-portrait', root), buffs: $('#hud-buffs', root), gold: $('#hud-gold', root), region: $('#hud-region', root),
      objective: $('#hud-objective', root), minimap: $('#minimap', root), actions: $('#actionbar', root), prompt: $('#prompt', root),
      toasts: $('#toasts', root), banner: $('#banner', root), boss: $('#bossbar', root), bossFill: $('#boss-fill', root), bossName: $('#boss-name', root),
      tutorial: $('#tutorial', root), hurt: $('#hurt', root), roomInfo: $('#room-info', root), overlay: $('#overlay', root),
      popup: $('#loot-popup', root), flash: $('#mythic-flash', root),
    };
    this.buildActionBar();
    root.addEventListener('click', (e) => {
      const el = e.target.closest('[data-act]');
      if (!el || el.classList.contains('disabled')) return;
      this.game?.audio.unlock();
      this.act(el.dataset.act, el.dataset, e);
    });
    root.addEventListener('dblclick', (e) => {
      const el = e.target.closest('[data-dbl]');
      if (el) this.act(el.dataset.dbl, el.dataset, e);
    });
    root.addEventListener('input', (e) => {
      const el = e.target.closest('[data-setting]');
      if (el) this.setSetting(el.dataset.setting, el.type === 'checkbox' ? el.checked : Number(el.value) / 100);
      const search = e.target.closest('[data-admin-search]');
      if (search) { this.adminFilter = search.value; const list = $('#adm-list', this.el.overlay); if (list) list.innerHTML = adminRows(search.value); }
    });
    root.addEventListener('mouseover', (e) => {
      const b = e.target.closest('.btn, .card, .slot');
      if (b && b !== this.lastHover) { this.lastHover = b; this.game?.audio.play('hover'); }
      const s = e.target.closest('[data-hover]');
      if (s && this.inv) { this.inv.hover = { where: s.dataset.where, key: s.dataset.key }; this.refreshDetail(); }
    });
    root.addEventListener('mouseout', (e) => {
      const s = e.target.closest('[data-hover]');
      if (s && this.inv) { this.inv.hover = null; this.refreshDetail(); }
    });
  }

  // ───────────────────────── screens ─────────────────────────
  showOverlay(html, cls = '') {
    this.stopPreviews();
    this.el.overlay.className = 'overlay show ' + cls;
    this.el.overlay.innerHTML = html;
  }
  hideOverlays() {
    this.stopPreviews();
    this.inv = null;
    this.el.overlay.className = 'overlay';
    this.el.overlay.innerHTML = '';
  }
  hideAll() {
    this.hideOverlays();
    this.el.hud.classList.add('show');
  }

  showTitle(hasSave, save) {
    this.el.hud.classList.remove('show');
    const cont = hasSave && save.currentClass ? `<button class="btn big primary" data-act="continue">Continue <small>${CLASSES[save.currentClass].name} Lv ${save.classes[save.currentClass].level}</small></button>` : '';
    this.showOverlay(`
      <div class="title-screen">
        <div class="logo"><span class="logo-a">AETHER</span><span class="logo-b">BOUND</span></div>
        <div class="tagline">Shards of the Riftlands</div>
        <div class="menu">
          ${cont}
          <button class="btn big ${cont ? '' : 'primary'}" data-act="${hasSave ? 'confirmNew' : 'newGame'}">New Game</button>
          <button class="btn" data-act="settings">Settings</button>
          <button class="btn" data-act="controls">Controls</button>
        </div>
        <div class="foot">A pixel-art action RPG. Explore, fight, loot, repeat. Best with a mouse and keyboard.</div>
      </div>`, 'title');
  }

  showClassSelect(isNew) {
    const g = this.game, save = g.save;
    const cards = CLASS_ORDER.map((id) => {
      const c = CLASSES[id];
      const unlocked = save.unlockedClasses.includes(id);
      const cs = save.classes[id];
      const s = computeStats(c, cs.level, cs.equip);
      const abil = c.abilities.map((a, i) => `<div class="abil"><img src="${toURL(abilityIcon(a.id))}"><span><b>[${a.key}] ${a.name}</b>${i === 2 ? ` <i>Lv ${ABILITY3_LEVEL}</i>` : ''}<br>${esc(a.desc.replace(/ \(Lv \d+\)/, ''))}</span></div>`).join('');
      return `<div class="card ${unlocked ? '' : 'locked'} ${save.currentClass === id ? 'current' : ''}" ${unlocked ? `data-act="pickClass" data-cls="${id}"` : ''} style="--accent:${c.color}">
        <canvas class="preview" data-preview="${skinSpriteName(id, save.selectedSkins[id])}" width="32" height="28"></canvas>
        <h3>${c.name}</h3><div class="role">${c.role} &middot; Lv ${cs.level}</div>
        <p>${esc(c.desc)}</p>
        <div class="statline"><span>HP</span><div class="mini"><i style="width:${Math.min(100, s.maxHp / 2)}%;background:#ff4f5e"></i></div><span>${s.maxHp}</span></div>
        <div class="statline"><span>MP</span><div class="mini"><i style="width:${Math.min(100, s.maxMp / 1.6)}%;background:#4f8bff"></i></div><span>${s.maxMp}</span></div>
        ${abil}
        ${unlocked ? '' : `<div class="lock">${esc(c.unlockText)}</div>`}
      </div>`;
    }).join('');
    this.showOverlay(`
      <div class="panel wide">
        <h2>${isNew ? 'Choose your hero' : 'Shrine of Echoes'}</h2>
        <div class="sub">${isNew ? 'You can switch class at any time from the shrine in town. Each class levels up separately.' : 'Each class keeps its own level and equipment. Your bag and gold are shared.'}</div>
        <div class="cards">${cards}</div>
        <div class="menu row">${isNew ? '<button class="btn" data-act="toTitle">Back</button>' : '<button class="btn" data-act="wardrobe">Wardrobe (skins)</button><button class="btn" data-act="close">Close</button>'}</div>
      </div>`);
    this.classSelectNew = isNew;
    this.startPreviews();
  }

  startPreviews() {
    const cans = this.el.overlay.querySelectorAll('[data-preview]');
    let f = 0;
    const draw = () => {
      f++;
      cans.forEach((c) => {
        const x = c.getContext('2d');
        x.imageSmoothingEnabled = false;
        x.clearRect(0, 0, c.width, c.height);
        drawSprite(x, c.dataset.preview, 2 + (Math.floor(f / 4) % 2), 16, 25);
      });
    };
    draw();
    this.previewTimer = setInterval(draw, 60);
  }
  stopPreviews() { if (this.previewTimer) clearInterval(this.previewTimer); this.previewTimer = null; }

  showIndex(g) { this.showOverlay(indexHtml(g)); }
  showWardrobe(g) { this.showOverlay(wardrobeHtml(g)); this.previewTimer = drawSkinPreviews(this.el.overlay); }
  showAdmin(g) {
    this.showOverlay(adminHtml(g, this.adminFilter || ''));
    const inp = $('[data-admin-search]', this.el.overlay);
    if (inp) inp.focus();
  }
  lootPopup(base, isNew) {
    const el = this.el.popup;
    el.className = 'loot-popup ' + base.rarity;
    el.innerHTML = lootPopupHtml(base, isNew);
    void el.offsetWidth;
    el.classList.add('show');
    clearTimeout(this.popupT);
    this.popupT = setTimeout(() => el.classList.remove('show'), base.rarity === 'mythic' ? 4200 : 3000);
    if (base.rarity === 'mythic') { this.el.flash.classList.remove('go'); void this.el.flash.offsetWidth; this.el.flash.classList.add('go'); }
  }

  showPause(inDungeon) {
    this.showOverlay(`
      <div class="panel narrow">
        <h2>Paused</h2>
        <div class="menu">
          <button class="btn primary" data-act="close">Resume</button>
          <button class="btn" data-act="inventory">Inventory</button>
          <button class="btn" data-act="index">Item Index</button>
          <button class="btn" data-act="wardrobe">Wardrobe (skins)</button>
          <button class="btn" data-act="settings">Settings</button>
          <button class="btn" data-act="controls">Controls</button>
          ${inDungeon ? '<button class="btn danger" data-act="confirmAbandon">Abandon run</button>' : ''}
          <button class="btn" data-act="quit">Save &amp; quit to title</button>
        </div>
      </div>`);
  }

  showSettings(back) {
    const s = this.game.save.settings;
    this.settingsBack = back;
    const slider = (k, label) => `<label class="setting"><span>${label}</span><input type="range" min="0" max="100" value="${Math.round(s[k] * 100)}" data-setting="${k}"></label>`;
    const toggle = (k, label) => `<label class="setting"><span>${label}</span><input type="checkbox" ${s[k] ? 'checked' : ''} data-setting="${k}"></label>`;
    this.showOverlay(`
      <div class="panel narrow">
        <h2>Settings</h2>
        ${slider('master', 'Master volume')}${slider('sfx', 'Sound effects')}${slider('music', 'Music')}
        ${toggle('shake', 'Screen shake')}${toggle('damageNumbers', 'Damage numbers')}
        <div class="menu">
          <button class="btn primary" data-act="settingsBack">Done</button>
          <button class="btn danger small" data-act="confirmReset">Erase save data</button>
        </div>
      </div>`);
  }

  showControls(back) {
    this.settingsBack = back;
    const rows = [
      ['W A S D / Arrows', 'Move'], ['Mouse', 'Aim'], ['Left click (hold)', 'Attack'], ['Q / Right click', 'Ability 1'], ['E', 'Ability 2'],
      ['R', `Ability 3 (unlocks at level ${ABILITY3_LEVEL})`], ['Space / Shift', 'Dodge roll (invulnerable)'], ['F', 'Interact (portals, chests, NPCs)'],
      ['1 / 2', 'Health / Mana potion'], ['I / Tab', 'Inventory'], ['Click hotbar item', 'Equip or use it'], ['K', 'Item Index'], ['M', 'Toggle minimap'], ['Esc', 'Pause / close menus'], ['`', 'Admin panel'],
    ];
    this.showOverlay(`
      <div class="panel narrow">
        <h2>Controls</h2>
        <table class="controls">${rows.map(([k, v]) => `<tr><td><kbd>${k}</kbd></td><td>${v}</td></tr>`).join('')}</table>
        <div class="tip">Enemy attacks flash white and show red warning shapes on the ground before they land. Roll through them!</div>
        <button class="btn primary" data-act="settingsBack">Back</button>
      </div>`);
  }

  showPortal(region, save, level) {
    const boss = BOSSES[region.boss];
    const beaten = save.bossesDefeated.includes(region.boss);
    const warn = level < region.recommended ? `<div class="warn">Recommended level ${region.recommended}. You are level ${level}.</div>` : '';
    this.showOverlay(`
      <div class="panel narrow portal" style="--accent:${region.portal}">
        <h2>${region.name}</h2>
        <div class="sub">${region.sub}</div>
        <div class="kv"><span>Guardian</span><b>${boss.name}, ${boss.title}</b>${beaten ? ' <span class="ok">defeated</span>' : ''}</div>
        <div class="kv"><span>Recommended level</span><b>${region.recommended}</b></div>
        <div class="kv"><span>Hazards</span><b>${region.hazard}</b></div>
        ${warn}
        <div class="menu">
          <button class="btn primary" data-act="enter" data-region="${region.index}">Enter</button>
          ${save.heroicUnlocked ? `<button class="btn heroic" data-act="enter" data-region="${region.index}" data-heroic="1">Enter Heroic <small>tougher, better loot, Mythics</small></button>` : ''}
          <button class="btn" data-act="close">Not yet</button>
        </div>
      </div>`);
  }

  showBoard(g) {
    const s = g.save;
    const regions = REGIONS.map((r, i) => {
      const b = BOSSES[r.boss];
      const st = s.bossesDefeated.includes(r.boss) ? '<span class="ok">Cleared</span>' : i < s.regionsUnlocked ? '<span class="warnc">Open</span>' : '<span class="dim">Sealed</span>';
      return `<tr><td>${r.name}</td><td>${b.name}</td><td>${st}</td></tr>`;
    }).join('');
    this.showOverlay(`
      <div class="panel">
        <h2>Notice Board</h2>
        <div class="sub">Objective: <b>${esc(g.objectiveText())}</b></div>
        <table class="progress"><tr><th>Region</th><th>Guardian</th><th>Status</th></tr>${regions}</table>
        <div class="cols">
          <div>
            <h4>Your journey</h4>
            <div class="kv"><span>Enemies slain</span><b>${s.stats.kills}</b></div>
            <div class="kv"><span>Dungeons cleared</span><b>${s.stats.clears}</b></div>
            <div class="kv"><span>Deaths</span><b>${s.stats.deaths}</b></div>
            <div class="kv"><span>Time played</span><b>${formatTime(s.stats.playTime)}</b></div>
            <div class="kv"><span>Classes unlocked</span><b>${s.unlockedClasses.length} / 4</b></div>
            <div class="kv"><span>Heroic mode</span><b>${s.heroicUnlocked ? 'Unlocked' : 'Defeat Lumen'}</b></div>
            <div class="kv"><span>Mini-bosses slain</span><b>${s.minibossesDefeated.length} / 4</b></div>
            <div class="kv"><span>Index</span><b>${s.discovered.filter((id) => ['legendary', 'mythic'].includes(getBase(id)?.rarity)).length} rare finds</b></div>
          </div>
          <div>
            <h4>Adventurer's tips</h4>
            <ul class="tips">
              <li>The world gets harder the farther you go from town: Mossveil, then Cinder, Prism, and Frostspire.</li>
              <li>Any kill can open a dungeon portal. Mini-bosses guard lairs in each biome and drop their own Legendaries and Mythics.</li>
              <li>Red shapes on the ground show where attacks will land.</li>
              <li>Dodge rolling makes you briefly invulnerable.</li>
              <li>Cracked walls hide secret rooms. Shoot or slash them.</li>
              <li>Trial altars summon hard waves for a better chest.</li>
              <li>Legendaries are rare, but bad-luck protection guarantees a boss's legendary after a few kills. Heroic boosts every chance.</li>
              <li>Each class levels separately. Your bag and gold are shared.</li>
            </ul>
          </div>
        </div>
        <div class="menu row">
          <button class="btn" data-act="replayTutorial">Replay tutorial</button>
          <button class="btn primary" data-act="close">Close</button>
        </div>
      </div>`);
  }

  showDeath(g, killer, lostGold) {
    if (g.overlay !== 'dead') return;
    const run = g.run;
    this.showOverlay(`
      <div class="panel narrow death">
        <h2 class="red">You have fallen</h2>
        <div class="sub">Slain by ${esc(killer)}</div>
        ${run ? `<div class="kv"><span>Enemies slain</span><b>${run.kills}</b></div><div class="kv"><span>Items kept</span><b>${run.items.length}</b></div>` : ''}
        ${lostGold ? `<div class="warn">The gold you found this run (${lostGold}) was lost.</div>` : ''}
        <div class="tip">Tip: ${esc(deathTip(killer))}</div>
        <button class="btn primary" data-act="respawn">Return to Emberlight Haven</button>
      </div>`, 'dim-red');
  }

  showComplete(g, run, victory) {
    const region = REGIONS[run.region];
    const items = run.items.filter((it) => getBase(it.base).slot !== 'consumable');
    const icons = items.map((it) => {
      const b = getBase(it.base);
      return `<div class="slot small" style="--rc:${RARITY_COLOR[b.rarity]}" title="${esc(b.name)}"><img src="${toURL(itemIcon(b, RARITY_COLOR[b.rarity]))}"></div>`;
    }).join('') || '<span class="dim">No equipment this time</span>';
    const unlocks = (run.unlocks || []).map((u) => `<li>${esc(u)}</li>`).join('');
    this.showOverlay(`
      <div class="panel ${victory ? 'victory' : ''}">
        <h2 class="${victory ? 'gold' : 'green'}">${victory ? 'The realm is restored' : 'Dungeon cleared'}</h2>
        <div class="sub">${victory ? 'Glacius falls silent and the Riftlands are whole again. Mythics still wait in Heroic dungeons and mini-boss lairs.' : region.name + (run.heroic ? ' (Heroic)' : '')}</div>
        <div class="cols">
          <div>
            <div class="kv"><span>Time</span><b>${formatTime(g.time - run.start)}</b></div>
            <div class="kv"><span>Enemies slain</span><b>${run.kills}</b></div>
            <div class="kv"><span>Experience</span><b>+${run.xp}</b></div>
            <div class="kv"><span>Gold</span><b>+${run.gold}</b></div>
            <div class="kv"><span>Level</span><b>${run.levelStart} → ${g.classState().level}</b></div>
          </div>
          <div><h4>Loot found</h4><div class="lootrow">${icons}</div></div>
        </div>
        ${unlocks ? `<h4>Unlocked</h4><ul class="unlocks">${unlocks}</ul>` : ''}
        <button class="btn primary" data-act="toHub">Return to the Riftlands</button>
      </div>`);
  }

  notice(text) {
    this.noticeText = text;
    setTimeout(() => this.toast(text, '#ffa630', 6), 300);
  }

  confirm(text, yesAct, back) {
    this.showOverlay(`
      <div class="panel narrow">
        <h2>Are you sure?</h2>
        <div class="sub">${esc(text)}</div>
        <div class="menu row">
          <button class="btn danger" data-act="${yesAct}">Yes</button>
          <button class="btn primary" data-act="${back}">Cancel</button>
        </div>
      </div>`);
  }

  // ───────────────────────── inventory + vendor ─────────────────────────
  showInventory(g) {
    this.inv = { mode: 'inventory', sel: null, hover: null, confirmDrop: false };
    this.showOverlay('<div class="panel inv" id="inv-root"></div>');
    this.refreshInventory(g);
  }
  showVendor(g) {
    this.inv = { mode: 'vendor', sel: null, hover: null, confirmDrop: false, confirmSellAll: false };
    this.showOverlay('<div class="panel inv vendor" id="inv-root"></div>');
    this.refreshInventory(g);
  }
  refreshInventory(g) {
    const root = $('#inv-root', this.el.overlay);
    if (!root || !this.inv) return;
    root.innerHTML = renderInventory(g, this.inv);
  }
  refreshDetail() {
    const d = $('#inv-detail', this.el.overlay);
    if (d && this.inv) d.innerHTML = renderItemDetail(this.game, this.inv);
  }

  invAction(act, data) {
    const g = this.game, inv = g.save.inventory, cs = g.classState(), cls = g.save.currentClass;
    const st = this.inv;
    const selItem = () => (st.sel?.where === 'inv' ? inv[st.sel.key] : st.sel?.where === 'equip' ? cs.equip[st.sel.key] : st.sel?.where === 'shop' ? g.vendorStock[st.sel.key] : null);
    switch (act) {
      case 'select': {
        const key = data.where === 'inv' ? Number(data.key) : data.key;
        st.sel = { where: data.where, key };
        st.confirmDrop = false;
        g.audio.play('click');
        break;
      }
      case 'quick': {
        st.sel = { where: data.where, key: data.where === 'inv' ? Number(data.key) : data.key };
        const it = selItem();
        if (!it) return;
        const b = getBase(it.base);
        if (st.mode === 'vendor' && data.where === 'inv') return this.invAction('sell', {});
        if (data.where === 'equip') return this.invAction('unequip', {});
        if (b.slot === 'consumable') return this.invAction('use', {});
        return this.invAction('equip', {});
      }
      case 'equip': {
        if (st.sel?.where !== 'inv') return;
        const r = equipFromInventory(inv, cs, cls, st.sel.key);
        if (!r.ok) { g.toast(r.reason, '#ff4f5e'); g.audio.play('deny'); return; }
        g.refreshStats();
        g.audio.play('pickup');
        st.sel = { where: 'equip', key: r.slot };
        g.queueSave();
        break;
      }
      case 'unequip': {
        if (st.sel?.where !== 'equip') return;
        const r = unequip(inv, cs, st.sel.key);
        if (!r.ok) { g.toast(r.reason, '#ff4f5e'); g.audio.play('deny'); return; }
        g.refreshStats();
        g.audio.play('click');
        st.sel = null;
        g.queueSave();
        break;
      }
      case 'use': {
        const it = selItem();
        if (!it) return;
        if (g.useConsumable(it.base)) { if (!inv[st.sel?.key]) st.sel = null; }
        if (g.overlay !== 'inventory') return;
        break;
      }
      case 'drop': {
        if (st.sel?.where !== 'inv') return;
        if (!st.confirmDrop) { st.confirmDrop = true; break; }
        const it = removeAt(inv, st.sel.key);
        if (it) g.toast(`Discarded ${getBase(it.base).name}`, '#8e889b');
        st.sel = null; st.confirmDrop = false;
        g.queueSave();
        break;
      }
      case 'sort': sortInventory(inv); st.sel = null; g.audio.play('click'); g.queueSave(); break;
      case 'sell': {
        if (st.sel?.where !== 'inv') return;
        const it = inv[st.sel.key];
        if (!it) return;
        const price = sellPrice(it);
        removeAt(inv, st.sel.key);
        g.save.gold += price;
        g.audio.play('gold');
        g.toast(`Sold ${getBase(it.base).name} for ${price} gold`, '#ffd36b');
        st.sel = null;
        g.queueSave();
        break;
      }
      case 'sellAll': {
        if (!st.confirmSellAll) { st.confirmSellAll = true; break; }
        let total = 0, n = 0;
        inv.forEach((it, i) => {
          if (!it) return;
          const b = getBase(it.base);
          if (b.slot !== 'consumable' && (b.rarity === 'common' || b.rarity === 'uncommon')) { total += sellPrice(it); inv[i] = null; n++; }
        });
        g.save.gold += total;
        st.confirmSellAll = false; st.sel = null;
        if (n) { g.audio.play('gold'); g.toast(`Sold ${n} items for ${total} gold`, '#ffd36b'); }
        g.queueSave();
        break;
      }
      case 'buy': {
        let item;
        if (data.consumable) item = makeItem(data.consumable, new RNG(), 1);
        else item = g.vendorStock[Number(data.key)];
        if (!item) return;
        const price = buyPrice(item);
        if (g.save.gold < price) { g.toast('Not enough gold', '#ff4f5e'); g.audio.play('deny'); return; }
        const copy = { ...item, uid: item.uid + '-b' + Math.floor(Math.random() * 1e6) };
        if (!addItem(inv, copy)) { g.toast('Inventory full', '#ff4f5e'); g.audio.play('deny'); return; }
        g.save.gold -= price;
        if (!data.consumable) { g.vendorStock.splice(Number(data.key), 1); st.sel = null; }
        g.audio.play('gold');
        g.toast(`Bought ${getBase(item.base).name}`, RARITY_COLOR[getBase(item.base).rarity]);
        g.queueSave();
        break;
      }
    }
    this.refreshInventory(g);
  }

  // ───────────────────────── actions ─────────────────────────
  act(a, data) {
    const g = this.game;
    if (!g) return;
    if (a.startsWith('inv:')) return this.invAction(a.slice(4), data);
    g.audio.play('click');
    switch (a) {
      case 'continue': g.continueGame(); break;
      case 'newGame': g.newGame(); break;
      case 'confirmNew': this.confirm('Starting a new game erases your current save.', 'newGame', 'toTitle'); break;
      case 'toTitle': g.enterTitle(); break;
      case 'pickClass':
        if (this.classSelectNew) g.startPlaying(data.cls);
        else g.changeClass(data.cls);
        break;
      case 'close': g.closeOverlay(); break;
      case 'inventory': g.openOverlay('inventory'); break;
      case 'settings': this.showSettings(g.mode === 'title' ? 'title' : 'pause'); if (g.mode === 'play') g.overlay = 'settings'; break;
      case 'controls': this.showControls(g.mode === 'title' ? 'title' : 'pause'); if (g.mode === 'play') g.overlay = 'settings'; break;
      case 'settingsBack':
        g.saveNow();
        if (this.settingsBack === 'title') this.showTitle(g.hasSave, g.save);
        else { g.overlay = 'pause'; this.showPause(g.area === 'dungeon'); }
        break;
      case 'confirmReset': this.confirm('This permanently erases all progress, items and gold.', 'resetSave', 'settings'); break;
      case 'resetSave':
        try { g.storage.removeItem('aetherbound.save.v2'); } catch {}
        g.hasSave = false;
        g.newGame();
        g.enterTitle();
        break;
      case 'confirmAbandon': this.confirm('Leave the dungeon? You keep the items you picked up.', 'abandon', 'pauseBack'); break;
      case 'pauseBack': this.showPause(g.area === 'dungeon'); break;
      case 'abandon': g.abandonRun(); break;
      case 'quit': g.quitToTitle(); break;
      case 'enter': g.enterDungeon(Number(data.region), !!data.heroic); break;
      case 'respawn': g.respawnAtHub(); break;
      case 'toHub': g.closeOverlay(); g.returnToWorld(); break;
      case 'index': g.closeOverlay(); g.openOverlay('index'); break;
      case 'wardrobe': g.closeOverlay(); g.openOverlay('wardrobe'); break;
      case 'pickSkin':
        g.save.selectedSkins[g.save.currentClass] = data.skin;
        g.player.spriteName = skinSpriteName(g.save.currentClass, data.skin);
        g.queueSave();
        this.showWardrobe(g);
        break;
      case 'buySkin': {
        const skin = SKINS[g.save.currentClass].find((k) => k.id === data.skin);
        if (!skin || g.save.gold < skin.unlock.price) { g.audio.play('deny'); break; }
        g.save.gold -= skin.unlock.price;
        g.save.skinsOwned.push(`${g.save.currentClass}:${skin.id}`);
        g.audio.play('gold');
        g.queueSave();
        this.showWardrobe(g);
        break;
      }
      case 'adminGive': g.adminGive(data.item, 5); break;
      case 'adminBoss': g.closeOverlay(); g.adminSpawnBoss(data.boss); break;
      case 'adminCheat': g.adminCheat(data.cheat); if (g.overlay === 'admin') this.showAdmin(g); break;
      case 'hot': {
        const inv = g.save.inventory, cs = g.classState();
        if (data.where === 'inv') {
          const it = inv[Number(data.key)];
          if (!it) { g.openOverlay('inventory'); break; }
          const b = getBase(it.base);
          if (b.slot === 'consumable') g.useConsumable(it.base);
          else {
            const r = equipFromInventory(inv, cs, g.save.currentClass, Number(data.key));
            if (!r.ok) { g.toast(r.reason, '#ff4f5e'); g.audio.play('deny'); }
            else { g.refreshStats(); g.audio.play('pickup'); g.toast(`Equipped ${b.name}`, RARITY_COLOR[b.rarity]); g.queueSave(); }
          }
        } else g.openOverlay('inventory');
        break;
      }
      case 'replayTutorial':
        g.tutorial = { step: 0, moved: 0, dummyHits: 0 };
        this.setTutorial(g.tutorialText());
        g.closeOverlay();
        break;
    }
  }

  setSetting(k, v) {
    const g = this.game;
    g.save.settings[k] = v;
    g.audio.apply(g.save.settings);
    if (k === 'sfx' || k === 'master') g.audio.play('click');
  }

  // ───────────────────────── HUD ─────────────────────────
  buildActionBar() { this.el.actions.innerHTML = ''; this.cache.hotSig = null; }

  set(key, el, prop, value) {
    if (this.cache[key] === value) return;
    this.cache[key] = value;
    if (prop === 'text') el.textContent = value;
    else if (prop === 'html') el.innerHTML = value;
    else if (prop === 'width') el.style.width = value;
    else if (prop === 'height') el.style.height = value;
    else if (prop === 'src') el.src = value;
    else if (prop === 'display') el.style.display = value;
    else if (prop === 'class') el.className = value;
  }

  updateHud(g) {
    if (g.mode !== 'play' || !g.player) return;
    const pl = g.player, s = pl.stats, cs = g.classState(), c = CLASSES[pl.cls];
    const e = this.el;
    this.set('hp', e.hp, 'width', `${(100 * Math.max(0, pl.hp)) / s.maxHp}%`);
    this.set('hpb', e.hpBar, 'width', pl.barrier ? `${Math.min(100, (100 * pl.barrier.amt) / s.maxHp)}%` : '0%');
    this.set('hpt', e.hpText, 'text', `${Math.ceil(Math.max(0, pl.hp))} / ${s.maxHp}${pl.barrier ? ` (+${Math.ceil(pl.barrier.amt)})` : ''}`);
    this.set('mp', e.mp, 'width', `${(100 * pl.mp) / s.maxMp}%`);
    this.set('mpt', e.mpText, 'text', `${Math.floor(pl.mp)} / ${s.maxMp}`);
    const xpNeed = xpForLevel(cs.level);
    this.set('xp', e.xp, 'width', cs.level >= MAX_LEVEL ? '100%' : `${(100 * cs.xp) / xpNeed}%`);
    this.set('lvl', e.lvl, 'text', `Lv ${cs.level}${cs.level >= MAX_LEVEL ? ' MAX' : ''}`);
    this.set('cls', e.cls, 'text', c.name);
    if (this.cache.portraitCls !== pl.spriteName) {
      this.cache.portraitCls = pl.spriteName;
      const cv = e.portrait; const x = cv.getContext('2d'); x.imageSmoothingEnabled = false; x.clearRect(0, 0, cv.width, cv.height);
      drawSprite(x, pl.spriteName || 'hero_' + pl.cls, 0, 8, 17);
    }
    this.set('buffs', e.buffs, 'html', pl.buffs.map((b) => `<span class="buff ${b.id}">${b.id === 'fury' ? 'FURY' : 'SWIFT'} ${Math.ceil(b.t)}s</span>`).join('') + (pl.rapidT > 0 ? `<span class="buff swift">RAPID ${Math.ceil(pl.rapidT)}s</span>` : ''));
    this.set('gold', e.gold, 'text', g.save.gold);
    this.set('region', e.region, 'text', g.area === 'world' ? (g.worldBiome < 0 ? 'Emberlight Haven' : g.regionDef.name) : g.regionDef.name + (g.heroic ? ' (H)' : ''));
    this.set('obj', e.objective, 'text', g.objectiveText());

    // hotbar: equipped gear + first bag slots, rebuilt only when they change
    const sig = hotbarSignature(g);
    if (sig !== this.cache.hotSig) { this.cache.hotSig = sig; e.actions.innerHTML = hotbarHtml(g); }
    c.abilities.forEach((ab, i) => {
      const chip = $('#chip-' + i, e.actions);
      if (!chip) return;
      const locked = i === 2 && cs.level < ABILITY3_LEVEL;
      const frac = locked ? 1 : pl.cds[i] / (ab.cd * (1 - s.cdr));
      this.set('chipcd' + i, $('.cd', chip), 'height', `${Math.max(0, Math.min(1, frac)) * 100}%`);
      this.set('chipcls' + i, chip, 'class', `chip${locked ? ' locked' : ''}${pl.mp < ab.mp && !locked ? ' nomana' : ''}${!locked && frac <= 0 && pl.mp >= ab.mp ? ' ready' : ''}`);
    });
    const dchip = $('#chip-dodge .cd', e.actions);
    if (dchip) this.set('dodgecd', dchip, 'height', `${(pl.dodgeCd / 0.8) * 100}%`);

    // interaction prompt
    const label = g.nearby && !g.inputBlocked() ? g.nearby.label : null;
    this.set('prompt', e.prompt, 'html', label ? `<kbd>F</kbd> ${esc(label)}` : '');
    this.set('promptShow', e.prompt, 'class', label ? 'show' : '');

    // room info
    let info = '';
    if (g.area === 'dungeon' && g.currentRoom && g.currentRoom.locked && g.currentRoom.type !== 'boss') {
      const n = g.enemies.filter((en) => !en.dead && en.room === g.currentRoom.id).length + g.currentRoom.pending;
      info = `Doors sealed: ${n} ${n === 1 ? 'enemy' : 'enemies'} remain`;
    }
    this.set('room', e.roomInfo, 'text', info);
    this.set('roomShow', e.roomInfo, 'display', info ? 'block' : 'none');

    // boss bar
    if (g.boss && this.cache.bossOn) {
      this.set('bossw', e.bossFill, 'width', `${(100 * Math.max(0, g.boss.hp)) / g.boss.maxHp}%`);
      this.set('bossp', e.bossName, 'html', `${esc(g.boss.name)} <small>${esc(g.boss.title)}${g.boss.phase > 1 ? ' &middot; ENRAGED' : ''}</small>`);
    }

    // toasts expire
    const now = performance.now();
    if (this.toasts.some((t) => t.until < now)) {
      this.toasts = this.toasts.filter((t) => { if (t.until < now) { t.el.remove(); return false; } return true; });
    }
    if (this.minimapOn) this.drawMinimap(g);
  }

  drawMinimap(g) {
    const cv = this.el.minimap;
    this.mmT = (this.mmT || 0) + 1;
    if (this.mmT % 4) return;
    const x = cv.getContext('2d');
    x.imageSmoothingEnabled = false;
    x.clearRect(0, 0, cv.width, cv.height);
    const map = g.map, pl = g.player;
    if (g.area === 'world') {
      if (!this.worldMini || this.worldMini.map !== map) {
        const c = document.createElement('canvas'); c.width = map.w; c.height = map.h;
        const cx = c.getContext('2d');
        const BIOME = ['#4f8f43', '#7a3b2e', '#4a3f8a', '#c9dbea', '#a39b8b'];
        const img = cx.createImageData(map.w, map.h);
        for (let i = 0; i < map.w * map.h; i++) {
          const t = map.t[i];
          let col = t === 2 ? '#14111c' : t === 6 ? '#3d7fc4' : t === 5 ? '#ff7a3a' : t === 8 ? '#d9cfb8' : t === 7 ? null : BIOME[map.biome[i]];
          if (!col) col = ['#2f6b3a', '#3b1e1e', '#2a2357', '#8fa3b8', '#2f6b3a'][map.biome[i]];
          if (t === 5 && map.biome[i] === 2) col = '#ff7ae6';
          if (t === 5 && map.biome[i] === 3) col = '#3a5f8a';
          const n = parseInt(col.slice(1), 16);
          img.data[i * 4] = n >> 16; img.data[i * 4 + 1] = (n >> 8) & 255; img.data[i * 4 + 2] = n & 255; img.data[i * 4 + 3] = 255;
        }
        cx.putImageData(img, 0, 0);
        this.worldMini = { map, c };
      }
      // show an 80x64-tile window around the player
      const vw = 80, vh = 64;
      const px = pl.x / TILE, py = pl.y / TILE;
      const sx = Math.max(0, Math.min(map.w - vw, px - vw / 2)), sy = Math.max(0, Math.min(map.h - vh, py - vh / 2));
      const k = cv.width / vw;
      x.drawImage(this.worldMini.c, sx, sy, vw, vh, 0, 0, cv.width, cv.height);
      const dot = (tx, ty, col, size = 3) => {
        const dx = (tx - sx) * k, dy = (ty - sy) * k;
        if (dx < 0 || dy < 0 || dx > cv.width || dy > cv.height) return;
        x.fillStyle = '#000'; x.fillRect(Math.round(dx) - size / 2 - 1, Math.round(dy) - size / 2 - 1, size + 2, size + 2);
        x.fillStyle = col; x.fillRect(Math.round(dx) - size / 2, Math.round(dy) - size / 2, size, size);
      };
      for (const l of g.world.lairs) {
        const alive = g.enemies.some((en) => en.bossId === l.bossId && !en.dead);
        dot(l.tx, l.ty, alive ? '#ff4f5e' : '#5a5070', 5);
      }
      for (const n of g.npcs) if (n.kind === 'worldPortal') dot(n.x / TILE, n.y / TILE, n.heroic ? '#ff7ae6' : n.region.portal, 4);
      for (const en of g.enemies) if (!en.dead && !en.isDummy && !en.isBoss && en.elite) dot(en.x / TILE, en.y / TILE, '#ffd36b', 2);
      dot(px, py, '#ffffff', 3);
      return;
    }
    if (g.area === 'hub') {
      if (!this.hubMini || this.hubMini.map !== map) {
        const c = document.createElement('canvas'); c.width = map.w; c.height = map.h;
        const cx = c.getContext('2d');
        for (let y = 0; y < map.h; y++) for (let xx = 0; xx < map.w; xx++) {
          const t = map.get(xx, y);
          cx.fillStyle = t === 2 ? '#3d3a4a' : t === 7 ? '#2f6b3a' : t === 6 ? '#3d7fc4' : t === 8 ? '#a39b8b' : '#4f8f43';
          cx.fillRect(xx, y, 1, 1);
        }
        this.hubMini = { map, c };
      }
      const s = Math.min(cv.width / map.w, cv.height / map.h);
      x.drawImage(this.hubMini.c, 0, 0, map.w * s, map.h * s);
      x.fillStyle = '#ffffff';
      x.fillRect(Math.round((pl.x / TILE) * s) - 1, Math.round((pl.y / TILE) * s) - 1, 3, 3);
      for (const n of g.npcs) if (n.kind === 'portal') { x.fillStyle = n.locked() ? '#5a5070' : n.region.portal; x.fillRect(Math.round((n.x / TILE) * s) - 1, Math.round((n.y / TILE) * s) - 1, 3, 3); }
      return;
    }
    const d = g.dungeon;
    if (!d) return;
    // fit the explored part of the dungeon
    const s = Math.min(cv.width / map.w, cv.height / map.h) * 1.0;
    const ox = (cv.width - map.w * s) / 2, oy = (cv.height - map.h * s) / 2;
    const known = (r) => r.visited || d.rooms.some((o) => o.visited && o.links.includes(r.id) && r.type !== 'secret');
    for (const e of d.edges) {
      const a = d.rooms[e.a], b = d.rooms[e.b];
      if (!(a.visited || b.visited) || (e.secret && !(a.visited && b.visited))) continue;
      x.strokeStyle = '#5a5070'; x.lineWidth = Math.max(1, s * 2);
      x.beginPath(); x.moveTo(ox + a.centerX * s, oy + a.centerY * s); x.lineTo(ox + b.centerX * s, oy + b.centerY * s); x.stroke();
    }
    for (const r of d.rooms) {
      if (!known(r)) continue;
      const col = r.type === 'boss' ? '#ff4f7a' : r.type === 'treasure' || r.type === 'secret' ? '#ffd36b' : r.type === 'shrine' ? '#5fd068' : r.type === 'elite' ? '#ffa630' : r.type === 'trial' ? '#b46cff' : '#8e889b';
      x.fillStyle = r.visited ? (r === g.currentRoom ? '#e8e8f0' : r.cleared ? '#4a4560' : '#6b5a7a') : '#221d2e';
      x.fillRect(ox + r.x0 * s, oy + r.y0 * s, r.w * s, r.h * s);
      x.strokeStyle = col; x.lineWidth = 1;
      x.strokeRect(Math.round(ox + r.x0 * s) + 0.5, Math.round(oy + r.y0 * s) + 0.5, Math.round(r.w * s), Math.round(r.h * s));
    }
    x.fillStyle = '#ffffff';
    x.fillRect(Math.round(ox + (pl.x / TILE) * s) - 1, Math.round(oy + (pl.y / TILE) * s) - 1, 3, 3);
  }

  toggleMinimap() {
    this.minimapOn = !this.minimapOn;
    this.el.minimap.style.display = this.minimapOn ? 'block' : 'none';
  }

  toast(msg, color = '#e8e8f0', seconds = 2.6, item) {
    const el = document.createElement('div');
    el.className = 'toast';
    el.style.setProperty('--c', color);
    let icon = '';
    if (item) { const b = getBase(item.base); icon = `<img src="${toURL(itemIcon(b, RARITY_COLOR[b.rarity]))}">`; }
    el.innerHTML = icon + esc(msg);
    this.el.toasts.appendChild(el);
    this.toasts.push({ el, until: performance.now() + seconds * 1000 });
    while (this.toasts.length > 5) this.toasts.shift().el.remove();
  }

  banner(title, sub, seconds = 2.6) {
    const b = this.el.banner;
    b.innerHTML = `<div class="b-title">${esc(title)}</div><div class="b-sub">${esc(sub || '')}</div>`;
    b.classList.remove('show');
    void b.offsetWidth;
    b.classList.add('show');
    clearTimeout(this.bannerT);
    this.bannerT = setTimeout(() => b.classList.remove('show'), seconds * 1000);
  }

  bossIntro(data) {
    const b = this.el.banner;
    b.innerHTML = `<div class="b-title boss" style="color:${data.color}">${esc(data.name)}</div><div class="b-sub">${esc(data.title)}</div><div class="b-quote">${esc(data.intro)}</div>`;
    b.classList.remove('show');
    void b.offsetWidth;
    b.classList.add('show');
    clearTimeout(this.bannerT);
    this.bannerT = setTimeout(() => b.classList.remove('show'), 2700);
  }

  bossBar(b) {
    this.cache.bossOn = !!b;
    this.el.boss.classList.toggle('show', !!b);
    if (b) { this.el.boss.style.setProperty('--bc', b.data.color); delete this.cache.bossw; delete this.cache.bossp; }
  }

  setTutorial(t) {
    const el = this.el.tutorial;
    if (!t) { el.classList.remove('show'); return; }
    el.classList.add('show');
    el.innerHTML = `<h4>Getting started</h4>` + t.steps.map((s, i) => `<div class="step ${i < t.current ? 'done' : i === t.current ? 'now' : ''}">${i < t.current ? '&#10003;' : i + 1 + '.'} ${esc(s)}</div>`).join('');
  }

  hurtFlash() {
    const h = this.el.hurt;
    h.classList.remove('flash');
    void h.offsetWidth;
    h.classList.add('flash');
  }
}

function deathTip(killer) {
  const k = killer.toLowerCase();
  if (k.includes('bramblemaw')) return 'Keep moving during Root Eruption, because it aims where you are heading. In phase 2, slide with the gap in the thorn rings.';
  if (k.includes('kragmor') || k.includes('lava') || k.includes('ember')) return 'When Kragmor\'s red line appears, step sideways out of it. Avoid the lava trails he leaves behind.';
  if (k.includes('lumen') || k.includes('prism echo')) return 'Prism beams rotate slowly. Walk with them and stay in the gap between two beams.';
  if (k.includes('warlord')) return 'Warlords hit hard. Dodge through their radial bursts and kill their minions first.';
  return 'Watch for flashing enemies and red ground markers, then roll through the attack. Potions are on keys 1 and 2.';
}

const TEMPLATE = `
  <div id="hurt"></div>
  <div id="hud">
    <div id="hud-tl" class="hudpanel">
      <canvas id="hud-portrait" width="16" height="20"></canvas>
      <div class="hud-bars">
        <div class="hud-name"><span id="hud-class"></span><span id="hud-level"></span></div>
        <div class="bar hp"><i id="hp-fill"></i><i id="hp-barrier" class="barrier"></i><span id="hp-text"></span></div>
        <div class="bar mp"><i id="mp-fill"></i><span id="mp-text"></span></div>
        <div class="bar xp"><i id="xp-fill"></i></div>
        <div id="hud-buffs"></div>
      </div>
    </div>
    <div id="hud-tr" class="hudpanel">
      <canvas id="minimap" width="120" height="96"></canvas>
      <div id="hud-region"></div>
      <div class="hud-gold"><img src="" id="gold-ico"><span id="hud-gold"></span></div>
    </div>
    <div id="hud-objective"></div>
    <div id="bossbar"><div id="boss-name"></div><div class="bar boss"><i id="boss-fill"></i></div></div>
    <div id="toasts"></div>
    <div id="room-info"></div>
    <div id="prompt"></div>
    <div id="actionbar" class="hudpanel"></div>
    <div id="tutorial" class="hudpanel"></div>
  </div>
  <div id="banner"></div>
  <div id="loot-popup" class="loot-popup"></div>
  <div id="mythic-flash"></div>
  <div id="overlay" class="overlay"></div>
`;

export function initGoldIcon() {
  const g = document.getElementById('gold-ico');
  if (g) g.src = toURL(goldIcon());
}

export { esc };
