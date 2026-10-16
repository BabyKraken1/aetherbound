// Boss definitions and their attack patterns.
//
// Patterns are generator functions: they call helpers on the boss (b.fan, b.ground, b.beam, ...)
// and `yield` a number of seconds to wait. entities/boss.js runs them.
// Damage numbers here are base values; the boss multiplies them by its region/heroic scale.

export const BOSSES = {
  bramblemaw: {
    id: 'bramblemaw', name: 'Bramblemaw', title: 'The Rooted King', region: 0,
    hp: 1500, def: 3, r: 17, speed: 20, contact: 18, xp: 320, dmgScale: 1,
    sprite: 'bramblemaw', color: '#7bd36a',
    signature: 'Root Eruption: roots burst from the ground where you stand.',
    intro: 'The forest has a heart, and it is hungry.',
    phases: [
      { at: 1, rest: 0.9, patterns: ['thornFan', 'rootEruption', 'thornFan', 'summonSprouts'] },
      { at: 0.55, rest: 0.55, patterns: ['thornFan', 'rootEruption', 'bloom', 'summonSprouts', 'bloom'] },
    ],
  },
  kragmor: {
    id: 'kragmor', name: 'Kragmor', title: 'The Cinder Wyrm', region: 1,
    hp: 4400, def: 7, r: 15, speed: 34, contact: 24, xp: 900, dmgScale: 1.6,
    sprite: 'kragmor', color: '#ff7a3a', segments: 7,
    signature: 'Molten Charge: he barrels across the arena, leaving rivers of lava.',
    intro: 'The depths remember the dragon that dug them.',
    phases: [
      { at: 1, rest: 0.8, patterns: ['flameSweep', 'moltenCharge', 'magmaRain', 'flameSweep'] },
      { at: 0.5, rest: 0.5, patterns: ['moltenCharge', 'flameSweep', 'magmaRain', 'moltenCharge', 'eruption'] },
    ],
  },
  lumen: {
    id: 'lumen', name: 'Lumen', title: 'The Shattered Prism', region: 2,
    hp: 9000, def: 11, r: 15, speed: 26, contact: 26, xp: 2200, dmgScale: 2.2, fly: true,
    sprite: 'lumen', color: '#7ae0ff',
    signature: 'Prism Beams: rotating lasers sweep the arena. Stay in the gaps.',
    intro: 'Light, broken into a thousand angry pieces.',
    phases: [
      { at: 1, rest: 0.8, patterns: ['prismBeams', 'shardSpiral', 'mirrorClones', 'shardSpiral'] },
      { at: 0.5, rest: 0.5, patterns: ['prismBeams', 'shardSpiral', 'mirrorClones', 'prismBeams', 'blinkStrike'] },
    ],
  },
};

const TAU = Math.PI * 2;

export const PATTERNS = {
  // ── Bramblemaw ──
  *thornFan(b) {
    const n = b.phase > 1 ? 7 : 5;
    for (let i = 0; i < 3; i++) {
      b.windup(0.35);
      yield 0.35;
      b.fan(n, 0.95, 115, { dmg: 14, style: 'thorn', size: 4 });
      b.sfx('bossShoot');
      yield 0.45;
    }
  },
  *rootEruption(b) {
    const count = b.phase > 1 ? 8 : 5;
    for (let i = 0; i < count; i++) {
      const p = b.player;
      // aim slightly ahead of the player so standing still is never safe
      const lead = 0.5;
      b.ground(p.x + p.vx * lead, p.y + p.vy * lead, 20, 0.85, 22, { style: 'root' });
      yield b.phase > 1 ? 0.26 : 0.36;
    }
    yield 0.7;
  },
  *summonSprouts(b) {
    b.windup(0.7);
    yield 0.7;
    b.summon('minion', b.phase > 1 ? 4 : 3);
    yield 0.6;
  },
  *bloom(b) {
    // signature ring with a rotating safe gap
    b.windup(0.6);
    yield 0.6;
    let gap = b.angleToPlayer();
    const dir = Math.random() < 0.5 ? 1 : -1;
    for (let k = 0; k < 5; k++) {
      b.ring(30, 85, 0, { dmg: 16, style: 'thorn', size: 4, gapAngle: gap, gapWidth: 0.75 });
      b.sfx('bossShoot');
      gap += dir * 0.42;
      yield 0.62;
    }
    yield 0.4;
  },

  // ── Kragmor ──
  *flameSweep(b) {
    b.windup(0.5);
    yield 0.5;
    const base = b.angleToPlayer();
    const width = 0.9;
    const dir = Math.random() < 0.5 ? 1 : -1;
    const shots = b.phase > 1 ? 30 : 22;
    for (let i = 0; i < shots; i++) {
      const a = base + dir * (-width + (2 * width * i) / shots);
      b.shootAt(a, 150, { dmg: 16, style: 'fire', size: 4 });
      if (b.phase > 1 && i % 2 === 0) b.shootAt(a + Math.PI, 110, { dmg: 14, style: 'fire', size: 3 });
      if (i % 3 === 0) b.sfx('flame');
      yield 0.05;
    }
    yield 0.4;
  },
  *moltenCharge(b) {
    const times = b.phase > 1 ? 2 : 1;
    for (let k = 0; k < times; k++) {
      const a = b.angleToPlayer();
      b.lineWarn(a, 320, 0.8);
      b.windup(0.8);
      yield 0.8;
      b.sfx('roar');
      yield* b.charge(a, 310, 1.1, { pool: true, wallBurst: b.phase > 1 ? 14 : 0 });
      yield 0.35;
    }
    yield 0.5;
  },
  *magmaRain(b) {
    b.windup(0.5);
    yield 0.5;
    const n = b.phase > 1 ? 12 : 8;
    for (let i = 0; i < n; i++) {
      const near = i % 2 === 0;
      const p = near ? { x: b.player.x + (Math.random() - 0.5) * 40, y: b.player.y + (Math.random() - 0.5) * 40 } : b.randomArenaPoint();
      b.lob(p.x, p.y, 22, 1.0, 20, { pool: 4.5, style: 'magma' });
      yield 0.14;
    }
    yield 1.0;
  },
  *eruption(b) {
    b.windup(0.7);
    yield 0.7;
    for (let k = 0; k < 3; k++) {
      b.ring(16, 100, k * 0.2, { dmg: 16, style: 'fire', size: 4 });
      b.sfx('boom');
      yield 0.35;
    }
    yield 0.5;
  },

  // ── Lumen ──
  *prismBeams(b) {
    const n = b.phase > 1 ? 4 : 3;
    const start = b.angleToPlayer() + Math.PI / n;
    const spin = (Math.random() < 0.5 ? 1 : -1) * (b.phase > 1 ? 0.62 : 0.5);
    b.holdStill(4.2);
    for (let i = 0; i < n; i++) b.beam(start + (i * TAU) / n, spin, 1.0, 3.0, { dmg: 26 });
    b.sfx('charge');
    yield 1.0;
    b.sfx('laser');
    if (b.phase > 1) {
      for (let k = 0; k < 3; k++) { yield 0.8; b.ring(10, 70, k * 0.3, { dmg: 16, style: 'shard', size: 3 }); }
      yield 0.6;
    } else yield 3.0;
    yield 0.4;
  },
  *shardSpiral(b) {
    b.windup(0.4);
    yield 0.4;
    let a = Math.random() * TAU;
    const arms = b.phase > 1 ? 3 : 2;
    for (let i = 0; i < 28; i++) {
      for (let k = 0; k < arms; k++) b.shootAt(a + (k * TAU) / arms, 95, { dmg: 18, style: 'shard', size: 3 });
      a += 0.27;
      if (i % 4 === 0) b.sfx('chime');
      yield 0.075;
    }
    yield 0.6;
  },
  *mirrorClones(b) {
    b.windup(0.6);
    yield 0.6;
    const p = b.randomArenaPoint(60);
    b.teleport(p.x, p.y);
    b.summon('lumenClone', b.phase > 1 ? 3 : 2);
    yield 1.6;
  },
  *blinkStrike(b) {
    for (let k = 0; k < 3; k++) {
      const p = b.player;
      b.ground(p.x, p.y, 26, 0.75, 24, { style: 'prism' });
      yield 0.75;
      b.teleport(p.x, p.y, true);
      b.ring(12, 90, k * 0.25, { dmg: 16, style: 'shard', size: 3 });
      yield 0.4;
    }
    yield 0.5;
  },
};
