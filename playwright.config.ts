import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  timeout: 60000,
  retries: 0,
  use: {
    baseURL: 'https://bmuupgrzbfmddjwcqlss.supabase.co',
  },
  reporter: [['list'], ['json', { outputFile: 'e2e/results.json' }]],
});
