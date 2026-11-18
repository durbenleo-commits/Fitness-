import { useEffect } from 'react';
import { OWN_BUILD, checkForUpdate, dismissUpdate, useUpdateState } from '../updateCheck';

let startChecked = false;

/**
 * Checks GitHub for a newer release at every app start and on resume (resume at most every 15 min).
 * Silent when offline, in dev (no build number) or when up to date.
 */
export function UpdatePrompt() {
  const own = OWN_BUILD;
  const { release, dismissed } = useUpdateState();

  useEffect(() => {
    // First mount of the session ignores the throttle; the prompt may remount (onboarding to main view).
    if (!startChecked) {
      startChecked = true;
      void checkForUpdate('start');
    }
    const onShow = () => document.visibilityState !== 'hidden' && void checkForUpdate('resume');
    document.addEventListener('visibilitychange', onShow);
    document.addEventListener('resume', onShow);
    return () => {
      document.removeEventListener('visibilitychange', onShow);
      document.removeEventListener('resume', onShow);
    };
  }, []);

  if (!release || (dismissed && !release.required)) return null;

  const download = () => {
    window.open(release.url, '_system');
  };

  return (
    <div className="overlay sheet-overlay" style={{ zIndex: 40 }} role="alertdialog" aria-modal="true" aria-labelledby="update-title">
      <div className="sheet" style={{ gap: '0.8rem' }}>
        <header className="sheet-head">
          <strong id="update-title">Update verfügbar: Questfit {release.build}</strong>
        </header>
        <p>
          {release.required
            ? 'Dieses Update ist Pflicht. Bitte installiere es, bevor du weitermachst. Dein Fortschritt bleibt erhalten.'
            : `Du hast Version ${own}. Die neue Version installiert sich über die alte, dein Fortschritt bleibt erhalten.`}
        </p>
        <button className="primary" onClick={download} autoFocus>
          Jetzt laden
        </button>
        {!release.required && (
          <button className="secondary" onClick={() => dismissUpdate()}>
            Später
          </button>
        )}
      </div>
    </div>
  );
}
