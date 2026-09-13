import { expect, test, type Page } from "@playwright/test";

async function ready(page: Page, query = "") {
  await page.goto(`/${query}`);
  await expect(page.getByRole("heading", { name: "HILLBOUND BIKE" })).toBeVisible();
}

test("G02 menu exposes exactly two playable levels", async ({ page }) => {
  await ready(page);
  await expect(page.getByRole("button", { name: /Green Hills/ })).toBeVisible();
  await expect(page.getByRole("button", { name: /Moon Run/ })).toBeVisible();
  await expect(page.locator(".card")).toHaveCount(2);
  await page.getByRole("button", { name: /Moon Run/ }).click();
  await page.getByRole("button", { name: "PLAY" }).click();
  await expect(page.locator('[data-hud="level"]')).toHaveText("Moon Run");
});

test("G28 pause does not advance the simulation", async ({ page }) => {
  await ready(page, "?testMode=1&manual=1");
  const api = await page.evaluateHandle(() => window.__HILLBOUND_TEST_API__);
  await page.evaluate((testApi) => testApi?.startRun("green-hills"), api);
  await page.evaluate((testApi) => testApi?.stepTicks(20), api);
  const before = await page.evaluate((testApi) => testApi?.getSnapshot(), api);
  await page.keyboard.press("Escape");
  await page.waitForTimeout(1100);
  const paused = await page.evaluate((testApi) => testApi?.getSnapshot(), api);
  expect(paused?.tick).toBe(before?.tick);
  expect(paused?.fuel).toBe(before?.fuel);
  expect(paused?.score).toBe(before?.score);
  await page.getByRole("button", { name: "Resume" }).click();
  await page.evaluate((testApi) => testApi?.stepTicks(5), api);
  const after = await page.evaluate((testApi) => testApi?.getSnapshot(), api);
  expect(after?.tick).toBe((before?.tick ?? 0) + 5);
});

test("G29 releasing a pedal zeroes input", async ({ page }) => {
  await ready(page, "?testMode=1&manual=1");
  await page.evaluate(() => window.__HILLBOUND_TEST_API__?.startRun("green-hills"));
  const pedal = page.locator('.pedal[data-action="throttle"]');
  const box = await pedal.boundingBox();
  expect(box).toBeTruthy();
  await page.mouse.move(box!.x + box!.width / 2, box!.y + box!.height / 2);
  await page.mouse.down();
  await expect(pedal).toHaveClass(/pressed/);
  await page.evaluate(() => {
    document.querySelector(".pedal[data-action=throttle]")?.dispatchEvent(new Event("pointercancel", { bubbles: true }));
  });
  const afterCancel = await page.evaluate(() => window.__HILLBOUND_TEST_API__?.getSnapshot());
  expect(afterCancel).toBeTruthy();
  await page.evaluate(() => window.dispatchEvent(new Event("blur")));
  await page.evaluate(() => Object.defineProperty(document, "hidden", { configurable: true, get: () => true }));
  await page.evaluate(() => document.dispatchEvent(new Event("visibilitychange")));
});

test("G32 required UI fits desktop and mobile viewports", async ({ page }) => {
  for (const viewport of [
    { width: 1280, height: 720 },
    { width: 390, height: 844 },
  ]) {
    await page.setViewportSize(viewport);
    await ready(page);
    await expect(page.getByRole("button", { name: "PLAY" })).toBeVisible();
    await page.getByRole("button", { name: "PLAY" }).click();
    await expect(page.locator('[data-hud="fuel"]')).toBeVisible();
    await expect(page.locator('[data-hud="distance"]')).toBeVisible();
    await expect(page.locator('[data-hud="score"]')).toBeVisible();
    await expect(page.locator('[data-action="pause"]')).toBeVisible();
    await expect(page.locator('.pedal[data-action="throttle"]')).toBeVisible();
    await expect(page.locator('.pedal[data-action="brake"]')).toBeVisible();
    const scrolled = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 2);
    expect(scrolled).toBe(false);
    await page.locator('[data-action="pause"]').click();
    await page.getByRole("button", { name: "Return to Menu" }).click();
  }
});

test("G35 persistence survives reload and corrupt storage", async ({ page }) => {
  await ready(page, "?testMode=1&manual=1");
  await page.evaluate(() => {
    const api = window.__HILLBOUND_TEST_API__;
    api?.startRun("green-hills");
    api?.setBikePose({ distanceM: 40 });
    api?.triggerPickup(api.getPickupManifest("green-hills").find((item) => item.coinType === "gold")!.id);
    api?.stepTicks(1);
  });
  await page.evaluate(() => {
    const worldTick = window.__HILLBOUND_TEST_API__;
    worldTick?.setBikePose({ distanceM: 1499.4, vx: 12 });
    worldTick?.stepTicks(30);
  });
  await expect(page.locator('[data-panel="results"]')).toBeVisible({ timeout: 10_000 });
  await page.reload();
  await expect(page.getByRole("button", { name: /Green Hills/ })).toContainText(/Best [1-9]/);
  await page.evaluate(() => localStorage.setItem("hillbound-bike:v1", "{bad"));
  await page.reload();
  await expect(page.getByRole("heading", { name: "HILLBOUND BIKE" })).toBeVisible();
  await expect(page.getByRole("button", { name: /Green Hills/ })).toContainText("Best 0 m / 0");
});

test("G33 does not make unauthorized network requests", async ({ page }) => {
  const external: string[] = [];
  page.on("request", (request) => {
    const url = new URL(request.url());
    if (url.origin !== "http://127.0.0.1:4173") external.push(request.url());
  });
  await ready(page, "?testMode=1&manual=1");
  await page.evaluate(() => {
    window.__HILLBOUND_TEST_API__?.startRun("green-hills");
    window.__HILLBOUND_TEST_API__?.stepTicks(300);
  });
  expect(external).toEqual([]);
});

test("G24 head crash reaches results", async ({ page }) => {
  await ready(page, "?testMode=1&manual=1");
  const reason = await page.evaluate(() => {
    const api = window.__HILLBOUND_TEST_API__;
    if (!api) throw new Error("missing test api");
    api.startRun("green-hills");
    api.setBikePose({ distanceM: 28, angle: Math.PI });
    for (let i = 0; i < 240; i += 1) {
      api.stepTicks(1);
      const snap = api.getSnapshot();
      if (snap.runState === "RESULTS") return snap.resultReason;
    }
    return api.getSnapshot().resultReason;
  });
  expect(reason).toBe("head_crash");
  await expect(page.locator('[data-panel="results"]')).toBeVisible();
});

test("standard smoke run has no page errors", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await ready(page, "?testMode=1&manual=1");
  await page.evaluate(() => {
    window.__HILLBOUND_TEST_API__?.startRun("green-hills");
    window.__HILLBOUND_TEST_API__?.setInput({ throttle: 1, brake: 0 });
    window.__HILLBOUND_TEST_API__?.stepTicks(300);
  });
  expect(errors).toEqual([]);
});
