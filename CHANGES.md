# ROLLSCAPE – content pass 2

All numbers are in `js/config.js`. New files: `js/enemy_extra.js`, `js/mold.js` (add both to `index.html`, already done). `js/enemy.js` was rewritten in a readable multi-line style; existing enemy behaviour is unchanged except where listed.

## Balance
- Domino only crushes you during the first 5 frames after it lands (`DOMINO_LETHAL_FRAMES`). It is no longer lethal while falling (`DOMINO_AIRBORNE_LETHAL: true` restores that). A thick magenta outline shows the deadly frames.
- Pistol dash invincibility now works against enemy bodies, bullets, explosions and lasers (before, only spikes respected it, despite the README).
- Parry and dash also protect against the new explosions and lasers.

## New enemies
Rocket, Mold (core, spore plants, mold rollers), and a Dimensional variant of all 9 enemies (3rd stack, or 10% rare card).

## New curses
Dimensional Rift (portal, then a random enemy, on every collapse; stacks) and Slam Dunk (Domino has no landing offset, steers in the air, rests 30% less).

## New one-time upgrades
Matrix Tesseract (20 gold) and Jet Boots (30 gold). Shown on the gold screen under the blessings.

## HUD
Jet fuel bar and owned upgrades.

---

# ROLLSCAPE – balance pass

Every number below lives in `js/config.js` (old value noted in a comment next to it), so you can retune freely.

## Curses (all 8 touched)
| Curse | Before | Now |
|---|---|---|
| Rough Edging | 10% slower accel | 5% slower |
| Lower Gravity | gravity x0.5, jump power x0.65 (3+ stacks = jump < 120px, 3-tile ledges impossible on levels 1-2) | gravity x0.6; jump *height* x0.93 per stack, never below 128px |
| Unstable Plain | first collapse after 10 frames, 25 frames of warning, then every 35 frames | 90 frame grace, 60 frames of warning, one piece every 90 frames (gold still x2) |
| Wear and Tear | -25% damage per stack | -15% per stack |
| 5-Cube | killed within 24px of a ~12px fake, drawn dark purple on black | kills within 14px, bright magenta pentagon |
| Shotgun Slug | bullet speed 9, no warning | speed 6.5, 24-frame aim line |
| Battery Life | 2nd dash warned for 24 frames | 48 frames |
| Unknown Dimension | merged Cuboid 1.9x speed (up to 8.5, faster than you) | 1.3x, capped at 5.5 |

## Enemies
- Drill: dash speed 12 -> 10.5, warning line 24 -> 36 frames.
- Domino: shockwave radius 300 -> 230, force 18 -> 12. The landing line now shows during the crouch (it was checking a "warning" state that never happened).
- Drone: dashed aim line for 18 frames before the first shot of every burst.
- Merged Cuboid: see Unknown Dimension.

## Bugs fixed
- `pieces.json`: the `spikes` piece was 11 rows tall, which pushed its floor down a tile.
- Touching a 5-Cube fake while invincible (dash/parry) set a permanent flag that killed you when invincibility ended.
- Respawned drones kept their old burst/aim state; respawned drills kept their double-dash flag.
- `index.html` / `style.css`: Google Fonts URLs were missing `fonts.`/`css2?family=...`, so Audiowide never loaded.
- Roller description said +3s per extra roller; config is +1.5s. Curse and Roller text is now generated from config.
- "Diamond" vs "gold" tesseract naming made consistent; page heading is ROLLSCAPE.

## Added
- HUD: level name, active curses with stack counts, and ability readiness / cooldown (E READY, 2.3s, PARRYING, DASHING).

## Left alone on purpose
- Non-stacking curses (Battery Life, Unknown Dimension, Shotgun Slug, 5-Cube) can be picked again for zero extra cost.
- `js/classes.js` is an old, unused file (index.html never loads it).
