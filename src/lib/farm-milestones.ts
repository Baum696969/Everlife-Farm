import type { RebirthMilestone } from './farm-types';

export const rebirthMilestones: RebirthMilestone[] = [
  { rebirth: 1,  key: 'autoHarvest',    name: 'Auto-Ernten',        description: 'Reife Pflanzen werden automatisch geerntet (1/Sek).', icon: '🤖' },
  { rebirth: 3,  key: 'growthBonus',     name: 'Wachstum +10%',      description: 'Globales Wachstum ×1.10.', icon: '🌱' },
  { rebirth: 5,  key: 'goldChance',      name: 'Gold-Chance ×1.5',   description: 'Gold-Drop-Chance wird multipliziert.', icon: '🥇' },
  { rebirth: 10, key: 'bonusTokens',     name: '+5 Extra Tokens',    description: 'Einmaliger Bonus: +5 Rebirth-Tokens.', icon: '🪙' },
  { rebirth: 15, key: 'firstPlantDisc',  name: 'Erste Pflanze -50%', description: 'Jede Pflanze kostet beim ersten Kauf nur 50%.', icon: '🏷️' },
  { rebirth: 15, key: 'doubleStart',     name: 'Startgeld ×2',       description: 'Nach Rebirth doppeltes Startgeld.', icon: '💰' },
  { rebirth: 20, key: 'doubleRebirth',   name: 'Double Rebirth',     description: '2× Rebirth auf einmal (2.5× Kosten).', icon: '🔄' },
  { rebirth: 25, key: 'autoSell',        name: 'Auto-Sell',          description: 'Ernten werden automatisch verkauft.', icon: '💸' },
  { rebirth: 30, key: 'tripleRebirth',   name: 'Triple Rebirth',     description: '3× Rebirth auf einmal (3.6× Kosten).', icon: '🔄' },
  { rebirth: 50, key: 'quadRebirth',     name: 'Quad Rebirth',       description: '4× Rebirth auf einmal (4.8× Kosten).', icon: '🔄' },
  { rebirth: 75, key: 'quintRebirth',    name: '5× Rebirth',         description: '5× Rebirth auf einmal (6.2× Kosten).', icon: '🔄' },
  { rebirth: 80, key: 'autoWater',       name: 'Auto-Gießkanne',     description: 'Automatisches Gießen (smart, mit Limits).', icon: '💧' },
];

// Multi-rebirth definitions
export interface MultiRebirthOption {
  count: number;
  costMult: number;
  tokenPenalty: number; // fraction of full tokens
  requiredRebirth: number;
}

export const multiRebirthOptions: MultiRebirthOption[] = [
  { count: 1, costMult: 1,   tokenPenalty: 1,    requiredRebirth: 0 },
  { count: 2, costMult: 2.5, tokenPenalty: 0.95,  requiredRebirth: 20 },
  { count: 3, costMult: 3.6, tokenPenalty: 0.92,  requiredRebirth: 30 },
  { count: 4, costMult: 4.8, tokenPenalty: 0.90,  requiredRebirth: 50 },
  { count: 5, costMult: 6.2, tokenPenalty: 0.88,  requiredRebirth: 75 },
];

// Rebirth field costs (in tokens)
export const rebirthFieldCosts = [25, 60];

// Check if a milestone is unlocked
export function hasMilestone(rebirths: number, key: string): boolean {
  const milestone = rebirthMilestones.find(m => m.key === key);
  return milestone ? rebirths >= milestone.rebirth : false;
}

// Growth multiplier from milestones
export function getMilestoneGrowthMult(rebirths: number): number {
  return hasMilestone(rebirths, 'growthBonus') ? 1.1 : 1.0;
}

// Gold chance multiplier from milestones  
export function getMilestoneGoldMult(rebirths: number): number {
  return hasMilestone(rebirths, 'goldChance') ? 1.5 : 1.0;
}

// Start money based on milestones
export function getStartMoney(rebirths: number): number {
  return hasMilestone(rebirths, 'doubleStart') ? 20 : 10;
}

// Max grow time cap (12 minutes)
export const MAX_GROW_TIME = 720000;
