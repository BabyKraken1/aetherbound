// Every item in the game. Items are pure data; systems/stats.js and systems/combat.js read them.
//
// weapon.kind: 'melee' (arc swing) or 'proj' (projectiles)
// stats keys: hp, mp, def, spd, crit, ap, cdr, hpRegen, mpRegen, dmgPct, rate
// effects: see EFFECT_TEXT below; each one is implemented in systems/combat.js or entities/player.js

export const EFFECT_TEXT = {
  pierce: 'Shots pierce through enemies',
  split: 'Shots split into 3 shards on hit',
  ignite: 'Hits set enemies on fire',
  wave: 'Swings release a piercing shockwave',
  homing: 'Shots seek nearby enemies',
  emberTrail: 'Dodging leaves a trail of fire',
  mark: 'Every 4th hit marks an enemy: marked enemies take +30% damage',
  lifebloom: 'Critical hits heal you for 3% max HP',
  thorns: 'Enemies that touch you take 25 damage',
  aegis: 'Using an ability grants a 25 HP barrier',
  frost: 'Hits slow enemies',
  lastStand: 'Below 30% HP: +40% damage',
};

const W = (o) => ({ slot: 'weapon', ...o });

export const ITEMS = [
  // ───── Vanguard swords ─────
  W({ id: 'rusty_sword', name: 'Rusty Longsword', cls: 'vanguard', rarity: 'common', region: 0, value: 5,
    weapon: { kind: 'melee', dmg: [20, 28], rate: 2.2, range: 28, arc: 1.8, style: 'steel' },
    desc: 'Dull, heavy, dependable.' }),
  W({ id: 'moss_cleaver', name: 'Verdant Cleaver', cls: 'vanguard', rarity: 'uncommon', region: 0, value: 20,
    weapon: { kind: 'melee', dmg: [28, 38], rate: 2.3, range: 31, arc: 2.0, style: 'moss' },
    stats: { hpRegen: 1 }, desc: 'Moss still grows along the blade.' }),
  W({ id: 'emberbrand', name: 'Emberbrand', cls: 'vanguard', rarity: 'rare', region: 1, value: 60,
    weapon: { kind: 'melee', dmg: [44, 58], rate: 2.3, range: 31, arc: 1.9, style: 'fire' },
    effects: ['ignite'], desc: 'Forged in the throat of a wyrm.' }),
  W({ id: 'prismedge', name: 'Prismedge', cls: 'vanguard', rarity: 'epic', region: 2, value: 120,
    weapon: { kind: 'melee', dmg: [62, 80], rate: 2.5, range: 36, arc: 2.6, style: 'crystal' },
    stats: { crit: 0.05 }, desc: 'A wide, singing arc of light.' }),
  W({ id: 'kingsfall', name: 'Kingsfall', cls: 'vanguard', rarity: 'legendary', region: 0, boss: 'bramblemaw', value: 200,
    weapon: { kind: 'melee', dmg: [50, 66], rate: 2.4, range: 32, arc: 2.0, style: 'gold' },
    effects: ['wave'], desc: 'It toppled the Rooted King. It will topple more.' }),

  // ───── Arcanist staves ─────
  W({ id: 'apprentice_staff', name: 'Apprentice Staff', cls: 'arcanist', rarity: 'common', region: 0, value: 5,
    weapon: { kind: 'proj', dmg: [13, 19], rate: 2.6, range: 150, speed: 230, shots: 1, size: 3, style: 'arcane' },
    desc: 'Still warm from the academy.' }),
  W({ id: 'thornwood_staff', name: 'Thornwood Staff', cls: 'arcanist', rarity: 'uncommon', region: 0, value: 20,
    weapon: { kind: 'proj', dmg: [16, 22], rate: 2.6, range: 150, speed: 230, shots: 1, size: 3, style: 'nature' },
    effects: ['split'], desc: 'Bolts burst into thorns.' }),
  W({ id: 'cinder_rod', name: 'Cinder Rod', cls: 'arcanist', rarity: 'rare', region: 1, value: 60,
    weapon: { kind: 'proj', dmg: [38, 50], rate: 1.8, range: 165, speed: 200, shots: 1, size: 5, style: 'fire' },
    effects: ['ignite'], desc: 'Slow, heavy fireballs.' }),
  W({ id: 'prism_scepter', name: 'Prism Scepter', cls: 'arcanist', rarity: 'epic', region: 2, value: 120,
    weapon: { kind: 'proj', dmg: [34, 44], rate: 2.8, range: 170, speed: 260, shots: 2, spread: 0.12, size: 3, pierce: 2, style: 'crystal' },
    effects: ['pierce'], desc: 'Twin beams of refracted light.' }),
  W({ id: 'heartwood_staff', name: 'Heartwood of the King', cls: 'arcanist', rarity: 'legendary', region: 0, boss: 'bramblemaw', value: 200,
    weapon: { kind: 'proj', dmg: [24, 32], rate: 2.8, range: 160, speed: 240, shots: 3, spread: 0.18, size: 3, style: 'nature' },
    effects: ['frost'], desc: 'Carved from Bramblemaw\'s core. Its bolts chill.' }),

  // ───── Ranger bows ─────
  W({ id: 'shortbow', name: 'Hunter\'s Shortbow', cls: 'ranger', rarity: 'common', region: 0, value: 5,
    weapon: { kind: 'proj', dmg: [9, 13], rate: 4, range: 190, speed: 320, shots: 1, size: 2, style: 'arrow' },
    desc: 'Light and quick.' }),
  W({ id: 'mossweave_bow', name: 'Mossweave Bow', cls: 'ranger', rarity: 'uncommon', region: 0, value: 20,
    weapon: { kind: 'proj', dmg: [8, 11], rate: 3.6, range: 170, speed: 300, shots: 3, spread: 0.16, size: 2, style: 'arrow' },
    desc: 'Three arrows, one draw.' }),
  W({ id: 'kragfang', name: 'Kragfang Longbow', cls: 'ranger', rarity: 'rare', region: 1, value: 60,
    weapon: { kind: 'proj', dmg: [44, 58], rate: 2.2, range: 230, speed: 380, shots: 1, size: 2, pierce: 3, style: 'firearrow' },
    effects: ['pierce'], desc: 'Strung with wyrm sinew.' }),
  W({ id: 'shardshot', name: 'Shardshot', cls: 'ranger', rarity: 'epic', region: 2, value: 120,
    weapon: { kind: 'proj', dmg: [28, 36], rate: 4.2, range: 200, speed: 340, shots: 1, size: 2, style: 'crystalarrow' },
    effects: ['split', 'mark'], desc: 'Arrows shatter on impact.' }),
  W({ id: 'wyrmstring', name: 'Wyrmstring', cls: 'ranger', rarity: 'legendary', region: 1, boss: 'kragmor', value: 220,
    weapon: { kind: 'proj', dmg: [30, 40], rate: 4.2, range: 210, speed: 350, shots: 2, spread: 0.08, size: 2, pierce: 1, style: 'firearrow' },
    effects: ['ignite', 'pierce'], desc: 'Each arrow burns with Kragmor\'s heat.' }),

  // ───── Warden lanterns ─────
  W({ id: 'spirit_lantern', name: 'Spirit Lantern', cls: 'warden', rarity: 'common', region: 0, value: 5,
    weapon: { kind: 'proj', dmg: [11, 15], rate: 2.8, range: 135, speed: 170, shots: 1, size: 3, homing: 2.4, style: 'spirit' },
    effects: ['homing'], desc: 'Wisps drift toward the nearest foe.' }),
  W({ id: 'willow_censer', name: 'Willow Censer', cls: 'warden', rarity: 'uncommon', region: 0, value: 20,
    weapon: { kind: 'proj', dmg: [10, 14], rate: 2.8, range: 135, speed: 170, shots: 2, spread: 0.3, size: 3, homing: 2.8, style: 'spirit' },
    effects: ['homing'], desc: 'Two wisps, twice the haunting.' }),
  W({ id: 'ember_censer', name: 'Ember Censer', cls: 'warden', rarity: 'rare', region: 1, value: 60,
    weapon: { kind: 'proj', dmg: [30, 40], rate: 2.6, range: 145, speed: 180, shots: 1, size: 4, homing: 2.6, style: 'fire' },
    effects: ['homing', 'ignite'], desc: 'Spirits of the forge.' }),
  W({ id: 'lumen_lantern', name: 'Lumen Lantern', cls: 'warden', rarity: 'epic', region: 2, value: 120,
    weapon: { kind: 'proj', dmg: [26, 34], rate: 3.0, range: 150, speed: 190, shots: 2, spread: 0.25, size: 3, homing: 3, pierce: 1, style: 'crystal' },
    effects: ['homing', 'pierce'], desc: 'Light that refuses to be lost.' }),
  W({ id: 'shattered_lamp', name: 'The Shattered Lamp', cls: 'warden', rarity: 'legendary', region: 2, boss: 'lumen', value: 260,
    weapon: { kind: 'proj', dmg: [36, 46], rate: 3.0, range: 160, speed: 200, shots: 3, spread: 0.3, size: 3, homing: 3.2, style: 'crystal' },
    effects: ['homing', 'split'], desc: 'Holds a sliver of Lumen\'s light.' }),

  // ───── Helms ─────
  { id: 'leather_cap', slot: 'helm', name: 'Leather Cap', rarity: 'common', region: 0, value: 4, stats: { hp: 10, def: 1 }, desc: 'Better than nothing.' },
  { id: 'iron_helm', slot: 'helm', name: 'Iron Helm', rarity: 'uncommon', region: 0, value: 16, stats: { hp: 20, def: 3, spd: -4 }, desc: 'Heavy, but it holds.' },
  { id: 'seers_circlet', slot: 'helm', name: 'Seer\'s Circlet', rarity: 'rare', region: 1, value: 50, stats: { mp: 30, cdr: 0.15, ap: 10 }, desc: 'Abilities come back faster.' },
  { id: 'wyrmhorn_helm', slot: 'helm', name: 'Wyrmhorn Helm', rarity: 'legendary', region: 1, boss: 'kragmor', value: 200, stats: { hp: 60, def: 6, dmgPct: 0.12 }, desc: 'Kragmor\'s horns, still smoldering.' },
  { id: 'prism_crown', slot: 'helm', name: 'Prism Crown', rarity: 'epic', region: 2, value: 110, stats: { hp: 40, mp: 40, crit: 0.08, ap: 15 }, desc: 'Refracts thought into power.' },

  // ───── Armor ─────
  { id: 'padded_tunic', slot: 'armor', name: 'Padded Tunic', rarity: 'common', region: 0, value: 4, stats: { hp: 15, def: 2 }, desc: 'Quilted wool.' },
  { id: 'mossguard_vest', slot: 'armor', name: 'Mossguard Vest', rarity: 'uncommon', region: 0, value: 18, stats: { hp: 30, def: 3, hpRegen: 2 }, desc: 'The moss heals what it covers.' },
  { id: 'cinderplate', slot: 'armor', name: 'Cinderplate', rarity: 'rare', region: 1, value: 55, stats: { hp: 60, def: 9, spd: -10 }, desc: 'Nearly impervious. Nearly immobile.' },
  { id: 'shardweave_robe', slot: 'armor', name: 'Shardweave Robe', rarity: 'epic', region: 2, value: 110, stats: { hp: 30, mp: 60, ap: 25, mpRegen: 3, def: 2 }, desc: 'Woven from humming crystal thread.' },
  { id: 'duskrunner_garb', slot: 'armor', name: 'Duskrunner Garb', rarity: 'rare', region: 1, value: 55, stats: { hp: 25, def: 3, spd: 14, crit: 0.05 }, desc: 'Light leather for quick feet.' },

  // ───── Rings ─────
  { id: 'ring_vigor', slot: 'ring', name: 'Ring of Vigor', rarity: 'uncommon', region: 0, value: 18, stats: { hp: 35 }, desc: 'A steady, warm pulse.' },
  { id: 'ring_haste', slot: 'ring', name: 'Ring of Haste', rarity: 'uncommon', region: 0, value: 18, stats: { spd: 14, rate: 0.08 }, desc: 'Your feet feel lighter.' },
  { id: 'band_fury', slot: 'ring', name: 'Band of Fury', rarity: 'rare', region: 1, value: 50, stats: { crit: 0.12, dmgPct: 0.05 }, desc: 'It bites back.' },
  { id: 'glass_heart', slot: 'ring', name: 'Glass Heart', rarity: 'epic', region: 2, value: 100, stats: { dmgPct: 0.3, hp: -50 }, desc: 'Hit harder. Break easier.' },
  { id: 'lifebloom_ring', slot: 'ring', name: 'Lifebloom Ring', rarity: 'rare', region: 0, value: 50, stats: { crit: 0.06 }, effects: ['lifebloom'], desc: 'Each perfect strike blossoms.' },
  { id: 'thorn_ring', slot: 'ring', name: 'Bramble Loop', rarity: 'rare', region: 0, value: 45, stats: { def: 3 }, effects: ['thorns'], desc: 'Touch me and regret it.' },

  // ───── Relics (ability modifiers) ─────
  { id: 'whirling_crest', slot: 'relic', cls: 'vanguard', name: 'Whirling Crest', rarity: 'rare', region: 0, value: 50,
    stats: { hp: 20 }, mods: { whirlwind: { duration: 0.8 }, bulwark: { absorb: 30 } }, desc: 'Whirlwind lasts longer, Bulwark absorbs more.' },
  { id: 'prism_lens', slot: 'relic', cls: 'arcanist', name: 'Prism Lens', rarity: 'rare', region: 0, value: 50,
    stats: { ap: 10 }, mods: { frostNova: { radius: 24 }, arcaneOrb: { size: 3 } }, desc: 'Frost Nova and Arcane Orb grow larger.' },
  { id: 'hunters_quiver', slot: 'relic', cls: 'ranger', name: 'Hunter\'s Quiver', rarity: 'rare', region: 0, value: 50,
    stats: { crit: 0.04 }, mods: { volley: { arrows: 4 }, snareTrap: { max: 2 } }, desc: 'Volley fires 4 more arrows. +2 traps.' },
  { id: 'spirit_bell', slot: 'relic', cls: 'warden', name: 'Spirit Bell', rarity: 'rare', region: 0, value: 50,
    stats: { mp: 20 }, mods: { spiritWard: { orbs: 2 }, spiritWolf: { duration: 4 } }, desc: 'Two more ward orbs. Wolves stay longer.' },
  { id: 'ember_treads', slot: 'relic', name: 'Ember Treads', rarity: 'epic', region: 1, value: 90,
    stats: { spd: 6 }, effects: ['emberTrail'], desc: 'Every dodge leaves burning footprints.' },
  { id: 'hunters_sigil', slot: 'relic', name: 'Hunter\'s Sigil', rarity: 'epic', region: 1, value: 90,
    stats: {}, effects: ['mark'], desc: 'Mark your prey.' },
  { id: 'aegis_shard', slot: 'relic', name: 'Aegis Shard', rarity: 'rare', region: 0, value: 50,
    stats: { def: 2 }, effects: ['aegis'], desc: 'Casting wraps you in light.' },
  { id: 'last_stand', slot: 'relic', name: 'Banner of the Last Stand', rarity: 'legendary', region: 2, boss: 'lumen', value: 220,
    stats: { hp: 40, def: 4 }, effects: ['lastStand'], desc: 'Fight hardest when it matters most.' },

  // ───── Mythic chase items (boss only, very rare) ─────
  { id: 'riftheart', slot: 'ring', name: 'Riftheart', rarity: 'mythic', region: 2, boss: 'any', mythic: true, value: 500,
    stats: { hp: 50, mp: 50, dmgPct: 0.2, crit: 0.1, cdr: 0.1 }, effects: ['lifebloom'], desc: 'A heartbeat from beyond the Rift.' },
  { id: 'crown_of_vael', slot: 'helm', name: 'Crown of Vael', rarity: 'mythic', region: 2, boss: 'any', mythic: true, value: 500,
    stats: { hp: 80, def: 8, ap: 30, cdr: 0.15 }, effects: ['aegis'], desc: 'Worn by the last queen of the unbroken world.' },
  { id: 'starforged_mail', slot: 'armor', name: 'Starforged Mail', rarity: 'mythic', region: 2, boss: 'any', mythic: true, value: 500,
    stats: { hp: 120, def: 14, spd: 8 }, effects: ['thorns'], desc: 'It fell from the sky the night the realm shattered.' },

  // ───── Frostspire Peaks gear ─────
  W({ id: 'frostbite_greatsword', name: 'Frostbite Greatsword', cls: 'vanguard', rarity: 'epic', region: 3, value: 160,
    weapon: { kind: 'melee', dmg: [86, 110], rate: 2.3, range: 37, arc: 2.5, style: 'ice' },
    effects: ['frost'], desc: 'Every swing leaves a rime of frost.' }),
  W({ id: 'rime_staff', name: 'Rimecaller Staff', cls: 'arcanist', rarity: 'epic', region: 3, value: 160,
    weapon: { kind: 'proj', dmg: [52, 66], rate: 2.8, range: 175, speed: 250, shots: 2, spread: 0.1, size: 3, pierce: 2, style: 'ice' },
    effects: ['frost', 'pierce'], desc: 'Bolts of living winter.' }),
  W({ id: 'hailstorm_bow', name: 'Hailstorm Bow', cls: 'ranger', rarity: 'epic', region: 3, value: 160,
    weapon: { kind: 'proj', dmg: [26, 34], rate: 4, range: 200, speed: 340, shots: 4, spread: 0.1, size: 2, style: 'icearrow' },
    effects: ['frost'], desc: 'Four arrows of hail per draw.' }),
  W({ id: 'aurora_lantern', name: 'Aurora Lantern', cls: 'warden', rarity: 'epic', region: 3, value: 160,
    weapon: { kind: 'proj', dmg: [40, 52], rate: 3, range: 155, speed: 200, shots: 2, spread: 0.3, size: 3, homing: 3.2, pierce: 1, style: 'ice' },
    effects: ['homing', 'pierce'], desc: 'The northern lights, kept in a jar.' }),
  { id: 'frostfang_hood', slot: 'helm', name: 'Frostfang Hood', rarity: 'epic', region: 3, value: 150, stats: { hp: 70, def: 6, crit: 0.06 }, desc: 'Lined with Rimefang fur.' },
  { id: 'glacier_plate', slot: 'armor', name: 'Glacier Plate', rarity: 'epic', region: 3, value: 150, stats: { hp: 110, def: 13, spd: -6 }, desc: 'Carved from a single ancient iceberg.' },
  { id: 'band_of_winter', slot: 'ring', name: 'Band of Winter', rarity: 'epic', region: 3, value: 140, stats: { hp: 40, crit: 0.08, cdr: 0.08 }, desc: 'Cold enough to slow time.' },

  // ───── Glacius (Frostspire boss) ─────
  { id: 'heart_of_winter', slot: 'relic', name: 'Heart of Winter', rarity: 'legendary', region: 3, boss: 'glacius', value: 320,
    stats: { hp: 60, dmgPct: 0.15 }, effects: ['frost', 'aegis'], desc: 'It still sings, very quietly.' },
  { id: 'choir_crown', slot: 'helm', name: 'Crown of the Frozen Choir', rarity: 'legendary', region: 3, boss: 'glacius', value: 320,
    stats: { hp: 80, mp: 60, ap: 35, cdr: 0.12 }, desc: 'Each icicle is a different note.' },

  // ───── Open-world mini-boss drops ─────
  { id: 'gnarlroot_ring', slot: 'ring', name: 'Gnarlroot Ring', rarity: 'legendary', region: 0, boss: 'gnarl', value: 180,
    stats: { hp: 45, hpRegen: 4, def: 3 }, effects: ['thorns'], desc: 'Old Gnarl\'s root, still growing.' },
  { id: 'seed_of_eternity', slot: 'relic', name: 'Seed of Eternity', rarity: 'mythic', region: 0, boss: 'gnarl', mythic: true, value: 500,
    stats: { hp: 90, hpRegen: 8, crit: 0.1 }, effects: ['lifebloom', 'thorns'], desc: 'The first seed of the first forest.' },
  { id: 'pyrewing_cloak', slot: 'armor', name: 'Pyrewing Cloak', rarity: 'legendary', region: 1, boss: 'pyrewing', value: 220,
    stats: { hp: 50, def: 5, spd: 16 }, effects: ['emberTrail'], desc: 'Feathers that never stop smoldering.' },
  { id: 'phoenix_heart', slot: 'ring', name: 'Phoenix Heart', rarity: 'mythic', region: 1, boss: 'pyrewing', mythic: true, value: 500,
    stats: { hp: 70, dmgPct: 0.25, hpRegen: 5 }, effects: ['ignite', 'lifebloom'], desc: 'Burns forever and is never used up.' },
  { id: 'geode_crown', slot: 'helm', name: 'Geode Crown', rarity: 'legendary', region: 2, boss: 'geode', value: 260,
    stats: { hp: 60, def: 8, ap: 25 }, desc: 'Cracked open, full of light.' },
  { id: 'prismatic_core', slot: 'relic', name: 'Prismatic Core', rarity: 'mythic', region: 2, boss: 'geode', mythic: true, value: 500,
    stats: { crit: 0.15, dmgPct: 0.2 }, effects: ['split', 'mark'], desc: 'Every hit refracts into more hits.' },
  { id: 'rimefang_amulet', slot: 'relic', name: 'Rimefang Amulet', rarity: 'legendary', region: 3, boss: 'rimefang', value: 300,
    stats: { hp: 50, spd: 10, crit: 0.08 }, effects: ['frost', 'mark'], desc: 'A tooth of the alpha, on a silver chain.' },
  { id: 'eternal_winter', slot: 'armor', name: 'Eternal Winter', rarity: 'mythic', region: 3, boss: 'rimefang', mythic: true, value: 600,
    stats: { hp: 160, def: 18, mp: 60 }, effects: ['frost', 'aegis'], desc: 'Wearing it, you are the storm.' },
  { id: 'starfall_blade', slot: 'weapon', cls: 'vanguard', name: 'Starfall', rarity: 'mythic', region: 3, boss: 'any', mythic: true, value: 600,
    weapon: { kind: 'melee', dmg: [120, 150], rate: 2.6, range: 40, arc: 2.6, style: 'gold' }, effects: ['wave', 'ignite'], desc: 'A falling star, given a hilt.' },
  { id: 'voidweaver', slot: 'weapon', cls: 'arcanist', name: 'Voidweaver', rarity: 'mythic', region: 3, boss: 'any', mythic: true, value: 600,
    weapon: { kind: 'proj', dmg: [64, 80], rate: 3.2, range: 190, speed: 270, shots: 3, spread: 0.14, size: 4, pierce: 3, style: 'orb' }, effects: ['pierce', 'split'], desc: 'Stitches holes in the world.' },
  { id: 'windrunner', slot: 'weapon', cls: 'ranger', name: 'Windrunner', rarity: 'mythic', region: 3, boss: 'any', mythic: true, value: 600,
    weapon: { kind: 'proj', dmg: [40, 50], rate: 5.5, range: 230, speed: 400, shots: 2, spread: 0.06, size: 2, pierce: 2, style: 'crystalarrow' }, effects: ['pierce', 'mark'], desc: 'The wind itself, strung on a bow.' },
  { id: 'soulbinder', slot: 'weapon', cls: 'warden', name: 'Soulbinder', rarity: 'mythic', region: 3, boss: 'any', mythic: true, value: 600,
    weapon: { kind: 'proj', dmg: [56, 70], rate: 3.3, range: 170, speed: 220, shots: 3, spread: 0.3, size: 4, homing: 3.6, pierce: 1, style: 'spirit' }, effects: ['homing', 'lifebloom'], desc: 'A lantern of a thousand grateful spirits.' },

  // ───── Consumables ─────
  { id: 'hp_potion', slot: 'consumable', name: 'Health Potion', rarity: 'common', region: 0, value: 3, stack: 9, use: 'heal', price: 12, desc: 'Restores 45% of your max HP. [1]' },
  { id: 'mp_potion', slot: 'consumable', name: 'Mana Potion', rarity: 'common', region: 0, value: 3, stack: 9, use: 'mana', price: 10, desc: 'Restores 60% of your max MP. [2]' },
  { id: 'fury_tonic', slot: 'consumable', name: 'Fury Tonic', rarity: 'uncommon', region: 0, value: 8, stack: 5, use: 'fury', price: 30, desc: '+30% damage for 20 seconds.' },
  { id: 'swift_draught', slot: 'consumable', name: 'Swift Draught', rarity: 'uncommon', region: 0, value: 8, stack: 5, use: 'swift', price: 25, desc: '+25 speed for 20 seconds.' },
  { id: 'return_scroll', slot: 'consumable', name: 'Scroll of Return', rarity: 'uncommon', region: 0, value: 10, stack: 5, use: 'return', price: 35, desc: 'Escape a dungeon and keep your loot.' },
  { id: 'phoenix_feather', slot: 'consumable', name: 'Phoenix Feather', rarity: 'rare', region: 1, value: 30, stack: 3, use: 'passive', price: 120, desc: 'Revives you once at 50% HP when you would die. Works from your bag.' },
];

export const ITEM_BY_ID = Object.fromEntries(ITEMS.map((i) => [i.id, i]));
export const getBase = (id) => ITEM_BY_ID[id];
