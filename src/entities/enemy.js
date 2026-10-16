// Generic data-driven enemy. Movement style + attack list come from content/enemies.js.
// States: idle -> move -> windup (telegraph) -> attack (dash/charge only) -> recover -> move
import { ARCHETYPES, ROSTERS, ELITE, MINIBOSS_EXTRA } from '../content/enemies.js';
import { moveWithCollision } from '../world/tilemap.js';
import { dist, angleTo } from '../util.js';
import { drawSprite, sprite } from '../render/sprites.js';
import { makeHazard } from './hazards.js';

let nextId = 1;
export const newEntityId = () => nextId++;

export class Enemy {
  constructor(g, kind, x, y, opts = {}) {
    const arch = ARCHETYPES[kind];
    const roster = ROSTERS[g.regionDef.id];
    const variant = roster[kind];
    this.id = newEntityId();
    this.kind = kind;
    this.arch = arch;
    this.elite = !!opts.elite;
    this.miniboss = !!opts.miniboss;
    this.name = (this.miniboss ? 'Warlord ' : this.elite ? 'Elite ' : '') + variant.name;
    this.twist = variant.twist;
    this.pal = roster.pal;
    this.sprite = `${arch.sprite}_${roster.pal}`;
    const tm = g.tierMult;
    const hpMul = tm.hp * (this.elite ? ELITE.hp : 1) * (this.miniboss ? 7 : 1);
    this.maxHp = this.hp = Math.round(arch.hp * hpMul);
    this.dmgMul = tm.dmg * (this.elite ? ELITE.dmg : 1) * (this.miniboss ? 1.25 : 1);
    this.def = Math.round(arch.def * (1 + g.regionDef.index * 0.6));
    this.speed = arch.speed * (this.elite ? ELITE.speed : 1);
    this.scale = this.miniboss ? 1.7 : this.elite ? ELITE.scale : 1;
    this.r = arch.r * this.scale;
    this.h = (sprite(this.sprite)?.h || 14) * this.scale * 0.8;
    this.fly = !!arch.fly;
    this.knockResist = this.miniboss ? 0.95 : arch.knockResist || 0;
    this.xp = Math.round(arch.xp * (this.elite ? ELITE.xp : 1) * (this.miniboss ? 10 : 1) * (1 + g.regionDef.index * 0.8));
    this.attacks = arch.attacks.map((a) => {
      const b = { ...a };
      if (this.twist === 'burst3' && b.type === 'shot') { b.type = 'burst'; b.count = 3; b.interval = 0.13; }
      if (this.elite || this.miniboss) {
        if (b.count) b.count += b.type === 'radial' ? 4 : b.type === 'summon' ? 1 : 2;
        if (b.type === 'shot') { b.type = 'fan'; b.count = 3; b.spread = 0.35; }
      }
      b.timer = b.cd * (0.35 + Math.random() * 0.65);
      return b;
    });
    if (this.miniboss) this.attacks.push({ ...MINIBOSS_EXTRA, timer: 2 });
    this.x = x; this.y = y;
    this.vx = 0; this.vy = 0; this.kvx = 0; this.kvy = 0;
    this.state = 'move';
    this.t = 0;
    this.cur = null;
    this.aggro = !!opts.aggro;
    this.room = opts.room ?? -1;
    this.flash = 0; this.slowT = 0; this.rootT = 0; this.stunT = 0; this.markT = 0; this.burn = null;
    this.anim = Math.random() * 2;
    this.flip = false;
    this.strafeDir = Math.random() < 0.5 ? 1 : -1;
    this.strafeT = 1 + Math.random() * 2;
    this.spinA = Math.random() * Math.PI * 2;
    this.burstQueue = [];
    this.minions = 0;
    this.parent = opts.parent || null;
    this.dead = false;
  }

  get cx() { return this.x; }
  get cy() { return this.y - this.h / 2; }

  update(dt, g) {
    const pl = g.player;
    this.anim += dt;
    this.flash = Math.max(0, this.flash - dt);
    this.slowT = Math.max(0, this.slowT - dt);
    this.rootT = Math.max(0, this.rootT - dt);
    this.stunT = Math.max(0, this.stunT - dt);
    this.markT = Math.max(0, this.markT - dt);
    if (this.burn) {
      this.burn.t -= dt; this.burn.tick = (this.burn.tick || 0) - dt;
      if (this.burn.tick <= 0) { this.burn.tick = 0.5; g.hitEnemy(this, this.burn.dps * 0.5, false, { knock: 0, quiet: true, burnTick: true }); }
      if (Math.random() < 0.3) g.fx.particle(this.x + (Math.random() - 0.5) * this.r * 2, this.cy, 0, -30, 0.35, '#ff9a3a');
      if (this.burn && this.burn.t <= 0) this.burn = null;
      if (this.dead) return;
    }

    // knockback always applies, even while stunned
    if (this.kvx || this.kvy) {
      moveWithCollision(g.map, this, this.kvx * dt, this.kvy * dt);
      const decay = Math.pow(0.001, dt);
      this.kvx *= decay; this.kvy *= decay;
      if (Math.abs(this.kvx) < 2 && Math.abs(this.kvy) < 2) this.kvx = this.kvy = 0;
    }

    const d = dist(this.x, this.y, pl.x, pl.y);
    if (!this.aggro && (d < 170 || this.hp < this.maxHp)) this.aggro = true;
    if (!this.aggro || pl.dead || this.stunT > 0) return;

    // queued burst shots
    for (let i = this.burstQueue.length - 1; i >= 0; i--) {
      const q = this.burstQueue[i];
      q.t -= dt;
      if (q.t <= 0) {
        this.shoot(g, angleTo(this.x, this.cy, pl.x, pl.y - 6), q.a);
        this.burstQueue.splice(i, 1);
      }
    }

    const slow = this.slowT > 0 ? 0.5 : 1;
    const speed = this.speed * slow * (this.rootT > 0 ? 0 : 1);

    if (this.state === 'move') {
      this.moveAI(dt, g, d, speed);
      for (const a of this.attacks) a.timer -= dt * slow;
      const ready = this.attacks.find((a) => a.timer <= 0 && d <= a.range);
      if (ready) this.beginWindup(ready, g);
    } else if (this.state === 'windup') {
      this.t -= dt;
      const a = this.cur;
      if ((a.type === 'charge' || a.type === 'dash') && this.t > 0.2) {
        this.aimA = angleTo(this.x, this.y, pl.x, pl.y);
        if (this.warnLine) this.warnLine.angle = this.aimA;
      }
      if (this.t <= 0) this.execute(a, g);
    } else if (this.state === 'attack') {
      this.t -= dt;
      const a = this.cur;
      const { hitX, hitY } = moveWithCollision(g.map, this, Math.cos(this.aimA) * a.speed * dt, Math.sin(this.aimA) * a.speed * dt);
      if (Math.random() < 0.6) g.fx.particle(this.x, this.y - 2, (Math.random() - 0.5) * 20, -10, 0.3, '#c9b9a0', 1);
      if (dist(this.x, this.y, pl.x, pl.y) < this.r + pl.r + 2) g.damagePlayer(Math.round(a.dmg * this.dmgMul), this.name, { x: this.x, y: this.y });
      if (this.t <= 0 || hitX || hitY) {
        if ((hitX || hitY) && a.type === 'charge') { g.shake(3); g.fx.burst(this.x, this.y, 10, ['#c9b9a0', '#8e889b'], 60, 0.3); this.stunT = 0.6; }
        this.state = 'recover';
        this.t = a.recover;
      }
    } else if (this.state === 'recover') {
      this.t -= dt;
      if (this.t <= 0) this.state = 'move';
    }

    // contact damage
    if (this.arch.contact && this.state !== 'attack' && d < this.r + pl.r + 1) {
      const hurt = g.damagePlayer(Math.round(this.arch.contact * this.dmgMul), this.name, { x: this.x, y: this.y });
      if (hurt && pl.stats.effects.has('thorns')) g.hitEnemy(this, 25, false, { knock: 140, quiet: false });
    }
    this.flip = pl.x < this.x;
  }

  moveAI(dt, g, d, speed) {
    const pl = g.player;
    const style = this.arch.move;
    let mx = 0, my = 0;
    const toA = angleTo(this.x, this.y, pl.x, pl.y);
    this.strafeT -= dt;
    if (this.strafeT <= 0) { this.strafeT = 1.2 + Math.random() * 2; if (Math.random() < 0.5) this.strafeDir *= -1; }
    if (style === 'chase') {
      if (d > this.r + pl.r + 2) { mx = Math.cos(toA); my = Math.sin(toA); }
    } else if (style === 'kite') {
      const pref = this.arch.pref || 100;
      let radial = 0;
      if (d > pref + 18) radial = 1;
      else if (d < pref - 18) radial = -1;
      const tang = radial === 0 ? 1 : 0.35;
      mx = Math.cos(toA) * radial + Math.cos(toA + Math.PI / 2) * this.strafeDir * tang;
      my = Math.sin(toA) * radial + Math.sin(toA + Math.PI / 2) * this.strafeDir * tang;
    } else if (style === 'flank') {
      const want = 58;
      const radial = (d - want) / 30;
      mx = Math.cos(toA) * radial + Math.cos(toA + Math.PI / 2) * this.strafeDir;
      my = Math.sin(toA) * radial + Math.sin(toA + Math.PI / 2) * this.strafeDir;
    }
    // separation from other enemies
    for (const o of g.enemies) {
      if (o === this || o.dead) continue;
      const dd = dist(this.x, this.y, o.x, o.y);
      if (dd > 0 && dd < this.r + o.r + 2) { mx += ((this.x - o.x) / dd) * 0.8; my += ((this.y - o.y) / dd) * 0.8; }
    }
    const len = Math.hypot(mx, my);
    if (len > 0.01) {
      mx /= Math.max(1, len); my /= Math.max(1, len);
      const { hitX, hitY } = moveWithCollision(g.map, this, mx * speed * dt, my * speed * dt);
      if (hitX || hitY) this.strafeDir *= -1;
    }
    this.moving = len > 0.01;
  }

  beginWindup(a, g) {
    const pl = g.player;
    this.state = 'windup';
    this.cur = a;
    this.t = a.windup;
    a.timer = a.cd * (0.85 + Math.random() * 0.3);
    this.aimA = angleTo(this.x, this.y, pl.x, pl.y);
    this.warnLine = null;
    if (a.type === 'charge' || a.type === 'dash') {
      this.warnLine = makeHazard('line', { x: this.x, y: this.y, angle: this.aimA, len: a.speed * a.time, life: a.windup, width: this.r, follow: this });
      g.hazards.push(this.warnLine);
    }
    if (a.type === 'slam') {
      g.hazards.push(makeHazard('telegraph', { x: this.x, y: this.y, r: a.radius * this.scale, warn: a.windup, dmg: Math.round(a.dmg * this.dmgMul), owner: this.name, style: 'slam', follow: this, shake: 3 }));
    }
    if (a.type === 'summon') g.audio.play('spawn');
  }

  execute(a, g) {
    const pl = g.player;
    const aim = angleTo(this.x, this.cy, pl.x, pl.y - 6);
    this.state = 'recover';
    this.t = a.recover;
    switch (a.type) {
      case 'shot': this.shoot(g, aim, a); break;
      case 'burst':
        for (let i = 0; i < a.count; i++) this.burstQueue.push({ t: i * a.interval, a });
        break;
      case 'fan':
        for (let i = 0; i < a.count; i++) this.shoot(g, aim + (i - (a.count - 1) / 2) * (a.spread / Math.max(1, a.count - 1)) * 2, a);
        break;
      case 'radial':
        this.spinA += a.spin || 0;
        for (let i = 0; i < a.count; i++) this.shoot(g, this.spinA + (i * Math.PI * 2) / a.count, a);
        break;
      case 'lob': {
        const lead = a.flight * 0.6;
        const tx = pl.x + pl.vx * lead, ty = pl.y + pl.vy * lead;
        g.hazards.push(makeHazard('telegraph', {
          x: tx, y: ty, r: a.radius * (this.elite ? 1.3 : 1), warn: a.flight, dmg: Math.round(a.dmg * this.dmgMul), owner: this.name,
          style: this.pal === 'cinder' ? 'magma' : 'lob', pool: this.pal === 'cinder' ? a.pool + 1 : this.pal === 'moss' ? 0 : a.pool * 0.6,
        }));
        g.projectiles.spawn({ x: this.x, y: this.cy, vx: (tx - this.x) / a.flight, vy: (ty - this.cy) / a.flight, life: a.flight, ghost: true, size: 3, style: this.pal === 'cinder' ? 'magma' : 'enemy', friendly: false, dmg: 0 }).noHit = true;
        break;
      }
      case 'dash':
      case 'charge':
        this.state = 'attack';
        this.t = a.time;
        g.audio.play('dodge');
        break;
      case 'slam':
        // damage handled by the telegraph that started during windup
        break;
      case 'summon': {
        const alive = g.enemies.filter((e) => e.parent === this && !e.dead).length;
        const n = Math.min(a.count, a.max - alive);
        for (let i = 0; i < n; i++) {
          const ang = Math.random() * Math.PI * 2;
          g.spawnEnemyDelayed(a.minion, this.x + Math.cos(ang) * 18, this.y + Math.sin(ang) * 14, { room: this.room, parent: this, aggro: true }, 0.5);
        }
        break;
      }
    }
  }

  shoot(g, angle, a) {
    if (a.dmg === 0) return;
    g.projectiles.spawn({
      x: this.x, y: this.cy, vx: Math.cos(angle) * a.speed, vy: Math.sin(angle) * a.speed,
      size: a.size || 3, dmg: Math.round(a.dmg * this.dmgMul), friendly: false, life: (a.range + 60) / a.speed,
      style: this.pal === 'moss' ? 'thorn' : this.pal === 'cinder' ? 'fire' : 'shard', owner: this.name,
    });
    g.audio.play('enemyShoot');
  }

  render(ctx, g, time) {
    const fr = Math.floor(this.anim / (this.fly ? 0.12 : 0.28)) % 2;
    // shadow
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.beginPath(); ctx.ellipse(this.x, this.y, this.r * 1.1, this.r * 0.45, 0, 0, Math.PI * 2); ctx.fill();
    const lift = this.fly ? 4 + Math.sin(this.anim * 6) * 1.5 : 0;
    const windBlink = this.state === 'windup' && Math.floor(this.t * 14) % 2 === 0;
    if (this.elite || this.miniboss) {
      ctx.globalAlpha = 0.55 + 0.3 * Math.sin(time * 6);
      const tint = this.miniboss ? '#ff4f7a' : '#ffd36b';
      for (const [ox, oy] of [[-1, 0], [1, 0], [0, -1], [0, 1]])
        drawSprite(ctx, this.sprite, fr, this.x + ox, this.y - lift + oy, { flip: this.flip, tint, scale: this.scale });
      ctx.globalAlpha = 1;
    }
    drawSprite(ctx, this.sprite, fr, this.x, this.y - lift, { flip: this.flip, flash: this.flash > 0 || windBlink, scale: this.scale });
    if (this.markT > 0) {
      ctx.strokeStyle = '#ff4f7a'; ctx.lineWidth = 1;
      const y = this.cy - lift, rr = this.r + 3;
      ctx.beginPath(); ctx.arc(this.x, y, rr, 0, Math.PI * 2); ctx.stroke();
      ctx.fillStyle = '#ff4f7a'; ctx.fillRect(this.x - 1, y - rr - 2, 2, 3); ctx.fillRect(this.x - 1, y + rr, 2, 3);
    }
    if (this.slowT > 0) { ctx.fillStyle = '#9fe6ff'; ctx.fillRect(this.x - 4, this.y - 1, 2, 1); ctx.fillRect(this.x + 3, this.y - 2, 1, 1); }
    if (this.rootT > 0) { ctx.strokeStyle = '#5fd068'; ctx.beginPath(); ctx.moveTo(this.x - 5, this.y); ctx.lineTo(this.x - 2, this.y - 6); ctx.moveTo(this.x + 5, this.y); ctx.lineTo(this.x + 2, this.y - 6); ctx.stroke(); }
    if (this.stunT > 0) { const a = time * 8; ctx.fillStyle = '#ffd36b'; ctx.fillRect(this.x + Math.cos(a) * 6, this.y - this.h - 4 + Math.sin(a) * 2, 2, 2); ctx.fillRect(this.x + Math.cos(a + 3) * 6, this.y - this.h - 4 + Math.sin(a + 3) * 2, 2, 2); }
    if (this.hp < this.maxHp) {
      const w = Math.max(14, this.r * 2.4), y = Math.round(this.y - this.h - lift - 5);
      ctx.fillStyle = '#120d1a'; ctx.fillRect(Math.round(this.x - w / 2) - 1, y - 1, w + 2, 4);
      ctx.fillStyle = '#5a1020'; ctx.fillRect(Math.round(this.x - w / 2), y, w, 2);
      ctx.fillStyle = this.elite || this.miniboss ? '#ffa630' : '#ff4f5e';
      ctx.fillRect(Math.round(this.x - w / 2), y, Math.max(0, Math.round((w * this.hp) / this.maxHp)), 2);
    }
  }
}

// Training dummy in the hub: never dies, reports damage per second.
export class Dummy {
  constructor(x, y) {
    this.id = newEntityId();
    this.x = x; this.y = y; this.r = 6; this.h = 16; this.hp = this.maxHp = 1e9; this.def = 0;
    this.isDummy = true; this.flash = 0; this.name = 'Training Dummy'; this.log = []; this.wobble = 0;
    this.kvx = this.kvy = 0;
  }
  update(dt, g) {
    this.flash = Math.max(0, this.flash - dt);
    this.wobble *= Math.pow(0.02, dt);
    this.hp = this.maxHp;
    const now = g.time;
    while (this.log.length && now - this.log[0][0] > 3) this.log.shift();
    this.kvx = this.kvy = 0;
  }
  record(g, dmg) {
    this.log.push([g.time, dmg]);
    this.wobble = 1;
  }
  dps() {
    if (this.log.length < 2) return 0;
    const span = Math.max(1, this.log[this.log.length - 1][0] - this.log[0][0]);
    return Math.round(this.log.reduce((s, l) => s + l[1], 0) / span);
  }
  render(ctx, g, time) {
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.beginPath(); ctx.ellipse(this.x, this.y, 7, 3, 0, 0, Math.PI * 2); ctx.fill();
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(Math.sin(time * 25) * 0.15 * this.wobble);
    drawSprite(ctx, 'dummy', 0, 0, 0, { flash: this.flash > 0 });
    ctx.restore();
    const d = this.dps();
    if (d > 0) g.drawLabel(ctx, `${d} DPS`, this.x, this.y - 26, '#ffd36b');
  }
}
