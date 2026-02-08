import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { rebirthMilestones } from '@/lib/farm-milestones';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  rebirths: number;
}

export default function RebirthPathModal({ open, onOpenChange, rebirths }: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[95vw] max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>🛤️ Rebirth-Pfad</DialogTitle>
        </DialogHeader>
        <p className="text-xs text-muted-foreground mb-3">
          Aktuelle Rebirths: <strong>{rebirths}</strong>
        </p>
        <div className="relative">
          {/* Vertical line */}
          <div className="absolute left-5 top-0 bottom-0 w-0.5 bg-border" />

          <div className="space-y-3">
            {rebirthMilestones.map((milestone, idx) => {
              const unlocked = rebirths >= milestone.rebirth;
              return (
                <div key={idx} className="flex items-start gap-3 relative">
                  {/* Node */}
                  <div className={`relative z-10 w-10 h-10 rounded-full flex items-center justify-center text-lg shrink-0 border-2 ${
                    unlocked
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'bg-muted border-border text-muted-foreground'
                  }`}>
                    {unlocked ? milestone.icon : '?'}
                  </div>

                  {/* Content */}
                  <div className={`flex-1 p-2 rounded-lg text-xs ${
                    unlocked ? 'bg-primary/10 border border-primary/30' : 'bg-muted'
                  }`}>
                    <div className="flex items-center justify-between">
                      <h3 className={`font-bold ${unlocked ? 'text-foreground' : 'text-muted-foreground'}`}>
                        {unlocked ? milestone.name : '???'}
                      </h3>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${
                        unlocked
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-muted-foreground/20 text-muted-foreground'
                      }`}>
                        Rebirth {milestone.rebirth}
                      </span>
                    </div>
                    <p className={`text-[10px] mt-0.5 ${unlocked ? 'text-foreground/80' : 'text-muted-foreground'}`}>
                      {unlocked ? milestone.description : `Freischaltung bei Rebirth ${milestone.rebirth}`}
                    </p>
                    {unlocked && (
                      <span className="text-[9px] text-primary font-bold">✅ Aktiv</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
