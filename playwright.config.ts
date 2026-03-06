import { defineConfig } from '@playwright/test';
import 'dotenv/config';

const projects = [
  { name: 'functional', grep: /\[FUNCTIONAL\]/ },
  { name: 'negative', grep: /\[NEGATIVE\]/ },
];

if (process.env.ENABLE_PERF === '1') {
  projects.push({
    name: 'perf',
    grep: /\[PERF\]/,
    testMatch: /.*\.perf\.ts/,
    workers: parseInt(process.env.PERF_WORKERS || '3', 10),
    repeatEach: parseInt(process.env.PERF_REPEAT || '5', 10),
  } as any);
}

export default defineConfig({
  testDir: 'tests',
  timeout: 30000,
  expect: {
    timeout: 5000,
  },
  retries: parseInt(process.env.RETRIES || '1', 10),
  globalSetup: './tests/global-setup.ts',
  use: {
    baseURL: 'https://api.trello.com/1',
    extraHTTPHeaders: {
      Accept: 'application/json',
      'User-Agent': 'trello-management-api-playwright (by Bruno Salzani)',
    },
  },
  reporter: [
    ['list'],
    ['html', { open: 'never' }],
    ['junit', { outputFile: 'test-results/junit.xml' }],
    ['./reporters/flaky-reporter.cjs'],
  ],
  globalTeardown: './tests/global-teardown.ts',
  workers: 1,
  projects,
});
