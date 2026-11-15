# Questfit

Eine kostenlose Fitness-App im Videospiel-Stil: Jeden Tag gibt es vier Sport-Quests. Wer sie erledigt, sammelt XP, steigt im Level auf und baut eine Serie auf.

Die App ist eine **PWA** (Progressive Web App). Sie läuft im Browser und lässt sich auf dem Handy wie eine normale App installieren, ohne Play Store und ohne Kosten.

## Funktionen (Phase 1)

- Charakter mit Name, Fitness-Stufe und Saison-Länge (30, 66 oder 90 Tage)
- Täglich vier Quests: je eine für Stärke, Ausdauer und Beweglichkeit, dazu eine zufällige
- XP, Level, Ränge und ein Level-up-Bildschirm
- Quests werden mit jedem Level etwas schwerer
- Serie (Tage in Folge mit allen Quests) und 50 Bonus-XP pro geschafftem Tag
- Eine Quest pro Tag kann man tauschen
- Werte-Seite mit Attributen, Statistiken und Kalender der letzten 4 Wochen
- Backup als Datei speichern und wieder laden
- Funktioniert offline

## Auf dem Handy installieren

1. Die Seite der App in **Chrome** öffnen (Adresse siehe unten).
2. Oben rechts auf **⋮** tippen und **App installieren** oder **Zum Startbildschirm hinzufügen** wählen.
3. Fertig: Questfit erscheint mit eigenem Icon auf dem Startbildschirm.

## Veröffentlichen mit GitHub Pages

Kostenloses Hosting über GitHub Pages gibt es nur für **öffentliche** Repositories.

1. Repository auf öffentlich stellen: **Settings → General → Danger Zone → Change visibility → Public**.
2. **Settings → Pages → Source: GitHub Actions** wählen.
3. Bei jedem Push auf `main` baut GitHub die App neu. Sie ist dann unter `https://durbenleo-commits.github.io/Fitness-/` erreichbar.

## Wichtig zu wissen

- Der Fortschritt liegt **nur auf deinem Handy** (im Browser-Speicher). Wenn du die Browserdaten löschst, ist er weg. Speichere in den Einstellungen regelmäßig ein Backup.
- Die App prüft nicht, ob du die Übungen wirklich gemacht hast.

## Entwicklung

```bash
npm install
npm run dev     # Entwicklungsserver
npm test        # Tests der Spiellogik
npm run build   # fertige App in dist/
```

Technik: React, TypeScript, Vite, vite-plugin-pwa. Die Spielregeln stehen in `src/game.ts`.
