import { useCallback, useEffect, useState } from 'react';
import { RELEASE_API, applyCheck, ownBuild, parseRelease, parseRequiredBuild, parseStoredRelease, shouldCheck, type ReleaseInfo } from '../update';

const STORAGE_KEY = 'questfit.update.lastCheck';
const RELEASE_KEY = 'questfit.update.release';
const REQUIRED_KEY = 'questfit.update.requiredBuild';
const TIMEOUT_MS = 8000;

function readLast(): number | null {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    return v === null ? null : Number(v);
  } catch {
    return null;
  }
}

function writeLast(t: number) {
  try {
    localStorage.setItem(STORAGE_KEY, String(t));
  } catch {
    /* storage unavailable: just check again next time */
  }
}

function readRequired(own: number): number {
  try {
    return parseRequiredBuild(localStorage.getItem(REQUIRED_KEY), own);
  } catch {
    return 0;
  }
}

function writeRequired(build: number) {
  try {
    if (build > 0) localStorage.setItem(REQUIRED_KEY, String(build));
    else localStorage.removeItem(REQUIRED_KEY);
  } catch {
    /* ignore */
  }
}

function readStored(own: number): ReleaseInfo | null {
  try {
    const r = parseStoredRelease(localStorage.getItem(RELEASE_KEY), own);
    return r && readRequired(own) > own ? { ...r, required: true } : r;
  } catch {
    return null;
  }
}

function writeStored(r: ReleaseInfo | null) {
  try {
    if (r) localStorage.setItem(RELEASE_KEY, JSON.stringify(r));
    else localStorage.removeItem(RELEASE_KEY);
  } catch {
    /* ignore */
  }
}

/** Fetch the latest release. undefined = request failed (offline, rate limit); null = answered but not one of our releases. */
async function fetchLatest(): Promise<ReleaseInfo | null | undefined> {
  const ctrl = new AbortController();
  const timer = window.setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(RELEASE_API, { signal: ctrl.signal, headers: { Accept: 'application/vnd.github+json' } });
    if (!res.ok) return undefined;
    return parseRelease(await res.json());
  } catch {
    return undefined;
  } finally {
    window.clearTimeout(timer);
  }
}

/**
 * Checks GitHub for a newer release at start and on resume (at most every 6 h).
 * Silent when offline, in dev (no build number) or when up to date.
 */
export function UpdatePrompt() {
  const own = ownBuild(import.meta.env.VITE_BUILD_NUMBER);
  const [release, setRelease] = useState<ReleaseInfo | null>(() => readStored(own));
  const [dismissed, setDismissed] = useState(false);

  const check = useCallback(async () => {
    if (own === 0) return;
    const now = Date.now();
    if (!shouldCheck(readLast(), now)) return;
    const latest = await fetchLatest();
    if (latest === undefined) return; // failed: keep what is remembered and do not use up the throttle
    writeLast(now);
    if (!latest) return;
    const { release: next, requiredBuild } = applyCheck(latest, readRequired(own), own);
    writeRequired(requiredBuild);
    writeStored(next);
    setRelease(next);
  }, [own]);

  useEffect(() => {
    void check();
    const onShow = () => document.visibilityState !== 'hidden' && void check();
    document.addEventListener('visibilitychange', onShow);
    document.addEventListener('resume', onShow);
    return () => {
      document.removeEventListener('visibilitychange', onShow);
      document.removeEventListener('resume', onShow);
    };
  }, [check]);

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
          <button className="secondary" onClick={() => setDismissed(true)}>
            Später
          </button>
        )}
      </div>
    </div>
  );
}
