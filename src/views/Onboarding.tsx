import { useState } from 'react';
import { DEFAULT_EQUIPMENT, DIFFICULTY_LABEL, toDateKey, type Difficulty, type Equipment, type Profile } from '../game';
import { Sprite } from './Sprites';
import { EquipmentPicker, Segmented } from './ui';

export function Onboarding({ onStart }: { onStart: (p: Profile) => void }) {
  const [name, setName] = useState('');
  const [difficulty, setDifficulty] = useState<Difficulty>(1);
  const [seasonDays, setSeasonDays] = useState(66);
  const [equipment, setEquipment] = useState<Equipment[]>(DEFAULT_EQUIPMENT);
  const [noJumping, setNoJumping] = useState(false);
  const [easyVariants, setEasyVariants] = useState(false);
  const [reading, setReading] = useState(true);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    onStart({ name: name.trim() || 'Held', difficulty, seasonDays, startDate: toDateKey(new Date()), equipment, noJumping, easyVariants, reading });
  };

  return (
    <form className="onboarding" onSubmit={submit}>
      <div className="onboarding-hero" aria-hidden>
        <Sprite enemyId="faulpelz" className="hero-m left" />
        <Sprite enemyId="schweinehund" className="hero-m mid" />
        <Sprite enemyId="handy-zombie" className="hero-m right" />
      </div>
      <div className="onboarding-title">
        <span className="display big">Questfit</span>
        <p className="lead">
          Deine Ausreden haben Gesichter. Jeden Tag vier Sport-Quests und ein Gegner, der besiegt werden will.
        </p>
      </div>

      <label className="field">
        <span>Wie heißt dein Charakter?</span>
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Held" maxLength={20} autoComplete="off" />
      </label>

      <fieldset className="field">
        <legend>Wie fit bist du gerade?</legend>
        <Segmented
          options={([1, 2, 3] as Difficulty[]).map((d) => ({ value: d, label: DIFFICULTY_LABEL[d] }))}
          value={difficulty}
          onChange={setDifficulty}
        />
      </fieldset>

      <fieldset className="field">
        <legend>Wie lang soll deine Saison dauern?</legend>
        <Segmented options={SEASON_OPTIONS} value={seasonDays} onChange={setSeasonDays} />
      </fieldset>

      <fieldset className="field">
        <legend>Was hast du zur Verfügung?</legend>
        <EquipmentPicker
          equipment={equipment}
          noJumping={noJumping}
          onChange={(eq, nj) => {
            setEquipment(eq);
            setNoJumping(nj);
          }}
        />
      </fieldset>

      <fieldset className="field">
        <legend>Was soll dazugehören?</legend>
        <label className="check">
          <input type="checkbox" checked={easyVariants} onChange={(e) => setEasyVariants(e.target.checked)} />
          <span>
            Leichtere Varianten
            <small>Zum Beispiel Knie-Liegestütze oder Australische Klimmzüge. Für alle, die einfacher einsteigen wollen.</small>
          </span>
        </label>
        <label className="check">
          <input type="checkbox" checked={reading} onChange={(e) => setReading(e.target.checked)} />
          <span>
            Lesen als tägliche Quest
            <small>Jeden Tag ein paar Seiten, mit einem Foto der Seite als Nachweis. Bringt Intelligenz.</small>
          </span>
        </label>
      </fieldset>

      <p className="small-text">
        Jede Quest braucht einen Nachweis: Die Kamera zählt deine Wiederholungen, Schritte und Training kommen aus Samsung Health.
      </p>

      <button className="primary" type="submit">
        Saison starten
      </button>
    </form>
  );
}

export const SEASON_OPTIONS = [30, 66, 90].map((n) => ({ value: n, label: `${n} Tage` }));
