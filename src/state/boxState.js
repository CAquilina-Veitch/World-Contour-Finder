// Single source of truth for the box + anchor. Everyone reads from and writes
// to this via set(); subscribers react. One-directional data flow keeps the
// gizmo, shader uniforms, UI inputs and persistence from drifting apart.

import { DEFAULT_STATE } from '../config.js';

export function createBoxState(initial = {}) {
  let state = { ...DEFAULT_STATE, ...initial };
  const subscribers = new Set();

  function get() {
    return { ...state };
  }

  function set(partial, meta = {}) {
    const next = { ...state, ...partial };
    // Ignore no-op updates to avoid feedback loops during dragging.
    let changed = false;
    for (const k of Object.keys(next)) {
      if (next[k] !== state[k]) {
        changed = true;
        break;
      }
    }
    if (!changed) return;
    state = next;
    for (const fn of subscribers) fn(get(), meta);
  }

  function subscribe(fn) {
    subscribers.add(fn);
    return () => subscribers.delete(fn);
  }

  return { get, set, subscribe };
}
