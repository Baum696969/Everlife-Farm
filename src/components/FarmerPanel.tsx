import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import type { SingleFarmerState, MultiFarmerState, GameState, Plant } from '@/lib/farm-types';
import { farmerDefs, getFarmerEffectiveStats, getMainLevelCost, endlessStatDefs, getEndlessStatCost, isEndlessStatMaxed, FARMER_MAIN_LEVELS, getMaxSeeds, getMaxSeedsCost } from '@/lib/farm-farmer';
import { MAX_GROW_TIME } from '@/lib/farm-milestones';

export interface FarmerHarvestSummary {
  items: { plantKey: string; plantName: string; icon: string; variants: string; count: number; value: number }[];
  totalValue: number;
}

interface FarmerPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  farmers: MultiFarmerState;
  gameState: GameState;
  allPlants: Record<string, Plant>;
  onBuyFarmer: (farmerId: number) => void;
  onUpgradeFarmer: (farmerId: number) => void;
  onUpgradeEndlessStat: (farmerId: number, statKey: string) => void;
  onUpgradeMaxSeeds: (farmerId: number) => void;
  onGiveSeeds: (farmerId: number, plantKey: string, amount: number) => void;
  onCollect: (farmerId: number, slotIndex: number) => void;
  onCollectAllFromFarmer: (farmerId: number) => void;
  onCollectAllFarmers: () => void;
  onToggleAutoReplant: (farmerId: number) => void;
  formatTime: (ms: number) => string;
  harvestSummary: FarmerHarvestSummary | null;
  onDismissSummary: () => void;
  onSellSummary: () => void;
}

export default function FarmerPanel({
  open, onOpenChange, farmers, gameState, allPlants,
  onBuyFarmer, onUpgradeFarmer, onUpgradeEndlessStat, onUpgradeMaxSeeds, onGiveSeeds, onCollect,
  onCollectAllFromFarmer, onCollectAllFarmers, onToggleAutoReplant,
  formatTime, harvestSummary, onDismissSummary, onSellSummary,
}: FarmerPanelProps) {
  const [selectedFarmer, setSelectedFarmer] = useState(0);
  const [seedAmount, setSeedAmount] = useState<number>(1);
  const [inventoryOpen, setInventoryOpen] = useState(true);
  const [ordersOpen, setOrdersOpen] = useState(true);
  const now = Date.now();

  const totalDone = farmers.reduce((sum, f) => sum + f.slots.filter(s => now - s.startTime >= s.duration).length, 0);
  const availableSeeds = Object.entries(gameState.inventory).filter(([_, c]) => c > 0);

  const renderFarmerTab = (farmerId: number) => {
    const farmer = farmers[farmerId];
    const def = farmerDefs[farmerId];
    const stats = getFarmerEffectiveStats(farmer.level, farmer.endlessStats);
    const doneSlots = farmer.slots.filter(s => now - s.startTime >= s.duration);
    const maxSeeds = getMaxSeeds(farmer.maxSeedsLevel);
    const currentSeeds = farmer.inventory.reduce((s, i) => s + i.amount, 0);

    if (!farmer.unlocked) {
      return (
        <div className="text-center py-6 space-y-3">
          <div className="text-5xl">{def.emoji}</div>
          <h3 className="font-bold text-sm">{def.name} einstellen</h3>
          <p className="text-xs text-muted-foreground">
            Dieser Farmer pflanzt Seeds im Hintergrund.<br />
            Er braucht ×{getFarmerEffectiveStats(1, {}).timeMult.toFixed(1)} so lange, aber du musst nicht klicken!
          </p>
          <Button onClick={() => onBuyFarmer(farmerId)} disabled={gameState.rebirthTokens < def.cost} className="text-xs">
            🪙 {def.cost} Tokens – {def.name} kaufen
          </Button>
        </div>
      );
    }

    return (
      <div className="space-y-3">
        {/* Stats */}
        <div className="p-2 bg-muted rounded-lg text-xs space-y-0.5">
          <p>📊 Slots: <strong>{farmer.slots.length}/{stats.slots}</strong></p>
          <p>⏱️ Geschwindigkeit: <strong>×{stats.timeMult.toFixed(2)} langsamer</strong></p>
          <p>💰 Ernte-Multi: <strong>×{stats.harvestMult.toFixed(2)}</strong></p>
          <p>🌱 Pflanzungen/Zyklus: <strong>{stats.plantsPerCycle}</strong></p>
          <p>📦 Max Seeds: <strong>{currentSeeds}/{maxSeeds}</strong></p>
        </div>

        {/* Auto-Replant toggle */}
        <div className="flex items-center justify-between p-2 bg-muted rounded-lg">
          <div>
            <h3 className="font-semibold text-xs">🔄 Auto-Nachpflanzen</h3>
            <p className="text-[10px] text-muted-foreground">Pflanzt automatisch nach</p>
          </div>
          <Switch checked={farmer.autoReplant} onCheckedChange={() => onToggleAutoReplant(farmerId)} />
        </div>

        {/* Collapsible Inventory */}
        <Collapsible open={inventoryOpen} onOpenChange={setInventoryOpen}>
          <CollapsibleTrigger className="flex items-center justify-between w-full p-2 bg-muted rounded-lg text-xs font-bold cursor-pointer hover:bg-muted/80">
            <span>📦 Inventar ({farmer.inventory.length}/3 Typen, {currentSeeds}/{maxSeeds} Seeds)</span>
            <span className="text-muted-foreground">{inventoryOpen ? '▼' : '▶'}</span>
          </CollapsibleTrigger>
          <CollapsibleContent className="space-y-1.5 mt-1.5">
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

            {/* Give seeds */}
            <div className="space-y-1.5 pt-1 border-t">
              <h3 className="text-xs font-bold">🌱 Seeds geben</h3>
              {farmer.inventory.length >= 3 && (
                <p className="text-[10px] text-muted-foreground">Farmer-Inventar voll (max 3 Seed-Typen).</p>
              )}
              {currentSeeds >= maxSeeds && (
                <p className="text-[10px] text-amber-600 font-bold">📦 Max Seeds erreicht ({currentSeeds}/{maxSeeds})</p>
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
                  const growTime = Math.min(plant.growTime, MAX_GROW_TIME) * stats.timeMult;
                  const alreadyInInv = farmer.inventory.find(s => s.plantKey === key);
                  const canAdd = alreadyInInv || farmer.inventory.length < 3;
                  const remaining = maxSeeds - currentSeeds;
                  const maxGiveable = Math.min(count, remaining);
                  const actualAmount = seedAmount === -1 ? maxGiveable : Math.min(seedAmount, count, remaining);
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
                        onClick={() => onGiveSeeds(farmerId, key, actualAmount)}
                        disabled={actualAmount <= 0 || !canAdd}>
                        {seedAmount === -1 ? `Max (${actualAmount})` : `${actualAmount}×`} geben
                      </Button>
                    </div>
                  );
                })
              )}
            </div>
          </CollapsibleContent>
        </Collapsible>

        {/* Collapsible Active Orders */}
        <Collapsible open={ordersOpen} onOpenChange={setOrdersOpen}>
          <CollapsibleTrigger className="flex items-center justify-between w-full p-2 bg-muted rounded-lg text-xs font-bold cursor-pointer hover:bg-muted/80">
            <span>📜 Aktive Aufträge ({farmer.slots.length}/{stats.slots}){doneSlots.length > 0 ? ` ✅${doneSlots.length}` : ''}</span>
            <span className="text-muted-foreground">{ordersOpen ? '▼' : '▶'}</span>
          </CollapsibleTrigger>
          <CollapsibleContent className="space-y-1.5 mt-1.5">
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
                        <Button size="sm" className="h-7 text-[10px]" onClick={() => onCollect(farmerId, idx)}>
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
              <Button size="sm" variant="outline" onClick={() => onCollectAllFromFarmer(farmerId)} className="w-full text-xs h-7">
                Alle abholen ({doneSlots.length})
              </Button>
            )}
          </CollapsibleContent>
        </Collapsible>

        {/* Max Seeds Upgrade */}
        <div className="border-t pt-2">
          <div className="flex items-center justify-between p-2 bg-muted rounded-lg text-xs">
            <div>
              <h3 className="font-bold">📦 Max Seeds Upgrade</h3>
              <p className="text-[10px] text-muted-foreground">
                Aktuell: {maxSeeds} → Nächstes: {getMaxSeeds(farmer.maxSeedsLevel + 1)} Seeds
              </p>
            </div>
            <Button size="sm" className="h-7 text-[10px]"
              onClick={() => onUpgradeMaxSeeds(farmerId)}
              disabled={gameState.rebirthTokens < getMaxSeedsCost(farmer.maxSeedsLevel)}>
              🪙 {getMaxSeedsCost(farmer.maxSeedsLevel)}
            </Button>
          </div>
        </div>

        {/* Upgrade – Main Levels */}
        {farmer.level < FARMER_MAIN_LEVELS && (
          <div className="border-t pt-2">
            <div className="flex items-center justify-between p-2 bg-amber-50 border border-amber-200 rounded-lg text-xs">
              <div>
                <h3 className="font-bold">⬆️ Upgrade → Lv. {farmer.level + 1}/{FARMER_MAIN_LEVELS}</h3>
                <p className="text-[10px] text-muted-foreground">
                  {getFarmerEffectiveStats(farmer.level + 1, farmer.endlessStats).slots} Slots, 
                  ×{getFarmerEffectiveStats(farmer.level + 1, farmer.endlessStats).timeMult.toFixed(2)} Zeit, 
                  ×{getFarmerEffectiveStats(farmer.level + 1, farmer.endlessStats).harvestMult.toFixed(2)} Ernte
                </p>
              </div>
              <Button size="sm" className="h-7 text-[10px]"
                onClick={() => onUpgradeFarmer(farmerId)}
                disabled={gameState.rebirthTokens < getMainLevelCost(farmer.level)}>
                🪙 {getMainLevelCost(farmer.level)}
              </Button>
            </div>
          </div>
        )}

        {/* Endless Stats (after level 10) */}
        {farmer.level >= FARMER_MAIN_LEVELS && (
          <div className="border-t pt-2 space-y-1.5">
            <h3 className="text-xs font-bold">♾️ Endlos-Boosts</h3>
            {endlessStatDefs.map(def => {
              const currentLevel = farmer.endlessStats[def.key] || 0;
              const maxed = isEndlessStatMaxed(def, currentLevel);
              const cost = getEndlessStatCost(def, currentLevel);
              return (
                <div key={def.key} className="flex items-center justify-between p-2 bg-muted rounded-lg text-xs">
                  <div>
                    <p className="font-semibold">
                      {def.emoji} {def.name}{' '}
                      {maxed ? (
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span className="text-amber-500 font-bold">MAX ✨</span>
                            </TooltipTrigger>
                            <TooltipContent side="top" className="text-[10px]">
                              Maximales Level erreicht
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      ) : (
                        <span className="text-muted-foreground">Lv. {currentLevel}{def.maxLevel ? `/${def.maxLevel}` : ''}</span>
                      )}
                    </p>
                    <p className="text-[10px] text-muted-foreground">{def.description}</p>
                  </div>
                  {!maxed && (
                    <Button size="sm" className="h-7 text-[10px]"
                      onClick={() => onUpgradeEndlessStat(farmerId, def.key)}
                      disabled={gameState.rebirthTokens < cost}>
                      🪙 {cost}
                    </Button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-[95vw] max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>👨‍🌾 Farmer</DialogTitle>
          </DialogHeader>

          {/* Collect All button when multiple farmers have done items */}
          {totalDone > 0 && farmers.filter(f => f.unlocked).length > 1 && (
            <Button size="sm" variant="outline" onClick={onCollectAllFarmers} className="w-full text-xs h-8 mb-2">
              📦 Alle Farmer abholen ({totalDone})
            </Button>
          )}

          <Tabs value={String(selectedFarmer)} onValueChange={v => setSelectedFarmer(Number(v))}>
            <TabsList className="w-full">
              {farmerDefs.map((def, i) => {
                const f = farmers[i];
                const doneBadge = f.unlocked ? f.slots.filter(s => now - s.startTime >= s.duration).length : 0;
                return (
                  <TabsTrigger key={i} value={String(i)} className="flex-1 text-xs gap-1 relative">
                    {def.emoji} {f.unlocked ? `Lv.${f.level}` : `🔒`}
                    {doneBadge > 0 && (
                      <span className="absolute -top-1 -right-1 bg-destructive text-destructive-foreground text-[8px] rounded-full w-4 h-4 flex items-center justify-center">
                        {doneBadge}
                      </span>
                    )}
                  </TabsTrigger>
                );
              })}
            </TabsList>
            {farmerDefs.map((_, i) => (
              <TabsContent key={i} value={String(i)}>
                {renderFarmerTab(i)}
              </TabsContent>
            ))}
          </Tabs>
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
