# Verification

Install dependencies with `npm install`, then run:

```sh
npm run lint
npm run typecheck
npm test
npm run test:e2e
```

Browser tests use installed Google Chrome on macOS. Set `CHROME_PATH` to use
another Chromium executable. Playwright builds and starts the production app
automatically. When testing an already running production server in CI, use
`QA_REUSE_SERVER=1 npm run test:e2e`.

The tests require a production build because their observer instruments the
bundled Matter.js module. The observer only exposes the actual engine for
read-only assertions. It fails explicitly if the expected bundle format changes.
It does not change health, positions, scores, physics, or victory conditions.

`game.spec.cjs` checks the five original layouts, short Canvas aim previews, mouse aiming, finite inertia,
keyboard controls, aim cancellation, Radix dialogs, paused physics, help from
Settings, sound, level selection and resume, reset, reload persistence, direct
`#play/keep` navigation, full-window layouts at 390/768/1920 pixels, native touch
cancel/launch, all five wins through real mouse inputs, next-level transitions,
and recoverable loss after four weak shots.

`pressure.spec.cjs` replaces level data only in the browser response with a
one-pig fixture. It verifies visible pressure and health loss, crushing-triggered
victory after the last bird, exactly 1,000 points per pig, no score after death,
replay clearing pressure, and harmless light contact permitting normal defeat.
No source files are changed for fixtures.

`pig-damage.test.cjs` runs 20 real Matter.js simulations, including stationary
heavy beams, load transfer through stacks, lateral squeezing, deep pinches,
impacts and falls, load removal, brief contacts, light debris, tangential motion,
free fall, pressure at 60/120/240 substeps per second, and passive safety in all
five original levels.

New screenshots and test output are saved under the system temporary directory.
Set `QA_ARTIFACTS` to choose a screenshot directory. `qa/artifacts/` contains the
historical screenshots from the original standalone implementation.

The previous Python/file-URL and standalone HTTP checks were replaced by these
Next.js browser tests.

Migration verified on 2026-10-10: production build, ESLint, TypeScript, all
20 physics scenarios, and all six browser scenarios passed. Development mode
also passed keyboard aiming, single-shot launch, and modal closing without
browser errors.
