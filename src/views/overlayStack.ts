// Back button for sheets and full-screen overlays (quest menu, scanner, reading sheet, ...).
//
// Every open overlay registers its close handler here (useBackClose). While at least one is open,
// one extra history entry sits on top, so the browser's back and Android's back close the topmost
// overlay instead of leaving the screen or the app. The entry is added and removed after React has
// finished a render (setTimeout 0), so swapping one overlay for another in the same update
// (quest menu -> scanner after "Starten") keeps the entry instead of popping and pushing it again.
import { useEffect, useRef } from 'react';

type Entry = { close: () => void };

const stack: Entry[] = [];
/** Marks the history entry this module pushed; 0 when there is none. */
let token = 0;
let lastToken = 0;
/** popstate events caused by our own history.back() (cleanup), to be swallowed. */
let ignorePops = 0;
let scheduled = false;

const stateToken = (st: unknown): unknown => (st as { qfOverlay?: unknown } | null)?.qfOverlay;
const onOurEntry = () => token !== 0 && stateToken(window.history.state) === token;

function sync() {
  scheduled = false;
  if (stack.length > 0) {
    if (onOurEntry()) return;
    // keep the screen of the entry below (qfScreen / qfDepth), so App reads the same screen from it
    token = ++lastToken;
    const below = window.history.state;
    window.history.pushState({ ...(below && typeof below === 'object' ? below : {}), qfOverlay: token }, '');
  } else {
    if (onOurEntry()) {
      ignorePops += 1;
      window.history.back();
    }
    token = 0;
  }
}

function schedule() {
  if (scheduled) return;
  scheduled = true;
  window.setTimeout(sync, 0);
}

/**
 * Called first by App's popstate handler. Returns true when the event belonged to an overlay
 * (back closed the topmost one, or it was our own cleanup), so App leaves its screen as it is.
 */
export function handleOverlayPop(state: unknown): boolean {
  if (ignorePops > 0) {
    ignorePops -= 1;
    return true;
  }
  if (token !== 0 && stateToken(state) !== token) {
    token = 0; // our entry is gone; sync() adds a new one if an overlay is still open afterwards
    stack[stack.length - 1]?.close();
    schedule();
    return true;
  }
  return false;
}

/** Android back: closes the topmost overlay. Returns false when none is open. */
export function closeTopOverlay(): boolean {
  const top = stack[stack.length - 1];
  if (!top) return false;
  top.close();
  return true;
}

/**
 * For a screen opened from inside an overlay (a sheet button that leads to another menu page):
 * true when the current history entry is the overlay entry. The caller then replaces it instead of
 * pushing on top, so no stray entry is left behind once the overlay closes.
 */
export function takeOverlayEntry(): boolean {
  if (!onOurEntry()) return false;
  token = 0;
  return true;
}

/** Escape closes the topmost overlay only (one listener for all of them, so layered overlays never close together). */
let escapeListening = false;
function listenForEscape() {
  if (escapeListening || typeof document === 'undefined') return;
  escapeListening = true;
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !e.defaultPrevented) closeTopOverlay();
  });
}

/** Registers an open overlay: back (browser or Android) calls `onClose` while it is the topmost one. */
export function useBackClose(onClose: () => void) {
  const ref = useRef(onClose);
  ref.current = onClose;
  useEffect(() => {
    const entry: Entry = { close: () => ref.current() };
    listenForEscape();
    stack.push(entry);
    schedule();
    return () => {
      const i = stack.indexOf(entry);
      if (i >= 0) stack.splice(i, 1);
      schedule();
    };
  }, []);
}
