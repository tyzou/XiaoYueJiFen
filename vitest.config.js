// Vitest configuration for the recent-days-score-selection feature.
// Default environment is `node`. DOM-related tests (anything matching
// `tests/**/dom-*.test.js` plus the date-selector property test) run in
// `jsdom` so they can manipulate a simulated DOM.
const { defineConfig } = require('vitest/config');

module.exports = defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.js'],
    environmentMatchGlobs: [
      ['tests/**/dom-*.test.js', 'jsdom'],
      ['tests/property/dateSelector.property.test.js', 'jsdom']
    ]
  }
});
