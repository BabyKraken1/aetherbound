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

// Open-world mini-bosses: roam their biome, respawn, and drop their own legendary + mythic.
export const MINIBOSSES = {
  gnarl: {
    id: 'gnarl', name: 'Old Gnarl', title: 'Rotting Root-Warden', region: 0, miniboss: true,
    hp: 950, def: 3, r: 14, speed: 22, contact: 16, xp: 160, dmgScale: 1,
    sprite: 'golem_moss', scale: 2.1, color: '#8fe06a',
    signature: 'Root Slam: a shockwave ring bursts out after every slam.',
    phases: [{ at: 1, rest: 1.0, patterns: ['rootSlam', 'thornFan', 'summonSprouts'] }, { at: 0.5, rest: 0.7, patterns: ['rootSlam', 'thornFan', 'rootEruption'] }],
  },
  pyrewing: {
    id: 'pyrewing', name: 'Pyrewing', title: 'Ash-Sky Hunter', region: 1, miniboss: true, fly: true,
    hp: 2700, def: 5, r: 13, speed: 40, contact: 22, xp: 480, dmgScale: 1.6,
    sprite: 'bat_cinder', scale: 2.6, color: '#ff7a3a',
    signature: 'Dive Bomb: watch the red line, then sidestep the burning dive.',
    phases: [{ at: 1, rest: 0.9, patterns: ['diveBomb', 'flameSweep', 'magmaRain'] }, { at: 0.5, rest: 0.6, patterns: ['diveBomb', 'diveBomb', 'flameSweep', 'eruption'] }],
  },
  geode: {
    id: 'geode', name: 'Geode Tyrant', title: 'Heart of the Hollow', region: 2, miniboss: true,
    hp: 5200, def: 9, r: 15, speed: 20, contact: 26, xp: 1100, dmgScale: 2.2,
    sprite: 'golem_prism', scale: 2.3, color: '#7ae0ff',
    signature: 'Crystal Fall: crystals crash down where you are standing.',
    phases: [{ at: 1, rest: 0.9, patterns: ['crystalFall', 'shardSpiral', 'rootSlam'] }, { at: 0.5, rest: 0.6, patterns: ['crystalFall', 'shardSpiral', 'eruption', 'crystalFall'] }],
  },
  rimefang: {
    id: 'rimefang', name: 'Rimefang', title: 'Alpha of the White Waste', region: 3, miniboss: true,
    hp: 8800, def: 12, r: 14, speed: 44, contact: 30, xp: 2000, dmgScale: 2.9,
    sprite: 'boar_frost', scale: 2.4, color: '#bfe9ff',
    signature: 'Pounce: Rimefang charges, then howls a freezing ring.',
    phases: [{ at: 1, rest: 0.8, patterns: ['pounce', 'frostRing', 'icicleRain'] }, { at: 0.5, rest: 0.55, patterns: ['pounce', 'pounce', 'frostRing', 'icicleRain'] }],
  },
};

BOSSES.glacius = {
  id: 'glacius', name: 'Glacius', title: 'The Frozen Choir', region: 3,
  hp: 14000, def: 14, r: 16, speed: 24, contact: 30, xp: 4000, dmgScale: 2.9, fly: true,
  sprite: 'glacius', color: '#bfe9ff',
  signature: 'Glacial Lanes: walls of ice sweep the arena. Find the gap.',
  intro: 'At the top of the world, the cold has learned to sing.',
  phases: [
    { at: 1, rest: 0.8, patterns: ['frostRing', 'glacialLanes', 'icicleRain', 'glacialLanes'] },
    { at: 0.5, rest: 0.5, patterns: ['glacialLanes', 'blizzard', 'icicleRain', 'glacialLanes', 'frostRing'] },
  ],
};

export const ALL_BOSSES = { ...BOSSES, ...MINIBOSSES };

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
  // ── Glacius ──
  *frostRing(b) {
    b.windup(0.5);
    yield 0.5;
    const n = b.phase > 1 ? 28 : 22;
    for (let k = 0; k < 2; k++) {
      b.ring(n, 70 + k * 25, k * (Math.PI / n), { dmg: 18, style: 'ice', size: 4 });
      b.sfx('chime');
      yield 0.35;
    }
    yield 0.5;
  },
  *icicleRain(b) {
    const waves = b.phase > 1 ? 4 : 3;
    for (let k = 0; k < waves; k++) {
      const p = b.player;
      for (let i = 0; i < 6; i++) {
        const a = Math.random() * TAU, d = 10 + Math.random() * 55;
        b.ground(p.x + Math.cos(a) * d, p.y + Math.sin(a) * d * 0.8, 16, 0.9, 22, { style: 'ice' });
      }
      b.ground(p.x, p.y, 16, 0.9, 22, { style: 'ice' });
      yield 0.55;
    }
    yield 0.6;
  },
  *glacialLanes(b) {
    // signature: walls of shards sweep across the arena with one safe gap
    b.windup(0.6);
    b.sfx('charge');
    yield 0.6;
    const walls = b.phase > 1 ? 4 : 3;
    const A = b.arena();
    for (let w = 0; w < walls; w++) {
      const fromLeft = w % 2 === 0;
      const rows = Math.floor((A.y1 - A.y0) / 13);
      const gap = 1 + Math.floor(Math.random() * (rows - 4));
      for (let i = 0; i < rows; i++) {
        if (i >= gap && i < gap + 3) continue;
        const y = A.y0 + 6 + i * 13;
        b.shootFrom(fromLeft ? A.x0 + 4 : A.x1 - 4, y, fromLeft ? 0 : Math.PI, 62, { dmg: 22, style: 'ice', size: 4, life: 9 });
      }
      b.sfx('bossShoot');
      yield b.phase > 1 ? 1.5 : 1.9;
    }
    yield 0.6;
  },
  *blizzard(b) {
    b.windup(0.5);
    yield 0.5;
    b.summon('minion', 3);
    let a = Math.random() * TAU;
    for (let i = 0; i < 34; i++) {
      for (let k = 0; k < 3; k++) b.shootAt(a + (k * TAU) / 3, 85, { dmg: 18, style: 'ice', size: 3 });
      a -= 0.23;
      yield 0.08;
    }
    yield 0.6;
  },

  // ── Mini-bosses ──
  *rootSlam(b) {
    b.windup(0.7);
    b.ground(b.x, b.y, 46, 0.7, 26, { style: b.data.region === 2 ? 'prism' : 'root' });
    yield 0.75;
    b.ring(b.phase > 1 ? 20 : 14, 80, Math.random(), { dmg: 16, style: b.data.region === 2 ? 'shard' : 'thorn', size: 4 });
    yield 0.8;
  },
  *diveBomb(b) {
    const a = b.angleToPlayer();
    b.lineWarn(a, 260, 0.7);
    b.windup(0.7);
    yield 0.7;
    b.sfx('roar');
    yield* b.charge(a, 330, 0.8, { pool: true, wallBurst: 0 });
    yield 0.5;
  },
  *crystalFall(b) {
    for (let k = 0; k < (b.phase > 1 ? 5 : 3); k++) {
      const p = b.player;
      b.ground(p.x + p.vx * 0.4, p.y + p.vy * 0.4, 24, 0.8, 30, { style: 'prism' });
      yield 0.45;
    }
    yield 0.6;
  },
  *pounce(b) {
    const a = b.angleToPlayer();
    b.lineWarn(a, 240, 0.6);
    b.windup(0.6);
    yield 0.6;
    yield* b.charge(a, 340, 0.7, { pool: false, wallBurst: 0 });
    b.ring(16, 85, 0, { dmg: 18, style: 'ice', size: 4 });
    b.sfx('roar');
    yield 0.6;
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
