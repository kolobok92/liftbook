import { cpSync, mkdtempSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { describe, expect, it } from 'vitest';

const require = createRequire(import.meta.url);
const { applyPatches, addOwnViews } = require('./withElapsedLiveActivity.js') as { applyPatches: (dir: string) => void; addOwnViews: (dir: string, root: string) => void };

// Runs against the installed library's real Swift sources: catches upstream changes that would
// otherwise only surface as an iOS build failure (or a silent countdown) on CI.
const iosFiles = join(dirname(require.resolve('expo-live-activity/package.json')), 'ios-files');

describe('withElapsedLiveActivity', () => {
  const dir = mkdtempSync(join(tmpdir(), 'la-'));
  cpSync(iosFiles, dir, { recursive: true });
  addOwnViews(dir, '.');
  applyPatches(dir);
  const read = (f: string) => readFileSync(join(dir, f), 'utf8');

  it('installs our lock-screen view and keeps no countdowns', () => {
    expect(read('LiveActivityView.swift')).toContain('Text("LIFTBOOK")');
    // Every displayed clock counts up (the circular style, unused: timerType is digital, keeps its own).
    expect(read('LiveActivityView.swift')).not.toContain('Date.toTimerInterval(');
    expect(read('LiveActivityWidget.swift')).not.toContain('Text(timerInterval: Date.toTimerInterval(');
    expect(read('LiveActivityWidget.swift').match(/elapsedInterval/g)).toHaveLength(2);
    expect(read('Date+toTimerInterval.swift')).toContain('static func elapsedInterval(miliseconds: Double) -> ClosedRange<Self>');
  });

  // No Swift compiler on Windows: cheap checks for the mistakes that would only show up on CI.
  it('our view only uses helpers that exist, and matches how the widget constructs it', () => {
    const view = read('LiveActivityView.swift');
    if (view.includes('Image.dynamic(assetNameOrPath:')) expect(read('Image+dynamic.swift')).toContain('static func dynamic(assetNameOrPath: String) -> Self');
    if (view.includes('Color(hex:')) expect(read('Color+hex.swift')).toContain('init(hex: String)');
    expect(read('LiveActivityWidget.swift')).toContain('LiveActivityView(contentState: context.state, attributes: context.attributes)');
    expect(view).toMatch(/struct LiveActivityView: View \{\s*let contentState: LiveActivityAttributes\.ContentState\s*let attributes: LiveActivityAttributes\s/);
    const count = (c: string) => view.split(c).length - 1;
    expect(count('{')).toBe(count('}'));
    expect(count('(')).toBe(count(')'));
  });

  it('fails loudly when the library sources change', () => {
    const again = mkdtempSync(join(tmpdir(), 'la-'));
    cpSync(dir, again, { recursive: true }); // already patched: patterns no longer match
    expect(() => applyPatches(again)).toThrow(/expected 1 match/);
  });
});

describe('addThumbnails', () => {
  it('adds one image set per thumbnail, named by exercise id', () => {
    const { addThumbnails } = require('./withElapsedLiveActivity.js') as { addThumbnails: (a: string, b: string) => number };
    const catalog = mkdtempSync(join(tmpdir(), 'xcassets-'));
    const n = addThumbnails('assets/exercise-thumbs', catalog);
    expect(n).toBeGreaterThan(700);
    const set = join(catalog, 'bench-press-barbell.imageset');
    expect(JSON.parse(readFileSync(join(set, 'Contents.json'), 'utf8')).images[0]).toEqual({ idiom: 'universal', filename: 'bench-press-barbell.jpg', scale: '2x' });
    expect(readFileSync(join(set, 'bench-press-barbell.jpg')).subarray(0, 2)).toEqual(Buffer.from([0xff, 0xd8])); // a JPEG
  });
});
