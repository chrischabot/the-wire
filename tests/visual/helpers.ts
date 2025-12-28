import { Page } from "@playwright/test";

export const TEST_USER = {
  email: "chabotc@gmail.com",
  password: "Rodd3n3n!",
  handle: "chabotc",
};

export const THEMES = [
  "twitter",
  "vega",
  "nova",
  "maia",
  "lyra",
  "mira",
] as const;
export type Theme = (typeof THEMES)[number];

export const PAGES = [
  { name: "landing", path: "/", auth: false },
  { name: "login", path: "/login", auth: false },
  { name: "signup", path: "/signup", auth: false },
  { name: "home", path: "/home", auth: true },
  { name: "explore", path: "/explore", auth: true },
  { name: "notifications", path: "/notifications", auth: true },
  { name: "profile", path: `/u/${TEST_USER.handle}`, auth: true },
  { name: "settings", path: "/settings", auth: true },
  { name: "search", path: "/search?q=test", auth: true },
] as const;

export async function login(page: Page): Promise<void> {
  await page.goto("/login");

  const alreadyLoggedIn = await page.evaluate(
    () => !!localStorage.getItem("token"),
  );
  if (alreadyLoggedIn) {
    await page.goto("/home");
    return;
  }

  await page.waitForSelector('input[type="email"], input[name="email"]', {
    state: "visible",
    timeout: 5000,
  });

  await page.fill('input[name="email"], input[type="email"]', TEST_USER.email);
  await page.fill(
    'input[name="password"], input[type="password"]',
    TEST_USER.password,
  );
  await page.click('button[type="submit"]');

  await page.waitForURL(/\/(home|feed)/, { timeout: 15000 }).catch(async () => {
    await page.waitForFunction(() => !!localStorage.getItem("token"), {
      timeout: 10000,
    });
  });

  await page.waitForTimeout(300);
}

export async function isLoggedIn(page: Page): Promise<boolean> {
  try {
    return await page.evaluate(() => !!localStorage.getItem("token"));
  } catch {
    return false;
  }
}

export async function ensureLoggedIn(page: Page): Promise<void> {
  await page.goto("/home");
  const loggedIn = await isLoggedIn(page);
  if (loggedIn) return;
  await login(page);
}

export async function setTheme(page: Page, theme: Theme): Promise<void> {
  await page.addInitScript((t) => {
    localStorage.setItem("the_wire_theme", t);
    document.documentElement.dataset.theme = t;
  }, theme);
}

export async function waitForPageStable(page: Page): Promise<void> {
  await page
    .waitForLoadState("networkidle", { timeout: 10000 })
    .catch(() => {});

  await page.evaluate(() => {
    return Promise.all(
      Array.from(document.images)
        .filter((img) => !img.complete)
        .map(
          (img) =>
            new Promise((resolve) => {
              img.onload = img.onerror = resolve;
            }),
        ),
    );
  });

  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(200);
}

export async function navigateAndStabilize(
  page: Page,
  path: string,
): Promise<void> {
  await page.goto(path);
  await waitForPageStable(page);
}
