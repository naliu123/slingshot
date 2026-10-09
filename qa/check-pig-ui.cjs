/* Optional browser integration: NODE_PATH=.qa-node/node_modules node qa/check-pig-ui.cjs
   Install the test dependency with:
   npm install --prefix .qa-node --no-save --no-package-lock playwright
   Uses installed Chrome, or the executable specified by CHROME_PATH. */
const { chromium } = require("playwright");
const assert = require("node:assert/strict");
const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const root = path.resolve(__dirname, "..");
const sandbox = {};
vm.runInNewContext(fs.readFileSync(path.join(root, "levels.js"), "utf8") +
  "\nthis.levels = SLINGSHOT_LEVELS;", sandbox);
// A test-only level served over HTTP. The game receives normal level data;
// no health, score, callbacks, or physics state are changed by the test.
const fixture = {
  ...sandbox.levels[0], name: "Pressure test", birds: 1, stars: [1000, 1500],
  blocks: [[1100, 455, 120, 40, "stone"]],
  pigs: [[1100, 497, 22]]
};
const server = http.createServer((request, response) => {
  const pathname = new URL(request.url, "http://localhost").pathname;
  const name = pathname.replace(/^\/(pressure|safe)\//, "/").replace(/^\//, "") || "index.html";
  if (pathname === "/pressure/levels.js" || pathname === "/safe/levels.js") {
    const layout = pathname.startsWith("/safe/") ? { ...fixture, blocks: [[1100, 474, 10, 2]] } : fixture;
    response.setHeader("Content-Type", "text/javascript");
    response.end(`const SLINGSHOT_LEVELS = ${JSON.stringify([layout])};`);
    return;
  }
  if (!["index.html", "styles.css", "game.js", "pig-damage.js", "levels.js", "vendor/matter.min.js"].includes(name)) {
    response.writeHead(404); response.end(); return;
  }
  response.setHeader("Content-Type", name.endsWith(".js") ? "text/javascript" : name.endsWith(".css") ? "text/css" : "text/html");
  response.end(fs.readFileSync(path.join(root, name)));
});
const observer = () => {
  let matter;
  Object.defineProperty(window, "Matter", {
    get() { return matter; },
    set(value) {
      matter = value;
      const create = value.Engine.create;
      value.Engine.create = function (...args) {
        const engine = create.apply(this, args);
        window.__qaEngine = engine;
        return engine;
      };
    }
  });
};

(async () => {
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  let browser;
  try {
    browser = await chromium.launch({
      executablePath: process.env.CHROME_PATH || "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
      headless: true, args: ["--disable-gpu", "--disable-accelerated-2d-canvas"]
    });
    const page = await browser.newPage({ viewport: { width: 1440, height: 1200 }, reducedMotion: "reduce" });
    const errors = [];
    page.on("pageerror", error => errors.push(String(error)));
    await page.addInitScript(observer);
    await page.clock.install();
    const url = `http://127.0.0.1:${server.address().port}`;
    await page.goto(url);
    for (let i = 0; i < 5; i++) {
      await page.locator(".level-choice").nth(i).click();
      await page.clock.runFor(1000);
      const hp = await page.evaluate(() => Matter.Composite.allBodies(__qaEngine.world)
        .filter(body => body.game?.type === "pig").map(body => body.game.hp));
      assert.ok(hp.every(value => value === 24));
      assert.equal(await page.locator("#score").textContent(), "00000");
    }
    console.log("PASS: all five real levels load at full health.");

    await page.goto(`${url}/pressure/`);
    await page.clock.runFor(1000);
    assert.equal(await page.locator("#score").textContent(), "00000");
    await page.locator("#bird-handle").focus();
    for (let i = 0; i < 22; i++) await page.keyboard.press("ArrowLeft");
    await page.keyboard.press("Space");
    assert.equal(await page.locator("#game-stage").getAttribute("data-state"), "flying");
    await page.clock.runFor(350);
    const hurt = await page.evaluate(() => Matter.Composite.allBodies(__qaEngine.world)
      .filter(body => body.game?.type === "pig")
      .map(body => ({ hp: body.game.hp, pressure: body.game.pressure, kind: body.game.damageKind })));
    assert.equal(hurt.length, 1);
    assert.ok(hurt[0].hp > 0 && hurt[0].hp < 24);
    assert.ok(hurt[0].pressure > .15);
    assert.equal(hurt[0].kind, "crush");
    await page.screenshot({ path: path.join(__dirname, "artifacts/pig-pressure.png") });
    await page.clock.runFor(4000);
    assert.equal(await page.locator("#game-stage").getAttribute("data-state"), "won");
    assert.equal(await page.locator("#score").textContent(), "01000");
    await page.clock.runFor(3000);
    assert.equal(await page.locator("#score").textContent(), "01000", "A dead pig must score only once.");
    await page.locator("#play-again").click();
    await page.clock.runFor(1000);
    assert.equal(await page.locator("#score").textContent(), "00000");
    const reset = await page.evaluate(() => Matter.Composite.allBodies(__qaEngine.world)
      .find(body => body.game?.type === "pig").game);
    assert.equal(reset.hp, 24);
    assert.equal(reset.pressureTime, 0);
    assert.equal(reset.damageKind, null);
    await page.goto(`${url}/safe/`);
    await page.clock.runFor(1000);
    await page.locator("#bird-handle").focus();
    for (let i = 0; i < 22; i++) await page.keyboard.press("ArrowLeft");
    await page.keyboard.press("Space");
    // Allow the full 10-second shot timeout plus the settling period.
    await page.clock.runFor(14000);
    assert.equal(await page.locator("#game-stage").getAttribute("data-state"), "lost");
    assert.equal(await page.locator("#score").textContent(), "00000");
    assert.equal(await page.evaluate(() => Matter.Composite.allBodies(__qaEngine.world)
      .find(body => body.game?.type === "pig").game.hp), 24);
    assert.deepEqual(errors, []);
    console.log("PASS: launch enables crushing; visible pressure and health loss; last bird wins; exactly 1,000 points; replay clears pressure; light contact stays harmless and permits normal defeat; no JS errors.");
  } finally {
    if (browser) await browser.close();
    await new Promise(resolve => server.close(resolve));
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
