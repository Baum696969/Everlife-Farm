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
  discountUpgrade: number; // 0-3: more discount slots + higher discount range
}

export type AutoSellMode = 'off' | 'normal' | 'all' | 'gold+';

export interface FarmerSlot {
  plantKey: string;
  startTime: number;
  duration: number; // total ms to grow
  done: boolean;
}

export interface FarmerInventorySlot {
  plantKey: string;
  amount: number;
}

export interface SingleFarmerState {
  unlocked: boolean;
  level: number; // 1-10 main levels
  endlessStats: Record<string, number>; // endless stat boosts after level 10
  slots: FarmerSlot[];
  inventory: FarmerInventorySlot[]; // max 3 seed types queued
  autoReplant: boolean;
  maxSeedsLevel: number; // upgrade level for max seeds capacity
}

// Legacy compat
export interface FarmerState {
  unlocked: boolean;
  level: number;
  slots: FarmerSlot[];
  inventory: FarmerInventorySlot[];
  autoReplant: boolean;
}

export type MultiFarmerState = SingleFarmerState[];

export interface DiscountState {
  plants: { plantKey: string; discountPercent: number }[];
  expiresAt: number; // timestamp when discounts expire
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
  // Update 3
  autoHarvest: boolean;
  autoSell: AutoSellMode;
  autoWater: boolean;
  rebirthFieldsBought: number; // 0-2
  milestoneTokensClaimed: boolean; // one-time +5 at rebirth 10
  startMoneyUsed: boolean; // track if first-plant discount was used this rebirth
  // Update 4
  lastPlanted: Record<number, string>; // fieldIndex -> plantKey (for replant)
  tutorialCompleted: boolean;
  farmer: FarmerState; // legacy single farmer (kept for save compat)
  farmers: MultiFarmerState; // new multi-farmer system
  // Update 5
  seenMilestones: string[]; // milestone keys already shown as popup
  disableMilestonePopups: boolean;
  // Update 6 (v1.4)
  doubleSellEventStart: number | null; // timestamp when 2x sell event started
  activeDiscounts: DiscountState | null; // current active discounts
}

export interface HarvestResult {
  variants: string[];
  totalMultiplier: number;
  totalValue: number;
}

export type HarvestedInventory = Record<string, Record<string, number>>;

export type MusicTrack = 'standard' | 'lofi' | 'lounge' | 'gaming';

export interface SoundSettings {
  music: boolean;
  musicTrack: MusicTrack;
  musicVolume: number; // 0-1
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
