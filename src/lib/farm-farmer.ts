// === Multi-Farmer System ===
// 3 farmers, each with 10 main levels + endless stat boosts

export const FARMER_COUNT = 3;
export const FARMER_MAIN_LEVELS = 10;

export const FARMER_COSTS = [3, 5, 10]; // Rebirth token costs

export interface FarmerDef {
  id: number;
  name: string;
  emoji: string;
  cost: number;
}

export const farmerDefs: FarmerDef[] = [
  { id: 0, name: 'Farmer Hans', emoji: '👨‍🌾', cost: 3 },
  { id: 1, name: 'Farmer Greta', emoji: '👩‍🌾', cost: 5 },
  { id: 2, name: 'Farmer Otto', emoji: '🧑‍🌾', cost: 10 },
];

// Main level stats (level 1-10)
export interface FarmerLevelStats {
  slots: number;       // max concurrent grow slots
  timeMult: number;    // time multiplier (lower = faster, min ~1.2)
  harvestMult: number; // harvest value multiplier
  plantsPerCycle: number; // seeds planted per auto-cycle
}

// Each main level gives a meaningful boost
export function getMainLevelStats(level: number): FarmerLevelStats {
  const l = Math.min(level, FARMER_MAIN_LEVELS);
  return {
    slots: Math.min(20, 2 + (l - 1) * 2),          // 2,4,6,...,20
    timeMult: Math.max(1.2, 3.0 - (l - 1) * 0.2),  // 3.0,2.8,...,1.2
    harvestMult: 1 + (l - 1) * 0.15,                // 1.0,1.15,...,2.35
    plantsPerCycle: 1 + Math.floor((l - 1) / 2),     // 1,1,2,2,3,3,4,4,5,5
  };
}

// Main level upgrade cost (rebirth tokens)
export function getMainLevelCost(currentLevel: number): number {
  // Level 1→2 costs 1, scaling up
  return Math.ceil(currentLevel * 1.5);
}

// === Endless stat boosts (after level 10) ===
export interface EndlessStatDef {
  key: string;
  name: string;
  emoji: string;
  description: string;
  baseCost: number;
  costScale: number; // each level costs baseCost + level * costScale
}

export const endlessStatDefs: EndlessStatDef[] = [
  { key: 'speed', name: 'Geschwindigkeit', emoji: '⚡', description: 'Reduziert Wachstumszeit', baseCost: 1, costScale: 1 },
  { key: 'harvest', name: 'Ernte-Multi', emoji: '💰', description: 'Erhöht Erntewert', baseCost: 1, costScale: 1 },
  { key: 'variant', name: 'Varianten-Chance', emoji: '🎲', description: 'Mehr seltene Varianten', baseCost: 2, costScale: 1 },
  { key: 'slots', name: 'Extra Slots', emoji: '📦', description: 'Mehr gleichzeitige Pflanzen', baseCost: 2, costScale: 2 },
];

export function getEndlessStatCost(def: EndlessStatDef, currentLevel: number): number {
  return def.baseCost + currentLevel * def.costScale;
}

// Apply endless stat boosts to base stats
export function applyEndlessBoosts(
  base: FarmerLevelStats,
  endlessStats: Record<string, number>
): FarmerLevelStats {
  const speed = endlessStats.speed || 0;
  const harvest = endlessStats.harvest || 0;
  const variant = endlessStats.variant || 0;
  const slots = endlessStats.slots || 0;
  return {
    slots: base.slots + slots * 2,
    timeMult: Math.max(0.5, base.timeMult - speed * 0.05),
    harvestMult: base.harvestMult + harvest * 0.1,
    plantsPerCycle: base.plantsPerCycle + Math.floor((endlessStats.speed || 0) / 5),
  };
}

export function getFarmerEffectiveStats(level: number, endlessStats: Record<string, number>): FarmerLevelStats {
  const base = getMainLevelStats(level);
  if (level >= FARMER_MAIN_LEVELS) {
    return applyEndlessBoosts(base, endlessStats);
  }
  return base;
}
