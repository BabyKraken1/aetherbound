// Playable classes. Ability behavior lives in systems/abilities.js, keyed by ability id.

export const CLASSES = {
  vanguard: {
    id: 'vanguard', name: 'Vanguard', role: 'Melee bruiser',
    desc: 'A shield-bearing knight. Cleaving sword arcs, a damage-absorbing barrier, and a spinning whirlwind.',
    color: '#e25555', unlocked: true,
    base: { hp: 160, mp: 60, def: 4, spd: 0, crit: 0.05, ap: 0, cdr: 0, hpRegen: 1.5, mpRegen: 3 },
    growth: { hp: 13, mp: 3, def: 0.6 },
    starter: ['rusty_sword', 'padded_tunic'],
    abilities: [
      { id: 'bulwark', name: 'Bulwark', key: 'Q', mp: 20, cd: 9, desc: 'Barrier absorbs 45 (+AP) damage for 5s. Enemy shots that hit it are destroyed.' },
      { id: 'whirlwind', name: 'Whirlwind', key: 'E', mp: 25, cd: 6, desc: 'Spin for 1.2s, hitting everything around you.' },
      { id: 'leap', name: 'Sunder Leap', key: 'R', mp: 35, cd: 10, desc: 'Leap toward the cursor and slam the ground, stunning enemies. (Lv 5)' },
    ],
  },
  arcanist: {
    id: 'arcanist', name: 'Arcanist', role: 'Ranged caster',
    desc: 'A fragile mage. Arcane bolts, a freezing nova, and a slow orb that shreds everything it passes.',
    color: '#5b8cff', unlocked: true,
    base: { hp: 100, mp: 140, def: 1, spd: 2, crit: 0.06, ap: 0, cdr: 0, hpRegen: 1, mpRegen: 6 },
    growth: { hp: 8, mp: 7, def: 0.3 },
    starter: ['apprentice_staff', 'padded_tunic'],
    abilities: [
      { id: 'frostNova', name: 'Frost Nova', key: 'Q', mp: 25, cd: 5, desc: 'Blast of frost around you. Damages and slows enemies by 50% for 3s.' },
      { id: 'arcaneOrb', name: 'Arcane Orb', key: 'E', mp: 35, cd: 7, desc: 'Launch a slow orb that pierces everything and hits repeatedly.' },
      { id: 'blink', name: 'Blink', key: 'R', mp: 20, cd: 5, desc: 'Teleport toward the cursor. (Lv 5)' },
    ],
  },
  ranger: {
    id: 'ranger', name: 'Ranger', role: 'Mobile marksman',
    desc: 'A swift archer. Rapid arrows, a fan-shaped volley, and root traps for crowd control.',
    color: '#58c06a', unlocked: true,
    base: { hp: 120, mp: 90, def: 2, spd: 10, crit: 0.1, ap: 0, cdr: 0, hpRegen: 1.2, mpRegen: 4 },
    growth: { hp: 10, mp: 4, def: 0.4 },
    starter: ['shortbow', 'padded_tunic'],
    abilities: [
      { id: 'volley', name: 'Volley', key: 'Q', mp: 20, cd: 4, desc: 'Fire a fan of 7 piercing arrows.' },
      { id: 'snareTrap', name: 'Snare Trap', key: 'E', mp: 15, cd: 3, desc: 'Drop a trap that roots and damages the first enemy to step on it. Max 3.' },
      { id: 'rollShot', name: 'Tumble', key: 'R', mp: 25, cd: 8, desc: 'Tumble backward and fire 60% faster for 3s. (Lv 5)' },
    ],
  },
  warden: {
    id: 'warden', name: 'Warden', role: 'Spirit summoner',
    desc: 'A masked spirit-keeper. Homing wisps, orbiting wards that block shots, and a spirit wolf companion.',
    color: '#b46cff', unlocked: false, unlockText: 'Defeat Bramblemaw to unlock',
    base: { hp: 130, mp: 110, def: 3, spd: 4, crit: 0.05, ap: 0, cdr: 0, hpRegen: 1.4, mpRegen: 5 },
    growth: { hp: 11, mp: 5, def: 0.5 },
    starter: ['spirit_lantern', 'padded_tunic'],
    abilities: [
      { id: 'spiritWard', name: 'Spirit Ward', key: 'Q', mp: 25, cd: 9, desc: '3 orbs circle you for 6s, hitting enemies and blocking shots.' },
      { id: 'spiritWolf', name: 'Spirit Wolf', key: 'E', mp: 35, cd: 14, desc: 'Summon a spirit wolf that hunts enemies for 10s.' },
      { id: 'sanctuary', name: 'Sanctuary', key: 'R', mp: 40, cd: 16, desc: 'Consecrate the ground: heal 12% max HP per second for 5s. (Lv 5)' },
    ],
  },
};

export const CLASS_ORDER = ['vanguard', 'arcanist', 'ranger', 'warden'];
