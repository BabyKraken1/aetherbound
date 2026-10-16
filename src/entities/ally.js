// Player allies (Warden's spirit wolf).
import { moveWithCollision } from '../world/tilemap.js';
import { dist, angleTo } from '../util.js';
import { drawSprite } from '../render/sprites.js';

export class Wolf {
  constructor(x, y, life, dmg) {
    this.x = x; this.y = y; this.r = 5; this.life = life; this.dmg = dmg;
    this.bite = 0; this.anim = 0; this.flip = false;
  }
  update(dt, g) {
    this.life -= dt;
    this.anim += dt;
    this.bite = Math.max(0, this.bite - dt);
    let target = null, best = 170;
    for (const e of g.enemies) {
      if (e.dead || e.spawning) continue;
      const d = dist(this.x, this.y, e.x, e.y);
      if (d < best) { best = d; target = e; }
    }
    const pl = g.player;
    let tx = pl.x - 14, ty = pl.y + 4;
    if (target) { tx = target.x; ty = target.y; }
    const d = dist(this.x, this.y, tx, ty);
    if (d > (target ? target.r + 6 : 12)) {
      const a = angleTo(this.x, this.y, tx, ty);
      const sp = target ? 125 : Math.min(140, d * 4);
      moveWithCollision(g.map, this, Math.cos(a) * sp * dt, Math.sin(a) * sp * dt);
      this.flip = Math.cos(a) < 0;
      this.moving = true;
    } else this.moving = false;
    if (target && d < target.r + 9 && this.bite <= 0) {
      this.bite = 0.55;
      g.hitEnemy(target, this.dmg, false, { knock: 50, fromX: this.x, fromY: this.y, ability: true });
      g.fx.spray(target.x, target.cy ?? target.y, angleTo(this.x, this.y, target.x, target.y), 1, 5, ['#9fc0ff', '#ffffff'], 60, 0.25);
    }
    if (Math.random() < 0.3) g.fx.particle(this.x, this.y - 4, 0, -15, 0.4, '#9fc0ff');
    return this.life > 0;
  }
  render(ctx, g, time) {
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.beginPath(); ctx.ellipse(this.x, this.y, 7, 2.5, 0, 0, Math.PI * 2); ctx.fill();
    drawSprite(ctx, 'wolf', this.moving ? Math.floor(this.anim / 0.12) % 2 : 0, this.x, this.y, { flip: this.flip, alpha: Math.min(1, this.life) * 0.85 });
  }
}
