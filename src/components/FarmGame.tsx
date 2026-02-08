import { useState, useEffect, useCallback, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Card } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useToast } from '@/hooks/use-toast';
import { useFarmSounds, musicTracks } from '@/hooks/use-farm-sounds';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { rebirthMilestones } from '@/lib/farm-milestones';
import TutorialModal from '@/components/TutorialModal';
import AbilitiesModal from '@/components/AbilitiesModal';
import FarmerPanel, { getFarmerConfig, getFarmerUpgradeCost, type FarmerHarvestSummary } from '@/components/FarmerPanel';
import type { Field, GameState, HarvestedInventory, SoundSettings, GameEvent as GEvent, WaterUpgradeState, RebirthShopState, AutoSellMode, FarmerState, MusicTrack } from '@/lib/farm-types';
import {
  plants, rebirthPlants, getAllPlants, variants, variantKeys,
  eventTypes, pickRandomEvent, fieldPrices, getRebirthCost, getRebirthTokens,
  rollStackedVariants, calculateValue, calculateStackedValue,
  EVENT_INTERVAL, EVENT_DURATION,
  getWaterStats, waterUpgradeDefs,
  rebirthShopDefs,
  BASE_OFFLINE_EFFICIENCY, MAX_OFFLINE_HOURS,
  CHAIN_COOLDOWN_INCREMENT, CHAIN_COOLDOWN_RESET,
  rollVariant,
} from '@/lib/farm-data';
import {
  hasMilestone, getMilestoneGrowthMult, getMilestoneGoldMult,
  getStartMoney, MAX_GROW_TIME, multiRebirthOptions, rebirthFieldCosts,
} from '@/lib/farm-milestones';

const GAME_VERSION = '0.4.1';

const SAVE_KEY = 'farmGame4';
const HARVEST_KEY = 'farmHarvested4';

const defaultSoundSettings: SoundSettings = {
  music: true, musicTrack: 'standard', musicVolume: 0.5, plantSounds: true, uiSounds: true, eventRebirthSounds: true, masterVolume: 0.8, notifications: true,
};

const defaultWaterUpgrades: WaterUpgradeState = { duration: 0, strength: 0, range: 0, cooldownReduction: 0 };
const defaultRebirthShop: RebirthShopState = { offlineEfficiency: 0, variantChance: 0, eventBonus: 0, waterStrength: 0, fieldStart: 0, indexBonus: 0 };
const defaultFarmer: FarmerState = { unlocked: false, level: 1, slots: [], inventory: [], autoReplant: true };

function createDefaultState(rebirthShop?: RebirthShopState, rebirths?: number, rebirthFieldsBought?: number): GameState {
  const startFields: Field[] = [];
  const extraFields = rebirthShop?.fieldStart || 0;
  const totalStartFields = 1 + extraFields;
  // Add rebirth fields (permanent)
  const rFields = rebirthFieldsBought || 0;
  const totalFields = totalStartFields + rFields;
  for (let i = 0; i < totalFields; i++) {
    startFields.push({ id: i + 1, unlocked: true, planted: null, plantTime: 0, stage: 0, growStartTime: 0 });
  }
  const r = rebirths || 0;
  return {
    money: getStartMoney(r),
    fields: startFields,
    inventory: {},
    lastUpdate: Date.now(),
    maxFields: 10 + rFields,
    rebirths: 0,
    rebirthTokens: 0,
    discoveredVariants: {},
    eventStartTime: null,
    eventType: null,
    waterUpgrades: { ...defaultWaterUpgrades },
    rebirthShop: rebirthShop ? { ...rebirthShop } : { ...defaultRebirthShop },
    autoHarvest: false,
    autoSell: 'off',
    autoWater: false,
    rebirthFieldsBought: rFields,
    milestoneTokensClaimed: false,
    startMoneyUsed: false,
    lastPlanted: {},
    tutorialCompleted: false,
    farmer: { ...defaultFarmer },
    seenMilestones: [],
    disableMilestonePopups: false,
  };
}

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

  const [gameState, setGameState] = useState<GameState>(() => createDefaultState());
  const [harvestedInventory, setHarvestedInventory] = useState<HarvestedInventory>({});
  const [soundSettings, setSoundSettings] = useState<SoundSettings>(defaultSoundSettings);
  const { playSound, previewTrack } = useFarmSounds(soundSettings);

  // UI state
  const [showTutorial, setShowTutorial] = useState(false);
  const [tutorialModal, setTutorialModal] = useState(false);
  const [shopModal, setShopModal] = useState(false);
  const [harvestedModal, setHarvestedModal] = useState(false);
  const [settingsModal, setSettingsModal] = useState(false);
  const [indexModal, setIndexModal] = useState(false);
  const [rebirthModal, setRebirthModal] = useState(false);
  const [waterUpgradeModal, setWaterUpgradeModal] = useState(false);
  const [rebirthShopModal, setRebirthShopModal] = useState(false);
  const [abilitiesModal, setAbilitiesModal] = useState(false);
  const [farmerModal, setFarmerModal] = useState(false);
  const [adminModal, setAdminModal] = useState(false);
  const [cheatMode, setCheatMode] = useState(false);
  const [cheatTokens, setCheatTokens] = useState(false);
  const [keepMoneyOnRebirth, setKeepMoneyOnRebirth] = useState(false);
  const [milestonePopup, setMilestonePopup] = useState<{ key: string; name: string; description: string; icon: string; rebirth: number } | null>(null);
  const [farmerHarvestSummary, setFarmerHarvestSummary] = useState<FarmerHarvestSummary | null>(null);
  const versionClickRef = useRef(0);
  const versionClickTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  
  const [offlineReport, setOfflineReport] = useState<{ time: string; grown: number } | null>(null);
  const [plantSelectionModal, setPlantSelectionModal] = useState<{ show: boolean; fieldIndex: number }>({ show: false, fieldIndex: -1 });
  const [variantPopup, setVariantPopup] = useState<{ show: boolean; plantKey: string; variants: string[]; value: number } | null>(null);
  const [buyAmount, setBuyAmount] = useState<number>(1);

  // Animation state
  const [flashingFields, setFlashingFields] = useState<Record<number, boolean>>({});
  const [particles, setParticles] = useState<Particle[]>([]);

  // Watering state
  const [wateredFields, setWateredFields] = useState<Record<number, number>>({});
  const [waterCooldowns, setWaterCooldowns] = useState<Record<number, number>>({});

  // Chain cooldown
  const lastWaterTimeRef = useRef<number>(0);
  const waterChainRef = useRef<number>(0);

  // Auto-harvest timing
  const lastAutoHarvestRef = useRef<number>(0);
  const lastAutoWaterRef = useRef<number>(0);

  const [tick, setTick] = useState(0);

  // Cheat: keep money/tokens at max
  useEffect(() => {
    if (cheatMode && gameState.money < 999999999) {
      setGameState(prev => ({ ...prev, money: 999999999 }));
    }
    if (cheatTokens && gameState.rebirthTokens < 999999) {
      setGameState(prev => ({ ...prev, rebirthTokens: 999999 }));
    }
  }, [cheatMode, cheatTokens, gameState.money, gameState.rebirthTokens]);

  // Computed
  const waterStats = getWaterStats(gameState.waterUpgrades);
  const waterStrengthBonus = gameState.rebirthShop.waterStrength * 0.25;
  const effectiveWaterSpeed = waterStats.speedMult + waterStrengthBonus;
  const growthMult = getMilestoneGrowthMult(gameState.rebirths);

  const notify = useCallback((options: { title: string; description?: string }) => {
    if (soundSettings.notifications) toast(options);
  }, [soundSettings.notifications, toast]);

  const activeEvent: GEvent | null = (() => {
    if (!gameState.eventStartTime || !gameState.eventType) return null;
    const elapsed = Date.now() - gameState.eventStartTime;
    if (elapsed > EVENT_DURATION) return null;
    return eventTypes.find(e => e.focusVariant === gameState.eventType) || null;
  })();

  const eventTimeLeft = gameState.eventStartTime ? Math.max(0, EVENT_DURATION - (Date.now() - gameState.eventStartTime)) : 0;
  const allPlants = getAllPlants(gameState.rebirths);

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
    const cappedGrowTime = Math.min(plant.growTime, MAX_GROW_TIME);
    if (field.plantTime <= 0) return 1;
    return Math.max(0, Math.min(1, 1 - field.plantTime / cappedGrowTime));
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
        id: ++particleIdCounter, x: 0, y: 0,
        emoji: emojis[Math.floor(Math.random() * emojis.length)],
        px: (Math.random() - 0.5) * 120, py: -(Math.random() * 80 + 40),
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
    localStorage.setItem(SAVE_KEY, JSON.stringify(toSave));
    localStorage.setItem(HARVEST_KEY, JSON.stringify(harvestedInventory));
    localStorage.setItem('farmSounds', JSON.stringify(soundSettings));
  }, [gameState, harvestedInventory, soundSettings]);

  const loadGame = useCallback(() => {
    try {
      // Try new key first, fall back to old
      let saved = localStorage.getItem(SAVE_KEY);
      if (!saved) saved = localStorage.getItem('farmGame3');
      if (saved) {
        const loaded: GameState = JSON.parse(saved);
        const now = Date.now();
        const timePassed = Math.min(now - loaded.lastUpdate, MAX_OFFLINE_HOURS * 3600000);

        const offlineEff = BASE_OFFLINE_EFFICIENCY + (loaded.rebirthShop?.offlineEfficiency || 0) * 0.1;
        const offlineMs = timePassed * Math.min(offlineEff, 1);
        let grownCount = 0;

        loaded.fields.forEach(field => {
          if (field.planted && field.plantTime > 0) {
            field.plantTime = Math.max(0, field.plantTime - offlineMs);
            if (field.plantTime <= 0) {
              field.stage = 3;
              field.plantTime = 0;
              grownCount++;
            }
          }
          if (!field.growStartTime) field.growStartTime = 0;
        });

        // Migrate
        if (loaded.rebirths === undefined) loaded.rebirths = 0;
        if (!loaded.discoveredVariants) loaded.discoveredVariants = {};
        if (!loaded.waterUpgrades) loaded.waterUpgrades = { ...defaultWaterUpgrades };
        if (!loaded.rebirthShop) loaded.rebirthShop = { ...defaultRebirthShop };
        if (loaded.rebirthTokens === undefined) loaded.rebirthTokens = 0;
        if (loaded.autoHarvest === undefined) loaded.autoHarvest = false;
        if (loaded.autoSell === undefined) loaded.autoSell = 'off';
        if (loaded.autoWater === undefined) loaded.autoWater = false;
        if (loaded.rebirthFieldsBought === undefined) loaded.rebirthFieldsBought = 0;
        if (loaded.milestoneTokensClaimed === undefined) loaded.milestoneTokensClaimed = false;
        if (loaded.startMoneyUsed === undefined) loaded.startMoneyUsed = false;
        // Update 4 migration
        if (!loaded.lastPlanted) loaded.lastPlanted = {};
        if (loaded.tutorialCompleted === undefined) loaded.tutorialCompleted = false;
        if (!loaded.farmer) loaded.farmer = { ...defaultFarmer };
        if (!loaded.farmer.inventory) loaded.farmer.inventory = [];
        if (loaded.farmer.autoReplant === undefined) loaded.farmer.autoReplant = true;
        // Update 5 migration
        if (!loaded.seenMilestones) loaded.seenMilestones = [];
        if (loaded.disableMilestonePopups === undefined) loaded.disableMilestonePopups = false;
        // Farmer offline progress
        if (loaded.farmer?.slots?.length > 0) {
          loaded.farmer.slots = loaded.farmer.slots.map(slot => {
            const elapsed = now - slot.startTime;
            return { ...slot, done: elapsed >= slot.duration };
          });
        }
        loaded.lastUpdate = now;
        setGameState(loaded);
        
        if (!loaded.tutorialCompleted) {
          setTutorialModal(true);
        }

        if (timePassed > 60000) {
          const mins = Math.floor(timePassed / 60000);
          const timeStr = mins >= 60 ? `${Math.floor(mins / 60)}h ${mins % 60}m` : `${mins}m`;
          setOfflineReport({ time: timeStr, grown: grownCount });
        }
      }

      let savedHarvested = localStorage.getItem(HARVEST_KEY);
      if (!savedHarvested) savedHarvested = localStorage.getItem('farmHarvested3');
      if (savedHarvested) setHarvestedInventory(JSON.parse(savedHarvested));

      const savedSounds = localStorage.getItem('farmSounds');
      if (savedSounds) {
        const parsed = JSON.parse(savedSounds);
        // Migrate old format
        if (parsed.water !== undefined && parsed.plantSounds === undefined) {
          parsed.plantSounds = true;
          parsed.uiSounds = true;
          parsed.eventRebirthSounds = true;
          parsed.masterVolume = 0.8;
          delete parsed.water; delete parsed.harvest; delete parsed.buy;
          delete parsed.drop; delete parsed.event; delete parsed.rebirth;
        }
        if (parsed.notifications === undefined) parsed.notifications = true;
        if (parsed.masterVolume === undefined) parsed.masterVolume = 0.8;
        if (!parsed.musicTrack) parsed.musicTrack = 'standard';
        if (parsed.musicVolume === undefined) parsed.musicVolume = 0.5;
        setSoundSettings(parsed);
      }
      // Fresh start: show tutorial
      if (!saved) {
        setTutorialModal(true);
      }
    } catch { /* Fresh start */ setTutorialModal(true); }
  }, []);

  // === HARVEST LOGIC (shared by manual + auto) ===
  const doHarvest = useCallback((fieldIndex: number, isAuto: boolean = false) => {
    // Read current state directly to avoid closure issues
    setGameState(prev => {
      const field = prev.fields[fieldIndex];
      if (!field?.planted || field.stage < 3 || field.plantTime > 0) return prev;

      const ap = getAllPlants(prev.rebirths);
      const plant = ap[field.planted];
      if (!plant) return prev;

      const goldMult = getMilestoneGoldMult(prev.rebirths);
      const variantBonus = prev.rebirthShop.variantChance + (goldMult > 1 ? 10 : 0);
      const variantResult = rollStackedVariants(field.planted, plant, activeEvent, variantBonus);
      const value = calculateStackedValue(plant.value, variantResult, prev.rebirths);

      const idxComp = totalVariantsCount > 0 ? Object.values(prev.discoveredVariants).reduce((a, b) => a + b.length, 0) / totalVariantsCount : 0;
      const idxBonus = prev.rebirthShop.indexBonus > 0 ? 1 + (prev.rebirthShop.indexBonus * 0.01 * Math.floor(idxComp * 10)) : 1;
      const finalValue = Math.floor(value * idxBonus);
      const hasRare = variantResult.some(v => v !== 'normal');

      const plantKey = field.planted;

      const newFields = [...prev.fields];
      newFields[fieldIndex] = { ...newFields[fieldIndex], planted: null, plantTime: 0, stage: 0, growStartTime: 0 };

      const newDiscovered = { ...prev.discoveredVariants };
      if (!newDiscovered[plantKey]) newDiscovered[plantKey] = [];
      variantResult.forEach(v => {
        if (!newDiscovered[plantKey].includes(v)) {
          newDiscovered[plantKey] = [...newDiscovered[plantKey], v];
        }
      });

      // Auto-sell check
      const shouldAutoSell = isAuto && prev.autoSell !== 'off' && hasMilestone(prev.rebirths, 'autoSell');
      let autoSellValue = 0;
      let autoSold = false;
      if (shouldAutoSell) {
        const isNormal = !hasRare;
        const sell = prev.autoSell === 'all' ||
          (prev.autoSell === 'normal' && isNormal) ||
          (prev.autoSell === 'gold+' && !isNormal);
        if (sell) {
          autoSellValue = finalValue;
          autoSold = true;
        }
      }

      // Side effects (scheduled outside React state)
      setTimeout(() => {
        playSound(isAuto ? 'autoHarvest' : 'harvest');
        if (hasRare) playSound('drop');

        setFlashingFields(fp => ({ ...fp, [fieldIndex]: true }));
        setTimeout(() => setFlashingFields(fp => ({ ...fp, [fieldIndex]: false })), 400);

        if (hasRare) {
          const bestVariant = variantResult[variantResult.length - 1];
          spawnParticles(fieldIndex, bestVariant);
        }

        // Add to harvested inventory (if not auto-sold)
        if (!autoSold) {
          const storeKey = variantResult.length > 1 ? variantResult.join('+') : variantResult[0];
          setHarvestedInventory(hi => {
            const plantHarvest = { ...(hi[plantKey] || {}) };
            plantHarvest[storeKey] = (plantHarvest[storeKey] || 0) + 1;
            return { ...hi, [plantKey]: plantHarvest };
          });
        }

        if (hasRare && !isAuto) {
          setVariantPopup({ show: true, plantKey, variants: variantResult.filter(v => v !== 'normal'), value: finalValue });
        } else if (!isAuto) {
          notify({ title: `${plant.name} geerntet!` });
        }
      }, 0);

      return {
        ...prev,
        fields: newFields,
        discoveredVariants: newDiscovered,
        money: prev.money + autoSellValue,
      };
    });
  }, [activeEvent, totalVariantsCount, playSound, spawnParticles, notify]);

  // === MAIN GAME TICK ===
  useEffect(() => {
    const interval = setInterval(() => {
      setTick(t => t + 1);
      const now = Date.now();

      setGameState(prev => {
        let changed = false;
        const ws = getWaterStats(prev.waterUpgrades);
        const wsBonus = prev.rebirthShop.waterStrength * 0.25;
        const gMult = getMilestoneGrowthMult(prev.rebirths);
        const newFields = prev.fields.map((field, idx) => {
          if (!field.planted || field.plantTime <= 0) return field;

          const isWatered = (wateredFields[idx] || 0) > 0;
          const speed = (isWatered ? (ws.speedMult + wsBonus) : 1) * gMult;
          const reduction = 1000 * speed;
          const newTime = Math.max(0, field.plantTime - reduction);
          const ap = getAllPlants(prev.rebirths);
          const plant = ap[field.planted];
          if (!plant) return field;

          const cappedGrowTime = Math.min(plant.growTime, MAX_GROW_TIME);
          const progress = 1 - newTime / cappedGrowTime;
          const newStage = progress >= 0.66 ? 3 : progress >= 0.33 ? 2 : 1;

          if (newTime !== field.plantTime || newStage !== field.stage) {
            changed = true;
            if (newTime <= 0 && field.plantTime > 0) playSound('grow');
            return { ...field, plantTime: newTime, stage: newStage };
          }
          return field;
        });

        let eventStartTime = prev.eventStartTime;
        let eventType = prev.eventType;

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

        // Milestone: claim +5 tokens at rebirth 10 (one-time)
        let tokens = prev.rebirthTokens;
        let claimed = prev.milestoneTokensClaimed;
        if (prev.rebirths >= 10 && !prev.milestoneTokensClaimed) {
          tokens += 5;
          claimed = true;
          changed = true;
        }

        if (!changed) return prev;
        return { ...prev, fields: newFields, eventStartTime, eventType, rebirthTokens: tokens, milestoneTokensClaimed: claimed };
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

  // === AUTO-HARVEST (1/sec) ===
  useEffect(() => {
    if (!gameState.autoHarvest || !hasMilestone(gameState.rebirths, 'autoHarvest')) return;

    const interval = setInterval(() => {
      const now = Date.now();
      if (now - lastAutoHarvestRef.current < 1000) return;

      // Find oldest ripe field
      const ripeIdx = gameState.fields.findIndex(f => f.planted && f.plantTime <= 0 && f.stage >= 3);
      if (ripeIdx >= 0) {
        lastAutoHarvestRef.current = now;
        doHarvest(ripeIdx, true);
      }
    }, 500);

    return () => clearInterval(interval);
  }, [gameState.autoHarvest, gameState.rebirths, gameState.fields, doHarvest]);

  // === AUTO-WATER (smart, 1 every 3s) ===
  useEffect(() => {
    if (!gameState.autoWater || !hasMilestone(gameState.rebirths, 'autoWater')) return;

    const interval = setInterval(() => {
      const now = Date.now();
      if (now - lastAutoWaterRef.current < 3000) return;

      // Find a field that needs watering (>10s remaining, not already watered)
      const fieldIdx = gameState.fields.findIndex((f, idx) =>
        f.planted && f.plantTime > 10000 && !wateredFields[idx] && !waterCooldowns[idx]
      );
      if (fieldIdx >= 0) {
        lastAutoWaterRef.current = now;
        waterField(fieldIdx);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [gameState.autoWater, gameState.rebirths, gameState.fields, wateredFields, waterCooldowns]);

  // === FARMER AUTO-REPLANT ===
  useEffect(() => {
    if (!gameState.farmer.unlocked || !gameState.farmer.autoReplant) return;
    if (gameState.farmer.inventory.length === 0) return;

    const interval = setInterval(() => {
      const now = Date.now();
      const config = getFarmerConfig(gameState.farmer.level);
      const slotsUsed = gameState.farmer.slots.length;
      const slotsLeft = config.slots - slotsUsed;
      if (slotsLeft <= 0) return;

      // Check if any inventory has seeds
      const seedSlot = gameState.farmer.inventory.find(s => s.amount > 0);
      if (!seedSlot) return;

      const plant = allPlants[seedSlot.plantKey];
      if (!plant) return;

      const cappedGrowTime = Math.min(plant.growTime, MAX_GROW_TIME);
      const duration = cappedGrowTime * config.timeMult;

      setGameState(prev => {
        const invIdx = prev.farmer.inventory.findIndex(s => s.plantKey === seedSlot.plantKey && s.amount > 0);
        if (invIdx < 0) return prev;
        const cfg = getFarmerConfig(prev.farmer.level);
        const left = cfg.slots - prev.farmer.slots.length;
        if (left <= 0) return prev;

        const newInv = [...prev.farmer.inventory];
        newInv[invIdx] = { ...newInv[invIdx], amount: newInv[invIdx].amount - 1 };
        // Remove empty slots
        const filteredInv = newInv.filter(s => s.amount > 0);

        return {
          ...prev,
          farmer: {
            ...prev.farmer,
            inventory: filteredInv,
            slots: [...prev.farmer.slots, { plantKey: seedSlot.plantKey, startTime: now, duration, done: false }],
          },
        };
      });
    }, 2000);

    return () => clearInterval(interval);
  }, [gameState.farmer.unlocked, gameState.farmer.autoReplant, gameState.farmer.inventory, gameState.farmer.level, gameState.farmer.slots.length, allPlants]);


  // Autosave every 10s
  useEffect(() => { const i = setInterval(saveGame, 10000); return () => clearInterval(i); }, [saveGame]);
  useEffect(() => {
    window.addEventListener('beforeunload', saveGame);
    return () => window.removeEventListener('beforeunload', saveGame);
  }, [saveGame]);

  // === ACTIONS ===
  const buyField = (index: number) => {
    if (gameState.money >= fieldPrices[index]) {
      playSound('buy');
      setGameState(prev => {
        const newFields = [...prev.fields];
        while (newFields.length <= index) {
          newFields.push({ id: newFields.length + 1, unlocked: false, planted: null, plantTime: 0, stage: 0, growStartTime: 0 });
        }
        newFields[index] = { id: index + 1, unlocked: true, planted: null, plantTime: 0, stage: 0, growStartTime: 0 };
        return { ...prev, money: prev.money - fieldPrices[index], fields: newFields };
      });
      notify({ title: '🚜 Neues Feld gekauft!' });
      saveGame();
    }
  };

  const buySeed = (plantKey: string, amount: number = 1) => {
    const plant = { ...plants, ...rebirthPlants }[plantKey];
    if (!plant) return;

    // First-plant discount
    let price = plant.price;
    if (hasMilestone(gameState.rebirths, 'firstPlantDisc') && !gameState.startMoneyUsed && (gameState.inventory[plantKey] || 0) === 0) {
      price = Math.floor(price * 0.5);
    }
    const totalCost = price * amount;
    if (gameState.money < totalCost) return;

    playSound('buy');
    setGameState(prev => ({
      ...prev,
      money: prev.money - totalCost,
      inventory: { ...prev.inventory, [plantKey]: (prev.inventory[plantKey] || 0) + amount },
      startMoneyUsed: true,
    }));
    notify({ title: `${amount}× ${plant.name} gekauft!` });
    saveGame();
  };

  const getMaxBuyable = (plantKey: string): number => {
    const plant = { ...plants, ...rebirthPlants }[plantKey];
    if (!plant || plant.price <= 0) return 0;
    return Math.floor(gameState.money / plant.price);
  };

  const plantSeed = (plantKey: string, fieldIndex: number) => {
    if (gameState.inventory[plantKey] > 0) {
      playSound('plant');
      const plant = allPlants[plantKey];
      const cappedGrowTime = Math.min(plant.growTime, MAX_GROW_TIME);
      setGameState(prev => {
        const newFields = [...prev.fields];
        newFields[fieldIndex] = {
          ...newFields[fieldIndex],
          planted: plantKey,
          plantTime: cappedGrowTime,
          stage: 1,
          growStartTime: Date.now(),
        };
        return {
          ...prev,
          fields: newFields,
          inventory: { ...prev.inventory, [plantKey]: prev.inventory[plantKey] - 1 },
          lastPlanted: { ...prev.lastPlanted, [fieldIndex]: plantKey },
        };
      });
      notify({ title: `${plant.name} gepflanzt!` });
      setPlantSelectionModal({ show: false, fieldIndex: -1 });
      saveGame();
    }
  };

  const replant = (fieldIndex: number) => {
    const lastKey = gameState.lastPlanted[fieldIndex];
    if (!lastKey) { notify({ title: 'Kein letzter Samen bekannt!' }); return; }
    const plant = allPlants[lastKey];
    if (!plant) { notify({ title: 'Nicht verfügbar!' }); return; }
    if ((gameState.inventory[lastKey] || 0) <= 0) { notify({ title: `Keine ${plant.name} mehr!` }); return; }
    plantSeed(lastKey, fieldIndex);
  };

  // === FARMER ACTIONS ===
  const buyFarmer = () => {
    if (gameState.rebirthTokens < 3) return;
    playSound('buy');
    setGameState(prev => ({
      ...prev,
      rebirthTokens: prev.rebirthTokens - 3,
      farmer: { unlocked: true, level: 1, slots: [], inventory: [], autoReplant: true },
    }));
    notify({ title: '👨‍🌾 Farmer eingestellt!' });
    saveGame();
  };

  const upgradeFarmer = () => {
    const currentLevel = gameState.farmer.level;
    if (currentLevel >= 9999) return;
    const cost = getFarmerUpgradeCost(currentLevel);
    if (gameState.rebirthTokens < cost) return;
    playSound('buy');
    const nextLevel = currentLevel + 1;
    setGameState(prev => ({
      ...prev,
      rebirthTokens: prev.rebirthTokens - cost,
      farmer: { ...prev.farmer, level: nextLevel },
    }));
    notify({ title: `👨‍🌾 Farmer → Lv. ${nextLevel}!` });
    saveGame();
  };

  const giveSeedsToFarmer = (plantKey: string, amount: number) => {
    const plant = allPlants[plantKey];
    if (!plant) return;
    
    // Check if farmer inventory is full (max 3 seed types)
    const existingIdx = gameState.farmer.inventory.findIndex(s => s.plantKey === plantKey);
    if (existingIdx < 0 && gameState.farmer.inventory.length >= 3) {
      playSound('wrong');
      notify({ title: '❌ Farmer-Inventar voll (max 3 Seed-Typen)' });
      return;
    }
    
    if ((gameState.inventory[plantKey] || 0) < amount || amount <= 0) {
      playSound('wrong');
      notify({ title: '❌ Nicht genug Seeds' });
      return;
    }

    playSound('plant');

    setGameState(prev => {
      const newInv = [...prev.farmer.inventory];
      const eIdx = newInv.findIndex(s => s.plantKey === plantKey);
      if (eIdx >= 0) {
        newInv[eIdx] = { ...newInv[eIdx], amount: newInv[eIdx].amount + amount };
      } else {
        newInv.push({ plantKey, amount });
      }
      return {
        ...prev,
        inventory: { ...prev.inventory, [plantKey]: prev.inventory[plantKey] - amount },
        farmer: { ...prev.farmer, inventory: newInv },
      };
    });
    notify({ title: `👨‍🌾 ${amount}× ${plant.name} übergeben!` });
    saveGame();
  };

  const collectFarmerSlot = (slotIndex: number) => {
    const slot = gameState.farmer.slots[slotIndex];
    if (!slot) return;
    const elapsed = Date.now() - slot.startTime;
    if (elapsed < slot.duration) return;

    playSound('harvest');
    const plant = allPlants[slot.plantKey];
    if (!plant) return;

    // Roll variants for farmer harvest
    const goldMult = getMilestoneGoldMult(gameState.rebirths);
    const variantBonus = gameState.rebirthShop.variantChance + (goldMult > 1 ? 10 : 0);
    const variantResult = rollStackedVariants(slot.plantKey, plant, activeEvent, variantBonus);
    const storeKey = variantResult.length > 1 ? variantResult.join('+') : variantResult[0];
    const value = calculateStackedValue(plant.value, variantResult, gameState.rebirths);

    // Build summary item
    const summaryItem = {
      plantKey: slot.plantKey,
      plantName: plant.name,
      icon: plant.icon,
      variants: storeKey,
      count: 1,
      value,
    };

    // Show harvest summary
    setFarmerHarvestSummary(prev => {
      if (!prev) return { items: [summaryItem], totalValue: value };
      const existing = prev.items.find(i => i.plantKey === summaryItem.plantKey && i.variants === summaryItem.variants);
      if (existing) {
        existing.count += 1;
        return { items: [...prev.items], totalValue: prev.totalValue + value };
      }
      return { items: [...prev.items, summaryItem], totalValue: prev.totalValue + value };
    });

    setHarvestedInventory(hi => {
      const plantHarvest = { ...(hi[slot.plantKey] || {}) };
      plantHarvest[storeKey] = (plantHarvest[storeKey] || 0) + 1;
      return { ...hi, [slot.plantKey]: plantHarvest };
    });

    // Update discovered variants
    setGameState(prev => {
      const newDiscovered = { ...prev.discoveredVariants };
      if (!newDiscovered[slot.plantKey]) newDiscovered[slot.plantKey] = [];
      variantResult.forEach(v => {
        if (!newDiscovered[slot.plantKey].includes(v)) {
          newDiscovered[slot.plantKey] = [...newDiscovered[slot.plantKey], v];
        }
      });
      const newSlots = prev.farmer.slots.filter((_, i) => i !== slotIndex);
      return { ...prev, discoveredVariants: newDiscovered, farmer: { ...prev.farmer, slots: newSlots } };
    });

    saveGame();
  };

  const collectAllFarmerSlots = () => {
    const now = Date.now();
    const doneIndices = gameState.farmer.slots
      .map((s, i) => (now - s.startTime >= s.duration ? i : -1))
      .filter(i => i >= 0)
      .reverse();
    setFarmerHarvestSummary(null); // Reset before batch
    doneIndices.forEach(i => collectFarmerSlot(i));
  };

  const sellFarmerHarvest = () => {
    if (!farmerHarvestSummary) return;
    playSound('sell');
    // Remove from harvested inventory and add money
    let totalValue = 0;
    setHarvestedInventory(prev => {
      const next = { ...prev };
      for (const item of farmerHarvestSummary.items) {
        if (next[item.plantKey]?.[item.variants]) {
          next[item.plantKey][item.variants] -= item.count;
          if (next[item.plantKey][item.variants] <= 0) delete next[item.plantKey][item.variants];
          if (Object.keys(next[item.plantKey]).length === 0) delete next[item.plantKey];
        }
        totalValue += item.value * item.count;
      }
      return next;
    });
    setGameState(prev => ({ ...prev, money: prev.money + totalValue }));
    setFarmerHarvestSummary(null);
    notify({ title: `💰 Farmer-Ernte verkauft! +$${totalValue}` });
    saveGame();
  };
  const harvest = (fieldIndex: number) => {
    const field = gameState.fields[fieldIndex];
    if (!field.planted || field.stage < 3 || field.plantTime > 0) return;
    doHarvest(fieldIndex, false);
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

    playSound('sell');
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
    saveGame();
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
    playSound('sell');
    setHarvestedInventory(newInventory);
    setGameState(prev => ({ ...prev, money: prev.money + totalValue }));
    notify({ title: `${totalCount}× verkauft! +$${totalValue}` });
    saveGame();
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

    const now = Date.now();
    if (now - lastWaterTimeRef.current > CHAIN_COOLDOWN_RESET) {
      waterChainRef.current = 0;
    }
    const chainDelay = waterChainRef.current * CHAIN_COOLDOWN_INCREMENT;
    waterChainRef.current++;
    lastWaterTimeRef.current = now;

    playSound('water');

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

  const doRebirth = (multiCount: number = 1) => {
    const option = multiRebirthOptions.find(o => o.count === multiCount) || multiRebirthOptions[0];
    const baseCost = getRebirthCost(gameState.rebirths);
    const totalCost = Math.floor(baseCost * option.costMult);
    if (!cheatMode && gameState.money < totalCost) return;

    playSound('rebirth');
    const newRebirths = gameState.rebirths + multiCount;

    // Calculate tokens for each rebirth level
    let totalTokens = 0;
    for (let i = 0; i < multiCount; i++) {
      totalTokens += getRebirthTokens(gameState.rebirths + i);
    }
    totalTokens = Math.floor(totalTokens * option.tokenPenalty);

    const newTokens = gameState.rebirthTokens + totalTokens;
    const preservedShop = { ...gameState.rebirthShop };
    const preservedDiscovered = { ...gameState.discoveredVariants };
    const preservedRebirthFields = gameState.rebirthFieldsBought;
    const preservedMilestoneClaimed = gameState.milestoneTokensClaimed;

    const newState = createDefaultState(preservedShop, newRebirths, preservedRebirthFields);
    newState.rebirths = newRebirths;
    newState.rebirthTokens = newTokens;
    newState.discoveredVariants = preservedDiscovered;
    newState.rebirthShop = preservedShop;
    newState.rebirthFieldsBought = preservedRebirthFields;
    newState.milestoneTokensClaimed = preservedMilestoneClaimed;
    // Preserve auto settings
    newState.autoHarvest = hasMilestone(newRebirths, 'autoHarvest') ? gameState.autoHarvest : false;
    newState.autoSell = hasMilestone(newRebirths, 'autoSell') ? gameState.autoSell : 'off';
    newState.autoWater = hasMilestone(newRebirths, 'autoWater') ? gameState.autoWater : false;
    // Preserve farmer & tutorial
    newState.farmer = gameState.farmer.unlocked ? { ...gameState.farmer, slots: [] } : { ...gameState.farmer };
    newState.tutorialCompleted = gameState.tutorialCompleted;
    newState.lastPlanted = {}; // Reset last planted on rebirth
    // Preserve milestone popup state
    newState.seenMilestones = gameState.seenMilestones;
    newState.disableMilestonePopups = gameState.disableMilestonePopups;

    if (keepMoneyOnRebirth) {
      newState.money = gameState.money;
    }
    if (cheatMode) {
      newState.money = 999999999;
    }
    setGameState(newState);
    setHarvestedInventory({});
    setRebirthModal(false);

    // Check for newly unlocked milestones
    if (!gameState.disableMilestonePopups) {
      const newMilestone = rebirthMilestones.find(m =>
        newRebirths >= m.rebirth &&
        gameState.rebirths < m.rebirth &&
        !gameState.seenMilestones.includes(m.key)
      );
      if (newMilestone) {
        setMilestonePopup({ key: newMilestone.key, name: newMilestone.name, description: newMilestone.description, icon: newMilestone.icon, rebirth: newMilestone.rebirth });
        setGameState(prev => ({ ...prev, seenMilestones: [...prev.seenMilestones, newMilestone.key] }));
      }
    }

    notify({ title: `🔄 Rebirth ${newRebirths}! +${totalTokens} Token${totalTokens > 1 ? 's' : ''}!` });
    saveGame();
  };

  const buyRebirthField = () => {
    const idx = gameState.rebirthFieldsBought;
    if (idx >= rebirthFieldCosts.length) return;
    const cost = rebirthFieldCosts[idx];
    if (gameState.rebirthTokens < cost) return;

    playSound('buy');
    setGameState(prev => {
      const newFields = [...prev.fields];
      const newFieldId = newFields.length + 1;
      newFields.push({ id: newFieldId, unlocked: true, planted: null, plantTime: 0, stage: 0, growStartTime: 0 });
      return {
        ...prev,
        rebirthTokens: prev.rebirthTokens - cost,
        rebirthFieldsBought: prev.rebirthFieldsBought + 1,
        maxFields: prev.maxFields + 1,
        fields: newFields,
      };
    });
    notify({ title: '🪙 Permanentes Rebirth-Feld gekauft!' });
    saveGame();
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
    saveGame();
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
    saveGame();
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
          <div className="text-lg font-bold text-farm-money">💰 ${cheatMode ? '∞' : gameState.money.toLocaleString()}</div>
          {gameState.rebirths > 0 && (
            <div className="text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded-full font-bold">
              🔄{gameState.rebirths} ×{rebirthMulti.toFixed(1)}
            </div>
          )}
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="text-[10px] bg-secondary/20 text-secondary-foreground px-1.5 py-0.5 rounded-full font-bold cursor-help flex items-center gap-0.5">
                  🔁 {cheatTokens ? '∞' : gameState.rebirthTokens} <span className="text-[8px] opacity-60">?</span>
                </div>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="max-w-[200px] text-xs">
                <p className="font-bold">Rebirth Tokens</p>
                <p className="text-[10px] text-muted-foreground">Erhältst du durch Rebirthen. Diese Währung wird für permanente Upgrades verwendet.</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
          {gameState.autoHarvest && hasMilestone(gameState.rebirths, 'autoHarvest') && (
            <div className="text-[10px] bg-green-100 text-green-700 px-1.5 py-0.5 rounded-full font-bold">🤖</div>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          <Button variant="secondary" size="icon" className="rounded-full h-8 w-8" onClick={() => setAbilitiesModal(true)}>
            ⭐
          </Button>
          <Button variant="secondary" size="icon" className="rounded-full h-8 w-8" onClick={() => setSettingsModal(true)}>
            ⚙️
          </Button>
        </div>
      </div>

      {/* Offline Report - dismissible overlay */}
      {offlineReport && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center" onClick={() => setOfflineReport(null)}>
          <Card className="mx-6 p-4 bg-card border-border text-center shadow-xl animate-in fade-in-0 zoom-in-95 max-w-[300px]">
            <h3 className="font-bold text-sm mb-1">💤 Willkommen zurück!</h3>
            <p className="text-xs text-muted-foreground">Du warst {offlineReport.time} offline.</p>
            {offlineReport.grown > 0 && <p className="text-xs text-farm-money font-bold">{offlineReport.grown} Pflanzen fertig gewachsen!</p>}
            <p className="text-[10px] text-muted-foreground mt-1">Tippe irgendwo zum Schließen</p>
          </Card>
        </div>
      )}

      {/* Tutorial Modal */}
      <TutorialModal open={tutorialModal} onClose={() => {
        setTutorialModal(false);
        setGameState(prev => ({ ...prev, tutorialCompleted: true }));
        saveGame();
      }}
        soundSettings={soundSettings}
        onSoundSettingsChange={setSoundSettings}
        previewTrack={previewTrack}
      />

      {/* Game Area - Fields */}
      <div className="p-3 pb-24 grid grid-cols-2 gap-2">
        {Array.from({ length: gameState.maxFields }, (_, i) => {
          const field = gameState.fields[i] || { id: i + 1, unlocked: false, planted: null, plantTime: 0, stage: 0, growStartTime: 0 };
          const isWatered = (wateredFields[i] || 0) > 0;
          const cooldown = waterCooldowns[i] || 0;
          const isFlashing = flashingFields[i] || false;
          const isRebirthField = i >= 10; // fields beyond normal 10 are rebirth fields

          return (
            <Card key={i}
              className={`p-2 text-center min-h-[140px] flex flex-col justify-center relative transition-all active:scale-95 ${
                !field.unlocked ? 'bg-farm-locked border-farm-locked opacity-70' : 'bg-farm-field border-farm-field-border'
              } ${isWatered ? 'ring-2 ring-blue-400' : ''} ${isFlashing ? 'animate-harvest-flash' : ''} ${isRebirthField && field.unlocked ? 'ring-1 ring-amber-400' : ''}`}>
              <div className="absolute top-0.5 left-1.5 bg-card/80 px-1.5 py-0.5 rounded-full text-[9px] font-bold">
                {isRebirthField ? '🪙' : ''}{i + 1}
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
                  <div className="flex gap-1">
                    <Button onClick={() => selectField(i)} size="sm" className="h-7 text-xs flex-1">Pflanzen</Button>
                    {gameState.lastPlanted[i] && (gameState.inventory[gameState.lastPlanted[i]] || 0) > 0 && (
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button onClick={() => replant(i)} size="sm" variant="outline" className="h-7 text-xs px-1.5">↻</Button>
                          </TooltipTrigger>
                          <TooltipContent side="top" className="text-[10px]">
                            {allPlants[gameState.lastPlanted[i]]?.name} erneut pflanzen
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    )}
                  </div>
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

      {/* Bottom Navigation - 7 tabs */}
      <div className="fixed bottom-0 left-0 right-0 bg-card/95 p-1.5 flex justify-around shadow-lg z-50">
        {[
          { icon: '🛒', label: 'Händler', onClick: () => setShopModal(true) },
          { icon: '💧', label: 'Gießkanne', onClick: () => setWaterUpgradeModal(true) },
          { icon: '🌾', label: 'Ernte', onClick: () => setHarvestedModal(true), badge: totalHarvestedCount > 0 ? totalHarvestedCount : undefined },
          { icon: '📖', label: 'Index', onClick: () => setIndexModal(true) },
          { icon: '👨‍🌾', label: 'Farmer', onClick: () => setFarmerModal(true), badge: gameState.farmer.slots.filter(s => Date.now() - s.startTime >= s.duration).length > 0 ? gameState.farmer.slots.filter(s => Date.now() - s.startTime >= s.duration).length : undefined },
          { icon: '🪙', label: 'R-Shop', onClick: () => setRebirthShopModal(true), badge: gameState.rebirthTokens > 0 ? gameState.rebirthTokens : undefined },
          { icon: '🔄', label: 'Rebirth', onClick: () => setRebirthModal(true), badge: gameState.rebirths > 0 ? gameState.rebirths : undefined },
        ].map(({ icon, label, onClick, badge }) => (
          <Button key={label} variant="ghost" onClick={onClick}
            className="flex flex-col items-center gap-0 min-h-[44px] min-w-[36px] px-0.5 relative text-xs h-auto py-1">
            <span className="text-base">{icon}</span>
            <span className="text-[7px] leading-tight">{label}</span>
            {badge !== undefined && (
              <div className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-destructive text-destructive-foreground text-[8px] rounded-full flex items-center justify-center font-bold">
                {badge > 99 ? '99+' : badge}
              </div>
            )}
          </Button>
        ))}
      </div>

      {/* ===== MODALS ===== */}

      {/* Shop Modal */}
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
              <div className="flex gap-1 mb-2">
                {[1, 5, 10].map(n => (
                  <Button key={n} size="sm" variant={buyAmount === n ? 'default' : 'outline'}
                    onClick={() => setBuyAmount(n)} className="flex-1 h-7 text-xs">
                    ×{n}
                  </Button>
                ))}
                <Button size="sm" variant={buyAmount === -1 ? 'default' : 'outline'}
                  onClick={() => setBuyAmount(-1)} className="flex-1 h-7 text-xs">
                  Max{buyAmount === -1 ? '' : ''}
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
                        <p className="text-[10px] text-muted-foreground">
                          ${plant.price} | Wert: ${plant.value} | {formatTime(Math.min(plant.growTime, MAX_GROW_TIME))}
                        </p>
                      </div>
                    </div>
                    <Button onClick={() => buySeed(key, amt || 1)} disabled={gameState.money < cost || amt === 0} size="sm" className="h-7 text-[10px]">
                      {buyAmount === -1 ? `Max (${amt}) $${cost}` : (amt > 0 ? `${amt}× $${cost}` : 'Kaufen')}
                    </Button>
                  </div>
                );
              })}
            </TabsContent>

            <TabsContent value="fields" className="space-y-1.5 mt-2">
              {/* Rebirth Fields */}
              {gameState.rebirthFieldsBought < rebirthFieldCosts.length && (
                <div className="mb-3">
                  <h3 className="text-xs font-bold mb-1">🪙 Permanente Rebirth-Felder</h3>
                  <p className="text-[10px] text-muted-foreground mb-1">Bleiben nach Rebirth freigeschaltet!</p>
                  {rebirthFieldCosts.map((cost, idx) => {
                    if (idx < gameState.rebirthFieldsBought) return null;
                    return (
                      <div key={idx} className="flex items-center justify-between p-1.5 bg-amber-50 rounded-lg text-xs border border-amber-200 mb-1">
                        <div className="flex items-center gap-1.5">
                          <span className="text-2xl">🪙</span>
                          <div>
                            <h3 className="font-semibold">Rebirth-Feld {String.fromCharCode(65 + idx)}</h3>
                            <p className="text-[10px] text-muted-foreground">🪙 {cost} Tokens</p>
                          </div>
                        </div>
                        <Button onClick={buyRebirthField} disabled={gameState.rebirthTokens < cost} size="sm" className="h-7 text-xs">
                          🪙{cost}
                        </Button>
                      </div>
                    );
                  })}
                  <div className="border-t my-2" />
                </div>
              )}

              {/* Normal Fields */}
              {(() => {
                const items = Array.from({ length: 10 }, (_, i) => {
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
                        <p className="text-[10px] text-muted-foreground">
                          ${plant.price} | Wert: ${plant.value} | {formatTime(Math.min(plant.growTime, MAX_GROW_TIME))}
                        </p>
                        {!unlocked && <p className="text-[10px] text-destructive font-bold">🔒 {plant.rebirthRequired} Rebirths nötig</p>}
                      </div>
                    </div>
                    <Button onClick={() => buySeed(key, amt || 1)}
                      disabled={!unlocked || gameState.money < cost || amt === 0}
                      size="sm" className="h-7 text-[10px]">
                      {unlocked ? (buyAmount === -1 ? `Max (${amt}) $${cost}` : (amt > 0 ? `${amt}× $${cost}` : 'Kaufen')) : '🔒'}
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

      {/* Harvested Inventory Modal */}
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

      {/* Rebirth Path Modal removed - now inline in Rebirth Modal */}

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

            {/* Master Volume */}
            <div className="p-2 bg-muted rounded-lg">
              <h3 className="font-semibold text-xs mb-1">🔊 Master-Lautstärke ({Math.round(soundSettings.masterVolume * 100)}%)</h3>
              <Slider value={[soundSettings.masterVolume]} min={0} max={1} step={0.05}
                onValueChange={([v]) => setSoundSettings(prev => ({ ...prev, masterVolume: v }))} />
            </div>

            {/* Music Section */}
            <div className="p-2 bg-muted rounded-lg space-y-2">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-xs">🎵 Musik</h3>
                <Switch checked={soundSettings.music}
                  onCheckedChange={(c) => setSoundSettings(prev => ({ ...prev, music: c }))} />
              </div>
              {soundSettings.music && (
                <>
                  <div>
                    <p className="text-[10px] text-muted-foreground mb-1">Musik-Lautstärke ({Math.round(soundSettings.musicVolume * 100)}%)</p>
                    <Slider value={[soundSettings.musicVolume]} min={0} max={1} step={0.05}
                      onValueChange={([v]) => setSoundSettings(prev => ({ ...prev, musicVolume: v }))} />
                  </div>
                  <RadioGroup value={soundSettings.musicTrack}
                    onValueChange={(v) => {
                      setSoundSettings(prev => ({ ...prev, musicTrack: v as MusicTrack }));
                    }}>
                    {musicTracks.map(track => (
                      <div key={track.key} className="flex items-center justify-between p-1.5 bg-card rounded-lg">
                        <div className="flex items-center gap-2">
                          <RadioGroupItem value={track.key} id={`track-${track.key}`} />
                          <label htmlFor={`track-${track.key}`} className="text-[11px] cursor-pointer">{track.name}</label>
                        </div>
                        <Button size="sm" variant="ghost" className="h-6 text-[9px] px-1.5"
                          onClick={(e) => { e.preventDefault(); previewTrack(track.key); }}>
                          ▶ Preview
                        </Button>
                      </div>
                    ))}
                  </RadioGroup>
                </>
              )}
            </div>

            {/* Sound Categories */}
            {([
              { key: 'plantSounds' as const, label: '🌱 Pflanzen-Sounds', desc: 'Pflanzen & Ernten' },
              { key: 'uiSounds' as const, label: '🔔 UI-Sounds', desc: 'Kaufen, Gießen, Drops' },
              { key: 'eventRebirthSounds' as const, label: '🎉 Event & Rebirth', desc: 'Events, Rebirth, Unlocks' },
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

            <div className="border-t pt-1" />
            {cheatMode && (
              <div className="p-2 bg-destructive/10 rounded-lg border border-destructive/30">
                <p className="text-[10px] text-destructive font-bold">⚠️ Cheat-Modus aktiv</p>
              </div>
            )}
            <Button variant="outline" onClick={() => setTutorialModal(true)} className="w-full text-xs h-8">
              📖 Tutorial ansehen
            </Button>
            <p
              className="text-[10px] text-muted-foreground text-center mt-2 cursor-default select-none"
              onClick={() => {
                versionClickRef.current += 1;
                if (versionClickTimerRef.current) clearTimeout(versionClickTimerRef.current);
                versionClickTimerRef.current = setTimeout(() => { versionClickRef.current = 0; }, 3000);
                if (versionClickRef.current >= 25) {
                  versionClickRef.current = 0;
                  setAdminModal(true);
                }
              }}
            >Version: {GAME_VERSION}</p>
          </div>
        </DialogContent>
      </Dialog>

      {/* Admin Modal */}
      <Dialog open={adminModal} onOpenChange={setAdminModal}>
        <DialogContent className="max-w-[95vw]">
          <DialogHeader><DialogTitle>🔧 Admin-Menü</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="flex items-center justify-between p-2 bg-destructive/10 rounded-lg border border-destructive/30">
              <div>
                <h3 className="font-semibold text-xs">💰 Unendlich Geld</h3>
                <p className="text-[10px] text-muted-foreground">Geld wird auf ∞ gesetzt</p>
              </div>
              <Switch checked={cheatMode} onCheckedChange={(c) => {
                setCheatMode(c);
                if (c) setGameState(prev => ({ ...prev, money: 999999999 }));
              }} />
            </div>
            <div className="flex items-center justify-between p-2 bg-destructive/10 rounded-lg border border-destructive/30">
              <div>
                <h3 className="font-semibold text-xs">🪙 Unendlich Tokens</h3>
                <p className="text-[10px] text-muted-foreground">Rebirth-Tokens auf ∞</p>
              </div>
              <Switch checked={cheatTokens} onCheckedChange={(c) => {
                setCheatTokens(c);
                if (c) setGameState(prev => ({ ...prev, rebirthTokens: 999999 }));
              }} />
            </div>
            <div className="flex items-center justify-between p-2 bg-destructive/10 rounded-lg border border-destructive/30">
              <div>
                <h3 className="font-semibold text-xs">🔄 Geld behalten bei Rebirth</h3>
                <p className="text-[10px] text-muted-foreground">Geld wird nicht zurückgesetzt</p>
              </div>
              <Switch checked={keepMoneyOnRebirth} onCheckedChange={setKeepMoneyOnRebirth} />
            </div>
            <p className="text-[9px] text-muted-foreground text-center">v{GAME_VERSION} • 25× Version geklickt</p>
          </div>
        </DialogContent>
      </Dialog>

      {/* Rebirth Modal - with Multi-Rebirth + Inline Path */}
      <Dialog open={rebirthModal} onOpenChange={setRebirthModal}>
        <DialogContent className="max-w-[95vw] max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>🔄 Rebirth</DialogTitle></DialogHeader>
          <div className="text-xs space-y-1.5">
            <p>Rebirths: <strong>{gameState.rebirths}</strong> | Multi: <strong>×{rebirthMulti.toFixed(1)}</strong></p>
            <div className="border-t pt-1.5 mt-1.5">
              <p className="text-destructive font-bold">Verlierst: Geld, Felder, Inventar, Ernte</p>
              <p className="text-farm-money font-bold">Behältst: Index, Rebirth-Shop, Tokens, Pfad</p>
            </div>
          </div>

          <div className="space-y-2 mt-2">
            {multiRebirthOptions.map(option => {
              const unlocked = gameState.rebirths >= option.requiredRebirth;
              const cost = Math.floor(getRebirthCost(gameState.rebirths) * option.costMult);
              let tokens = 0;
              for (let i = 0; i < option.count; i++) {
                tokens += getRebirthTokens(gameState.rebirths + i);
              }
              tokens = Math.floor(tokens * option.tokenPenalty);
              const canAfford = gameState.money >= cost;

              if (!unlocked && option.count > 1) {
                return (
                  <div key={option.count} className="p-2 bg-muted rounded-lg opacity-40 text-xs">
                    <div className="flex justify-between items-center">
                      <span>🔒 {option.count}× Rebirth</span>
                      <span className="text-muted-foreground">Ab Rebirth {option.requiredRebirth}</span>
                    </div>
                  </div>
                );
              }

              return (
                <div key={option.count} className="p-2 bg-muted rounded-lg">
                  <div className="flex justify-between items-center text-xs">
                    <div>
                      <h3 className="font-bold">{option.count}× Rebirth</h3>
                      <p className="text-[10px] text-muted-foreground">
                        ${cost.toLocaleString()} → 🪙{tokens} Token{tokens > 1 ? 's' : ''}
                        {option.tokenPenalty < 1 ? ` (${Math.round(option.tokenPenalty * 100)}%)` : ''}
                      </p>
                    </div>
                    <Button variant={option.count === 1 ? 'destructive' : 'default'}
                      onClick={() => doRebirth(option.count)}
                      disabled={!canAfford} size="sm" className="h-7 text-[10px]">
                      🔄 ${cost.toLocaleString()}
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Inline Rebirth Path */}
          <div className="border-t pt-3 mt-3">
            <h3 className="text-xs font-bold mb-2">🛤️ Rebirth-Pfad</h3>
            <div className="space-y-1.5 max-h-[200px] overflow-y-auto pr-1">
              {rebirthMilestones.map((milestone, idx) => {
                const unlocked = gameState.rebirths >= milestone.rebirth;
                return (
                  <div key={idx} className="flex items-center gap-2">
                    <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs shrink-0 border-2 ${
                      unlocked
                        ? 'bg-primary text-primary-foreground border-primary'
                        : 'bg-muted border-border text-muted-foreground'
                    }`}>
                      {unlocked ? milestone.icon : '?'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-1">
                        <span className={`text-[11px] font-bold truncate ${unlocked ? 'text-foreground' : 'text-muted-foreground'}`}>
                          {unlocked ? milestone.name : '???'}
                        </span>
                        <span className={`text-[9px] px-1 py-0.5 rounded-full shrink-0 ${
                          unlocked ? 'bg-primary text-primary-foreground' : 'bg-muted-foreground/20 text-muted-foreground'
                        }`}>R{milestone.rebirth}</span>
                      </div>
                      {unlocked && (
                        <p className="text-[9px] text-muted-foreground truncate">{milestone.description}</p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <Button variant="outline" onClick={() => setRebirthModal(false)} className="w-full text-xs mt-2">Abbrechen</Button>
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
                      <p className="text-[10px] text-muted-foreground">{formatTime(Math.min(plant.growTime, MAX_GROW_TIME))}</p>
                    </div>
                  </div>
                  <Button onClick={() => plantSeed(key, plantSelectionModal.fieldIndex)} size="sm" className="h-7 text-xs">Pflanzen</Button>
                </div>
              );
            })}
          </div>
        </DialogContent>
      </Dialog>

      {/* Variant Popup */}
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

      {/* Milestone Unlock Popup */}
      <Dialog open={!!milestonePopup} onOpenChange={() => setMilestonePopup(null)}>
        <DialogContent className="max-w-[85vw] text-center">
          <div className="space-y-3 py-3">
            <div className="text-5xl">{milestonePopup?.icon}</div>
            <h2 className="text-sm font-bold">🎉 Freigeschaltet! (Rebirth {milestonePopup?.rebirth})</h2>
            <h3 className="text-base font-bold">{milestonePopup?.name}</h3>
            <p className="text-xs text-muted-foreground">{milestonePopup?.description}</p>
            <p className="text-[10px] text-muted-foreground">Du findest das im Rebirth-Menü im Pfad.</p>
            <div className="flex gap-2">
              <Button onClick={() => setMilestonePopup(null)} className="flex-1 text-xs">OK</Button>
              <Button variant="outline" onClick={() => {
                setGameState(prev => ({ ...prev, disableMilestonePopups: true }));
                setMilestonePopup(null);
              }} className="flex-1 text-xs text-[10px]">
                Nicht mehr anzeigen
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Abilities Modal */}
      <AbilitiesModal
        open={abilitiesModal}
        onOpenChange={setAbilitiesModal}
        gameState={gameState}
        onToggleAutoHarvest={(v) => setGameState(prev => ({ ...prev, autoHarvest: v }))}
        onSetAutoSell={(mode) => setGameState(prev => ({ ...prev, autoSell: mode }))}
        onToggleAutoWater={(v) => setGameState(prev => ({ ...prev, autoWater: v }))}
        onToggleFarmerAutoReplant={() => setGameState(prev => ({ ...prev, farmer: { ...prev.farmer, autoReplant: !prev.farmer.autoReplant } }))}
      />

      {/* Farmer Panel */}
      <FarmerPanel
        open={farmerModal}
        onOpenChange={setFarmerModal}
        farmer={gameState.farmer}
        gameState={gameState}
        allPlants={allPlants}
        onBuyFarmer={buyFarmer}
        onUpgradeFarmer={upgradeFarmer}
        onGiveSeeds={giveSeedsToFarmer}
        onCollect={collectFarmerSlot}
        onCollectAll={collectAllFarmerSlots}
        onToggleAutoReplant={() => setGameState(prev => ({ ...prev, farmer: { ...prev.farmer, autoReplant: !prev.farmer.autoReplant } }))}
        formatTime={formatTime}
        harvestSummary={farmerHarvestSummary}
        onDismissSummary={() => setFarmerHarvestSummary(null)}
        onSellSummary={sellFarmerHarvest}
      />
    </div>
  );
}
