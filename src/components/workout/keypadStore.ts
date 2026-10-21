// The in-app number pad's state (Boostcamp-style: no system keyboard, so nothing slides, resizes
// or fights over the caret). Set fields open it with a target; key presses edit the target's text
// and report the parsed number on every key, like typing.
import type { ComponentRef } from 'react';
import type { View } from 'react-native';
import { create } from 'zustand';
import { parseNum } from '../../lib/calc';

export type KeypadKey = '0' | '1' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '.' | 'del' | 'clear';

export type KeypadTarget = {
  /** Unique per field (set id + field), so a field knows it's the one being edited. */
  id: string;
  integer: boolean;
  label: string;
  onChange: (n: number | null) => void;
  /** Move to the following field; absent on the last one (the pad then shows Done). */
  next?: () => void;
  /** The field's view, measured to keep it above the pad. */
  anchor?: ComponentRef<typeof View> | null;
};

const MAX_LEN = 6;

/**
 * One key press. A freshly opened field acts as if its number were selected: the first digit
 * replaces it and the first delete clears it.
 */
export function applyKey(text: string, fresh: boolean, key: KeypadKey, integer: boolean): string {
  if (key === 'clear') return '';
  if (key === 'del') return fresh ? '' : text.slice(0, -1);
  const base = fresh ? '' : text;
  if (key === '.') {
    if (integer || base.includes('.')) return base;
    return base === '' ? '0.' : `${base}.`;
  }
  if (base.length >= MAX_LEN) return base;
  const dot = base.indexOf('.');
  if (dot >= 0 && base.length - dot > 2) return base; // two decimals at most (2.25 kg plates)
  if (base === '0') return key; // no leading zeros
  return base + key;
}

type KeypadState = {
  target: KeypadTarget | null;
  text: string;
  fresh: boolean;
  open: (target: KeypadTarget, text: string) => void;
  press: (key: KeypadKey) => void;
  next: () => void;
  close: () => void;
};

export const useKeypad = create<KeypadState>((set, get) => ({
  target: null,
  text: '',
  fresh: true,
  open: (target, text) => set({ target, text, fresh: true }),
  press: (key) => {
    const { target, text, fresh } = get();
    if (!target) return;
    const next = applyKey(text, fresh, key, target.integer);
    set({ text: next, fresh: false });
    target.onChange(parseNum(next));
  },
  next: () => {
    const { target } = get();
    if (target?.next) target.next();
    else set({ target: null });
  },
  close: () => set({ target: null }),
}));
