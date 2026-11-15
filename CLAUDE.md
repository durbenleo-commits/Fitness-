# CLAUDE.md

Fitness-App als Videospiel: „Questfit“. Besitzer: Leo (GitHub `durbenleo-commits`, Repo `Fitness-`, privat).
Leo schreibt Deutsch. App-Texte sind Deutsch; Code, Kommentare und Commits auf Englisch.

## Was die App ist

- Tägliche Sport-Quests mit XP, Level, Rängen, Serie und Saison (30/66/90 Tage).
- Feste Tagesquest „Schritte“ plus drei Zufalls-Quests (Stärke, Ausdauer, Beweglichkeit).
- Arena: bis zu 3 Gegner pro Tag, Wochen-Boss (Mo–So, drei Phasen). Treffer = erledigte Wiederholungen.
- Erfolge (Bronze/Silber/Gold), Werte mit Klasse (Krieger, Läufer, …) und Vergleich 7 Tage / seit Tag 1.
- Ausrüstung und Möglichkeiten (Hanteln, Schwimmbad, „keine Sprungübungen“ …) steuern, welche Übungen kommen.
- Kamera-Zähler (MediaPipe Pose, läuft nur auf dem Handy) und Samsung Health über Health Connect (Schritte, Läufe).

## Technik

- React 18 + TypeScript + Vite, PWA (`vite-plugin-pwa`).
- Android-App über Capacitor 8 (`android/`), Plugin `@capgo/capacitor-health` für Health Connect.
- Pose-Erkennung: `@mediapipe/tasks-vision`. Das Modell liegt in `public/models/`, die WebAssembly-Dateien
  kopiert `scripts/copy-mediapipe.mjs` vor jedem Build nach `public/mediapipe/` (nicht im Repo).
- Kein Server. Spielstand im Browser-Speicher unter `questfit.state.v1`, Backup als JSON-Datei.

## Wie Leo die App bekommt

- Jeder Push auf `main` startet den Workflow „Android APK“: Tests, Build, signierte APK, Release „Questfit N“.
- Leo installiert über `https://github.com/durbenleo-commits/Fitness-/releases/latest` (Update über die alte App).
- „Deploy to GitHub Pages“ läuft nur von Hand: Das Repo ist privat, Pages ist aus.
- Erst sagen, dass eine neue Version da ist, wenn der Release wirklich existiert (Actions/Releases prüfen).

## Befehle

```bash
npm install          # einmalig
npm run dev          # Vorschau im Browser, http://localhost:5173
npm test             # Spiellogik-Tests (vitest)
npm run build        # Typprüfung + Build nach dist/
npx cap sync android # nur für lokale Android-Builds (braucht Android Studio)
```

Vor jedem Push: `npm test` und `npm run build` müssen grün sein.

## Aufbau

```
src/game.ts          Spielregeln: Quests, Level, Serie, Saison, Ausrüstung, Spielstand-Migration (normalize)
src/battle.ts        Gegner, Bosse, Wellen, Schaden, Sieg
src/pose.ts          Wiederholungen zählen aus Körperpunkten (rein, getestet)
src/achievements.ts  Erfolge
src/store.ts         React-State, Speichern, Health-Connect-Abgleich
src/health.ts        Brücke zu Health Connect (nur Android)
src/views/           Bildschirme: Today, Arena, Stats, Achievements, Settings, Scanner, Onboarding, ui
src/views/Icons.tsx  Linien-Icons und 3D-Abzeichen
src/views/Sprites.tsx  die 14 Monster als SVG
src/styles.css       Design („Clay Arena“), Farben als CSS-Variablen in :root
*.test.ts            Tests neben dem Code
android/             Capacitor-Projekt; android/app/questfit.keystore = Signaturschlüssel
.github/workflows/   android.yml (APK), deploy.yml (Pages, manuell)
```

## Regeln

- **Spielstand nie kaputt machen.** Neue Felder nur mit Standardwert in `normalize()` (game.ts) einführen.
  Alte Spielstände müssen weiter laden.
- **Signaturschlüssel nie ändern** (`android/app/questfit.keystore`, Passwörter in `android/app/build.gradle`).
  Sonst lässt sich die App nicht mehr über die alte installieren und Leo verliert seinen Fortschritt.
- **Keine Emojis in der Oberfläche.** Icons aus `Icons.tsx`, Monster aus `Sprites.tsx`.
- **Kein Nachbau von Life Reset** (Look, Farben, Schrift, Bilder, Texte). Ideen ja, Kopie nein.
- **Ehrlich sagen, was getestet ist.** Kamera und Health Connect lassen sich nur auf Leos Handy prüfen. Dann
  „nur im Browser getestet“ schreiben. UI-Änderungen mit Playwright-Screenshots (Pixel 7) prüfen.
- **Design erst zeigen.** Bei größeren Design-Änderungen Leo vorher Screenshots schicken.
- Spiellogik gehört in `game.ts` / `battle.ts` / `pose.ts` und bekommt Tests. Die Views zeigen nur an.

## Arbeiten am Handy und am PC

- **Handy:** Claude-App → Code → Repo `durbenleo-commits/Fitness-` wählen. Die Sitzung läuft in der Cloud,
  pusht auf `main`, GitHub baut die APK.
- **PC (Browser):** genauso über claude.ai/code.
- **PC (lokal):** Ordner `C:\Users\durbe\Documents\Fitness-`. Einmalig `git clone` und `npm install`, dann
  `npm run dev`. Vor dem Arbeiten immer `git pull`, damit Handy- und PC-Stand gleich sind.

## Arbeitsweise und Modell-Wahl

**Kernregeln**
1. Mach die Arbeit nie selbst. Schick immer einen Sub-Agenten.
2. Nimm kein Fable, wenn Fable extra kostet. Dann ist Opus 5.5 das gute Modell, Sonnet 5.5
   und Haiku 5.5 sind die schwachen.

**Wer plant, wer ausführt, wer prüft**
- Planen: Der Haupt-Chat plant. Er teilt die Aufgabe in kleine Schritte und gibt
  jedem Sub-Agenten einen klaren Auftrag (Ziel, Dateien, wann es fertig ist).
- Ausführen: Sub-Agenten machen die Arbeit. Ein Sub-Agent pro Schritt. Zwei
  Sub-Agenten ändern nie gleichzeitig dieselbe Datei.
- Prüfen: Ein anderer Sub-Agent prüft das Ergebnis, nicht der, der es gebaut hat.
  Erst danach sagt der Haupt-Chat „fertig“.

**Welches Modell**
- Haiku 5.5 (schwach): ganz einfache Aufgaben, zum Beispiel Dateien suchen und lesen.
- Sonnet 5.5 (schwach): leichte Aufgaben, zum Beispiel kleine Änderungen, Texte,
  einfache Prüfungen.
- Opus 5.5 (gut): schwere Aufgaben, zum Beispiel große Umbauten, schwierige Fehler oder
  neue Systeme planen.
- Fable nur, wenn es nichts extra kostet.
- Im Zweifel zuerst ein schwaches Modell. Reicht das nicht, neu mit Opus 5.5 starten.

**Melden**
- Der Haupt-Chat sagt Leo kurz, welcher Agent mit welchem Modell was gemacht hat
  und was geprüft wurde.
