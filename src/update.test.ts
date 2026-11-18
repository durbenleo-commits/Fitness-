import { describe, expect, it } from 'vitest';
import { CHECK_INTERVAL_MS, RELEASE_PAGE, isNewer, ownBuild, parseBuild, parseRelease, parseStoredRelease, shouldCheck } from './update';

describe('update check', () => {
  it('parses apk tags', () => {
    expect(parseBuild('apk-42')).toBe(42);
    expect(parseBuild('v1.2')).toBeNull();
    expect(parseBuild('apk-')).toBeNull();
    expect(parseBuild(7)).toBeNull();
  });

  it('compares build numbers; own 0 never updates', () => {
    expect(isNewer(5, 4)).toBe(true);
    expect(isNewer(4, 4)).toBe(false);
    expect(isNewer(3, 4)).toBe(false);
    expect(isNewer(99, 0)).toBe(false);
  });

  it('reads own build from env text', () => {
    expect(ownBuild('12')).toBe(12);
    expect(ownBuild(undefined)).toBe(0);
    expect(ownBuild('abc')).toBe(0);
    expect(ownBuild('-3')).toBe(0);
  });

  it('parses release with marker and asset', () => {
    const r = parseRelease({
      tag_name: 'apk-9',
      body: 'Wichtig [Pflicht]',
      html_url: 'https://github.com/x/y/releases/tag/apk-9',
      assets: [{ browser_download_url: 'https://github.com/x/y/releases/download/apk-9/questfit.apk' }],
    });
    expect(r).toEqual({ build: 9, required: true, url: 'https://github.com/x/y/releases/download/apk-9/questfit.apk' });
  });

  it('falls back to the release page and handles junk', () => {
    expect(parseRelease({ tag_name: 'apk-3', body: 'x' })).toEqual({ build: 3, required: false, url: RELEASE_PAGE });
    expect(parseRelease({ tag_name: 'nightly' })).toBeNull();
    expect(parseRelease(null)).toBeNull();
  });

  it('throttles to 6 hours', () => {
    const now = 1_000_000_000_000;
    expect(shouldCheck(null, now)).toBe(true);
    expect(shouldCheck(now - 1000, now)).toBe(false);
    expect(shouldCheck(now - CHECK_INTERVAL_MS, now)).toBe(true);
    expect(shouldCheck(now + 5000, now)).toBe(true);
  });

  it('restores a stored newer release (required stays required)', () => {
    const raw = JSON.stringify({ build: 8, required: true, url: RELEASE_PAGE });
    expect(parseStoredRelease(raw, 5)).toEqual({ build: 8, required: true, url: RELEASE_PAGE });
  });

  it('drops stored release once own build has caught up, or when junk', () => {
    const raw = JSON.stringify({ build: 8, required: true, url: RELEASE_PAGE });
    expect(parseStoredRelease(raw, 8)).toBeNull();
    expect(parseStoredRelease(raw, 9)).toBeNull();
    expect(parseStoredRelease(raw, 0)).toBeNull();
    expect(parseStoredRelease(null, 5)).toBeNull();
    expect(parseStoredRelease('{bad', 5)).toBeNull();
    expect(parseStoredRelease(JSON.stringify({ build: 8, url: 'http://x' }), 5)).toBeNull();
  });
});
