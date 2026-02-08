import { useState, useEffect, useCallback, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { useFarmSounds } from '@/hooks/use-farm-sounds';
import type { Field, GameState, HarvestedInventory, SoundSettings, GameEvent as GEvent, WaterUpgradeState, RebirthShopState } from '@/lib/farm-types';
import {
  plants, rebirthPlants, getAllPlants, variants, variantKeys,
  eventTypes, pickRandomEvent, fieldPrices, getRebirthCost, getRebirthTokens,
  rollStackedVariants, calculateValue, calculateStackedValue,
  EVENT_INTERVAL, EVENT_DURATION,
  getWaterStats, waterUpgradeDefs,
  rebirthShopDefs,
  BASE_OFFLINE_EFFICIENCY, MAX_OFFLINE_HOURS,
  CHAIN_COOLDOWN_INCREMENT, CHAIN_COOLDOWN_RESET,
} from '@/lib/farm-data';

const defaultSoundSettings: SoundSettings = {
  music: false, water: true, harvest: true, buy: true, drop: true, event: true, rebirth: true, notifications: true,
};

const defaultWaterUpgrades: WaterUpgradeState = { duration: 0, strength: 0, range: 0, cooldownReduction: 0 };
const defaultRebirthShop: RebirthShopState = { offlineEfficiency: 0, variantChance: 0, eventBonus: 0, waterStrength: 0, fieldStart: 0, indexBonus: 0 };

function createDefaultState(rebirthShop?: RebirthShopState): GameState {
  const startFields: Field[] = [];
  const extraFields = rebirthShop?.fieldStart || 0;
  const totalStartFields = 1 + extraFields;
  for (let i = 0; i < totalStartFields; i++) {
    startFields.push({ id: i + 1, unlocked: true, planted: null, plantTime: 0, stage: 0, growStartTime: 0 });
  }
  return {
    money: 10,
    fields: startFields,
    inventory: {},
    lastUpdate: Date.now(),
    maxFields: 10,
    rebirths: 0,
    rebirthTokens: 0,
    discoveredVariants: {},
    eventStartTime: null,
    eventType: null,
    waterUpgrades: { ...defaultWaterUpgrades },
    rebirthShop: rebirthShop ? { ...rebirthShop } : { ...defaultRebirthShop },
  };
}

// Particle emojis by variant
const particleEmojis: Record<string, string[]> = {
  gold: ['⭐', '✨', '🌟'],
  shiny: ['✨', '💫', '🌟'],
  diamond: ['💎', '💠', '✨'],
  platinum: ['🏆', '✨', '⭐'],
  mythic: ['🔮', '💜', '✨'],
  legendary: ['👑', '🌟', '💫'],
};

interface Particle {
  id: number;
  x: number;
  y: number;
  emoji: string;
  px: number;
  py: number;
}

let particleIdCounter = 0;

export default function FarmGame() {
  const { toast } = useToast();

  // Core state
  const [gameState, setGameState] = useState<GameState>(() => createDefaultState());
  const [harvestedInventory, setHarvestedInventory] = useState<HarvestedInventory>({});
  const [soundSettings, setSoundSettings] = useState<SoundSettings>(defaultSoundSettings);
  const playSound = useFarmSounds(soundSettings);

  // UI state
  const [showTutorial, setShowTutorial] = useState(true);
  const [shopModal, setShopModal] = useState(false);
  const [fieldShopModal, setFieldShopModal] = useState(false);
  const [inventoryModal, setInventoryModal] = useState(false);
  const [harvestedModal, setHarvestedModal] = useState(false);
  const [settingsModal, setSettingsModal] = useState(false);
  const [indexModal, setIndexModal] = useState(false);
  const [rebirthModal, setRebirthModal] = useState(false);
  const [waterUpgradeModal, setWaterUpgradeModal] = useState(false);
  const [rebirthShopModal, setRebirthShopModal] = useState(false);
  const [offlineReport, setOfflineReport] = useState<{ time: string; grown: number } | null>(null);
  const [plantSelectionModal, setPlantSelectionModal] = useState<{ show: boolean; fieldIndex: number }>({ show: false, fieldIndex: -1 });
  const [variantPopup, setVariantPopup] = useState<{ show: boolean; plantKey: string; variants: string[]; value: number } | null>(null);
  const [buyAmount, setBuyAmount] = useState<number>(1);

  // Animation state
  const [flashingFields, setFlashingFields] = useState<Record<number, boolean>>({});
  const [particles, setParticles] = useState<Particle[]>([]);

  // Watering state (not persisted)
  const [wateredFields, setWateredFields] = useState<Record<number, number>>({});
  const [waterCooldowns, setWaterCooldowns] = useState<Record<number, number>>({});

  // Chain cooldown tracking
  const lastWaterTimeRef = useRef<number>(0);
  const waterChainRef = useRef<number>(0);

  // Live tick
  const [tick, setTick] = useState(0);

  // Water stats
  const waterStats = getWaterStats(gameState.waterUpgrades);
  const waterStrengthBonus = gameState.rebirthShop.waterStrength * 0.25;
  const effectiveWaterSpeed = waterStats.speedMult + waterStrengthBonus;

  // Notify wrapper
  const notify = useCallback((options: { title: string; description?: string }) => {
    if (soundSettings.notifications) {
      toast(options);
    }
  }, [soundSettings.notifications, toast]);

  // Active event
  const activeEvent: GEvent | null = (() => {
    if (!gameState.eventStartTime || !gameState.eventType) return null;
    const elapsed = Date.now() - gameState.eventStartTime;
    if (elapsed > EVENT_DURATION) return null;
    return eventTypes.find(e => e.focusVariant === gameState.eventType) || null;
  })();

  const eventTimeLeft = gameState.eventStartTime ? Math.max(0, EVENT_DURATION - (Date.now() - gameState.eventStartTime)) : 0;

  const allPlants = getAllPlants(gameState.rebirths);

  // Index-based money bonus
  const totalVariantsCount = Object.keys({ ...plants, ...rebirthPlants }).length * variantKeys.length;
  const discoveredCount = Object.values(gameState.discoveredVariants).reduce((a, b) => a + b.length, 0);
  const indexCompletion = totalVariantsCount > 0 ? discoveredCount / totalVariantsCount : 0;
  const indexMoneyBonus = gameState.rebirthShop.indexBonus > 0
    ? 1 + (gameState.rebirthShop.indexBonus * 0.01 * Math.floor(indexCompletion * 10))
    : 1;

  const formatTime = (ms: number): string => {
    if (ms <= 0) return 'Fertig!';
    const h = Math.floor(ms / 3600000);
    const m = Math.floor((ms % 3600000) / 60000);
    const s = Math.floor((ms % 60000) / 1000);
    if (h > 0) return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const getFieldProgress = useCallback((field: Field): number => {
    if (!field.planted) return 0;
    const plant = allPlants[field.planted];
    if (!plant) return 0;
    if (field.plantTime <= 0) return 1;
    return Math.max(0, Math.min(1, 1 - field.plantTime / plant.growTime));
  }, [allPlants]);

  const getStageFromProgress = (progress: number): number => {
    if (progress >= 0.66) return 3;
    if (progress >= 0.33) return 2;
    return 1;
  };

  const spawnParticles = useCallback((fieldIndex: number, variantKey: string) => {
    const emojis = particleEmojis[variantKey] || ['✨'];
    const count = variantKey === 'legendary' ? 12 : variantKey === 'mythic' ? 10 : 6;
    const newParticles: Particle[] = [];
    for (let i = 0; i < count; i++) {
      newParticles.push({
        id: ++particleIdCounter,
        x: 0, y: 0,
        emoji: emojis[Math.floor(Math.random() * emojis.length)],
        px: (Math.random() - 0.5) * 120,
        py: -(Math.random() * 80 + 40),
      });
    }
    setParticles(prev => [...prev, ...newParticles.map(p => ({ ...p, x: fieldIndex }))]);
    setTimeout(() => {
      setParticles(prev => prev.filter(p => !newParticles.find(np => np.id === p.id)));
    }, 1100);
  }, []);

  // === SAVE / LOAD ===
  const saveGame = useCallback(() => {
    const toSave = { ...gameState, lastUpdate: Date.now() };
    localStorage.setItem('farmGame3', JSON.stringify(toSave));
    localStorage.setItem('farmHarvested3', JSON.stringify(harvestedInventory));
    localStorage.setItem('farmSounds', JSON.stringify(soundSettings));
  }, [gameState, harvestedInventory, soundSettings]);

  const loadGame = useCallback(() => {
    try {
      const saved = localStorage.getItem('farmGame3');
      if (saved) {
        const loaded: GameState = JSON.parse(saved);
        const now = Date.now();
        const timePassed = Math.min(now - loaded.lastUpdate, MAX_OFFLINE_HOURS * 3600000);

        // Offline growth
        const offlineEff = BASE_OFFLINE_EFFICIENCY + (loaded.rebirthShop?.offlineEfficiency || 0) * 0.1;
        const offlineMs = timePassed * Math.min(offlineEff, 1);
        let grownCount = 0;

        loaded.fields.forEach(field => {
          if (field.planted && field.plantTime > 0) {
            const before = field.plantTime;
            field.plantTime = Math.max(0, field.plantTime - offlineMs);
            if (field.plantTime <= 0) {
              field.stage = 3;
              field.plantTime = 0;
              grownCount++;
            }
          }
          if (!field.growStartTime) field.growStartTime = 0;
        });

        // Migrate from old format
        if (loaded.rebirths === undefined) loaded.rebirths = 0;
        if (!loaded.discoveredVariants) loaded.discoveredVariants = {};
        if (!loaded.waterUpgrades) loaded.waterUpgrades = { ...defaultWaterUpgrades };
        if (!loaded.rebirthShop) loaded.rebirthShop = { ...defaultRebirthShop };
        if (loaded.rebirthTokens === undefined) loaded.rebirthTokens = 0;
        loaded.lastUpdate = now;
        setGameState(loaded);
        setShowTutorial(false);

        // Show offline report if significant time passed
        if (timePassed > 60000) {
          const mins = Math.floor(timePassed / 60000);
          const timeStr = mins >= 60 ? `${Math.floor(mins / 60)}h ${mins % 60}m` : `${mins}m`;
          setOfflineReport({ time: timeStr, grown: grownCount });
        }
      }

      const savedHarvested = localStorage.getItem('farmHarvested3');
      if (savedHarvested) setHarvestedInventory(JSON.parse(savedHarvested));

      const savedSounds = localStorage.getItem('farmSounds');
      if (savedSounds) {
        const parsed = JSON.parse(savedSounds);
        if (parsed.notifications === undefined) parsed.notifications = true;
        setSoundSettings(parsed);
      }
    } catch { /* Fresh start */ }
  }, []);

  // === MAIN GAME TICK ===
  useEffect(() => {
    const interval = setInterval(() => {
      setTick(t => t + 1);

      setGameState(prev => {
        let changed = false;
        const ws = getWaterStats(prev.waterUpgrades);
        const wsBonus = prev.rebirthShop.waterStrength * 0.25;
        const newFields = prev.fields.map((field, idx) => {
          if (!field.planted || field.plantTime <= 0) return field;

          const isWatered = (wateredFields[idx] || 0) > 0;
          const speed = isWatered ? (ws.speedMult + wsBonus) : 1;
          const reduction = 1000 * speed;
          const newTime = Math.max(0, field.plantTime - reduction);
          const plant = getAllPlants(prev.rebirths)[field.planted];
          if (!plant) return field;

          const progress = 1 - newTime / plant.growTime;
          const newStage = getStageFromProgress(progress);

          if (newTime !== field.plantTime || newStage !== field.stage) {
            changed = true;
            if (newTime <= 0 && field.plantTime > 0) playSound('grow');
            return { ...field, plantTime: newTime, stage: newStage };
          }
          return field;
        });

        let eventStartTime = prev.eventStartTime;
        let eventType = prev.eventType;
        const now = Date.now();

        if (eventStartTime && now - eventStartTime > EVENT_DURATION) {
          eventStartTime = null;
          eventType = null;
          changed = true;
        }

        if (!eventStartTime) {
          const lastEventEnd = prev.eventStartTime ? prev.eventStartTime + EVENT_DURATION : 0;
          if (now - lastEventEnd >= EVENT_INTERVAL || lastEventEnd === 0) {
            if (Math.random() < 1 / 900) {
              const event = pickRandomEvent();
              eventStartTime = now;
              eventType = event.focusVariant;
              changed = true;
              playSound('event');
            }
          }
        }

        if (!changed) return prev;
        return { ...prev, fields: newFields, eventStartTime, eventType };
      });

      setWateredFields(prev => {
        const next: Record<number, number> = {};
        let hasActive = false;
        for (const [k, v] of Object.entries(prev)) {
          const remaining = v - 1000;
          if (remaining > 0) { next[Number(k)] = remaining; hasActive = true; }
        }
        return hasActive ? next : {};
      });

      setWaterCooldowns(prev => {
        const next: Record<number, number> = {};
        let hasActive = false;
        for (const [k, v] of Object.entries(prev)) {
          const remaining = v - 1000;
          if (remaining > 0) { next[Number(k)] = remaining; hasActive = true; }
        }
        return hasActive ? next : {};
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [wateredFields, playSound]);

  useEffect(() => { loadGame(); }, [loadGame]);
  useEffect(() => { const i = setInterval(saveGame, 5000); return () => clearInterval(i); }, [saveGame]);
  useEffect(() => {
    window.addEventListener('beforeunload', saveGame);
    return () => window.removeEventListener('beforeunload', saveGame);
  }, [saveGame]);

  // === ACTIONS ===
  const buyField = (index: number) => {
    if (gameState.money >= fieldPrices[index]) {
      playSound('tractor');
      setGameState(prev => {
        const newFields = [...prev.fields];
        while (newFields.length <= index) {
          newFields.push({ id: newFields.length + 1, unlocked: false, planted: null, plantTime: 0, stage: 0, growStartTime: 0 });
        }
        newFields[index] = { id: index + 1, unlocked: true, planted: null, plantTime: 0, stage: 0, growStartTime: 0 };
        return { ...prev, money: prev.money - fieldPrices[index], fields: newFields };
      });
      notify({ title: '🚜 Neues Feld gekauft!' });
    }
  };

  const buySeed = (plantKey: string, amount: number = 1) => {
    const plant = { ...plants, ...rebirthPlants }[plantKey];
    if (!plant) return;
    const totalCost = plant.price * amount;
    if (gameState.money < totalCost) return;

    playSound('buy');
    setGameState(prev => ({
      ...prev,
      money: prev.money - totalCost,
      inventory: { ...prev.inventory, [plantKey]: (prev.inventory[plantKey] || 0) + amount },
    }));
    notify({ title: `${amount}× ${plant.name} gekauft!` });
  };

  const getMaxBuyable = (plantKey: string): number => {
    const plant = { ...plants, ...rebirthPlants }[plantKey];
    if (!plant || plant.price <= 0) return 0;
    return Math.floor(gameState.money / plant.price);
  };

  const plantSeed = (plantKey: string, fieldIndex: number) => {
    if (gameState.inventory[plantKey] > 0) {
      playSound('plant');
      setGameState(prev => {
        const newFields = [...prev.fields];
        newFields[fieldIndex] = {
          ...newFields[fieldIndex],
          planted: plantKey,
          plantTime: allPlants[plantKey].growTime,
          stage: 1,
          growStartTime: Date.now(),
        };
        return { ...prev, fields: newFields, inventory: { ...prev.inventory, [plantKey]: prev.inventory[plantKey] - 1 } };
      });
      notify({ title: `${allPlants[plantKey].name} gepflanzt!` });
      setPlantSelectionModal({ show: false, fieldIndex: -1 });
    }
  };

  const harvest = (fieldIndex: number) => {
    const field = gameState.fields[fieldIndex];
    if (!field.planted || field.stage < 3 || field.plantTime > 0) return;

    const plant = allPlants[field.planted];
    if (!plant) return;

    const variantResult = rollStackedVariants(field.planted, plant, activeEvent, gameState.rebirthShop.variantChance);
    const value = calculateStackedValue(plant.value, variantResult, gameState.rebirths);
    const finalValue = Math.floor(value * indexMoneyBonus);
    const hasRare = variantResult.some(v => v !== 'normal');

    playSound('harvest');
    if (hasRare) playSound('drop');

    // Flash
    setFlashingFields(prev => ({ ...prev, [fieldIndex]: true }));
    setTimeout(() => setFlashingFields(prev => ({ ...prev, [fieldIndex]: false })), 400);

    // Particles for rare
    if (hasRare) {
      const bestVariant = variantResult[variantResult.length - 1];
      spawnParticles(fieldIndex, bestVariant);
    }

    const plantKey = field.planted;

    // Store in harvested inventory (use best variant as key for stacked)
    const bestVariant = hasRare ? variantResult.filter(v => v !== 'normal').sort((a, b) => {
      return variantKeys.indexOf(b) - variantKeys.indexOf(a);
    })[0] : 'normal';

    // Track new discoveries
    const newVariants = variantResult.filter(v => v !== 'normal' && !(gameState.discoveredVariants[plantKey]?.includes(v)));

    setHarvestedInventory(prev => {
      const plantHarvest = { ...(prev[plantKey] || {}) };
      // For stacked: store under the best variant key
      const storeKey = variantResult.length > 1 ? variantResult.join('+') : variantResult[0];
      plantHarvest[storeKey] = (plantHarvest[storeKey] || 0) + 1;
      return { ...prev, [plantKey]: plantHarvest };
    });

    setGameState(prev => {
      const newFields = [...prev.fields];
      newFields[fieldIndex] = { ...newFields[fieldIndex], planted: null, plantTime: 0, stage: 0, growStartTime: 0 };
      const newDiscovered = { ...prev.discoveredVariants };
      if (!newDiscovered[plantKey]) newDiscovered[plantKey] = [];
      variantResult.forEach(v => {
        if (!newDiscovered[plantKey].includes(v)) {
          newDiscovered[plantKey] = [...newDiscovered[plantKey], v];
        }
      });
      return { ...prev, fields: newFields, discoveredVariants: newDiscovered };
    });

    if (hasRare) {
      if (newVariants.length > 0) playSound('newVariant');
      setVariantPopup({ show: true, plantKey, variants: variantResult.filter(v => v !== 'normal'), value: finalValue });
    } else {
      notify({ title: `${plant.name} geerntet! (im Inventar)` });
    }
  };

  const getVariantValueFromKey = (plantKey: string, variantKeyStr: string): number => {
    const plant = allPlants[plantKey];
    if (!plant) return 0;
    const vKeys = variantKeyStr.split('+');
    return Math.floor(calculateStackedValue(plant.value, vKeys, gameState.rebirths) * indexMoneyBonus);
  };

  const sellHarvested = (plantKey: string, variantKeyStr: string, amount: number) => {
    const currentCount = harvestedInventory[plantKey]?.[variantKeyStr] || 0;
    if (currentCount < amount) return;

    playSound('buy');
    const unitValue = getVariantValueFromKey(plantKey, variantKeyStr);
    const totalValue = unitValue * amount;

    setHarvestedInventory(prev => {
      const plantHarvest = { ...(prev[plantKey] || {}) };
      plantHarvest[variantKeyStr] -= amount;
      if (plantHarvest[variantKeyStr] <= 0) delete plantHarvest[variantKeyStr];
      if (Object.keys(plantHarvest).length === 0) {
        const next = { ...prev };
        delete next[plantKey];
        return next;
      }
      return { ...prev, [plantKey]: plantHarvest };
    });

    setGameState(prev => ({ ...prev, money: prev.money + totalValue }));
    notify({ title: `${amount}× verkauft! +$${totalValue}` });
  };

  const sellAll = (filter: 'all' | 'normal' | 'rare') => {
    let totalValue = 0;
    let totalCount = 0;

    const newInventory: HarvestedInventory = {};
    for (const [plantKey, plantVariants] of Object.entries(harvestedInventory)) {
      for (const [vKeyStr, count] of Object.entries(plantVariants)) {
        if (count <= 0) continue;
        const isNormal = vKeyStr === 'normal';
        const shouldSell = filter === 'all' || (filter === 'normal' && isNormal) || (filter === 'rare' && !isNormal);

        if (shouldSell) {
          totalValue += getVariantValueFromKey(plantKey, vKeyStr) * count;
          totalCount += count;
        } else {
          if (!newInventory[plantKey]) newInventory[plantKey] = {};
          newInventory[plantKey][vKeyStr] = count;
        }
      }
    }

    if (totalCount === 0) return;
    playSound('buy');
    setHarvestedInventory(newInventory);
    setGameState(prev => ({ ...prev, money: prev.money + totalValue }));
    notify({ title: `${totalCount}× verkauft! +$${totalValue}` });
  };

  const getTotalSellValue = (filter: 'all' | 'normal' | 'rare'): { value: number; count: number } => {
    let value = 0;
    let count = 0;
    for (const [plantKey, plantVariants] of Object.entries(harvestedInventory)) {
      for (const [vKeyStr, c] of Object.entries(plantVariants)) {
        if (c <= 0) continue;
        const isNormal = vKeyStr === 'normal';
        const match = filter === 'all' || (filter === 'normal' && isNormal) || (filter === 'rare' && !isNormal);
        if (match) {
          value += getVariantValueFromKey(plantKey, vKeyStr) * c;
          count += c;
        }
      }
    }
    return { value, count };
  };

  const waterField = (fieldIndex: number) => {
    if (waterCooldowns[fieldIndex] > 0) return;
    if (wateredFields[fieldIndex] > 0) return;

    // Chain cooldown
    const now = Date.now();
    if (now - lastWaterTimeRef.current > CHAIN_COOLDOWN_RESET) {
      waterChainRef.current = 0;
    }
    const chainDelay = waterChainRef.current * CHAIN_COOLDOWN_INCREMENT;
    if (chainDelay > 0) {
      // Apply chain delay as extra cooldown
    }
    waterChainRef.current++;
    lastWaterTimeRef.current = now;

    playSound('water');

    // Apply to range
    const range = waterStats.range;
    const fieldsToWater: number[] = [];
    const half = Math.floor(range / 2);
    for (let offset = -half; offset <= half; offset++) {
      const idx = fieldIndex + offset;
      if (idx >= 0 && idx < gameState.fields.length && gameState.fields[idx]?.unlocked && gameState.fields[idx]?.planted) {
        if (!wateredFields[idx] && !waterCooldowns[idx]) {
          fieldsToWater.push(idx);
        }
      }
    }
    if (fieldsToWater.length === 0) fieldsToWater.push(fieldIndex);

    setWateredFields(prev => {
      const next = { ...prev };
      fieldsToWater.forEach(idx => { next[idx] = waterStats.duration; });
      return next;
    });
    setWaterCooldowns(prev => {
      const next = { ...prev };
      fieldsToWater.forEach(idx => { next[idx] = waterStats.duration + waterStats.cooldown + chainDelay; });
      return next;
    });

    const rangeText = fieldsToWater.length > 1 ? ` (${fieldsToWater.length} Felder)` : '';
    notify({ title: `💧 Gegossen! ×${effectiveWaterSpeed.toFixed(1)}${rangeText}` });
  };

  const selectField = (index: number) => {
    playSound('click');
    if (Object.keys(gameState.inventory).some(k => gameState.inventory[k] > 0)) {
      setPlantSelectionModal({ show: true, fieldIndex: index });
    } else {
      notify({ title: 'Kaufe zuerst Samen im Händler!' });
    }
  };

  const doRebirth = () => {
    const cost = getRebirthCost(gameState.rebirths);
    if (gameState.money < cost) return;

    playSound('rebirth');
    const newRebirths = gameState.rebirths + 1;
    const tokens = getRebirthTokens(gameState.rebirths);
    const newTokens = gameState.rebirthTokens + tokens;
    const preservedShop = { ...gameState.rebirthShop };
    const preservedDiscovered = { ...gameState.discoveredVariants };

    const newState = createDefaultState(preservedShop);
    newState.rebirths = newRebirths;
    newState.rebirthTokens = newTokens;
    newState.discoveredVariants = preservedDiscovered;
    newState.rebirthShop = preservedShop;

    setGameState(newState);
    setHarvestedInventory({});
    setRebirthModal(false);
    notify({ title: `🔄 Rebirth ${newRebirths}! +${tokens} Token${tokens > 1 ? 's' : ''}!` });
  };

  const buyRebirthUpgrade = (key: keyof RebirthShopState) => {
    const def = rebirthShopDefs.find(d => d.key === key);
    if (!def) return;
    const currentLevel = gameState.rebirthShop[key];
    if (currentLevel >= def.maxLevel) return;
    const cost = def.costs[currentLevel];
    if (gameState.rebirthTokens < cost) return;

    playSound('buy');
    setGameState(prev => ({
      ...prev,
      rebirthTokens: prev.rebirthTokens - cost,
      rebirthShop: { ...prev.rebirthShop, [key]: prev.rebirthShop[key] + 1 },
    }));
    notify({ title: `${def.emoji} ${def.name} verbessert!` });
  };

  const buyWaterUpgrade = (key: keyof WaterUpgradeState) => {
    const def = waterUpgradeDefs.find(d => d.key === key);
    if (!def) return;
    const currentLevel = gameState.waterUpgrades[key];
    if (currentLevel >= def.maxLevel) return;
    const cost = def.costs[currentLevel];
    if (gameState.money < cost) return;

    playSound('buy');
    setGameState(prev => ({
      ...prev,
      money: prev.money - cost,
      waterUpgrades: { ...prev.waterUpgrades, [key]: prev.waterUpgrades[key] + 1 },
    }));
    notify({ title: `💧 ${def.name} verbessert!` });
  };

  // === COMPUTED ===
  const totalHarvestedCount = Object.values(harvestedInventory).reduce(
    (total, pv) => total + Object.values(pv).reduce((a, b) => a + b, 0), 0
  );
  const rebirthCost = getRebirthCost(gameState.rebirths);
  const rebirthMulti = 1 + 0.1 * gameState.rebirths;
  const nextTokens = getRebirthTokens(gameState.rebirths);

  const getVariantDisplay = (vKeyStr: string): { label: string; color: string; emoji: string } => {
    const parts = vKeyStr.split('+');
    if (parts.length === 1) {
      const v = variants[parts[0]];
      return { label: v?.name || parts[0], color: v?.color || '', emoji: v?.emoji || '' };
    }
    const labels = parts.map(p => variants[p]?.name || p);
    const emojis = parts.map(p => variants[p]?.emoji || '').join('');
    const bestPart = parts.sort((a, b) => variantKeys.indexOf(b) - variantKeys.indexOf(a))[0];
    return { label: labels.join(' + '), color: variants[bestPart]?.color || '', emoji: emojis };
  };

  // === RENDER ===
  return (
    <div className="min-h-screen bg-gradient-sky relative">
      {/* Particles */}
      {particles.length > 0 && (
        <div className="fixed inset-0 pointer-events-none z-[100]">
          {particles.map(p => {
            const col = p.x % 2;
            const row = Math.floor(p.x / 2);
            const baseX = col * 50 + 25;
            const baseY = row * 180 + 120;
            return (
              <span key={p.id} className="animate-particle absolute text-2xl"
                style={{ left: `${baseX}%`, top: `${baseY}px`, '--px': `${p.px}px`, '--py': `${p.py}px` } as React.CSSProperties}>
                {p.emoji}
              </span>
            );
          })}
        </div>
      )}

      {/* Event Banner */}
      {activeEvent && (
        <div className="bg-purple-600 text-white text-center py-2 px-4 text-sm font-bold animate-pulse">
          {activeEvent.emoji} {activeEvent.name}! Fokus: {variants[activeEvent.focusVariant].name} ×4 | Alle ×2 | {formatTime(eventTimeLeft)}
        </div>
      )}

      {/* Header */}
      <div className="bg-card/90 p-3 flex justify-between items-center shadow-lg">
        <div className="flex items-center gap-2 flex-wrap">
          <div className="text-lg font-bold text-farm-money">💰 ${gameState.money.toLocaleString()}</div>
          {gameState.rebirths > 0 && (
            <div className="text-[10px] bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded-full font-bold">
              🔄{gameState.rebirths} ×{rebirthMulti.toFixed(1)}
            </div>
          )}
          {gameState.rebirthTokens > 0 && (
            <div className="text-[10px] bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full font-bold">
              🪙{gameState.rebirthTokens}
            </div>
          )}
        </div>
        <Button variant="secondary" size="icon" className="rounded-full h-8 w-8" onClick={() => setSettingsModal(true)}>
          ⚙️
        </Button>
      </div>

      {/* Offline Report */}
      {offlineReport && (
        <Card className="m-3 p-4 bg-blue-50 border-blue-200 text-center">
          <h3 className="font-bold text-sm mb-1">💤 Willkommen zurück!</h3>
          <p className="text-xs text-muted-foreground">Du warst {offlineReport.time} offline.</p>
          {offlineReport.grown > 0 && <p className="text-xs text-farm-money font-bold">{offlineReport.grown} Pflanzen fertig gewachsen!</p>}
          <p className="text-[10px] text-muted-foreground mt-1">Offline-Effizienz: {Math.round((BASE_OFFLINE_EFFICIENCY + gameState.rebirthShop.offlineEfficiency * 0.1) * 100)}%</p>
          <Button size="sm" className="mt-2" onClick={() => setOfflineReport(null)}>OK</Button>
        </Card>
      )}

      {/* Tutorial */}
      {showTutorial && !offlineReport && (
        <Card className="m-3 p-4 bg-yellow-100 border-yellow-300 text-center">
          <h2 className="text-lg font-bold text-yellow-800 mb-2">🌱 Willkommen!</h2>
          <div className="text-yellow-800 space-y-0.5 text-xs">
            <p>1. Samen kaufen 🛒 → 2. Pflanzen 🌱</p>
            <p>3. Gießen 💧 → 4. Ernten & Verkaufen 💰</p>
            <p>5. Seltene Varianten sammeln! ✨</p>
          </div>
          <Button onClick={() => setShowTutorial(false)} size="sm" className="mt-3">Los geht's!</Button>
        </Card>
      )}

      {/* Game Area - Fields */}
      <div className="p-3 pb-24 grid grid-cols-2 gap-2">
        {Array.from({ length: gameState.maxFields }, (_, i) => {
          const field = gameState.fields[i] || { id: i + 1, unlocked: false, planted: null, plantTime: 0, stage: 0, growStartTime: 0 };
          const isWatered = (wateredFields[i] || 0) > 0;
          const cooldown = waterCooldowns[i] || 0;
          const isFlashing = flashingFields[i] || false;

          return (
            <Card key={i}
              className={`p-2 text-center min-h-[140px] flex flex-col justify-center relative transition-all active:scale-95 ${
                !field.unlocked ? 'bg-farm-locked border-farm-locked opacity-70' : 'bg-farm-field border-farm-field-border'
              } ${isWatered ? 'ring-2 ring-blue-400' : ''} ${isFlashing ? 'animate-harvest-flash' : ''}`}>
              <div className="absolute top-0.5 left-1.5 bg-card/80 px-1.5 py-0.5 rounded-full text-[9px] font-bold">
                {i + 1}
              </div>

              {isWatered && (
                <div className="absolute top-0.5 right-1.5 text-[9px] bg-blue-400 text-white px-1 py-0.5 rounded-full">
                  💧{Math.ceil((wateredFields[i] || 0) / 1000)}s
                </div>
              )}

              {!field.unlocked ? (
                <>
                  <div className="text-4xl mb-1">🔒</div>
                  {i < fieldPrices.length && (
                    <>
                      <div className="text-secondary font-bold text-xs">${fieldPrices[i]}</div>
                      <Button onClick={() => buyField(i)} disabled={gameState.money < fieldPrices[i]} size="sm" className="mt-1 h-7 text-xs">Kaufen</Button>
                    </>
                  )}
                </>
              ) : !field.planted ? (
                <>
                  <div className="text-4xl mb-1">🌱</div>
                  <Button onClick={() => selectField(i)} size="sm" className="h-7 text-xs">Pflanzen</Button>
                </>
              ) : (
                <>
                  <div className="text-4xl mb-0.5">
                    {field.stage > 0 ? allPlants[field.planted]?.stages[field.stage - 1] : allPlants[field.planted]?.stages[0]}
                  </div>
                  <p className="text-[10px] mb-0.5">{allPlants[field.planted]?.name}</p>

                  {field.plantTime <= 0 ? (
                    <Button onClick={() => harvest(i)} size="sm" className="h-7 text-xs">Ernten</Button>
                  ) : (
                    <>
                      <div className="w-full h-2 bg-muted rounded-full overflow-hidden mb-0.5">
                        <div className="h-full bg-gradient-progress transition-all duration-500"
                          style={{ width: `${getFieldProgress(field) * 100}%` }} />
                      </div>
                      <div className="text-[9px] text-muted-foreground">{formatTime(field.plantTime)}</div>
                      <Button onClick={(e) => { e.stopPropagation(); waterField(i); }}
                        disabled={isWatered || cooldown > 0} size="sm" variant="outline" className="mt-0.5 text-[9px] h-6 px-1">
                        {isWatered ? `💧${Math.ceil((wateredFields[i] || 0) / 1000)}s` :
                         cooldown > 0 ? `⏳${Math.ceil(cooldown / 1000)}s` : `💧×${effectiveWaterSpeed.toFixed(1)}`}
                      </Button>
                    </>
                  )}
                </>
              )}
            </Card>
          );
        })}
      </div>

      {/* Bottom Navigation - 6 tabs */}
      <div className="fixed bottom-0 left-0 right-0 bg-card/95 p-1.5 flex justify-around shadow-lg z-50">
        {[
          { icon: '🛒', label: 'Händler', onClick: () => setShopModal(true) },
          { icon: '💧', label: 'Gießkanne', onClick: () => setWaterUpgradeModal(true) },
          { icon: '🌾', label: 'Ernte', onClick: () => setHarvestedModal(true), badge: totalHarvestedCount > 0 ? totalHarvestedCount : undefined },
          { icon: '📖', label: 'Index', onClick: () => setIndexModal(true) },
          { icon: '🪙', label: 'R-Shop', onClick: () => setRebirthShopModal(true), badge: gameState.rebirthTokens > 0 ? gameState.rebirthTokens : undefined },
          { icon: '🔄', label: 'Rebirth', onClick: () => setRebirthModal(true), badge: gameState.rebirths > 0 ? gameState.rebirths : undefined },
        ].map(({ icon, label, onClick, badge }) => (
          <Button key={label} variant="ghost" onClick={onClick}
            className="flex flex-col items-center gap-0 min-h-[44px] min-w-[44px] px-1 relative text-xs h-auto py-1">
            <span className="text-base">{icon}</span>
            <span className="text-[8px] leading-tight">{label}</span>
            {badge !== undefined && (
              <div className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-destructive text-destructive-foreground text-[8px] rounded-full flex items-center justify-center font-bold">
                {badge > 99 ? '99+' : badge}
              </div>
            )}
          </Button>
        ))}
      </div>

      {/* ===== MODALS ===== */}

      {/* Shop Modal - Tabs: Samen / Felder / Spezial */}
      <Dialog open={shopModal} onOpenChange={setShopModal}>
        <DialogContent className="max-w-[95vw] max-h-[80vh] overflow-y-auto">
          <DialogHeader><DialogTitle>🛒 Händler</DialogTitle></DialogHeader>
          <Tabs defaultValue="seeds">
            <TabsList className="w-full grid grid-cols-3">
              <TabsTrigger value="seeds" className="text-xs">🌱 Samen</TabsTrigger>
              <TabsTrigger value="fields" className="text-xs">🚜 Felder</TabsTrigger>
              <TabsTrigger value="special" className="text-xs">✨ Spezial</TabsTrigger>
            </TabsList>

            <TabsContent value="seeds" className="space-y-1.5 mt-2">
              {/* Buy amount selector */}
              <div className="flex gap-1 mb-2">
                {[1, 5, 10].map(n => (
                  <Button key={n} size="sm" variant={buyAmount === n ? 'default' : 'outline'}
                    onClick={() => setBuyAmount(n)} className="flex-1 h-7 text-xs">
                    ×{n}
                  </Button>
                ))}
                <Button size="sm" variant={buyAmount === -1 ? 'default' : 'outline'}
                  onClick={() => setBuyAmount(-1)} className="flex-1 h-7 text-xs">
                  Max
                </Button>
              </div>

              {Object.entries(plants).map(([key, plant]) => {
                const amt = buyAmount === -1 ? getMaxBuyable(key) : buyAmount;
                const cost = plant.price * (amt || 1);
                return (
                  <div key={key} className="flex items-center justify-between p-1.5 bg-muted rounded-lg text-xs">
                    <div className="flex items-center gap-1.5">
                      <span className="text-2xl">{plant.icon}</span>
                      <div>
                        <h3 className="font-semibold text-xs">{plant.name}</h3>
                        <p className="text-[10px] text-muted-foreground">${plant.price} | Wert: ${plant.value} | {formatTime(plant.growTime)}</p>
                      </div>
                    </div>
                    <Button onClick={() => buySeed(key, amt || 1)} disabled={gameState.money < cost || amt === 0} size="sm" className="h-7 text-[10px]">
                      {amt > 0 ? `${amt}× $${cost}` : 'Kaufen'}
                    </Button>
                  </div>
                );
              })}
            </TabsContent>

            <TabsContent value="fields" className="space-y-1.5 mt-2">
              {(() => {
                const items = Array.from({ length: gameState.maxFields }, (_, i) => {
                  const field = gameState.fields[i];
                  if (field?.unlocked) return null;
                  if (i >= fieldPrices.length) return null;
                  return (
                    <div key={i} className="flex items-center justify-between p-1.5 bg-muted rounded-lg text-xs">
                      <div className="flex items-center gap-1.5">
                        <span className="text-2xl">🚜</span>
                        <div>
                          <h3 className="font-semibold">Feld {i + 1}</h3>
                          <p className="text-[10px] text-muted-foreground">${fieldPrices[i]}</p>
                        </div>
                      </div>
                      <Button onClick={() => buyField(i)} disabled={gameState.money < fieldPrices[i]} size="sm" className="h-7 text-xs">Kaufen</Button>
                    </div>
                  );
                }).filter(Boolean);
                return items.length === 0
                  ? <p className="text-center text-muted-foreground text-xs">Alle Felder gekauft!</p>
                  : items;
              })()}
            </TabsContent>

            <TabsContent value="special" className="space-y-1.5 mt-2">
              <p className="text-[10px] text-muted-foreground mb-1">Rebirth-Pflanzen haben +50% bessere Varianten-Chancen</p>
              {Object.entries(rebirthPlants).map(([key, plant]) => {
                const unlocked = gameState.rebirths >= (plant.rebirthRequired || 0);
                const amt = buyAmount === -1 ? getMaxBuyable(key) : buyAmount;
                const cost = plant.price * (amt || 1);
                return (
                  <div key={key} className={`flex items-center justify-between p-1.5 bg-muted rounded-lg text-xs ${!unlocked ? 'opacity-40' : ''}`}>
                    <div className="flex items-center gap-1.5">
                      <span className="text-2xl">{plant.icon}</span>
                      <div>
                        <h3 className="font-semibold text-xs">{plant.name}</h3>
                        <p className="text-[10px] text-muted-foreground">${plant.price} | Wert: ${plant.value} | {formatTime(plant.growTime)}</p>
                        {!unlocked && <p className="text-[10px] text-destructive font-bold">🔒 {plant.rebirthRequired} Rebirths nötig</p>}
                      </div>
                    </div>
                    <Button onClick={() => buySeed(key, amt || 1)}
                      disabled={!unlocked || gameState.money < cost || amt === 0}
                      size="sm" className="h-7 text-[10px]">
                      {unlocked ? (amt > 0 ? `${amt}× $${cost}` : 'Kaufen') : '🔒'}
                    </Button>
                  </div>
                );
              })}
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>

      {/* Water Upgrade Modal */}
      <Dialog open={waterUpgradeModal} onOpenChange={setWaterUpgradeModal}>
        <DialogContent className="max-w-[95vw] max-h-[80vh] overflow-y-auto">
          <DialogHeader><DialogTitle>💧 Gießkannen-Upgrades</DialogTitle></DialogHeader>
          <div className="p-2 bg-blue-50 rounded-lg mb-2 text-xs space-y-0.5">
            <p>⏱️ Dauer: <strong>{waterStats.duration / 1000}s</strong></p>
            <p>💪 Stärke: <strong>×{effectiveWaterSpeed.toFixed(1)}</strong></p>
            <p>🎯 Reichweite: <strong>{waterStats.range} Felder</strong></p>
            <p>⚡ Cooldown: <strong>{waterStats.cooldown / 1000}s</strong></p>
          </div>
          <div className="space-y-2">
            {waterUpgradeDefs.map(def => {
              const level = gameState.waterUpgrades[def.key];
              const isMax = level >= def.maxLevel;
              const cost = isMax ? 0 : def.costs[level];
              return (
                <div key={def.key} className="p-2 bg-muted rounded-lg">
                  <div className="flex justify-between items-center">
                    <div>
                      <h3 className="font-semibold text-xs">{def.name} (Lv. {level}/{def.maxLevel})</h3>
                      {!isMax && <p className="text-[10px] text-muted-foreground">{def.description(level)}</p>}
                      {isMax && <p className="text-[10px] text-farm-money font-bold">✅ Max</p>}
                    </div>
                    {!isMax && (
                      <Button onClick={() => buyWaterUpgrade(def.key)} disabled={gameState.money < cost}
                        size="sm" className="h-7 text-[10px]">
                        ${cost}
                      </Button>
                    )}
                  </div>
                  <Progress value={(level / def.maxLevel) * 100} className="h-1.5 mt-1" />
                </div>
              );
            })}
          </div>
        </DialogContent>
      </Dialog>

      {/* Harvested Inventory Modal - with Sell All */}
      <Dialog open={harvestedModal} onOpenChange={setHarvestedModal}>
        <DialogContent className="max-w-[95vw] max-h-[80vh] overflow-y-auto">
          <DialogHeader><DialogTitle>🌾 Ernte-Inventar</DialogTitle></DialogHeader>

          {Object.keys(harvestedInventory).length > 0 && (
            <div className="flex gap-1 flex-wrap mb-2">
              {(['all', 'normal', 'rare'] as const).map(filter => {
                const { value, count } = getTotalSellValue(filter);
                if (count === 0) return null;
                const labels = { all: 'Alles', normal: 'Nur Normal', rare: 'Nur Selten' };
                return (
                  <Button key={filter} size="sm" variant="outline" onClick={() => sellAll(filter)}
                    className="text-[10px] h-7 flex-1">
                    {labels[filter]} ({count}× ${value})
                  </Button>
                );
              })}
            </div>
          )}

          <div className="space-y-1.5">
            {Object.keys(harvestedInventory).length === 0 ? (
              <p className="text-center text-muted-foreground text-xs">Keine Ernte.</p>
            ) : (
              Object.entries(harvestedInventory).map(([plantKey, plantVariants]) => {
                const plant = allPlants[plantKey] || { ...plants, ...rebirthPlants }[plantKey];
                if (!plant) return null;
                return Object.entries(plantVariants).map(([vKeyStr, count]) => {
                  if (count <= 0) return null;
                  const display = getVariantDisplay(vKeyStr);
                  const unitValue = getVariantValueFromKey(plantKey, vKeyStr);
                  return (
                    <div key={`${plantKey}-${vKeyStr}`} className="flex items-center justify-between p-1.5 bg-muted rounded-lg text-xs">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xl">{plant.icon}</span>
                        <div>
                          <h3 className={`font-semibold text-xs ${display.color}`}>
                            {display.emoji} {plant.name} {display.label !== 'Normal' ? `(${display.label})` : ''}
                          </h3>
                          <p className="text-[10px] text-muted-foreground">×{count} | ${unitValue}/Stk</p>
                        </div>
                      </div>
                      <div className="flex gap-1">
                        <Button size="sm" className="text-[10px] h-6 px-2" onClick={() => sellHarvested(plantKey, vKeyStr, 1)}>
                          1× ${unitValue}
                        </Button>
                        {count > 1 && (
                          <Button size="sm" className="text-[10px] h-6 px-2" onClick={() => sellHarvested(plantKey, vKeyStr, count)}>
                            All ${unitValue * count}
                          </Button>
                        )}
                      </div>
                    </div>
                  );
                });
              })
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Index Modal */}
      <Dialog open={indexModal} onOpenChange={setIndexModal}>
        <DialogContent className="max-w-[95vw] max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>📖 Index ({discoveredCount}/{totalVariantsCount} - {Math.round(indexCompletion * 100)}%)</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            {Object.entries({ ...plants, ...rebirthPlants }).map(([plantKey, plant]) => {
              const discovered = gameState.discoveredVariants[plantKey] || [];
              return (
                <div key={plantKey} className="p-2 bg-muted rounded-lg">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xl">{plant.icon}</span>
                    <div className="flex-1">
                      <h3 className="font-semibold text-xs">{plant.name} ({discovered.length}/{variantKeys.length})</h3>
                      <Progress value={(discovered.length / variantKeys.length) * 100} className="h-1.5 mt-0.5" />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-0.5">
                    {variantKeys.map(vKey => {
                      const variant = variants[vKey];
                      const found = discovered.includes(vKey);
                      return (
                        <div key={vKey} className={`text-[9px] p-0.5 rounded ${found ? 'bg-card' : 'bg-card/40'}`}>
                          {found ? (
                            <span className={variant.color}>{variant.emoji} {variant.name} ×{variant.multiplier}</span>
                          ) : (
                            <span className="text-muted-foreground">??? (1:{variant.chance})</span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </DialogContent>
      </Dialog>

      {/* Rebirth Shop Modal */}
      <Dialog open={rebirthShopModal} onOpenChange={setRebirthShopModal}>
        <DialogContent className="max-w-[95vw] max-h-[80vh] overflow-y-auto">
          <DialogHeader><DialogTitle>🪙 Rebirth-Shop</DialogTitle></DialogHeader>
          <p className="text-xs text-muted-foreground mb-2">
            🪙 Tokens: <strong>{gameState.rebirthTokens}</strong> | Permanente Upgrades (bleiben nach Rebirth)
          </p>
          <div className="space-y-2">
            {rebirthShopDefs.map(def => {
              const level = gameState.rebirthShop[def.key];
              const isMax = level >= def.maxLevel;
              const cost = isMax ? 0 : def.costs[level];
              return (
                <div key={def.key} className="p-2 bg-muted rounded-lg">
                  <div className="flex justify-between items-center">
                    <div>
                      <h3 className="font-semibold text-xs">{def.emoji} {def.name} (Lv. {level}/{def.maxLevel})</h3>
                      {!isMax && <p className="text-[10px] text-muted-foreground">{def.description(level)}</p>}
                      {isMax && <p className="text-[10px] text-farm-money font-bold">✅ Max</p>}
                    </div>
                    {!isMax && (
                      <Button onClick={() => buyRebirthUpgrade(def.key)}
                        disabled={gameState.rebirthTokens < cost}
                        size="sm" className="h-7 text-[10px]">
                        🪙{cost}
                      </Button>
                    )}
                  </div>
                  <Progress value={(level / def.maxLevel) * 100} className="h-1.5 mt-1" />
                </div>
              );
            })}
          </div>
        </DialogContent>
      </Dialog>

      {/* Settings Modal */}
      <Dialog open={settingsModal} onOpenChange={setSettingsModal}>
        <DialogContent className="max-w-[95vw] max-h-[80vh] overflow-y-auto">
          <DialogHeader><DialogTitle>⚙️ Einstellungen</DialogTitle></DialogHeader>
          <div className="space-y-2">
            <div className="flex items-center justify-between p-2 bg-muted rounded-lg">
              <div>
                <h3 className="font-semibold text-xs">🔔 Benachrichtigungen</h3>
                <p className="text-[10px] text-muted-foreground">Toast-Nachrichten</p>
              </div>
              <Switch checked={soundSettings.notifications}
                onCheckedChange={(c) => setSoundSettings(prev => ({ ...prev, notifications: c }))} />
            </div>
            <div className="border-t pt-1" />
            {([
              { key: 'music' as const, label: '🎵 Musik', desc: 'Hintergrund' },
              { key: 'water' as const, label: '💧 Gießen', desc: 'Sound' },
              { key: 'harvest' as const, label: '🌾 Ernte', desc: 'Sound' },
              { key: 'buy' as const, label: '🛒 Kauf', desc: 'Sound' },
              { key: 'drop' as const, label: '✨ Drop', desc: 'Selten' },
              { key: 'event' as const, label: '🎉 Event', desc: 'Start' },
              { key: 'rebirth' as const, label: '🔄 Rebirth', desc: 'Sound' },
            ]).map(({ key, label, desc }) => (
              <div key={key} className="flex items-center justify-between p-1.5 bg-muted rounded-lg">
                <div>
                  <h3 className="font-semibold text-xs">{label}</h3>
                  <p className="text-[10px] text-muted-foreground">{desc}</p>
                </div>
                <Switch checked={soundSettings[key]}
                  onCheckedChange={(c) => setSoundSettings(prev => ({ ...prev, [key]: c }))} />
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      {/* Rebirth Modal */}
      <Dialog open={rebirthModal} onOpenChange={setRebirthModal}>
        <DialogContent className="max-w-[85vw]">
          <DialogHeader><DialogTitle>🔄 Rebirth</DialogTitle></DialogHeader>
          <div className="text-xs space-y-1.5">
            <p>Rebirths: <strong>{gameState.rebirths}</strong> | Multi: <strong>×{rebirthMulti.toFixed(1)}</strong></p>
            <p>Kosten: <strong>${rebirthCost.toLocaleString()}</strong></p>
            <p>Du erhältst: <strong>🪙 {nextTokens} Token{nextTokens > 1 ? 's' : ''}</strong></p>
            <div className="border-t pt-1.5 mt-1.5">
              <p className="text-destructive font-bold">Verlierst: Geld, Felder, Inventar, Ernte</p>
              <p className="text-farm-money font-bold">Behältst: Index, Rebirth-Shop, Tokens</p>
              <p>Neuer Multi: <strong>×{(1 + 0.1 * (gameState.rebirths + 1)).toFixed(1)}</strong></p>
            </div>
          </div>
          <div className="flex gap-2 mt-3">
            <Button variant="outline" onClick={() => setRebirthModal(false)} className="flex-1 text-xs">Nein</Button>
            <Button variant="destructive" onClick={doRebirth} disabled={gameState.money < rebirthCost} className="flex-1 text-xs">
              🔄 Rebirth! (${rebirthCost.toLocaleString()})
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Plant Selection Modal */}
      <Dialog open={plantSelectionModal.show} onOpenChange={(open) => setPlantSelectionModal({ show: open, fieldIndex: -1 })}>
        <DialogContent className="max-w-[95vw] max-h-[80vh] overflow-y-auto">
          <DialogHeader><DialogTitle>🌱 Was pflanzen?</DialogTitle></DialogHeader>
          <div className="space-y-1.5">
            {Object.entries(gameState.inventory).filter(([_, c]) => c > 0).map(([key, count]) => {
              const plant = allPlants[key];
              if (!plant) return null;
              return (
                <div key={key} className="flex items-center justify-between p-1.5 bg-muted rounded-lg text-xs">
                  <div className="flex items-center gap-1.5">
                    <span className="text-2xl">{plant.icon}</span>
                    <div>
                      <h3 className="font-semibold">{plant.name} ×{count}</h3>
                      <p className="text-[10px] text-muted-foreground">{formatTime(plant.growTime)}</p>
                    </div>
                  </div>
                  <Button onClick={() => plantSeed(key, plantSelectionModal.fieldIndex)} size="sm" className="h-7 text-xs">Pflanzen</Button>
                </div>
              );
            })}
          </div>
        </DialogContent>
      </Dialog>

      {/* Variant Popup - stacked variants */}
      <Dialog open={!!variantPopup?.show} onOpenChange={() => setVariantPopup(null)}>
        <DialogContent className="max-w-[80vw] text-center animate-scale-bounce">
          <div className="space-y-2 py-3">
            <div className="text-5xl">{allPlants[variantPopup?.plantKey || '']?.icon}</div>
            {variantPopup?.variants.map((vKey, i) => (
              <div key={i} className={`text-xl font-bold ${variants[vKey]?.color}`}>
                {variants[vKey]?.emoji} {variants[vKey]?.name}!
              </div>
            ))}
            {(variantPopup?.variants.length || 0) > 1 && (
              <div className="text-xs text-purple-500 font-bold animate-pulse">🔥 MULTI-STACK!</div>
            )}
            <div className="text-sm font-semibold">{allPlants[variantPopup?.plantKey || '']?.name}</div>
            <div className="text-lg text-farm-money font-bold">Wert: ${variantPopup?.value}</div>
            <Button onClick={() => setVariantPopup(null)} className="w-full" size="sm">Super! 🎉</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
