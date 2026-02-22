import type { Plant, Variant, GameEvent, WaterUpgradeState, RebirthShopState } from './farm-types';

// ─── Regular plants ───
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

// ─── Rebirth plants ───
export const rebirthPlants: Record<string, Plant> = {
  rebirth_rose: {
    name: 'Rebirth Rose', price: 50, value: 150, growTime: 45000, icon: '🌹',
    stages: ['✨', '🌿✨', '🌹✨'], isRebirth: true, rebirthRequired: 1, variantBonus: 1.5,
  },
  rebirth_orchid: {
    name: 'Rebirth Orchidee', price: 200, value: 600, growTime: 90000, icon: '🌺',
    stages: ['✨', '🌿✨', '🌺✨'], isRebirth: true, rebirthRequired: 5, variantBonus: 1.5,
  },
  rebirth_lotus: {
    name: 'Rebirth Lotus', price: 500, value: 1500, growTime: 150000, icon: '🪷',
    stages: ['✨', '🌿✨', '🪷✨'], isRebirth: true, rebirthRequired: 10, variantBonus: 1.5,
  },
  rebirth_crystal: {
    name: 'Rebirth Kristallblume', price: 1000, value: 3000, growTime: 240000, icon: '💎',
    stages: ['✨', '🌿✨', '💎✨'], isRebirth: true, rebirthRequired: 20, variantBonus: 1.5,
  },
  rebirth_star: {
    name: 'Rebirth Sternenblume', price: 5000, value: 15000, growTime: 360000, icon: '⭐',
    stages: ['✨', '🌿✨', '⭐✨'], isRebirth: true, rebirthRequired: 100, variantBonus: 1.5,
  },
};

export function getAllPlants(rebirths: number): Record<string, Plant> {
  const available = { ...plants };
  for (const [key, plant] of Object.entries(rebirthPlants)) {
    if (rebirths >= (plant.rebirthRequired || 0)) {
      available[key] = plant;
    }
  }
  return available;
}

// ─── Variants ───
export const variants: Record<string, Variant> = {
  normal:    { name: 'Normal',    multiplier: 1,   chance: 1,     color: 'text-foreground',  emoji: '' },
  gold:      { name: 'Gold',      multiplier: 2.5, chance: 20,    color: 'text-yellow-500',  emoji: '🥇' },
  shiny:     { name: 'Shiny',     multiplier: 5,   chance: 75,    color: 'text-cyan-400',    emoji: '✨' },
  diamond:   { name: 'Diamant',   multiplier: 10,  chance: 250,   color: 'text-blue-400',    emoji: '💠' },
  platinum:  { name: 'Platin',    multiplier: 20,  chance: 1000,  color: 'text-gray-300',    emoji: '🏆' },
  mythic:    { name: 'Mythisch',  multiplier: 50,  chance: 5000,  color: 'text-purple-500',  emoji: '🔮' },
  legendary: { name: 'Legendär',  multiplier: 150, chance: 25000, color: 'text-orange-500',  emoji: '👑' },
};
export const variantKeys = Object.keys(variants);

// ─── Events ───
export const eventTypes: GameEvent[] = [
  { focusVariant: 'gold',      name: 'Gold-Event',      emoji: '🥇' },
  { focusVariant: 'shiny',     name: 'Shiny-Event',     emoji: '✨' },
  { focusVariant: 'diamond',   name: 'Diamant-Event',   emoji: '💠' },
  { focusVariant: 'platinum',  name: 'Platin-Event',    emoji: '🏆' },
  { focusVariant: 'mythic',    name: 'Mythisch-Event',  emoji: '🔮' },
  { focusVariant: 'legendary', name: 'Legendär-Event',  emoji: '👑' },
];

export function pickRandomEvent(): GameEvent {
  const weights = [30, 25, 20, 15, 8, 2];
  const totalWeight = weights.reduce((a, b) => a + b, 0);
  let r = Math.random() * totalWeight;
  for (let i = 0; i < eventTypes.length; i++) {
    r -= weights[i];
    if (r <= 0) return eventTypes[i];
  }
  return eventTypes[0];
}

// ─── Field prices ───
export const fieldPrices = [0, 50, 100, 200, 500, 1000, 2000, 4000, 8000, 16000];

// ─── Rebirth cost ───
export function getRebirthCost(rebirths: number): number {
  return Math.floor(50000 * Math.pow(1.35, rebirths));
}

// ─── Rebirth tokens earned ───
export function getRebirthTokens(rebirths: number): number {
  if (rebirths < 5) return 1 + Math.floor(rebirths / 3);
  if (rebirths < 20) return 3 + Math.floor((rebirths - 5) / 5);
  return 5 + Math.floor((rebirths - 20) / 4);
}

// ─── Variant rolling (supports stacking) ───
export function rollVariant(
  plantKey: string,
  plant: Plant,
  activeEvent: GameEvent | null,
  globalVariantBonus: number = 0, // from rebirth shop, percentage
): string {
  const variantBonus = plant.variantBonus || 1;
  const globalMult = 1 + globalVariantBonus / 100;

  for (let i = variantKeys.length - 1; i >= 1; i--) {
    const vKey = variantKeys[i];
    const v = variants[vKey];
    let effectiveChance = v.chance / variantBonus / globalMult;

    if (activeEvent) {
      if (activeEvent.focusVariant === vKey) {
        effectiveChance /= 4;
      } else {
        effectiveChance /= 2;
      }
    }

    if (Math.random() < 1 / effectiveChance) {
      return vKey;
    }
  }
  return 'normal';
}

// Roll stacked variants (up to 3)
export function rollStackedVariants(
  plantKey: string,
  plant: Plant,
  activeEvent: GameEvent | null,
  globalVariantBonus: number = 0,
): string[] {
  const first = rollVariant(plantKey, plant, activeEvent, globalVariantBonus);
  if (first === 'normal') return ['normal'];

  const result = [first];

  // Second variant: 40% of normal chance (60% reduction)
  const second = rollVariantWithPenalty(plantKey, plant, activeEvent, globalVariantBonus, 0.4);
  if (second !== 'normal' && second !== first) {
    result.push(second);

    // Third variant: 15% of normal chance (85% reduction)
    const third = rollVariantWithPenalty(plantKey, plant, activeEvent, globalVariantBonus, 0.15);
    if (third !== 'normal' && !result.includes(third)) {
      result.push(third);
    }
  }

  return result;
}

function rollVariantWithPenalty(
  plantKey: string,
  plant: Plant,
  activeEvent: GameEvent | null,
  globalVariantBonus: number,
  chanceMult: number,
): string {
  const variantBonus = plant.variantBonus || 1;
  const globalMult = 1 + globalVariantBonus / 100;

  for (let i = variantKeys.length - 1; i >= 1; i--) {
    const vKey = variantKeys[i];
    const v = variants[vKey];
    let effectiveChance = v.chance / variantBonus / globalMult / chanceMult;

    if (activeEvent) {
      if (activeEvent.focusVariant === vKey) {
        effectiveChance /= 4;
      } else {
        effectiveChance /= 2;
      }
    }

    if (Math.random() < 1 / effectiveChance) {
      return vKey;
    }
  }
  return 'normal';
}

// Calculate sell value for stacked variants
export function calculateStackedValue(baseValue: number, variantKeys_: string[], rebirths: number): number {
  const totalMultiplier = variantKeys_.reduce((sum, vk) => sum + (variants[vk]?.multiplier || 1), 0);
  const rebirthMulti = 1 + 0.1 * rebirths;
  return Math.floor(baseValue * totalMultiplier * rebirthMulti);
}

// Single variant value (for inventory display)
export function calculateValue(baseValue: number, variantKey: string, rebirths: number): number {
  const variant = variants[variantKey];
  const rebirthMulti = 1 + 0.1 * rebirths;
  return Math.floor(baseValue * variant.multiplier * rebirthMulti);
}

// ─── Event timing ───
export const EVENT_INTERVAL = 15 * 60 * 1000;
export const EVENT_DURATION = 5 * 60 * 1000;

// ─── Watering system (granular upgrades) ───
export const BASE_WATER_DURATION = 30000;
export const BASE_WATER_COOLDOWN = 15000;
export const BASE_WATER_STRENGTH = 2;

export interface WaterUpgradeDef {
  key: keyof WaterUpgradeState;
  name: string;
  maxLevel: number;
  costs: number[];
  description: (level: number) => string;
}

export const waterUpgradeDefs: WaterUpgradeDef[] = [
  {
    key: 'duration',
    name: '⏱️ Dauer',
    maxLevel: 5,
    costs: [200, 400, 600, 800, 1000],
    description: (l) => `+${(l + 1) * 5}s Dauer (gesamt: ${30 + (l + 1) * 5}s)`,
  },
  {
    key: 'strength',
    name: '💪 Stärke',
    maxLevel: 3,
    costs: [1000, 5000, 25000],
    description: (l) => `×${[2.5, 3, 3.5][l]} Geschwindigkeit`,
  },
  {
    key: 'range',
    name: '🎯 Reichweite',
    maxLevel: 2,
    costs: [10000, 50000],
    description: (l) => `${[3, 5][l]} Felder gleichzeitig`,
  },
  {
    key: 'cooldownReduction',
    name: '⚡ Cooldown',
    maxLevel: 5,
    costs: [3000, 6000, 12000, 24000, 48000],
    description: (l) => `−${(l + 1) * 5}% Cooldown`,
  },
];

export function getWaterStats(upgrades: WaterUpgradeState) {
  const duration = BASE_WATER_DURATION + upgrades.duration * 5000;
  const strengthTiers = [2, 2.5, 3, 3.5];
  const speedMult = strengthTiers[upgrades.strength] || 2;
  const rangeTiers = [1, 3, 5];
  const range = rangeTiers[upgrades.range] || 1;
  const cooldownReduction = 1 - upgrades.cooldownReduction * 0.05;
  const cooldown = Math.floor(BASE_WATER_COOLDOWN * cooldownReduction);
  return { duration, speedMult, range, cooldown };
}

// ─── Rebirth shop ───
export interface RebirthShopDef {
  key: keyof RebirthShopState;
  name: string;
  emoji: string;
  maxLevel: number;
  costs: number[];
  description: (level: number) => string;
}

export const rebirthShopDefs: RebirthShopDef[] = [
  {
    key: 'offlineEfficiency', name: 'Offline-Effizienz', emoji: '💤',
    maxLevel: 3, costs: [2, 4, 6],
    description: (l) => `${70 + (l + 1) * 10}% Offline-Wachstum`,
  },
  {
    key: 'variantChance', name: 'Varianten-Chance', emoji: '🍀',
    maxLevel: 5, costs: [3, 5, 8, 12, 18],
    description: (l) => `+${(l + 1) * 5}% globale Varianten-Chance`,
  },
  {
    key: 'eventBonus', name: 'Event-Bonus', emoji: '🎉',
    maxLevel: 3, costs: [5, 10, 20],
    description: (l) => `Fokus-Variante +${l + 1} extra Stack-Chance`,
  },
  {
    key: 'waterStrength', name: 'Gießkanne+', emoji: '💧',
    maxLevel: 4, costs: [4, 7, 12, 20],
    description: (l) => `+${((l + 1) * 0.25).toFixed(2)} Gieß-Multiplikator`,
  },
  {
    key: 'fieldStart', name: 'Start-Felder', emoji: '🚜',
    maxLevel: 3, costs: [3, 6, 12],
    description: (l) => `+${l + 1} Felder direkt nach Rebirth`,
  },
  {
    key: 'indexBonus', name: 'Index-Bonus', emoji: '📖',
    maxLevel: 5, costs: [2, 3, 5, 8, 12],
    description: (l) => `+${l + 1}% Geld pro 10% Index`,
  },
  {
    key: 'discountUpgrade', name: 'Händler-Rabatt', emoji: '🏷️',
    maxLevel: 3, costs: [3, 8, 15],
    description: (l) => {
      const slots = [4, 5, 5][l];
      const maxDisc = [30, 40, 50][l];
      return `Max ${slots} Pflanzen, bis zu ${maxDisc}% Rabatt`;
    },
  },
];

// ─── Discount system ───
export const DISCOUNT_DURATION = 10 * 60 * 1000; // 10 minutes

export function getDiscountConfig(discountUpgradeLevel: number) {
  const configs = [
    { maxPlants: 3, minDiscount: 10, maxDiscount: 20 }, // base (no upgrade)
    { maxPlants: 4, minDiscount: 15, maxDiscount: 30 },
    { maxPlants: 5, minDiscount: 20, maxDiscount: 40 },
    { maxPlants: 5, minDiscount: 20, maxDiscount: 50 },
  ];
  return configs[Math.min(discountUpgradeLevel, configs.length - 1)];
}

export function generateDiscounts(allPlantKeys: string[], discountUpgradeLevel: number): { plantKey: string; discountPercent: number }[] {
  const config = getDiscountConfig(discountUpgradeLevel);
  const shuffled = [...allPlantKeys].sort(() => Math.random() - 0.5);
  const count = Math.min(config.maxPlants, shuffled.length);
  return shuffled.slice(0, count).map(plantKey => ({
    plantKey,
    discountPercent: Math.floor(Math.random() * (config.maxDiscount - config.minDiscount + 1)) + config.minDiscount,
  }));
}

// ─── Double Sell Event ───
export const DOUBLE_SELL_DURATION = 5 * 60 * 1000; // 5 minutes

// ─── Offline constants ───
export const MAX_OFFLINE_HOURS = 8;
export const BASE_OFFLINE_EFFICIENCY = 0.7;

// ─── Chain cooldown constants ───
export const CHAIN_COOLDOWN_INCREMENT = 1000; // +1s per subsequent water
export const CHAIN_COOLDOWN_RESET = 5000; // resets after 5s pause
