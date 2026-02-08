import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { hasMilestone } from '@/lib/farm-milestones';
import type { GameState, AutoSellMode } from '@/lib/farm-types';

interface AbilitiesModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  gameState: GameState;
  onToggleAutoHarvest: (v: boolean) => void;
  onSetAutoSell: (mode: AutoSellMode) => void;
  onToggleAutoWater: (v: boolean) => void;
  onToggleFarmerAutoReplant: () => void;
}

interface AbilityDef {
  key: string;
  icon: string;
  name: string;
  desc: string;
  milestoneKey: string;
  rebirthRequired: number;
  type: 'toggle' | 'autosell' | 'farmer';
}

const abilities: AbilityDef[] = [
  { key: 'autoHarvest', icon: '🤖', name: 'Auto-Ernten', desc: '1 Pflanze/Sek automatisch ernten', milestoneKey: 'autoHarvest', rebirthRequired: 1, type: 'toggle' },
  { key: 'autoSell', icon: '💸', name: 'Auto-Sell', desc: 'Ernten automatisch verkaufen', milestoneKey: 'autoSell', rebirthRequired: 25, type: 'autosell' },
  { key: 'autoWater', icon: '💧', name: 'Auto-Gießkanne', desc: 'Smart-Gießen (alle 3s, >10s Rest)', milestoneKey: 'autoWater', rebirthRequired: 80, type: 'toggle' },
  { key: 'farmerReplant', icon: '🔄', name: 'Farmer-Nachpflanzen', desc: 'Farmer pflanzt automatisch nach', milestoneKey: '', rebirthRequired: 0, type: 'farmer' },
];

export default function AbilitiesModal({
  open, onOpenChange, gameState,
  onToggleAutoHarvest, onSetAutoSell, onToggleAutoWater, onToggleFarmerAutoReplant,
}: AbilitiesModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[95vw] max-h-[80vh] overflow-y-auto">
        <DialogHeader><DialogTitle>⭐ Fähigkeiten</DialogTitle></DialogHeader>
        <p className="text-[10px] text-muted-foreground mb-2">
          Automatische Funktionen ein-/ausschalten. Neue Fähigkeiten schaltest du durch Rebirth frei.
        </p>
        <div className="space-y-2">
          {abilities.map(ability => {
            const unlocked = ability.milestoneKey
              ? hasMilestone(gameState.rebirths, ability.milestoneKey)
              : ability.type === 'farmer' ? gameState.farmer.unlocked : true;

            if (!unlocked) {
              return (
                <TooltipProvider key={ability.key}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div className="flex items-center justify-between p-2 bg-muted rounded-lg opacity-40 cursor-help">
                        <div className="flex items-center gap-2">
                          <span className="text-lg">{ability.icon}</span>
                          <div>
                            <h3 className="font-semibold text-xs">{ability.name}</h3>
                            <p className="text-[10px] text-muted-foreground">🔒 Freischaltung bei Rebirth {ability.rebirthRequired}</p>
                          </div>
                        </div>
                      </div>
                    </TooltipTrigger>
                    <TooltipContent side="bottom" className="text-xs">
                      {ability.milestoneKey
                        ? `Freischaltung bei Rebirth ${ability.rebirthRequired}`
                        : 'Farmer muss zuerst gekauft werden'}
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              );
            }

            if (ability.type === 'autosell') {
              return (
                <div key={ability.key} className="p-2 bg-muted rounded-lg">
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className="text-lg">{ability.icon}</span>
                    <div>
                      <h3 className="font-semibold text-xs">{ability.name}</h3>
                      <p className="text-[10px] text-muted-foreground">{ability.desc}</p>
                    </div>
                  </div>
                  <div className="flex gap-1">
                    {([['off', 'Aus'], ['normal', 'Normal'], ['all', 'Alles'], ['gold+', 'Gold+']] as const).map(([mode, label]) => (
                      <Button key={mode} size="sm" variant={gameState.autoSell === mode ? 'default' : 'outline'}
                        onClick={() => onSetAutoSell(mode as AutoSellMode)}
                        className="flex-1 text-[9px] h-6">
                        {label}
                      </Button>
                    ))}
                  </div>
                </div>
              );
            }

            const isActive = ability.type === 'toggle'
              ? ability.key === 'autoHarvest' ? gameState.autoHarvest : gameState.autoWater
              : gameState.farmer.autoReplant;

            const onToggle = ability.type === 'toggle'
              ? ability.key === 'autoHarvest' ? onToggleAutoHarvest : onToggleAutoWater
              : () => onToggleFarmerAutoReplant();

            return (
              <div key={ability.key} className="flex items-center justify-between p-2 bg-muted rounded-lg">
                <div className="flex items-center gap-2">
                  <span className="text-lg">{ability.icon}</span>
                  <div>
                    <h3 className="font-semibold text-xs">{ability.name}</h3>
                    <p className="text-[10px] text-muted-foreground">{ability.desc}</p>
                  </div>
                </div>
                <Switch checked={isActive} onCheckedChange={ability.type === 'toggle' ? onToggle : () => onToggle(true)} />
              </div>
            );
          })}
        </div>
      </DialogContent>
    </Dialog>
  );
}
