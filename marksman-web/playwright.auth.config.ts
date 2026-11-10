import { defineConfig } from "@playwright/test";
import base from "./playwright.config";

// Isolated real-React harness; no Next server or application changes required.
export default defineConfig({
  ...base,
  testMatch: "auth-provider.spec.ts",
  webServer: undefined,
});
