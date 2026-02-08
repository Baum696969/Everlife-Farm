import type { Plant, Variant, GameEvent } from './farm-types';

// Regular plants
export const plants: Record<string, Plant> = {
  carrot: { name: 'Karotte', price: 10, value: 25, growTime: 60000, icon: '🥕', stages: ['🌱', '🌿', '🥕'] },
  potato: { name: 'Kartoffel', price: 20, value: 50, growTime: 120000, icon: '🥔', stages: ['🌱', '🌿', '🥔'] },
  tomato: { name: 'Tomate', price: 40, value: 90, growTime: 240000, icon: '🍅', stages: ['🌱', '🌿', '🍅'] },
  corn: { name: 'Mais', price: 80, value: 180, growTime: 480000, icon: '🌽', stages: ['🌱', '🌿', '🌽'] },
  onion: { name: 'Zwiebel', price: 150, value: 300, growTime: 720000, icon: '🧅', stages: ['🌱', '🌿', '🧅'] },
  pumpkin: { name: 'Kürbis', price: 300, value: 600, growTime: 960000, icon: '🎃', stages: ['🌱', '🌿', '🎃'] },
  strawberry: { name: 'Erdbeere', price: 500, value: 1000, growTime: 1200000, icon: '🍓', stages: ['🌱', '🌿', '🍓'] },
  broccoli: { name: 'Brokkoli', price: 750, value: 1500, growTime: 1500000, icon: '🥦', stages: ['🌱', '🌿', '🥦'] },
  watermelon: { name: 'Wassermelone', price: 1000, value: 2000, growTime: 1800000, icon: '🍉', stages: ['🌱', '🌿', '🍉'] },
  dragonfruit: { name: 'Drachenfrucht', price: 2000, value: 4000, growTime: 2700000, icon: '🐉', stages: ['🌱', '🌿', '🐉'] },
};

// Rebirth plants
export const rebirthPlants: Record<string, Plant> = {
  rebirth_rose: {
    name: 'Rebirth Rose', price: 50, value: 150, growTime: 45000, icon: '🌹',
    stages: ['✨', '🌿✨', '🌹✨'], isRebirth: true, rebirthRequired: 1, variantBonus: 1.5
  },
  rebirth_orchid: {
    name: 'Rebirth Orchidee', price: 200, value: 600, growTime: 90000, icon: '🌺',
    stages: ['✨', '🌿✨', '🌺✨'], isRebirth: true, rebirthRequired: 5, variantBonus: 1.5
  },
  rebirth_lotus: {
    name: 'Rebirth Lotus', price: 500, value: 1500, growTime: 150000, icon: '🪷',
    stages: ['✨', '🌿✨', '🪷✨'], isRebirth: true, rebirthRequired: 10, variantBonus: 1.5
  },
  rebirth_crystal: {
    name: 'Rebirth Kristallblume', price: 1000, value: 3000, growTime: 240000, icon: '💎',
    stages: ['✨', '🌿✨', '💎✨'], isRebirth: true, rebirthRequired: 20, variantBonus: 1.5
  },
  rebirth_star: {
    name: 'Rebirth Sternenblume', price: 5000, value: 15000, growTime: 360000, icon: '⭐',
    stages: ['✨', '🌿✨', '⭐✨'], isRebirth: true, rebirthRequired: 100, variantBonus: 1.5
  },
};

// Get all available plants based on rebirths
export function getAllPlants(rebirths: number): Record<string, Plant> {
  const available = { ...plants };
  for (const [key, plant] of Object.entries(rebirthPlants)) {
    if (rebirths >= (plant.rebirthRequired || 0)) {
      available[key] = plant;
    }
  }
  return available;
}

// Variants
export const variants: Record<string, Variant> = {
  normal:    { name: 'Normal',    multiplier: 1,   chance: 1,     color: 'text-foreground',        emoji: '' },
  gold:      { name: 'Gold',      multiplier: 2.5, chance: 20,    color: 'text-yellow-500',        emoji: '🥇' },
  shiny:     { name: 'Shiny',     multiplier: 5,   chance: 75,    color: 'text-cyan-400',          emoji: '✨' },
  diamond:   { name: 'Diamant',   multiplier: 10,  chance: 250,   color: 'text-blue-400',          emoji: '💠' },
  platinum:  { name: 'Platin',    multiplier: 20,  chance: 1000,  color: 'text-gray-300',          emoji: '🏆' },
  mythic:    { name: 'Mythisch',  multiplier: 50,  chance: 5000,  color: 'text-purple-500',        emoji: '🔮' },
  legendary: { name: 'Legendär',  multiplier: 150, chance: 25000, color: 'text-orange-500',        emoji: '👑' },
};

export const variantKeys = Object.keys(variants);

// Events
export const eventTypes: GameEvent[] = [
  { focusVariant: 'gold',      name: 'Gold-Event',      emoji: '🥇' },
  { focusVariant: 'shiny',     name: 'Shiny-Event',     emoji: '✨' },
  { focusVariant: 'diamond',   name: 'Diamant-Event',   emoji: '💠' },
  { focusVariant: 'platinum',  name: 'Platin-Event',    emoji: '🏆' },
  { focusVariant: 'mythic',    name: 'Mythisch-Event',  emoji: '🔮' },
  { focusVariant: 'legendary', name: 'Legendär-Event',  emoji: '👑' },
];

// Event weighted selection (legendary is rarer)
export function pickRandomEvent(): GameEvent {
  const weights = [30, 25, 20, 15, 8, 2]; // gold most common, legendary rarest
  const totalWeight = weights.reduce((a, b) => a + b, 0);
  let r = Math.random() * totalWeight;
  for (let i = 0; i < eventTypes.length; i++) {
    r -= weights[i];
    if (r <= 0) return eventTypes[i];
  }
  return eventTypes[0];
}

// Field prices
export const fieldPrices = [0, 50, 100, 200, 500, 1000, 2000, 4000, 8000, 16000];

// Rebirth cost
export function getRebirthCost(rebirths: number): number {
  return Math.floor(50000 * Math.pow(1.35, rebirths));
}

// Roll variant
export function rollVariant(
  plantKey: string,
  plant: Plant,
  activeEvent: GameEvent | null
): string {
  const variantBonus = plant.variantBonus || 1;

  // Try from rarest to most common
  for (let i = variantKeys.length - 1; i >= 1; i--) {
    const vKey = variantKeys[i];
    const v = variants[vKey];
    let effectiveChance = v.chance / variantBonus;

    // Event bonuses
    if (activeEvent) {
      if (activeEvent.focusVariant === vKey) {
        effectiveChance /= 4; // focus variant ×4
      } else {
        effectiveChance /= 2; // all others ×2
      }
    }

    if (Math.random() < 1 / effectiveChance) {
      return vKey;
    }
  }
  return 'normal';
}

// Calculate sell value
export function calculateValue(baseValue: number, variantKey: string, rebirths: number): number {
  const variant = variants[variantKey];
  const rebirthMulti = 1 + 0.1 * rebirths;
  return Math.floor(baseValue * variant.multiplier * rebirthMulti);
}

// Event timing constants
export const EVENT_INTERVAL = 15 * 60 * 1000; // 15 minutes
export const EVENT_DURATION = 5 * 60 * 1000;  // 5 minutes

// Watering constants
export const WATER_DURATION = 30000;  // 30 seconds
export const WATER_COOLDOWN = 15000;  // 15 seconds
export const WATER_SPEED_MULT = 2;    // ×2 speed
