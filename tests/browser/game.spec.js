import { test, expect } from "@playwright/test";
import { scenes } from "../../server/scenes.js";

async function tag(page, target, characterId = target.id) {
  const image = page.locator("#scene-image");
  const viewport = page.locator("#scene-viewport");
  // Scroll a zoomed or mobile scene so the intended character is visible.
  await viewport.evaluate((element, t) => {
    const image = document.getElementById("scene-image");
    element.scrollLeft =
      (t.x / 1440) * image.clientWidth - element.clientWidth / 2;
    element.scrollTop =
      (t.y / 900) * image.clientHeight - element.clientHeight / 2;
  }, target);
  const rect = await image.boundingBox();
  await page.mouse.click(
    rect.x + (target.x / 1440) * rect.width,
    rect.y + (target.y / 900) * rect.height,
  );
  await expect(page.locator("#target")).toBeVisible();
  await page.locator(`[data-character="${characterId}"]`).click();
  await expect(page.locator("#target")).toBeHidden();
}
test("complete hunt, miss feedback, reload, zoom, score submission, leaderboard", async ({
  page,
}) => {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await expect(page.locator("#start-button")).toBeEnabled();
  await page.locator("#start-button").click();
  await expect(page.locator("#start-overlay")).toBeHidden();
  await tag(page, { x: 700, y: 590, id: "waldo" });
  await expect(page.locator("#toast")).toContainText("Not quite");
  await page.waitForTimeout(300);
  await tag(page, scenes[0].targets[0]);
  await expect(page.locator("#found-count")).toHaveText("1 / 3");
  await page.reload();
  await expect(page.locator("#found-count")).toHaveText("1 / 3");
  await expect(page.locator(".marker")).toHaveCount(1);
  await page.locator("#zoom-in").click();
  await expect(page.locator("#zoom-label")).toHaveText("150%");
  await tag(page, scenes[0].targets[1]);
  await expect(page.locator("#found-count")).toHaveText("2 / 3");
  await page.waitForTimeout(300);
  await tag(page, scenes[0].targets[2]);
  await expect(page.locator("#finish-dialog")).toBeVisible();
  await expect(page.locator("#found-count")).toHaveText("3 / 3");
  await page.locator("#player-name").fill("Test Explorer");
  await page.locator("#save-score").click();
  await expect(page.locator("#score-success")).toBeVisible();
  await page.locator("#finish-leaderboard").click();
  await expect(page.locator(".score-table")).toContainText("Test Explorer");
  await expect(page.locator(".score-table")).toContainText("00:");
  expect(errors).toEqual([]);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
});
test("scene switching, outside dismissal, help, restart confirmation, keyboard targeting", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.locator("#start-button")).toBeEnabled();
  await page.locator('[data-scene="market"]').click();
  await expect(page.locator("#scene-name")).toHaveText("The weekend market");
  await page.locator("#start-button").click();
  await expect(page.locator("#start-overlay")).toBeHidden();
  await page.locator("#scene-image").focus();
  await page.keyboard.press("ArrowRight");
  await expect(page.locator("#keyboard-cursor")).toBeVisible();
  await page.keyboard.press("Enter");
  await expect(page.locator("#target")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.locator("#target")).toBeHidden();
  await page.locator("#help-button").click();
  await expect(page.locator("#help-dialog")).toBeVisible();
  await page.locator('[data-close="help-dialog"]').last().click();
  await page.locator('[data-scene="coast"]').click();
  await expect(page.locator("#confirm-dialog")).toBeVisible();
  await page.locator("#cancel-change").click();
  await expect(page.locator("#scene-name")).toHaveText("The weekend market");
  await page.locator('[data-scene="coast"]').click();
  await page.locator("#confirm-change").click();
  await expect(page.locator("#scene-name")).toHaveText("A day at the coast");
  await expect(page.locator("#start-overlay")).toBeVisible();
  await page.locator("#start-button").click();
  await expect(page.locator("#start-overlay")).toBeHidden();
  await page.locator("#restart-button").click();
  await page.locator("#confirm-change").click();
  await expect(page.locator("#found-count")).toHaveText("0 / 3");
});
