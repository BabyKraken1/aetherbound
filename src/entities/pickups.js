// Loot on the ground (items + gold) and treasure chests.
import { getBase } from '../content/items.js';
import { RARITY_COLOR, RARITIES } from '../config.js';
import { itemIcon, goldIcon, drawSprite } from '../render/sprites.js';
import { moveWithCollision } from '../world/tilemap.js';
import { dist } from '../util.js';

export class Pickup {
  constructor(x, y, item, gold = 0) {
    this.x = x; this.y = y; this.r = 3;
    this.item = item; this.gold = gold;
    const a = Math.random() * Math.PI * 2, s = 30 + Math.random() * 50;
    this.vx = Math.cos(a) * s; this.vy = Math.sin(a) * s;
    this.z = 0; this.vz = 70 + Math.random() * 40;
    this.t = 0;
    this.dead = false;
    this.blockedNotice = 0;
    if (item) {
      const base = getBase(item.base);
      this.base = base;
      this.rank = RARITIES.indexOf(base.rarity);
      this.color = RARITY_COLOR[base.rarity];
    }
  }
  update(dt, g) {
    this.t += dt;
    if (this.z > 0 || this.vz > 0) {
      this.vz -= 260 * dt;
      this.z = Math.max(0, this.z + this.vz * dt);
      if (this.z === 0) this.vz = 0;
      moveWithCollision(g.map, this, this.vx * dt, this.vy * dt);
      this.vx *= Math.pow(0.05, dt); this.vy *= Math.pow(0.05, dt);
    }
    const pl = g.player;
    if (pl.dead || this.t < 0.35) return;
    const d = dist(this.x, this.y, pl.x, pl.y);
    if (this.gold) {
      if (d < 46) {
        const k = Math.min(1, dt * 10);
        this.x += (pl.x - this.x) * k; this.y += (pl.y - this.y) * k;
      }
      if (d < 7) { g.collectGold(this.gold, this.x, this.y); this.dead = true; }
      return;
    }
    this.blockedNotice = Math.max(0, this.blockedNotice - dt);
    if (d < 11) {
      if (g.collectItem(this.item)) this.dead = true;
      else if (this.blockedNotice <= 0) { g.toast('Inventory full: press I to free space', '#ff4f5e'); this.blockedNotice = 3; }
    }
  }
  render(ctx, g, time) {
    const bob = this.z > 0 ? -this.z : -Math.round(Math.sin(time * 3 + this.x) * 1.5 + 2);
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.beginPath(); ctx.ellipse(this.x, this.y, 4, 1.5, 0, 0, Math.PI * 2); ctx.fill();
    if (this.gold) {
      ctx.drawImage(goldIcon(), Math.round(this.x - 6), Math.round(this.y - 10 + bob), 12, 12);
      return;
    }
    // rarity beam for rare+ drops so they stand out from the floor
    if (this.rank >= 2) {
      const h = 18 + this.rank * 10;
      const grad = ctx.createLinearGradient(0, this.y - h, 0, this.y);
      grad.addColorStop(0, 'rgba(0,0,0,0)');
      grad.addColorStop(1, this.color);
      ctx.globalAlpha = 0.35 + 0.15 * Math.sin(time * 4);
      ctx.fillStyle = grad;
      ctx.fillRect(Math.round(this.x) - 2, Math.round(this.y - h), 4, h);
      ctx.globalAlpha = 1;
      if (this.rank >= 4 && Math.random() < 0.25) g.fx.particle(this.x + (Math.random() - 0.5) * 8, this.y - 4, 0, -30, 0.6, this.color);
    }
    ctx.globalAlpha = 0.5;
    ctx.strokeStyle = this.color; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.ellipse(this.x, this.y, 6, 2.5, 0, 0, Math.PI * 2); ctx.stroke();
    ctx.globalAlpha = 1;
    ctx.drawImage(itemIcon(this.base, this.color), Math.round(this.x - 6), Math.round(this.y - 13 + bob));
    if ((this.item.qty || 1) > 1) g.drawLabel(ctx, String(this.item.qty), this.x + 6, this.y - 4 + bob, '#ffffff');
  }
}

export class Chest {
  constructor(x, y, kind, onOpen) {
    this.x = x; this.y = y; this.kind = kind; this.opened = false; this.onOpen = onOpen; this.r = 7;
  }
  render(ctx, g, time) {
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.beginPath(); ctx.ellipse(this.x, this.y, 8, 3, 0, 0, Math.PI * 2); ctx.fill();
    if (!this.opened && this.kind !== 'normal') {
      ctx.globalAlpha = 0.3 + 0.2 * Math.sin(time * 4);
      ctx.fillStyle = this.kind === 'secret' ? '#b46cff' : '#ffd36b';
      ctx.beginPath(); ctx.ellipse(this.x, this.y - 4, 12, 9, 0, 0, Math.PI * 2); ctx.fill();
      ctx.globalAlpha = 1;
    }
    drawSprite(ctx, 'chest', this.opened ? 1 : 0, this.x, this.y);
  }
}
