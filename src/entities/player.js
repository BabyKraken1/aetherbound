// The player character: movement, dodge, weapon fire, abilities, status effects and rendering.
import { T, ABILITY3_LEVEL } from '../config.js';
import { CLASSES } from '../content/classes.js';
import { moveWithCollision, collides } from '../world/tilemap.js';
import { dist, angleTo } from '../util.js';
import { drawSprite, weaponSprite } from '../render/sprites.js';
import { makeHazard } from './hazards.js';
import { fireWeapon } from '../systems/combat.js';
import { ABILITIES } from '../systems/abilities.js';

const DODGE_TIME = 0.22, DODGE_IFRAMES = 0.18, DODGE_SPEED = 235, DODGE_CD = 0.8;
const HURT_IFRAMES = 0.55;

export class Player {
  constructor(cls, x, y) {
    this.cls = cls;
    this.def = CLASSES[cls];
    this.x = x; this.y = y; this.r = 5; this.h = 16;
    this.vx = 0; this.vy = 0;
    this.aim = 0; this.flip = false;
    this.stats = null;
    this.hp = 1; this.mp = 1;
    this.barrier = null;
    this.iframes = 0;
    this.dodgeT = 0; this.dodgeCd = 0; this.dodgeDir = [1, 0];
    this.atkCd = 0;
    this.cds = [0, 0, 0];
    this.buffs = [];
    this.anim = 0; this.moving = false;
    this.swingT = 0; this.swingA = 0;
    this.wardOrbs = []; this.wardT = 0; this.wardHits = new Map();
    this.whirlT = 0; this.whirlTick = 0;
    this.leap = null;
    this.rapidT = 0;
    this.hitCount = 0;
    this.hazardTick = 0;
    this.potionCd = 0;
    this.trailT = 0;
    this.dead = false;
    this.lastHitBy = '';
    this.lifebloomCd = 0;
  }

  isInvulnerable() {
    return this.iframes > 0 || (this.dodgeT > DODGE_TIME - DODGE_IFRAMES) || !!this.leap;
  }

  update(dt, g) {
    if (this.dead) return;
    const input = g.input, s = this.stats;
    this.anim += dt;
    this.iframes = Math.max(0, this.iframes - dt);
    this.dodgeCd = Math.max(0, this.dodgeCd - dt);
    this.atkCd = Math.max(0, this.atkCd - dt);
    this.swingT = Math.max(0, this.swingT - dt);
    this.potionCd = Math.max(0, this.potionCd - dt);
    this.lifebloomCd = Math.max(0, this.lifebloomCd - dt);
    this.rapidT = Math.max(0, this.rapidT - dt);
    for (let i = 0; i < 3; i++) this.cds[i] = Math.max(0, this.cds[i] - dt);

    // buffs
    let changed = false;
    for (let i = this.buffs.length - 1; i >= 0; i--) {
      this.buffs[i].t -= dt;
      if (this.buffs[i].t <= 0) { this.buffs.splice(i, 1); changed = true; }
    }
    if (changed) g.refreshStats();
    if (this.barrier) { this.barrier.t -= dt; if (this.barrier.t <= 0 || this.barrier.amt <= 0) this.barrier = null; }

    // regeneration
    this.hp = Math.min(s.maxHp, this.hp + s.hpRegen * dt);
    this.mp = Math.min(s.maxMp, this.mp + s.mpRegen * dt);

    // aim
    const m = g.mouseWorld();
    this.aim = angleTo(this.x, this.y - 7, m.x, m.y);
    this.flip = Math.cos(this.aim) < 0;

    // leaping (Vanguard)
    if (this.leap) {
      const L = this.leap;
      L.t += dt;
      const k = Math.min(1, L.t / L.dur);
      this.x = L.sx + (L.tx - L.sx) * k;
      this.y = L.sy + (L.ty - L.sy) * k;
      this.lift = Math.sin(k * Math.PI) * 18;
      if (k >= 1) { this.leap = null; this.lift = 0; L.onLand(g); }
      return;
    }

    // movement
    const busy = g.inputBlocked();
    let ix = 0, iy = 0;
    if (!busy) {
      if (input.isDown('KeyW', 'ArrowUp')) iy -= 1;
      if (input.isDown('KeyS', 'ArrowDown')) iy += 1;
      if (input.isDown('KeyA', 'ArrowLeft')) ix -= 1;
      if (input.isDown('KeyD', 'ArrowRight')) ix += 1;
    }
    const len = Math.hypot(ix, iy);
    if (len) { ix /= len; iy /= len; }
    this.moving = len > 0;

    if (!busy && input.wasPressed('Space', 'ShiftLeft', 'ShiftRight') && this.dodgeCd <= 0) this.startDodge(g, len ? [ix, iy] : [Math.cos(this.aim), Math.sin(this.aim)]);

    if (this.dodgeT > 0) {
      this.dodgeT -= dt;
      this.vx = this.dodgeDir[0] * DODGE_SPEED;
      this.vy = this.dodgeDir[1] * DODGE_SPEED;
      this.trailT -= dt;
      if (this.trailT <= 0) {
        this.trailT = 0.04;
        g.fx.ghost(this.x, this.y, this.spriteName || 'hero_' + this.cls, 2, this.flip, 0.2);
        if (s.effects.has('emberTrail')) g.hazards.push(makeHazard('pool', { x: this.x, y: this.y, r: 9, life: 2.5, dps: 18 + s.ap, friendly: true }));
      }
    } else {
      const speed = s.speed * (this.whirlT > 0 ? 0.75 : 1);
      const accel = Math.min(1, dt * 16);
      this.vx += (ix * speed - this.vx) * accel;
      this.vy += (iy * speed - this.vy) * accel;
    }
    moveWithCollision(g.map, this, this.vx * dt, this.vy * dt);

    // hazard floor
    const tile = g.map.tileAt(this.x, this.y);
    this.hazardTick -= dt;
    if (tile === T.HAZARD && this.dodgeT <= 0 && this.hazardTick <= 0) {
      this.hazardTick = 0.5;
      g.damagePlayer(Math.round(4 * g.tierMult.dmg), g.hazardName(), { dot: true });
    }

    // attacking
    if (!busy && input.mouse.left && this.atkCd <= 0 && this.whirlT <= 0) {
      const w = s.weapon;
      const rate = w.rate * (1 + s.rate) * (this.rapidT > 0 ? 1.6 : 1);
      this.atkCd = 1 / rate;
      fireWeapon(g, this);
    }

    // abilities
    if (!busy) {
      if (input.wasPressed('KeyQ') || input.mouse.right) this.tryAbility(g, 0, input.wasPressed('KeyQ') || input.mouse.rightPressed);
      if (input.wasPressed('KeyE')) this.tryAbility(g, 1, true);
      if (input.wasPressed('KeyR')) this.tryAbility(g, 2, true);
      if (input.wasPressed('Digit1')) g.usePotion('hp_potion');
      if (input.wasPressed('Digit2')) g.usePotion('mp_potion');
    }

    // whirlwind
    if (this.whirlT > 0) {
      this.whirlT -= dt;
      this.whirlTick -= dt;
      this.swingA += dt * 22;
      if (this.whirlTick <= 0) {
        this.whirlTick = 0.15;
        for (const e of g.enemies) if (!e.dead && !e.spawning && dist(this.x, this.y - 6, e.x, e.cy ?? e.y) < 34 + e.r) g.hitEnemy(e, this.whirlDmg, false, { knock: 70, fromX: this.x, fromY: this.y, ability: true });
        g.fx.arc(this.x, this.y - 6, this.swingA, 30, 2.4, 0.15, '#e8eef8');
        g.audio.play('swing');
      }
    }

    // ward orbs
    if (this.wardT > 0) {
      this.wardT -= dt;
      const n = this.wardOrbs.length;
      this.wardOrbs.forEach((o, i) => {
        const a = this.anim * 3.2 + (i * Math.PI * 2) / n;
        o.x = this.x + Math.cos(a) * 22; o.y = this.y - 6 + Math.sin(a) * 16;
      });
      for (const e of g.enemies) {
        if (e.dead || e.spawning) continue;
        for (const o of this.wardOrbs) {
          if (dist(o.x, o.y, e.x, e.cy ?? e.y) < e.r + 4 && g.time - (this.wardHits.get(e.id) || -9) > 0.35) {
            this.wardHits.set(e.id, g.time);
            g.hitEnemy(e, this.wardDmg, false, { knock: 60, fromX: this.x, fromY: this.y, ability: true });
          }
        }
      }
      if (this.wardT <= 0) this.wardOrbs = [];
    }
  }

  startDodge(g, dir) {
    this.dodgeDir = dir;
    this.dodgeT = DODGE_TIME;
    this.dodgeCd = DODGE_CD;
    g.audio.play('dodge');
    g.fx.burst(this.x, this.y, 6, ['#c9b9a0', '#8e889b'], 40, 0.3);
    g.onAction('dodge');
  }

  tryAbility(g, i, announce) {
    const ab = this.def.abilities[i];
    const cs = g.classState();
    if (i === 2 && cs.level < ABILITY3_LEVEL) { if (announce) { g.toast(`${ab.name} unlocks at level ${ABILITY3_LEVEL}`, '#ffa630'); g.audio.play('deny'); } return; }
    if (this.cds[i] > 0) return;
    if (this.mp < ab.mp) { if (announce) { g.toast('Not enough mana', '#4f8bff'); g.audio.play('deny'); } return; }
    this.mp -= ab.mp;
    this.cds[i] = ab.cd * (1 - this.stats.cdr);
    ABILITIES[ab.id](g, this, this.stats, this.stats.mods[ab.id] || {});
    if (this.stats.effects.has('aegis')) this.addBarrier(25, 4);
    g.onAction('ability');
  }

  addBarrier(amt, t) {
    if (this.barrier) { this.barrier.amt += amt; this.barrier.max = Math.max(this.barrier.max, this.barrier.amt); this.barrier.t = Math.max(this.barrier.t, t); }
    else this.barrier = { amt, max: amt, t };
  }

  render(ctx, g, time) {
    if (this.dead) return;
    const lift = this.lift || 0;
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.beginPath(); ctx.ellipse(this.x, this.y, 6 - lift / 8, 2.5 - lift / 20, 0, 0, Math.PI * 2); ctx.fill();
    let frame = this.moving ? 2 + (Math.floor(this.anim / 0.13) % 2) : Math.floor(this.anim / 0.5) % 2;
    if (this.dodgeT > 0) frame = 2;
    const blink = this.iframes > 0 && Math.floor(this.iframes * 20) % 2 === 0;
    const y = this.y - lift;
    const w = this.stats.weapon;
    const wsp = weaponSprite(this.cls, w.style);
    const behind = Math.sin(this.aim) < -0.3;
    if (behind) this.drawWeapon(ctx, wsp, y);
    drawSprite(ctx, this.spriteName || 'hero_' + this.cls, frame, this.x, y, { flip: this.flip, flash: blink, alpha: this.dodgeT > 0 ? 0.75 : 1 });
    if (!behind) this.drawWeapon(ctx, wsp, y);
    if (this.barrier) {
      const k = this.barrier.amt / this.barrier.max;
      ctx.globalAlpha = 0.25 + 0.25 * k;
      ctx.strokeStyle = '#ffd36b'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.ellipse(this.x, y - 8, 11, 13, 0, 0, Math.PI * 2); ctx.stroke();
      ctx.fillStyle = '#ffd36b'; ctx.globalAlpha = 0.1 + 0.1 * Math.sin(time * 8);
      ctx.fill();
      ctx.globalAlpha = 1;
    }
    for (const o of this.wardOrbs) {
      ctx.fillStyle = '#c48bff'; ctx.beginPath(); ctx.arc(o.x, o.y, 3.5, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#ffffff'; ctx.fillRect(Math.round(o.x) - 1, Math.round(o.y) - 1, 2, 2);
    }
  }

  drawWeapon(ctx, wsp, y) {
    let a = this.aim;
    if (this.cls === 'vanguard') {
      if (this.whirlT > 0) a = this.swingA;
      else if (this.swingT > 0) a = this.swingA + (1 - this.swingT / 0.15) * 1.6 - 0.8;
      else a = this.aim + (this.flip ? -0.6 : 0.6);
    }
    ctx.save();
    ctx.translate(Math.round(this.x + Math.cos(a) * 3), Math.round(y - 8 + Math.sin(a) * 2));
    ctx.rotate(a);
    if (Math.cos(a) < 0 && this.cls !== 'vanguard') ctx.scale(1, -1);
    ctx.drawImage(wsp, this.cls === 'ranger' ? 2 : 0, -Math.floor(wsp.height / 2));
    ctx.restore();
  }
}

// Attempt to find a landing point along a line without passing through walls.
export function traceLanding(map, x, y, angle, maxDist, r) {
  let lx = x, ly = y;
  for (let d = 4; d <= maxDist; d += 4) {
    const nx = x + Math.cos(angle) * d, ny = y + Math.sin(angle) * d;
    if (collides(map, nx, ny, r)) break;
    lx = nx; ly = ny;
  }
  return { x: lx, y: ly };
}
