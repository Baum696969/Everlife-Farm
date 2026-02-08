

# Farm Game -- Animations, Rebirth-Button, Haendler-Upgrade & Benachrichtigungen

---

## 1. Animationen

### 1.1 Ernte-Blitz-Effekt auf Feldern
- Beim Klick auf "Ernten" bekommt das Feld-Card kurz eine CSS-Animation: weisser Flash-Overlay der fuer 400ms aufblinkt und wieder verschwindet
- Neuer State `flashingFields: Record<number, boolean>` -- wird beim Ernten auf `true` gesetzt und per `setTimeout` nach 400ms auf `false`
- CSS-Klasse `animate-harvest-flash` mit keyframe: opacity 0 -> 1 -> 0 mit weissem Hintergrund-Overlay

### 1.2 Varianten-Popup mit Scale-Animation
- Das bestehende Variant-Popup Dialog bekommt eine `animate-scale-in` Klasse
- Keyframe: scale 0.5/opacity 0 -> scale 1.1 -> scale 1/opacity 1 (bounce-Effekt)
- Wird direkt auf den DialogContent angewendet

### 1.3 Partikel-Effekt bei seltenen Drops
- Bei Gold+ Varianten: Emoji-Partikel (Sterne, Glitzer) die vom Feld nach oben/aussen fliegen
- Neuer State `particles: Array<{id, x, y, emoji}>` -- beim Ernten einer seltenen Variante werden 6-12 Partikel erzeugt
- Partikel werden als absolut positionierte `<span>`-Elemente gerendert mit CSS-Animation (translate + opacity fade-out ueber 1s)
- Partikel werden nach 1s per Timeout entfernt
- Verschiedene Emojis je nach Variante: Gold = Sterne, Diamond = Diamanten, Legendary = Kronen

---

## 2. Eigener Rebirth-Button in der Bottom-Navigation

- Der Rebirth-Bereich wird aus den Einstellungen entfernt
- Neuer 6. Button in der Bottom-Navigation: `🔄 Rebirth`
- Oeffnet direkt das Rebirth-Modal (mit Kosten, Info, Bestaetigung)
- Button zeigt ein Badge mit aktuellem Rebirth-Level wenn > 0
- Bottom-Bar bekommt 6 statt 5 Buttons (etwas kleinere Breite pro Button)

---

## 3. Rebirth-Pflanzen im Haendler (ausgegraut)

- Der Haendler zeigt ALLE Pflanzen inklusive aller 5 Rebirth-Pflanzen
- Aenderung in der Shop-Modal-Logik: statt `Object.entries(allPlants)` werden jetzt `plants` + `rebirthPlants` separat iteriert
- Regulaere Pflanzen: wie bisher
- Rebirth-Pflanzen:
  - Falls `gameState.rebirths >= plant.rebirthRequired`: normal kaufbar (wie bisher)
  - Falls nicht genug Rebirths: ausgegraut (`opacity-50`), Button disabled, Zusatztext: "Benoetigt {X} Rebirths" in roter Schrift
  - Optisch getrennt durch eine Trennlinie und Ueberschrift "Rebirth-Pflanzen"

---

## 4. Giesskannen-Upgrades

### Upgrade-System
- Neuer State in GameState: `waterLevel: number` (default 0, persistiert)
- 3 Upgrade-Stufen mit steigenden Kosten:
  - Level 0 (Standard): 30s Dauer, 15s Cooldown, x2 Speed
  - Level 1 ($500): 45s Dauer, 12s Cooldown, x2.5 Speed
  - Level 2 ($2000): 60s Dauer, 8s Cooldown, x3 Speed
  - Level 3 ($10000): 90s Dauer, 5s Cooldown, x4 Speed

### UI
- Neuer Abschnitt im Feld-Shop (oder eigener Bereich) unter "Giesskannen-Upgrade"
- Zeigt aktuelle Stufe und naechstes Upgrade mit Kosten
- Button "Upgraden" wenn genug Geld vorhanden

### Technisch
- `WATER_DURATION`, `WATER_COOLDOWN`, `WATER_SPEED_MULT` werden dynamisch basierend auf `waterLevel` berechnet
- Neue Funktion `getWaterStats(level: number)` in `farm-data.ts`
- `waterLevel` wird in GameState gespeichert und beim Rebirth beibehalten

---

## 5. Benachrichtigungen an/aus in Einstellungen

- Neues Feld in SoundSettings: `notifications: boolean` (default `true`)
- Neuer Toggle in den Einstellungen: "Benachrichtigungen" mit Icon und Beschreibung
- Alle `toast()` Aufrufe in FarmGame.tsx werden in eine Wrapper-Funktion `notify(options)` verpackt
- `notify` prueft `soundSettings.notifications` -- wenn `false`, wird der Toast nicht gezeigt
- Ausnahme: Varianten-Popup bleibt immer sichtbar (ist kein Toast)

---

## Technische Details

### Geaenderte Dateien

**`src/lib/farm-types.ts`**
- `GameState`: neues Feld `waterLevel: number`
- `SoundSettings`: neues Feld `notifications: boolean`

**`src/lib/farm-data.ts`**
- Neue Konstante `waterUpgrades` Array mit 4 Stufen (duration, cooldown, speedMult, cost)
- Neue Funktion `getWaterStats(level: number)` die duration/cooldown/speedMult zurueckgibt

**`src/index.css`**
- Neue Keyframes: `harvest-flash`, `scale-bounce`, `particle-fly`
- Neue Utility-Klassen: `animate-harvest-flash`, `animate-scale-bounce`, `animate-particle`

**`src/components/FarmGame.tsx`**
- Neuer State: `flashingFields`, `particles`
- Harvest-Funktion loest Flash + Partikel aus
- Varianten-Popup bekommt Scale-Animation-Klasse
- Bottom-Navigation: 6 Buttons (+ Rebirth)
- Shop-Modal: Alle Pflanzen + Rebirth-Pflanzen (ausgegraut wenn nicht freigeschaltet)
- Rebirth-Bereich aus Settings entfernt
- Giesskannen-Upgrade-Bereich im Feld-Shop
- Watering-Logik nutzt `getWaterStats(gameState.waterLevel)`
- Neue `notify()` Wrapper-Funktion
- Settings-Modal: neuer Toggle fuer Benachrichtigungen

