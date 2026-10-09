"""Real-input checks for the five-level campaign and short aim preview.

Run using the same Python Playwright environment as check_game.py.
"""
import json
import math
import os
from pathlib import Path

from playwright.sync_api import sync_playwright, expect

ROOT = Path(__file__).resolve().parents[1]
ARTIFACTS = ROOT / "qa" / "artifacts"
OBSERVE = """
let matter;
Object.defineProperty(window, 'Matter', {
    get() { return matter; },
    set(value) {
        matter = value;
        const create = value.Engine.create;
        value.Engine.create = function(...args) {
            return window.__qaEngine = create.apply(this, args);
        };
    }
});
const proto = CanvasRenderingContext2D.prototype;
const ellipse = proto.ellipse, stroke = proto.stroke, transform = proto.setTransform;
proto.ellipse = function(x, y, ...args) {
    this.__qaEllipse = { x, y };
    return ellipse.call(this, x, y, ...args);
};
proto.stroke = function(...args) {
    if (this.strokeStyle === '#7b9367' && this.__qaEllipse) window.__qaPreview.push(this.__qaEllipse);
    return stroke.apply(this, args);
};
proto.setTransform = function(...args) {
    window.__qaPreview = [];
    return transform.apply(this, args);
};
"""


def state(page):
    return page.evaluate("""() => ({
        level: Number(document.querySelector('#game-stage').dataset.level),
        state: document.querySelector('#game-stage').dataset.state,
        score: Number(document.querySelector('#score').textContent),
        birds: document.querySelector('#bird-slots').getAttribute('aria-label'),
        targets: Matter.Composite.allBodies(__qaEngine.world)
            .filter(b => b.label === 'pig')
            .map(b => ({x: b.position.x, y: b.position.y, hp: b.game.hp})),
        blocks: Matter.Composite.allBodies(__qaEngine.world).filter(b => b.label === 'block').length
    })""")


def drag(page, dx, dy, release=True):
    handle = page.locator("#bird-handle")
    handle.scroll_into_view_if_needed()
    box = handle.bounding_box()
    scale = page.locator("#game-stage").bounding_box()["width"] / 1440
    x, y = box["x"] + 30, box["y"] + 30
    page.mouse.move(x, y)
    page.mouse.down()
    page.mouse.move(x + dx * scale, y + dy * scale, steps=12)
    expect(page.locator("#game-stage")).to_have_attribute("data-state", "aiming")
    if release:
        page.mouse.up()
        expect(page.locator("#game-stage")).to_have_attribute("data-state", "flying")


def aim(target, high=True):
    candidates = []
    for tenth in range(60, 750):
        angle = math.radians(tenth / 10)
        dx, dy = -94 * math.cos(angle), 94 * math.sin(angle)
        x, y, vx, vy = 260 + dx, 405 + dy, -dx * .205, -dy * .205
        for _ in range(300):
            vx *= .99925
            vy = vy * .99925 + 1.1 * .001 * (1000 / 60) ** 2 * .5
            nx, ny = x + vx * .5, y + vy * .5
            if nx >= target["x"]:
                impact = y + (ny - y) * (target["x"] - x) / (nx - x)
                candidates.append((abs(impact - target["y"]), -tenth, dx, dy))
                break
            x, y = nx, ny
    accurate = [candidate for candidate in candidates if candidate[0] < 3]
    chosen = min(accurate, key=lambda candidate: candidate[1] if high else -candidate[1]) if accurate else min(candidates)
    return chosen[2], chosen[3]


with sync_playwright() as p:
    browser = p.chromium.launch(executable_path=os.environ.get("CHROME_PATH"), headless=True,
                               args=["--disable-accelerated-2d-canvas"])
    context = browser.new_context(viewport={"width": 1440, "height": 1200}, reduced_motion="reduce")
    context.add_init_script(OBSERVE)
    page = context.new_page()
    errors, network = [], []
    page.on("pageerror", lambda error: errors.append(str(error)))
    page.on("request", lambda request: network.append(request.url)
            if request.url.startswith(("http:", "https:")) else None)
    page.goto((ROOT / "index.html").as_uri())
    expect(page.locator(".level-choice")).to_have_count(5)

    # Observe the rendered path: short, reactive, and removed on cancellation.
    drag(page, -84, 42, release=False)
    page.wait_for_function("() => window.__qaPreview?.length > 5", timeout=3000)
    preview = page.evaluate("() => window.__qaPreview")
    assert 6 <= len(preview) <= 10
    assert max(point["x"] for point in preview) < 500
    page.screenshot(path=str(ARTIFACTS / "short-trajectory.png"), full_page=True)
    page.keyboard.press("Escape")
    page.mouse.up()
    page.wait_for_function("() => window.__qaPreview.length === 0", timeout=3000)
    assert state(page)["birds"] == "4 birds remaining"
    page.locator("#bird-handle").focus()
    page.keyboard.press("ArrowUp")
    page.wait_for_function("() => window.__qaPreview.length > 5", timeout=3000)
    assert page.evaluate("() => window.__qaPreview") != preview
    page.keyboard.press("Escape")

    # Every layout must stand undamaged before the first shot.
    expected_targets = [3, 4, 4, 4, 5]
    expected_birds = [4, 6, 6, 6, 7]
    for index in range(5):
        page.locator(".level-choice").nth(index).click()
        expect(page.locator("#game-stage")).to_have_attribute("data-level", str(index + 1))
        initial = state(page)
        start = page.evaluate("() => __qaEngine.timing.timestamp")
        page.wait_for_function("(start) => __qaEngine.timing.timestamp - start > 1800", arg=start, timeout=6000)
        settled = state(page)
        assert len(settled["targets"]) == expected_targets[index]
        assert settled["birds"] == f"{expected_birds[index]} birds remaining"
        assert settled["score"] == 0
        assert settled["blocks"] == initial["blocks"]
        assert all(abs(a["y"] - b["y"]) < 12 for a, b in zip(initial["targets"], settled["targets"])), settled
        page.screenshot(path=str(ARTIFACTS / f"level-{index + 1}.png"), full_page=True)
        print("STABLE", index + 1, json.dumps(settled), flush=True)

    # Switching mid-flight must remove the previous shot, score, and timer.
    page.locator(".level-choice").nth(0).click()
    drag(page, -84, 42)
    page.locator(".level-choice").nth(4).click()
    assert state(page)["state"] == "ready" and state(page)["score"] == 0
    assert state(page)["birds"] == "7 birds remaining"
    page.locator("#reset-button").click()
    assert state(page)["level"] == 5 and len(state(page)["targets"]) == 5

    page.locator(".level-choice").nth(0).click()
    # Play all five in sequence and use the real next-level buttons.
    for index, count in enumerate(expected_birds):
        assert state(page)["level"] == index + 1
        for shot in range(count):
            current = state(page)
            if current["state"] == "won":
                break
            target = min(current["targets"], key=lambda pig: pig["x"])
            if shot == 0 and index == 4:
                dx, dy = aim({"x": 1090, "y": 254})
            elif shot == 0:
                support = [{"x": 1028, "y": 453}, {"x": 884, "y": 471},
                           {"x": 895, "y": 451}, {"x": 1038, "y": 474},
                           {"x": 920, "y": 442}][index]
                dx, dy = aim(support, high=False)
            else:
                dx, dy = aim(target)
            drag(page, dx, dy)
            page.wait_for_function(
                "() => ['ready','won','lost'].includes(document.querySelector('#game-stage').dataset.state)",
                timeout=20000,
            )
            print("SHOT", index + 1, shot + 1, json.dumps(state(page)), flush=True)
        page.screenshot(path=str(ARTIFACTS / f"level-{index + 1}-result.png"), full_page=True)
        assert state(page)["state"] == "won", f"Level {index + 1} was not cleared."
        assert page.locator(".level-choice").nth(index).get_attribute("class").endswith("cleared")
        expect(page.locator("#next-level")).to_be_visible()
        score = state(page)["score"]
        page.locator("#next-level").click()
        assert state(page)["level"] == (index + 1) % 5 + 1
        assert state(page)["score"] == 0
        if index < 4:
            assert page.locator("#best-score").inner_text() == "0", "Bests must be separate."
        print("CLEARED", index + 1, "score", score, flush=True)

    expect(page.locator("#campaign-progress")).to_contain_text("5 / 5 cleared")
    page.reload()
    expect(page.locator("#campaign-progress")).to_contain_text("5 / 5 cleared")
    assert int(page.locator("#best-score").inner_text().replace(",", "")) > 0

    for width in [390, 768, 1440]:
        page.set_viewport_size({"width": width, "height": 1000})
        page.locator(".level-choice").nth(4).click()
        assert not page.evaluate("() => document.documentElement.scrollWidth > innerWidth")
        expect(page.locator(".level-choice").nth(4)).to_be_visible()
        page.screenshot(path=str(ARTIFACTS / f"campaign-{width}.png"), full_page=True)
    assert not errors, errors
    assert not network, network
    print("PASS: short trajectory, stable layouts, mid-flight switching, reset, all five wins, next level, final wrap, saved stars, per-level best, responsive, offline.", flush=True)
    browser.close()
