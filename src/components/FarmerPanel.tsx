import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Progress } from '@/components/ui/progress';
import type { FarmerState, FarmerSlot, GameState } from '@/lib/farm-types';
import type { Plant } from '@/lib/farm-types';
import { MAX_GROW_TIME } from '@/lib/farm-milestones';

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
  formatTime: (ms: number) => string;
}

// Farmer level configs
export const farmerLevels = [
  { level: 1, cost: 3, slots: 1, plantsPerCycle: 1, timeMult: 3.0 },
  { level: 2, cost: 5, slots: 2, plantsPerCycle: 1, timeMult: 2.8 },
  { level: 3, cost: 10, slots: 3, plantsPerCycle: 2, timeMult: 2.6 },
  { level: 4, cost: 18, slots: 4, plantsPerCycle: 2, timeMult: 2.4 },
  { level: 5, cost: 30, slots: 5, plantsPerCycle: 3, timeMult: 2.2 },
];

export function getFarmerConfig(level: number) {
  return farmerLevels[level - 1] || farmerLevels[0];
}

export default function FarmerPanel({
  open, onOpenChange, farmer, gameState, allPlants,
  onBuyFarmer, onUpgradeFarmer, onGiveSeeds, onCollect, onCollectAll,
  formatTime,
}: FarmerPanelProps) {
  const config = getFarmerConfig(farmer.level);
  const nextConfig = farmer.level < 5 ? farmerLevels[farmer.level] : null;
  const now = Date.now();

  const doneSlots = farmer.slots.filter(s => {
    const elapsed = now - s.startTime;
    return elapsed >= s.duration;
  });

  const availableSeeds = Object.entries(gameState.inventory).filter(([_, c]) => c > 0);

  return (
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
              <p>⏱️ Geschwindigkeit: <strong>×{config.timeMult} langsamer</strong></p>
              <p>🌱 Pflanzungen/Zyklus: <strong>{config.plantsPerCycle}</strong></p>
            </div>

            {/* Active slots */}
            <div className="space-y-1.5">
              <h3 className="text-xs font-bold">Aktive Aufträge</h3>
              {farmer.slots.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-2">Keine aktiven Aufträge. Gib dem Farmer Samen!</p>
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

            {/* Give seeds */}
            {farmer.slots.length < config.slots && (
              <div className="space-y-1.5">
                <h3 className="text-xs font-bold">🌱 Seeds geben</h3>
                {availableSeeds.length === 0 ? (
                  <p className="text-xs text-muted-foreground text-center">Keine Samen im Inventar.</p>
                ) : (
                  availableSeeds.map(([key, count]) => {
                    const plant = allPlants[key];
                    if (!plant) return null;
                    const growTime = Math.min(plant.growTime, MAX_GROW_TIME) * config.timeMult;
                    return (
                      <div key={key} className="flex items-center justify-between p-1.5 bg-muted rounded-lg text-xs">
                        <div className="flex items-center gap-1.5">
                          <span className="text-xl">{plant.icon}</span>
                          <div>
                            <p className="font-semibold">{plant.name} ×{count}</p>
                            <p className="text-[10px] text-muted-foreground">⏱️ {formatTime(growTime)}</p>
                          </div>
                        </div>
                        <Button size="sm" className="h-7 text-[10px]" onClick={() => onGiveSeeds(key, 1)}>
                          1× geben
                        </Button>
                      </div>
                    );
                  })
                )}
              </div>
            )}

            {/* Upgrade */}
            {nextConfig && (
              <div className="border-t pt-2">
                <div className="flex items-center justify-between p-2 bg-amber-50 border border-amber-200 rounded-lg text-xs">
                  <div>
                    <h3 className="font-bold">⬆️ Upgrade → Lv. {nextConfig.level}</h3>
                    <p className="text-[10px] text-muted-foreground">
                      {nextConfig.slots} Slots, ×{nextConfig.timeMult} Zeit, {nextConfig.plantsPerCycle}/Zyklus
                    </p>
                  </div>
                  <Button size="sm" className="h-7 text-[10px]"
                    onClick={onUpgradeFarmer}
                    disabled={gameState.rebirthTokens < nextConfig.cost}>
                    🪙 {nextConfig.cost}
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
