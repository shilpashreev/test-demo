// @ts-check
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  timeout: 30_000,
  fullyParallel: true,
  retries: process.env.CI ? 2 : 0,
  // Configure reporters
  reporter: [
    // This generates the interactive HTML report in 'playwright-report/'
    ['html', { open: 'never' }], 
     ['json', { outputFile: 'results/report.json' }], 
    
    // This generates the JUnit XML report in 'results/junit.xml'
    ['junit', { outputFile: 'results/junit.xml' }],
    
    // Always include 'list' for console output during the run
    ['list'] 
  ],
  use: {
    baseURL: 'https://playwright.dev',
    headless: true,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure'
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'firefox',  use: { ...devices['Desktop Firefox'] } },
    { name: 'webkit',   use: { ...devices['Desktop Safari'] } }
  ]
});
