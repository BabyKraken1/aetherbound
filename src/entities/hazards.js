// Ground effects: attack telegraphs, damaging pools, laser beams, warning lines, traps, heal fields.
// Every telegraph shows where damage will land before it happens.
import { dist, distToSegment } from '../util.js';

let nextId = 1;

export function makeHazard(type, o) { return { id: nextId++, type, t: 0, dead: false, ...o }; }

const STYLE_COL = {
  root: ['#ff4f7a', '#8a5a32', '#6dbb4f'], magma: ['#ff6a1a', '#ffd36b', '#3b1616'], prism: ['#ff7ae6', '#7ae0ff', '#ffffff'],
  slam: ['#ff4f7a', '#c9d1e0', '#8e889b'], lob: ['#ff4f7a', '#ffd36b', '#ffffff'], leap: ['#ffd36b', '#ffffff', '#c9d1e0'],
};

export function updateHazard(h, dt, g) {
  h.t += dt;
  const pl = g.player;
  switch (h.type) {
    case 'telegraph': {
      if (h.follow && !h.follow.dead) { h.x = h.follow.x; h.y = h.follow.y; }
      if (h.t >= h.warn) {
        const cols = STYLE_COL[h.style] || STYLE_COL.slam;
        if (h.friendly) {
          for (const e of g.enemies) if (!e.dead && !e.spawning && dist(h.x, h.y, e.x, e.y) < h.r + e.r) g.hitEnemy(e, h.dmg, false, { knock: 120, fromX: h.x, fromY: h.y, stun: h.stun });
        } else if (!pl.dead && dist(h.x, h.y, pl.x, pl.y - 4) < h.r + pl.r * 0.5) {
          g.damagePlayer(h.dmg, h.owner || 'a blast', { x: h.x, y: h.y });
        }
        g.fx.burst(h.x, h.y, 16, cols, h.r * 3, 0.45, 2);
        g.fx.ring(h.x, h.y, h.r * 0.4, h.r * 1.1, 0.25, cols[0], 2);
        if (h.style === 'root') for (let i = 0; i < 6; i++) g.fx.particle(h.x + (Math.random() - 0.5) * h.r, h.y, 0, -40 - Math.random() * 40, 0.4, '#8a5a32', 2, 120);
        if (h.pool) g.hazards.push(makeHazard('pool', { x: h.x, y: h.y, r: h.r * 0.9, life: h.pool, dps: h.dmg * 0.35, owner: h.owner, style: h.style }));
        if (h.sound !== false) g.audio.play(h.style === 'magma' ? 'boom' : 'slam');
        if (h.shake) g.shake(h.shake);
        h.dead = true;
      }
      break;
    }
    case 'pool': {
      if (h.t >= h.life) { h.dead = true; break; }
      h.tick = (h.tick || 0) - dt;
      if (h.tick <= 0) {
        h.tick = 0.4;
        if (h.friendly) {
          for (const e of g.enemies) if (!e.dead && !e.spawning && dist(h.x, h.y, e.x, e.y) < h.r + e.r) g.hitEnemy(e, Math.round(h.dps * 0.4), false, { knock: 0, quiet: true });
        } else if (!pl.dead && dist(h.x, h.y, pl.x, pl.y - 3) < h.r) {
          g.damagePlayer(Math.round(h.dps * 0.4), h.owner || 'flames', { dot: true });
        }
      }
      if (Math.random() < 0.25) g.fx.particle(h.x + (Math.random() - 0.5) * h.r * 1.5, h.y + (Math.random() - 0.5) * h.r, 0, -20, 0.5, h.friendly ? '#ffb02e' : '#ff7a1a', 1);
      break;
    }
    case 'beam': {
      const o = h.origin;
      if (o.dead) { h.dead = true; break; }
      h.x = o.x; h.y = o.y - (o.h || 0) / 2;
      if (h.t > h.warn) h.angle += h.spin * dt;
      if (h.t > h.warn + h.active) { h.dead = true; break; }
      if (h.t > h.warn && !pl.dead) {
        const x2 = h.x + Math.cos(h.angle) * h.len, y2 = h.y + Math.sin(h.angle) * h.len;
        if (distToSegment(pl.x, pl.y - 6, h.x, h.y, x2, y2) < 5 + pl.r * 0.6) g.damagePlayer(h.dmg, h.owner, { x: pl.x, y: pl.y });
      }
      break;
    }
    case 'line':
      if (h.follow && !h.follow.dead) { h.x = h.follow.x; h.y = h.follow.y; }
      if (h.t >= h.life) h.dead = true;
      break;
    case 'trap': {
      if (h.t >= h.life) { h.dead = true; break; }
      for (const e of g.enemies) {
        if (e.dead || e.spawning || e.fly) continue;
        if (dist(h.x, h.y, e.x, e.y) < 9 + e.r) {
          g.hitEnemy(e, h.dmg, false, { knock: 0, root: 2.2 });
          g.fx.burst(h.x, h.y, 14, ['#c9a35a', '#5fd068', '#ffffff'], 70, 0.4);
          g.audio.play('slam');
          h.dead = true;
          break;
        }
      }
      break;
    }
    case 'field': {
      if (h.t >= h.life) { h.dead = true; break; }
      h.tick = (h.tick || 0) - dt;
      if (h.tick <= 0) {
        h.tick = 0.5;
        if (!pl.dead && dist(h.x, h.y, pl.x, pl.y) < h.r) g.healPlayer(Math.round(pl.stats.maxHp * h.heal * 0.5), true);
      }
      if (Math.random() < 0.4) g.fx.particle(h.x + (Math.random() - 0.5) * h.r * 1.6, h.y + (Math.random() - 0.5) * h.r, 0, -25, 0.8, '#7ae0ff', 1);
      break;
    }
    case 'spawn': {
      if (h.t >= h.warn) { h.dead = true; h.onDone(g); }
      break;
    }
  }
}

export function renderHazardBelow(ctx, h, time) {
  switch (h.type) {
    case 'telegraph': {
      const k = Math.min(1, h.t / h.warn);
      const cols = STYLE_COL[h.style] || STYLE_COL.slam;
      ctx.globalAlpha = 0.22 + 0.2 * k;
      ctx.fillStyle = h.friendly ? '#ffd36b' : cols[0];
      ctx.beginPath(); ctx.ellipse(h.x, h.y, h.r * k, h.r * k * 0.75, 0, 0, Math.PI * 2); ctx.fill();
      ctx.globalAlpha = 0.85;
      ctx.strokeStyle = h.friendly ? '#ffd36b' : cols[0]; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.ellipse(h.x, h.y, h.r, h.r * 0.75, 0, 0, Math.PI * 2); ctx.stroke();
      ctx.globalAlpha = 1;
      break;
    }
    case 'pool': {
      const fade = Math.min(1, (h.life - h.t) * 2, h.t * 4);
      ctx.globalAlpha = 0.65 * fade;
      ctx.fillStyle = h.friendly ? '#ff9a2a' : h.style === 'root' ? '#7a3b5a' : '#ff5a10';
      ctx.beginPath(); ctx.ellipse(h.x, h.y, h.r, h.r * 0.7, 0, 0, Math.PI * 2); ctx.fill();
      ctx.globalAlpha = 0.8 * fade;
      ctx.fillStyle = '#ffd36b';
      const w = Math.sin(time * 6 + h.id) * 2;
      ctx.beginPath(); ctx.ellipse(h.x + w, h.y, h.r * 0.45, h.r * 0.28, 0, 0, Math.PI * 2); ctx.fill();
      ctx.globalAlpha = 1;
      break;
    }
    case 'line': {
      const k = h.t / h.life;
      ctx.globalAlpha = 0.25 + 0.5 * k;
      ctx.strokeStyle = '#ff4f7a'; ctx.lineWidth = 2 + h.width * k;
      ctx.beginPath(); ctx.moveTo(h.x, h.y); ctx.lineTo(h.x + Math.cos(h.angle) * h.len, h.y + Math.sin(h.angle) * h.len); ctx.stroke();
      ctx.globalAlpha = 1;
      break;
    }
    case 'trap': {
      ctx.fillStyle = '#5c4632'; ctx.fillRect(h.x - 5, h.y - 2, 10, 4);
      ctx.fillStyle = '#c9d1e0';
      for (let i = -4; i <= 4; i += 2) ctx.fillRect(h.x + i, h.y - 3 - (i % 4 === 0 ? 1 : 0), 1, 2);
      break;
    }
    case 'field': {
      const fade = Math.min(1, (h.life - h.t) * 2, h.t * 3);
      ctx.globalAlpha = 0.25 * fade;
      ctx.fillStyle = '#7ae0ff';
      ctx.beginPath(); ctx.ellipse(h.x, h.y, h.r, h.r * 0.7, 0, 0, Math.PI * 2); ctx.fill();
      ctx.globalAlpha = 0.7 * fade;
      ctx.strokeStyle = '#effbff'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.ellipse(h.x, h.y, h.r * (0.8 + 0.2 * Math.sin(time * 4)), h.r * 0.7 * (0.8 + 0.2 * Math.sin(time * 4)), 0, 0, Math.PI * 2); ctx.stroke();
      ctx.globalAlpha = 1;
      break;
    }
    case 'spawn': {
      const k = h.t / h.warn;
      ctx.globalAlpha = 0.6;
      ctx.strokeStyle = h.color || '#ff4f7a'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.ellipse(h.x, h.y, 10 * (1 - k) + 3, (10 * (1 - k) + 3) * 0.7, 0, 0, Math.PI * 2); ctx.stroke();
      ctx.fillStyle = h.color || '#ff4f7a';
      ctx.globalAlpha = 0.35 * k;
      ctx.beginPath(); ctx.ellipse(h.x, h.y, 8, 5.5, 0, 0, Math.PI * 2); ctx.fill();
      ctx.globalAlpha = 1;
      break;
    }
  }
}

export function renderHazardAbove(ctx, h, time) {
  if (h.type !== 'beam') return;
  const x2 = h.x + Math.cos(h.angle) * h.len, y2 = h.y + Math.sin(h.angle) * h.len;
  if (h.t < h.warn) {
    ctx.globalAlpha = 0.35 + 0.4 * (h.t / h.warn) * (Math.sin(time * 30) > 0 ? 1 : 0.6);
    ctx.strokeStyle = '#ff7ae6'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(h.x, h.y); ctx.lineTo(x2, y2); ctx.stroke();
  } else {
    const fade = Math.min(1, (h.warn + h.active - h.t) * 4);
    ctx.globalAlpha = 0.5 * fade; ctx.strokeStyle = '#ff7ae6'; ctx.lineWidth = 9;
    ctx.beginPath(); ctx.moveTo(h.x, h.y); ctx.lineTo(x2, y2); ctx.stroke();
    ctx.globalAlpha = 0.9 * fade; ctx.strokeStyle = '#7ae0ff'; ctx.lineWidth = 4;
    ctx.beginPath(); ctx.moveTo(h.x, h.y); ctx.lineTo(x2, y2); ctx.stroke();
    ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(h.x, h.y); ctx.lineTo(x2, y2); ctx.stroke();
  }
  ctx.globalAlpha = 1;
}
