import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  timeout: 30000,
  use: {
    baseURL: "http://localhost:3000",
    browserName: "chromium",
    channel: "msedge",
    trace: "retain-on-failure",
    // The specs select by Spanish labels; English is the app default, so pin
    // ES here. `language.spec.ts` clears this to check the English default.
    storageState: {
      cookies: [],
      origins: [
        {
          origin: "http://localhost:3000",
          localStorage: [{ name: "atlas:locale", value: "es" }],
        },
      ],
    },
  },
  webServer: {
    command: "node node_modules/next/dist/bin/next dev --webpack",
    url: "http://localhost:3000",
    reuseExistingServer: true,
    timeout: 120000,
  },
});
