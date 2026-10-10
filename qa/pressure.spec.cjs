const { test, expect } = require("@playwright/test");
const { observeGame, readState } = require("./browser-helpers.cjs");
const levels = require("../src/lib/game/levels.js");

for (const crushing of [true, false]) {
  test(crushing ? "settled rubble crushes a pig, wins once, and replay clears pressure" : "light debris permits an undamaged pig and normal defeat", async ({ page }) => {
    const errors = [];
    page.on("pageerror", error => errors.push(String(error)));
    const fixture = {
      ...levels[0], name: "Pressure test", birds: 1, stars: [1000, 1500],
      blocks: crushing ? [[1100, 455, 120, 40, "stone"]] : [[1100, 474, 10, 2]],
      pigs: [[1100, 497, 22]],
    };
    const observed = await observeGame(page, fixture);
    await page.goto("/");
    await observed();
    await page.clock.install();
    await page.locator(".level-choice").first().click();
    await page.clock.runFor(1000);
    expect((await readState(page)).score).toBe(0);
    await page.locator("#bird-handle").focus();
    for (let i = 0; i < 22; i++) await page.keyboard.press("ArrowLeft");
    await page.keyboard.press("Space");
    await expect(page.locator("#game-stage")).toHaveAttribute("data-state", "flying");
    await page.clock.runFor(350);
    if (crushing) {
      const hurt = await page.evaluate(() => Matter.Composite.allBodies(__qaEngine.world).find(body => body.label === "pig").game);
      expect(hurt.hp).toBeGreaterThan(0);
      expect(hurt.hp).toBeLessThan(24);
      expect(hurt.pressure).toBeGreaterThan(.15);
      expect(hurt.damageKind).toBe("crush");
      await page.clock.runFor(4000);
      await expect(page.locator("#game-stage")).toHaveAttribute("data-state", "won");
      await expect(page.locator("#score")).toHaveText("01000");
      await page.clock.runFor(3000);
      await expect(page.locator("#score")).toHaveText("01000");
      await page.locator("#play-again").click();
      await page.clock.runFor(1000);
      const reset = await page.evaluate(() => Matter.Composite.allBodies(__qaEngine.world).find(body => body.label === "pig").game);
      expect(reset.hp).toBe(24);
      expect(reset.pressureTime).toBe(0);
      expect(reset.damageKind).toBeNull();
    } else {
      await page.clock.runFor(14_000);
      await expect(page.locator("#game-stage")).toHaveAttribute("data-state", "lost");
      expect((await readState(page)).pigs[0].hp).toBe(24);
    }
    expect(errors).toEqual([]);
  });
}
