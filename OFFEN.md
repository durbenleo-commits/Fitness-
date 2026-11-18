# Offen

Was noch zu tun oder zu prüfen ist. In einer neuen Sitzung reicht: **„Mach mit OFFEN.md weiter.“**
Erledigtes hier streichen, neue offene Punkte ergänzen.

## Stand

- Nachweis-Pflicht ist eingebaut: Jede Quest und jeder Arena-Treffer braucht Kamera, Kamera-Zeit, Foto der Seite oder
  Samsung Health. Abhaken von Hand und die „+5 / Alle“-Knöpfe in der Arena gibt es nicht mehr.
- Lesen (Buch, Seite, Foto, Buch beendet), Attribut Intelligenz, leichtere Varianten und die Dehn-Routine sind fertig.
- Der Wochen-Boss hat immer eine Schritte-Phase (aus Samsung Health).
- Ohne Samsung Health (Browser-Version oder Sync-Fehler) lässt sich die feste Schritte-Quest nicht erfüllen: kein Tagesbonus,
  keine Serie, Bosse mit Schritte-Phase sind nicht zu besiegen. So gewollt, aber im Blick behalten.
- Pflicht und Extra: 4 feste Pflicht-Quests (Schritte, Liegestütze, Kniebeugen, Unterarmstütz) + Lesen, dazu 4 freiwillige
  Extras. Jede Quest bis 2× (mehr XP, Bonus-Punkt). Bücher mit Cover und Seitenzahl, Dehn-Routine zeigt, was gedehnt wird.
- Getestet: Spiellogik mit `npm test`, Oberfläche nur im Browser (Playwright, Pixel 7, Kamera simuliert).
  Dass die Kamera echt über das Ziel hinaus bis 2× zählt, ist im Browser nicht prüfbar (simulierte Kamera zählt nichts).

## Auf Leos Handy prüfen

Kamera und Health Connect lassen sich nur auf dem echten Handy prüfen.

- **Kamera-Schwellen** für alle Übungen sind nur mit erfundenen Körperpunkten getestet. Besonders unsicher:
  - Schulterdrücken (`press`): Hände über dem Kopf / unter den Schultern.
  - Dehn-Routine: „Seitneigung links/rechts“ (Schulterlinie > 12° geneigt, Hand über dem Kopf) und
    „Ausfallschritt-Dehnung“ (ein Knie < 120°, das andere > 150°). Vorbeuge und „Arme hoch“ ebenso.
  - Leichtere Varianten: Knie-Liegestütze, Australische Klimmzüge, Unterarmstütz auf den Knien, halbe Kniebeugen,
    halbe Bauchpressen, Wandsitzen höher.
  - Kamera-Zeit (Seilspringen): läuft nur, solange Schulter und Hüfte gut zu sehen sind. Beim Springen evtl. zu streng.
- **„pro Arm“** (Bizepsbeugen): Die Kamera zählt nur den Arm, der zur Kamera zeigt, das Ziel ist die Quest-Menge.
  Ausfallschritte („pro Bein“) sind entschieden: Das Kamera-Ziel ist doppelt so hoch (10 pro Bein = 20 gezählte).
- **Health Connect**: Schritte und Läufe liefen schon. Neu und ungetestet sind Radfahren, Schwimmen, Stockwerke und
  Krafttraining (Gerätetraining). Prüfen, ob Samsung Health diese Trainings an Health Connect gibt und ob die Minuten stimmen.
- **Seitenfoto**: Rückkamera im WebView (getUserMedia mit `facingMode: environment`) und der Ersatz über die
  System-Kamera (`<input capture>`) auf dem Handy ausprobieren. Ist das 320 px breite Foto lesbar genug als Nachweis?
- Unterarmstütz und Liegestütze von vorne (Handy vor dem Kopf) auf dem Handy testen.
- Neue Frontansichten testen: Kniebeugen, Ausfallschritte, Wandsitzen, Bizepsbeugen, Hockstrecksprünge, Klimmzüge
  (jetzt Kinn über die Stange).
- Hinweise „Dreh dich zur Seite“ / „frontal“ prüfen.
- Quest-Aktualisierung bei Tageswechsel im Hintergrund (resume/focus) auf dem Handy prüfen.
- Kamera-Berechtigung in der Android-App für das Seitenfoto (gleiche Berechtigung wie der Kamera-Zähler).
- **Bis 2×**: Kamera zählt nach dem Ziel weiter („Geschafft! Weiter bis 2× für Bonus-XP“), „Fertig“ übernimmt die Zahl,
  bei 2× schließt der Zähler von selbst. Auch „Mehr machen“ an einer erledigten Quest prüfen (zählt ab dem alten Stand weiter)
  und dass Schließen (X) nach dem Ziel die Quest trotzdem abhakt.
- **Cover-Foto**: Neues Buch mit Cover (Rückkamera, Ersatz über System-Kamera), Cover ändern/entfernen unter „Buch bearbeiten“.
  Erkennt man das Buch auf dem 320-px-Bild in den Werten?
- Letzte Seite eintragen → Frage „Buch als fertig markieren?“ auf dem Handy durchspielen.

## Neu (Calisthenics, leichte Versionen, Animationen, Update-Meldung) – auf dem Handy prüfen

- Kamera-Erkennung der 16 neuen Übungen ist nur mit erfundenen Körperpunkten getestet. Am unsichersten: Handstand an der Wand
  (kopfüber), L-Sitz, Wadenheben, Seitstütz, Superman vs. Hollow Hold, Sprungkniebeugen. Diamant-Liegestütze nur von vorne
  sicher (von der Seite zählt auch eine normale Liegestütze).
- Update-Meldung: „Jetzt laden“ öffnet die APK über `window.open(url, '_system')` – auf dem Handy prüfen.
- Animationen: schwächste sind Bergsteiger, Handstand, Radfahren, Seilspringen, Treppen (leicht), Ausfallschritte (leicht, Hand am Stuhl).

## Entscheidung von Leo nötig: Belohnungen für Level und Werte

Vorschlag (noch nicht gebaut):

- **Level** schaltet frei: schwerere Monster, neue Arena-Hintergründe, Titel unter dem Namen.
- **Disziplin 10**: ein zweiter Tausch-Joker pro Tag.
- **Ausdauer 25**: Bonus-XP für Läufe.
- **Stärke 25**: mehr Elite-Gegner (mehr XP).
- **Intelligenz 10**: weitere Lese-Erfolge.

Leo hat nur „Bonus-XP“ gewählt (gebaut: Ausdauer 25 = +25 % XP auf Läufe). Den Rest erst wieder anbieten, wenn er fragt. Die Regeln gehören dann in `game.ts` / `battle.ts` mit Tests.

## Kleinere Ideen

- Profilfeld `cameraRequired` wird nicht mehr benutzt (Nachweis ist immer Pflicht). Bleibt im Spielstand, schadet nicht.
- Lese-Quest: Die Seitenzahl pro Tag wächst nicht mit dem Level, nur mit der Schwierigkeit (10 Seiten bei „Fortgeschritten“).
