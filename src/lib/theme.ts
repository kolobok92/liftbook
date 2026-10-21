export const DARK = {
  bg: '#161616',
  surface: '#242424',
  surface2: '#2F2F2F',
  surface3: '#3A3A3A',
  /** Selected segment of a segmented control. */
  segmentOn: '#3A3A3A',
  border: '#353535',
  text: '#F4F4F5',
  textDim: '#A1A1A6',
  textFaint: '#6B6B70',
  /** Fills (buttons, checks, active outlines). Text in the accent colour uses accentText. */
  accent: '#FFC400',
  accentText: '#FFC400',
  accentDim: '#5A4710',
  onAccent: '#121212',
  orange: '#FF8A3D',
  green: '#34C77B',
  greenDim: '#163D2A',
  red: '#FF5A52',
  redDim: '#4A1E1C',
  blue: '#5AA9FF',
  warmup: '#FFC21A',
  drop: '#34C77B',
  failure: '#FF5A52',
};

export type Palette = typeof DARK;

const LIGHT: Palette = {
  bg: '#F4F4F6',
  surface: '#FFFFFF',
  surface2: '#EFEFF2',
  surface3: '#E3E3E8',
  segmentOn: '#FFFFFF',
  border: '#E1E1E6',
  text: '#141416',
  textDim: '#5E5E66',
  textFaint: '#9A9AA2',
  accent: '#FFC400',
  // Yellow text is unreadable on white; a dark gold keeps the accent at ~5:1 contrast.
  accentText: '#8A6400',
  accentDim: '#FFF0C2',
  onAccent: '#121212',
  orange: '#D9620F',
  green: '#1E9A5A',
  greenDim: '#DCF4E7',
  red: '#E0352C',
  redDim: '#FDE3E1',
  blue: '#1F74D6',
  warmup: '#B98600',
  drop: '#1E9A5A',
  failure: '#E0352C',
};

export type Scheme = 'light' | 'dark';

/**
 * The active palette. Mutated in place by applyScheme() so `C.x` reads stay a plain property
 * access everywhere; the root layout remounts the tree when the scheme changes.
 */
export const C: Palette = { ...DARK };
export let scheme: Scheme = 'dark';
let version = 0;

export function applyScheme(s: Scheme) {
  if (s === scheme) return;
  Object.assign(C, s === 'light' ? LIGHT : DARK);
  scheme = s;
  version++;
}

/**
 * For module-level style objects that read C: rebuilt lazily after a scheme change instead of
 * freezing the colours of whichever scheme was active at import time.
 */
export function themed<T extends object>(make: () => T): T {
  let cache: T | undefined;
  let at = -1;
  const current = () => {
    if (at !== version) {
      cache = make();
      at = version;
    }
    return cache!;
  };
  return new Proxy({} as T, {
    get: (_t, k) => Reflect.get(current(), k),
    has: (_t, k) => Reflect.has(current(), k),
    ownKeys: () => Reflect.ownKeys(current()),
    getOwnPropertyDescriptor: (_t, k) => Reflect.getOwnPropertyDescriptor(current(), k),
  });
}

export const R = { sm: 6, md: 10, lg: 14 };

export const SET_TYPE_COLOR = themed(() => ({ normal: C.textDim, warmup: C.warmup, drop: C.drop, failure: C.failure }) as const);
