# Slingshot

A five-level, Angry Birds–inspired browser game built with **Next.js App Router,
React, Tailwind CSS 4, and shadcn/ui**, with original Canvas artwork and Matter.js
0.20.0 physics.

## Play

Use Node.js 20.9 or later. From the `slingshot` directory:

```sh
npm install
npm run dev
```

Then open <http://localhost:3000>.

For production:

```sh
npm run build
npm run start
```

The app serves all resources locally. No external image, font, audio, or CDN
requests are needed during play. It must now run through Next.js rather than
opening an HTML file directly.

## Controls

- **Mouse or touch:** grab the red bird, pull backward, and release.
- Pull farther for more force; pull downward for a higher arc.
- A short, fading line of dots previews the first part of the flight while aiming.
- **↑ / ↓:** adjust the launch angle.
- **← / →:** adjust launch power.
- **Space:** launch using the current keyboard aim.
- **Escape:** cancel an aim.
- **R:** reset the level.
- **M:** toggle synthesized sound effects.

Pop every pig before running out of birds. Wood, stone, and pigs award 100,
200, and 1,000 points respectively. On a win, each unused bird adds 500 points.
Clear the level for one star; each level has its own two- and three-star thresholds.

The game opens on a separate level selection page. Choose any of the five
levels to enter a playfield that fills the browser window. Open **Settings →
Choose a level** during play to pick another adventure. **Back to game** returns
to the current shot without resetting it.

After a win, select **Next
level** to continue or **Replay** to improve your score. The final level offers
a return to level 1. Reset always restarts the current level.

| Level | Layout | Birds | Targets | Two / three stars |
| --- | --- | ---: | ---: | ---: |
| Greenwood Grove | Three-story wooden tower | 4 | 3 | 4,000 / 5,000 |
| Twin Timber | Two separate towers | 6 | 4 | 5,000 / 6,500 |
| Willow Bridge | Long bridge with three supports | 6 | 4 | 5,000 / 6,500 |
| Skyline Stack | Tall stack with two outposts | 6 | 4 | 5,000 / 6,500 |
| Stonewall Keep | Wide fortress with stone footings | 7 | 5 | 6,500 / 8,000 |

Each level's personal best and earned stars are saved in browser storage when
available. The original storage keys are retained, including the legacy best
score for Greenwood Grove. Storage belongs to the browser origin: scores saved
under `file://` or a different port are not automatically available at localhost.
Sound starts muted.
Settings, How to play, and the level selection page pause gameplay; switching
tabs also pauses the game. The `#levels` and `#play/<level-id>` URL fragments
support direct navigation and reopening the selected level after a reload.

## Pig damage

- **Impacts and falls:** damage follows the closing speed at the contact point,
  including a rotating beam's tip. Heavier objects hit harder.
- **Crushing:** a beam or pile of rubble can keep dealing damage after it stops
  moving. Weight transmitted through stacked blocks counts, too.
- **Squeezing:** opposing contact forces or a deep pinch between solid objects
  deal continuous damage.
- **Feedback:** pressured pigs squash along the force direction, squint, and
  show their remaining health. Crushing and squeezing have distinct pop labels.

Normal standing, light debris, tangential sliding, and brief contact do not
cause pressure damage. Removing the load stops it. The game lets active
crushing finish before declaring a loss after the last bird.

## Files

- `src/app/` — App Router entry point, metadata, and Tailwind theme.
- `src/components/game/` — React level selection, playfield, HUD, and dialogs.
- `src/components/ui/` — shadcn/ui Button, Card, and Radix-based Dialog.
- `src/lib/game/levels.js` — layouts, scoring thresholds, and scene palettes.
- `src/lib/game/pig-damage.js` — independent contact-based damage controller.
- `src/lib/game/engine.js` — physics, pointer/keyboard input, scoring, audio,
  Canvas drawing, and a state subscription for React. Its `dispose()` method
  removes events, observers, animation frames, and audio on unmount.
- `components.json` — shadcn/ui configuration; add components with
  `npx shadcn@latest add <component>`.
- `qa/` — physics and Playwright regression checks.

The physics simulation runs at 120 steps per second, independent of the
display refresh rate. The aim preview uses the same gravity and air resistance
as the projectile. It is capped at 280 world pixels (about ten fading dots);
the previous shot's trail is hidden while aiming. Blocks take damage from impact
speed. Pig damage additionally uses contact-point velocity, opposing solver
impulses, and persistent compression, with thresholds and a short contact grace.

All scenery and characters are drawn with Canvas. All sounds are synthesized
with Web Audio. No external image, font, or audio resources are required.

Run `npm run lint`, `npm run typecheck`, `npm test`, and `npm run test:e2e`.
Browser dependencies and verified scenarios are documented in
[`qa/README.md`](qa/README.md). New verification screenshots are saved outside
the project in the temporary `slingshot-qa-artifacts` directory; set
`QA_ARTIFACTS` to choose another location. Earlier screenshots are in `qa/artifacts/`.
