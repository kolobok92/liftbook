// Customizes expo-live-activity's widget after its plugin copies the sources into ios/LiveActivity:
// - LiveActivityView.swift (lock screen) is replaced by ours, native/live-activity/ (Boostcamp-like).
// - The Dynamic Island timers are patched to count *up* from `progressBar.date` (the workout's
//   start) instead of down to it. Text(timerInterval:countsDown:) is iOS 16+, matching the
//   extension's 16.2 deployment target.
// - Exercise thumbnails are added to the widget's asset catalog.
//
// Each patch must match exactly once: if the library changes its sources, prebuild fails here
// instead of silently shipping a countdown (covered by plugins/withElapsedLiveActivity.test.ts).
const fs = require('fs');
const path = require('path');
const { withFinalizedMod } = require('expo/config-plugins');

const ELAPSED_HELPER = `
  /// Count-up range for Text(timerInterval:countsDown: false): from the start, open-ended.
  static func elapsedInterval(miliseconds: Double) -> ClosedRange<Self> {
    min(now, Date(timeIntervalSince1970: miliseconds / 1000)) ... Date.distantFuture
  }
`;

const PATCHES = {
  'Date+toTimerInterval.swift': [
    {
      find: /\n}\s*$/,
      replace: `\n${ELAPSED_HELPER}}\n`,
    },
  ],
  'LiveActivityWidget.swift': [
    {
      // Dynamic Island compact/minimal (digital).
      find: 'Text(timerInterval: Date.toTimerInterval(miliseconds: endDate))',
      replace: 'Text(timerInterval: Date.elapsedInterval(miliseconds: endDate), countsDown: false)\n        .monospacedDigit()',
    },
    {
      // Dynamic Island expanded: a big elapsed clock instead of a progress bar.
      find: 'ProgressView(timerInterval: Date.toTimerInterval(miliseconds: endDate))\n      .foregroundStyle(.white)',
      replace:
        'Text(timerInterval: Date.elapsedInterval(miliseconds: endDate), countsDown: false)\n      .font(.system(.title, design: .rounded).monospacedDigit())\n      .fontWeight(.bold)\n      .foregroundStyle(.white)',
    },
  ],
};

/** Our own lock-screen view (native/live-activity), replacing the library's file. */
function addOwnViews(dir, projectRoot) {
  fs.copyFileSync(path.join(projectRoot, 'native', 'live-activity', 'LiveActivityView.swift'), path.join(dir, 'LiveActivityView.swift'));
}

function applyPatches(dir) {
  for (const [file, patches] of Object.entries(PATCHES)) {
    const p = path.join(dir, file);
    let src = fs.readFileSync(p, 'utf8');
    for (const { find, replace, count = 1 } of patches) {
      const matches = typeof find === 'string' ? src.split(find).length - 1 : (src.match(find) || []).length;
      if (matches !== count) throw new Error(`withElapsedLiveActivity: expected ${count} match(es) in ${file} for ${find}, found ${matches}`);
      if (typeof replace === 'function') {
        // Keep the original line's indentation for multi-line replacements.
        src = src.replace(find, (m, offset) => replace(src.slice(src.lastIndexOf('\n', offset) + 1, offset).match(/^\s*/)[0]));
      } else {
        src = typeof find === 'string' ? src.replace(find, () => replace) : src.replace(find, replace);
      }
    }
    fs.writeFileSync(p, src);
  }
}

/**
 * Exercise thumbnails (scripts/build-exercise-thumbs.mjs) as image sets in the widget's asset
 * catalog, named by exercise id, so the Live Activity shows the current exercise's photo with no
 * network or App Group (remote images would need an App Group, which a free Apple ID can't sign).
 */
function addThumbnails(thumbsDir, assetCatalog) {
  let n = 0;
  for (const f of fs.readdirSync(thumbsDir).filter((x) => x.endsWith('.jpg'))) {
    const set = path.join(assetCatalog, `${path.basename(f, '.jpg')}.imageset`);
    fs.mkdirSync(set, { recursive: true });
    fs.copyFileSync(path.join(thumbsDir, f), path.join(set, f));
    fs.writeFileSync(path.join(set, 'Contents.json'), JSON.stringify({ images: [{ idiom: 'universal', filename: f, scale: '2x' }], info: { version: 1, author: 'xcode' } }));
    n++;
  }
  return n;
}

const withElapsedLiveActivity = (config) =>
  withFinalizedMod(config, [
    'ios',
    (c) => {
      const widget = path.join(c.modRequest.platformProjectRoot, 'LiveActivity');
      addOwnViews(widget, c.modRequest.projectRoot);
      applyPatches(widget);
      addThumbnails(path.join(c.modRequest.projectRoot, 'assets', 'exercise-thumbs'), path.join(widget, 'Assets.xcassets'));
      return c;
    },
  ]);

module.exports = withElapsedLiveActivity;
module.exports.applyPatches = applyPatches;
module.exports.addThumbnails = addThumbnails;
module.exports.addOwnViews = addOwnViews;
