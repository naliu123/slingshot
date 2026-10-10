/* Real Matter.js simulations. Run: node --test qa/pig-damage.test.cjs */
const test = require("node:test");
const assert = require("node:assert/strict");
const Matter = require("matter-js");
const PigDamage = require("../src/lib/game/pig-damage.js");
const { Engine, Bodies, Body, Composite, Events } = Matter;

function scene(step = 1000 / 120) {
  const engine = Engine.create({ positionIterations: 8, velocityIterations: 8 });
  engine.gravity.y = 1.1;
  let enabled = false;
  const hits = [], deaths = [];
  const controller = PigDamage.attach(Matter, engine, {
    enabled: () => enabled,
    onDamage(pig, amount, kind) {
      assert.ok(Number.isFinite(amount) && amount > 0);
      if (pig.game.destroyed) assert.fail("A dead pig took damage again.");
      pig.game.hp = Math.max(0, pig.game.hp - amount);
      hits.push({ pig, amount, kind, at: engine.timing.timestamp / 1000 });
      if (pig.game.hp === 0) {
        pig.game.destroyed = true;
        deaths.push({ pig, kind, at: engine.timing.timestamp / 1000 });
        Composite.remove(engine.world, pig);
      }
    }
  });
  function add(body, game) {
    body.game = game;
    Composite.add(engine.world, body);
    return body;
  }
  const ground = add(Bodies.rectangle(0, 540, 3000, 80, { isStatic: true }), { type: "ground" });
  function pig(x = 0, y = 480, radius = 20) {
    return add(Bodies.circle(x, y, radius, { density: .0027, friction: .75, restitution: .06, frictionAir: .008 }),
      { type: "pig", radius, hp: 24, maxHp: 24, destroyed: false });
  }
  function block(x, y, w, h, material = "wood", options = {}) {
    return add(Bodies.rectangle(x, y, w, h, {
      density: material === "stone" ? .0032 : .0018,
      friction: .65, frictionStatic: .9, frictionAir: .006, restitution: .05, ...options
    }), { type: "block", material, destroyed: false });
  }
  function advance(seconds) {
    for (let i = 0; i < Math.round(seconds * 1000 / step); i++) Engine.update(engine, step);
  }
  return { engine, ground, pig, block, advance, hits, deaths, controller,
    enable(value = true) { enabled = value; } };
}

test("standing on ground and resting against a wall are harmless", () => {
  const s = scene(), pig = s.pig();
  s.block(-30, 470, 20, 60, "stone", { isStatic: true });
  s.advance(.8); s.enable(); s.advance(8);
  assert.equal(pig.game.hp, 24);
  assert.equal(s.hits.length, 0);
  assert.equal(s.controller.hasActivePressure(), false);
});

test("a heavy settled beam crushes a pig without any new impact", () => {
  const s = scene(), pig = s.pig();
  s.block(0, 450, 120, 20, "stone");
  s.advance(1); s.enable(); s.advance(3);
  assert.equal(pig.game.destroyed, true);
  assert.equal(s.deaths.length, 1);
  assert.equal(s.deaths[0].kind, "crush");
  assert.ok(s.hits.every(hit => hit.kind === "crush"));
  s.advance(3);
  assert.equal(s.deaths.length, 1, "Death and its score must only be emitted once.");
});

test("tiny debris resting on a pig does not crush it", () => {
  const s = scene(), pig = s.pig();
  s.block(0, 458, 20, 4);
  s.advance(1); s.enable(); s.advance(8);
  assert.equal(pig.game.hp, 24);
});

test("weight transfers through a pile of blocks onto a pig", () => {
  const s = scene(), pig = s.pig();
  s.block(0, 456, 70, 8);
  s.block(0, 442, 90, 20, "stone");
  s.block(0, 422, 80, 20, "stone");
  s.advance(1); s.enable(); s.advance(3);
  assert.equal(pig.game.destroyed, true);
  assert.equal(s.deaths[0].kind, "crush");
});

test("pressure grace prevents a momentary load from causing damage", () => {
  const s = scene(), pig = s.pig(), roof = s.block(0, 450, 120, 20, "stone");
  s.advance(1); s.enable(); s.advance(.1);
  roof.game.destroyed = true; Composite.remove(s.engine.world, roof);
  s.advance(2);
  assert.equal(pig.game.hp, 24);
  assert.equal(pig.game.pressureTime, 0);
});

test("removing a heavy beam stops pressure damage immediately", () => {
  const s = scene(), pig = s.pig(), roof = s.block(0, 450, 120, 20, "stone");
  s.advance(1); s.enable(); s.advance(.35);
  assert.ok(pig.game.hp < 24 && pig.game.hp > 0);
  const hp = pig.game.hp;
  roof.game.destroyed = true; Composite.remove(s.engine.world, roof);
  s.advance(3);
  assert.equal(pig.game.hp, hp);
  assert.equal(s.controller.hasActivePressure(), false);
  assert.ok(pig.game.pressure < .01);
});

test("opposing lateral forces squeeze a pig against a wall", () => {
  const s = scene(), pig = s.pig();
  s.block(-30, 465, 20, 70, "stone", { isStatic: true });
  const pusher = s.block(30, 470, 20, 60, "stone");
  Body.setInertia(pusher, Infinity); // A guided horizontal plate, not a falling beam.
  s.advance(.8); s.enable();
  Events.on(s.engine, "beforeUpdate", () => Body.applyForce(pusher, pusher.position, { x: -.02, y: 0 }));
  s.advance(3);
  assert.equal(pig.game.destroyed, true);
  assert.ok(s.hits.some(hit => hit.kind === "squeeze"));
  assert.equal(s.deaths[0].kind, "squeeze");
});

test("two adjacent walls with no pressing force do not cause damage", () => {
  const s = scene(), pig = s.pig();
  s.block(-30, 465, 20, 70, "stone", { isStatic: true });
  s.block(30, 465, 20, 70, "stone", { isStatic: true });
  s.advance(.8); s.enable(); s.advance(5);
  assert.equal(pig.game.hp, 24);
});

test("a deep static pinch kills even after movement stops", () => {
  const s = scene(), pig = s.pig();
  s.block(-23, 465, 20, 70, "stone", { isStatic: true });
  s.block(23, 465, 20, 70, "stone", { isStatic: true });
  s.advance(.5); s.enable(); s.advance(3);
  assert.equal(pig.game.destroyed, true);
  assert.ok(s.hits.some(hit => hit.kind === "squeeze"));
});

test("a freely falling pig and beam are not mistaken for compression", () => {
  const s = scene(), pig = s.pig(0, 100);
  Composite.remove(s.engine.world, s.ground);
  s.block(0, 70, 120, 20, "stone");
  s.enable(); s.advance(1.2);
  assert.equal(pig.game.hp, 24);
  assert.equal(s.controller.hasActivePressure(), false);
});

test("fast tangential sliding on a floor is not a damaging impact", () => {
  const s = scene(), pig = s.pig(0, 479.6);
  pig.friction = 0; s.ground.friction = 0;
  Body.setVelocity(pig, { x: 18, y: 0 });
  s.enable(); s.advance(.5);
  assert.equal(pig.game.hp, 24);
  assert.equal(s.hits.length, 0);
});

test("landing from a tiny drop does not damage a pig", () => {
  const s = scene(), pig = s.pig(0, 477);
  s.enable(); s.advance(2);
  assert.equal(pig.game.hp, 24);
});

test("a dropped stone causes impact damage and a large fall hurts the pig", () => {
  const s = scene(), pig = s.pig();
  s.advance(.5);
  s.block(0, 300, 70, 35, "stone");
  s.enable(); s.advance(2);
  assert.equal(pig.game.destroyed, true);
  assert.ok(s.hits.some(hit => hit.kind === "impact"));
  const fall = scene(), fallingPig = fall.pig(0, 260);
  fall.enable(); fall.advance(2);
  assert.equal(fallingPig.game.destroyed, true);
  assert.equal(fall.deaths[0].kind, "fall");
});

test("pressure damage uses elapsed simulation time, independent of substep rate", () => {
  const deathTimes = [60, 120, 240].map(hz => {
    const s = scene(1000 / hz);
    s.pig(); s.block(0, 450, 120, 20, "stone");
    s.advance(1); s.enable(); s.advance(3);
    assert.equal(s.deaths.length, 1);
    return s.deaths[0].at;
  });
  assert.ok(Math.max(...deathTimes) - Math.min(...deathTimes) < .12, JSON.stringify(deathTimes));
});

test("disabled damage and reset discard pending pressure", () => {
  const s = scene(), pig = s.pig();
  s.block(0, 450, 120, 20, "stone");
  s.advance(2);
  assert.equal(pig.game.hp, 24);
  s.enable(); s.advance(.1);
  assert.equal(s.controller.hasActivePressure(), true);
  s.controller.reset(); s.enable(false); s.advance(2);
  assert.equal(s.controller.hasActivePressure(), false);
  assert.equal(pig.game.pressureTime, 0);
  assert.equal(pig.game.hp, 24);
});

const levels = require("../src/lib/game/levels.js");
for (const level of levels) {
  test(`${level.name}: original structure cannot crush pigs by itself after a missed shot`, () => {
    const s = scene();
    for (const [x, y, w, h, material] of level.blocks) {
      s.block(x, y, w, h, material || "wood", { chamfer: { radius: 1.3 } });
    }
    // Match the game's ground height rather than the isolated test fixtures.
    Body.setPosition(s.ground, { x: 720, y: 559 });
    const pigs = level.pigs.map(([x, y, radius]) => s.pig(x, y, radius));
    s.advance(100 / 120); s.enable(); s.advance(8);
    assert.ok(pigs.every(pig => pig.game.hp === 24), pigs.map(pig => pig.game.hp).join(","));
    assert.equal(s.hits.length, 0);
  });
}
