// Boss runtime: runs pattern generators from content/bosses.js, handles phases, intro and death.
import { ALL_BOSSES, PATTERNS } from '../content/bosses.js';
import { REGIONS } from '../content/regions.js';
import { moveWithCollision } from '../world/tilemap.js';
import { dist, angleTo } from '../util.js';
import { drawSprite } from '../render/sprites.js';
import { makeHazard } from './hazards.js';
import { newEntityId } from './enemy.js';

export class Boss {
  constructor(g, id, x, y, room) {
    const def = ALL_BOSSES[id];
    this.data = def;
    this.id = newEntityId();
    this.bossId = id;
    this.isBoss = true;
    this.isMini = !!def.miniboss;
    this.scale = def.scale || 1;
    this.regionIndex = def.region;
    this.name = def.name;
    this.title = def.title;
    this.x = x; this.y = y;
    this.r = def.r;
    this.h = def.r * 1.6;
    this.state = def.miniboss ? 'fight' : 'intro';
    this.fly = !!def.fly;
    this.maxHp = this.hp = Math.round(def.hp * g.heroicMult.hp);
    this.def = def.def;
    this.dm = def.dmgScale * g.heroicMult.dmg;
    this.room = room;
    this.phase = 1;
    this.flash = 0;
    this.anim = 0;
    this.invuln = !def.miniboss; // until the intro finishes
    this.wait = def.miniboss ? 1.2 : 0;
    this.gen = null;
    this.patternIdx = 0;
    this.lastPattern = null;
    this.still = 0;
    this.kvx = this.kvy = 0;
    this.markT = 0; this.slowT = 0; this.rootT = 0; this.stunT = 0; this.burn = null;
    this.trail = [];
    this.windupT = 0;
    this.dead = false;
    this.g = g;
    for (let i = 0; i < 60; i++) this.trail.push({ x, y });
    this.home = { x, y };
    this.aggro = false;
  }
  get player() { return this.g.player; }
  get cy() { return this.y - this.h / 2; }

  // ── helpers used by pattern scripts ──
  angleToPlayer() { return angleTo(this.x, this.cy, this.player.x, this.player.y - 6); }
  windup(t) { this.windupT = t; }
  sfx(n) { this.g.audio.play(n); }
  holdStill(t) { this.still = t; }
  shootAt(a, speed, o) {
    this.g.projectiles.spawn({
      x: this.x, y: this.cy, vx: Math.cos(a) * speed, vy: Math.sin(a) * speed, size: o.size || 4,
      dmg: Math.round(o.dmg * this.dm), friendly: false, life: 5, style: o.style || 'enemy', owner: this.name,
    });
  }
  shootFrom(x, y, a, speed, o) {
    this.g.projectiles.spawn({
      x, y, vx: Math.cos(a) * speed, vy: Math.sin(a) * speed, size: o.size || 4,
      dmg: Math.round(o.dmg * this.dm), friendly: false, life: o.life || 5, style: o.style || 'enemy', owner: this.name,
    });
  }
  arena() {
    const r = this.room;
    return { x0: r.x0 * 16, y0: r.y0 * 16, x1: (r.x1 + 1) * 16, y1: (r.y1 + 1) * 16 };
  }
  fan(n, spread, speed, o) {
    const base = this.angleToPlayer();
    for (let i = 0; i < n; i++) this.shootAt(base + (i - (n - 1) / 2) * (spread / Math.max(1, n - 1)), speed, o);
  }
  ring(n, speed, offset, o) {
    for (let i = 0; i < n; i++) {
      const a = offset + (i * Math.PI * 2) / n;
      if (o.gapAngle != null) {
        let d = Math.abs(((a - o.gapAngle) % (Math.PI * 2) + Math.PI * 3) % (Math.PI * 2) - Math.PI);
        if (d < o.gapWidth / 2) continue;
      }
      this.shootAt(a, speed, o);
    }
  }
  ground(x, y, r, warn, dmg, o = {}) {
    this.g.hazards.push(makeHazard('telegraph', { x, y, r, warn, dmg: Math.round(dmg * this.dm), owner: this.name, style: o.style || 'slam', pool: o.pool, shake: 2 }));
  }
  lob(x, y, r, flight, dmg, o = {}) {
    this.ground(x, y, r, flight, dmg, o);
    this.g.projectiles.spawn({ x: this.x, y: this.cy, vx: (x - this.x) / flight, vy: (y - this.cy) / flight, life: flight, ghost: true, size: 4, style: 'magma', friendly: false, dmg: 0 });
  }
  pool(x, y, r, life, dps) {
    this.g.hazards.push(makeHazard('pool', { x, y, r, life, dps: dps * this.dm, owner: this.name, style: 'magma' }));
  }
  beam(angle, spin, warn, active, o) {
    this.g.hazards.push(makeHazard('beam', { origin: this, x: this.x, y: this.cy, angle, spin, warn, active, len: 420, dmg: Math.round(o.dmg * this.dm), owner: this.name }));
  }
  lineWarn(angle, len, t) {
    this.g.hazards.push(makeHazard('line', { x: this.x, y: this.y, angle, len, life: t, width: this.r, follow: this }));
  }
  summon(kind, n) {
    for (let i = 0; i < n; i++) {
      const p = this.randomArenaPoint(30);
      if (kind === 'lumenClone') this.g.spawnClone(p.x, p.y, this);
      else {
        const region = REGIONS[this.regionIndex] || this.g.regionDef;
        const tier = this.g.area === 'dungeon' ? this.g.tierMult : { hp: region.diff.hp, dmg: region.diff.dmg };
        this.g.spawnEnemyDelayed(kind, p.x, p.y, { room: this.room.id, parent: this, aggro: true, region, tier }, 0.7);
      }
    }
  }
  teleport(x, y, nearPlayer) {
    const g = this.g;
    g.fx.burst(this.x, this.cy, 20, ['#7ae0ff', '#ff7ae6', '#ffffff'], 90, 0.4);
    let tx = x, ty = y;
    if (nearPlayer) {
      const a = Math.random() * Math.PI * 2;
      tx = x + Math.cos(a) * 50; ty = y + Math.sin(a) * 40;
    }
    const p = this.clampToArena(tx, ty);
    this.x = p.x; this.y = p.y;
    g.fx.burst(this.x, this.cy, 20, ['#7ae0ff', '#ff7ae6', '#ffffff'], 90, 0.4);
    g.audio.play('blink');
  }
  randomArenaPoint(margin = 40) {
    const r = this.room;
    return { x: (r.x0 * 16 + margin) + Math.random() * ((r.w * 16) - margin * 2), y: (r.y0 * 16 + margin) + Math.random() * ((r.h * 16) - margin * 2) };
  }
  clampToArena(x, y) {
    const r = this.room;
    return { x: Math.max(r.x0 * 16 + 24, Math.min((r.x1 + 1) * 16 - 24, x)), y: Math.max(r.y0 * 16 + 30, Math.min((r.y1 + 1) * 16 - 10, y)) };
  }
  *charge(angle, speed, maxT, o) {
    let t = 0, poolT = 0;
    const g = this.g;
    this.charging = true;
    while (t < maxT) {
      const dt = g.dt;
      const { hitX, hitY } = moveWithCollision(g.map, this, Math.cos(angle) * speed * dt, Math.sin(angle) * speed * dt);
      poolT -= dt;
      if (o.pool && poolT <= 0) { poolT = 0.09; this.pool(this.x, this.y, 12, 3.5, 14); }
      if (dist(this.x, this.y, g.player.x, g.player.y) < this.r + g.player.r) g.damagePlayer(Math.round(this.data.contact * 1.4 * this.dm), this.name, { x: this.x, y: this.y });
      if (hitX || hitY) {
        g.shake(8);
        g.audio.play('boom');
        g.fx.burst(this.x, this.y, 30, ['#ff7a3a', '#ffd36b', '#3b1616'], 140, 0.6, 2);
        if (o.wallBurst) this.ring(o.wallBurst, 110, Math.random(), { dmg: 16, style: 'fire', size: 4 });
        break;
      }
      t += dt;
      yield 0;
    }
    this.charging = false;
  }

  update(dt, g) {
    this.anim += dt;
    this.flash = Math.max(0, this.flash - dt);
    this.windupT = Math.max(0, this.windupT - dt);
    this.markT = Math.max(0, this.markT - dt);
    this.slowT = Math.max(0, this.slowT - dt);
    if (this.burn) {
      this.burn.t -= dt; this.burn.tick = (this.burn.tick || 0) - dt;
      if (this.burn.tick <= 0) { this.burn.tick = 0.5; g.hitEnemy(this, this.burn.dps * 0.5, false, { knock: 0, quiet: true }); }
      if (this.burn && this.burn.t <= 0) this.burn = null;
    }
    // trail for segmented bosses
    const last = this.trail[0];
    if (dist(last.x, last.y, this.x, this.y) > 2) { this.trail.unshift({ x: this.x, y: this.y }); this.trail.length = 60; }

    if (this.state === 'intro' || this.state === 'dying') return;

    // open-world mini-bosses idle in their lair until you come close, and reset if you run away
    if (this.isMini) {
      const dp = dist(this.x, this.y, g.player.x, g.player.y);
      if (!this.aggro) {
        if (dp > 230 || g.player.dead) return;
        this.aggro = true;
        g.onMiniAggro(this);
      } else if (dp > 520 || g.player.dead) {
        this.aggro = false;
        this.hp = this.maxHp; this.phase = 1; this.gen = null; this.wait = 1.2; this.invuln = false;
        this.x = this.home.x; this.y = this.home.y;
        g.onMiniReset(this);
        return;
      }
    }

    // phase transitions
    const frac = this.hp / this.maxHp;
    const phases = this.data.phases;
    if (this.phase < phases.length && frac <= phases[this.phase].at) {
      this.phase++;
      this.gen = null;
      this.wait = 1.4;
      this.invuln = true;
      g.onBossPhase(this);
      this.phaseInvuln = 1.4;
    }
    if (this.phaseInvuln > 0) { this.phaseInvuln -= dt; if (this.phaseInvuln <= 0) this.invuln = false; }

    // wander toward the player between/inside patterns
    this.still = Math.max(0, this.still - dt);
    const d = dist(this.x, this.y, g.player.x, g.player.y);
    if (!this.charging && this.still <= 0 && d > 70) {
      const a = angleTo(this.x, this.y, g.player.x, g.player.y);
      const sp = this.data.speed * (this.slowT > 0 ? 0.6 : 1);
      moveWithCollision(g.map, this, Math.cos(a) * sp * dt, Math.sin(a) * sp * dt);
    }
    if (d < this.r + g.player.r) g.damagePlayer(Math.round(this.data.contact * this.dm), this.name, { x: this.x, y: this.y });

    // pattern runner
    if (this.wait > 0) { this.wait -= dt; return; }
    if (!this.gen) {
      const list = phases[this.phase - 1].patterns;
      const name = list[this.patternIdx % list.length];
      this.patternIdx++;
      this.gen = PATTERNS[name](this);
    }
    const r = this.gen.next();
    if (r.done) { this.gen = null; this.wait = phases[this.phase - 1].rest; }
    else this.wait = r.value || 0;
  }

  render(ctx, g, time) {
    const blink = this.windupT > 0 && Math.floor(this.windupT * 14) % 2 === 0;
    const flash = this.flash > 0 || blink;
    const fr = Math.floor(this.anim / 0.35) % 2;
    const sz = this.r;
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.beginPath(); ctx.ellipse(this.x, this.y, sz * 1.3, sz * 0.5, 0, 0, Math.PI * 2); ctx.fill();
    const shakeX = this.state === 'dying' ? (Math.random() - 0.5) * 4 : 0;
    if (this.bossId === 'kragmor') {
      // body segments follow the head's trail
      const n = this.data.segments;
      for (let i = n; i >= 1; i--) {
        const p = this.trail[Math.min(this.trail.length - 1, i * 6)];
        ctx.fillStyle = 'rgba(0,0,0,0.3)';
        ctx.beginPath(); ctx.ellipse(p.x, p.y, 9, 4, 0, 0, Math.PI * 2); ctx.fill();
        drawSprite(ctx, 'kragseg', 0, p.x, p.y - 2 + Math.sin(time * 6 + i) * 1, { flash, scale: 1 - i * 0.05 });
      }
    }
    if (this.bossId === 'lumen') {
      // orbiting shards
      for (let i = 0; i < 5; i++) {
        const a = time * 1.5 + (i * Math.PI * 2) / 5;
        const ox = Math.cos(a) * 24, oy = Math.sin(a) * 10 - 20;
        ctx.fillStyle = i % 2 ? '#7ae0ff' : '#ff7ae6';
        ctx.fillRect(Math.round(this.x + ox) - 1, Math.round(this.y + oy) - 2, 3, 5);
      }
    }
    const lift = this.fly ? 8 + Math.sin(time * 2) * 3 : 0;
    drawSprite(ctx, this.data.sprite, this.windupT > 0 || this.phase > 1 ? (fr + 1) % 2 : fr, this.x + shakeX, this.y - lift, { flip: this.bossId !== 'lumen' && this.bossId !== 'glacius' && g.player.x < this.x, flash, scale: this.scale });
    if (this.isMini && this.hp < this.maxHp) {
      const w = 40, y = Math.round(this.y - this.h * 1.6 - lift - 8);
      ctx.fillStyle = '#120d1a'; ctx.fillRect(Math.round(this.x - w / 2) - 1, y - 1, w + 2, 5);
      ctx.fillStyle = this.data.color; ctx.fillRect(Math.round(this.x - w / 2), y, Math.round((w * this.hp) / this.maxHp), 3);
    }
    if (this.phase > 1 && Math.random() < 0.3) g.fx.particle(this.x + (Math.random() - 0.5) * sz * 2, this.cy, 0, -30, 0.5, this.data.color, 1);
    if (this.markT > 0) { ctx.strokeStyle = '#ff4f7a'; ctx.beginPath(); ctx.arc(this.x, this.cy, sz + 6, 0, Math.PI * 2); ctx.stroke(); }
  }
}

// Lumen's mirror clones: fragile copies that fire shard fans, then shatter after a while.
export class LumenClone {
  constructor(g, x, y, boss) {
    this.id = newEntityId();
    this.name = 'Prism Echo';
    this.x = x; this.y = y; this.r = 8; this.h = 18; this.fly = true;
    this.maxHp = this.hp = Math.round(260 * g.heroicMult.hp);
    this.def = 4; this.boss = boss; this.life = 9; this.fire = 1 + Math.random();
    this.flash = 0; this.kvx = this.kvy = 0; this.markT = 0; this.slowT = 0; this.rootT = 0; this.stunT = 0; this.burn = null;
    this.room = boss.room.id; this.dead = false; this.anim = 0; this.knockResist = 1; this.noDrop = true; this.xp = 10;
  }
  get cy() { return this.y - this.h / 2; }
  update(dt, g) {
    this.anim += dt; this.flash = Math.max(0, this.flash - dt); this.markT = Math.max(0, this.markT - dt);
    this.life -= dt;
    if (this.life <= 0 || this.boss.dead) { this.hp = 0; g.killEnemy(this, true); return; }
    this.fire -= dt;
    if (this.fire <= 0) {
      this.fire = 1.6;
      const a = angleTo(this.x, this.cy, g.player.x, g.player.y - 6);
      for (let i = -1; i <= 1; i++)
        g.projectiles.spawn({ x: this.x, y: this.cy, vx: Math.cos(a + i * 0.25) * 90, vy: Math.sin(a + i * 0.25) * 90, size: 3, dmg: Math.round(14 * this.boss.dm), friendly: false, life: 4, style: 'shard', owner: 'a Prism Echo' });
      g.audio.play('chime');
    }
  }
  render(ctx, g, time) {
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.beginPath(); ctx.ellipse(this.x, this.y, 8, 3, 0, 0, Math.PI * 2); ctx.fill();
    drawSprite(ctx, 'lumenClone', Math.floor(this.anim * 3) % 2, this.x, this.y - 6 + Math.sin(time * 3) * 2, { flash: this.flash > 0, alpha: 0.75 });
  }
}
