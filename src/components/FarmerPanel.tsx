import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Progress } from '@/components/ui/progress';
import type { FarmerState, GameState } from '@/lib/farm-types';
import type { Plant } from '@/lib/farm-types';
import { MAX_GROW_TIME } from '@/lib/farm-milestones';

// === Farmer scaling system (up to 9999) ===

export function getFarmerUpgradeCost(level: number): number {
  return 1 + Math.floor(Math.pow(level, 1.15) / 12);
}

export function getFarmerTimeMult(level: number): number {
  return Math.max(1.5, 3.0 - level * 0.002);
}

export function getFarmerSlots(level: number): number {
  return Math.min(100, 1 + Math.floor(level / 10));
}

export function getFarmerPlantsPerCycle(level: number): number {
  return 1 + Math.floor(level / 20);
}

export function getFarmerConfig(level: number) {
  return {
    level,
    slots: getFarmerSlots(level),
    plantsPerCycle: getFarmerPlantsPerCycle(level),
    timeMult: getFarmerTimeMult(level),
    upgradeCost: getFarmerUpgradeCost(level),
  };
}

// === Harvest summary types ===
export interface FarmerHarvestSummary {
  items: { plantKey: string; plantName: string; icon: string; variants: string; count: number; value: number }[];
  totalValue: number;
}

interface FarmerPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  farmer: FarmerState;
  gameState: GameState;
  allPlants: Record<string, Plant>;
  onBuyFarmer: () => void;
  onUpgradeFarmer: () => void;
  onGiveSeeds: (plantKey: string, amount: number) => void;
  onCollect: (slotIndex: number) => void;
  onCollectAll: () => void;
  onToggleAutoReplant: () => void;
  formatTime: (ms: number) => string;
  harvestSummary: FarmerHarvestSummary | null;
  onDismissSummary: () => void;
  onSellSummary: () => void;
}

export default function FarmerPanel({
  open, onOpenChange, farmer, gameState, allPlants,
  onBuyFarmer, onUpgradeFarmer, onGiveSeeds, onCollect, onCollectAll,
  onToggleAutoReplant,
  formatTime,
  harvestSummary, onDismissSummary, onSellSummary,
}: FarmerPanelProps) {
  const config = getFarmerConfig(farmer.level);
  const now = Date.now();
  const [seedAmount, setSeedAmount] = useState<number>(1);

  const doneSlots = farmer.slots.filter(s => {
    const elapsed = now - s.startTime;
    return elapsed >= s.duration;
  });

  const availableSeeds = Object.entries(gameState.inventory).filter(([_, c]) => c > 0);

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-[95vw] max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>👨‍🌾 Farmer {farmer.unlocked ? `(Lv. ${farmer.level})` : ''}</DialogTitle>
          </DialogHeader>

          {!farmer.unlocked ? (
            <div className="text-center py-6 space-y-3">
              <div className="text-5xl">👨‍🌾</div>
              <h3 className="font-bold text-sm">Farmer einstellen</h3>
              <p className="text-xs text-muted-foreground">
                Der Farmer pflanzt Samen im Hintergrund für dich.<br />
                Er braucht 3× so lange, aber du musst nicht klicken!
              </p>
              <Button onClick={onBuyFarmer} disabled={gameState.rebirthTokens < 3} className="text-xs">
                🪙 3 Tokens – Farmer kaufen
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              {/* Stats */}
              <div className="p-2 bg-muted rounded-lg text-xs space-y-0.5">
                <p>📊 Slots: <strong>{farmer.slots.length}/{config.slots}</strong></p>
                <p>⏱️ Geschwindigkeit: <strong>×{config.timeMult.toFixed(2)} langsamer</strong></p>
                <p>🌱 Pflanzungen/Zyklus: <strong>{config.plantsPerCycle}</strong></p>
              </div>

              {/* Auto-Replant toggle */}
              <div className="flex items-center justify-between p-2 bg-muted rounded-lg">
                <div>
                  <h3 className="font-semibold text-xs">🔄 Auto-Nachpflanzen</h3>
                  <p className="text-[10px] text-muted-foreground">Pflanzt automatisch nach wenn Seeds im Farmer-Inventar</p>
                </div>
                <Switch checked={farmer.autoReplant} onCheckedChange={() => onToggleAutoReplant()} />
              </div>

              {/* Farmer Inventory */}
              <div className="space-y-1.5">
                <h3 className="text-xs font-bold">📦 Farmer-Inventar ({farmer.inventory.length}/3 Typen, {farmer.inventory.reduce((s, i) => s + i.amount, 0)} Seeds)</h3>
                {farmer.inventory.length === 0 ? (
                  <p className="text-xs text-muted-foreground text-center py-1">Leer – gib dem Farmer Seeds!</p>
                ) : (
                  farmer.inventory.map((slot, idx) => {
                    const plant = allPlants[slot.plantKey];
                    if (!plant) return null;
                    return (
                      <div key={idx} className="flex items-center justify-between p-1.5 bg-muted rounded-lg text-xs">
                        <div className="flex items-center gap-1.5">
                          <span className="text-xl">{plant.icon}</span>
                          <div>
                            <p className="font-semibold">{plant.name}</p>
                            <p className="text-[10px] text-muted-foreground">×{slot.amount} Seeds</p>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {/* Active slots */}
              <div className="space-y-1.5">
                <h3 className="text-xs font-bold">🌱 Aktive Aufträge ({farmer.slots.length}/{config.slots})</h3>
                {farmer.slots.length === 0 ? (
                  <p className="text-xs text-muted-foreground text-center py-2">Keine aktiven Aufträge.</p>
                ) : (
                  farmer.slots.map((slot, idx) => {
                    const plant = allPlants[slot.plantKey];
                    if (!plant) return null;
                    const elapsed = now - slot.startTime;
                    const progress = Math.min(1, elapsed / slot.duration);
                    const isDone = elapsed >= slot.duration;
                    const remaining = Math.max(0, slot.duration - elapsed);

                    return (
                      <div key={idx} className={`p-2 rounded-lg text-xs ${isDone ? 'bg-green-50 border border-green-200' : 'bg-muted'}`}>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-1.5">
                            <span className="text-xl">{plant.icon}</span>
                            <div>
                              <p className="font-semibold">{plant.name}</p>
                              <p className="text-[10px] text-muted-foreground">
                                {isDone ? '✅ Fertig!' : `⏳ ${formatTime(remaining)}`}
                              </p>
                            </div>
                          </div>
                          {isDone && (
                            <Button size="sm" className="h-7 text-[10px]" onClick={() => onCollect(idx)}>
                              Abholen
                            </Button>
                          )}
                        </div>
                        {!isDone && <Progress value={progress * 100} className="h-1.5 mt-1" />}
                      </div>
                    );
                  })
                )}

                {doneSlots.length > 1 && (
                  <Button size="sm" variant="outline" onClick={onCollectAll} className="w-full text-xs h-7">
                    Alle abholen ({doneSlots.length})
                  </Button>
                )}
              </div>

              {/* Give seeds with amount selector */}
              <div className="space-y-1.5">
                <h3 className="text-xs font-bold">🌱 Seeds geben</h3>
                {farmer.inventory.length >= 3 && (
                  <p className="text-[10px] text-muted-foreground">Farmer-Inventar voll (max 3 Seed-Typen).</p>
                )}
                <div className="flex gap-1 mb-1">
                  {[1, 10, 100].map(n => (
                    <Button key={n} size="sm" variant={seedAmount === n ? 'default' : 'outline'}
                      onClick={() => setSeedAmount(n)} className="flex-1 h-6 text-[10px]">
                      ×{n}
                    </Button>
                  ))}
                  <Button size="sm" variant={seedAmount === -1 ? 'default' : 'outline'}
                    onClick={() => setSeedAmount(-1)} className="flex-1 h-6 text-[10px]">
                    Max
                  </Button>
                </div>
                {availableSeeds.length === 0 ? (
                  <p className="text-xs text-muted-foreground text-center">Keine Samen im Inventar.</p>
                ) : (
                  availableSeeds.map(([key, count]) => {
                    const plant = allPlants[key];
                    if (!plant) return null;
                    const growTime = Math.min(plant.growTime, MAX_GROW_TIME) * config.timeMult;
                    const alreadyInInv = farmer.inventory.find(s => s.plantKey === key);
                    const canAdd = alreadyInInv || farmer.inventory.length < 3;
                    const actualAmount = seedAmount === -1 ? count : Math.min(seedAmount, count);
                    return (
                      <div key={key} className="flex items-center justify-between p-1.5 bg-muted rounded-lg text-xs">
                        <div className="flex items-center gap-1.5">
                          <span className="text-xl">{plant.icon}</span>
                          <div>
                            <p className="font-semibold">{plant.name} ×{count}</p>
                            <p className="text-[10px] text-muted-foreground">⏱️ {formatTime(growTime)}</p>
                          </div>
                        </div>
                        <Button size="sm" className="h-7 text-[10px]" 
                          onClick={() => onGiveSeeds(key, actualAmount)}
                          disabled={actualAmount <= 0 || !canAdd}>
                          {seedAmount === -1 ? `Max (${actualAmount})` : `${actualAmount}×`} geben
                        </Button>
                      </div>
                    );
                  })
                )}
              </div>

              {/* Upgrade */}
              {farmer.level < 9999 && (
                <div className="border-t pt-2">
                  <div className="flex items-center justify-between p-2 bg-amber-50 border border-amber-200 rounded-lg text-xs">
                    <div>
                      <h3 className="font-bold">⬆️ Upgrade → Lv. {farmer.level + 1}</h3>
                      <p className="text-[10px] text-muted-foreground">
                        {getFarmerSlots(farmer.level + 1)} Slots, ×{getFarmerTimeMult(farmer.level + 1).toFixed(2)} Zeit, {getFarmerPlantsPerCycle(farmer.level + 1)}/Zyklus
                      </p>
                    </div>
                    <Button size="sm" className="h-7 text-[10px]"
                      onClick={onUpgradeFarmer}
                      disabled={gameState.rebirthTokens < config.upgradeCost}>
                      🪙 {config.upgradeCost}
                    </Button>
                  </div>
                </div>
              )}
              {farmer.level >= 9999 && (
                <div className="border-t pt-2">
                  <p className="text-xs text-farm-money font-bold text-center">🏆 Farmer Max Level!</p>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Harvest Summary Popup */}
      <Dialog open={!!harvestSummary} onOpenChange={() => onDismissSummary()}>
        <DialogContent className="max-w-[85vw] text-center">
          <DialogHeader><DialogTitle>👨‍🌾 Farmer-Ernte</DialogTitle></DialogHeader>
          {harvestSummary && (
            <div className="space-y-2">
              {harvestSummary.items.map((item, i) => (
                <div key={i} className="flex items-center justify-between p-1.5 bg-muted rounded-lg text-xs">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xl">{item.icon}</span>
                    <span className="font-semibold">{item.plantName} {item.variants !== 'normal' ? `(${item.variants})` : ''}</span>
                  </div>
                  <span className="font-bold">+{item.count}</span>
                </div>
              ))}
              <div className="border-t pt-2 text-sm font-bold">
                Gesamtwert: ${harvestSummary.totalValue.toLocaleString()}
              </div>
              <div className="flex gap-2">
                <Button onClick={onDismissSummary} variant="outline" className="flex-1 text-xs">
                  📦 In Inventar
                </Button>
                <Button onClick={onSellSummary} className="flex-1 text-xs">
                  💰 Direkt verkaufen
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
