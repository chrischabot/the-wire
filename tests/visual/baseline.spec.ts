/**
 * Visual Baseline Tests - Run with --update-snapshots to generate baselines
 * Usage: npx playwright test tests/visual/baseline.spec.ts --update-snapshots
 */

import { test, expect } from "@playwright/test";
import {
  THEMES,
  PAGES,
  setTheme,
  navigateAndStabilize,
  ensureLoggedIn,
  TEST_USER,
} from "./helpers";

test.describe("Visual Baselines", () => {
  for (const theme of THEMES) {
    test.describe(`Theme: ${theme}`, () => {
      for (const pageConfig of PAGES) {
        test(`${pageConfig.name}`, async ({ page }) => {
          await setTheme(page, theme);

          if (pageConfig.auth) {
            await ensureLoggedIn(page);
            await setTheme(page, theme);
          }

          await navigateAndStabilize(page, pageConfig.path);

          await expect(page).toHaveScreenshot(
            `${pageConfig.name}-${theme}.png`,
            {
              fullPage: true,
              animations: "disabled",
              mask: [
                page.locator(".timestamp"),
                page.locator(".post-timestamp"),
                page.locator(".notification-badge"),
                page.locator(".unread-count"),
                page.locator('[data-testid="timestamp"]'),
              ],
            },
          );
        });
      }
    });
  }
});

test.describe("Component Baselines", () => {
  test.beforeEach(async ({ page }) => {
    await ensureLoggedIn(page);
  });

  test("post-card-with-content", async ({ page }) => {
    await setTheme(page, "maia");
    await navigateAndStabilize(page, "/home");

    const postCard = page.locator(".post-card").first();
    await expect(postCard).toBeVisible({ timeout: 10000 });

    await expect(postCard).toHaveScreenshot("post-card.png", {
      animations: "disabled",
      mask: [
        postCard.locator(".timestamp"),
        postCard.locator(".post-timestamp"),
      ],
    });
  });

  test("compose-box", async ({ page }) => {
    await setTheme(page, "maia");
    await navigateAndStabilize(page, "/home");

    const composeBox = page.locator(".compose-container, .compose-box").first();
    await expect(composeBox).toBeVisible({ timeout: 5000 });

    await expect(composeBox).toHaveScreenshot("compose-box.png", {
      animations: "disabled",
    });
  });

  test("sidebar-navigation", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await setTheme(page, "maia");
    await navigateAndStabilize(page, "/home");

    const sidebar = page.locator(".sidebar-left").first();
    await expect(sidebar).toBeVisible({ timeout: 5000 });

    await expect(sidebar).toHaveScreenshot("sidebar.png", {
      animations: "disabled",
    });
  });

  test("bottom-nav-mobile", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await setTheme(page, "maia");
    await navigateAndStabilize(page, "/home");

    const bottomNav = page.locator(".bottom-nav").first();
    await expect(bottomNav).toBeVisible({ timeout: 5000 });

    await expect(bottomNav).toHaveScreenshot("bottom-nav.png", {
      animations: "disabled",
    });
  });

  test("profile-header", async ({ page }) => {
    await setTheme(page, "maia");
    await navigateAndStabilize(page, `/u/${TEST_USER.handle}`);

    const profileHeader = page
      .locator(".profile-header, .profile-info")
      .first();
    await expect(profileHeader).toBeVisible({ timeout: 10000 });

    await expect(profileHeader).toHaveScreenshot("profile-header.png", {
      animations: "disabled",
      mask: [
        profileHeader.locator(".follower-count"),
        profileHeader.locator(".following-count"),
      ],
    });
  });
});

test.describe("Responsive Baselines", () => {
  const viewports = [
    { name: "mobile", width: 375, height: 667 },
    { name: "tablet", width: 768, height: 1024 },
    { name: "desktop", width: 1280, height: 800 },
    { name: "wide", width: 1920, height: 1080 },
  ];

  test.beforeEach(async ({ page }) => {
    await ensureLoggedIn(page);
  });

  for (const viewport of viewports) {
    test(`home-${viewport.name}`, async ({ page }) => {
      await page.setViewportSize({
        width: viewport.width,
        height: viewport.height,
      });
      await setTheme(page, "maia");
      await navigateAndStabilize(page, "/home");

      await expect(page).toHaveScreenshot(`home-${viewport.name}.png`, {
        fullPage: false,
        animations: "disabled",
        mask: [page.locator(".timestamp"), page.locator(".post-timestamp")],
      });
    });
  }
});
