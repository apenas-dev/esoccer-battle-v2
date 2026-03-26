import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  timeout: 60000,
  retries: 0,
  use: {
    baseURL: 'http://localhost:5174',
    headless: true,
    screenshot: 'on',
    trace: 'on-first-retry',
  },
  expect: {
    timeout: 10000,
  },
});
