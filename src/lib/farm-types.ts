export interface Field {
  id: number;
  unlocked: boolean;
  planted: string | null;
  plantTime: number;
  stage: number;
  growStartTime: number;
}

export interface Plant {
  name: string;
  price: number;
  value: number;
  growTime: number;
  icon: string;
  stages: string[];
  isRebirth?: boolean;
  rebirthRequired?: number;
  variantBonus?: number;
}

export interface Variant {
  name: string;
  multiplier: number;
  chance: number;
  color: string;
  emoji: string;
}

export interface GameEvent {
  focusVariant: string;
  name: string;
  emoji: string;
}

export interface WaterUpgradeState {
  duration: number;     // 0-5, each +5s base duration
  strength: number;     // 0-3, multiplier tiers
  range: number;        // 0-2, fields affected: 1/3/5
  cooldownReduction: number; // 0-5, each -5% cooldown
}

export interface RebirthShopState {
  offlineEfficiency: number;  // each +10%, from 70% to 100%
  variantChance: number;      // each +5% global
  eventBonus: number;         // focus variant +1 extra stack chance
  waterStrength: number;      // +0.25 multiplier each
  fieldStart: number;         // +1 field after rebirth
  indexBonus: number;         // +1% money per 10% index completion
}

export interface GameState {
  money: number;
  fields: Field[];
  inventory: Record<string, number>;
  lastUpdate: number;
  maxFields: number;
  rebirths: number;
  rebirthTokens: number;
  discoveredVariants: Record<string, string[]>;
  eventStartTime: number | null;
  eventType: string | null;
  waterUpgrades: WaterUpgradeState;
  rebirthShop: RebirthShopState;
}

export interface HarvestResult {
  variants: string[];
  totalMultiplier: number;
  totalValue: number;
}

export type HarvestedInventory = Record<string, Record<string, number>>;

export interface SoundSettings {
  music: boolean;
  water: boolean;
  harvest: boolean;
  buy: boolean;
  drop: boolean;
  event: boolean;
  rebirth: boolean;
  notifications: boolean;
}
