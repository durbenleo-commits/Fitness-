# Questfit

Eine kostenlose Fitness-App im Videospiel-Stil: Jeden Tag gibt es vier Sport-Quests. Wer sie erledigt, sammelt XP, steigt im Level auf und baut eine Serie auf.

Die App ist eine **PWA** (Progressive Web App). Sie läuft im Browser und lässt sich auf dem Handy wie eine normale App installieren, ohne Play Store und ohne Kosten.

## Funktionen

- Charakter mit Name, Fitness-Stufe und Saison-Länge (30, 66 oder 90 Tage)
- Täglich die Schritte-Quest und drei Zufalls-Quests (Stärke, Ausdauer, Beweglichkeit), dazu auf Wunsch Lesen
- XP, Level, Ränge und ein Level-up-Bildschirm
- Quests werden mit jedem Level etwas schwerer
- Serie (Tage in Folge mit allen Quests) und 50 Bonus-XP pro geschafftem Tag
- Eine Quest pro Tag kann man tauschen
- Werte-Seite mit Attributen, Statistiken und Kalender der letzten 4 Wochen
- Backup als Datei speichern und wieder laden
- Funktioniert offline
- Eigene Quests anlegen, z. B. Klimmzüge oder Radfahren, auf Wunsch jeden Tag
- Übungen, die du nicht machen willst, ausschalten
- 27 Erfolge, z. B. „Eine Woche“ (7 Tage in Folge) oder „50 Kilometer“
- Verlauf der letzten 2 Wochen als Diagramm und Summen pro Übung
- Arena: jeden Tag bis zu drei Gegner, jede Woche ein Boss mit 3–4 Phasen, immer mit einer Schritte-Phase. Besiegt wird er mit Sport
- Nachweis-Pflicht: Jede Quest und jeder Treffer braucht einen Nachweis, Abhaken von Hand gibt es nicht
  - Kamera-Zähler: Liegestütze, Kniebeugen, Ausfallschritte, Hampelmänner, Klimmzüge, Unterarmstütz, Wandsitzen, Bauchpressen,
    Bizepsbeugen, Schulterdrücken, Rudern, Kugelhantel-Schwünge, Hockstrecksprünge und Bergsteiger zählt die Kamera mit
    (Pose-Erkennung läuft komplett auf dem Handy)
  - Dehn-Routine: Dehnen, Dehnen mit Band, Mobilisation und Hüftöffner als fünf Dehnungen, jede 30 Sekunden vor der Kamera gehalten
  - Kamera-Zeit: Seilspringen und eigene Quests zählen nur, solange man im Bild ist
  - Samsung Health (Android-App, über Health Connect): Schritte, Laufen, Radfahren, Schwimmen, Treppen und Gerätetraining
    haken sich selbst ab und treffen Gegner automatisch
- Leichtere Varianten auf Wunsch, z. B. Knie-Liegestütze oder Australische Klimmzüge
- Lesen als tägliche Quest (abschaltbar): Seite mit Foto nachweisen, letzte Seite wird gespeichert, Bücher als beendet markieren.
  Bringt das Attribut Intelligenz (Klasse „Gelehrter“) und eigene Erfolge
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
3. Unter **Actions → Deploy to GitHub Pages → Run workflow** einmal starten (der Ablauf läuft absichtlich nur manuell). Sie ist dann unter `https://durbenleo-commits.github.io/Fitness-/` erreichbar.

## Wichtig zu wissen

- Der Fortschritt liegt **nur auf deinem Handy** (im Browser-Speicher). Wenn du die Browserdaten löschst, ist er weg. Speichere in den Einstellungen regelmäßig ein Backup.
- Quests zählen nur mit Nachweis (Kamera, Foto oder Samsung Health). Kamerabilder bleiben auf dem Handy; gespeichert wird nur das
  letzte, kleine Seitenfoto pro Buch.

## Weiterarbeiten am Handy und PC

Alles, was Claude über das Projekt wissen muss, steht in `CLAUDE.md`. Am Handy: Claude-App → Code → dieses Repo. Am PC: claude.ai/code oder lokal klonen (siehe unten).

## Entwicklung

```bash
npm install
npm run dev     # Entwicklungsserver
npm test        # Tests der Spiellogik
npm run build   # fertige App in dist/
```

Technik: React, TypeScript, Vite, vite-plugin-pwa. Die Spielregeln stehen in `src/game.ts`.
