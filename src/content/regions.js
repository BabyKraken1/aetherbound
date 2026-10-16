// The three dungeon regions reachable from the hub, unlocked in order by defeating each boss.

export const REGIONS = [
  {
    id: 'mossveil', index: 0, name: 'Mossveil Wilds', sub: 'Ruins swallowed by living moss',
    theme: 'moss', portal: '#5fd068', boss: 'bramblemaw', rooms: [7, 8], diff: { hp: 1, dmg: 1 },
    budget: [5, 8], hazard: 'Thorn patches hurt to stand in.', recommended: 1,
    weights: { chaser: 4, shooter: 3, flanker: 2, brute: 1, lobber: 1.5, summoner: 1, turret: 1, charger: 2 },
  },
  {
    id: 'cinder', index: 1, name: 'Cinder Depths', sub: 'A buried kingdom drowned in magma',
    theme: 'cinder', portal: '#ff7a3a', boss: 'kragmor', rooms: [8, 9], diff: { hp: 2.1, dmg: 1.6 },
    budget: [7, 10], hazard: 'Lava burns. Slimes and golems leave fire when they die.', recommended: 6,
    weights: { chaser: 3, shooter: 3, flanker: 2, brute: 1.5, lobber: 2.5, summoner: 1, turret: 1.5, charger: 2 },
  },
  {
    id: 'prism', index: 2, name: 'Prism Hollow', sub: 'Caverns of unstable, singing crystal',
    theme: 'prism', portal: '#7ae0ff', boss: 'lumen', rooms: [9, 10], diff: { hp: 3.4, dmg: 2.2 },
    budget: [9, 12], hazard: 'It is dark. Rift cracks hurt. Shardlings explode into shards.', recommended: 12,
    weights: { chaser: 3, shooter: 3, flanker: 2.5, brute: 1.5, lobber: 2, summoner: 1.5, turret: 2, charger: 2 },
  },
  {
    id: 'frost', index: 3, name: 'Frostspire Peaks', sub: 'A frozen choir sings at the top of the world',
    theme: 'frost', portal: '#bfe9ff', boss: 'glacius', rooms: [9, 11], diff: { hp: 5, dmg: 2.9 },
    budget: [10, 13], hazard: 'Black-ice cracks bite. Frostlings shatter into shards.', recommended: 16,
    weights: { chaser: 3, shooter: 3, flanker: 3, brute: 2, lobber: 2, summoner: 1.5, turret: 2, charger: 2.5 },
  },
];

// Open-world biome bands, from the town outward. `until` is the (noise-warped) distance in tiles
// from the town center where the biome ends. Each biome uses the region's enemies and difficulty.
export const BIOMES = [
  { region: 0, until: 58 },
  { region: 1, until: 82 },
  { region: 2, until: 104 },
  { region: 3, until: 999 },
];

// Heroic tier: replayable harder version of every dungeon, unlocked by beating the final boss.
export const HEROIC = { hp: 1.7, dmg: 1.5, rarityBump: 1, mythicChance: 0.05 };
export const NORMAL_MYTHIC_CHANCE = 0.015;
