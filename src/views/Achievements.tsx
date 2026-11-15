import type { AchievementStatus } from '../achievements';

export function AchievementsView({ list }: { list: AchievementStatus[] }) {
  const unlocked = list.filter((a) => a.unlocked).length;
  return (
    <section>
      <div className="section-head">
        <h1>Erfolge</h1>
        <span className="count">
          {unlocked} von {list.length}
        </span>
      </div>
      <ul className="achievements">
        {list.map(({ achievement: a, value, unlocked }) => (
          <li key={a.id} className={unlocked ? 'unlocked' : ''}>
            <span className="ach-icon" aria-hidden>
              {a.icon}
            </span>
            <span className="ach-text">
              <strong>{a.title}</strong>
              <span>{a.description}</span>
              {!unlocked && a.target > 1 && (
                <span className="ach-progress" role="progressbar" aria-valuemin={0} aria-valuemax={a.target} aria-valuenow={value}>
                  <span style={{ width: `${(value / a.target) * 100}%` }} />
                </span>
              )}
            </span>
            <span className="ach-state">
              {unlocked ? (
                <span className="ach-done" aria-label="freigeschaltet">
                  ✓
                </span>
              ) : (
                `${value.toLocaleString('de-DE')} / ${a.target.toLocaleString('de-DE')}`
              )}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
