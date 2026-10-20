import { defineConfig } from '@playwright/test';
import { existsSync } from 'node:fs';
export default defineConfig({
  testDir: './tests/browser',
  workers: 1,
  timeout: 90000,
  use: {
    baseURL: 'http://127.0.0.1:3100',
    viewport: { width: 390, height: 844 },
    hasTouch: true,
    launchOptions: {
      executablePath:
        process.env.CHROMIUM_PATH ||
        (existsSync('/usr/bin/chromium') ? '/usr/bin/chromium' : undefined),
      args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
    },
  },
  webServer: [
    {
      command: 'LEADERBOARD_DB=:memory: ALLOWED_ORIGINS=http://127.0.0.1:3100 npm run leaderboard:serve',
      url: 'http://127.0.0.1:8787/api/leaderboard/health',
      reuseExistingServer: false,
    },
    {
      command: 'DISABLE_HMR=true npm run dev -- --port 3100',
      url: 'http://127.0.0.1:3100',
      reuseExistingServer: !process.env.CI,
    },
    {
      command: 'npm run build && npm run preview -- --host 127.0.0.1 --port 3200',
      url: 'http://127.0.0.1:3200',
      reuseExistingServer: false,
    },
  ],
});
