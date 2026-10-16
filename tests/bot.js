// Browser playtest bot (load from the console: await import('/tests/bot.js')).
// Runs a whole dungeon automatically: walks room to room, auto-aims, and reports progress in
// window.__status. With god=true the player cannot die, so it tests flow rather than difficulty.
const g = window.__game;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
window.__errs = window.__errs || [];
window.addEventListener('error', (e) => window.__errs.push(e.message));

export function startAim(god = true) {
  clearInterval(window.__aim);
  window.__aim = setInterval(() => {
    const pl = g.player;
    if (!pl || pl.dead || g.mode !== 'play') return;
    if (god) { pl.iframes = 0.3; pl.hp = pl.stats.maxHp; }
    let best = null, bd = 1e9;
    for (const e of g.enemies) {
      if (e.dead || e.spawning || e.isDummy || e.invuln) continue;
      const d = Math.hypot(e.x - pl.x, e.y - pl.y);
      if (d < bd) { bd = d; best = e; }
    }
    if (best) {
      g.input.mouse.x = best.x - g.cam.x;
      g.input.mouse.y = (best.cy ?? best.y) - g.cam.y;
      g.input.mouse.left = true;
      if (bd > 110) { pl.x += (best.x - pl.x) * 0.04; pl.y += (best.y - pl.y) * 0.04; }
    } else g.input.mouse.left = false;
  }, 30);
}

export async function runDungeon(i, heroic = false) {
  g.closeOverlay();
  g.enterDungeon(i, heroic);
  const d = g.dungeon;
  const order = [...d.rooms].sort((a, b) => (a.type === 'boss') - (b.type === 'boss'));
  for (const r of order) {
    if (r.type === 'secret') continue;
    g.player.x = r.centerX * 16; g.player.y = r.centerY * 16 + (r.type === 'boss' ? 40 : 0);
    g.snapCamera();
    await sleep(300);
    if (r.type === 'trial') g.startTrial(r);
    let t = 0;
    while ((r.locked || g.cinematic || g.boss) && t < 240) {
      await sleep(500); t += 0.5;
      window.__status = `${d.region.id} ${r.type} t=${t}${g.boss ? ` boss ${Math.round(g.boss.hp)}/${g.boss.maxHp} p${g.boss.phase}` : ''}`;
    }
    if (r.locked) { window.__status = `STUCK in ${r.type}`; return; }
  }
  for (const p of [...g.pickups]) { g.player.x = p.x; g.player.y = p.y; await sleep(80); }
  window.__status = `done ${d.region.id} bossDown=${g.run.bossDown} kills=${g.run.kills}`;
}
