// Pure logic for the "new version available" check. No network or storage here (see views/UpdatePrompt.tsx).

export const RELEASE_API = 'https://api.github.com/repos/durbenleo-commits/Fitness-/releases/latest';
export const RELEASE_PAGE = 'https://github.com/durbenleo-commits/Fitness-/releases/latest';
export const CHECK_INTERVAL_MS = 6 * 60 * 60 * 1000;
export const REQUIRED_MARKER = '[pflicht]';

export interface ReleaseInfo {
  build: number;
  /** Marker `[pflicht]` in the release body: the update cannot be postponed. */
  required: boolean;
  /** Direct APK asset if present, else the release page. */
  url: string;
}

/** Build number from a release tag such as `apk-42`; null if the tag has another shape. */
export function parseBuild(tag: unknown): number | null {
  if (typeof tag !== 'string') return null;
  const m = /^apk-(\d+)$/.exec(tag.trim());
  if (!m) return null;
  const n = Number(m[1]);
  return Number.isSafeInteger(n) ? n : null;
}

export function hasRequiredMarker(body: unknown): boolean {
  return typeof body === 'string' && body.toLowerCase().includes(REQUIRED_MARKER);
}

/** Turn the GitHub "latest release" JSON into ReleaseInfo, or null if it does not look like one of ours. */
export function parseRelease(json: unknown): ReleaseInfo | null {
  if (!json || typeof json !== 'object') return null;
  const r = json as { tag_name?: unknown; body?: unknown; html_url?: unknown; assets?: unknown };
  const build = parseBuild(r.tag_name);
  if (build === null) return null;
  let url = typeof r.html_url === 'string' && r.html_url.startsWith('https://') ? r.html_url : RELEASE_PAGE;
  if (Array.isArray(r.assets)) {
    for (const a of r.assets) {
      const dl = a && typeof a === 'object' ? (a as { browser_download_url?: unknown }).browser_download_url : null;
      if (typeof dl === 'string' && dl.startsWith('https://') && dl.endsWith('.apk')) {
        url = dl;
        break;
      }
    }
  }
  return { build, required: hasRequiredMarker(r.body), url };
}

/** Own build number from VITE_BUILD_NUMBER; missing or invalid = 0 = no check. */
export function ownBuild(raw: unknown): number {
  const n = Number(raw);
  return Number.isSafeInteger(n) && n > 0 ? n : 0;
}

export function isNewer(latest: number, own: number): boolean {
  return own > 0 && latest > own;
}

/** True if a check is due: never checked, clock went backwards, or interval elapsed. */
export function shouldCheck(lastCheck: number | null, now: number, intervalMs = CHECK_INTERVAL_MS): boolean {
  if (lastCheck === null || !Number.isFinite(lastCheck)) return true;
  if (lastCheck > now) return true;
  return now - lastCheck >= intervalMs;
}

/** Restore a release remembered in storage; null if missing, malformed, or no longer newer than the own build. */
export function parseStoredRelease(raw: string | null, own: number): ReleaseInfo | null {
  if (!raw) return null;
  try {
    const j = JSON.parse(raw) as Partial<ReleaseInfo> | null;
    if (!j || typeof j !== 'object') return null;
    const { build, required, url } = j;
    if (typeof build !== 'number' || !Number.isSafeInteger(build)) return null;
    if (typeof url !== 'string' || !url.startsWith('https://')) return null;
    if (!isNewer(build, own)) return null;
    return { build, required: required === true, url };
  } catch {
    return null;
  }
}

/** Remembered required build from storage; 0 if none, malformed, or the own build has caught up. */
export function parseRequiredBuild(raw: string | null, own: number): number {
  if (!raw) return 0;
  const n = Number(raw);
  return Number.isSafeInteger(n) && n > own ? n : 0;
}

/**
 * Combine a freshly fetched latest release with the remembered required build.
 * A required release stays required until the own build reaches it, even if a newer optional release appears.
 */
export function applyCheck(
  latest: ReleaseInfo,
  prevRequiredBuild: number,
  own: number,
): { release: ReleaseInfo | null; requiredBuild: number } {
  let requiredBuild = prevRequiredBuild > own ? prevRequiredBuild : 0;
  if (latest.required && latest.build > own) requiredBuild = Math.max(requiredBuild, latest.build);
  if (!isNewer(latest.build, own)) return { release: null, requiredBuild: 0 };
  return { release: { ...latest, required: requiredBuild > own }, requiredBuild };
}
