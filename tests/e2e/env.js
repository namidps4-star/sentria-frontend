// Shared settings for the browser suites. Override with environment variables:
//   E2E_URL     the app to test (default http://localhost:3201)
//   E2E_CHROME  a Chromium binary (default: the one Playwright manages)
//   E2E_SHOTS   where screenshots go (default tests/e2e/shots, git-ignored)
const fs = require('fs');
const path = require('path');

const SHOTS = process.env.E2E_SHOTS || path.join(__dirname, 'shots');
fs.mkdirSync(SHOTS, { recursive: true });
process.chdir(SHOTS); // the suites save screenshots under relative names

const CLOUD_CHROME = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const chrome = process.env.E2E_CHROME || (fs.existsSync(CLOUD_CHROME) ? CLOUD_CHROME : undefined);

module.exports = {
  APP_URL: process.env.E2E_URL || 'http://localhost:3201',
  LAUNCH: chrome ? { executablePath: chrome } : {},
};
