# Browser verification

`check_game.py` exercises the actual game in Chromium, opening `index.html`
through `file://`. Python and Playwright are optional test dependencies;
**playing the game requires neither**.

```sh
python3 -m venv .qa-env
.qa-env/bin/pip install playwright
.qa-env/bin/playwright install chromium --only-shell
.qa-env/bin/python qa/check_game.py
.qa-env/bin/python qa/check_campaign.py
```

Set `CHROME_PATH` to use another installed Chromium executable.
Screenshots are saved in `qa/artifacts`.

Verified on 2026-09-19:

- Mouse drag shows an aim preview and launches a projectile with finite inertia.
- Impacts destroy blocks, pop pigs, and award score.
- A full playthrough reaches victory through real drag inputs; a verified
  two-bird playthrough scored 4,200 with a 1,000-point unused-bird bonus.
- Four deliberately weak shots reach the loss screen.
- Reset and replay restore all blocks, three pigs, four birds, and zero score.
- Arrow keys and Space aim and launch; Escape cancels without spending a bird.
- Instructions open and close; sound toggles correctly.
- Personal best survives a reload.
- 390, 768, 1440, and 1920 pixel layouts have no horizontal overflow.
- The mobile result screen keeps replay accessible.
- Native touch drag launches; native touch cancellation preserves the bird.
- No external network requests or uncaught JavaScript errors.

The simulation observer in the test only reads body positions and inertia.
It selects a surviving pig after the tower collapses and aims a lob using
mouse input. It does not change score, health, positions, or victory state.

Regression fixes covered by these checks include a projectile created with
invalid static-body inertia and upper blocks sleeping after losing support.

The five-level expansion adds `check_campaign.py`. It checks the rendered aim
preview, including its short length, changing angle, and removal on cancellation;
every level's initial structural stability; switching levels mid-flight;
resetting the selected level; winning all five layouts through mouse input;
the next-level buttons and final-level return; per-level bests and saved stars;
and responsive level selection.

Both scripts use native inputs to play. The campaign observer also records
Canvas draw calls to measure the visible preview without changing rendering.
Opening shots target a wooden support, or the upper story of Stonewall Keep;
later shots aim at surviving pigs. Physics outcomes and scores may vary
slightly with the tower's settling time.

The expanded campaign was cleared consecutively at 3,800 / 5,400 / 4,800 /
5,600 / 6,000 points, including next-level transitions and persistence after
reload. A resize regression was fixed by ignoring temporary zero-sized layouts.
The final focused check passed recovery from a 1-pixel viewport, 390 / 768 /
1920-pixel layouts, native touch aim / cancellation / launch, and switching
levels after a touch launch, with no JavaScript errors.

## Pig damage checks

Run the physics tests with Node.js; no packages need installing:

```sh
node --test qa/pig-damage.test.cjs
```

All 20 scenarios passed on 2026-09-20. They simulate actual Matter.js contacts:
stationary heavy beams, weight transmitted through stacks, lateral squeezing,
deep geometric pinches, dropped stones, long and tiny falls, removal of a
load, brief contacts, light debris, tangential motion, and free fall. Pressure
damage is also compared at 60, 120, and 240 physics steps per second. Every
original level is tested with damage enabled to rule out passive damage.

Optional browser integration, using an installed Chrome:

```sh
npm install --prefix .qa-node --no-save --no-package-lock playwright
NODE_PATH=.qa-node/node_modules node qa/check-pig-ui.cjs
```

Set `CHROME_PATH` for another Chromium executable. This test checks all five
real levels, then serves a separate one-pig pressure fixture without changing
the game's files. Native keyboard input launches the sole bird. Checks passed
for visible health loss and squashing, crushing-triggered victory, exactly
1,000 points per pig, no further score after death, replay clearing pressure,
light contact preserving health while allowing normal defeat, and no JavaScript
errors. The screenshot is `artifacts/pig-pressure.png`.
