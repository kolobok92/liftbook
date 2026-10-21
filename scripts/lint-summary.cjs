// Compact ESLint report: one line per problem, then totals. Usage: node scripts/lint-summary.cjs
const { execSync } = require('child_process');
let out;
try {
  out = execSync('npx eslint . -f json', { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, stdio: ['ignore', 'pipe', 'ignore'] });
} catch (e) {
  out = e.stdout; // eslint exits non-zero when there are errors
}
const results = JSON.parse(out);
let errors = 0;
let warnings = 0;
for (const f of results)
  for (const m of f.messages) {
    if (m.severity === 2) errors++;
    else warnings++;
    const file = f.filePath.replace(/.*liftbook[\\/]/, '');
    console.log(`${m.severity === 2 ? 'E' : 'W'} ${file}:${m.line}  ${m.ruleId}  ${m.message.split('\n')[0].slice(0, 100)}`);
  }
console.log(`${errors} errors, ${warnings} warnings`);
process.exit(errors ? 1 : 0);
