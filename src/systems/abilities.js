// Class abilities, keyed by ability id from content/classes.js.
// Signature: (game, player, stats, relicMods) => void
import { abilityDamage, rollPlayerHit } from './damage.js';
import { dist } from '../util.js';
import { makeHazard } from '../entities/hazards.js';
import { traceLanding } from '../entities/player.js';
import { Wolf } from '../entities/ally.js';

export const ABILITIES = {
  // ── Vanguard ──
  bulwark(g, pl, s, m) {
    const amt = Math.round(45 + s.ap + (m.absorb || 0));
    pl.addBarrier(amt, 5);
    g.fx.ring(pl.x, pl.y - 8, 4, 18, 0.35, '#ffd36b', 2);
    g.audio.play('barrier');
  },
  whirlwind(g, pl, s, m) {
    pl.whirlT = 1.2 + (m.duration || 0);
    pl.whirlTick = 0;
    pl.whirlDmg = abilityDamage(16, s) + Math.round(s.weapon.dmg[0] * 0.5 * s.dmgMult);
    g.audio.play('ability');
  },
  leap(g, pl, s) {
    const m = g.mouseWorld();
    const a = Math.atan2(m.y - pl.y, m.x - pl.x);
    const reach = Math.min(110, dist(pl.x, pl.y, m.x, m.y));
    const land = traceLanding(g.map, pl.x, pl.y, a, reach, pl.r);
    const dmg = abilityDamage(55, s) + Math.round(s.weapon.dmg[1] * s.dmgMult);
    g.hazards.push(makeHazard('telegraph', { x: land.x, y: land.y, r: 40, warn: 0.35, dmg, friendly: true, style: 'leap', stun: 1.3, sound: false }));
    pl.leap = {
      sx: pl.x, sy: pl.y, tx: land.x, ty: land.y, t: 0, dur: 0.35,
      onLand: (g2) => { g2.shake(6); g2.audio.play('slam'); g2.fx.ring(land.x, land.y, 6, 42, 0.3, '#ffd36b', 2); },
    };
    g.audio.play('ability');
  },

  // ── Arcanist ──
  frostNova(g, pl, s, m) {
    const r = 54 + (m.radius || 0);
    const dmg = abilityDamage(40, s);
    for (const e of g.enemies) if (!e.dead && !e.spawning && dist(pl.x, pl.y - 6, e.x, e.cy ?? e.y) < r + e.r) g.hitEnemy(e, dmg, false, { slow: 3, knock: 90, fromX: pl.x, fromY: pl.y, ability: true });
    // shatter hostile projectiles caught in the blast
    for (const p of g.projectiles.list) if (!p.friendly && dist(pl.x, pl.y, p.x, p.y) < r * 0.8) { p.life = 0; g.fx.burst(p.x, p.y, 3, ['#9fe6ff'], 30, 0.2); }
    g.fx.ring(pl.x, pl.y - 6, 6, r, 0.35, '#9fe6ff', 2);
    g.fx.burst(pl.x, pl.y - 6, 40, ['#9fe6ff', '#ffffff', '#5b8cff'], r * 2.4, 0.4);
    g.audio.play('nova');
  },
  arcaneOrb(g, pl, s, m) {
    const a = pl.aim;
    g.projectiles.spawn({
      x: pl.x + Math.cos(a) * 8, y: pl.y - 7 + Math.sin(a) * 8, vx: Math.cos(a) * 72, vy: Math.sin(a) * 72,
      size: 7 + (m.size || 0), dmg: abilityDamage(16, s), friendly: true, life: 2.8, pierce: 999, tick: 0.2, style: 'orb', trail: true, knock: 20, ability: true,
    });
    g.audio.play('ability');
  },
  blink(g, pl) {
    const m = g.mouseWorld();
    const a = Math.atan2(m.y - pl.y, m.x - pl.x);
    const land = traceLanding(g.map, pl.x, pl.y, a, Math.min(105, dist(pl.x, pl.y, m.x, m.y)), pl.r);
    g.fx.burst(pl.x, pl.y - 8, 18, ['#7a9cff', '#ffffff'], 70, 0.35);
    pl.x = land.x; pl.y = land.y;
    pl.iframes = Math.max(pl.iframes, 0.25);
    g.fx.burst(pl.x, pl.y - 8, 18, ['#7a9cff', '#ffffff'], 70, 0.35);
    g.audio.play('blink');
  },

  // ── Ranger ──
  volley(g, pl, s, m) {
    const n = 7 + (m.arrows || 0);
    const spread = 0.95;
    for (let i = 0; i < n; i++) {
      const a = pl.aim + (i / (n - 1) - 0.5) * spread;
      const { dmg, crit } = rollPlayerHit(s.weapon, s, Math.random);
      g.projectiles.spawn({
        x: pl.x, y: pl.y - 7, vx: Math.cos(a) * 330, vy: Math.sin(a) * 330, size: 2,
        dmg: Math.round(dmg * 0.9 + s.ap * 0.4), crit, friendly: true, life: 0.65, pierce: 2, style: s.weapon.style.includes('arrow') ? s.weapon.style : 'arrow', ability: true,
      });
    }
    g.audio.play('swing');
  },
  snareTrap(g, pl, s, m) {
    const max = 3 + (m.max || 0);
    const traps = g.hazards.filter((h) => h.type === 'trap' && !h.dead);
    if (traps.length >= max) traps[0].dead = true;
    g.hazards.push(makeHazard('trap', { x: pl.x, y: pl.y, life: 25, dmg: abilityDamage(45, s) }));
    g.audio.play('click');
  },
  rollShot(g, pl) {
    pl.startDodge(g, [-Math.cos(pl.aim), -Math.sin(pl.aim)]);
    pl.rapidT = 3;
    g.fx.ring(pl.x, pl.y - 6, 4, 16, 0.3, '#5fd068', 1);
  },

  // ── Warden ──
  spiritWard(g, pl, s, m) {
    const n = 3 + (m.orbs || 0);
    pl.wardOrbs = Array.from({ length: n }, () => ({ x: pl.x, y: pl.y }));
    pl.wardT = 6;
    pl.wardDmg = abilityDamage(16, s);
    g.audio.play('barrier');
  },
  spiritWolf(g, pl, s, m) {
    for (const a of g.allies) if (a instanceof Wolf) a.life = 0;
    g.allies.push(new Wolf(pl.x + 10, pl.y, 10 + (m.duration || 0), abilityDamage(22, s)));
    g.fx.burst(pl.x + 10, pl.y - 4, 20, ['#9fc0ff', '#ffffff'], 60, 0.4);
    g.audio.play('ability');
  },
  sanctuary(g, pl) {
    g.hazards.push(makeHazard('field', { x: pl.x, y: pl.y, r: 42, life: 5, heal: 0.12 }));
    g.audio.play('heal');
  },
};
