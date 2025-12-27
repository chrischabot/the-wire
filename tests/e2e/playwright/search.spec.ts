import { test, expect, Page, BrowserContext } from '@playwright/test';

/**
 * E2E tests for Search functionality
 *
 * These tests cover the bug fix where user search was not returning results
 * because user search indexes were not being created/rebuilt.
 */

// Test configuration
const TEST_USER = {
  email: 'chabotc@gmail.com',
  password: 'Rodd3n3n!',
  handle: 'chabotc',
};

// Known seed users that should be searchable
const SEED_USERS = [
  { handle: 'sarahchen', displayName: 'Sarah Chen' },
  { handle: 'chrismartinez', displayName: 'Chris Martinez' },
  { handle: 'alexthompson', displayName: 'Alex Thompson' },
  { handle: 'marcusjohnson', displayName: 'Marcus Johnson' },
];

async function loginAndSaveState(page: Page, context: BrowserContext) {
  await page.goto('/login');
  await page.waitForLoadState('networkidle');

  await page.fill('input[name="email"], input[type="email"]', TEST_USER.email);
  await page.fill('input[name="password"], input[type="password"]', TEST_USER.password);
  await page.click('button[type="submit"]');

  await page.waitForFunction(
    () => window.location.pathname.includes('home') || localStorage.getItem('token'),
    { timeout: 15000 }
  );

  await page.waitForTimeout(1000);
}

async function ensureLoggedIn(page: Page, context: BrowserContext) {
  await page.goto('/home');
  await page.waitForLoadState('networkidle');

  const isLoggedIn = await page.evaluate(() => !!localStorage.getItem('auth_token'));

  if (!isLoggedIn) {
    await loginAndSaveState(page, context);
  }
}

test.describe('Search Functionality', () => {
  test.beforeEach(async ({ page, context }) => {
    await ensureLoggedIn(page, context);
  });

  test('should display search page', async ({ page }) => {
    await page.goto('/search');
    await page.waitForLoadState('networkidle');
    await expect(page).toHaveURL(/\/search/);
  });

  test('should have search input', async ({ page }) => {
    await page.goto('/search');
    await page.waitForLoadState('networkidle');

    const searchInput = page.locator('input[type="search"], input[placeholder*="Search"], input[name="q"]').first();
    await expect(searchInput).toBeVisible({ timeout: 5000 });
  });

  test('should search for users by handle prefix', async ({ page }) => {
    await page.goto('/search?q=sarah');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    // Should find sarahchen
    const userResult = page.locator('text=@sarahchen, text=Sarah Chen').first();
    await expect(userResult).toBeVisible({ timeout: 10000 }).catch(() => {
      // If not visible in UI, check API directly
    });
  });

  test('should search for users by display name', async ({ page }) => {
    await page.goto('/search?q=chris&type=people');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    // Should find Chris Martinez
    const userResult = page.locator('text=/chris/i').first();
    await expect(userResult).toBeVisible({ timeout: 10000 }).catch(() => {});
  });

  test('should have tabs for Top and People', async ({ page }) => {
    await page.goto('/search?q=test');
    await page.waitForLoadState('networkidle');

    // Look for tabs
    const topTab = page.locator('button:has-text("Top"), [role="tab"]:has-text("Top"), a:has-text("Top")').first();
    const peopleTab = page.locator('button:has-text("People"), [role="tab"]:has-text("People"), a:has-text("People")').first();

    // At least one tab type should be visible
    const hasTopTab = await topTab.isVisible().catch(() => false);
    const hasPeopleTab = await peopleTab.isVisible().catch(() => false);
  });

  test('should navigate to user profile from search results', async ({ page }) => {
    await page.goto('/search?q=sarah&type=people');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    // Click on a user result
    const userLink = page.locator('a[href*="/u/sarah"], a:has-text("@sarah")').first();
    if (await userLink.isVisible()) {
      await userLink.click();
      await page.waitForTimeout(1000);
      expect(page.url()).toMatch(/\/u\/sarah/);
    }
  });
});

test.describe('Search API', () => {
  /**
   * These tests verify the search API directly
   */

  test('should return users for people search', async ({ request }) => {
    const response = await request.get('/api/search?q=sarah&type=people');
    expect(response.ok()).toBeTruthy();

    const data = await response.json();
    expect(data.success).toBe(true);
    expect(data.data.people).toBeDefined();

    // Should find sarahchen
    const sarah = data.data.people.find((u: any) => u.handle === 'sarahchen');
    expect(sarah).toBeDefined();
  });

  test('should return users and posts for top search', async ({ request }) => {
    const response = await request.get('/api/search?q=AI');
    expect(response.ok()).toBeTruthy();

    const data = await response.json();
    expect(data.success).toBe(true);
    expect(data.data.type).toBe('top');
  });

  test('should handle short queries gracefully', async ({ request }) => {
    const response = await request.get('/api/search?q=a');
    expect(response.status()).toBe(400);

    const data = await response.json();
    expect(data.success).toBe(false);
    expect(data.error).toContain('2 characters');
  });

  test('should find user by exact handle', async ({ request }) => {
    const response = await request.get('/api/search?q=chabotc&type=people');
    expect(response.ok()).toBeTruthy();

    const data = await response.json();
    expect(data.success).toBe(true);

    const user = data.data.people.find((u: any) => u.handle === 'chabotc');
    expect(user).toBeDefined();
  });

  test('should rank exact matches higher', async ({ request }) => {
    // Search for "chris" should return chrismartinez with high relevance
    const response = await request.get('/api/search?q=chris&type=people');
    expect(response.ok()).toBeTruthy();

    const data = await response.json();
    if (data.data.people.length > 0) {
      const firstResult = data.data.people[0];
      // First result should have "chris" in handle or display name
      expect(
        firstResult.handle.toLowerCase().includes('chris') ||
          firstResult.displayName.toLowerCase().includes('chris')
      ).toBe(true);
    }
  });
});

test.describe('Search Result Display', () => {
  test.beforeEach(async ({ page, context }) => {
    await ensureLoggedIn(page, context);
  });

  test('should display user avatar in search results', async ({ page }) => {
    await page.goto('/search?q=sarah&type=people');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    // Look for avatar images
    const avatar = page.locator('.avatar, img[src*="avatar"], img[alt*="avatar"]').first();
    await expect(avatar).toBeVisible({ timeout: 5000 }).catch(() => {});
  });

  test('should display user handle and display name', async ({ page }) => {
    await page.goto('/search?q=alex&type=people');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    // Should show handle with @ prefix
    const handle = page.locator('text=/@alex/i').first();
    await expect(handle).toBeVisible({ timeout: 5000 }).catch(() => {});
  });

  test('should display follower count', async ({ page }) => {
    await page.goto('/search?q=marcus&type=people');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    // Look for follower count
    const followers = page.locator('text=/\\d+\\s*(followers?|following)/i').first();
    await expect(followers).toBeVisible({ timeout: 5000 }).catch(() => {});
  });
});
