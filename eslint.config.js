// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ['dist/*', '.cache/*', 'e2e-results/*', 'e2e-report/*', 'e2e-screens/*', 'e2e-flows/*', 'e2e-video/*'],
  },
  {
    rules: {
      // Hermes (React Native's JS engine) doesn't reliably provide it; use clone() from lib/calc.
      'no-restricted-globals': ['error', { name: 'structuredClone', message: 'Use clone() from @/lib/calc — structuredClone is not reliable on Hermes.' }],
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
    },
  },
]);
