# ROLLSCAPE – content pass 3

New files: `features.js` (all new logic), `draw_extra.js` (the new look + drawing for new content). Both are already in `index.html`. All numbers are in `config.js` (bottom of the file: `BEACON`, `VERTICAL`, `ALTAR`, `TAR`, `CURSES.subZero` ... `CURSES.ak47`).
Replaced in `draw.js` (removed there, rewritten in `draw_extra.js`): `everything, world, tesseract, block, blockWarning, spike, spikeWarning, finish, enemies, hud, player`.

## Level
- **Beacon of light** replaces the Finish flag. It hovers above the spawn piece's platform and opens when all red tesseracts are collected. Touch the orb to win. An arrow at the screen edge points to it.
- **Collapse now leaves only the spawn piece** (`COLLAPSE_MAP_FRACTION` 0.5 -> 1, and the old finish piece is no longer protected).
- **Verticality**: each piece has a `VERTICAL.platformChance` of getting a high platform with 1-2 tesseracts (placed first, so they tend to be gold) plus a mint **jump pad** on the ground nearby. Pads solve their launch speed from their own height, so they work under any gravity.
- **Altars** (1-2 per level from level 4, interact with **F**): short pillars with a symbol. Single use.
  - *Chance*: one roll. A buff (free blessing / gold / 8s shield), a nerf (portals / a 1-round temporary curse / lose gold) or a level change (gravity up/down, faster collapse, enemies slower/faster).
  - *Duality*: pick 1 of 3 buff + nerf pairs that last the run (Glass Cannon, Machine Spirit = free Matrix, Rocket Heart = free Jet Boots, Hoarder's Bargain, Featherfall).
  - *Greed*: gold tesseracts x2 this level, 7 portals of enemies.
  - *Curses*: take a temporary (+10 gold) or Greater (+25 gold) curse.

## Domino
It now flies through terrain. If you stand on something it lands on that surface (or the first surface under the spot it aimed at, so a high offset past a platform edge drops it to the ground). If you are airborne it ignores platforms and falls to the bottom. A magenta ring on the landing surface shows where. If it comes down inside terrain it stands there without solid collision until its next leap.

## Curses
Curses now have a kind: permanent, **temporary** (counts down once per completed level) and **Greater** (rare card, 20% chance for one slot; permanent, no stacking). HUD: temporary shows rounds left, Greater has a diamond.
- **Sub-Zero** (permanent, *replaces Rough Edging*): 3 frozen 5-column chunks; friction 0.994, acceleration x0.3.
- **Adware** (3 rounds): popup ads over the game offering a blessing. BUY actually buys it; X unlocks after 1.8s; a failed buy moves the ad.
- **Diamond Cuboid** (2 rounds): when the map starts collapsing, a cuboid (an existing one if there is one) grows huge and is the beacon. It flees, and comes home once only the spawn piece is left. Touch it to win.
- **Moldy Aura** (2 rounds): rolling sometimes molds the block under you. Mold grows and buds without a core while the curse is active.
- **Heartbreaker** (Greater): 15s timer, +4s per tesseract, capped at 20s. At zero you explode.
- **AK-47** (Greater): replaces weapon and ability. Click = one 7-damage shot (not automatic). E throws it; it flies, comes back, and smacks you a little.
- **Tar** (Greater): a tar clock spawns a cog every 10s. Miss 2 and it wakes and chases you (flying, speeds up). Collect 3 cogs to put it back to sleep; while awake cogs spawn every 5s.

## Look
Gradient void with parallax monoliths, lit rock with bright top lips and cracks, glowing spikes, spinning glowing tesseracts, a shaded player with trail, per-enemy glow, drone/drill/cuboid/ball details, spark bursts and screen shake on explosions, vignette, and a panel-based HUD (ammo, reload bar, curses with kinds).

## Under the hood
`Game.mods` (run-wide) and `Game.levelMods` (this level) hold gravity, damage, enemy speed/cooldown, gold and collapse multipliers. Altars write to them; player/enemy/level code reads them.

## Interpretation notes
- "Beacon above the platform": placed above the spawn piece's raised platform (3 tiles up), so you jump up to it.
- "Level 4" = the 4th level (index 3), set by `ALTAR.firstLevel`.

---

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
