# Slingshot

A five-level, Angry Birds–inspired browser game with original Canvas artwork.

## Play

Open **`index.html`** in a modern browser. There is no build step, package
installation, CDN request, or internet requirement.

If you prefer a local server, run this from the `slingshot` directory:

```sh
python3 -m http.server 8765
```

Then open <http://localhost:8765>.

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

Choose any of the five levels above the playfield. After a win, select **Next
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
available. The original game's best score is retained for Greenwood Grove.
Sound starts muted.
The How to play dialog pauses gameplay; switching tabs also pauses the game.

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

- `index.html` — page, controls, instructions, and result dialog.
- `styles.css` — responsive layout and interface styling.
- `levels.js` — five layouts, bird counts, scoring thresholds, and scene palettes.
- `pig-damage.js` — impact, fall, load, and squeeze detection using solver contacts.
- `game.js` — fixed-timestep physics, input, scoring, audio, and Canvas drawing.
- `vendor/matter.min.js` — bundled Matter.js 0.20.0 physics engine.
- `vendor/LICENSE-matter.txt` — Matter.js MIT license.

The physics simulation runs at 120 steps per second, independent of the
display refresh rate. The aim preview uses the same gravity and air resistance
as the projectile. It is capped at 280 world pixels (about ten fading dots);
the previous shot's trail is hidden while aiming. Blocks take damage from impact
speed. Pig damage additionally uses contact-point velocity, opposing solver
impulses, and persistent compression, with thresholds and a short contact grace.

All scenery and characters are drawn with Canvas. All sounds are synthesized
with Web Audio. No external image, font, or audio resources are required.

Optional browser checks and verified scenarios are documented in
[`qa/README.md`](qa/README.md). Screenshots are in `qa/artifacts/`.
