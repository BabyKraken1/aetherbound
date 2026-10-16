// Game: owns the world, the state machine (title / hub / dungeon / menus) and the shared
// combat callbacks every entity uses (hitEnemy, damagePlayer, ...).
import { TILE, T, STEP, VIEW_MAX_W, VIEW_MAX_H, SAVE_KEY, RARITIES, RARITY_COLOR, ABILITY3_LEVEL } from './config.js';
import { RNG, dist, clamp } from './util.js';
import { CLASSES } from './content/classes.js';
import { REGIONS, HEROIC, NORMAL_MYTHIC_CHANCE } from './content/regions.js';
import { BOSSES, ALL_BOSSES } from './content/bosses.js';
import { skinSpriteName } from './content/skins.js';
import { getBase } from './content/items.js';
import { computeStats, addXp, xpForLevel } from './systems/stats.js';
import { damageToEnemy, applyDefense } from './systems/damage.js';
import { addItem, consumeOne, countItem } from './systems/inventory.js';
import { rollEnemyDrop, rollChest, rollBossDrop, vendorStock, makeItem } from './systems/loot.js';
import { defaultSave, loadSave, writeSave } from './systems/save.js';
import { generateDungeon } from './world/dungeon.js';
import { buildHub } from './world/hub.js';
import { LevelRenderer, THEMES } from './render/tileset.js';
import { generateWorld, regionAt, THEME_IDS, TOWN_BIOME } from './world/overworld.js';
import { collides } from './world/tilemap.js';
import { buildSprites, drawSprite, drawNumber } from './render/sprites.js';
import { Player } from './entities/player.js';
import { Enemy, Dummy } from './entities/enemy.js';
import { Boss, LumenClone } from './entities/boss.js';
import { Projectiles } from './entities/projectiles.js';
import { FX } from './entities/fx.js';
import { makeHazard, updateHazard, renderHazardBelow, renderHazardAbove } from './entities/hazards.js';
import { Pickup, Chest } from './entities/pickups.js';

const HAZARD_NAME = { moss: 'thorns', cinder: 'lava', prism: 'rift energy', frost: 'black ice', hub: 'thorns' };
const WORLD_ENEMY_CAP = 24;
const TUTORIAL = [
  { id: 'move', text: 'Move with W A S D' },
  { id: 'attack', text: 'Hold LEFT CLICK to attack a training dummy (east of the plaza)' },
  { id: 'dodge', text: 'Press SPACE to dodge roll. You cannot be hurt mid-roll' },
  { id: 'ability', text: 'Press Q or RIGHT CLICK to use an ability' },
  { id: 'inventory', text: 'Press I to open your inventory' },
  { id: 'kill', text: 'Leave town by any road and defeat an enemy. Kills can open dungeon portals!' },
];

export class Game {
  constructor(canvas, ui, input, audio) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.ui = ui;
    this.input = input;
    this.audio = audio;
    this.storage = safeStorage();
    this.time = 0;
    this.dt = STEP;
    this.timeScale = 1;
    this.slowmoT = 0;
    this.acc = 0;
    this.last = 0;
    this.cam = { x: 0, y: 0, shake: 0 };
    this.mode = 'title';       // title | play
    this.overlay = null;       // pause | inventory | vendor | dead | complete | victory | classSelect | portal | board | settings
    this.area = null;          // hub | dungeon | title
    this.projectiles = new Projectiles();
    this.fx = new FX();
    this.enemies = []; this.allies = []; this.pickups = []; this.chests = []; this.hazards = []; this.props = [];
    this.interactables = [];
    this.npcs = [];
    this.rng = new RNG();
    this.tierMult = { hp: 1, dmg: 1 };
    this.heroicMult = { hp: 1, dmg: 1 };
    this.regionDef = REGIONS[0];
    this.cinematic = null;
    this.saveTimer = 0;
    this.frameMs = 16;
    buildSprites();
    this.resize();
    window.addEventListener('resize', () => this.resize());
  }

  // ───────────────────────── boot / save ─────────────────────────
  boot() {
    const { save, warnings, corrupt } = loadSave(this.storage, SAVE_KEY);
    this.save = save;
    this.hasSave = !!save;
    if (!this.save) this.save = defaultSave();
    this.audio.apply(this.save.settings);
    if (corrupt) this.ui.notice('Your save file could not be read, so a fresh one was started. A backup copy was kept in browser storage.');
    else if (warnings.length) console.warn('Save repaired:', warnings);
    this.enterTitle();
    requestAnimationFrame((t) => this.frame(t));
  }

  saveNow() {
    if (this.mode !== 'play') return;
    if (!writeSave(this.storage, SAVE_KEY, this.save)) this.ui.toast('Could not save (browser storage blocked)', '#ff4f5e');
    this.hasSave = true;
  }
  queueSave() { this.saveTimer = 0.8; }

  newGame() {
    this.save = defaultSave();
    this.audio.apply(this.save.settings);
    this.hasSave = false;
    this.ui.showClassSelect(true);
  }
  continueGame() {
    if (!this.save.currentClass) { this.ui.showClassSelect(true); return; }
    this.startPlaying(this.save.currentClass);
  }
  startPlaying(cls) {
    this.save.currentClass = cls;
    this.mode = 'play';
    this.ui.hideAll();
    this.enterWorld({ town: true, first: true });
    this.saveNow();
  }
  changeClass(cls) {
    const ox = this.player.x, oy = this.player.y;
    this.save.currentClass = cls;
    this.player = null;
    this.spawnPlayer();
    this.player.x = ox; this.player.y = oy;
    this.closeOverlay();
    this.ui.toast(`You are now a ${CLASSES[cls].name}`, CLASSES[cls].color);
    this.saveNow();
  }
  quitToTitle() {
    this.saveNow();
    this.closeOverlay();
    this.enterTitle();
  }

  classState() { return this.save.classes[this.save.currentClass]; }

  // ───────────────────────── areas ─────────────────────────
  clearWorld() {
    this.enemies = []; this.allies = []; this.pickups = []; this.chests = []; this.hazards = []; this.props = [];
    this.interactables = []; this.npcs = [];
    this.projectiles.clear(); this.fx.clear();
    this.boss = null; this.cinematic = null; this.timeScale = 1; this.slowmoT = 0;
    this.ui.bossBar(null);
  }

  loadLevel(map, theme) {
    this.map = map;
    this.theme = theme;
    this.level = new LevelRenderer(map, () => theme);
  }
  themeObj() { return THEMES[this.theme] || THEMES.hub; }

  enterTitle() {
    this.mode = 'title';
    this.overlay = null;
    this.area = 'title';
    this.clearWorld();
    const hub = buildHub(new RNG(7));
    this.loadLevel(hub.map, 'hub');
    this.addProps(hub.props);
    this.titleCam = { t: 0 };
    this.player = null;
    this.audio.music('title');
    this.ui.showTitle(this.hasSave, this.save);
  }

  getWorld() {
    if (!this.world || this.world.seed !== this.save.worldSeed) {
      this.world = generateWorld(this.save.worldSeed);
      this.world.seed = this.save.worldSeed;
      this.lairTimers = {};
    }
    return this.world;
  }

  // The open world. opts: {town: true} spawns in town; {x, y} returns to a spot (e.g. a dungeon entrance).
  enterWorld(opts = { town: true }) {
    this.area = 'world';
    this.clearWorld();
    const w = this.getWorld();
    this.regionDef = REGIONS[0];
    this.tierMult = { hp: 1, dmg: 1 };
    this.heroicMult = { hp: 1, dmg: 1 };
    this.heroic = false;
    this.map = w.map;
    this.map.closedRooms.clear();
    this.theme = 'hub';
    this.level = this.worldLevel && this.worldLevel.map === w.map ? this.worldLevel : (this.worldLevel = new LevelRenderer(w.map, (x, y) => THEME_IDS[w.map.biome[w.map.idx(x, y)]]));
    this.addProps(w.props);
    this.dungeon = null;
    this.run = null;
    this.currentRoom = null;
    if (!this.vendorStock || !opts.first) this.vendorStock = vendorStock(this.rng, this.save.regionsUnlocked - 1);
    for (const n of w.npcs) this.addHubNpc(n);
    for (const l of w.lairs) this.maybeSpawnMini(l);
    this.spawnPlayer();
    if (opts.town || opts.x == null) { this.player.x = w.spawn.tx * TILE + 8; this.player.y = w.spawn.ty * TILE + 8; }
    else { const p = this.findFreeSpot(opts.x, opts.y, 6) || { x: w.spawn.tx * TILE + 8, y: w.spawn.ty * TILE + 8 }; this.player.x = p.x; this.player.y = p.y; }
    this.worldBiome = null;
    this.spawnTimer = 1;
    this.snapCamera();
    this.updateBiome(true);
    if (!this.save.tutorialDone) this.tutorial = this.tutorial || { step: 0, moved: 0, dummyHits: 0 };
    else this.tutorial = null;
    this.ui.setTutorial(this.tutorialText());
    this.saveNow();
  }

  // compatibility: anything that used to send you to the hub now sends you to town
  enterHub() { this.enterWorld({ town: true }); }

  inTown(x, y) {
    const t = this.world?.town;
    if (!t || this.area !== 'world') return false;
    const tx = x / TILE, ty = y / TILE;
    return tx >= t.x0 - 1 && tx <= t.x1 + 1 && ty >= t.y0 - 1 && ty <= t.y1 + 1;
  }

  updateBiome(force) {
    const r = regionAt(this.world, this.player.x, this.player.y);
    if (!force && r === this.worldBiome) return;
    this.worldBiome = r;
    if (r < 0) {
      this.theme = 'hub';
      this.regionDef = REGIONS[0];
      this.tierMult = { hp: 1, dmg: 1 };
      this.audio.music('hub');
      this.ui.banner('Emberlight Haven', 'The last safe hearth in the Riftlands');
    } else {
      const reg = REGIONS[r];
      this.theme = reg.theme;
      this.regionDef = reg;
      this.tierMult = { hp: reg.diff.hp, dmg: reg.diff.dmg };
      this.audio.music(reg.theme);
      this.ui.banner(reg.name, `Danger ${'★'.repeat(r + 1)}${'☆'.repeat(3 - r)}  ·  Recommended level ${reg.recommended}+`);
    }
  }

  updateWorld(dt) {
    const pl = this.player;
    // biome changes (checked a few times a second)
    this.biomeCheck = (this.biomeCheck || 0) - dt;
    if (this.biomeCheck <= 0) { this.biomeCheck = 0.25; this.updateBiome(false); }
    // despawn far-away enemies and keep the town safe
    for (const e of this.enemies) {
      if (e.isDummy || e.isBoss || e.dead) continue;
      const d = dist(e.x, e.y, pl.x, pl.y);
      if (d > 700 || this.inTown(e.x, e.y)) { e.dead = true; e.despawned = true; }
    }
    // keep a population of enemies around the player
    this.spawnTimer -= dt;
    if (this.spawnTimer <= 0) {
      this.spawnTimer = 0.6;
      const live = this.enemies.filter((e) => !e.dead && !e.isDummy && !e.isBoss).length;
      if (live < WORLD_ENEMY_CAP) this.spawnWorldPack();
    }
    // world portals expire
    for (const n of this.npcs) if (n.kind === 'worldPortal') { n.ttl -= dt; if (n.ttl <= 0) n.gone = true; }
    if (this.npcs.some((n) => n.gone)) {
      this.npcs = this.npcs.filter((n) => !n.gone);
      this.interactables = this.interactables.filter((i) => !(i.portal && i.portal.gone));
    }
    // mini-boss respawns
    for (const l of this.world.lairs) this.maybeSpawnMini(l);
  }

  spawnWorldPack() {
    const pl = this.player, map = this.map;
    for (let tries = 0; tries < 12; tries++) {
      const a = Math.random() * Math.PI * 2, d = 240 + Math.random() * 120;
      const x = pl.x + Math.cos(a) * d, y = pl.y + Math.sin(a) * d;
      const t = map.tileAt(x, y);
      if (t !== T.FLOOR && t !== T.PATH) continue;
      const r = regionAt(this.world, x, y);
      if (r < 0 || this.inTown(x, y) || collides(map, x, y, 8)) continue;
      // no packs right next to a mini-boss lair
      if (this.world.lairs.some((l) => dist(x, y, l.tx * TILE, l.ty * TILE) < 140)) continue;
      const region = REGIONS[r];
      const weights = Object.entries(region.weights).map(([k, w]) => ({ w, v: k }));
      const n = 2 + Math.floor(Math.random() * 3);
      for (let i = 0; i < n; i++) {
        const kind = this.rng.weighted(weights);
        const spot = this.findFreeSpot(x + (Math.random() - 0.5) * 40, y + (Math.random() - 0.5) * 40, 8);
        if (!spot || this.inTown(spot.x, spot.y)) continue;
        this.enemies.push(new Enemy(this, kind, spot.x, spot.y, { region, tier: { hp: region.diff.hp, dmg: region.diff.dmg }, elite: Math.random() < 0.06 }));
      }
      return;
    }
  }

  maybeSpawnMini(l) {
    const id = l.bossId;
    if (this.enemies.some((e) => e.bossId === id && !e.dead)) return;
    if ((this.lairTimers[id] || 0) > this.time) return;
    const x = l.tx * TILE + 8, y = l.ty * TILE + 8;
    const room = { id: -100 - l.region, x0: l.tx - 9, y0: l.ty - 7, x1: l.tx + 9, y1: l.ty + 7, w: 19, h: 15, centerX: l.tx + 0.5, centerY: l.ty + 0.5 };
    const b = new Boss(this, id, x, y, room);
    this.enemies.push(b);
  }

  onMiniAggro(b) {
    this.boss = b;
    this.ui.bossBar(b);
    this.audio.play('roar');
    this.ui.toast(`${b.name}, ${b.title}! ${b.data.signature}`, b.data.color, 4);
  }
  onMiniReset(b) {
    if (this.boss === b) { this.boss = null; this.ui.bossBar(null); }
  }

  spawnWorldPortal(x, y, regionIndex, heroic) {
    const region = REGIONS[regionIndex];
    const portal = { kind: 'worldPortal', x, y, region, heroic, ttl: 60 };
    this.npcs.push(portal);
    this.interactables.push({
      x, y: y + 4, r: 22, portal,
      get label() { return `Enter ${heroic ? 'Heroic ' : ''}${region.name} dungeon (${Math.ceil(portal.ttl)}s)`; },
      action: (g) => { portal.gone = true; g.enterDungeon(regionIndex, heroic, { x, y }); },
    });
    this.audio.play('portal');
    this.ui.toast(`A ${heroic ? 'Heroic ' : ''}dungeon portal opened! It closes in 60s.`, region.portal, 4);
  }

  addHubNpc(n) {
    const x = n.tx * TILE + 8, y = n.ty * TILE + 8;
    if (n.kind === 'dummy') { this.enemies.push(new Dummy(x, y)); return; }
    if (n.kind === 'portal') {
      const region = REGIONS[n.region];
      const portal = { kind: 'portal', x, y, region, locked: () => n.region >= this.save.regionsUnlocked };
      this.npcs.push(portal);
      this.interactables.push({
        x, y: y + 4, r: 22, get label() { return portal.locked() ? `${region.name} (sealed)` : `Enter ${region.name}`; },
        action: (g) => g.openPortalDialog(n.region),
      });
      return;
    }
    const npc = { ...n, x, y };
    this.npcs.push(npc);
    if (n.kind === 'vendor') this.interactables.push({ x, y, r: 22, label: 'Trade with Pell the Peddler', action: (g) => g.openOverlay('vendor') });
    if (n.kind === 'shrine') this.interactables.push({ x, y, r: 26, label: 'Change class at the Shrine of Echoes', action: (g) => { g.ui.showClassSelect(false); g.overlay = 'classSelect'; } });
    if (n.kind === 'board') this.interactables.push({ x, y, r: 18, label: 'Read the notice board', action: (g) => g.openOverlay('board') });
  }

  addProps(list) {
    for (const p of list) {
      const name = p.kind === 'tree' ? 'tree' : p.kind;
      this.props.push({ name, x: p.tx * TILE + (p.kind === 'stall' || p.kind.startsWith('fence') ? 0 : p.kind === 'fountain' || p.kind === 'statue' ? 16 : 8), y: p.ty * TILE + (p.kind === 'fence' || p.kind === 'fencev' ? 8 : 14), anim: p.kind === 'fountain' || p.kind === 'statue' || p.kind === 'lamp' });
    }
  }

  openPortalDialog(regionIndex) {
    if (regionIndex >= this.save.regionsUnlocked) {
      const prev = REGIONS[regionIndex - 1];
      this.ui.toast(`Sealed. Defeat ${BOSSES[prev.boss].name} in the ${prev.name} to open it.`, '#ffa630');
      this.audio.play('deny');
      return;
    }
    this.overlay = 'portal';
    this.ui.showPortal(REGIONS[regionIndex], this.save, this.classState().level);
  }

  enterDungeon(regionIndex, heroic = false, returnPoint = null) {
    const region = REGIONS[regionIndex];
    this.returnPoint = returnPoint || (this.area === 'world' && this.player ? { x: this.player.x, y: this.player.y + 24 } : null);
    this.closeOverlay();
    this.area = 'dungeon';
    this.clearWorld();
    this.regionDef = region;
    this.heroic = heroic;
    this.heroicMult = heroic ? { hp: HEROIC.hp, dmg: HEROIC.dmg } : { hp: 1, dmg: 1 };
    this.tierMult = { hp: region.diff.hp * this.heroicMult.hp, dmg: region.diff.dmg * this.heroicMult.dmg };
    const seed = (Math.random() * 2 ** 32) >>> 0;
    this.rng = new RNG(seed);
    const d = generateDungeon(region, this.rng);
    this.dungeon = d;
    this.loadLevel(d.map, region.theme);
    // pillars become y-sorted props
    for (let y = 0; y < d.map.h; y++) for (let x = 0; x < d.map.w; x++)
      if (d.map.get(x, y) === T.PILLAR) this.props.push({ name: 'pillar_' + region.theme, x: x * TILE + 8, y: y * TILE + 14 });
    for (const r of d.rooms) { r.locked = false; r.pending = 0; r.wave = 0; this.setupRoom(r); }
    const s = d.rooms[d.startRoom];
    this.spawnPlayer();
    this.player.x = s.centerX * TILE; this.player.y = s.centerY * TILE;
    s.visited = true;
    this.snapCamera();
    this.run = { start: this.time, kills: 0, gold: 0, xp: 0, items: [], region: regionIndex, heroic, bossDown: false, levelStart: this.classState().level };
    this.save.stats.runs++;
    this.audio.music(region.theme);
    this.ui.banner(region.name + (heroic ? ' (Heroic)' : ''), region.sub);
    if (this.tutorial) { this.save.tutorialDone = true; this.tutorial = null; this.ui.setTutorial(null); }
    this.ui.toast('Doors seal behind you until a room is cleared. Good luck!', '#ffd36b');
    this.saveNow();
  }

  // leave a dungeon back to where you entered it (or town)
  returnToWorld() {
    const rp = this.returnPoint;
    this.returnPoint = null;
    this.enterWorld(rp ? { x: rp.x, y: rp.y } : { town: true });
  }

  setupRoom(r) {
    const cx = r.centerX * TILE, cy = r.centerY * TILE;
    if (r.type === 'treasure') this.addChest(cx, cy, 'normal');
    if (r.type === 'secret') this.addChest(cx, cy, 'secret');
    if (r.type === 'shrine') {
      const shrine = { kind: 'fountainShrine', x: cx, y: cy, used: false };
      this.npcs.push(shrine);
      this.interactables.push({ x: cx, y: cy, r: 22, get label() { return shrine.used ? 'The spring is dry' : 'Drink from the healing spring'; },
        action: (g) => {
          if (shrine.used) return;
          shrine.used = true;
          g.player.hp = g.player.stats.maxHp; g.player.mp = g.player.stats.maxMp;
          g.fx.burst(g.player.x, g.player.y - 8, 30, ['#7ae0ff', '#ffffff', '#5fd068'], 70, 0.6);
          g.audio.play('heal');
          g.ui.toast('Fully restored', '#5fd068');
        } });
    }
    if (r.type === 'trial') {
      const altar = { kind: 'altar', x: cx, y: cy, state: 'idle' };
      this.npcs.push(altar);
      r.altar = altar;
      this.interactables.push({ x: cx, y: cy, r: 20,
        get label() { return altar.state === 'idle' ? 'Begin the Trial (3 hard waves, big reward)' : altar.state === 'done' ? 'Trial complete' : 'Trial in progress'; },
        action: (g) => { if (altar.state === 'idle') g.startTrial(r); } });
    }
  }

  addChest(x, y, kind) {
    const chest = new Chest(x, y, kind);
    this.chests.push(chest);
    this.interactables.push({ x, y, r: 18, get label() { return chest.opened ? null : 'Open chest'; }, action: (g) => g.openChest(chest) });
    return chest;
  }

  openChest(chest) {
    if (chest.opened) return;
    chest.opened = true;
    const region = this.regionDef.index;
    const loot = rollChest(this.rng, { region, secret: chest.kind === 'secret', bonus: chest.kind === 'trial' || chest.kind === 'elite' ? 1 : 0, tierBump: this.heroic ? 1 : 0 });
    this.dropLoot(chest.x, chest.y - 4, loot);
    this.fx.burst(chest.x, chest.y - 6, 24, ['#ffd36b', '#ffffff', '#ffa630'], 80, 0.5);
    this.audio.play('chest');
    if (chest.kind === 'secret') this.ui.toast('Secret treasure!', '#b46cff');
  }

  spawnPlayer() {
    const cls = this.save.currentClass;
    const old = this.player;
    this.player = new Player(cls, old ? old.x : 0, old ? old.y : 0);
    this.player.spriteName = skinSpriteName(cls, this.save.selectedSkins[cls]);
    this.refreshStats();
    this.player.hp = this.player.stats.maxHp;
    this.player.mp = this.player.stats.maxMp;
  }

  refreshStats() {
    const pl = this.player;
    if (!pl) return;
    const cs = this.classState();
    pl.stats = computeStats(CLASSES[pl.cls], cs.level, cs.equip, pl.buffs);
    pl.hp = Math.min(pl.hp, pl.stats.maxHp);
    pl.mp = Math.min(pl.mp, pl.stats.maxMp);
  }

  // ───────────────────────── main loop ─────────────────────────
  frame(ts) {
    requestAnimationFrame((t) => this.frame(t));
    try { this.tick(ts); } catch (err) {
      // never let one bad frame freeze the game; report it once
      console.error(err);
      if (!this.reportedError) { this.reportedError = true; this.ui.toast('An error occurred (see console). The game will keep running.', '#ff4f5e', 5); }
    }
  }

  tick(ts) {
    const raw = Math.min(0.25, (ts - (this.last || ts)) / 1000);
    this.last = ts;
    this.frameMs = this.frameMs * 0.95 + raw * 1000 * 0.05;
    this.acc += raw;
    let steps = 0;
    while (this.acc >= STEP && steps < 8) {
      this.step(STEP);
      this.acc -= STEP;
      steps++;
    }
    if (steps >= 8) this.acc = 0;
    this.render();
    // only clear one-shot presses once the simulation has actually seen them
    if (steps > 0) this.input.endFrame();
  }

  step(dt) {
    this.time += dt;
    if (this.saveTimer > 0) { this.saveTimer -= dt; if (this.saveTimer <= 0) this.saveNow(); }
    if (this.mode === 'title') { this.titleCam.t += dt; this.fx.update(dt); return; }
    this.handleGlobalKeys();
    if (this.overlay && this.overlay !== 'dead') { this.ui.updateHud(this); return; }
    if (this.mode !== 'play') return;
    this.save.stats.playTime += dt;

    // slow motion (boss deaths)
    if (this.slowmoT > 0) { this.slowmoT -= dt; this.timeScale = this.slowmoT > 0 ? 0.3 : 1; }
    const wdt = dt * this.timeScale;
    this.dt = wdt;

    if (this.cinematic) {
      this.cinematic.t -= dt;
      if (this.cinematic.t <= 0) { const c = this.cinematic; this.cinematic = null; c.done(this); }
      this.fx.update(wdt);
      this.updateCamera(dt);
      this.ui.updateHud(this);
      return;
    }

    if (this.overlay !== 'dead') this.player.update(wdt, this);
    for (const e of this.enemies) {
      if (e.dead || e.spawning) continue;
      e.update(wdt, this);
      // safety net: never let an enemy end up stuck inside a wall where it cannot be hit
      if (!e.isDummy && !e.isBoss && collides(this.map, e.x, e.y, Math.min(e.r, 6))) {
        e.stuckT = (e.stuckT || 0) + wdt;
        if (e.stuckT > 0.5) { const p = this.findFreeSpot(e.x, e.y, e.r, this.dungeon?.rooms[e.room]); if (p) { e.x = p.x; e.y = p.y; } e.stuckT = 0; }
      } else e.stuckT = 0;
    }
    this.enemies = this.enemies.filter((e) => !e.dead);
    this.allies = this.allies.filter((a) => a.update(wdt, this));
    this.projectiles.update(wdt, this);
    for (const h of this.hazards) if (!h.dead) updateHazard(h, wdt, this);
    this.hazards = this.hazards.filter((h) => !h.dead);
    for (const p of this.pickups) p.update(wdt, this);
    this.pickups = this.pickups.filter((p) => !p.dead);
    this.fx.update(wdt);
    if (this.area === 'dungeon') this.updateRooms();
    else if (this.area === 'world') this.updateWorld(wdt);
    this.updateInteraction();
    this.updateTutorial(dt);
    this.updateCamera(dt);
    this.ui.updateHud(this);
  }

  handleGlobalKeys() {
    const inp = this.input;
    if (this.mode !== 'play') return;
    if (inp.wasPressed('Escape')) {
      if (this.overlay === 'dead' || this.overlay === 'complete' || this.overlay === 'victory') return;
      if (this.overlay) this.closeOverlay();
      else this.openOverlay('pause');
    }
    if (inp.wasPressed('KeyI', 'Tab')) {
      if (this.overlay === 'inventory') this.closeOverlay();
      else if (!this.overlay || this.overlay === 'vendor') this.openOverlay('inventory');
    }
    if (inp.wasPressed('KeyM')) this.ui.toggleMinimap();
    if (inp.wasPressed('KeyK')) { if (this.overlay === 'index') this.closeOverlay(); else if (!this.overlay) this.openOverlay('index'); }
    if (inp.wasPressed('Backquote')) { if (this.overlay === 'admin') this.closeOverlay(); else if (!this.overlay) this.openOverlay('admin'); }
  }

  openOverlay(name) {
    if (this.cinematic && name !== 'pause') return;
    this.overlay = name;
    this.input.reset();
    if (name === 'pause') this.ui.showPause(this.area === 'dungeon');
    if (name === 'inventory') { this.ui.showInventory(this); this.onAction('inventory'); }
    if (name === 'vendor') this.ui.showVendor(this);
    if (name === 'board') this.ui.showBoard(this);
    if (name === 'index') this.ui.showIndex(this);
    if (name === 'admin') this.ui.showAdmin(this);
    if (name === 'wardrobe') this.ui.showWardrobe(this);
    this.audio.play('click');
  }
  closeOverlay() {
    this.overlay = null;
    this.ui.hideOverlays();
    this.input.reset();
  }
  inputBlocked() { return !!this.overlay || !!this.cinematic; }

  // ───────────────────────── rooms ─────────────────────────
  updateRooms() {
    const d = this.dungeon, pl = this.player, map = this.map;
    const tx = Math.floor(pl.x / TILE), ty = Math.floor(pl.y / TILE);
    const rid = map.roomAt(pl.x, pl.y);
    this.currentRoom = rid >= 0 ? d.rooms[rid] : null;
    if (this.currentRoom) {
      const r = this.currentRoom;
      if (!r.visited) { r.visited = true; if (r.type === 'secret') this.ui.toast('You found a secret room!', '#b46cff'); }
      const inset = r.type === 'boss' ? 2 : 1;
      const inside = tx >= r.x0 + inset && tx <= r.x1 - inset && ty >= r.y0 + inset && ty <= r.y1 - inset;
      if (inside && !r.cleared && !r.locked) this.lockRoom(r);
    }
    for (const r of d.rooms) {
      if (!r.locked || r.pending > 0) continue;
      if (this.enemies.some((e) => !e.dead && e.room === r.id && !e.isDummy)) continue;
      if (r.type === 'trial' && r.wave < 2) { r.wave++; this.spawnWave(r, 1.3 + r.wave * 0.2, 0.3); this.ui.toast(`Trial wave ${r.wave + 1} of 3`, '#ffa630'); continue; }
      if (r.type === 'boss') continue; // the boss's death handles this room
      this.unlockRoom(r);
    }
  }

  lockRoom(r) {
    if (r.type === 'trial') return; // trials start from the altar
    r.locked = true;
    this.map.closedRooms.add(r.id);
    this.audio.play('gate');
    if (r.type === 'boss') { this.startBoss(r); return; }
    if (r.type === 'elite') {
      const kinds = ['brute', 'charger', 'summoner'];
      const cx = r.centerX * TILE, cy = r.centerY * TILE;
      this.spawnEnemyDelayed(this.rng.pick(kinds), cx, cy - 10, { room: r.id, miniboss: true, aggro: true }, 1.0, r);
      this.spawnWave(r, 0.5);
      this.ui.toast('A Warlord guards this room!', '#ff4f7a');
    } else this.spawnWave(r, 1);
  }

  unlockRoom(r) {
    r.locked = false;
    r.cleared = true;
    this.map.closedRooms.delete(r.id);
    this.audio.play('clear');
    this.fx.text(this.player.x, this.player.y - 30, 'CLEAR', '#5fd068', true);
    if (r.type === 'elite') { this.addChest(r.centerX * TILE, r.centerY * TILE, 'elite'); this.ui.toast('The Warlord dropped a chest', '#ffd36b'); }
    if (r.type === 'trial') { r.altar.state = 'done'; this.addChest(r.centerX * TILE, r.centerY * TILE + 18, 'trial'); this.ui.toast('Trial complete! A reward appears.', '#ffd36b'); }
    else if (this.rng.chance(0.3)) this.dropLoot(r.centerX * TILE, r.centerY * TILE, { items: [makeItem(this.rng.chance(0.6) ? 'hp_potion' : 'mp_potion', this.rng)], gold: 4 * (this.regionDef.index + 1) });
  }

  startTrial(r) {
    r.altar.state = 'active';
    r.locked = true;
    r.wave = 0;
    this.map.closedRooms.add(r.id);
    this.audio.play('gate');
    this.ui.toast('Trial wave 1 of 3', '#ffa630');
    this.spawnWave(r, 1.3, 0.3);
  }

  spawnWave(r, mult = 1, eliteChance = 0.08) {
    const region = this.regionDef;
    let budget = this.rng.range(region.budget[0], region.budget[1]) * mult * (this.heroic ? 1.25 : 1);
    const weights = Object.entries(region.weights).map(([k, w]) => ({ w, v: k }));
    const spots = this.spawnSpots(r);
    let n = 0;
    while (budget > 0 && spots.length && n < 18) {
      const kind = this.rng.weighted(weights);
      const cost = { chaser: 1, shooter: 1.5, flanker: 1.5, brute: 4, lobber: 2, summoner: 3, turret: 3, charger: 2.5 }[kind];
      budget -= cost;
      const [x, y] = spots.splice(this.rng.int(0, spots.length - 1), 1)[0];
      this.spawnEnemyDelayed(kind, x, y, { room: r.id, elite: this.rng.chance(eliteChance + (this.heroic ? 0.08 : 0)), aggro: true }, 0.7 + n * 0.05, r);
      n++;
    }
  }

  spawnSpots(r) {
    const spots = [], pl = this.player;
    for (let y = r.y0 + 1; y <= r.y1 - 1; y++)
      for (let x = r.x0 + 1; x <= r.x1 - 1; x++) {
        if (this.map.get(x, y) !== T.FLOOR) continue;
        if (this.map.get(x + 1, y) === T.PILLAR || this.map.get(x - 1, y) === T.PILLAR) continue;
        const px = x * TILE + 8, py = y * TILE + 8;
        if (dist(px, py, pl.x, pl.y) < 80) continue;
        spots.push([px, py]);
      }
    return spots;
  }

  // Nearest walkable spot (inside the given room if any) for an entity of radius r.
  findFreeSpot(x, y, r = 7, room = null) {
    const ok = (px, py) => {
      if (collides(this.map, px, py, r)) return false;
      if (this.map.tileAt(px, py) === T.HAZARD) return false;
      if (room) { const tx = Math.floor(px / TILE), ty = Math.floor(py / TILE); if (tx <= room.x0 || ty <= room.y0 || tx >= room.x1 || ty >= room.y1) return false; }
      return true;
    };
    if (ok(x, y)) return { x, y };
    for (let rad = 8; rad <= 96; rad += 8)
      for (let a = 0; a < Math.PI * 2; a += Math.PI / 8) {
        const px = x + Math.cos(a) * rad, py = y + Math.sin(a) * rad;
        if (ok(px, py)) return { x: px, y: py };
      }
    return room ? { x: room.centerX * TILE, y: room.centerY * TILE } : null;
  }

  spawnEnemyDelayed(kind, x, y, opts, delay = 0.7, room) {
    const r = room || (opts.room >= 0 && this.dungeon ? this.dungeon.rooms[opts.room] : null);
    const spot = this.findFreeSpot(x, y, 9, r);
    if (!spot) return;
    x = spot.x; y = spot.y;
    if (r) r.pending++;
    const color = opts.miniboss ? '#ff4f7a' : opts.elite ? '#ffd36b' : '#ff7ae6';
    this.hazards.push(makeHazard('spawn', {
      x, y, warn: delay, color,
      onDone: (g) => {
        if (r) r.pending--;
        if (g.area === 'title') return;
        const e = new Enemy(g, kind, x, y, opts);
        g.enemies.push(e);
        g.fx.burst(x, y - 6, 10, [color, '#ffffff'], 40, 0.3);
      },
    }));
    this.audio.play('spawn');
  }

  spawnClone(x, y, boss) {
    const spot = this.findFreeSpot(x, y, 9, boss.room);
    x = spot.x; y = spot.y;
    const c = new LumenClone(this, x, y, boss);
    this.enemies.push(c);
    this.fx.burst(x, y - 8, 16, ['#7ae0ff', '#ff7ae6'], 60, 0.4);
  }

  // ───────────────────────── boss ─────────────────────────
  startBoss(r) {
    const region = this.regionDef;
    const b = new Boss(this, region.boss, r.centerX * TILE, (r.y0 + 4) * TILE, r);
    this.boss = b;
    this.enemies.push(b);
    this.audio.music('boss');
    this.audio.play('bossIntro');
    this.ui.bossIntro(b.data);
    this.cinematic = {
      t: 2.8, focus: b,
      done: (g) => { b.state = 'fight'; b.invuln = false; g.ui.bossBar(b); g.ui.toast(b.data.signature, b.data.color); },
    };
  }

  onBossPhase(b) {
    this.shake(10);
    this.audio.play('roar');
    this.fx.ring(b.x, b.cy, 10, 80, 0.5, b.data.color, 3);
    this.ui.banner(`${b.name} is enraged!`, 'Phase 2', 1.6);
  }

  bossDefeated(b) {
    if (this.area === 'world' || b.isMini) { this.worldBossDefeated(b); return; }
    b.state = 'dying';
    b.invuln = true;
    this.slowmoT = 1.6;
    this.audio.play('bossDie');
    this.projectiles.clearHostile();
    for (const h of this.hazards) if (!h.friendly && h.type !== 'pool') h.dead = true;
    for (const e of this.enemies) if (e !== b && !e.dead) { e.hp = 0; this.killEnemy(e, true); }
    this.cinematic = {
      t: 1.8, focus: b,
      done: (g) => {
        g.shake(14);
        g.fx.burst(b.x, b.cy, 90, [b.data.color, '#ffffff', '#ffd36b'], 160, 1.0, 2);
        g.fx.ring(b.x, b.cy, 10, 120, 0.7, '#ffffff', 3);
        g.audio.play('boom');
        b.dead = true;
        g.boss = null;
        g.ui.bossBar(null);
        g.finishBossRewards(b);
      },
    };
  }

  worldBossDefeated(b) {
    b.state = 'dying';
    b.invuln = true;
    this.slowmoT = 0.8;
    this.audio.play('bossDie');
    for (const e of this.enemies) if (e.parent === b && !e.dead) { e.hp = 0; this.killEnemy(e, true); }
    this.shake(12);
    this.fx.burst(b.x, b.cy, 70, [b.data.color, '#ffffff', '#ffd36b'], 150, 0.9, 2);
    this.fx.ring(b.x, b.cy, 10, 100, 0.6, '#ffffff', 3);
    b.dead = true;
    if (this.boss === b) { this.boss = null; this.ui.bossBar(null); }
    const save = this.save;
    const loot = rollBossDrop(this.rng, { bossId: b.bossId, region: b.regionIndex, pity: 0, heroic: false, mythicChance: b.isMini ? 0.025 : NORMAL_MYTHIC_CHANCE });
    this.dropLoot(b.x, b.y, loot);
    this.gainXp(b.data.xp);
    if (b.isMini) {
      if (!save.minibossesDefeated.includes(b.bossId)) save.minibossesDefeated.push(b.bossId);
      this.lairTimers[b.bossId] = this.time + 120;
      this.ui.toast(`${b.name} defeated! It will return in 2 minutes.`, b.data.color, 4);
      if (this.area === 'world' && Math.random() < 0.5) this.spawnWorldPortal(b.x, b.y + 30, b.regionIndex, save.heroicUnlocked && Math.random() < 0.35);
    } else if (!save.bossesDefeated.includes(b.bossId)) {
      save.bossesDefeated.push(b.bossId);
    }
    this.save.stats.kills++;
    this.queueSave();
  }

  finishBossRewards(b) {
    const save = this.save, region = this.regionDef;
    const firstKill = !save.bossesDefeated.includes(b.bossId);
    const loot = rollBossDrop(this.rng, { bossId: b.bossId, region: region.index, pity: save.pity, heroic: this.heroic, mythicChance: this.heroic ? HEROIC.mythicChance : NORMAL_MYTHIC_CHANCE });
    save.pity = loot.pity;
    this.dropLoot(b.x, b.y, loot);
    this.gainXp(b.data.xp * (this.heroic ? 1.5 : 1));
    this.run.bossDown = true;
    this.run.unlocks = [];
    if (firstKill) {
      save.bossesDefeated.push(b.bossId);
      if (save.regionsUnlocked < region.index + 2 && region.index + 1 < REGIONS.length) {
        save.regionsUnlocked = region.index + 2;
        this.run.unlocks.push(`New region unlocked: ${REGIONS[region.index + 1].name}`);
      }
      if (b.bossId === 'bramblemaw' && !save.unlockedClasses.includes('warden')) {
        save.unlockedClasses.push('warden');
        this.run.unlocks.push('New class unlocked: Warden (change class at the Shrine of Echoes)');
      }
      if (b.bossId === 'lumen') {
        save.heroicUnlocked = true;
        this.run.unlocks.push('Heroic difficulty unlocked for every region (better loot, more Mythics)');
      }
      if (b.bossId === 'glacius') this.run.finalVictory = true;
    }
    for (const u of this.run.unlocks) this.ui.toast(u, '#ffd36b', 5);
    // exit portal
    const r = b.room;
    const portal = { kind: 'exitPortal', x: r.centerX * TILE, y: r.centerY * TILE + 10 };
    this.npcs.push(portal);
    this.interactables.push({ x: portal.x, y: portal.y, r: 22, label: 'Leave through the portal', action: (g) => g.completeDungeon() });
    r.locked = false; r.cleared = true;
    this.map.closedRooms.delete(r.id);
    this.audio.music(region.theme);
    this.saveNow();
  }

  completeDungeon() {
    this.save.stats.clears++;
    this.audio.play('complete');
    this.overlay = this.run.finalVictory ? 'victory' : 'complete';
    this.ui.showComplete(this, this.run, !!this.run.finalVictory);
    this.saveNow();
  }

  // ───────────────────────── admin panel ─────────────────────────
  adminGive(baseId, qty = 1) {
    const base = getBase(baseId);
    const it = makeItem(baseId, this.rng, base.stack ? Math.min(qty, base.stack) : undefined);
    if (!this.collectItem(it)) { this.dropLoot(this.player.x, this.player.y, { items: [it] }); this.ui.toast('Bag full: dropped it at your feet', '#ffa630'); }
  }

  adminSpawnBoss(id) {
    const pl = this.player, def = ALL_BOSSES[id];
    if (!def) return;
    const spot = this.findFreeSpot(pl.x, pl.y - 100, 14) || { x: pl.x, y: pl.y - 60 };
    const tx = Math.floor(spot.x / TILE), ty = Math.floor(spot.y / TILE);
    const room = this.area === 'dungeon' && this.currentRoom ? this.currentRoom
      : { id: -200, x0: tx - 11, y0: ty - 6, x1: tx + 11, y1: ty + 10, w: 23, h: 17, centerX: tx + 0.5, centerY: ty + 2.5 };
    const b = new Boss(this, id, spot.x, spot.y, room);
    b.state = 'fight'; b.invuln = false; b.aggro = true; b.wait = 1.2;
    this.enemies.push(b);
    this.boss = b;
    this.ui.bossBar(b);
    this.audio.play('bossIntro');
    this.ui.toast(`Admin: spawned ${def.name}`, def.color, 3);
  }

  adminCheat(kind) {
    const s = this.save, pl = this.player;
    switch (kind) {
      case 'gold': s.gold += 1000; break;
      case 'level': for (let i = 0; i < 5; i++) this.gainXp(xpForLevel(this.classState().level)); break;
      case 'heal': pl.hp = pl.stats.maxHp; pl.mp = pl.stats.maxMp; break;
      case 'god': this.god = !this.god; this.ui.toast(`God mode ${this.god ? 'ON' : 'OFF'}`, '#ffd36b'); break;
      case 'unlock':
        s.regionsUnlocked = REGIONS.length; s.heroicUnlocked = true;
        for (const c of Object.keys(CLASSES)) if (!s.unlockedClasses.includes(c)) s.unlockedClasses.push(c);
        this.ui.toast('All regions, classes and Heroic mode unlocked', '#ffd36b');
        break;
      case 'clear': for (const e of this.enemies) if (!e.dead && !e.isDummy) { e.hp = 0; this.killEnemy(e, true); if (e.isBoss) e.dead = true; } this.boss = null; this.ui.bossBar(null); break;
    }
    this.queueSave();
  }

  // ───────────────────────── combat callbacks ─────────────────────────
  hitEnemy(e, raw, crit, o = {}) {
    if (e.dead || e.invuln) return;
    const pl = this.player, s = pl.stats;
    const marked = e.markT > 0 && s.effects.has('mark');
    const dmg = damageToEnemy(raw, e.def || 0, marked);
    if (e.isDummy) {
      e.record(this, dmg);
      e.flash = 0.08;
      this.fx.text(e.x, e.y - 22, dmg, crit ? '#ffd36b' : '#ffffff', crit);
      if (this.tutorial && this.tutorial.step === 1) this.tutorial.dummyHits++;
      if (!o.quiet) this.audio.play(crit ? 'crit' : 'hit');
      return;
    }
    e.hp -= dmg;
    e.flash = 0.08;
    if (o.knock !== 0 && !e.isBoss) {
      const kr = 1 - (e.knockResist || 0);
      let a;
      if (o.vx != null) a = Math.atan2(o.vy, o.vx);
      else if (o.fromX != null) a = Math.atan2(e.y - o.fromY, e.x - o.fromX);
      else a = Math.atan2(e.y - pl.y, e.x - pl.x);
      const k = (o.knock ?? 60) * kr;
      e.kvx = (e.kvx || 0) + Math.cos(a) * k;
      e.kvy = (e.kvy || 0) + Math.sin(a) * k;
    }
    if (o.slow) e.slowT = Math.max(e.slowT || 0, o.slow);
    if (o.root && !e.isBoss) e.rootT = o.root;
    if (o.stun && !e.isBoss) e.stunT = o.stun;
    if (o.effects) {
      if (o.effects.includes('ignite')) e.burn = { t: 2.5, dps: Math.max(4, raw * 0.3), tick: 0.5 };
      if (o.effects.includes('frost')) e.slowT = Math.max(e.slowT || 0, 1.5);
    }
    if (!o.quiet || o.burnTick) {
      if (this.save.settings.damageNumbers) this.fx.text(e.x, (e.cy ?? e.y) - (e.h || 10) / 2 - 4, dmg, o.burnTick ? '#ff9a3a' : crit ? '#ffd36b' : marked ? '#ff7a9a' : '#ffffff', crit);
    }
    if (!o.quiet) {
      const col = e.isBoss ? e.data.color : '#ffffff';
      this.fx.burst(e.x, e.cy ?? e.y, crit ? 8 : 4, [col, '#ffd36b'], crit ? 70 : 45, 0.25);
      this.audio.play(crit ? 'crit' : 'hit');
      if (s.effects.has('mark') && !o.ability) { pl.hitCount++; if (pl.hitCount % 4 === 0) e.markT = 4; }
    }
    if (crit && s.effects.has('lifebloom') && pl.lifebloomCd <= 0) { pl.lifebloomCd = 0.25; this.healPlayer(Math.round(s.maxHp * 0.03), true); }
    if (e.hp <= 0) this.killEnemy(e);
  }

  killEnemy(e, silent = false) {
    if (e.dead || e.state === 'dying') return;
    if (e.isBoss) { e.hp = 0; this.bossDefeated(e); return; }
    e.dead = true;
    this.fx.burst(e.x, e.cy ?? e.y, 16, ['#ffffff', '#c9b9a0', e.pal === 'cinder' ? '#ff7a3a' : e.pal === 'prism' ? '#7ae0ff' : '#6dbb4f'], 70, 0.45, 2);
    if (silent) return;
    this.audio.play('enemyDie');
    if (this.area === 'title' || e.isDummy) return;
    if (this.run) this.run.kills++;
    this.save.stats.kills++;
    this.gainXp(e.xp || 1);
    this.onAction('kill');
    const regionIndex = e.regionIndex ?? this.regionDef.index;
    if (this.area === 'world' && !e.parent && Math.random() < (e.elite ? 0.1 : 0.015))
      this.spawnWorldPortal(e.x, e.y, regionIndex, this.save.heroicUnlocked && e.elite && Math.random() < 0.3);
    if (!e.noDrop && !(e.arch && e.arch.noDrop)) {
      const loot = rollEnemyDrop(this.rng, { region: regionIndex, elite: e.elite || e.miniboss, tierBump: this.heroic ? 1 : 0 });
      if (e.miniboss) loot.gold *= 3;
      this.dropLoot(e.x, e.y, loot);
    }
    if (e.twist === 'deathPool') this.hazards.push(makeHazard('pool', { x: e.x, y: e.y, r: 12 * (e.scale || 1), life: 3, dps: 10 * e.dmgMul, owner: e.name + "'s embers" }));
    if (e.twist === 'deathBurst') {
      for (let i = 0; i < 6; i++) {
        const a = (i * Math.PI) / 3 + Math.random();
        this.projectiles.spawn({ x: e.x, y: e.cy, vx: Math.cos(a) * 85, vy: Math.sin(a) * 85, size: 3, dmg: Math.round(9 * e.dmgMul), friendly: false, life: 1.4, style: e.pal === 'frost' ? 'ice' : 'shard', owner: e.name + "'s shards" });
      }
    }
  }

  dropLoot(x, y, loot) {
    for (const it of loot.items) {
      this.pickups.push(new Pickup(x, y, it));
      const base = getBase(it.base);
      const rank = RARITIES.indexOf(base.rarity);
      if (rank >= 4) { this.audio.play('legendary'); this.ui.lootPopup(base, !this.save.discovered.includes(base.id)); this.shake(rank >= 5 ? 10 : 4); }
      else if (rank >= 2) this.audio.play('rare');
    }
    let gold = loot.gold || 0;
    while (gold > 0) {
      const v = Math.min(gold, Math.max(1, Math.ceil(loot.gold / 5)));
      this.pickups.push(new Pickup(x, y, null, v));
      gold -= v;
    }
  }

  collectItem(item) {
    const base = getBase(item.base);
    if (!addItem(this.save.inventory, item)) return false;
    this.audio.play('pickup');
    this.ui.toast(`${base.name}${(item.qty || 1) > 1 ? ' x' + item.qty : ''}`, RARITY_COLOR[base.rarity], 2.2, item);
    if (!this.save.discovered.includes(base.id)) {
      this.save.discovered.push(base.id);
      if (base.rarity === 'legendary' || base.rarity === 'mythic') this.ui.toast('New entry in your Index! (press K)', RARITY_COLOR[base.rarity], 3.5);
    }
    if (this.run) this.run.items.push(item);
    if (this.overlay === 'inventory') this.ui.refreshInventory(this);
    this.queueSave();
    return true;
  }

  collectGold(v, x, y) {
    this.save.gold += v;
    if (this.run) this.run.gold += v;
    this.audio.play('gold');
    this.fx.text(x, y - 10, '+' + v, '#ffd36b');
    this.queueSave();
  }

  gainXp(amount) {
    amount = Math.round(amount);
    const cs = this.classState();
    if (this.run) this.run.xp += amount;
    const before = cs.level;
    const gained = addXp(cs, amount);
    if (gained > 0) {
      this.refreshStats();
      const pl = this.player;
      pl.hp = pl.stats.maxHp; pl.mp = pl.stats.maxMp;
      this.audio.play('levelUp');
      this.fx.burst(pl.x, pl.y - 8, 40, ['#ffd36b', '#ffffff', '#5fd068'], 90, 0.7);
      this.fx.ring(pl.x, pl.y - 8, 4, 40, 0.5, '#ffd36b', 2);
      this.ui.toast(`Level up! ${CLASSES[pl.cls].name} is now level ${cs.level}`, '#ffd36b', 3.5);
      if (before < ABILITY3_LEVEL && cs.level >= ABILITY3_LEVEL) this.ui.toast(`New ability: [R] ${CLASSES[pl.cls].abilities[2].name}`, '#7ae0ff', 5);
      this.queueSave();
    }
  }

  // Returns true if damage was applied.
  damagePlayer(raw, source, o = {}) {
    const pl = this.player;
    if (pl.dead || this.cinematic || this.overlay === 'dead' || this.god) return false;
    if (!o.dot && pl.isInvulnerable()) return false;
    if (o.dot && (pl.dodgeT > 0 || pl.leap)) return false;
    let dmg = applyDefense(raw, pl.stats.def);
    if (pl.barrier) {
      const absorbed = Math.min(pl.barrier.amt, dmg);
      pl.barrier.amt -= absorbed;
      dmg -= absorbed;
      if (absorbed) this.fx.burst(pl.x, pl.y - 8, 6, ['#ffd36b', '#ffffff'], 50, 0.3);
    }
    if (dmg > 0) {
      pl.hp -= dmg;
      this.fx.text(pl.x, pl.y - 22, '-' + dmg, '#ff4f5e', dmg > pl.stats.maxHp * 0.15);
      this.fx.burst(pl.x, pl.y - 8, 8, ['#ff4f5e', '#ffffff'], 60, 0.3);
    }
    if (!o.dot) { pl.iframes = 0.55; this.shake(Math.min(6, 2 + dmg / 10)); this.audio.play('playerHurt'); }
    else this.audio.play('hit');
    this.ui.hurtFlash();
    pl.lastHitBy = source || 'something';
    if (pl.hp <= 0) this.playerDied();
    return true;
  }

  healPlayer(amount, quiet) {
    const pl = this.player;
    const before = pl.hp;
    pl.hp = Math.min(pl.stats.maxHp, pl.hp + amount);
    const got = Math.round(pl.hp - before);
    if (got > 0 && !quiet) this.fx.text(pl.x, pl.y - 24, '+' + got, '#5fd068');
    else if (got > 0 && Math.random() < 0.5) this.fx.particle(pl.x + (Math.random() - 0.5) * 8, pl.y - 10, 0, -20, 0.5, '#5fd068');
  }

  playerDied() {
    const pl = this.player;
    if (consumeOne(this.save.inventory, 'phoenix_feather')) {
      pl.hp = Math.round(pl.stats.maxHp * 0.5);
      pl.iframes = 2;
      this.fx.burst(pl.x, pl.y - 8, 60, ['#ff7a3a', '#ffd36b', '#ffffff'], 120, 0.8, 2);
      this.audio.play('legendary');
      this.ui.toast('The Phoenix Feather burns away, and you rise again!', '#ff7a3a', 4);
      return;
    }
    pl.hp = 0;
    pl.dead = true;
    this.save.stats.deaths++;
    this.fx.burst(pl.x, pl.y - 8, 50, ['#ff4f5e', '#ffffff', CLASSES[pl.cls].color], 100, 0.9, 2);
    this.audio.play('death');
    this.overlay = 'dead';
    const lostGold = this.run ? Math.min(this.save.gold, Math.round(this.run.gold)) : 0;
    this.save.gold -= lostGold;
    setTimeout(() => this.ui.showDeath(this, pl.lastHitBy, lostGold), 900);
    this.saveNow();
  }

  respawnAtHub() {
    this.closeOverlay();
    this.returnPoint = null;
    this.enterWorld({ town: true });
    this.ui.toast('You wake in Emberlight Haven. Your items are safe.', '#c9d1e0', 4);
  }

  abandonRun() {
    this.closeOverlay();
    this.returnToWorld();
  }

  usePotion(baseId) {
    const pl = this.player;
    if (pl.potionCd > 0) return;
    const count = countItem(this.save.inventory, baseId);
    if (!count) { this.ui.toast(baseId === 'hp_potion' ? 'No Health Potions' : 'No Mana Potions', '#ff4f5e'); this.audio.play('deny'); return; }
    if (baseId === 'hp_potion' && pl.hp >= pl.stats.maxHp) return;
    if (baseId === 'mp_potion' && pl.mp >= pl.stats.maxMp) return;
    this.useConsumable(baseId);
  }

  // Applies a consumable's effect and removes one from the inventory. Returns true on success.
  useConsumable(baseId) {
    const base = getBase(baseId), pl = this.player;
    if (!base || base.slot !== 'consumable') return false;
    if (base.use === 'passive') { this.ui.toast('This works automatically from your bag', '#c9d1e0'); return false; }
    if (base.use === 'return' && this.area !== 'dungeon') { this.ui.toast('You can only use this inside a dungeon', '#c9d1e0'); return false; }
    if (!consumeOne(this.save.inventory, baseId)) return false;
    pl.potionCd = 0.4;
    switch (base.use) {
      case 'heal': this.healPlayer(Math.round(pl.stats.maxHp * 0.45)); this.audio.play('heal'); break;
      case 'mana': pl.mp = Math.min(pl.stats.maxMp, pl.mp + pl.stats.maxMp * 0.6); this.audio.play('heal'); this.fx.text(pl.x, pl.y - 24, '+MP', '#4f8bff'); break;
      case 'fury': pl.buffs = pl.buffs.filter((b) => b.id !== 'fury'); pl.buffs.push({ id: 'fury', t: 20, stats: { dmgPct: 0.3 } }); this.refreshStats(); this.ui.toast('Fury! +30% damage', '#ffa630'); this.audio.play('ability'); break;
      case 'swift': pl.buffs = pl.buffs.filter((b) => b.id !== 'swift'); pl.buffs.push({ id: 'swift', t: 20, stats: { spd: 25 } }); this.refreshStats(); this.ui.toast('Swiftness! +25 speed', '#5fd068'); this.audio.play('ability'); break;
      case 'return':
        this.closeOverlay();
        this.audio.play('portal');
        this.ui.toast('The scroll carries you out with your loot.', '#4f8bff', 3);
        this.returnToWorld();
        break;
    }
    this.fx.burst(pl.x, pl.y - 8, 12, ['#ffffff', RARITY_COLOR[base.rarity]], 50, 0.4);
    if (this.overlay === 'inventory') this.ui.refreshInventory(this);
    this.queueSave();
    return true;
  }

  hitCrack(tx, ty, dmg) {
    if (this.map.damageCrack(tx, ty, dmg)) {
      this.audio.play('crackBreak');
      this.shake(5);
      this.fx.burst(tx * TILE + 8, ty * TILE + 8, 30, ['#8e889b', '#6b6577', '#c9d1e0'], 90, 0.6, 2);
      this.ui.toast('A hidden passage crumbles open!', '#b46cff');
      for (const [x, y] of this.map.dirty)
        for (let yy = y - 1; yy <= y + 1; yy++) for (let xx = x - 1; xx <= x + 1; xx++) this.level.invalidate(xx, yy);
      this.map.dirty.length = 0;
    } else {
      this.fx.burst(tx * TILE + 8, ty * TILE + 8, 4, ['#8e889b', '#c9d1e0'], 40, 0.3);
      this.audio.play('hit');
    }
  }

  hazardName() { return HAZARD_NAME[this.theme] || 'the ground'; }
  shake(a) { if (this.save.settings.shake) this.cam.shake = Math.max(this.cam.shake, a); }
  toast(msg, color) { this.ui.toast(msg, color); }

  // ───────────────────────── interaction + tutorial ─────────────────────────
  updateInteraction() {
    const pl = this.player;
    let best = null, bd = Infinity;
    for (const it of this.interactables) {
      const label = it.label;
      if (!label) continue;
      const d = dist(pl.x, pl.y, it.x, it.y);
      if (d < it.r && d < bd) { bd = d; best = it; }
    }
    this.nearby = best;
    if (best && !this.inputBlocked() && this.input.wasPressed('KeyF')) { best.action(this); this.audio.play('click'); }
  }

  onAction(kind) {
    const t = this.tutorial;
    if (!t) return;
    const step = TUTORIAL[t.step];
    if (step && step.id === kind) this.advanceTutorial();
  }

  updateTutorial(dt) {
    const t = this.tutorial;
    if (!t || this.area !== 'world') return;
    const step = TUTORIAL[t.step];
    if (!step) return;
    if (step.id === 'move' && this.player.moving) { t.moved += dt; if (t.moved > 0.6) this.advanceTutorial(); }
    if (step.id === 'attack' && t.dummyHits >= 4) this.advanceTutorial();
  }

  advanceTutorial() {
    this.tutorial.step++;
    this.audio.play('pickup');
    this.ui.setTutorial(this.tutorialText());
  }

  tutorialText() {
    const t = this.tutorial;
    if (!t) return null;
    return { steps: TUTORIAL.map((s) => s.text), current: t.step };
  }

  objectiveText() {
    const s = this.save;
    if (this.area === 'dungeon') {
      if (this.run?.bossDown) return 'Step into the portal to return home';
      return `Find and defeat ${BOSSES[this.regionDef.boss].name}`;
    }
    const next = REGIONS.find((r) => !s.bossesDefeated.includes(r.boss));
    if (next) return `Defeat ${BOSSES[next.boss].name} (${next.name} dungeon: town portal or a dungeon portal)`;
    return 'Every realm is saved. Hunt Mythics in Heroic dungeons and mini-boss lairs';
  }

  // ───────────────────────── camera ─────────────────────────
  resize() {
    const w = window.innerWidth, h = window.innerHeight;
    const scale = Math.max(1, Math.ceil(Math.min(w / VIEW_MAX_W, h / VIEW_MAX_H)));
    this.view = { w: Math.ceil(w / scale), h: Math.ceil(h / scale), scale };
    this.canvas.width = this.view.w;
    this.canvas.height = this.view.h;
    this.canvas.style.width = this.view.w * scale + 'px';
    this.canvas.style.height = this.view.h * scale + 'px';
    this.input.scale = scale;
    this.ctx.imageSmoothingEnabled = false;
  }

  mouseWorld() {
    return { x: this.input.mouse.x + this.cam.x, y: this.input.mouse.y + this.cam.y };
  }

  snapCamera() {
    this.cam.x = this.player.x - this.view.w / 2;
    this.cam.y = this.player.y - this.view.h / 2;
    this.clampCamera();
  }

  updateCamera(dt) {
    let tx, ty;
    if (this.cinematic) { tx = this.cinematic.focus.x; ty = this.cinematic.focus.y - 20; }
    else {
      const pl = this.player;
      const m = this.input.mouse;
      tx = pl.x + clamp((m.x - this.view.w / 2) * 0.18, -40, 40);
      ty = pl.y - 8 + clamp((m.y - this.view.h / 2) * 0.18, -30, 30);
    }
    const k = 1 - Math.pow(0.0005, dt);
    this.cam.x += (tx - this.view.w / 2 - this.cam.x) * k;
    this.cam.y += (ty - this.view.h / 2 - this.cam.y) * k;
    this.clampCamera();
    this.cam.shake = Math.max(0, this.cam.shake - dt * 30);
  }

  clampCamera() {
    const mw = this.map.w * TILE, mh = this.map.h * TILE;
    this.cam.x = mw < this.view.w ? (mw - this.view.w) / 2 : clamp(this.cam.x, 0, mw - this.view.w);
    this.cam.y = mh < this.view.h ? (mh - this.view.h) / 2 : clamp(this.cam.y, 0, mh - this.view.h);
  }

  // ───────────────────────── rendering ─────────────────────────
  render() {
    const ctx = this.ctx, v = this.view;
    if (!this.level) return;
    ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = this.themeObj().bg;
    ctx.fillRect(0, 0, v.w, v.h);
    if (this.mode === 'title') {
      const t = this.titleCam.t;
      this.cam.x = (this.map.w * TILE - v.w) / 2 + Math.sin(t * 0.1) * 120;
      this.cam.y = (this.map.h * TILE - v.h) / 2 + Math.cos(t * 0.08) * 60;
      this.clampCamera();
    }
    const sx = this.cam.shake ? (Math.random() - 0.5) * this.cam.shake : 0;
    const sy = this.cam.shake ? (Math.random() - 0.5) * this.cam.shake : 0;
    const cx = Math.round(this.cam.x + sx), cy = Math.round(this.cam.y + sy);
    ctx.save();
    ctx.translate(-cx, -cy);
    // static level (cached in chunks)
    this.level.draw(ctx, cx, cy, v.w, v.h);
    this.renderAnimatedTiles(ctx, cx, cy);

    for (const h2 of this.hazards) renderHazardBelow(ctx, h2, this.time);
    this.fx.renderBelow(ctx);

    // y-sorted world objects
    const list = [];
    const inView = (x, y, m = 48) => x > cx - m && x < cx + v.w + m && y > cy - m && y < cy + v.h + m * 2;
    for (const p of this.props) if (inView(p.x, p.y, 80)) list.push(p);
    for (const n of this.npcs) if (inView(n.x, n.y)) list.push(n);
    for (const c of this.chests) list.push(c);
    for (const p of this.pickups) if (inView(p.x, p.y)) list.push(p);
    for (const e of this.enemies) if (inView(e.x, e.y, 64)) list.push(e);
    for (const a of this.allies) list.push(a);
    if (this.player) list.push(this.player);
    list.sort((a, b) => a.y - b.y);
    for (const o of list) {
      if (o.render) o.render(ctx, this, this.time);
      else if (o.kind) this.renderNpc(ctx, o);
      else drawSprite(ctx, o.name, o.anim ? Math.floor(this.time * 3) % 2 : 0, o.x, o.y);
    }
    this.projectiles.render(ctx, this.time);
    this.fx.render(ctx);
    for (const h2 of this.hazards) renderHazardAbove(ctx, h2, this.time);
    ctx.restore();

    if (this.themeObj().dark > 0 && this.mode === 'play') this.renderLighting(ctx, cx, cy);
    ctx.save();
    ctx.translate(-cx, -cy);
    this.fx.renderTexts(ctx, true);
    if (this.nearby && !this.inputBlocked()) this.drawLabel(ctx, 'F', this.nearby.x, this.nearby.y - 30, '#ffd36b');
    ctx.restore();
  }

  renderAnimatedTiles(ctx, cx, cy) {
    const map = this.map, lv = this.level;
    const x0 = Math.max(0, Math.floor(cx / TILE)), y0 = Math.max(0, Math.floor(cy / TILE));
    const x1 = Math.min(map.w - 1, x0 + Math.ceil(this.view.w / TILE) + 1), y1 = Math.min(map.h - 1, y0 + Math.ceil(this.view.h / TILE) + 1);
    const f = Math.floor(this.time * 5) % 4;
    for (let y = y0; y <= y1; y++)
      for (let x = x0; x <= x1; x++) {
        const t = map.t[y * map.w + x];
        if (t === T.HAZARD) ctx.drawImage(lv.tilesFor(lv.themeAt(x, y)).hazard[(f + x + y) % 4], x * TILE, y * TILE);
        else if (t === T.WATER) ctx.drawImage(lv.tilesFor(lv.themeAt(x, y)).water[(f + x) % 4], x * TILE, y * TILE);
        else if (t === T.GATE) {
          const closed = map.isSolid(x, y);
          if (closed) {
            ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.fillRect(x * TILE, y * TILE, TILE, TILE);
            ctx.fillStyle = '#5a5f73';
            for (let i = 1; i < 16; i += 4) ctx.fillRect(x * TILE + i, y * TILE, 2, TILE);
            ctx.fillStyle = '#9aa3b5';
            ctx.fillRect(x * TILE, y * TILE + 3, TILE, 1); ctx.fillRect(x * TILE, y * TILE + 11, TILE, 1);
            ctx.fillStyle = '#ff4f7a'; if (Math.floor(this.time * 3) % 2) ctx.fillRect(x * TILE + 7, y * TILE + 6, 2, 2);
          } else {
            ctx.fillStyle = 'rgba(0,0,0,0.2)'; ctx.fillRect(x * TILE + 1, y * TILE + 7, 14, 1);
          }
        }
      }
  }

  renderNpc(ctx, n) {
    const t = this.time;
    switch (n.kind) {
      case 'vendor': drawSprite(ctx, 'hero_vendor', Math.floor(t * 2) % 2, n.x, n.y); this.drawLabel(ctx, 'SHOP', n.x, n.y - 28, '#ffd36b'); break;
      case 'shrine': this.drawLabel(ctx, 'CLASS', n.x, n.y - 44, '#7ae0ff'); break;
      case 'board': drawSprite(ctx, 'board', 0, n.x, n.y); break;
      case 'portal': case 'exitPortal': case 'worldPortal': this.renderPortal(ctx, n); break;
      case 'fountainShrine': {
        drawSprite(ctx, 'fountain', n.used ? 0 : Math.floor(t * 3) % 2, n.x, n.y + 8);
        if (!n.used) { ctx.globalAlpha = 0.3 + 0.2 * Math.sin(t * 3); ctx.fillStyle = '#5fd068'; ctx.beginPath(); ctx.ellipse(n.x, n.y + 4, 18, 8, 0, 0, Math.PI * 2); ctx.fill(); ctx.globalAlpha = 1; }
        break;
      }
      case 'altar': {
        ctx.fillStyle = '#3b3446'; ctx.fillRect(n.x - 10, n.y - 6, 20, 10); ctx.fillStyle = '#5a5070'; ctx.fillRect(n.x - 10, n.y - 6, 20, 3);
        const col = n.state === 'idle' ? '#ffa630' : n.state === 'active' ? '#ff4f7a' : '#5a5070';
        ctx.fillStyle = col; ctx.fillRect(n.x - 3, n.y - 14 + Math.sin(t * 3) * 2, 6, 6);
        if (n.state !== 'done') { ctx.globalAlpha = 0.3; ctx.beginPath(); ctx.arc(n.x, n.y - 11, 8, 0, Math.PI * 2); ctx.fill(); ctx.globalAlpha = 1; }
        break;
      }
    }
  }

  renderPortal(ctx, n) {
    const t = this.time;
    const locked = n.locked && n.locked();
    const col = n.kind === 'exitPortal' ? '#ffffff' : n.heroic ? '#ff7ae6' : n.region.portal;
    ctx.fillStyle = '#3b3446';
    ctx.beginPath(); ctx.ellipse(n.x, n.y + 2, 18, 7, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#5a5070';
    ctx.beginPath(); ctx.ellipse(n.x, n.y, 16, 6, 0, 0, Math.PI * 2); ctx.fill();
    if (locked) {
      ctx.fillStyle = '#2a2633';
      ctx.beginPath(); ctx.ellipse(n.x, n.y - 14, 10, 15, 0, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#8e889b'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(n.x - 9, n.y - 26); ctx.lineTo(n.x + 9, n.y - 2); ctx.moveTo(n.x + 9, n.y - 26); ctx.lineTo(n.x - 9, n.y - 2); ctx.stroke();
    } else {
      for (let i = 0; i < 4; i++) {
        const k = ((t * 0.6 + i / 4) % 1);
        ctx.globalAlpha = 0.8 * (1 - k);
        ctx.strokeStyle = i % 2 ? col : '#ffffff'; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.ellipse(n.x, n.y - 14, 11 * (1 - k * 0.7), 16 * (1 - k * 0.7), 0, 0, Math.PI * 2); ctx.stroke();
      }
      ctx.globalAlpha = 0.5; ctx.fillStyle = col;
      ctx.beginPath(); ctx.ellipse(n.x, n.y - 14, 10, 15, 0, 0, Math.PI * 2); ctx.fill();
      ctx.globalAlpha = 1;
      if (Math.random() < 0.3) this.fx.particle(n.x + (Math.random() - 0.5) * 18, n.y - 4, 0, -30, 0.7, col);
    }
    if (n.kind === 'worldPortal') this.drawLabel(ctx, `${Math.ceil(n.ttl)}`, n.x, n.y - 40, col);
    else if (n.region) this.drawLabel(ctx, n.region.name, n.x, n.y - 40, locked ? '#8e889b' : col);
  }

  renderLighting(ctx, cx, cy) {
    const v = this.view;
    if (!this.lightCanvas || this.lightCanvas.width !== v.w || this.lightCanvas.height !== v.h) {
      this.lightCanvas = document.createElement('canvas');
      this.lightCanvas.width = v.w; this.lightCanvas.height = v.h;
    }
    const lc = this.lightCanvas, l = lc.getContext('2d');
    l.globalCompositeOperation = 'source-over';
    l.clearRect(0, 0, v.w, v.h);
    l.fillStyle = this.themeObj().ambient;
    l.globalAlpha = this.themeObj().dark * (this.area === 'world' ? 0.55 : 1);
    l.fillRect(0, 0, v.w, v.h);
    l.globalAlpha = 1;
    l.globalCompositeOperation = 'destination-out';
    const light = (x, y, r, a = 1) => {
      const gx = x - cx, gy = y - cy;
      if (gx < -r || gy < -r || gx > v.w + r || gy > v.h + r) return;
      const g = l.createRadialGradient(gx, gy, 0, gx, gy, r);
      g.addColorStop(0, `rgba(0,0,0,${a})`);
      g.addColorStop(1, 'rgba(0,0,0,0)');
      l.fillStyle = g;
      l.fillRect(gx - r, gy - r, r * 2, r * 2);
    };
    const pl = this.player;
    light(pl.x, pl.y - 8, 120 + Math.sin(this.time * 3) * 3);
    for (const p of this.projectiles.list) if (p.friendly || p.size > 3) light(p.x, p.y, 18, 0.6);
    for (const e of this.enemies) {
      if (e.isBoss) light(e.x, e.cy, 80, 0.8);
      else if (!e.isDummy) light(e.x, e.cy ?? e.y, 26, 0.55); // keep every enemy readable in the dark
    }
    for (const p of this.pickups) if (p.rank >= 2) light(p.x, p.y, 24, 0.6);
    for (const n of this.npcs) light(n.x, n.y - 10, 50, 0.8);
    for (const h of this.hazards) if (h.type === 'pool' || h.type === 'beam' || h.type === 'telegraph') light(h.x, h.y, (h.r || 30) * 1.6, 0.7);
    // glowing hazard tiles + crystal pillars
    const map = this.map;
    const x0 = Math.max(0, Math.floor(cx / TILE)), y0 = Math.max(0, Math.floor(cy / TILE));
    const x1 = Math.min(map.w - 1, x0 + Math.ceil(v.w / TILE) + 1), y1 = Math.min(map.h - 1, y0 + Math.ceil(v.h / TILE) + 1);
    for (let y = y0; y <= y1; y += 1)
      for (let x = x0; x <= x1; x += 1) {
        const t = map.t[y * map.w + x];
        if (t === T.HAZARD && (x + y) % 2 === 0) light(x * TILE + 8, y * TILE + 8, 26, 0.5);
        else if (t === T.PILLAR && this.theme === 'prism') light(x * TILE + 8, y * TILE, 40, 0.6);
      }
    ctx.drawImage(lc, 0, 0);
  }

  drawLabel(ctx, text, x, y, color) { drawNumber(ctx, text, x, y, color, 1); }
}

function safeStorage() {
  try {
    const k = '__ab_test';
    window.localStorage.setItem(k, '1');
    window.localStorage.removeItem(k);
    return window.localStorage;
  } catch {
    const mem = new Map();
    return { getItem: (k) => mem.get(k) ?? null, setItem: (k, v) => mem.set(k, String(v)), removeItem: (k) => mem.delete(k) };
  }
}
