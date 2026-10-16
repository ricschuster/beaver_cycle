import { defineConfig } from '@playwright/test';

const port = process.env.E2E_PORT ?? '5173';

// Headless Chromium draws with SwiftShader on the CPU, about 3 fps on the real valley, so a playtest that steers with the keys
// overshoots every point by a metre or two. Locally the GPU through ANGLE gives 60 fps. CI has no GPU, and E2E_SOFTWARE_GL=1 keeps
// the CPU drawing on a machine that has none.
const gpu = !process.env.CI && !process.env.E2E_SOFTWARE_GL;

export default defineConfig({
  testDir: 'tests/e2e',
  webServer: {
    command: `npm run dev -- --port ${port} --strictPort`,
    url: `http://localhost:${port}`,
    reuseExistingServer: !process.env.CI,
  },
  use: {
    baseURL: `http://localhost:${port}`,
    launchOptions: { args: gpu ? ['--use-angle=gl', '--use-gl=angle', '--ignore-gpu-blocklist'] : [] },
  },
});
