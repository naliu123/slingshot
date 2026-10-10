const assert = require("node:assert/strict");

// Instrument only the game's response in the test browser. Do not modify files,
// physics, health, or scoring. Fail explicitly if the build format changes.
async function observeGame(page, fixture) {
  let observed = false;
  let fixtureApplied = false;
  await page.addInitScript(() => {
    const proto = CanvasRenderingContext2D.prototype;
    const ellipse = proto.ellipse, stroke = proto.stroke, transform = proto.setTransform;
    proto.ellipse = function (x, y, ...args) {
      this.__qaEllipse = { x, y };
      return ellipse.call(this, x, y, ...args);
    };
    proto.stroke = function (...args) {
      if (this.strokeStyle === "#7b9367" && this.__qaEllipse) window.__qaPreview.push(this.__qaEllipse);
      return stroke.apply(this, args);
    };
    proto.setTransform = function (...args) {
      window.__qaPreview = [];
      return transform.apply(this, args);
    };
  });
  await page.route("**/_next/static/chunks/*.js", async route => {
    const response = await route.fetch();
    let source = await response.text();
    const physics = /\{Engine:([\w$]+),Bodies:[\w$]+,Body:[\w$]+,Composite:[\w$]+,Events:[\w$]+\}=([\w$]+)\.default/;
    if (source.includes("A Canvas 2D context is required")) {
      assert.match(source, physics, "The test must observe the actual imported Matter.js engine.");
      source = source.replace(physics, match => match.replace(/=([\w$]+)\.default$/, "=(window.Matter=$1.default)"));
      const create = /([\w$]+)\.create\(\{enableSleeping:!1,positionIterations:8,velocityIterations:8\}\)/;
      assert.match(source, create, "The test must observe exactly the actual game engine.");
      source = source.replace(create, match => `(window.__qaEngine=${match})`);
      observed = true;
      if (fixture) {
        // Inject only the engine's default level after React hydration. The
        // server-rendered and client-rendered level selection must still match.
        const defaults = /levels:([\w$]+)=[\w$]+\.default/;
        assert.match(source, defaults, "The engine's default levels must be replaced by the fixture.");
        source = source.replace(defaults, (_, name) => `levels:${name}=${JSON.stringify([fixture])}`);
        fixtureApplied = true;
      }
    }
    await route.fulfill({ response, body: source });
  });
  return async () => {
    await page.locator('[data-game-ready="true"]').waitFor({ state: "attached" });
    assert.ok(observed, "No actual physics engine was observed.");
    if (fixture) assert.ok(fixtureApplied, "The pressure fixture did not load.");
    assert.equal(await page.evaluate(() => Boolean(window.__qaEngine)), true);
  };
}

async function readState(page) {
  return page.evaluate(() => ({
    state: document.querySelector("#game-stage").dataset.state,
    level: Number(document.querySelector("#game-stage").dataset.level),
    score: Number(document.querySelector("#score").textContent),
    birds: document.querySelector("#bird-slots").getAttribute("aria-label"),
    pigs: window.Matter.Composite.allBodies(window.__qaEngine.world)
      .filter(body => body.label === "pig")
      .map(body => ({ x: body.position.x, y: body.position.y, hp: body.game.hp })),
    blocks: window.Matter.Composite.allBodies(window.__qaEngine.world).filter(body => body.label === "block").length,
  }));
}

async function chooseLevel(page, index) {
  if (await page.locator("#levels-page").isHidden()) {
    await page.locator("#settings-open").click();
    await page.locator("#settings-levels").click();
  }
  await page.locator(".level-choice").nth(index).click();
  await page.locator("#game-page").waitFor({ state: "visible" });
}

async function dragBird(page, dx, dy, release = true) {
  const box = await page.locator("#bird-handle").boundingBox();
  const stage = await page.locator("#game-stage").boundingBox();
  const scale = Math.min(stage.width / 1440, stage.height / 630);
  const x = box.x + 30, y = box.y + 30;
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x + dx * scale, y + dy * scale, { steps: 12 });
  assert.equal(await page.locator("#game-stage").getAttribute("data-state"), "aiming");
  if (release) {
    await page.mouse.up();
    assert.equal(await page.locator("#game-stage").getAttribute("data-state"), "flying");
  }
}

function aimAt(target, high = true) {
  const candidates = [];
  for (let tenth = 60; tenth < 750; tenth++) {
    const angle = tenth / 10 * Math.PI / 180;
    const dx = -94 * Math.cos(angle), dy = 94 * Math.sin(angle);
    let x = 260 + dx, y = 405 + dy, vx = -dx * .205, vy = -dy * .205;
    for (let step = 0; step < 300; step++) {
      vx *= .99925;
      vy = vy * .99925 + 1.1 * .001 * (1000 / 60) ** 2 * .5;
      const nx = x + vx * .5, ny = y + vy * .5;
      if (nx >= target.x) {
        candidates.push({ error: Math.abs(y + (ny - y) * (target.x - x) / (nx - x) - target.y), tenth, dx, dy });
        break;
      }
      x = nx; y = ny;
    }
  }
  const accurate = candidates.filter(candidate => candidate.error < 3);
  const chosen = accurate.length
    ? accurate.sort((a, b) => high ? b.tenth - a.tenth : a.tenth - b.tenth)[0]
    : candidates.sort((a, b) => a.error - b.error)[0];
  return [chosen.dx, chosen.dy];
}

module.exports = { observeGame, readState, chooseLevel, dragBird, aimAt };
