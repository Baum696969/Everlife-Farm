import { useState, useEffect, useCallback, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/hooks/use-toast';
import { useFarmSounds } from '@/hooks/use-farm-sounds';
import type { Field, GameState, HarvestedInventory, SoundSettings, GameEvent as GEvent } from '@/lib/farm-types';
import {
  plants, rebirthPlants, getAllPlants, variants, variantKeys,
  eventTypes, pickRandomEvent, fieldPrices, getRebirthCost,
  rollVariant, calculateValue,
  EVENT_INTERVAL, EVENT_DURATION,
  WATER_DURATION, WATER_COOLDOWN, WATER_SPEED_MULT,
} from '@/lib/farm-data';

const defaultSoundSettings: SoundSettings = {
  music: false, water: true, harvest: true, buy: true, drop: true, event: true, rebirth: true,
};

function createDefaultState(): GameState {
  return {
    money: 10,
    fields: [{ id: 1, unlocked: true, planted: null, plantTime: 0, stage: 0, growStartTime: 0 }],
    inventory: {},
    lastUpdate: Date.now(),
    maxFields: 10,
    rebirths: 0,
    discoveredVariants: {},
    eventStartTime: null,
    eventType: null,
  };
}

export default function FarmGame() {
  const { toast } = useToast();

  // Core state
  const [gameState, setGameState] = useState<GameState>(createDefaultState);
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
  const [plantSelectionModal, setPlantSelectionModal] = useState<{ show: boolean; fieldIndex: number }>({ show: false, fieldIndex: -1 });
  const [variantPopup, setVariantPopup] = useState<{ show: boolean; plantKey: string; variant: string; value: number } | null>(null);

  // Watering state (not persisted)
  const [wateredFields, setWateredFields] = useState<Record<number, number>>({}); // fieldIndex -> remaining ms
  const [waterCooldowns, setWaterCooldowns] = useState<Record<number, number>>({}); // fieldIndex -> remaining ms

  // Live tick counter for re-render
  const [tick, setTick] = useState(0);

  // Active event computed
  const activeEvent: GEvent | null = (() => {
    if (!gameState.eventStartTime || !gameState.eventType) return null;
    const elapsed = Date.now() - gameState.eventStartTime;
    if (elapsed > EVENT_DURATION) return null;
    return eventTypes.find(e => e.focusVariant === gameState.eventType) || null;
  })();

  const eventTimeLeft = gameState.eventStartTime ? Math.max(0, EVENT_DURATION - (Date.now() - gameState.eventStartTime)) : 0;

  // All available plants for current rebirth level
  const allPlants = getAllPlants(gameState.rebirths);

  // Format time
  const formatTime = (ms: number): string => {
    if (ms <= 0) return 'Fertig!';
    const minutes = Math.floor(ms / 60000);
    const seconds = Math.floor((ms % 60000) / 1000);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  // Get remaining grow time for a field (live)
  const getFieldTimeLeft = useCallback((field: Field): number => {
    if (!field.planted || field.plantTime <= 0) return 0;
    const plant = allPlants[field.planted];
    if (!plant) return 0;
    const elapsed = Date.now() - field.growStartTime;
    // Account for watering
    // Simplified: watering handled in tick
    return Math.max(0, field.plantTime);
  }, [allPlants]);

  // Get field progress (0-1)
  const getFieldProgress = useCallback((field: Field): number => {
    if (!field.planted) return 0;
    const plant = allPlants[field.planted];
    if (!plant) return 0;
    if (field.plantTime <= 0) return 1;
    return Math.max(0, Math.min(1, 1 - field.plantTime / plant.growTime));
  }, [allPlants]);

  // Get field stage from progress
  const getStageFromProgress = (progress: number): number => {
    if (progress >= 1) return 3;
    if (progress >= 0.66) return 3;
    if (progress >= 0.33) return 2;
    return 1;
  };

  // === SAVE / LOAD ===
  const saveGame = useCallback(() => {
    const toSave = { ...gameState, lastUpdate: Date.now() };
    localStorage.setItem('farmGame2', JSON.stringify(toSave));
    localStorage.setItem('farmHarvested2', JSON.stringify(harvestedInventory));
    localStorage.setItem('farmSounds', JSON.stringify(soundSettings));
  }, [gameState, harvestedInventory, soundSettings]);

  const loadGame = useCallback(() => {
    try {
      const saved = localStorage.getItem('farmGame2');
      if (saved) {
        const loaded: GameState = JSON.parse(saved);
        // Offline progress
        const now = Date.now();
        const timePassed = now - loaded.lastUpdate;
        loaded.fields.forEach(field => {
          if (field.planted && field.plantTime > 0) {
            field.plantTime = Math.max(0, field.plantTime - timePassed);
            if (field.plantTime <= 0) {
              field.stage = 3;
              field.plantTime = 0;
            }
          }
          // Ensure growStartTime exists
          if (!field.growStartTime) field.growStartTime = 0;
        });
        // Ensure new fields
        if (loaded.rebirths === undefined) loaded.rebirths = 0;
        if (!loaded.discoveredVariants) loaded.discoveredVariants = {};
        loaded.lastUpdate = now;
        setGameState(loaded);
        setShowTutorial(false);
      }

      const savedHarvested = localStorage.getItem('farmHarvested2');
      if (savedHarvested) setHarvestedInventory(JSON.parse(savedHarvested));

      const savedSounds = localStorage.getItem('farmSounds');
      if (savedSounds) setSoundSettings(JSON.parse(savedSounds));
    } catch {
      // Fresh start
    }
  }, []);

  // === MAIN GAME TICK (every second) ===
  useEffect(() => {
    const interval = setInterval(() => {
      setTick(t => t + 1);

      // Update plant growth
      setGameState(prev => {
        let changed = false;
        const newFields = prev.fields.map((field, idx) => {
          if (!field.planted || field.plantTime <= 0) return field;

          const isWatered = (wateredFields[idx] || 0) > 0;
          const reduction = isWatered ? 1000 * WATER_SPEED_MULT : 1000;
          const newTime = Math.max(0, field.plantTime - reduction);
          const plant = allPlants[field.planted];
          if (!plant) return field;

          const progress = 1 - newTime / plant.growTime;
          const newStage = getStageFromProgress(progress);

          if (newTime !== field.plantTime || newStage !== field.stage) {
            changed = true;
            if (newTime <= 0 && field.plantTime > 0) {
              playSound('grow');
            }
            return { ...field, plantTime: newTime, stage: newStage };
          }
          return field;
        });

        // Event management
        let eventStartTime = prev.eventStartTime;
        let eventType = prev.eventType;
        const now = Date.now();

        if (eventStartTime && now - eventStartTime > EVENT_DURATION) {
          eventStartTime = null;
          eventType = null;
          changed = true;
        }

        if (!eventStartTime) {
          // Check if it's time for new event (simplified: random chance each tick adjusted for 15min interval)
          // Actually use a deterministic approach: track last event end
          const lastEventEnd = prev.eventStartTime ? prev.eventStartTime + EVENT_DURATION : 0;
          if (now - lastEventEnd >= EVENT_INTERVAL || lastEventEnd === 0) {
            // Random chance per tick to start event (approximately once per 15 min)
            if (Math.random() < 1 / 900) { // ~1/900 ticks = ~once per 15 min
              const event = pickRandomEvent();
              eventStartTime = now;
              eventType = event.focusVariant;
              changed = true;
              playSound('event');
            }
          }
        }

        if (!changed) return prev;
        return { ...newFields !== prev.fields ? { ...prev, fields: newFields, eventStartTime, eventType } : { ...prev, eventStartTime, eventType } };
      });

      // Update watering timers
      setWateredFields(prev => {
        const next: Record<number, number> = {};
        let hasActive = false;
        for (const [k, v] of Object.entries(prev)) {
          const remaining = v - 1000;
          if (remaining > 0) {
            next[Number(k)] = remaining;
            hasActive = true;
          }
        }
        return hasActive ? next : {};
      });

      setWaterCooldowns(prev => {
        const next: Record<number, number> = {};
        let hasActive = false;
        for (const [k, v] of Object.entries(prev)) {
          const remaining = v - 1000;
          if (remaining > 0) {
            next[Number(k)] = remaining;
            hasActive = true;
          }
        }
        return hasActive ? next : {};
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [allPlants, wateredFields, playSound]);

  // Load on mount
  useEffect(() => { loadGame(); }, [loadGame]);

  // Save periodically
  useEffect(() => {
    const interval = setInterval(saveGame, 5000);
    return () => clearInterval(interval);
  }, [saveGame]);

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
      toast({ title: '🚜 Neues Feld gekauft!' });
    }
  };

  const buySeed = (plantKey: string) => {
    const plant = allPlants[plantKey];
    if (plant && gameState.money >= plant.price) {
      playSound('buy');
      setGameState(prev => ({
        ...prev,
        money: prev.money - plant.price,
        inventory: { ...prev.inventory, [plantKey]: (prev.inventory[plantKey] || 0) + 1 },
      }));
      toast({ title: `${plant.name} Samen gekauft!` });
    }
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
        return {
          ...prev,
          fields: newFields,
          inventory: { ...prev.inventory, [plantKey]: prev.inventory[plantKey] - 1 },
        };
      });
      toast({ title: `${allPlants[plantKey].name} gepflanzt!` });
      setPlantSelectionModal({ show: false, fieldIndex: -1 });
    }
  };

  const harvest = (fieldIndex: number) => {
    const field = gameState.fields[fieldIndex];
    if (!field.planted || field.stage < 3 || field.plantTime > 0) return;

    const plant = allPlants[field.planted];
    if (!plant) return;

    // Roll variant
    const variantKey = rollVariant(field.planted, plant, activeEvent);
    const variant = variants[variantKey];
    const value = calculateValue(plant.value, variantKey, gameState.rebirths);

    playSound('harvest');
    if (variantKey !== 'normal') {
      playSound('drop');
    }

    // Check if new variant discovered
    const plantKey = field.planted;
    const isNewVariant = !(gameState.discoveredVariants[plantKey]?.includes(variantKey));

    // Update harvested inventory with variant
    setHarvestedInventory(prev => {
      const plantHarvest = { ...(prev[plantKey] || {}) };
      plantHarvest[variantKey] = (plantHarvest[variantKey] || 0) + 1;
      return { ...prev, [plantKey]: plantHarvest };
    });

    // Update game state
    setGameState(prev => {
      const newFields = [...prev.fields];
      newFields[fieldIndex] = { ...newFields[fieldIndex], planted: null, plantTime: 0, stage: 0, growStartTime: 0 };
      const newDiscovered = { ...prev.discoveredVariants };
      if (!newDiscovered[plantKey]) newDiscovered[plantKey] = [];
      if (!newDiscovered[plantKey].includes(variantKey)) {
        newDiscovered[plantKey] = [...newDiscovered[plantKey], variantKey];
      }
      return { ...prev, fields: newFields, discoveredVariants: newDiscovered };
    });

    if (isNewVariant && variantKey !== 'normal') {
      playSound('newVariant');
      setVariantPopup({ show: true, plantKey, variant: variantKey, value });
    } else if (variantKey !== 'normal') {
      setVariantPopup({ show: true, plantKey, variant: variantKey, value });
    } else {
      toast({ title: `${plant.name} geerntet! (im Inventar)` });
    }
  };

  const sellHarvested = (plantKey: string, variantKey: string, amount: number) => {
    const plant = allPlants[plantKey];
    if (!plant) return;
    const currentCount = harvestedInventory[plantKey]?.[variantKey] || 0;
    if (currentCount < amount) return;

    playSound('buy');
    const totalValue = calculateValue(plant.value, variantKey, gameState.rebirths) * amount;

    setHarvestedInventory(prev => {
      const plantHarvest = { ...(prev[plantKey] || {}) };
      plantHarvest[variantKey] -= amount;
      if (plantHarvest[variantKey] <= 0) delete plantHarvest[variantKey];
      const isEmpty = Object.keys(plantHarvest).length === 0;
      if (isEmpty) {
        const next = { ...prev };
        delete next[plantKey];
        return next;
      }
      return { ...prev, [plantKey]: plantHarvest };
    });

    setGameState(prev => ({ ...prev, money: prev.money + totalValue }));
    toast({ title: `${amount}x ${plant.name} verkauft! +$${totalValue}` });
  };

  const waterField = (fieldIndex: number) => {
    if (waterCooldowns[fieldIndex] > 0) return;
    if (wateredFields[fieldIndex] > 0) return;

    playSound('water');
    setWateredFields(prev => ({ ...prev, [fieldIndex]: WATER_DURATION }));
    setWaterCooldowns(prev => ({ ...prev, [fieldIndex]: WATER_DURATION + WATER_COOLDOWN }));
    toast({ title: '💧 Feld gegossen! ×2 Geschwindigkeit!' });
  };

  const selectField = (index: number) => {
    playSound('click');
    if (Object.keys(gameState.inventory).some(k => gameState.inventory[k] > 0)) {
      setPlantSelectionModal({ show: true, fieldIndex: index });
    } else {
      toast({ title: 'Kaufe zuerst Samen im Händler!' });
    }
  };

  const doRebirth = () => {
    const cost = getRebirthCost(gameState.rebirths);
    if (gameState.money < cost) return;

    playSound('rebirth');
    setGameState(prev => ({
      ...createDefaultState(),
      rebirths: prev.rebirths + 1,
      discoveredVariants: prev.discoveredVariants,
      eventStartTime: null,
      eventType: null,
    }));
    setHarvestedInventory({});
    setRebirthModal(false);
    toast({ title: `🔄 Rebirth ${gameState.rebirths + 1}! +10% Multiplikator!` });
  };

  // === COMPUTED VALUES ===
  const totalHarvestedCount = Object.values(harvestedInventory).reduce(
    (total, plantVariants) => total + Object.values(plantVariants).reduce((a, b) => a + b, 0), 0
  );

  const rebirthCost = getRebirthCost(gameState.rebirths);
  const rebirthMulti = 1 + 0.1 * gameState.rebirths;

  // Index progress
  const totalVariants = Object.keys(allPlants).length * variantKeys.length;
  const discoveredCount = Object.values(gameState.discoveredVariants).reduce((a, b) => a + b.length, 0);

  // === RENDER ===
  return (
    <div className="min-h-screen bg-gradient-sky">
      {/* Event Banner */}
      {activeEvent && (
        <div className="bg-purple-600 text-white text-center py-2 px-4 text-sm font-bold animate-pulse">
          {activeEvent.emoji} {activeEvent.name}! Fokus: {variants[activeEvent.focusVariant].name} ×4 | Alle ×2 | {formatTime(eventTimeLeft)}
        </div>
      )}

      {/* Header */}
      <div className="bg-card/90 p-4 flex justify-between items-center shadow-lg">
        <div className="flex items-center gap-3">
          <div className="text-xl font-bold text-farm-money">💰 ${gameState.money}</div>
          {gameState.rebirths > 0 && (
            <div className="text-xs bg-purple-100 text-purple-700 px-2 py-1 rounded-full font-bold">
              🔄 {gameState.rebirths} (×{rebirthMulti.toFixed(1)})
            </div>
          )}
        </div>
        <Button variant="secondary" size="icon" className="rounded-full" onClick={() => setSettingsModal(true)}>
          ⚙️
        </Button>
      </div>

      {/* Tutorial */}
      {showTutorial && (
        <Card className="m-4 p-5 bg-yellow-100 border-yellow-300 text-center">
          <h2 className="text-xl font-bold text-yellow-800 mb-3">🌱 Willkommen beim Farm Clicker!</h2>
          <div className="text-yellow-800 space-y-1 text-sm">
            <p>1. Kaufe Samen im Händler 🛒</p>
            <p>2. Pflanze auf Felder 🌱</p>
            <p>3. Gieße für schnelleres Wachstum 💧</p>
            <p>4. Ernte → Inventar → Verkaufen! 💰</p>
            <p>5. Achte auf seltene Varianten! ✨</p>
          </div>
          <Button onClick={() => setShowTutorial(false)} className="mt-4">Los geht's!</Button>
        </Card>
      )}

      {/* Game Area */}
      <div className="p-3 pb-28 grid grid-cols-2 gap-3">
        {Array.from({ length: gameState.maxFields }, (_, i) => {
          const field = gameState.fields[i] || { id: i + 1, unlocked: false, planted: null, plantTime: 0, stage: 0, growStartTime: 0 };
          const isWatered = (wateredFields[i] || 0) > 0;
          const cooldown = waterCooldowns[i] || 0;

          return (
            <Card
              key={i}
              className={`p-3 text-center min-h-40 flex flex-col justify-center relative transition-all active:scale-95 ${
                !field.unlocked
                  ? 'bg-farm-locked border-farm-locked opacity-70'
                  : 'bg-farm-field border-farm-field-border'
              } ${isWatered ? 'ring-2 ring-blue-400' : ''}`}
            >
              <div className="absolute top-1 left-2 bg-card/80 px-2 py-0.5 rounded-full text-[10px] font-bold">
                Feld {i + 1}
              </div>

              {isWatered && (
                <div className="absolute top-1 right-2 text-xs bg-blue-400 text-white px-1.5 py-0.5 rounded-full">
                  💧 {Math.ceil((wateredFields[i] || 0) / 1000)}s
                </div>
              )}

              {!field.unlocked ? (
                <>
                  <div className="text-5xl mb-2">🔒</div>
                  {i < fieldPrices.length && (
                    <>
                      <div className="text-secondary font-bold text-sm mb-1">Preis: ${fieldPrices[i]}</div>
                      <Button onClick={() => buyField(i)} disabled={gameState.money < fieldPrices[i]} size="sm" className="min-h-touch">
                        Kaufen
                      </Button>
                    </>
                  )}
                </>
              ) : !field.planted ? (
                <>
                  <div className="text-5xl mb-2">🌱</div>
                  <p className="text-xs mb-2">Bereit</p>
                  <Button onClick={() => selectField(i)} size="sm" className="min-h-touch">
                    Pflanzen
                  </Button>
                </>
              ) : (
                <>
                  <div className="text-5xl mb-1">
                    {field.stage > 0 ? allPlants[field.planted]?.stages[field.stage - 1] : allPlants[field.planted]?.stages[0]}
                  </div>
                  <p className="text-xs mb-1">{allPlants[field.planted]?.name}</p>

                  {field.plantTime <= 0 ? (
                    <Button onClick={() => harvest(i)} size="sm" className="min-h-touch">
                      Ernten
                    </Button>
                  ) : (
                    <>
                      <div className="w-full h-3 bg-muted rounded-full overflow-hidden mb-1">
                        <div
                          className="h-full bg-gradient-progress transition-all duration-500"
                          style={{ width: `${getFieldProgress(field) * 100}%` }}
                        />
                      </div>
                      <div className="text-[10px] text-muted-foreground">{formatTime(field.plantTime)}</div>
                      {/* Water button */}
                      <Button
                        onClick={(e) => { e.stopPropagation(); waterField(i); }}
                        disabled={isWatered || cooldown > 0}
                        size="sm"
                        variant="outline"
                        className="mt-1 text-xs h-7"
                      >
                        {isWatered ? `💧 ${Math.ceil((wateredFields[i] || 0) / 1000)}s` :
                         cooldown > 0 ? `⏳ ${Math.ceil(cooldown / 1000)}s` : '💧 Gießen'}
                      </Button>
                    </>
                  )}
                </>
              )}
            </Card>
          );
        })}
      </div>

      {/* Bottom Navigation - 5 tabs */}
      <div className="fixed bottom-0 left-0 right-0 bg-card/95 p-2 flex justify-around shadow-lg z-50">
        {[
          { icon: '🛒', label: 'Händler', onClick: () => setShopModal(true) },
          { icon: '🚜', label: 'Feld', onClick: () => setFieldShopModal(true) },
          { icon: '📦', label: 'Samen', onClick: () => setInventoryModal(true) },
          {
            icon: '🌾', label: 'Ernte', onClick: () => setHarvestedModal(true),
            badge: totalHarvestedCount > 0 ? totalHarvestedCount : undefined,
          },
          { icon: '📖', label: 'Index', onClick: () => setIndexModal(true) },
        ].map(({ icon, label, onClick, badge }) => (
          <Button
            key={label}
            variant="secondary"
            onClick={onClick}
            className="flex flex-col items-center gap-0.5 min-h-touch min-w-[56px] px-2 relative text-xs"
          >
            <span className="text-lg">{icon}</span>
            <span className="text-[10px]">{label}</span>
            {badge !== undefined && (
              <div className="absolute -top-1 -right-1 w-4 h-4 bg-destructive text-destructive-foreground text-[10px] rounded-full flex items-center justify-center">
                {badge}
              </div>
            )}
          </Button>
        ))}
      </div>

      {/* ===== MODALS ===== */}

      {/* Shop Modal */}
      <Dialog open={shopModal} onOpenChange={setShopModal}>
        <DialogContent className="max-w-[95vw] max-h-[80vh] overflow-y-auto">
          <DialogHeader><DialogTitle>🛒 Samen-Händler</DialogTitle></DialogHeader>
          <div className="space-y-2">
            {Object.entries(allPlants).map(([key, plant]) => (
              <div key={key} className="flex items-center justify-between p-2 bg-muted rounded-lg text-sm">
                <div className="flex items-center gap-2">
                  <span className="text-3xl">{plant.icon}</span>
                  <div>
                    <h3 className="font-semibold text-sm">{plant.name}</h3>
                    {plant.isRebirth && <span className="text-purple-600 text-[10px] font-bold">✨ REBIRTH</span>}
                    <p className="text-[11px] text-muted-foreground">${plant.price} | Wert: ${plant.value} | {formatTime(plant.growTime)}</p>
                  </div>
                </div>
                <Button onClick={() => buySeed(key)} disabled={gameState.money < plant.price} size="sm">
                  Kaufen
                </Button>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      {/* Field Shop Modal */}
      <Dialog open={fieldShopModal} onOpenChange={setFieldShopModal}>
        <DialogContent className="max-w-[95vw] max-h-[80vh] overflow-y-auto">
          <DialogHeader><DialogTitle>🚜 Felder kaufen</DialogTitle></DialogHeader>
          <div className="space-y-2">
            {Array.from({ length: gameState.maxFields }, (_, i) => {
              const field = gameState.fields[i];
              if (field?.unlocked) return null;
              if (i >= fieldPrices.length) return null;
              return (
                <div key={i} className="flex items-center justify-between p-2 bg-muted rounded-lg text-sm">
                  <div className="flex items-center gap-2">
                    <span className="text-3xl">🚜</span>
                    <div>
                      <h3 className="font-semibold">Feld {i + 1}</h3>
                      <p className="text-xs text-muted-foreground">Preis: ${fieldPrices[i]}</p>
                    </div>
                  </div>
                  <Button onClick={() => buyField(i)} disabled={gameState.money < fieldPrices[i]} size="sm">Kaufen</Button>
                </div>
              );
            }).filter(Boolean).length === 0 && (
              <p className="text-center text-muted-foreground text-sm">Alle Felder gekauft!</p>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Seed Inventory Modal */}
      <Dialog open={inventoryModal} onOpenChange={setInventoryModal}>
        <DialogContent className="max-w-[95vw] max-h-[80vh] overflow-y-auto">
          <DialogHeader><DialogTitle>📦 Samen-Inventar</DialogTitle></DialogHeader>
          <div className="space-y-2">
            {Object.entries(gameState.inventory).filter(([_, c]) => c > 0).length === 0 ? (
              <p className="text-center text-muted-foreground text-sm">Leer! Kaufe Samen im Händler.</p>
            ) : (
              Object.entries(gameState.inventory).filter(([_, c]) => c > 0).map(([key, count]) => {
                const plant = allPlants[key];
                if (!plant) return null;
                return (
                  <div key={key} className="flex items-center gap-2 p-2 bg-muted rounded-lg text-sm">
                    <span className="text-3xl">{plant.icon}</span>
                    <div>
                      <h3 className="font-semibold">{plant.name} ×{count}</h3>
                      <p className="text-xs text-muted-foreground">Wert: ${plant.value} | {formatTime(plant.growTime)}</p>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Harvested Inventory Modal */}
      <Dialog open={harvestedModal} onOpenChange={setHarvestedModal}>
        <DialogContent className="max-w-[95vw] max-h-[80vh] overflow-y-auto">
          <DialogHeader><DialogTitle>🌾 Ernte-Inventar</DialogTitle></DialogHeader>
          <div className="space-y-2">
            {Object.keys(harvestedInventory).length === 0 ? (
              <p className="text-center text-muted-foreground text-sm">Keine Ernte vorhanden.</p>
            ) : (
              Object.entries(harvestedInventory).map(([plantKey, plantVariants]) => {
                const plant = allPlants[plantKey];
                if (!plant) return null;
                return Object.entries(plantVariants).map(([vKey, count]) => {
                  if (count <= 0) return null;
                  const variant = variants[vKey];
                  const unitValue = calculateValue(plant.value, vKey, gameState.rebirths);
                  return (
                    <div key={`${plantKey}-${vKey}`} className="flex items-center justify-between p-2 bg-muted rounded-lg text-sm">
                      <div className="flex items-center gap-2">
                        <span className="text-2xl">{plant.icon}</span>
                        <div>
                          <h3 className={`font-semibold text-sm ${variant.color}`}>
                            {variant.emoji} {plant.name} ({variant.name})
                          </h3>
                          <p className="text-[11px] text-muted-foreground">×{count} | ${unitValue}/Stück</p>
                        </div>
                      </div>
                      <div className="flex flex-col gap-1">
                        <Button size="sm" className="text-xs h-7" onClick={() => sellHarvested(plantKey, vKey, 1)}>
                          1x ${unitValue}
                        </Button>
                        {count > 1 && (
                          <Button size="sm" className="text-xs h-7" onClick={() => sellHarvested(plantKey, vKey, count)}>
                            Alle ${unitValue * count}
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
            <DialogTitle>📖 Index ({discoveredCount}/{totalVariants} - {Math.round(discoveredCount / totalVariants * 100)}%)</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            {Object.entries(allPlants).map(([plantKey, plant]) => {
              const discovered = gameState.discoveredVariants[plantKey] || [];
              const plantProgress = discovered.length;
              return (
                <div key={plantKey} className="p-2 bg-muted rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-2xl">{plant.icon}</span>
                    <div className="flex-1">
                      <h3 className="font-semibold text-sm">{plant.name} ({plantProgress}/{variantKeys.length})</h3>
                      <Progress value={(plantProgress / variantKeys.length) * 100} className="h-2 mt-1" />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-1">
                    {variantKeys.map(vKey => {
                      const variant = variants[vKey];
                      const isDiscovered = discovered.includes(vKey);
                      const value = calculateValue(plant.value, vKey, gameState.rebirths);
                      return (
                        <div key={vKey} className={`text-[10px] p-1 rounded ${isDiscovered ? 'bg-card' : 'bg-card/50'}`}>
                          {isDiscovered ? (
                            <span className={variant.color}>
                              {variant.emoji} {variant.name} - ${value} (1:{variant.chance})
                            </span>
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

      {/* Settings Modal */}
      <Dialog open={settingsModal} onOpenChange={setSettingsModal}>
        <DialogContent className="max-w-[95vw] max-h-[80vh] overflow-y-auto">
          <DialogHeader><DialogTitle>⚙️ Einstellungen</DialogTitle></DialogHeader>
          <div className="space-y-3">
            {([
              { key: 'music' as const, label: '🎵 Hintergrundmusik', desc: 'Farm-Musik' },
              { key: 'water' as const, label: '💧 Gießen-Sound', desc: 'Beim Gießen' },
              { key: 'harvest' as const, label: '🌾 Ernte-Sound', desc: 'Beim Ernten' },
              { key: 'buy' as const, label: '🛒 Kauf-Sound', desc: 'Beim Kaufen' },
              { key: 'drop' as const, label: '✨ Drop-Sound', desc: 'Seltene Varianten' },
              { key: 'event' as const, label: '🎉 Event-Sound', desc: 'Event-Start' },
              { key: 'rebirth' as const, label: '🔄 Rebirth-Sound', desc: 'Beim Rebirth' },
            ]).map(({ key, label, desc }) => (
              <div key={key} className="flex items-center justify-between p-2 bg-muted rounded-lg">
                <div>
                  <h3 className="font-semibold text-sm">{label}</h3>
                  <p className="text-xs text-muted-foreground">{desc}</p>
                </div>
                <Switch
                  checked={soundSettings[key]}
                  onCheckedChange={(checked) => setSoundSettings(prev => ({ ...prev, [key]: checked }))}
                />
              </div>
            ))}

            <div className="border-t pt-3 mt-3">
              <h3 className="font-bold text-sm mb-2">🔄 Rebirth</h3>
              <p className="text-xs text-muted-foreground mb-2">
                Rebirths: {gameState.rebirths} | Multiplikator: ×{rebirthMulti.toFixed(1)}<br />
                Kosten: ${rebirthCost.toLocaleString()}<br />
                Setzt Geld & Felder zurück. Behält Index & Rebirth-Pflanzen.
              </p>
              <Button
                variant="destructive"
                onClick={() => setRebirthModal(true)}
                disabled={gameState.money < rebirthCost}
                className="w-full"
              >
                🔄 Rebirth (${rebirthCost.toLocaleString()})
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Rebirth Confirmation */}
      <Dialog open={rebirthModal} onOpenChange={setRebirthModal}>
        <DialogContent className="max-w-[85vw]">
          <DialogHeader><DialogTitle>🔄 Rebirth bestätigen?</DialogTitle></DialogHeader>
          <div className="text-sm space-y-2">
            <p>Du wirst <strong>Geld, Felder und Inventar</strong> verlieren.</p>
            <p>Du behältst: <strong>Index-Fortschritt</strong> und <strong>Rebirth-Pflanzen</strong>.</p>
            <p>Neuer Multiplikator: <strong>×{(1 + 0.1 * (gameState.rebirths + 1)).toFixed(1)}</strong></p>
          </div>
          <div className="flex gap-2 mt-4">
            <Button variant="outline" onClick={() => setRebirthModal(false)} className="flex-1">Abbrechen</Button>
            <Button variant="destructive" onClick={doRebirth} className="flex-1">🔄 Rebirth!</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Plant Selection Modal */}
      <Dialog open={plantSelectionModal.show} onOpenChange={(open) => setPlantSelectionModal({ show: open, fieldIndex: -1 })}>
        <DialogContent className="max-w-[95vw] max-h-[80vh] overflow-y-auto">
          <DialogHeader><DialogTitle>🌱 Was pflanzen?</DialogTitle></DialogHeader>
          <div className="space-y-2">
            {Object.entries(gameState.inventory).filter(([_, c]) => c > 0).map(([key, count]) => {
              const plant = allPlants[key];
              if (!plant) return null;
              return (
                <div key={key} className="flex items-center justify-between p-2 bg-muted rounded-lg text-sm">
                  <div className="flex items-center gap-2">
                    <span className="text-3xl">{plant.icon}</span>
                    <div>
                      <h3 className="font-semibold">{plant.name} ×{count}</h3>
                      <p className="text-xs text-muted-foreground">{formatTime(plant.growTime)}</p>
                    </div>
                  </div>
                  <Button onClick={() => plantSeed(key, plantSelectionModal.fieldIndex)} size="sm">Pflanzen</Button>
                </div>
              );
            })}
          </div>
        </DialogContent>
      </Dialog>

      {/* Variant Popup */}
      <Dialog open={!!variantPopup?.show} onOpenChange={() => setVariantPopup(null)}>
        <DialogContent className="max-w-[80vw] text-center">
          <div className="space-y-3 py-4">
            <div className="text-6xl">{allPlants[variantPopup?.plantKey || '']?.icon}</div>
            <div className={`text-2xl font-bold ${variants[variantPopup?.variant || 'normal']?.color}`}>
              {variants[variantPopup?.variant || 'normal']?.emoji} {variants[variantPopup?.variant || 'normal']?.name}!
            </div>
            <div className="text-lg font-semibold">{allPlants[variantPopup?.plantKey || '']?.name}</div>
            <div className="text-xl text-farm-money font-bold">Wert: ${variantPopup?.value}</div>
            <div className="text-xs text-muted-foreground">
              Chance: 1 in {variants[variantPopup?.variant || 'normal']?.chance}
            </div>
            <Button onClick={() => setVariantPopup(null)} className="w-full">Super! 🎉</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
