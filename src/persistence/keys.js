import { LS_KEYS, SOURCE } from '../config.js';

// Thin wrappers over localStorage for the API tokens and the last-used source.
// Tokens live only in the browser; nothing is ever committed to the repo.
export const keys = {
  getIonToken: () => localStorage.getItem(LS_KEYS.ionToken) || '',
  setIonToken: (v) => localStorage.setItem(LS_KEYS.ionToken, v || ''),

  getGoogleKey: () => localStorage.getItem(LS_KEYS.googleKey) || '',
  setGoogleKey: (v) => localStorage.setItem(LS_KEYS.googleKey, v || ''),

  getSource: () => localStorage.getItem(LS_KEYS.source) || SOURCE.ion,
  setSource: (v) => localStorage.setItem(LS_KEYS.source, v)
};
