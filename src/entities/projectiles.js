// Pooled projectiles for both the player (friendly) and enemies.
import { T } from '../config.js';
import { dist } from '../util.js';

const STYLE = {
  arcane: ['#7a9cff', '#e6ecff'], nature: ['#8fe06a', '#efffd0'], fire: ['#ff7a3a', '#ffe08a'], crystal: ['#7ae0ff', '#ffffff'],
  arrow: ['#d9c6a0', '#ffffff'], firearrow: ['#ff9a4a', '#ffe08a'], crystalarrow: ['#7ae0ff', '#ffffff'], spirit: ['#c48bff', '#f2e6ff'],
  ice: ['#9fd8ff', '#ffffff'], icearrow: ['#9fd8ff', '#ffffff'],
  steel: ['#e8eef8', '#ffffff'], gold: ['#ffd36b', '#ffffff'], moss: ['#8fe06a', '#efffd0'], orb: ['#b46cff', '#ffffff'],
  // hostile
  enemy: ['#ff4f7a', '#ffe0ea'], thorn: ['#b6ff6a', '#f4ffe0'], magma: ['#ff6a1a', '#ffe08a'], shard: ['#ff7ae6', '#ffffff'],
};
const ARROWS = new Set(['arrow', 'firearrow', 'crystalarrow', 'icearrow']);

export class Projectiles {
  constructor() { this.list = []; this.pool = []; }
  clear() { for (const p of this.list) this.pool.push(p); this.list.length = 0; }
  // Marks enemy shots dead; they are recycled on the next update (safe to call mid-update).
  clearHostile() {
    for (const p of this.list) if (!p.friendly) { p.dead = true; p.life = 0; }
  }

  spawn(o) {
    const p = this.pool.pop() || { hit: new Set(), ticks: new Map() };
    const hit = p.hit, ticks = p.ticks;
    for (const k in p) delete p[k];
    hit.clear(); ticks.clear();
    Object.assign(p, {
      x: 0, y: 0, vx: 0, vy: 0, size: 3, dmg: 10, crit: false, friendly: false, life: 1, pierce: 0, homing: 0,
      style: 'enemy', split: false, effects: null, owner: '', age: 0, tick: 0, slow: 0, dead: false, knock: 60,
    }, o);
    p.hit = hit; p.ticks = ticks;
    this.list.push(p);
    return p;
  }

  update(dt, g) {
    const pl = g.player;
    for (let i = this.list.length - 1; i >= 0; i--) {
      const p = this.list[i];
      p.age += dt;
      p.life -= dt;
      if (p.homing && p.friendly) homeIn(p, g, dt);
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      if (p.trail && Math.random() < 0.5) g.fx.particle(p.x, p.y, 0, 0, 0.25, STYLE[p.style]?.[0] || '#fff', 1);

      if (!p.ghost && g.map.isShotSolidAt(p.x, p.y)) {
        if (p.friendly) {
          const tx = Math.floor(p.x / 16), ty = Math.floor(p.y / 16);
          if (g.map.get(tx, ty) === T.CRACK) g.hitCrack(tx, ty, p.dmg);
        }
        g.fx.burst(p.x - p.vx * dt, p.y - p.vy * dt, 4, STYLE[p.style] || ['#fff'], 40, 0.2);
        p.dead = true;
      } else if (p.friendly) {
        for (const e of g.enemies) {
          if (e.dead || e.invuln || e.spawning) continue;
          if (dist(p.x, p.y, e.x, e.y - e.h / 2) > p.size + e.r + 1) continue;
          if (p.tick) {
            const last = p.ticks.get(e.id) ?? -99;
            if (p.age - last < p.tick) continue;
            p.ticks.set(e.id, p.age);
          } else {
            if (p.hit.has(e.id)) continue;
            p.hit.add(e.id);
          }
          g.hitEnemy(e, p.dmg, p.crit, { vx: p.vx, vy: p.vy, effects: p.effects, knock: p.knock, slow: p.slow, ability: p.ability });
          if (!p.tick) {
            if (p.split) splitShards(p, g, e);
            if (p.pierce-- <= 0) { p.dead = true; break; }
          }
        }
      } else if (!pl.dead && !p.ghost) {
        // ward orbs block shots
        if (pl.wardOrbs.length) {
          for (const o of pl.wardOrbs) if (dist(p.x, p.y, o.x, o.y) < p.size + 4) { p.dead = true; g.fx.burst(p.x, p.y, 5, ['#c48bff', '#ffffff'], 50, 0.2); break; }
        }
        if (!p.dead && dist(p.x, p.y, pl.x, pl.y - 6) < p.size + pl.r) {
          if (g.damagePlayer(p.dmg, p.owner, { x: p.x, y: p.y })) p.dead = true;
          else if (!pl.isInvulnerable()) p.dead = true;
        }
      }
      if (p.life <= 0) p.dead = true;
      if (p.dead) { this.list[i] = this.list[this.list.length - 1]; this.list.pop(); this.pool.push(p); }
    }
  }

  render(ctx, t) {
    for (const p of this.list) {
      const [c1, c2] = STYLE[p.style] || STYLE.enemy;
      const x = Math.round(p.x), y = Math.round(p.y);
      if (ARROWS.has(p.style)) {
        const sp = Math.hypot(p.vx, p.vy) || 1, dx = p.vx / sp, dy = p.vy / sp;
        ctx.strokeStyle = c1; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(x - dx * 7, y - dy * 7); ctx.lineTo(x, y); ctx.stroke();
        ctx.fillStyle = c2; ctx.fillRect(x - 1, y - 1, 2, 2);
        continue;
      }
      if (p.style === 'steel' || p.style === 'gold') {
        const a = Math.atan2(p.vy, p.vx);
        ctx.strokeStyle = c1; ctx.lineWidth = 2; ctx.globalAlpha = Math.min(1, p.life * 4);
        ctx.beginPath(); ctx.arc(x - Math.cos(a) * 6, y - Math.sin(a) * 6, 9, a - 1, a + 1); ctx.stroke();
        ctx.globalAlpha = 1;
        continue;
      }
      const s = p.size;
      if (!p.friendly) {
        // hostile shots: dark rim + pulsing bright body so they read against any floor
        const pulse = (Math.sin(t * 20 + p.age * 10) + 1) * 0.5;
        ctx.fillStyle = '#1a0612';
        ctx.beginPath(); ctx.arc(x, y, s + 1.5, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = c1;
        ctx.beginPath(); ctx.arc(x, y, s + pulse * 0.6, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = c2;
        ctx.fillRect(x - 1, y - 1, 2, 2);
      } else {
        ctx.globalAlpha = 0.45;
        ctx.fillStyle = c1;
        ctx.beginPath(); ctx.arc(x, y, s + 1.5, 0, Math.PI * 2); ctx.fill();
        ctx.globalAlpha = 1;
        ctx.beginPath(); ctx.arc(x, y, s, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = c2;
        ctx.fillRect(x - 1, y - 1, 2, 2);
      }
    }
  }
}

function homeIn(p, g, dt) {
  let best = null, bd = 120;
  for (const e of g.enemies) {
    if (e.dead || e.spawning || p.hit.has(e.id)) continue;
    const d = dist(p.x, p.y, e.x, e.y);
    if (d < bd) { bd = d; best = e; }
  }
  if (!best) return;
  const sp = Math.hypot(p.vx, p.vy);
  const want = Math.atan2(best.y - best.h / 2 - p.y, best.x - p.x);
  let cur = Math.atan2(p.vy, p.vx);
  let d = want - cur;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  cur += Math.max(-p.homing * dt, Math.min(p.homing * dt, d));
  p.vx = Math.cos(cur) * sp;
  p.vy = Math.sin(cur) * sp;
}

function splitShards(p, g, e) {
  const base = Math.atan2(p.vy, p.vx);
  for (const off of [-0.6, 0, 0.6]) {
    const a = base + off;
    const s = g.projectiles.spawn({
      x: p.x, y: p.y, vx: Math.cos(a) * 180, vy: Math.sin(a) * 180, size: 2, dmg: Math.round(p.dmg * 0.35), crit: false,
      friendly: true, life: 0.35, style: p.style, effects: null,
    });
    s.hit.add(e.id);
  }
}

export { STYLE as PROJECTILE_STYLE };
