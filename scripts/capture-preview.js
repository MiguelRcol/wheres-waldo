import { chromium } from "@playwright/test";
import { mkdirSync } from "node:fs";
const browser = await chromium.launch(
  process.env.PLAYWRIGHT_CHANNEL
    ? { channel: process.env.PLAYWRIGHT_CHANNEL }
    : {},
);
mkdirSync("docs", { recursive: true });
const page = await browser.newPage({
  viewport: { width: 1440, height: 1120 },
  deviceScaleFactor: 1,
});
await page.goto("http://127.0.0.1:3000");
await page.locator("#start-button").waitFor();
await page.waitForFunction(
  () => !document.getElementById("start-button").disabled,
);
await page.evaluate(() => document.fonts.ready);
await page.screenshot({ path: "docs/desktop-preview.png", fullPage: true });
await page.setViewportSize({ width: 390, height: 844 });
await page.screenshot({ path: "docs/mobile-preview.png", fullPage: true });
await browser.close();
