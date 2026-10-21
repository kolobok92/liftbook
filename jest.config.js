// Component tests (*.test.tsx): real screens and components rendered with React Native Testing
// Library, no emulator, seconds per run. Pure-logic tests (*.test.ts) run in Vitest instead.
module.exports = {
  preset: 'jest-expo/ios',
  testMatch: ['<rootDir>/src/**/*.test.tsx'],
  setupFilesAfterEnv: ['<rootDir>/test/setup.ts'],
};
