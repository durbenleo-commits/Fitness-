// Update check with storage and network, shared by the update dialog and the settings button.
import { useSyncExternalStore } from 'react';
import { RELEASE_API, applyCheck, checkDue, ownBuild, parseRelease, parseRequiredBuild, parseStoredRelease, type CheckReason, type ReleaseInfo } from './update';

const STORAGE_KEY = 'questfit.update.lastCheck';
const RELEASE_KEY = 'questfit.update.release';
const REQUIRED_KEY = 'questfit.update.requiredBuild';
const TIMEOUT_MS = 8000;

export const OWN_BUILD = ownBuild(import.meta.env.VITE_BUILD_NUMBER);

export type CheckResult =
  | { kind: 'newer'; release: ReleaseInfo }
  | { kind: 'current' }
  | { kind: 'error'; status?: number };

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

/** ok with release (null = answered but not one of our releases), or failure with optional HTTP status. */
async function fetchLatest(): Promise<{ ok: true; release: ReleaseInfo | null } | { ok: false; status?: number }> {
  const ctrl = new AbortController();
  const timer = window.setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(RELEASE_API, { signal: ctrl.signal, headers: { Accept: 'application/vnd.github+json' } });
    if (!res.ok) return { ok: false, status: res.status };
    return { ok: true, release: parseRelease(await res.json()) };
  } catch {
    return { ok: false };
  } finally {
    window.clearTimeout(timer);
  }
}

// Shared state: the remembered newer release and whether the user postponed the dialog.
let snapshot: { release: ReleaseInfo | null; dismissed: boolean } = { release: readStored(OWN_BUILD), dismissed: false };
const listeners = new Set<() => void>();

function setSnapshot(next: Partial<typeof snapshot>) {
  snapshot = { ...snapshot, ...next };
  listeners.forEach((l) => l());
}

export function useUpdateState() {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => snapshot,
  );
}

export function dismissUpdate() {
  setSnapshot({ dismissed: true });
}

/**
 * Check GitHub for a newer release. start/manual ignore the throttle, resume follows it.
 * Returns null if skipped (dev build or throttled). A failed request does not use up the throttle.
 */
export async function checkForUpdate(reason: CheckReason): Promise<CheckResult | null> {
  const own = OWN_BUILD;
  if (own === 0) return null;
  const now = Date.now();
  if (!checkDue(reason, readLast(), now)) return null;
  const res = await fetchLatest();
  if (!res.ok) return { kind: 'error', status: res.status };
  writeLast(now);
  if (!res.release) return { kind: 'current' };
  const { release, requiredBuild } = applyCheck(res.release, readRequired(own), own);
  writeRequired(requiredBuild);
  writeStored(release);
  setSnapshot(reason === 'manual' ? { release, dismissed: false } : { release });
  return release ? { kind: 'newer', release } : { kind: 'current' };
}
