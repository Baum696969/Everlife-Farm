import { useState } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

interface TutorialModalProps {
  open: boolean;
  onClose: () => void;
}

const tutorialPages = [
  {
    title: '🌾 Grundlagen',
    icon: '💰',
    content: [
      '💰 Oben siehst du dein Geld und Rebirth-Tokens.',
      '🌱 In der Mitte sind deine Felder – hier pflanzt du.',
      '📱 Unten findest du die Navigation: Händler, Gießkanne, Ernte, Index, R-Shop und Rebirth.',
    ],
    tip: 'Tipp: Tippe auf ein leeres Feld, um eine Pflanze zu setzen!',
  },
  {
    title: '🌱 Pflanzen & Ernten',
    icon: '🥕',
    content: [
      '1. Kaufe Samen beim Händler 🛒',
      '2. Tippe auf ein leeres Feld und wähle eine Pflanze.',
      '3. Warte bis sie fertig gewachsen ist (Fortschrittsbalken).',
      '4. Tippe „Ernten" – die Pflanze landet im Ernte-Inventar.',
      '✨ Jede Ernte kann seltene Varianten haben: Gold, Shiny, Diamant und mehr!',
    ],
    tip: 'Tipp: Seltene Varianten sind deutlich mehr wert!',
  },
  {
    title: '🎵 Hintergrundmusik',
    icon: '🎶',
    content: [
      'Everlife Farm spielt standardmäßig entspannte Farm-Musik.',
      'Du kannst die Musik jederzeit in den ⚙️ Einstellungen ändern.',
      'Dort findest du verschiedene Tracks zur Auswahl.',
      'Tippe auf „▶ Preview" um einen Track vorab zu hören.',
    ],
    tip: 'Tipp: Standard-Musik ist empfohlen für entspanntes Spielen.',
  },
  {
    title: '💧 Gießkanne',
    icon: '💧',
    content: [
      'Tippe auf 💧 neben einer wachsenden Pflanze.',
      'Gegossene Pflanzen wachsen deutlich schneller!',
      'Die Gießkanne hat einen Cooldown pro Feld.',
      '⬆️ Upgrades verbessern: Dauer, Stärke, Reichweite und Cooldown.',
    ],
    tip: 'Tipp: Gieß mehrere Felder hintereinander für Ketten-Bonus!',
  },
  {
    title: '🎉 Events',
    icon: '🎉',
    content: [
      'Alle 15 Minuten startet ein zufälliges Event.',
      'Während eines Events sind bestimmte Varianten häufiger!',
      'Die Fokus-Variante erscheint 4× öfter, alle anderen 2× öfter.',
      'Events dauern 5 Minuten – nutze sie aus!',
    ],
    tip: 'Tipp: Pflanze während Events schnell wachsende Pflanzen für maximale Ernte!',
  },
  {
    title: '🔄 Rebirth & Tokens',
    icon: '🪙',
    content: [
      'Rebirth setzt dein Geld, Felder und Inventar zurück.',
      'Dafür erhältst du Rebirth-Tokens 🪙 und einen permanenten Multiplier.',
      'Tokens nutzt du im R-Shop für permanente Upgrades.',
      'Der Rebirth-Pfad zeigt dir kommende Freischaltungen!',
    ],
    tip: 'Tipp: Je öfter du Rebirth machst, desto stärker wirst du!',
  },
  {
    title: '🤖 Auto-Systeme',
    icon: '⚡',
    content: [
      '🤖 Auto-Ernte (ab Rebirth 1): Erntet automatisch 1 Pflanze/Sek.',
      '💸 Auto-Sell (ab Rebirth 25): Verkauft Ernte automatisch.',
      '💧 Auto-Gießkanne (ab Rebirth 80): Gießt smart alle 3 Sekunden.',
      'Alle Systeme sind in den Einstellungen ⚙️ ein-/ausschaltbar.',
    ],
    tip: 'Tipp: Kombiniere Auto-Ernte mit Auto-Sell für passives Einkommen!',
  },
  {
    title: '👨‍🌾 Farmer',
    icon: '👨‍🌾',
    content: [
      'Kaufe einen Farmer für 3 Rebirth-Tokens.',
      'Gib ihm Samen – er pflanzt sie im Hintergrund!',
      'Der Farmer hat ein eigenes Inventar (max. 3 Seed-Typen).',
      'Er pflanzt automatisch nach, solange Seeds vorhanden sind.',
      'Hole die Ernte ab, wenn sie fertig ist.',
      'Upgrade den Farmer für mehr Slots und schnelleres Pflanzen!',
    ],
    tip: 'Tipp: Perfekt für Offline-Zeit oder nebenbei für Basic-Pflanzen!',
  },
];

export default function TutorialModal({ open, onClose }: TutorialModalProps) {
  const [page, setPage] = useState(0);

  const isLastPage = page === tutorialPages.length - 1;
  const current = tutorialPages[page];

  const handleClose = () => {
    setPage(0);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) handleClose(); }}>
      <DialogContent className="max-w-[95vw] max-h-[85vh] overflow-y-auto p-4">
        <div className="text-center mb-3">
          <div className="text-5xl mb-2">{current.icon}</div>
          <h2 className="text-xl font-bold">{current.title}</h2>
          <p className="text-sm text-muted-foreground">Seite {page + 1} / {tutorialPages.length}</p>
        </div>

        <div className="space-y-2 text-sm">
          {current.content.map((line, i) => (
            <p key={i} className="bg-muted/50 p-2.5 rounded-lg leading-relaxed">{line}</p>
          ))}
        </div>

        {current.tip && (
          <div className="mt-3 p-2.5 bg-yellow-50 border border-yellow-200 rounded-lg text-sm text-yellow-800 leading-relaxed">
            💡 {current.tip}
          </div>
        )}

        {/* Page dots */}
        <div className="flex justify-center gap-1.5 mt-3">
          {tutorialPages.map((_, i) => (
            <div key={i} className={`w-2 h-2 rounded-full transition-all ${i === page ? 'bg-primary scale-125' : 'bg-muted-foreground/30'}`} />
          ))}
        </div>

        <div className="flex gap-2 mt-3">
          <Button variant="outline" onClick={handleClose} className="flex-1 text-xs">
            Beenden
          </Button>
          {!isLastPage ? (
            <Button onClick={() => setPage(p => p + 1)} className="flex-1 text-xs">
              Nächste →
            </Button>
          ) : (
            <Button onClick={handleClose} className="flex-1 text-xs">
              Fertig ✅
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
