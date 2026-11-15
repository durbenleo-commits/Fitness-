import type { AchievementStatus } from '../achievements';
import { Badge3D } from './Icons';

export function AchievementsView({ list }: { list: AchievementStatus[] }) {
  const unlocked = list.filter((a) => a.unlocked).length;
  const tiers = (['gold', 'silver', 'bronze'] as const).map((t) => ({
    tier: t,
    got: list.filter((a) => a.unlocked && a.achievement.tier === t).length,
    all: list.filter((a) => a.achievement.tier === t).length,
  }));
  const label = { gold: 'Gold', silver: 'Silber', bronze: 'Bronze' };

  return (
    <section>
      <div className="section-head">
        <h1>Erfolge</h1>
        <span className="count">
          {unlocked} von {list.length}
        </span>
      </div>

      <div className="tier-summary">
        {tiers.map((t) => (
          <div key={t.tier} className="tier-pill">
            <Badge3D icon="medal" tone={t.got > 0 ? t.tier : 'locked'} shape="coin" size={30} />
            <span>
              <strong>{t.got}</strong>/{t.all} {label[t.tier]}
            </span>
          </div>
        ))}
      </div>

      <ul className="achievements">
        {list.map(({ achievement: a, value, unlocked }) => (
          <li key={a.id} className={`ach tier-${a.tier} ${unlocked ? 'unlocked' : ''}`}>
            <Badge3D icon={a.icon} tone={unlocked ? a.tier : 'locked'} shape="coin" size={52} />
            <strong className="ach-title">{a.title}</strong>
            <span className="ach-desc">{a.description}</span>
            {unlocked ? (
              <span className="ach-state got">{label[a.tier]}</span>
            ) : (
              <span className="ach-meter" role="progressbar" aria-valuemin={0} aria-valuemax={a.target} aria-valuenow={value} aria-label={`${value} von ${a.target}`}>
                <span style={{ width: `${(value / a.target) * 100}%` }} />
                <em>
                  {value.toLocaleString('de-DE')} / {a.target.toLocaleString('de-DE')}
                </em>
              </span>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
