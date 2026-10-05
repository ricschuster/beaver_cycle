import { defineConfig } from '@playwright/test';

const port = process.env.E2E_PORT ?? '5173';

export default defineConfig({
  testDir: 'tests/e2e',
  webServer: {
    command: `npm run dev -- --port ${port} --strictPort`,
    url: `http://localhost:${port}`,
    reuseExistingServer: !process.env.CI,
  },
  use: { baseURL: `http://localhost:${port}` },
});
