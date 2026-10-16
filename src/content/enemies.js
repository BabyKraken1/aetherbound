// Enemy archetypes (behavior + base stats) and per-region variants (name, palette, twists).
// AI for every archetype is the shared state machine in entities/enemy.js.
//
// move: chase | kite | flank | still
// attack types: shot | fan | burst | radial | lob | dash | charge | slam | summon

export const ARCHETYPES = {
  chaser: {
    sprite: 'blob', hp: 42, def: 0, speed: 50, r: 6, contact: 10, xp: 6, cost: 1, move: 'chase', attacks: [],
  },
  shooter: {
    sprite: 'spitter', hp: 34, def: 0, speed: 32, r: 6, contact: 6, xp: 8, cost: 1.5, move: 'kite', pref: 95,
    attacks: [{ type: 'shot', cd: 1.7, windup: 0.4, recover: 0.25, dmg: 12, speed: 105, range: 170, size: 3 }],
  },
  flanker: {
    sprite: 'bat', hp: 26, def: 0, speed: 80, r: 5, contact: 9, xp: 7, cost: 1.5, move: 'flank', fly: true,
    attacks: [{ type: 'dash', cd: 2.4, windup: 0.45, recover: 0.4, dmg: 14, speed: 240, time: 0.3, range: 95 }],
  },
  brute: {
    sprite: 'golem', hp: 160, def: 6, speed: 24, r: 9, contact: 16, xp: 22, cost: 4, move: 'chase', knockResist: 0.85,
    attacks: [{ type: 'slam', cd: 3, windup: 0.85, recover: 0.7, dmg: 26, radius: 36, range: 42 }],
  },
  lobber: {
    sprite: 'shroom', hp: 46, def: 1, speed: 28, r: 6, contact: 6, xp: 10, cost: 2, move: 'kite', pref: 115,
    attacks: [{ type: 'lob', cd: 2.6, windup: 0.4, recover: 0.3, dmg: 16, radius: 18, flight: 0.9, pool: 3, range: 180 }],
  },
  summoner: {
    sprite: 'shaman', hp: 58, def: 1, speed: 30, r: 6, contact: 6, xp: 15, cost: 3, move: 'kite', pref: 135,
    attacks: [
      { type: 'summon', cd: 5.5, windup: 0.9, recover: 0.5, count: 2, minion: 'minion', max: 5, range: 240 },
      { type: 'fan', cd: 2.4, windup: 0.4, recover: 0.3, dmg: 10, speed: 90, count: 3, spread: 0.5, range: 180, size: 3 },
    ],
  },
  turret: {
    sprite: 'sentinel', hp: 95, def: 4, speed: 0, r: 7, contact: 0, xp: 14, cost: 3, move: 'still', knockResist: 1,
    attacks: [{ type: 'radial', cd: 2.3, windup: 0.5, recover: 0.2, dmg: 12, count: 8, speed: 78, spin: 0.2, range: 210, size: 3 }],
  },
  charger: {
    sprite: 'boar', hp: 72, def: 2, speed: 38, r: 7, contact: 12, xp: 12, cost: 2.5, move: 'chase',
    attacks: [{ type: 'charge', cd: 3.3, windup: 0.75, recover: 0.7, dmg: 22, speed: 250, time: 0.55, range: 160 }],
  },
  minion: {
    sprite: 'wisp', hp: 14, def: 0, speed: 66, r: 4, contact: 7, xp: 1, cost: 0, move: 'chase', fly: true, attacks: [], noDrop: true,
  },
};

// Region variants: same archetype behavior, different look, name and a region twist.
// twists: deathPool (leaves a fire pool), deathBurst (shards on death), burst3 (3-shot burst), thornsTrail
export const ROSTERS = {
  mossveil: {
    pal: 'moss',
    chaser: { name: 'Mossling' },
    shooter: { name: 'Spore Spitter' },
    flanker: { name: 'Thornwing' },
    brute: { name: 'Barkhulk' },
    lobber: { name: 'Puffcap' },
    summoner: { name: 'Hexroot Shaman' },
    turret: { name: 'Mossy Totem' },
    charger: { name: 'Bristleback' },
    minion: { name: 'Sproutling' },
  },
  cinder: {
    pal: 'cinder',
    chaser: { name: 'Cinder Slime', twist: 'deathPool' },
    shooter: { name: 'Ember Spitter', twist: 'burst3' },
    flanker: { name: 'Ash Bat' },
    brute: { name: 'Magma Golem', twist: 'deathPool' },
    lobber: { name: 'Blastcap' },
    summoner: { name: 'Ember Cultist' },
    turret: { name: 'Flame Obelisk' },
    charger: { name: 'Lava Tusker' },
    minion: { name: 'Ember Imp' },
  },
  prism: {
    pal: 'prism',
    chaser: { name: 'Shardling', twist: 'deathBurst' },
    shooter: { name: 'Prism Eye', twist: 'burst3' },
    flanker: { name: 'Glint Moth' },
    brute: { name: 'Crystal Colossus', twist: 'deathBurst' },
    lobber: { name: 'Geode Lobber' },
    summoner: { name: 'Echo Seer' },
    turret: { name: 'Lumen Spire' },
    charger: { name: 'Quartz Ram' },
    minion: { name: 'Glimmer' },
  },
  frost: {
    pal: 'frost',
    chaser: { name: 'Frostling', twist: 'deathBurst' },
    shooter: { name: 'Rime Spitter', twist: 'burst3' },
    flanker: { name: 'Snow Wraith' },
    brute: { name: 'Glacier Golem', twist: 'deathBurst' },
    lobber: { name: 'Hailcap' },
    summoner: { name: 'Frost Seer' },
    turret: { name: 'Ice Spire' },
    charger: { name: 'Tundra Ram' },
    minion: { name: 'Snowflake' },
  },
};

// Elite modifiers applied on top of an archetype
export const ELITE = { hp: 2.6, dmg: 1.3, scale: 1.3, xp: 3, speed: 1.1 };

// Mini-boss used in elite rooms: a souped-up brute with an extra radial burst
export const MINIBOSS_EXTRA = { type: 'radial', cd: 3.5, windup: 0.6, recover: 0.3, dmg: 14, count: 12, speed: 85, spin: 0.13, range: 260, size: 4 };
