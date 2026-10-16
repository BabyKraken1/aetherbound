// Pure damage formulas (unit tested).

export const CRIT_MULT = 1.75;
export const MIN_DAMAGE_FRACTION = 0.15;

// Defense subtracts flat damage, but at least 15% of the hit always gets through.
export function applyDefense(raw, def) {
  const reduced = raw - Math.max(0, def);
  const floor = raw * MIN_DAMAGE_FRACTION;
  return Math.max(1, Math.round(Math.max(reduced, floor)));
}

// Roll an outgoing player hit. rng: () => [0,1)
export function rollPlayerHit(weapon, stats, rng, extra = {}) {
  const [lo, hi] = weapon.dmg;
  let dmg = lo + (hi - lo) * rng();
  let mult = stats.dmgMult;
  if (extra.lastStand) mult += 0.4;
  dmg *= mult;
  const crit = rng() < stats.crit;
  if (crit) dmg *= CRIT_MULT;
  return { dmg: Math.round(dmg), crit };
}

// Damage an enemy takes from a hit, including the mark bonus.
export function damageToEnemy(raw, enemyDef, marked) {
  const amt = marked ? raw * 1.3 : raw;
  return applyDefense(amt, enemyDef);
}

// Ability damage scales with ability power (AP).
export function abilityDamage(base, stats) {
  return Math.round((base + stats.ap * 0.8) * stats.dmgMult);
}
