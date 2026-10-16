// Player weapon firing. Damage application lives on the Game (hitEnemy) so every source shares it.
import { rollPlayerHit } from './damage.js';
import { dist, angleTo, angleDiff } from '../util.js';
import { T } from '../config.js';

export function hitEffects(s) {
  const out = [];
  if (s.effects.has('ignite')) out.push('ignite');
  if (s.effects.has('frost')) out.push('frost');
  return out.length ? out : null;
}

export function lastStandActive(pl) {
  return pl.stats.effects.has('lastStand') && pl.hp < pl.stats.maxHp * 0.3;
}

export function fireWeapon(g, pl) {
  const s = pl.stats, w = s.weapon;
  const rnd = Math.random;
  const extra = { lastStand: lastStandActive(pl) };
  const effects = hitEffects(s);
  const ox = pl.x, oy = pl.y - 7;
  if (w.kind === 'melee') {
    const { dmg, crit } = rollPlayerHit(w, s, rnd, extra);
    pl.swingT = 0.15;
    pl.swingA = pl.aim;
    g.fx.arc(ox, oy, pl.aim, w.range, w.arc, 0.16, w.style === 'fire' ? '#ff9a3a' : w.style === 'crystal' ? '#7ae0ff' : w.style === 'moss' ? '#8fe06a' : w.style === 'gold' ? '#ffd36b' : '#e8eef8');
    g.audio.play('swing');
    for (const e of g.enemies) {
      if (e.dead || e.spawning) continue;
      const ey = e.cy ?? e.y;
      const d = dist(ox, oy, e.x, ey);
      if (d - e.r > w.range + 4) continue;
      const tol = w.arc / 2 + Math.atan2(e.r, Math.max(1, d));
      if (Math.abs(angleDiff(pl.aim, angleTo(ox, oy, e.x, ey))) > tol && d > e.r + 4) continue;
      g.hitEnemy(e, dmg, crit, { fromX: ox, fromY: oy, knock: 110, effects });
    }
    // break secret walls with the sword
    for (let k = -1; k <= 1; k++) {
      const a = pl.aim + k * w.arc * 0.3;
      const tx = Math.floor((ox + Math.cos(a) * (w.range - 4)) / 16), ty = Math.floor((oy + Math.sin(a) * (w.range - 4)) / 16);
      if (g.map.get(tx, ty) === T.CRACK) { g.hitCrack(tx, ty, dmg); break; }
    }
    if (s.effects.has('wave')) {
      g.projectiles.spawn({
        x: ox + Math.cos(pl.aim) * 8, y: oy + Math.sin(pl.aim) * 8, vx: Math.cos(pl.aim) * 210, vy: Math.sin(pl.aim) * 210,
        size: 6, dmg: Math.round(dmg * 0.6), crit, friendly: true, life: 0.42, pierce: 99, style: 'gold', knock: 40,
      });
    }
    return;
  }
  const n = w.shots || 1;
  for (let i = 0; i < n; i++) {
    const a = pl.aim + (i - (n - 1) / 2) * w.spread + (Math.random() - 0.5) * 0.03;
    const { dmg, crit } = rollPlayerHit(w, s, rnd, extra);
    g.projectiles.spawn({
      x: ox + Math.cos(a) * 6, y: oy + Math.sin(a) * 6, vx: Math.cos(a) * w.speed, vy: Math.sin(a) * w.speed,
      size: w.size, dmg, crit, friendly: true, life: w.range / w.speed, pierce: w.pierce || 0, homing: w.homing || 0,
      style: w.style, split: s.effects.has('split'), effects, trail: w.style === 'fire' || w.style === 'spirit',
    });
  }
  g.audio.play('shoot', { kind: pl.cls === 'ranger' ? 'arrow' : pl.cls === 'warden' ? 'spirit' : 'bolt' });
}
