export interface Field {
  id: number;
  unlocked: boolean;
  planted: string | null;
  plantTime: number;
  stage: number;
  growStartTime: number; // timestamp when planting started
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
  variantBonus?: number; // multiplier for variant chances (e.g. 1.5 = +50%)
}

export interface Variant {
  name: string;
  multiplier: number;
  chance: number; // 1 in X
  color: string; // tailwind color class
  emoji: string;
}

export interface GameEvent {
  focusVariant: string;
  name: string;
  emoji: string;
}

export interface GameState {
  money: number;
  fields: Field[];
  inventory: Record<string, number>;
  lastUpdate: number;
  maxFields: number;
  rebirths: number;
  discoveredVariants: Record<string, string[]>;
  eventStartTime: number | null;
  eventType: string | null;
  waterLevel: number;
}

// harvestedInventory: Record<plantKey, Record<variantKey, count>>
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
