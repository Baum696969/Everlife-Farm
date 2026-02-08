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
  duration: number;
  strength: number;
  range: number;
  cooldownReduction: number;
}

export interface RebirthShopState {
  offlineEfficiency: number;
  variantChance: number;
  eventBonus: number;
  waterStrength: number;
  fieldStart: number;
  indexBonus: number;
}

export type AutoSellMode = 'off' | 'normal' | 'all' | 'gold+';

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
  // Update 3
  autoHarvest: boolean;
  autoSell: AutoSellMode;
  autoWater: boolean;
  rebirthFieldsBought: number; // 0-2
  milestoneTokensClaimed: boolean; // one-time +5 at rebirth 10
  startMoneyUsed: boolean; // track if first-plant discount was used this rebirth
}

export interface HarvestResult {
  variants: string[];
  totalMultiplier: number;
  totalValue: number;
}

export type HarvestedInventory = Record<string, Record<string, number>>;

export interface SoundSettings {
  music: boolean;
  plantSounds: boolean;
  uiSounds: boolean;
  eventRebirthSounds: boolean;
  masterVolume: number; // 0-1
  notifications: boolean;
}

export interface RebirthMilestone {
  rebirth: number;
  key: string;
  name: string;
  description: string;
  icon: string;
}
