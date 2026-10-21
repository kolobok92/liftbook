import { describe, expect, it } from 'vitest';
import { applyKey, type KeypadKey } from './keypadStore';

const type = (start: string, keys: KeypadKey[], integer = false) => {
  let text = start;
  let fresh = true;
  for (const k of keys) {
    text = applyKey(text, fresh, k, integer);
    fresh = false;
  }
  return text;
};

describe('keypad keys', () => {
  it('the first key replaces the number a field opened with; later keys append', () => {
    expect(type('135', ['1', '4', '0'])).toBe('140');
    expect(type('135', ['del'])).toBe(''); // first delete clears it
    expect(type('', ['2', '2', '.', '5'])).toBe('22.5');
    expect(type('', ['1', '0', 'del'])).toBe('1');
  });

  it('keeps numbers sane: one dot, none for reps, two decimals, no leading zero, six chars', () => {
    expect(type('', ['1', '.', '.', '5'])).toBe('1.5');
    expect(type('', ['.', '5'])).toBe('0.5');
    expect(type('', ['8', '.', '5'], true)).toBe('85');
    expect(type('', ['2', '.', '2', '5', '5'])).toBe('2.25');
    expect(type('', ['0', '0', '7'])).toBe('7');
    expect(type('', ['1', '2', '3', '4', '5', '6', '7'])).toBe('123456');
    expect(type('80', ['clear'])).toBe('');
  });
});
