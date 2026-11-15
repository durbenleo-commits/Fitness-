# Questfit

Eine kostenlose Fitness-App im Videospiel-Stil: Jeden Tag gibt es vier Sport-Quests. Wer sie erledigt, sammelt XP, steigt im Level auf und baut eine Serie auf.

Die App ist eine **PWA** (Progressive Web App). Sie läuft im Browser und lässt sich auf dem Handy wie eine normale App installieren, ohne Play Store und ohne Kosten.

## Funktionen

- Charakter mit Name, Fitness-Stufe und Saison-Länge (30, 66 oder 90 Tage)
- Täglich vier Quests: je eine für Stärke, Ausdauer und Beweglichkeit, dazu eine zufällige
- XP, Level, Ränge und ein Level-up-Bildschirm
- Quests werden mit jedem Level etwas schwerer
- Serie (Tage in Folge mit allen Quests) und 50 Bonus-XP pro geschafftem Tag
- Eine Quest pro Tag kann man tauschen
- Werte-Seite mit Attributen, Statistiken und Kalender der letzten 4 Wochen
- Backup als Datei speichern und wieder laden
- Funktioniert offline
- Eigene Quests anlegen, z. B. Klimmzüge oder Radfahren, auf Wunsch jeden Tag
- Übungen, die du nicht machen willst, ausschalten
- 18 Erfolge, z. B. „Eine Woche“ (7 Tage in Folge) oder „50 Kilometer“
- Verlauf der letzten 2 Wochen als Diagramm und Summen pro Übung
- Arena: jeden Tag ein Gegner, jede Woche ein Boss mit drei Phasen. Besiegt wird er mit Sport
- Android-App: Schritte und Läufe aus Samsung Health (über Health Connect) zählen automatisch
- Am Ende der Saison eine Auswertung und der Start einer neuen Saison (Level und XP bleiben)

## Auf dem Handy installieren

1. Die Seite der App in **Chrome** öffnen (Adresse siehe unten).
2. Oben rechts auf **⋮** tippen und **App installieren** oder **Zum Startbildschirm hinzufügen** wählen.
3. Fertig: Questfit erscheint mit eigenem Icon auf dem Startbildschirm.

## Android-App mit Samsung Health

Bei jedem Push auf `main` baut GitHub eine APK und legt sie unter **Releases** ab.

1. Auf dem Handy das Repository öffnen → **Releases** → neueste Version → `questfit.apk` herunterladen.
2. Datei öffnen. Android fragt einmalig, ob der Browser Apps installieren darf: erlauben.
3. In Samsung Health: ⋮ → **Einstellungen** → **Health Connect** → Samsung Health erlauben, Schritte und Training zu teilen.
4. In Questfit: **Optionen** → **Mit Health Connect verbinden**.

Neue Versionen installieren sich über die alte, der Fortschritt bleibt erhalten. Der Signaturschlüssel
(`android/app/questfit.keystore`) liegt absichtlich im Repo, damit jeder Build mit demselben Schlüssel signiert ist.

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
