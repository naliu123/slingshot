const { test, expect } = require("@playwright/test");
const { observeGame, readState, chooseLevel, dragBird, aimAt } = require("./browser-helpers.cjs");
const levels = require("../src/lib/game/levels.js");
const path = require("node:path");
const os = require("node:os");
const fs = require("node:fs");
const artifacts = process.env.QA_ARTIFACTS || path.join(os.tmpdir(), "slingshot-qa-artifacts");
fs.mkdirSync(artifacts, { recursive: true });

test("five levels, pause/resume, input, reset, responsive layout, and saved scores", async ({ page }) => {
  const errors = [];
  const external = [];
  page.on("pageerror", error => errors.push(String(error)));
  page.on("request", request => {
    if (new URL(request.url()).origin !== new URL(page.url() === "about:blank" ? "http://127.0.0.1:3000" : page.url()).origin) external.push(request.url());
  });
  const observed = await observeGame(page);
  await page.goto("/");
  await observed();
  await expect(page.locator(".level-choice")).toHaveCount(5);
  for (let index = 0; index < 5; index++) {
    await chooseLevel(page, index);
    const initial = await readState(page);
    expect(initial.level).toBe(index + 1);
    expect(initial.score).toBe(0);
    expect(initial.birds).toBe(`${levels[index].birds} birds remaining`);
    expect(initial.pigs).toHaveLength(levels[index].pigs.length);
    expect(initial.pigs.every(pig => pig.hp === 24)).toBe(true);
  }
  await chooseLevel(page, 0);
  await dragBird(page, -84, 42, false);
  await expect(page.locator("#power-readout")).toBeVisible();
  await page.waitForFunction(() => window.__qaPreview?.length > 5);
  const preview = await page.evaluate(() => window.__qaPreview);
  expect(preview.length).toBeLessThanOrEqual(10);
  expect(Math.max(...preview.map(point => point.x))).toBeLessThan(500);
  await page.keyboard.press("Escape");
  await page.mouse.up();
  await page.waitForFunction(() => window.__qaPreview.length === 0);
  expect((await readState(page)).birds).toBe("4 birds remaining");
  await page.locator("#bird-handle").focus();
  await page.keyboard.press("ArrowUp");
  await expect(page.locator("#game-stage")).toHaveAttribute("data-state", "aiming");
  await page.waitForFunction(() => window.__qaPreview.length > 5);
  expect(await page.evaluate(() => window.__qaPreview)).not.toEqual(preview);
  await page.keyboard.press("Escape");

  await page.locator("#how-to-open").click();
  await expect(page.locator("#help-dialog")).toHaveAttribute("role", "dialog");
  await page.keyboard.press("Escape");
  await expect(page.locator("#help-dialog")).toBeHidden();
  await page.locator("#sound-toggle").click();
  await expect(page.locator("#sound-toggle")).toHaveAttribute("aria-pressed", "true");
  await page.keyboard.press("m");
  await expect(page.locator("#sound-toggle")).toHaveAttribute("aria-pressed", "false");

  await dragBird(page, -84, 42);
  await expect(page.locator("#bird-slots")).toHaveAttribute("aria-label", "3 birds remaining");
  const finite = await page.evaluate(() => Matter.Composite.allBodies(__qaEngine.world)
    .filter(body => body.label === "bird" && !body.isStatic).every(body => Number.isFinite(body.inertia) && body.inertia > 0));
  expect(finite).toBe(true);
  await page.locator("#settings-open").click();
  const positions = await page.evaluate(() => Matter.Composite.allBodies(__qaEngine.world).map(body => ({ x: body.position.x, y: body.position.y })));
  // Time must pass to verify that a dialog pauses an active shot.
  await page.waitForTimeout(250);
  expect(await page.evaluate(() => Matter.Composite.allBodies(__qaEngine.world).map(body => ({ x: body.position.x, y: body.position.y })))).toEqual(positions);
  await page.locator("#settings-help").click();
  await expect(page.locator("#settings-dialog")).toBeHidden();
  await expect(page.locator("#help-dialog")).toBeVisible();
  await page.locator("#lets-play").click();
  await page.waitForFunction(() => Number(document.querySelector("#score").textContent) > 0);
  const best = Number((await page.locator("#best-score").innerText()).replaceAll(",", ""));
  await page.locator("#settings-open").click();
  await page.locator("#settings-levels").click();
  await expect(page.locator("#levels-page")).toBeVisible();
  await page.locator("#resume-game").click();
  await expect(page.locator("#game-page")).toBeVisible();
  expect((await readState(page)).birds).toBe("3 birds remaining");
  await page.locator("#reset-button").click();
  expect((await readState(page)).score).toBe(0);
  expect((await readState(page)).birds).toBe("4 birds remaining");
  await expect(page.locator("#bird-handle")).toBeFocused();
  await page.reload();
  await observed();
  await expect(page.locator("#game-page")).toBeVisible();
  expect(Number((await page.locator("#best-score").innerText()).replaceAll(",", ""))).toBeGreaterThanOrEqual(best);

  await page.goto("/#play/keep");
  await observed();
  await expect(page.locator("#game-stage")).toHaveAttribute("data-level", "5");
  for (const [width, height] of [[390, 844], [768, 1024], [1920, 1080]]) {
    await page.setViewportSize({ width, height });
    await expect(page.locator("#reset-button")).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await expect.poll(() => page.locator("#game-stage").boundingBox()).toEqual({ x: 0, y: 0, width, height });
    await page.screenshot({ path: path.join(artifacts, `nextjs-${width}.png`) });
  }
  await page.locator("#settings-open").click();
  await page.locator("#settings-levels").click();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: path.join(artifacts, "nextjs-levels.png"), fullPage: true });
  expect(errors).toEqual([]);
  expect(external).toEqual([]);
});

test("all five levels can be cleared with real drag inputs and next-level transitions", async ({ page }) => {
  const errors = [];
  page.on("pageerror", error => errors.push(String(error)));
  const observed = await observeGame(page);
  await page.goto("/");
  await observed();
  await page.clock.install();
  await chooseLevel(page, 0);
  const supports = [{ x: 1028, y: 453 }, { x: 884, y: 471 }, { x: 895, y: 451 }, { x: 1038, y: 474 }];
  for (let index = 0; index < 5; index++) {
    for (let shot = 0; shot < levels[index].birds; shot++) {
      const current = await readState(page);
      if (current.state === "won") break;
      expect(current.state).toBe("ready");
      const target = shot === 0 ? (index === 4 ? { x: 1090, y: 254 } : supports[index]) : current.pigs.sort((a, b) => a.x - b.x)[0];
      const [dx, dy] = aimAt(target, shot > 0 || index === 4);
      await dragBird(page, dx, dy);
      await page.clock.runFor(13_000);
    }
    const result = await readState(page);
    expect(result.state, `Level ${index + 1}`).toBe("won");
    await expect(page.locator("#next-level")).toBeVisible();
    await expect(page.locator(".level-choice").nth(index)).toHaveClass(/cleared/);
    await page.locator("#next-level").click();
    await page.clock.runFor(50);
    expect((await readState(page)).level).toBe((index + 1) % 5 + 1);
  }
  await expect(page.locator("#campaign-progress")).toContainText("5 / 5 cleared");
  expect(errors).toEqual([]);
});

test("native touch cancellation and launch preserve input behavior", async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", error => errors.push(String(error)));
  await page.goto(process.env.QA_BASE_URL ?? "http://127.0.0.1:3000");
  await page.locator('[data-game-ready="true"]').waitFor({ state: "attached" });
  await chooseLevel(page, 0);
  const cdp = await context.newCDPSession(page);
  const box = await page.locator("#bird-handle").boundingBox();
  const x = box.x + 30, y = box.y + 30;
  for (const cancelled of [true, false]) {
    await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x, y }] });
    await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x: x - 21, y: y + 10 }] });
    await expect(page.locator("#game-stage")).toHaveAttribute("data-state", "aiming");
    await cdp.send("Input.dispatchTouchEvent", { type: cancelled ? "touchCancel" : "touchEnd", touchPoints: [] });
    await expect(page.locator("#game-stage")).toHaveAttribute("data-state", cancelled ? "ready" : "flying");
    await expect(page.locator("#bird-slots")).toHaveAttribute("aria-label", cancelled ? "4 birds remaining" : "3 birds remaining");
  }
  expect(errors).toEqual([]);
  await context.close();
});

test("four missed shots reach loss and replay restores the level", async ({ page }) => {
  await page.goto("/#play/greenwood");
  await page.locator('[data-game-ready="true"]').waitFor({ state: "attached" });
  await page.clock.install();
  for (let index = 0; index < 4; index++) {
    await dragBird(page, -20, 8);
    await page.clock.runFor(14_000);
  }
  await expect(page.locator("#game-stage")).toHaveAttribute("data-state", "lost");
  await expect(page.locator("#play-again")).toBeVisible();
  await page.locator("#play-again").click();
  await expect(page.locator("#game-stage")).toHaveAttribute("data-state", "ready");
  await expect(page.locator("#score")).toHaveText("00000");
  await expect(page.locator("#bird-slots")).toHaveAttribute("aria-label", "4 birds remaining");
});
