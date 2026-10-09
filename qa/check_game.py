"""End-to-end checks using Python Playwright.

Run with: python qa/check_game.py
Requires: pip install playwright && playwright install chromium --only-shell
Optionally set CHROME_PATH to use an existing Chromium executable.
"""
import json
import math
import os
from pathlib import Path

from playwright.sync_api import sync_playwright, expect

ROOT = Path(__file__).resolve().parents[1]
ARTIFACTS = ROOT / "qa" / "artifacts"
ARTIFACTS.mkdir(exist_ok=True)
CHROME = os.environ.get("CHROME_PATH")
# Observe the real physics world without altering simulation or gameplay.
# Tests still launch exclusively through native mouse, touch, or keyboard input.
OBSERVE_ENGINE = """
let matter;
Object.defineProperty(window, 'Matter', {
    get() { return matter; },
    set(value) {
        matter = value;
        const create = value.Engine.create;
        value.Engine.create = function(...args) {
            const engine = create.apply(this, args);
            window.__qaEngine = engine;
            return engine;
        };
    }
});
"""


def read_state(page):
    return page.evaluate("""() => ({
        state: document.querySelector('#game-stage').dataset.state,
        score: Number(document.querySelector('#score').textContent),
        targets: document.querySelector('#target-count').textContent,
        birds: document.querySelector('#bird-slots').getAttribute('aria-label'),
        status: document.querySelector('#status-text').textContent,
        result: !document.querySelector('#result-overlay').hidden,
        overflow: document.documentElement.scrollWidth > innerWidth
    })""")


def drag_bird(page, dx, dy, screenshot=None):
    box = page.locator("#bird-handle").bounding_box()
    scale = page.locator("#game-stage").bounding_box()["width"] / 1440
    x, y = box["x"] + box["width"] / 2, box["y"] + box["height"] / 2
    page.mouse.move(x, y)
    page.mouse.down()
    page.mouse.move(x + dx * scale, y + dy * scale, steps=15)
    expect(page.locator("#game-stage")).to_have_attribute("data-state", "aiming")
    expect(page.locator("#power-readout")).to_be_visible()
    if screenshot:
        page.screenshot(path=str(ARTIFACTS / screenshot))
    page.mouse.up()
    expect(page.locator("#game-stage")).to_have_attribute("data-state", "flying")


def wait_for_shot(page):
    page.wait_for_function(
        "() => ['ready','won','lost'].includes(document.querySelector('#game-stage').dataset.state)",
        timeout=20000,
    )
    return read_state(page)


def aim_at_remaining_pig(page):
    """Choose a lob at a surviving pig's current location after the collapse."""
    pigs = page.evaluate("""() => Matter.Composite.allBodies(__qaEngine.world)
        .filter(b => b.label === 'pig')
        .map(b => ({x: b.position.x, y: b.position.y}))""")
    target = min(pigs, key=lambda pig: pig["x"])
    candidates = []
    for tenth_degree in range(100, 750):
        angle = math.radians(tenth_degree / 10)
        dx, dy = -94 * math.cos(angle), 94 * math.sin(angle)
        x, y, vx, vy = 260 + dx, 405 + dy, -dx * 0.205, -dy * 0.205
        for _ in range(300):
            vx *= 0.99925
            vy = vy * 0.99925 + 1.1 * 0.001 * (1000 / 60) ** 2 * 0.5
            nx, ny = x + vx * 0.5, y + vy * 0.5
            if nx >= target["x"]:
                impact_y = y + (ny - y) * (target["x"] - x) / (nx - x)
                candidates.append((abs(impact_y - target["y"]), -tenth_degree, dx, dy))
                break
            x, y = nx, ny
    accurate = [candidate for candidate in candidates if candidate[0] < 3]
    chosen = min(accurate, key=lambda candidate: candidate[1]) if accurate else min(candidates)
    return chosen[2], chosen[3]


with sync_playwright() as p:
    browser = p.chromium.launch(executable_path=CHROME, headless=True,
                               args=["--disable-gpu", "--disable-accelerated-2d-canvas"])
    context = browser.new_context(viewport={"width": 1440, "height": 1200},
                                  device_scale_factor=1, reduced_motion="reduce")
    context.add_init_script(OBSERVE_ENGINE)
    page = context.new_page()
    errors, external_requests = [], []
    page.on("pageerror", lambda error: errors.append(str(error)))
    page.on("request", lambda request: external_requests.append(request.url)
            if request.url.startswith(("http:", "https:")) else None)
    page.goto((ROOT / "index.html").as_uri())
    expect(page.locator("#game-stage")).to_have_attribute("data-state", "ready")
    assert read_state(page)["score"] == 0
    assert not read_state(page)["overflow"]
    page.screenshot(path=str(ARTIFACTS / "desktop.png"), full_page=True)
    print("INITIAL", json.dumps(read_state(page)), flush=True)

    # A real pointer drag should display an arc and cause a damaging shot.
    drag_bird(page, -84, 42, "aiming.png")
    finite_inertia = page.evaluate("""() => Matter.Composite.allBodies(__qaEngine.world)
        .filter(b => b.label === 'bird' && !b.isStatic)
        .every(b => Number.isFinite(b.inertia) && b.inertia > 0)""")
    assert finite_inertia, "Released birds must have finite, positive inertia."
    result = wait_for_shot(page)
    print("DRAG_SHOT", json.dumps(result), flush=True)
    page.screenshot(path=str(ARTIFACTS / "after-shot.png"))
    assert result["score"] > 0, "A tower hit should award points."
    assert result["birds"].startswith("3")

    # Reset must rebuild the entire tower and replenish every bird.
    page.locator("#reset-button").click()
    reset = read_state(page)
    assert reset["state"] == "ready" and reset["score"] == 0
    assert reset["targets"] == "3 targets left" and reset["birds"] == "4 birds remaining"
    print("RESET", json.dumps(reset), flush=True)

    # Cancel an aim without spending a bird.
    page.locator("#bird-handle").focus()
    page.keyboard.press("ArrowUp")
    expect(page.locator("#game-stage")).to_have_attribute("data-state", "aiming")
    page.keyboard.press("Escape")
    expect(page.locator("#game-stage")).to_have_attribute("data-state", "ready")
    assert read_state(page)["birds"] == "4 birds remaining"

    # Help is a keyboard-accessible native modal; sound has explicit state.
    page.locator("#how-to-open").click()
    expect(page.locator("#help-dialog")).to_be_visible()
    page.keyboard.press("Escape")
    expect(page.locator("#help-dialog")).not_to_be_visible()
    page.locator("#sound-toggle").click()
    expect(page.locator("#sound-toggle")).to_have_attribute("aria-pressed", "true")
    page.locator("#sound-toggle").click()
    expect(page.locator("#sound-toggle")).to_have_attribute("aria-pressed", "false")

    # The level must be beatable through the same drag input used by a player.
    for index in range(4):
        if read_state(page)["state"] == "won":
            break
        dx, dy = (-84, 42) if index == 0 else aim_at_remaining_pig(page)
        drag_bird(page, dx, dy)
        result = wait_for_shot(page)
        print(f"LEVEL_SHOT_{index + 1}", json.dumps(result), flush=True)
    assert read_state(page)["state"] == "won", "Four aimed shots should clear this level."
    expect(page.locator("#result-overlay")).to_be_visible()
    page.screenshot(path=str(ARTIFACTS / "win.png"))
    winning_score = read_state(page)["score"]
    # Small screens must keep the entire result card and its replay action usable.
    page.set_viewport_size({"width": 390, "height": 844})
    page.screenshot(path=str(ARTIFACTS / "mobile-win.png"), full_page=True)
    page.locator("#play-again").click()
    assert read_state(page)["score"] == 0
    page.set_viewport_size({"width": 1440, "height": 1024})

    # Four deliberately weak shots should trigger a recoverable loss.
    for index in range(4):
        if index == 0:
            page.locator("#bird-handle").focus()
            for _ in range(22):
                page.keyboard.press("ArrowLeft")
            page.keyboard.press("Space")
            expect(page.locator("#game-stage")).to_have_attribute("data-state", "flying")
        else:
            drag_bird(page, -20, 8)
        result = wait_for_shot(page)
        print(f"MISS_{index + 1}", json.dumps(result), flush=True)
    assert read_state(page)["state"] == "lost"
    expect(page.locator("#play-again")).to_be_visible()
    page.keyboard.press("r")
    assert read_state(page)["birds"] == "4 birds remaining"

    # Best score persists across a real reload, including file:// usage.
    page.reload()
    expect(page.locator("#game-stage")).to_have_attribute("data-state", "ready")
    saved = int(page.locator("#best-score").inner_text().replace(",", ""))
    assert saved >= winning_score

    for width, height in [(390, 844), (768, 1024), (1920, 1080)]:
        page.set_viewport_size({"width": width, "height": height})
        page.wait_for_function("() => document.documentElement.scrollWidth <= innerWidth", timeout=3000)
        assert not read_state(page)["overflow"], f"Horizontal overflow at {width}px"
        expect(page.locator("#reset-button")).to_be_visible()
        page.screenshot(path=str(ARTIFACTS / f"viewport-{width}.png"), full_page=True)

    # Native touch input goes through Pointer Events, capture, and cancellation.
    mobile = browser.new_context(viewport={"width": 390, "height": 844}, has_touch=True, is_mobile=True)
    touch_page = mobile.new_page()
    touch_page.on("pageerror", lambda error: errors.append(str(error)))
    touch_page.goto((ROOT / "index.html").as_uri())
    expect(touch_page.locator("#game-stage")).to_have_attribute("data-state", "ready")
    cdp = mobile.new_cdp_session(touch_page)
    box = touch_page.locator("#bird-handle").bounding_box()
    sx, sy = box["x"] + 30, box["y"] + 30
    for cancelled in [True, False]:
        cdp.send("Input.dispatchTouchEvent", {"type": "touchStart", "touchPoints": [{"x": sx, "y": sy}]})
        cdp.send("Input.dispatchTouchEvent", {"type": "touchMove", "touchPoints": [{"x": sx - 21, "y": sy + 10}]})
        expect(touch_page.locator("#game-stage")).to_have_attribute("data-state", "aiming")
        cdp.send("Input.dispatchTouchEvent", {"type": "touchCancel" if cancelled else "touchEnd", "touchPoints": []})
        expect(touch_page.locator("#game-stage")).to_have_attribute("data-state", "ready" if cancelled else "flying")
        assert read_state(touch_page)["birds"].startswith("4" if cancelled else "3")
    mobile.close()

    assert not external_requests, f"Unexpected external resources: {external_requests}"
    assert not errors, f"Browser errors: {errors}"
    print("PASS: drag, inertia, damage, reset, cancel, keyboard launch, help, sound, win, loss, best score, responsive, touch, offline, no JS errors.", flush=True)
    browser.close()
