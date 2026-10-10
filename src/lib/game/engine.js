/* Canvas owns physics and drawing; React owns the interface. */
import Matter from "matter-js";
import defaultLevels from "./levels";
import PigDamage from "./pig-damage";

export function createGame(root, { onChange, levels = defaultLevels }) {
  const $ = (id) => root.querySelector(`#${id}`);
  const lifetime = new AbortController();
  const listen = (target, type, listener) =>
    target.addEventListener(type, listener, { signal: lifetime.signal });
  const { Engine, Bodies, Body, Composite, Events } = Matter;
  const W = 1440, H = 630, GROUND = 519;
  const SLING = { x: 260, y: 405 };
  const MAX_PULL = 94, LAUNCH_SCALE = 0.205, BIRD_RADIUS = 22;
  const PREVIEW_LENGTH = 280, PREVIEW_SPACING = 28;
  const LEVELS = levels;
  let levelIndex = 0, level = LEVELS[0], totalBirds = level.birds;
  const STEP = 1000 / 120;
  const canvas = $("game-canvas"), ctx = canvas.getContext("2d");
  const stage = $("game-stage"), handle = $("bird-handle");
  if (!ctx) throw new Error("A Canvas 2D context is required to play Slingshot.");
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  // This small scene can keep every body active. Sleeping upper blocks can
  // otherwise remain suspended when the supports beneath them are destroyed.
  const engine = Engine.create({ enableSleeping: false, positionIterations: 8, velocityIterations: 8 });
  engine.gravity.y = 1.1;
  const view = { scale: 1, xOffset: 0, offset: 0, width: W, height: H };
  const colors = {
    ink: "#3c4934", wood: "#dca85f", woodEdge: "#a9763d", woodLight: "#efc582",
    stone: "#a0ada0", stoneEdge: "#788b7f", bird: "#dc6b4c", green: "#9db75f"
  };
  let blocks = [], pigs = [], birds = [], particles = [], floaters = [], trail = [];
  let loadedBird = null, activeBird = null;
  let state = "ready", score = 0, shots = 0, gameTime = 0, shotTime = 0, stableTime = 0;
  let pendingFinish = null, toastUntil = 0, resetTime = 0;
  let pull = { x: 0, y: 0 }, pointerId = null, keyboardAim = false;
  let aimAngle = 32, aimPower = 82, shake = 0;
  let soundOn = false, audio = null, lastImpactSound = 0;
  let best = 0, newRecord = false;
  const progress = Object.fromEntries(LEVELS.map(item => [item.id, { best: 0, stars: 0 }]));
  let lastFrame = 0, accumulator = 0, lastHudScore = -1;
  let currentPage = "levels", gameStarted = false;
  let dialog = null, result = null, status = "Your move. Make it fly.";
  let toastMessage = "", hintVisible = true, powerVisible = false;
  let frameId = 0, disposed = false, pendingFocus = false, needsResize = false;
  let lastSnapshot = "";
  try {
    const saved = JSON.parse(localStorage.getItem("slingshot-progress-v2") || "{}");
    for (const item of LEVELS) {
      const record = saved?.[item.id];
      if (Number.isFinite(record?.best) && record.best >= 0) progress[item.id].best = Math.floor(record.best);
      if (Number.isInteger(record?.stars) && record.stars >= 0 && record.stars <= 3) progress[item.id].stars = record.stars;
    }
    const legacyBest = Number(localStorage.getItem("slingshot-best-v1"));
    if (Number.isFinite(legacyBest) && legacyBest > progress.greenwood.best) progress.greenwood.best = legacyBest;
  } catch { /* Storage is optional. */ }

  const random = (min, max) => min + Math.random() * (max - min);
  const clamp = (n, min, max) => Math.min(max, Math.max(min, n));
  const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

  let announcement = "";
  function snapshot() {
    return {
      page: currentPage, gameStarted, levelIndex, state, score, shots,
      best, soundOn, dialog, result, status, announcement,
      hintVisible, powerVisible,
      power: Math.round(Math.hypot(pull.x, pull.y) / MAX_PULL * 100),
      toast: toastMessage, toastVisible: Boolean(toastUntil),
      targets: pigs.filter(p => !p.game.destroyed).length,
      progress: Object.fromEntries(Object.entries(progress).map(([id, record]) => [id, { ...record }])),
    };
  }
  function publish() {
    if (disposed) return;
    const next = snapshot(), serialized = JSON.stringify(next);
    if (serialized !== lastSnapshot) {
      lastSnapshot = serialized;
      onChange(next);
    }
  }
  function setStatus(message) { status = message; publish(); }
  function announce(message) { announcement = message; publish(); }
  function setState(next) { state = next; publish(); }
  function saveProgress() {
    try { localStorage.setItem("slingshot-progress-v2", JSON.stringify(progress)); } catch { /* Optional. */ }
  }
  function updateLevelPicker() { publish(); }
  function selectLevel(index) {
    if (!Number.isInteger(index) || index < 0 || index >= LEVELS.length) return;
    cancelAim();
    levelIndex = index;
    level = LEVELS[index];
    totalBirds = level.birds;
    reset();
    showGame();
    const route = `#play/${level.id}`;
    if (location.hash !== route) location.hash = route;
  }
  function resetFrameClock() {
    lastFrame = 0;
    accumulator = 0;
  }
  function focusGame() {
    (state === "won" ? $("next-level") : state === "lost" ? $("play-again") : loadedBird ? handle : $("settings-open")).focus({ preventScroll: true });
  }
  function showGame() {
    currentPage = "game";
    gameStarted = true;
    resetFrameClock();
    needsResize = true;
    pendingFocus = true;
    publish();
  }
  function showLevels() {
    cancelAim();
    dialog = null;
    currentPage = "levels";
    resetFrameClock();
    updateLevelPicker();
    window.scrollTo(0, 0);
    pendingFocus = true;
  }
  function openLevels() {
    if (location.hash === "#levels") showLevels();
    else location.hash = "#levels";
  }
  function resumeGame() {
    location.hash = `#play/${level.id}`;
  }
  function syncPage() {
    const match = /^#play\/([a-z]+)$/.exec(location.hash);
    const index = match ? LEVELS.findIndex(item => item.id === match[1]) : -1;
    if (index >= 0) {
      if (index !== levelIndex) selectLevel(index);
      else showGame();
    } else {
      showLevels();
    }
  }
  function updateLevelLabels() {
    best = progress[level.id].best;
    updateLevelPicker();
  }
  function toast(message, duration = 1.7) {
    toastMessage = message;
    toastUntil = gameTime + duration;
    publish();
  }

  function sound(kind) {
    if (!soundOn) return;
    try {
      if (!audio) audio = new AudioContext();
      if (audio.state === "suspended") audio.resume();
      const now = audio.currentTime;
      const notes = kind === "win" ? [523, 659, 784, 1047] : kind === "pop" ? [430, 690] :
        kind === "launch" ? [310, 180] : kind === "pull" ? [170] : [100];
      notes.forEach((frequency, index) => {
        const oscillator = audio.createOscillator(), gain = audio.createGain();
        const start = now + index * (kind === "win" ? 0.12 : 0.06);
        oscillator.type = kind === "impact" ? "triangle" : "sine";
        oscillator.frequency.setValueAtTime(frequency, start);
        oscillator.frequency.exponentialRampToValueAtTime(Math.max(35, frequency * 0.55), start + 0.16);
        gain.gain.setValueAtTime(0.0001, start);
        gain.gain.exponentialRampToValueAtTime(kind === "impact" ? 0.075 : 0.11, start + 0.01);
        gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.2);
        oscillator.connect(gain);
        gain.connect(audio.destination);
        oscillator.start(start);
        oscillator.stop(start + 0.22);
      });
    } catch { /* Play remains available without Web Audio. */ }
  }

  function toggleSound() {
    soundOn = !soundOn;
    if (soundOn) sound("pull");
    publish();
  }

  function addBlock(x, y, width, height, material = "wood") {
    const stone = material === "stone";
    const body = Bodies.rectangle(x, y, width, height, {
      label: "block", density: stone ? 0.0032 : 0.0018, friction: 0.65,
      frictionStatic: 0.9, restitution: 0.05, frictionAir: 0.006, sleepThreshold: 65,
      chamfer: { radius: 1.3 }
    });
    body.game = {
      type: "block", material, width, height, hp: stone ? 82 : 43,
      maxHp: stone ? 82 : 43, destroyed: false, lastDamage: -100
    };
    blocks.push(body);
    Composite.add(engine.world, body);
    return body;
  }

  function addPig(x, y, radius) {
    const body = Bodies.circle(x, y, radius, {
      label: "pig", density: 0.0027, friction: 0.75, restitution: 0.06,
      frictionAir: 0.008, sleepThreshold: 70
    });
    body.game = {
      type: "pig", radius, hp: 24, maxHp: 24, destroyed: false,
      hurtUntil: 0, damageKind: null
    };
    pigs.push(body);
    Composite.add(engine.world, body);
  }

  function loadBird() {
    if (shots >= totalBirds) return;
    loadedBird = Bodies.circle(SLING.x, SLING.y, BIRD_RADIUS, {
      label: "bird", density: 0.011, restitution: 0.25,
      friction: 0.65, frictionAir: 0.0015, sleepThreshold: 75
    });
    // Calculate finite mass and inertia first, then hold the bird in the fork.
    // Creating it static would leave invalid original inertia on release.
    Body.setStatic(loadedBird, true);
    loadedBird.game = { type: "bird", radius: BIRD_RADIUS };
    birds.push(loadedBird);
    Composite.add(engine.world, loadedBird);
    pull = { x: 0, y: 0 };
    positionHandle();
    setState("ready");
    setStatus(shots === 0 ? "Your move. Make it fly." : `${totalBirds - shots} ${totalBirds - shots === 1 ? "bird" : "birds"} left. You’ve got this.`);
    hintVisible = shots === 0;
    announce(`${level.name}. ${totalBirds - shots} birds available. ${pigs.filter(p => !p.game.destroyed).length} targets left.`);
  }

  function reset() {
    cancelAim();
    pigDamage.reset();
    Composite.clear(engine.world, false);
    Engine.clear(engine);
    blocks = []; pigs = []; birds = []; particles = []; floaters = []; trail = [];
    loadedBird = null; activeBird = null;
    score = 0; shots = 0; gameTime = 0; shotTime = 0; stableTime = 0;
    pendingFinish = null; shake = 0; toastUntil = 0; resetTime = 0;
    newRecord = false; keyboardAim = false; aimAngle = 32; aimPower = 82;
    accumulator = 0; lastHudScore = -1; lastImpactSound = -100;
    result = null;
    powerVisible = false;
    hintVisible = true;
    updateLevelLabels();
    const ground = Bodies.rectangle(W / 2, GROUND + 80, W + 1200, 160, {
      isStatic: true, label: "ground", friction: 0.85, restitution: 0.12
    });
    ground.game = { type: "ground" };
    Composite.add(engine.world, ground);

    for (const [x, y, width, height, material, flag] of level.blocks) {
      const body = addBlock(x, y, width, height, material);
      body.game.flag = Boolean(flag);
    }
    for (const [x, y, radius] of level.pigs) addPig(x, y, radius);

    // Let touching bodies settle before enabling damage or user input.
    for (let i = 0; i < 100; i++) Engine.update(engine, STEP);
    loadBird();
    updateHud();
    pendingFocus = true;
  }

  function updateHud() {
    if (score !== lastHudScore) {
      lastHudScore = score;
      if (score > best) {
        best = score;
        newRecord = true;
        progress[level.id].best = best;
        saveProgress();
      }
    }
    publish();
  }

  function burst(x, y, color, count = 12, force = 1) {
    if (reducedMotion) count = Math.min(count, 5);
    for (let i = 0; i < count; i++) {
      const angle = random(0, Math.PI * 2), speed = random(1.2, 4.4) * force;
      particles.push({
        x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed - 1.5,
        size: random(3, 7), life: random(0.5, 1.0), maxLife: 1.0,
        color, rotation: random(0, Math.PI), spin: random(-0.15, 0.15)
      });
    }
  }

  function destroy(body) {
    if (!body.game || body.game.destroyed) return;
    body.game.destroyed = true;
    const isPig = body.game.type === "pig";
    const points = isPig ? 1000 : body.game.material === "stone" ? 200 : 100;
    score += points;
    burst(body.position.x, body.position.y, isPig ? "#a3b968" : body.game.material === "stone" ? "#a1aca0" : "#d7a162", isPig ? 22 : 14);
    floaters.push({ x: body.position.x, y: body.position.y - 15, text: `+${points.toLocaleString("en-US")}`, life: 1.5, pig: isPig });
    Composite.remove(engine.world, body);
    if (isPig) {
      sound("pop");
      const remaining = pigs.filter(p => !p.game.destroyed).length;
      const squished = ["crush", "squeeze"].includes(body.game.damageKind);
      if (squished) floaters.push({
        x: body.position.x, y: body.position.y - 43,
        text: body.game.damageKind === "crush" ? "CRUSHED!" : "SQUEEZED!",
        life: 1.3, pig: false
      });
      toast(remaining === 0 ? "Now that’s a clean sweep." : squished ? "Squish! Gravity lends a hand." : remaining === 1 ? "One little pig to go." : "Pop! A very good start.");
      announce(`${points} points. ${remaining} targets remaining.`);
    }
    if (!reducedMotion) shake = Math.max(shake, isPig ? 4 : 2);
    updateHud();
  }

  function damage(body, other, speed) {
    const info = body.game;
    if (!info || info.destroyed || info.type !== "block") return;
    if (gameTime - info.lastDamage < 0.1 || speed < 2.15) return;
    const direct = other.game?.type === "bird";
    const stone = info.material === "stone";
    const amount = (speed - (stone ? 2 : 1.5)) * (direct ? 10 : 6);
    if (amount <= 0) return;
    info.lastDamage = gameTime;
    info.hp -= amount;
    if (info.hp <= 0) destroy(body);
  }

  const pigDamage = PigDamage.attach(Matter, engine, {
    enabled: () => shots > 0 && !["won", "lost"].includes(state),
    onDamage(pig, amount, kind) {
      if (pig.game.destroyed || amount <= 0) return;
      pig.game.hp = Math.max(0, pig.game.hp - amount);
      pig.game.damageKind = kind;
      pig.game.hurtUntil = gameTime + 0.14;
      if (pig.game.hp === 0) destroy(pig);
    }
  });

  Events.on(engine, "collisionStart", ({ pairs }) => {
    if (shots === 0 || state === "won" || state === "lost") return;
    for (const { bodyA, bodyB } of pairs) {
      const a = bodyA.velocity, b = bodyB.velocity;
      const speed = Math.hypot(a.x - b.x, a.y - b.y);
      damage(bodyA, bodyB, speed);
      damage(bodyB, bodyA, speed);
      if (speed > 3 && gameTime - lastImpactSound > 0.09) {
        sound("impact");
        lastImpactSound = gameTime;
      }
    }
  });

  function positionHandle() {
    if (!loadedBird) return;
    handle.style.left = `${(loadedBird.position.x + view.xOffset) * view.scale - 30}px`;
    handle.style.top = `${(loadedBird.position.y + view.offset) * view.scale - 30}px`;
  }

  function getPoint(event) {
    const rect = canvas.getBoundingClientRect();
    return {
      x: (event.clientX - rect.left) / view.scale - view.xOffset,
      y: (event.clientY - rect.top) / view.scale - view.offset
    };
  }

  function updateAim(point) {
    let dx = point.x - SLING.x, dy = point.y - SLING.y;
    // Pull behind the fork: the bird should always launch into the playfield.
    dx = Math.min(-5, dx);
    dy = clamp(dy, -35, MAX_PULL);
    const length = Math.hypot(dx, dy);
    if (length > MAX_PULL) { dx *= MAX_PULL / length; dy *= MAX_PULL / length; }
    pull = { x: dx, y: dy };
    Body.setPosition(loadedBird, { x: SLING.x + dx, y: SLING.y + dy });
    powerVisible = true;
    hintVisible = false;
    positionHandle();
    publish();
  }

  function cancelAim() {
    if (pointerId !== null) {
      try { if (stage.hasPointerCapture(pointerId)) stage.releasePointerCapture(pointerId); } catch { }
      pointerId = null;
    }
    keyboardAim = false;
    pull = { x: 0, y: 0 };
    powerVisible = false;
    if (state === "aiming" && loadedBird) {
      Body.setPosition(loadedBird, SLING);
      setState("ready");
      setStatus("Your move. Make it fly.");
      hintVisible = shots === 0;
      positionHandle();
    }
    publish();
  }

  function launch() {
    if (!loadedBird || (state !== "aiming" && state !== "ready")) return;
    const strength = Math.hypot(pull.x, pull.y);
    if (strength < 12) { cancelAim(); return; }
    activeBird = loadedBird;
    loadedBird = null;
    Body.setStatic(activeBird, false);
    Body.setVelocity(activeBird, { x: -pull.x * LAUNCH_SCALE, y: -pull.y * LAUNCH_SCALE });
    Body.setAngularVelocity(activeBird, -pull.x * 0.0005);
    shots++;
    shotTime = gameTime;
    stableTime = 0;
    resetTime = 0;
    trail = [];
    powerVisible = false;
    hintVisible = false;
    setState("flying");
    setStatus("A little bird. A lot of momentum.");
    sound("launch");
    announce(`Bird ${shots} launched.`);
    keyboardAim = false;
    updateHud();
  }

  listen(stage, "pointerdown", (event) => {
    if (currentPage !== "game" || dialog ||
        !["ready", "aiming"].includes(state) || !loadedBird || pointerId !== null || event.button !== 0 ||
        (event.target !== handle && event.target.closest("button, a, #result-overlay, .game-toolbar"))) return;
    const point = getPoint(event);
    if (event.target !== handle && distance(point, loadedBird.position) > Math.max(40, 31 / view.scale)) return;
    event.preventDefault();
    pointerId = event.pointerId;
    stage.setPointerCapture(pointerId);
    setState("aiming");
    handle.focus({ preventScroll: true });
    setStatus("Find your angle. Release to fly.");
    sound("pull");
  });
  listen(stage, "pointermove", (event) => {
    if (state !== "aiming" || event.pointerId !== pointerId || !loadedBird) return;
    event.preventDefault();
    updateAim(getPoint(event));
  });
  listen(stage, "pointerup", (event) => {
    if (event.pointerId !== pointerId) return;
    pointerId = null;
    if (stage.hasPointerCapture(event.pointerId)) stage.releasePointerCapture(event.pointerId);
    launch();
  });
  listen(stage, "pointercancel", cancelAim);
  listen(stage, "lostpointercapture", () => { if (pointerId !== null) cancelAim(); });
  listen(window, "blur", cancelAim);

  function applyKeyboardAim() {
    const angle = aimAngle * Math.PI / 180, power = aimPower / 100 * MAX_PULL;
    keyboardAim = true;
    setState("aiming");
    updateAim({ x: SLING.x - Math.cos(angle) * power, y: SLING.y + Math.sin(angle) * power });
    setStatus(`${aimAngle}° angle · ${aimPower}% power. Space to launch.`);
  }

  listen(document, "keydown", (event) => {
    if (currentPage !== "game" || dialog) return;
    if (event.altKey || event.ctrlKey || event.metaKey || /INPUT|TEXTAREA|SELECT/.test(event.target.tagName)) return;
    const key = event.key.toLowerCase();
    if (key === "r") { event.preventDefault(); reset(); return; }
    if (key === "m") { event.preventDefault(); toggleSound(); return; }
    if (key === "escape") { cancelAim(); return; }
    if (event.target.closest("button, a") && event.target !== handle && (key === " " || key === "enter")) return;
    if (!loadedBird || !["ready", "aiming"].includes(state) || pointerId !== null) return;
    if (["arrowup", "arrowdown", "arrowleft", "arrowright"].includes(key)) {
      event.preventDefault();
      if (key === "arrowup") aimAngle = clamp(aimAngle + 2, -10, 75);
      if (key === "arrowdown") aimAngle = clamp(aimAngle - 2, -10, 75);
      if (key === "arrowright") aimPower = clamp(aimPower + 3, 20, 100);
      if (key === "arrowleft") aimPower = clamp(aimPower - 3, 20, 100);
      applyKeyboardAim();
    }
    if (key === " " && !event.repeat) {
      event.preventDefault();
      if (!keyboardAim) applyKeyboardAim();
      launch();
    }
  });

  function finish(won) {
    cancelAim();
    setState(won ? "won" : "lost");
    hintVisible = false;
    const unused = totalBirds - shots;
    const bonus = won ? unused * 500 : 0;
    score += bonus;
    const stars = won ? (score >= level.stars[1] ? 3 : score >= level.stars[0] ? 2 : 1) : 0;
    updateHud();
    if (won) {
      progress[level.id].stars = Math.max(progress[level.id].stars, stars);
      saveProgress();
      updateLevelPicker();
    }
    const lastLevel = levelIndex === LEVELS.length - 1;
    const allCleared = Object.values(progress).every(record => record.stars > 0);
    result = {
      won, stars,
      eyebrow: won ? (newRecord ? "A NEW PERSONAL BEST" : `${level.name.toUpperCase()} · CLEARED`) : "A LITTLE PRACTICE GOES A LONG WAY",
      title: won ? (allCleared ? "Five flings of glory." : "Beautiful chaos.") : "Another shot at glory?",
      description: won ? (allCleared ? "All five levels cleared. Come back for every last star." : `${level.name} cleared. ${lastLevel ? "Try the other levels or chase three stars." : `Up next: ${LEVELS[levelIndex + 1].name}.`}`) : `${pigs.filter(p => !p.game.destroyed).length} targets survived. ${level.tip}`,
      breakdown: won ? `Includes ${bonus.toLocaleString("en-US")} bonus points for ${unused} unused ${unused === 1 ? "bird" : "birds"}` : "Fresh birds. Fresh tower. You’ve got this.",
      nextLabel: lastLevel ? "Back to level 1" : "Next level",
    };
    setStatus(won ? "Level cleared. Nicely flung." : "Out of birds. Time for a fresh start.");
    announce(`${won ? "Level cleared" : "Out of birds"}. Final score ${score}. ${stars} stars.`);
    pendingFocus = true;
    if (won) {
      sound("win");
      if (!reducedMotion) {
        for (let i = 0; i < 6; i++) burst(random(350, 1100), random(60, 180), ["#d97554", "#a4b97f", "#e5bf69"][i % 3], 15, 1.5);
      }
    }
  }

  function simulate(dt) {
    gameTime += dt;
    Engine.update(engine, STEP);
    if (toastUntil && gameTime > toastUntil) {
      toastUntil = 0;
      publish();
    }
    if (shots > 0 && !["won", "lost"].includes(state)) {
      for (const body of [...blocks, ...pigs]) {
        if (!body.game.destroyed && (body.position.y > H + 100 || body.position.x < -100 || body.position.x > W + 100)) destroy(body);
      }
      if (pigs.every(p => p.game.destroyed) && (!pendingFinish || !pendingFinish.won)) {
        pendingFinish = { won: true, at: gameTime + 1.8 };
        if (loadedBird) {
          Composite.remove(engine.world, loadedBird);
          loadedBird = null;
        }
        setState("settling");
        setStatus("Every target popped. Let the dust settle…");
      }
      if (state === "flying") {
        const elapsed = gameTime - shotTime;
        if (activeBird && Math.floor(elapsed * 120) % 7 === 0 && trail.length < 80) {
          trail.push({ x: activeBird.position.x, y: activeBird.position.y, time: gameTime });
        }
        const moving = [...blocks, ...pigs, activeBird].filter(Boolean).some(body =>
          !body.game?.destroyed && !body.isSleeping && body.position.x < W + 100 &&
          body.position.y < H + 80 && (body.speed > 0.55 || Math.abs(body.angularVelocity) > 0.035));
        stableTime = moving ? 0 : stableTime + dt;
        const birdDone = activeBird && (activeBird.position.x > W + 100 || activeBird.position.y > H + 100 || activeBird.isSleeping);
        if (elapsed > 2 && (stableTime > 0.6 || (birdDone && !moving) || elapsed > 10)) {
          if (shots < totalBirds) {
            loadBird();
          } else {
            setState("settling");
            resetTime = gameTime;
            setStatus("Last shot. Let’s see where it lands.");
          }
        }
      }
      if (pendingFinish && !pendingFinish.won && pigDamage.hasActivePressure()) pendingFinish = null;
      if (state === "settling" && !pendingFinish && resetTime && gameTime - resetTime > 2 && !pigDamage.hasActivePressure()) {
        pendingFinish = { won: false, at: gameTime + 0.2 };
      }
      if (pendingFinish && gameTime >= pendingFinish.at) {
        const won = pendingFinish.won;
        pendingFinish = null;
        finish(won);
      }
    }
    for (const p of particles) {
      p.x += p.vx * dt * 60; p.y += p.vy * dt * 60;
      p.vy += 0.15 * dt * 60; p.rotation += p.spin * dt * 60; p.life -= dt;
    }
    particles = particles.filter(p => p.life > 0);
    for (const f of floaters) { f.y -= dt * 29; f.life -= dt; }
    floaters = floaters.filter(f => f.life > 0);
    shake *= Math.pow(0.88, dt * 60);
  }

  /* All scene art is drawn here: scalable, offline, and no image assets needed. */
  function ellipse(x, y, rx, ry, fill, stroke, width = 2) {
    ctx.beginPath(); ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
    if (fill) { ctx.fillStyle = fill; ctx.fill(); }
    if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = width; ctx.stroke(); }
  }
  function line(points, stroke, width = 2) {
    ctx.beginPath(); ctx.moveTo(points[0][0], points[0][1]);
    for (let i = 1; i < points.length; i++) ctx.lineTo(points[i][0], points[i][1]);
    ctx.strokeStyle = stroke; ctx.lineWidth = width; ctx.lineCap = "round"; ctx.lineJoin = "round"; ctx.stroke();
  }
  function shape(points, fill, stroke, width = 2) {
    ctx.beginPath(); ctx.moveTo(points[0][0], points[0][1]);
    for (let i = 1; i < points.length; i++) ctx.lineTo(points[i][0], points[i][1]);
    ctx.closePath(); ctx.fillStyle = fill; ctx.fill();
    if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = width; ctx.lineJoin = "round"; ctx.stroke(); }
  }
  function roundedRect(x, y, w, h, r, fill, stroke, width = 2) {
    ctx.beginPath(); ctx.roundRect(x, y, w, h, r);
    if (fill) { ctx.fillStyle = fill; ctx.fill(); }
    if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = width; ctx.stroke(); }
  }
  function cloud(x, y, size = 1) {
    ctx.save(); ctx.translate(x, y); ctx.scale(size, size);
    ctx.fillStyle = "#f9faf0"; ctx.globalAlpha = 0.8;
    ctx.beginPath();
    ctx.moveTo(-62, 15); ctx.bezierCurveTo(-81, 9, -68, -10, -51, -8);
    ctx.bezierCurveTo(-52, -36, -19, -44, -3, -21);
    ctx.bezierCurveTo(17, -35, 41, -18, 39, -3);
    ctx.bezierCurveTo(66, -7, 82, 13, 56, 16);
    ctx.closePath(); ctx.fill(); ctx.restore();
  }
  function tree(x, base, height, color, style = 0) {
    ctx.save();
    line([[x, base], [x, base - height * 0.84]], "#8ca080", 4);
    if (style === 0) {
      ctx.fillStyle = color; ctx.beginPath();
      ctx.moveTo(x, base - height);
      ctx.bezierCurveTo(x - height * 0.18, base - height * 0.86, x - height * 0.29, base - height * 0.37, x, base - height * 0.2);
      ctx.bezierCurveTo(x + height * 0.3, base - height * 0.37, x + height * 0.19, base - height * 0.86, x, base - height);
      ctx.fill();
      line([[x, base - height * 0.3], [x, base - height * 0.83]], "#ffffff24", 2);
    } else {
      ellipse(x, base - height * 0.55, height * 0.31, height * 0.42, color);
      ellipse(x - height * 0.12, base - height * 0.72, height * 0.2, height * 0.25, color);
    }
    ctx.restore();
  }

  function drawBackground() {
    const top = -view.offset, bottom = view.height - view.offset;
    const left = -view.xOffset, right = W + view.xOffset;
    const palette = level.palette;
    const sky = ctx.createLinearGradient(0, top, 0, GROUND);
    sky.addColorStop(0, palette.sky[0]); sky.addColorStop(0.65, palette.sky[1]); sky.addColorStop(1, palette.sky[2]);
    ctx.fillStyle = sky; ctx.fillRect(left, top, view.width, view.height);

    const sunY = 146 - view.offset * 0.12;
    ellipse(1219, sunY, 67, 67, palette.sun);
    ellipse(1219, sunY, 83, 83, "#f1e7b326");
    const drift = reducedMotion ? 0 : Math.sin(gameTime * 0.028) * 12;
    cloud(382 + drift, 141, 0.9);
    cloud(815 + drift * 0.5, 99, 0.66);
    cloud(1350 + drift, 259, 0.7);
    cloud(80 + drift * 0.3, 227, 0.46);

    ctx.fillStyle = palette.hills[0]; ctx.beginPath();
    ctx.moveTo(left, 383); ctx.bezierCurveTo(180, 310, 258, 425, 420, 349);
    ctx.bezierCurveTo(621, 246, 683, 265, 857, 365);
    ctx.bezierCurveTo(1045, 405, 1160, 255, 1440, 315);
    ctx.lineTo(right, 315); ctx.lineTo(right, GROUND); ctx.lineTo(left, GROUND); ctx.fill();
    ctx.fillStyle = palette.hills[1]; ctx.beginPath();
    ctx.moveTo(left, 404); ctx.bezierCurveTo(230, 350, 402, 421, 597, 391);
    ctx.bezierCurveTo(825, 341, 904, 347, 1119, 410);
    ctx.bezierCurveTo(1258, 430, 1330, 380, W, 386);
    ctx.lineTo(right, 386); ctx.lineTo(right, GROUND); ctx.lineTo(left, GROUND); ctx.fill();

    tree(48, 465, 151, "#a8bf97");
    tree(128, 462, 104, "#b0c599", 1);
    tree(850, 450, 137, "#afc396");
    tree(883, 449, 86, "#aec292");
    tree(1320, 464, 177, "#a9bd8d");
    tree(1380, 465, 127, "#b2c599", 1);
    ctx.fillStyle = "#b5c998"; ctx.beginPath();
    ctx.moveTo(left, 467); ctx.bezierCurveTo(224, 440, 331, 476, 520, 462);
    ctx.bezierCurveTo(719, 445, 937, 483, 1090, 465);
    ctx.bezierCurveTo(1247, 442, 1350, 458, W, 443);
    ctx.lineTo(right, 443); ctx.lineTo(right, GROUND + 5); ctx.lineTo(left, GROUND + 5); ctx.fill();

    // Gentle foreground terrain, with a level top for predictable physics.
    ctx.fillStyle = palette.earth; ctx.fillRect(left, GROUND, view.width, bottom - GROUND);
    ctx.fillStyle = "#abc385"; ctx.fillRect(left, GROUND - 5, view.width, 7);
    ctx.fillStyle = "#cad29e"; ctx.fillRect(left, GROUND + 2, view.width, 4);
    ctx.fillStyle = "#b9c58e";
    for (let i = 0; i < 40; i++) {
      const x = (i * 173 + 49) % W, y = GROUND + 24 + (i * 37) % 68;
      ellipse(x, y, 1.5 + i % 2, 1, "#b7c18b65");
    }
    // Tufts, tiny daisies, and stones give the grove its scale.
    [30, 79, 339, 372, 585, 671, 769, 924, 1260, 1370].forEach((x, i) => {
      const y = GROUND - 5;
      line([[x - 6, y], [x - 8, y - 8]], "#8fa96f", 2);
      line([[x, y], [x + 1, y - 11 - i % 3]], "#8fa96f", 2);
      line([[x + 5, y], [x + 10, y - 6]], "#8fa96f", 2);
    });
    [401, 427, 815, 1293].forEach((x, i) => {
      const y = GROUND - 13 - (i % 2) * 5;
      line([[x, GROUND - 5], [x, y]], "#98ac75", 1.5);
      ellipse(x, y, 4, 3, "#fbf7d8");
      ellipse(x, y, 1.6, 1.6, "#d8b367");
    });
    ellipse(622, GROUND - 4, 9, 4, "#a7b58b");
    ellipse(641, GROUND - 3, 4, 2, "#a7b58b");
    ellipse(1240, GROUND - 4, 7, 4, "#a7b58b");
    // Distant birds.
    ctx.globalAlpha = 0.45;
    line([[597, 151], [602, 148], [607, 151], [612, 148], [617, 151]], "#7f977c", 1.5);
    line([[639, 180], [643, 178], [647, 180], [651, 178], [655, 180]], "#7f977c", 1.3);
    ctx.globalAlpha = 1;
  }

  function drawSling(front = false) {
    if (!front) {
      ellipse(258, GROUND + 3, 42, 7, "#8a996c30");
      line([[257, 511], [255, 459], [233, 410], [232, 389]], "#70533a", 15);
      line([[256, 508], [253, 458], [233, 410], [232, 389]], "#a17b4e", 10);
      line([[252, 500], [250, 461]], "#c09a65", 2);
      const end = loadedBird?.position || SLING;
      line([[232, 398], [end.x, end.y + 5]], "#69573e", 6);
    } else {
      const end = loadedBird?.position || SLING;
      line([[281, 396], [end.x + 6, end.y + 5]], "#806045", 6);
      line([[258, 473], [277, 423], [282, 391]], "#70533a", 15);
      line([[258, 473], [277, 423], [282, 391]], "#ad8351", 10);
      line([[278, 420], [283, 392]], "#c8a16a", 2);
      line([[274, 409], [284, 411]], "#81654a", 4);
      line([[273, 415], [283, 417]], "#81654a", 3);
      line([[228, 397], [237, 398]], "#81654a", 3);
    }
  }

  function drawBird(x, y, radius, angle = 0, faded = false) {
    ctx.save(); ctx.translate(x, y); ctx.rotate(angle);
    ctx.scale(radius / 22, radius / 22);
    if (faded) ctx.globalAlpha = 0.7;
    shape([[-17, 7], [-31, 3], [-26, 13], [-17, 13]], "#655743");
    shape([[-5, -17], [-12, -30], [-3, -27], [4, -17]], colors.bird, "#bc583e", 1.2);
    shape([[0, -19], [3, -29], [10, -24], [9, -17]], colors.bird);
    ellipse(0, 0, 23, 22, colors.bird, "#b7583e", 1.6);
    ellipse(4, 12, 15, 9, "#f3d9ac");
    ellipse(-10, 3, 5, 3, "#c75e46");
    ellipse(4, -3, 6.2, 7, "#fff9e7");
    ellipse(14, -3, 5.5, 6.5, "#fff9e7");
    ellipse(6, -2, 2.1, 3.1, "#3c4130");
    ellipse(15, -2, 2, 2.9, "#3c4130");
    shape([[10, 3], [30, 6], [13, 12]], "#eec15c", "#bc8d38", 1);
    line([[11, 7], [25, 7]], "#be913b", 1);
    line([[-1, -11], [10, -8]], "#524534", 3.3);
    line([[12, -8], [20, -12]], "#524534", 3.1);
    ctx.restore();
  }

  function drawPig(body) {
    const { radius, hp, maxHp, pressure = 0, pressureAxis, hurtUntil } = body.game;
    ctx.save(); ctx.translate(body.position.x, body.position.y); ctx.rotate(body.angle);
    if (pressure > 0.01 && pressureAxis) {
      const angle = Math.atan2(pressureAxis.y, pressureAxis.x) - body.angle;
      ctx.rotate(angle);
      ctx.scale(1 - pressure * 0.18, 1 + pressure * 0.09);
      ctx.rotate(-angle);
    }
    ctx.scale(radius / 22, radius / 22);
    ellipse(-13, -18, 7, 8, "#98b75e", "#7f984c", 1.5);
    ellipse(13, -18, 7, 8, "#98b75e", "#7f984c", 1.5);
    ellipse(-13, -18, 3, 4, "#b9c982");
    ellipse(13, -18, 3, 4, "#b9c982");
    ellipse(0, 0, 23, 21, hurtUntil > gameTime ? "#ced18a" : "#a6bd65", "#7f984c", 1.6);
    if (pressure > 0.15) {
      line([[-14, -7], [-6, -3], [-14, 0]], "#566e3c", 2.2);
      line([[14, -7], [6, -3], [14, 0]], "#566e3c", 2.2);
    } else {
      ellipse(-9, -4, 6, 6.5, "#fbf8df");
      ellipse(9, -4, 6, 6.5, "#fbf8df");
      const watching = state === "flying" ? -1 : 0;
      ellipse(-8 + watching, -3, 2.1, 2.6, "#414c31");
      ellipse(8 + watching, -3, 2.1, 2.6, "#414c31");
    }
    ellipse(0, 6, 11.5, 8, "#bdcf84", "#8ba357", 1);
    ellipse(-4, 6, 2.5, 3, "#728f44");
    ellipse(4, 6, 2.5, 3, "#728f44");
    line([[-4, 17], [2, 17], [5, 15]], "#627e3a", 1.5);
    ellipse(-17, 5, 3.5, 2, "#95b45a");
    ellipse(17, 5, 3.5, 2, "#95b45a");
    if (hp < 15) line([[-16, -13], [-9, -15]], "#5c7839", 2);
    ctx.restore();
    if (hp < maxHp || pressure > 0.15) {
      const width = radius * 1.8, x = body.position.x - width / 2, y = body.position.y - radius - 19;
      roundedRect(x - 1, y - 1, width + 2, 6, 3, "#f6f3dc");
      roundedRect(x, y, width, 4, 2, "#bac2a2");
      roundedRect(x, y, width * hp / maxHp, 4, 2, hp < maxHp * 0.4 ? "#d58057" : "#7e9e57");
    }
  }

  function drawBlock(body) {
    const { width: w, height: h, material, hp, maxHp, flag } = body.game;
    const stone = material === "stone";
    ctx.save(); ctx.translate(body.position.x, body.position.y); ctx.rotate(body.angle);
    roundedRect(-w / 2, -h / 2, w, h, stone ? 3 : 2, stone ? colors.stone : colors.wood, stone ? colors.stoneEdge : colors.woodEdge, 2);
    line([[-w / 2 + 3, -h / 2 + 3], [w / 2 - 3, -h / 2 + 3]], stone ? "#c1c9b7" : "#f1cb8a", 2);
    if (stone) {
      line([[-w / 2 + 6, h / 2 - 5], [w / 2 - 5, h / 2 - 5]], "#8c9b8f", 1);
      ellipse(w / 2 - 8, -h / 2 + 9, 2, 1.5, "#85978a");
      line([[-w / 2 + 5, 0], [-w / 2 + 9, -3]], "#b8c3b0", 1.5);
    } else if (w > h) {
      line([[-w / 2 + 12, -2], [-15, -2], [2, 0], [w / 2 - 10, 0]], "#bd8a4b88", 1);
      line([[-w / 2 + 18, 5], [w / 2 - 26, 5]], "#f2c47c", 1);
      ellipse(-w * 0.18, 1, 7, 2.5, null, "#b9884980", 1);
      ellipse(-w / 2 + 6, 0, 1.8, 1.8, "#976b3e");
      ellipse(w / 2 - 6, 0, 1.8, 1.8, "#976b3e");
    } else {
      line([[-w / 2 + 6, -h / 2 + 8], [-w / 2 + 7, h / 2 - 6]], "#f0c780", 1.5);
      line([[w / 2 - 6, -h / 2 + 9], [w / 2 - 8, -2], [w / 2 - 6, h / 2 - 8]], "#b8854580", 1);
      ellipse(1, h * 0.1, 2.3, 6, null, "#b3824380", 1);
      ellipse(0, -h / 2 + 6, 1.6, 1.6, "#976b3e");
      ellipse(0, h / 2 - 6, 1.6, 1.6, "#976b3e");
    }
    if (hp < maxHp * 0.8) {
      const long = Math.max(w, h) * 0.35;
      if (w > h) line([[-long, -h / 2], [-long * 0.65, 0], [-long * 0.4, -3], [0, h / 2]], stone ? "#63746a" : "#99683c", 1.6);
      else line([[-w / 2, -long], [0, -long * 0.5], [-3, 0], [w / 2, long * 0.4]], stone ? "#63746a" : "#99683c", 1.6);
    }
    if (flag) {
      line([[0, -h / 2], [0, -h / 2 - 44]], "#8b7952", 2.5);
      const flutter = reducedMotion ? 0 : Math.sin(gameTime * 3) * 2;
      shape([[1, -h / 2 - 43], [31, -h / 2 - 38 + flutter], [25, -h / 2 - 25], [1, -h / 2 - 28]], "#d7865a");
      ellipse(0, -h / 2 - 45, 2.5, 2.5, "#aa9667");
    }
    ctx.restore();
  }

  function drawTrajectory() {
    if (state !== "aiming" || !loadedBird || Math.hypot(pull.x, pull.y) < 12) return;
    let x = loadedBird.position.x, y = loadedBird.position.y;
    let vx = -pull.x * LAUNCH_SCALE, vy = -pull.y * LAUNCH_SCALE;
    let travelled = 0, nextDot = PREVIEW_SPACING;
    // Show only the first 280 world pixels, about ten dots. Gravity and drag
    // still match the real launch; the preview fades before reaching a tower.
    for (let i = 0; i < 100 && travelled < PREVIEW_LENGTH; i++) {
      vx *= 1 - 0.0015 * 0.5;
      vy = vy * (1 - 0.0015 * 0.5) + engine.gravity.y * 0.001 * (1000 / 60) ** 2 * 0.5;
      travelled += Math.hypot(vx * 0.5, vy * 0.5);
      x += vx * 0.5; y += vy * 0.5;
      if (y > GROUND - BIRD_RADIUS || x > W - 10 || travelled > PREVIEW_LENGTH) break;
      if (travelled >= nextDot) {
        const fade = travelled / PREVIEW_LENGTH;
        ctx.globalAlpha = 0.95 - fade * 0.75;
        const radius = 4.5 - fade * 1.5;
        ellipse(x, y, radius, radius, "#fffdf0", "#7b9367", 1);
        nextDot += PREVIEW_SPACING;
      }
    }
    ctx.globalAlpha = 1;
  }

  function draw() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    ctx.setTransform(view.scale * dpr, 0, 0, view.scale * dpr, view.xOffset * view.scale * dpr, view.offset * view.scale * dpr);
    drawBackground();
    ctx.save();
    if (shake > 0.2 && !reducedMotion) ctx.translate(random(-shake, shake), random(-shake, shake) * 0.5);
    // Soft contact shadows keep the structure grounded in the landscape.
    for (const [x, radius] of level.shadows) ellipse(x, GROUND + 2, radius, 7, "#68795120");
    const waiting = Math.max(0, totalBirds - shots - (loadedBird ? 1 : 0));
    for (let i = 0; i < waiting; i++) {
      const x = 190 - i * (totalBirds > 4 ? 34 : 46);
      ellipse(x, GROUND + 1, 17, 4, "#79865b20");
      drawBird(x, GROUND - 18, 16, -0.08 + i * 0.09);
    }
    if (state !== "aiming") {
      for (const point of trail) {
        const alpha = clamp(0.38 - (gameTime - point.time) * 0.035, 0, 0.38);
        if (alpha > 0) { ctx.globalAlpha = alpha; ellipse(point.x, point.y, 2.5, 2.5, "#fffbed"); }
      }
    }
    ctx.globalAlpha = 1;
    drawTrajectory();
    drawSling(false);
    for (const body of blocks) if (!body.game.destroyed) drawBlock(body);
    for (const body of pigs) if (!body.game.destroyed) drawPig(body);
    for (const bird of birds) {
      if (bird.position.x > -100 && bird.position.x < W + 100 && bird.position.y < H + 100) {
        drawBird(bird.position.x, bird.position.y, BIRD_RADIUS, bird === loadedBird ? 0 : bird.angle, bird !== loadedBird && bird.isSleeping);
      }
    }
    drawSling(true);
    for (const p of particles) {
      ctx.save(); ctx.globalAlpha = clamp(p.life / 0.4, 0, 0.9);
      ctx.translate(p.x, p.y); ctx.rotate(p.rotation);
      roundedRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.65, 1, p.color);
      ctx.restore();
    }
    for (const f of floaters) {
      ctx.globalAlpha = clamp(f.life, 0, 1);
      ctx.font = `700 ${f.pig ? 24 : 18}px "Avenir Next", "Segoe UI", sans-serif`;
      ctx.textAlign = "center"; ctx.fillStyle = f.pig ? "#5d793e" : "#99713e";
      ctx.fillText(f.text, f.x, f.y);
    }
    ctx.globalAlpha = 1;
    ctx.restore();
  }

  function resize() {
    const rect = stage.getBoundingClientRect();
    // A viewport change can briefly report a zero-sized stage. Keep the last
    // valid projection until layout settles instead of generating NaN offsets.
    if (rect.width < 1 || rect.height < 1) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const width = Math.round(rect.width * dpr), height = Math.round(rect.height * dpr);
    if (canvas.width !== width) canvas.width = width;
    if (canvas.height !== height) canvas.height = height;
    // Fit the entire physics world without stretching or cropping on wide screens.
    view.scale = Math.min(rect.width / W, rect.height / H);
    view.width = rect.width / view.scale;
    view.xOffset = Math.max(0, view.width - W) / 2;
    view.height = rect.height / view.scale;
    view.offset = Math.max(0, view.height - H) * 0.52;
    $("aim-hint").style.left = `${(SLING.x + 55 + view.xOffset) * view.scale}px`;
    $("aim-hint").style.top = `${(SLING.y - 40 + view.offset) * view.scale}px`;
    $("power-readout").style.left = `${Math.max(8, (SLING.x - 100 + view.xOffset) * view.scale)}px`;
    $("power-readout").style.top = `${(SLING.y - 115 + view.offset) * view.scale}px`;
    positionHandle();
    draw();
  }

  function frame(timestamp) {
    if (disposed) return;
    if (needsResize && stage.getBoundingClientRect().width > 0) {
      needsResize = false;
      resize();
    }
    if (pendingFocus && !dialog) {
      const page = $(currentPage === "game" ? "game-page" : "levels-page");
      if (!page.hidden && (!result || $("result-overlay")?.hidden === false)) {
        pendingFocus = false;
        if (currentPage === "game") focusGame();
        else $("page-title").focus({ preventScroll: true });
      }
    }
    if (!lastFrame) lastFrame = timestamp;
    const elapsed = Math.min((timestamp - lastFrame) / 1000, 0.05);
    lastFrame = timestamp;
    if (!document.hidden && currentPage === "game" && !dialog) {
      accumulator += elapsed;
      while (accumulator >= STEP / 1000) {
        simulate(STEP / 1000);
        accumulator -= STEP / 1000;
      }
    }
    if (currentPage === "game") draw();
    frameId = requestAnimationFrame(frame);
  }

  function setDialog(next) {
    cancelAim();
    dialog = next;
    resetFrameClock();
    if (!next && currentPage === "game") pendingFocus = true;
    publish();
  }
  listen(document, "visibilitychange", () => { resetFrameClock(); if (document.hidden) cancelAim(); });
  listen(canvas, "contextrestored", resize);
  listen(window, "hashchange", syncPage);
  const observer = new ResizeObserver(resize);
  observer.observe(stage);

  reset();
  syncPage();
  frameId = requestAnimationFrame(frame);
  return {
    selectLevel, openLevels, resumeGame, toggleSound, setDialog,
    reset() { reset(); pendingFocus = true; publish(); },
    nextLevel() { if (state === "won") selectLevel((levelIndex + 1) % LEVELS.length); },
    dispose() {
      cancelAim();
      disposed = true;
      cancelAnimationFrame(frameId);
      lifetime.abort();
      observer.disconnect();
      pigDamage.dispose();
      Events.off(engine);
      Composite.clear(engine.world, false);
      Engine.clear(engine);
      if (audio) void audio.close();
    },
  };
}
