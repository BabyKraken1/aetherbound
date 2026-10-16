# Aetherbound: Shards of the Riftlands

A pixel-art action RPG for the browser, inspired by the feel of Pixel Quest, Realm of the Mad God and Darza's Dominion. All names, art, enemies, bosses and items are original.

**Play it:** https://babykraken1.github.io/aetherbound/

It's an open world. Emberlight Haven sits in the middle, and the land gets more dangerous the farther you travel: Mossveil Wilds, then Cinder Depths, Prism Hollow, and finally Frostspire Peaks. Enemies roam each biome. Any kill can open a temporary dungeon portal, and each biome has a mini-boss lair. Dungeons lead to the four bosses: Bramblemaw, Kragmor, Lumen and Glacius.

## Controls

| Key | Action |
| --- | --- |
| W A S D / arrows | Move |
| Mouse | Aim |
| Left click (hold) | Attack |
| Q / right click | Ability 1 |
| E | Ability 2 |
| R | Ability 3 (unlocks at level 5) |
| Space / Shift | Dodge roll (invulnerable while rolling) |
| F | Interact (portals, chests, NPCs, shrines) |
| 1 / 2 | Health / mana potion |
| I / Tab | Inventory (double-click an item to equip or use it) |
| Click a hotbar slot | Equip that item or drink that potion |
| K | Item Index (Legendaries; Mythics show as ? until found) |
| \` (backtick) | Admin panel: give any item, spawn any boss, cheats |
| M | Toggle minimap |
| Esc | Pause / close menus |

## What's in it

- **Open world:** a 232×232-tile map with four biome rings, roads out of town, lakes, lava rivers, rift cracks and frozen forests. Enemy packs spawn around you according to the biome you're in.
- **Mini-bosses:** Old Gnarl, Pyrewing, Geode Tyrant and Rimefang guard lairs (red dots on the minimap). Each drops its own Legendary and Mythic, and each respawns 2 minutes after it dies.
- **Dungeon portals:** any kill can open one (elites and mini-bosses more often), and it lasts 60 seconds. Heroic portals appear once Heroic mode is unlocked. Leaving a dungeon puts you back where you entered.
- **Drop pop-ups:** Legendary and Mythic drops get a big announcement. Mythics also flash the screen.
- **Rarer loot:** Legendaries and Mythics are rare. Mythics can drop from any boss in normal mode, and Heroic dungeons raise every chance. Bad-luck protection still guarantees a boss's legendary eventually.
- **Item Index (K):** tracks every Legendary and Mythic you've found.
- **Skins:** 4 per class. They unlock by leveling, beating bosses, defeating every mini-boss, finding a Mythic, discovering Legendaries, or buying them. Change skins in the Wardrobe (pause menu or class shrine).
- **Hotbar:** the bottom bar shows your equipped gear and the first 8 bag slots, with small ability cooldown icons above it.
- **Admin panel:** press \` to give yourself any item, spawn any boss or mini-boss, or toggle god mode.

- **4 classes**, each with its own weapon type, 3 abilities and separate level (max 20):
  - **Vanguard:** sword arcs, barrier, whirlwind, leap slam
  - **Arcanist:** bolts, frost nova, arcane orb, blink
  - **Ranger:** rapid arrows, volley, root traps, tumble
  - **Warden:** homing wisps, orbiting ward orbs, spirit wolf, healing sanctuary. Unlocked by beating the first boss.
- **Hub town:** a vendor (buys and sells, with stock that refreshes after each expedition), training dummies with a DPS readout, a class shrine, a notice board with your progress and tips, and region portals.
- **3 regions**, each with its own tiles, lighting, music, hazards and enemy variants:
  - **Mossveil Wilds:** thorn patches
  - **Cinder Depths:** lava; enemies leave fire when they die
  - **Prism Hollow:** darkness and rift cracks; shardlings explode into shards
- **Procedural dungeons**, built from room types: combat rooms that seal their doors until cleared, an elite Warlord room, a treasure room, a healing spring, an optional 3-wave trial, a secret room behind a breakable cracked wall, and the boss arena. The layout is regenerated every run and checked for connectivity.
- **8 enemy behaviors:** chaser, shooter, flanker, armored brute, lobber, summoner, turret and charger. There are also summoned minions, elite variants and Warlord mini-bosses. Every attack is telegraphed: enemies flash before attacking, and red markers show where ground attacks will land.
- **4 bosses**, each with 2 phases. Glacius (Frostspire Peaks) is the newest: walls of ice sweep the arena, leaving one safe gap, an intro, a death sequence and a signature move:
  - **Bramblemaw:** Root Eruption, and thorn rings with a moving safe gap
  - **Kragmor:** molten charges that leave lava rivers
  - **Lumen:** rotating prism beams and mirror clones
- **50+ items** across 6 rarities (Common to Mythic): weapons, helms, armor, rings, relics that change abilities, and consumables. Special effects include piercing, splitting shots, ignite, frost, marks, lifesteal on crit, thorns, barriers and fire trails. Items have a quality roll, and the inventory shows a stat comparison before you equip.
- **Progression:** XP and levels, region unlocks, a class unlock, and Heroic mode after beating the final boss. Heroic means tougher enemies, better loot and Mythic drops. Bosses always drop their signature legendary on the first kill, and a pity counter guarantees one later.
- **Quality of life:** saves automatically to your browser, with validation and repair of broken saves. Includes volume, screen shake and damage-number settings, plus a pause menu, tutorial, minimap and objective tracker.

## Running locally

It's plain JavaScript modules with no build step and no dependencies. Serve the folder over HTTP, because ES modules don't load from `file://`:

```
python3 -m http.server 8000
# then open http://localhost:8000
```

## Tests

```
node tests/run.mjs
```

The tests cover damage math, stats and leveling, inventory operations, loot tables and pity, save validation (including corrupted saves), connectivity of 1,500 generated dungeons, and hub reachability.

`tests/bot.js` is an in-browser playtest bot. It runs whole dungeons automatically:

```js
const b = await import('/tests/bot.js'); b.startAim(true); b.runDungeon(0);
```

## Code layout

```
src/
  main.js            entry point
  game.js            state machine, rooms, combat callbacks, camera, rendering
  config.js util.js input.js audio.js
  content/           data: classes, items, enemies, bosses (+ attack patterns), regions
  systems/           pure logic: stats, damage, inventory, loot, save, combat, abilities
  entities/          player, enemy AI, boss runner, projectiles (pooled), hazards, fx, pickups, allies
  world/             tilemap + collision, dungeon generator, hub
  render/            procedural pixel-art sprites and tilesets
  ui/                HUD, menus, inventory/vendor screens
```

To add an enemy, add an archetype in `content/enemies.js` and a painter in `render/sprites.js`. To add an item, add it to `content/items.js`. To add a boss, add its data and generator-based patterns in `content/bosses.js`.

## Known limitations

- Single player only. There is no fake multiplayer. Online co-op would need a server; the entity and combat systems are kept separate so they could be driven by a network layer later.
- No gamepad support yet. Keyboard and mouse only.
- No puzzle rooms yet.
- Sound effects and music are synthesized in the browser (Web Audio). There are no recorded audio files.
