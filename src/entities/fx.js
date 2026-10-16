// Visual effects: pooled particles, floating numbers, rings, slashes and afterimages.
import { drawNumber, drawSprite } from '../render/sprites.js';

const MAX_PARTICLES = 900;

export class FX {
  constructor() {
    this.parts = [];
    this.pool = [];
    this.texts = [];
    this.rings = [];
    this.arcs = [];
    this.ghosts = [];
  }
  clear() {
    for (const p of this.parts) this.pool.push(p);
    this.parts.length = 0;
    this.texts.length = this.rings.length = this.arcs.length = this.ghosts.length = 0;
  }
  particle(x, y, vx, vy, life, color, size = 1, grav = 0, drag = 0.9) {
    if (this.parts.length >= MAX_PARTICLES) return;
    const p = this.pool.pop() || {};
    p.x = x; p.y = y; p.vx = vx; p.vy = vy; p.life = life; p.max = life; p.color = color; p.size = size; p.grav = grav; p.drag = drag;
    this.parts.push(p);
  }
  burst(x, y, n, colors, speed = 60, life = 0.4, size = 1, grav = 0) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, s = speed * (0.3 + Math.random() * 0.7);
      this.particle(x, y, Math.cos(a) * s, Math.sin(a) * s, life * (0.6 + Math.random() * 0.6), colors[i % colors.length], size, grav);
    }
  }
  spray(x, y, angle, spread, n, colors, speed = 80, life = 0.3, size = 1) {
    for (let i = 0; i < n; i++) {
      const a = angle + (Math.random() - 0.5) * spread, s = speed * (0.4 + Math.random() * 0.6);
      this.particle(x, y, Math.cos(a) * s, Math.sin(a) * s, life * (0.6 + Math.random() * 0.6), colors[i % colors.length], size);
    }
  }
  text(x, y, str, color, big = false) {
    if (this.texts.length > 80) this.texts.shift();
    this.texts.push({ x: x + (Math.random() - 0.5) * 6, y, str, color, life: big ? 0.9 : 0.7, max: big ? 0.9 : 0.7, big, vy: -38 });
  }
  ring(x, y, r0, r1, t, color, width = 1) { this.rings.push({ x, y, r0, r1, t, max: t, color, width }); }
  arc(x, y, angle, radius, width, t, color) { this.arcs.push({ x, y, angle, radius, width, t, max: t, color }); }
  ghost(x, y, name, frame, flip, t = 0.2) { this.ghosts.push({ x, y, name, frame, flip, t, max: t }); }

  update(dt) {
    const k = Math.pow(0.0001, dt); // frame-rate independent drag base
    for (let i = this.parts.length - 1; i >= 0; i--) {
      const p = this.parts[i];
      p.life -= dt;
      if (p.life <= 0) { this.parts[i] = this.parts[this.parts.length - 1]; this.parts.pop(); this.pool.push(p); continue; }
      const drag = Math.pow(p.drag, dt * 60);
      p.vx *= drag; p.vy = p.vy * drag + p.grav * dt;
      p.x += p.vx * dt; p.y += p.vy * dt;
    }
    void k;
    for (let i = this.texts.length - 1; i >= 0; i--) {
      const t = this.texts[i];
      t.life -= dt; t.y += t.vy * dt; t.vy *= Math.pow(0.05, dt);
      if (t.life <= 0) this.texts.splice(i, 1);
    }
    for (const list of [this.rings, this.arcs, this.ghosts])
      for (let i = list.length - 1; i >= 0; i--) { list[i].t -= dt; if (list[i].t <= 0) list.splice(i, 1); }
  }

  renderBelow(ctx) {
    for (const g of this.ghosts) drawSprite(ctx, g.name, g.frame, g.x, g.y, { flip: g.flip, alpha: 0.35 * (g.t / g.max), flash: true });
  }

  render(ctx) {
    for (const p of this.parts) {
      ctx.globalAlpha = Math.min(1, (p.life / p.max) * 1.5);
      ctx.fillStyle = p.color;
      ctx.fillRect(Math.round(p.x - p.size / 2), Math.round(p.y - p.size / 2), p.size, p.size);
    }
    ctx.globalAlpha = 1;
    for (const r of this.rings) {
      const k = 1 - r.t / r.max;
      ctx.globalAlpha = r.t / r.max;
      ctx.strokeStyle = r.color; ctx.lineWidth = r.width;
      ctx.beginPath(); ctx.arc(r.x, r.y, r.r0 + (r.r1 - r.r0) * k, 0, Math.PI * 2); ctx.stroke();
    }
    for (const a of this.arcs) {
      const k = a.t / a.max;
      ctx.globalAlpha = Math.min(1, k * 1.6);
      ctx.strokeStyle = a.color; ctx.lineWidth = 3 * k + 1;
      ctx.beginPath(); ctx.arc(a.x, a.y, a.radius * (1.05 - 0.15 * k), a.angle - a.width / 2, a.angle + a.width / 2); ctx.stroke();
      ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.arc(a.x, a.y, a.radius * (1.05 - 0.15 * k) - 1, a.angle - a.width / 2.6, a.angle + a.width / 2.6); ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  renderTexts(ctx, show) {
    for (const t of this.texts) {
      if (!show && !t.always) continue;
      const k = t.life / t.max;
      ctx.globalAlpha = Math.min(1, k * 2);
      drawNumber(ctx, t.str, t.x, t.y, t.color, t.big ? 2 : 1);
    }
    ctx.globalAlpha = 1;
  }
}
