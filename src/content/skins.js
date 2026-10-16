import { getBase } from './items.js';

// Character skins: palette overrides for the hero sprites, each unlocked a different way.
// unlock types: level | boss | kills | mythic | legendaries | buy | allMinis

export const SKINS = {
  vanguard: [
    { id: 'default', name: 'Crimson Knight' },
    { id: 'gilded', name: 'Gilded Paladin', unlock: { type: 'level', level: 10 },
      pal: { body: '#e8b84a', bodyD: '#a8782a', helm: '#fff3c9', helmL: '#ffffff', helmD: '#c9a35a', plume: '#ffffff', trim: '#ffffff', arm: '#e8b84a' } },
    { id: 'obsidian', name: 'Obsidian Knight', unlock: { type: 'boss', boss: 'kragmor' },
      pal: { body: '#3a2a36', bodyD: '#1e1416', helm: '#4a3a46', helmL: '#6b5a6a', helmD: '#2a1e26', plume: '#ff7a1a', trim: '#ff7a1a', visor: '#ff7a1a', arm: '#4a3a46' } },
    { id: 'frostguard', name: 'Frostguard', unlock: { type: 'boss', boss: 'glacius' },
      pal: { body: '#6fa8d8', bodyD: '#3f6f98', helm: '#e8f6ff', helmL: '#ffffff', helmD: '#9fc0dd', plume: '#7ae0ff', trim: '#bfe9ff', arm: '#bfe9ff' } },
  ],
  arcanist: [
    { id: 'default', name: 'Blue Mage' },
    { id: 'ember', name: 'Ember Sage', unlock: { type: 'kills', kills: 300 },
      pal: { body: '#d8502a', bodyD: '#8a2a1a', hat: '#a8321e', trim: '#ffd36b', arm: '#d8502a', leg: '#8a2a1a', beard: '#c9c9c9' } },
    { id: 'starlit', name: 'Starlit Seer', unlock: { type: 'mythic' },
      pal: { body: '#2a2357', bodyD: '#16123a', hat: '#1e1a45', trim: '#ff7ae6', arm: '#2a2357', leg: '#16123a', beard: '#efe6ff' } },
    { id: 'crystal', name: 'Crystal Magus', unlock: { type: 'boss', boss: 'lumen' },
      pal: { body: '#7ae0ff', bodyD: '#4f7bd8', hat: '#b46cff', trim: '#ffffff', arm: '#7ae0ff', leg: '#4f7bd8' } },
  ],
  ranger: [
    { id: 'default', name: 'Greenwood' },
    { id: 'shadow', name: 'Shadowstalker', unlock: { type: 'level', level: 10 },
      pal: { body: '#3a3546', bodyD: '#221e2b', hood: '#2a2633', hoodD: '#16131c', cape: '#16131c', trim: '#b46cff', arm: '#3a3546', leg: '#221e2b' } },
    { id: 'autumn', name: 'Autumn Hunter', unlock: { type: 'buy', price: 1500 },
      pal: { body: '#c9853a', bodyD: '#8a5a26', hood: '#a8321e', hoodD: '#7a2216', cape: '#7a2216', trim: '#ffd36b', arm: '#c9853a' } },
    { id: 'snow', name: 'Snow Ranger', unlock: { type: 'boss', boss: 'rimefang' },
      pal: { body: '#e8f0f8', bodyD: '#a8bccd', hood: '#ffffff', hoodD: '#c9d6e2', cape: '#8fb6d8', trim: '#7ae0ff', arm: '#e8f0f8', leg: '#8fa3b8' } },
  ],
  warden: [
    { id: 'default', name: 'Spirit Mask' },
    { id: 'bone', name: 'Bone Oracle', unlock: { type: 'level', level: 10 },
      pal: { body: '#5a4a3a', bodyD: '#3a2e24', hood: '#2a2018', mask: '#f2e6c9', horn: '#ffffff', glow: '#ff4f5e', trim: '#ff4f5e', arm: '#5a4a3a', leg: '#3a2e24' } },
    { id: 'sun', name: 'Sunmask', unlock: { type: 'legendaries', count: 6 },
      pal: { body: '#e8a92a', bodyD: '#b97a14', hood: '#8a5a1a', mask: '#fff3b0', horn: '#ffd36b', glow: '#ffffff', trim: '#ffffff', arm: '#e8a92a', leg: '#b97a14' } },
    { id: 'void', name: 'Void Warden', unlock: { type: 'allMinis' },
      pal: { body: '#16123a', bodyD: '#0a0820', hood: '#0a0820', mask: '#2a2357', horn: '#b46cff', glow: '#ff7ae6', trim: '#ff7ae6', arm: '#16123a', leg: '#0a0820' } },
  ],
};

const MINI_IDS = ['gnarl', 'pyrewing', 'geode', 'rimefang'];
const NAMES = { kragmor: 'Kragmor', lumen: 'Lumen', glacius: 'Glacius', rimefang: 'Rimefang', bramblemaw: 'Bramblemaw' };

export function skinUnlocked(save, cls, skin) {
  const u = skin.unlock;
  if (!u) return true;
  if ((save.skinsOwned || []).includes(`${cls}:${skin.id}`)) return true;
  switch (u.type) {
    case 'level': return save.classes[cls].level >= u.level;
    case 'boss': return save.bossesDefeated.includes(u.boss) || (save.minibossesDefeated || []).includes(u.boss);
    case 'kills': return save.stats.kills >= u.kills;
    case 'mythic': return (save.discovered || []).some((id) => isMythic(id));
    case 'legendaries': return (save.discovered || []).filter((id) => isLegendary(id)).length >= u.count;
    case 'allMinis': return MINI_IDS.every((m) => (save.minibossesDefeated || []).includes(m));
    case 'buy': return false;
  }
  return false;
}

export function unlockText(cls, skin) {
  const u = skin.unlock;
  if (!u) return 'Default';
  switch (u.type) {
    case 'level': return `Reach level ${u.level} as this class`;
    case 'boss': return `Defeat ${NAMES[u.boss] || u.boss}`;
    case 'kills': return `Defeat ${u.kills} enemies`;
    case 'mythic': return 'Find any Mythic item';
    case 'legendaries': return `Discover ${u.count} Legendaries`;
    case 'allMinis': return 'Defeat all 4 open-world mini-bosses';
    case 'buy': return `Buy for ${u.price} gold`;
  }
  return '';
}

const isMythic = (id) => getBase(id)?.rarity === 'mythic';
const isLegendary = (id) => getBase(id)?.rarity === 'legendary';

export function skinSpriteName(cls, skinId) {
  return !skinId || skinId === 'default' ? 'hero_' + cls : `hero_${cls}_${skinId}`;
}
