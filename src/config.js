// Global constants shared by every system.

export const TILE = 16;
export const STEP = 1 / 60; // fixed simulation step (seconds)

// Largest internal render resolution; the canvas is scaled up by an integer factor.
export const VIEW_MAX_W = 560;
export const VIEW_MAX_H = 315;

// Tile ids
export const T = {
  VOID: 0,
  FLOOR: 1,
  WALL: 2,
  GATE: 3,    // solid only while its room is locked
  CRACK: 4,   // breakable wall hiding a secret
  HAZARD: 5,  // walkable, hurts when stood on (lava, thorns, rift)
  WATER: 6,   // blocks walking, not shots
  PILLAR: 7,  // solid prop (pillar, tree, crystal)
  PATH: 8,    // decorative floor variant (hub cobblestone)
};

export const RARITIES = ['common', 'uncommon', 'rare', 'epic', 'legendary', 'mythic'];
export const RARITY_COLOR = {
  common: '#b8b8c8',
  uncommon: '#5fd068',
  rare: '#4fa3ff',
  epic: '#b46cff',
  legendary: '#ffa630',
  mythic: '#ff4f7a',
};
export const RARITY_LABEL = {
  common: 'Common', uncommon: 'Uncommon', rare: 'Rare',
  epic: 'Epic', legendary: 'Legendary', mythic: 'Mythic',
};

export const SLOTS = ['weapon', 'helm', 'armor', 'ring', 'relic'];
export const INVENTORY_SIZE = 24;
export const MAX_LEVEL = 20;
export const ABILITY3_LEVEL = 5;

export const SAVE_KEY = 'aetherbound.save.v2';
export const SAVE_VERSION = 2;
