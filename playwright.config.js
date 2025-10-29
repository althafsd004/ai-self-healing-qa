// @ts-check
const { defineConfig } = require('@playwright/test');

module.exports = defineConfig({
  testDir: 'playwright-tests',
  reporter: 'html',
  timeout: 30000,
  retries: 0,
  use: {
    baseURL: process.env.QA_URL || undefined,
  },
});
