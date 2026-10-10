/* Contact-based pig damage. Uses the same Matter.js solver as the game.
   Kept independent of drawing/UI so real physics scenes can be tested in Node. */
const PigDamage = (() => {
  "use strict";

  const SAFE_LOAD = 0.85; // Opposing force in multiples of the pig's own weight.
  const PRESSURE_GRACE = 0.18; // Ignore brief contact noise, in simulation seconds.
  const IMPACT_THRESHOLD = 2.6; // Normal closing speed in pixels per 60 Hz frame.
  const clamp = (n, low, high) => Math.min(high, Math.max(low, n));
  const alive = body => body.game && !body.game.destroyed;

  function attach(Matter, engine, { enabled, onDamage }) {
    const { Body, Composite, Events } = Matter;
    const pendingHits = new Map();
    let pressuredPigs = [];

    function init(pig) {
      if (pig.game.pressureTime === undefined) {
        Object.assign(pig.game, {
          pressureTime: 0, pressure: 0, pressureAxis: { x: 0, y: 1 },
          underPressure: false, lastImpactAt: -Infinity
        });
      }
      return pig.game;
    }

    function velocityAt(body, point) {
      // Body.velocity during collisionStart uses the current substep, whereas
      // these accessors normalize both translation and rotation to 60 Hz.
      const velocity = Body.getVelocity(body);
      const angular = Body.getAngularVelocity(body);
      return {
        x: velocity.x - angular * (point.y - body.position.y),
        y: velocity.y + angular * (point.x - body.position.x)
      };
    }

    function queueImpact(pig, other, collision) {
      if (!alive(pig) || pig.game.type !== "pig" || other.isSensor) return;
      const data = init(pig), now = engine.timing.timestamp / 1000;
      if (now - data.lastImpactAt < 0.1) return;
      const sign = collision.bodyA === pig ? 1 : -1;
      const normal = { x: collision.normal.x * sign, y: collision.normal.y * sign };
      let closingSpeed = 0;
      const points = collision.supports.slice(0, collision.supportCount);
      for (const point of points) {
        const a = velocityAt(pig, point), b = velocityAt(other, point);
        closingSpeed = Math.max(closingSpeed, -((a.x - b.x) * normal.x + (a.y - b.y) * normal.y));
      }
      if (closingSpeed <= IMPACT_THRESHOLD) return;
      const massFactor = other.isStatic ? 1 : clamp(Math.sqrt(other.mass / pig.mass), 0.35, 2.1);
      const multiplier = other.game?.type === "bird" ? 7 : 4.8;
      const amount = (closingSpeed - IMPACT_THRESHOLD) * multiplier * massFactor;
      const previous = pendingHits.get(pig);
      // One strongest hit per substep; a two-point manifold isn't two hits.
      if (!previous || amount > previous.amount) {
        const kind = other.game?.type === "ground" ? "fall" : "impact";
        pendingHits.set(pig, { amount, kind });
      }
    }

    function beforeUpdate() {
      pendingHits.clear();
    }

    function collisionStart({ pairs }) {
      if (!enabled()) return;
      for (const pair of pairs) {
        if (pair.isSensor) continue;
        queueImpact(pair.bodyA, pair.bodyB, pair.collision);
        queueImpact(pair.bodyB, pair.bodyA, pair.collision);
      }
    }

    function afterUpdate({ delta }) {
      const pigs = Composite.allBodies(engine.world).filter(body => alive(body) && body.game.type === "pig");
      const dt = delta / 1000;
      pressuredPigs = [];
      if (!enabled()) {
        for (const pig of pigs) {
          const data = init(pig);
          data.pressureTime = 0;
          data.pressure = 0;
          data.underPressure = false;
        }
        pendingHits.clear();
        return;
      }

      for (const [pig, hit] of pendingHits) {
        if (!alive(pig)) continue;
        init(pig).lastImpactAt = engine.timing.timestamp / 1000;
        onDamage(pig, hit.amount, hit.kind);
      }
      pendingHits.clear();

      const contacts = new Map(pigs.filter(alive).map(pig => [pig, []]));
      const gravity = Math.hypot(engine.gravity.x, engine.gravity.y) * engine.gravity.scale;
      // Matter's warm-start impulses are mass × displacement per substep.
      // Dividing by m*g*dt² yields a load ratio independent of the step rate.
      const gravityStep = gravity * delta * delta;
      for (const pair of engine.pairs.list) {
        if (!pair.isActive || pair.isSensor || pair.contactCount === 0) continue;
        const { bodyA, bodyB, collision } = pair;
        for (const [pig, other, sign] of [[bodyA, bodyB, 1], [bodyB, bodyA, -1]]) {
          if (!contacts.has(pig) || !alive(other) || other.isSensor) continue;
          if (!["block", "bird", "ground"].includes(other.game.type)) continue;
          // A loaded bird is held by the sling and must not act as a crusher.
          if (other.game.type === "bird" && other.isStatic) continue;
          let impulse = 0;
          for (let i = 0; i < pair.contactCount; i++) {
            impulse += Math.max(0, -pair.contacts[i].normalImpulse);
          }
          contacts.get(pig).push({
            x: collision.normal.x * sign,
            y: collision.normal.y * sign,
            load: gravityStep > 0 ? impulse / (pig.mass * gravityStep) : 0,
            depth: Math.max(0, pair.separation - pair.slop)
          });
        }
      }

      for (const [pig, touching] of contacts) {
        const data = init(pig);
        let severity = 0, axis = data.pressureAxis;
        // Sum loads on each side, but count each contacting body only once.
        // At least two opposing directions are necessary: standing on a floor,
        // touching a wall, and a freely falling pile are not compression.
        for (const candidate of touching) {
          let forward = 0, backward = 0, frontDepth = 0, backDepth = 0;
          for (const contact of touching) {
            const dot = candidate.x * contact.x + candidate.y * contact.y;
            if (dot > 0.65) {
              forward += contact.load * dot;
              frontDepth = Math.max(frontDepth, contact.depth * dot);
            } else if (dot < -0.65) {
              backward += contact.load * -dot;
              backDepth = Math.max(backDepth, contact.depth * -dot);
            }
          }
          const compression = Math.min(forward, backward) / SAFE_LOAD;
          // Deep, unresolved penetration on BOTH sides also catches a tight
          // geometric pinch, even after translational velocity reaches zero.
          const pinch = Math.min(frontDepth, backDepth) / (data.radius * 0.12);
          const value = Math.max(compression, pinch);
          if (value > severity) {
            severity = value;
            axis = { x: candidate.x, y: candidate.y };
          }
        }
        const pressing = severity > 1;
        data.underPressure = pressing;
        data.pressureTime = pressing ? data.pressureTime + dt : 0;
        data.pressureAxis = axis;
        const target = pressing ? clamp(severity / 3, 0.2, 1) : 0;
        data.pressure += (target - data.pressure) * (1 - Math.exp(-dt * 15));
        if (!pressing) continue;
        pressuredPigs.push(pig);
        if (data.pressureTime < PRESSURE_GRACE) continue;
        const rate = 10 + clamp((severity - 1) * 14, 0, 42);
        const kind = Math.abs(axis.y) > 0.7 ? "crush" : "squeeze";
        onDamage(pig, rate * dt, kind);
      }
    }

    Events.on(engine, "beforeUpdate", beforeUpdate);
    Events.on(engine, "collisionStart", collisionStart);
    Events.on(engine, "afterUpdate", afterUpdate);
    return {
      hasActivePressure: () => pressuredPigs.some(pig => alive(pig) && pig.game.underPressure),
      reset() { pendingHits.clear(); pressuredPigs = []; },
      dispose() {
        Events.off(engine, "beforeUpdate", beforeUpdate);
        Events.off(engine, "collisionStart", collisionStart);
        Events.off(engine, "afterUpdate", afterUpdate);
      }
    };
  }

  return { attach };
})();

if (typeof module !== "undefined" && module.exports) module.exports = PigDamage;
else globalThis["PigDamage"] = PigDamage;
