import { useState } from 'react';
import { DEFAULT_EQUIPMENT, DIFFICULTY_LABEL, toDateKey, type Difficulty, type Equipment, type Profile } from '../game';
import { EquipmentPicker, Segmented } from './ui';

export function Onboarding({ onStart }: { onStart: (p: Profile) => void }) {
  const [name, setName] = useState('');
  const [difficulty, setDifficulty] = useState<Difficulty>(1);
  const [seasonDays, setSeasonDays] = useState(66);
  const [equipment, setEquipment] = useState<Equipment[]>(DEFAULT_EQUIPMENT);
  const [noJumping, setNoJumping] = useState(false);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    onStart({ name: name.trim() || 'Held', difficulty, seasonDays, startDate: toDateKey(new Date()), equipment, noJumping });
  };

  return (
    <form className="onboarding" onSubmit={submit}>
      <div className="onboarding-title">
        <span className="display big">Level 1</span>
        <p className="lead">Jeden Tag vier Sport-Quests. Erledige sie, sammle XP und steig im Level auf.</p>
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

      <button className="primary" type="submit">
        Saison starten
      </button>
    </form>
  );
}

export const SEASON_OPTIONS = [30, 66, 90].map((n) => ({ value: n, label: `${n} Tage` }));
