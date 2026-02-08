

# Farm Game -- Update 1: Vollstandiges Balancing-Update

Dieses Update erweitert das bestehende Farm Clicker Game um zahlreiche neue Systeme: Giesskannen-Boost, Ernte-Varianten mit Drop-Chancen, Events, Rebirth, Index-Sammlung und 5 Rebirth-Pflanzen.

---

## Neue Features im Uberblick

### 1. Giesskannen-System (Aktiver Boost)
- Button auf jedem bepflanzten Feld zum Giessen
- Effekt: x2 Wachstumsgeschwindigkeit fur 30 Sekunden
- 15 Sekunden Cooldown nach Nutzung
- Visuell: Wassertropfen-Emoji-Overlay + Timer-Anzeige am Feld

### 2. Ernte-Varianten (7 Stufen)
Bei jeder Ernte wird eine Variante gewurfelt:
- Normal (x1, 1 in 1)
- Gold (x2.5, 1 in 20)
- Shiny (x5, 1 in 75)
- Diamant (x10, 1 in 250)
- Platin (x20, 1 in 1000)
- Mythisch (x50, 1 in 5000)
- Legendar (x150, 1 in 25000)

Beim Ernten wird die Variante angezeigt und der Verkaufswert entsprechend berechnet. Popup + Sound bei seltenen Drops.

### 3. Event-System (alle 15 Min, 5 Min Dauer)
- Alle 15 Minuten startet ein zufalliges Event
- Alle Varianten-Chancen x2
- Eine Fokus-Variante bekommt x4 Bonus
- Event-Typen: Gold-Event, Shiny-Event, Diamant-Event, Platin-Event, Mythisch-Event, Legendar-Event (sehr selten)
- Event-Banner oben im Spiel mit Timer
- Sound bei Event-Start

### 4. Rebirth-System
- Kosten starten bei $50.000, Skalierung: Basis x (1.35 ^ Rebirths)
- Setzt Geld und Felder zuruck
- Behalt: Rebirth-Multiplikator (+10% pro Rebirth), Index-Fortschritt, Rebirth-Pflanzen
- Rebirth-Button in Einstellungen

### 5. Rebirth-Pflanzen (5 Stuck)
Freigeschaltet bei 1, 5, 10, 20, 100 Rebirths:
- Rebirth Rose (1 Rebirth): Preis $50, Wert $150, 45s Wachstum
- Rebirth Orchidee (5): Preis $200, Wert $600, 90s
- Rebirth Lotus (10): Preis $500, Wert $1500, 150s
- Rebirth Kristallblume (20): Preis $1000, Wert $3000, 240s
- Rebirth Sternenblume (100): Preis $5000, Wert $15000, 360s

Alle haben +50% bessere Varianten-Chancen und leuchtende Emojis.

### 6. Index-System (Sammlung)
- Neuer Tab "Index" in der unteren Navigation
- Zeigt alle Pflanzen + deren entdeckte Varianten
- Unentdeckte Varianten: "???"
- Prozent-Fortschritt pro Pflanze und gesamt
- Popup + Sound bei neuer Varianten-Entdeckung

### 7. Erweiterte Einstellungen
Individuelle Sound-Toggles:
- Hintergrundmusik
- Giessen-Sound
- Ernte-Sound
- Kauf-Sound
- Drop-Sound (seltene Varianten)
- Event-Sound
- Rebirth-Sound

### 8. Wert-Berechnung
Formel: Pflanzen-Grundwert x Varianten-Multiplikator x Rebirth-Multiplikator (1 + 0.1 x Rebirths)

---

## Technische Details

### Erweiterte GameState-Struktur
Neue Felder im GameState:
- `rebirths: number` -- Anzahl der Rebirths
- `discoveredVariants: Record<string, string[]>` -- Index der entdeckten Varianten pro Pflanze
- `eventStartTime: number | null` -- Wann das aktuelle Event gestartet ist
- `eventType: string | null` -- Welche Fokus-Variante das Event hat

Neue separate States:
- `wateringCooldowns: Record<number, number>` -- Cooldown pro Feld
- `wateredFields: Record<number, number>` -- Aktiver Boost-Timer pro Feld
- `soundSettings: Record<string, boolean>` -- Individuelle Sound-Toggles

### Erweiterte Feld-Struktur
- `harvestedVariant: string | null` -- Variante der geernteten Pflanze (im Ernte-Inventar)

### Ernte-Inventar-Erweiterung
Das harvestedInventory speichert jetzt Varianten:
`Record<string, Record<string, number>>` -- z.B. `{ carrot: { normal: 3, gold: 1 } }`

### Neue UI-Elemente
- Giesskannen-Button auf bepflanzten Feldern mit Timer-Ring
- Event-Banner am oberen Bildschirmrand
- Index-Tab in der Bottom-Navigation (5. Button)
- Index-Modal mit Pflanzen-Liste und Varianten-Grid
- Rebirth-Button und Info in den Einstellungen
- Varianten-Popup bei der Ernte mit farbigem Rahmen

### Datei-Anderungen
Nur eine Datei wird geandert: `src/components/FarmGame.tsx`
- Erweiterte Typen und Interfaces
- Neue Konstanten fur Varianten, Events, Rebirth-Pflanzen
- Neue State-Variablen
- Giesskannen-Logik (Boost + Cooldown)
- Varianten-Wurfel bei Ernte
- Event-Timer-Logik (15 Min Intervall, 5 Min Dauer, Fokus-Variation)
- Rebirth-Funktion
- Index-Tracking
- Erweiterte Sound-Einstellungen
- Neue Modals: Index, Varianten-Popup, Rebirth-Bestatigung
- Speichern/Laden der neuen Daten in localStorage

