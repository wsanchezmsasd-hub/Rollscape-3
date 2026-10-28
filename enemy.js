/* =====================================================================
   enemy.js -- ENEMY ROSTER, SPAWNING, THE UPDATE LOOP, DAMAGE AND HIT TESTS.

   The newer enemies live next door so this file stays readable:
     js/enemy_extra.js  Rocket, explosions, Dimensional variants, Dimensional Rift
     js/mold.js         Mold colony, spore plants, mold rollers, Dimensional Mold

   Roster ids: a plain id ("drone") is the normal enemy. A Dimensional
   variant is the same id with a "dim_" prefix ("dim_drone"). Enemy.types
   is the roster for this run; picking the same id again "stacks" it.
   ===================================================================== */
function enemySeconds(frames) { return Math.round(frames / 60 * 100) / 100; }

var Enemy = {
  type: null, types: [], enemies: [], bullets: [], explosions: [], portals: [], history: [], frame: 0,
  choices: [
    { type: "cuboid", name: "Cuboid", description: "Two large, slippery cubes follow you and are knocked back by damage." },
    { type: "drone", name: "Drone", description: "25 HP. Respawns after 3.5 seconds and fires short, slow bursts." },
    { type: "drill", name: "Drill", description: "45 HP. Respawns after 2 seconds, then locks on and dashes." },
    { type: "greenBall4", name: "Green ball 4", description: "Two 15 HP balls respawn after 1.25 seconds and leap toward you." },
    { type: "domino", name: "Domino", description: "An unkillable giant slab. Crouches, leaps high, and slams down near you. Only the landing itself (" + CONFIG.DOMINO_LETHAL_FRAMES + " frames) is deadly." },
    { type: "ase", name: "ASE", description: "All Seeing Eye. 30 HP. Drifts toward you slowly, then teleports far ahead of the direction you are moving." },
    { type: "roller", name: "Roller", description: "Unkillable. Copies your exact path " + enemySeconds(CONFIG.ROLLER_BASE_DELAY_FRAMES) + " seconds behind you and kills on contact. Each extra Roller trails " + enemySeconds(CONFIG.ROLLER_STACK_DELAY_FRAMES) + " seconds further back." },
    { type: "rocket", name: "Rocket", description: "Unkillable. A warning appears above you, then a missile drops and detonates in a circle. Get out from under it." },
    { type: "mold", name: "Mold", description: "A colony seeds the floor and slowly creeps over the map, growing 1 HP spore plants and 5 HP hopping rollers. Destroy the terrain it grows on to cut it back." }
  ]
};

// Superbuffed versions. Offered on the 3rd stack of an enemy, or as a rare card.
Enemy.dimInfo = {
  cuboid:     { name: "Dimensional Cuboid",     description: "One huge cube that spits tiny clones. Clones chase you, then fuse back together like agar.io. Shoot them before they re-merge." },
  drone:      { name: "Dimensional Drone",      description: "Sized up. Fires 2 rockets with a small blast, and sometimes a long-range laser that slowly turns toward you. Keep moving the same way." },
  drill:      { name: "Dimensional Drill",      description: "Bigger and tougher. Chains 3 dashes in a row, re-aiming every time." },
  greenBall4: { name: "Dimensional Green ball 4", description: "Giant, quick-hopping balls. Every hard landing cracks a small shockwave." },
  domino:     { name: "Dimensional Domino",     description: "Chains 3 slams back to back with a wider shockwave. Each landing is still only deadly for a moment." },
  ase:        { name: "Dimensional ASE",        description: "Sized up. Teleports twice as often and blasts a ring of shots every time it arrives." },
  roller:     { name: "Dimensional Roller",     description: "Unkillable. Keeps re-timing its delay (never under 0.6s) to cut you off along your own path." },
  rocket:     { name: "Dimensional Rocket",     description: "A carpet-bombing salvo of 4 staggered missiles with bigger blasts." },
  mold:       { name: "Dimensional Mold",       description: "Spreads faster and also grows slightly weaker mold versions of every basic enemy." }
};

// ---------------------------------------------------------------- helpers
Enemy.clamp = function (v, lo, hi) { return Math.max(lo, Math.min(hi, v)); };
Enemy.pcx = function () { return Player.x + CONFIG.PLAYER_SIZE / 2; };
Enemy.pcy = function () { return Player.y + CONFIG.PLAYER_SIZE / 2; };
Enemy.count = function (test) { var n = 0; for (var i = 0; i < Enemy.enemies.length; i++) if (!Enemy.enemies[i].remove && test(Enemy.enemies[i])) n++; return n; };
Enemy.isDimId = function (id) { return typeof id === "string" && id.indexOf("dim_") === 0; };
Enemy.dimId = function (base) { return "dim_" + base; };
Enemy.baseOf = function (id) { var base = Enemy.isDimId(id) ? id.slice(4) : id; if (base === "cuobid") return "cuboid"; if (base === "evilSpike") return "drill"; return base; };
Enemy.isType = function (type, wanted) { return type === wanted || (wanted === "cuboid" && type === "cuobid") || (wanted === "drill" && type === "evilSpike"); };
Enemy.stackCount = function (base) { return Enemy.types.filter(function (id) { return Enemy.baseOf(id) === base; }).length; };
Enemy.angleDiff = function (to, from) { var d = to - from; while (d > Math.PI) d -= Math.PI * 2; while (d < -Math.PI) d += Math.PI * 2; return d; };

Enemy.resetRoster = function () { Enemy.types = []; Enemy.type = null; };
Enemy.reset = function (type, resetRoster) {
  if (resetRoster) Enemy.resetRoster();
  if (type) Enemy.types.push(type);
  Enemy.type = Enemy.types.length === 1 ? Enemy.types[0] : (Enemy.types.length ? "mixed" : null);
  Enemy.enemies = []; Enemy.bullets = []; Enemy.explosions = []; Enemy.portals = []; Enemy.history = []; Enemy.frame = 0;
  Mold.reset();
  for (var t = 0; t < Enemy.types.length; t++) Enemy.spawnRosterEntry(Enemy.types[t]);
};
Enemy.spawnRosterEntry = function (id) {
  var base = Enemy.baseOf(id), dim = Enemy.isDimId(id), point;
  if (base === "domino") point = Enemy.dominoSpawnPoint(CONFIG.ENEMY_START_DISTANCE);
  else if (base === "mold") point = Mold.seedPoint(CONFIG.ENEMY_START_DISTANCE);
  else point = Enemy.randomSpawnPoint(dim ? 40 : 24, CONFIG.ENEMY_START_DISTANCE);
  Enemy.spawnType(id, point.x, point.y);
};

// The 3 cards shown between levels. A pick that would be your 3rd+ stack of the same enemy, or a lucky roll, is shown as its Dimensional variant.
Enemy.randomChoices = function () {
  var pool = Enemy.choices.slice(), result = [];
  while (result.length < 3 && pool.length) {
    var choice = pool.splice(Math.floor(Math.random() * pool.length), 1)[0];
    var byStacks = Enemy.stackCount(choice.type) >= CONFIG.DIMENSIONAL_STACKS - 1, byLuck = Math.random() < CONFIG.DIMENSIONAL_CHANCE;
    if (byStacks || byLuck) { var info = Enemy.dimInfo[choice.type]; result.push({ type: Enemy.dimId(choice.type), name: info.name, description: info.description, dimensional: true, tag: byStacks ? "3RD STACK" : "RARE" }); }
    else result.push(choice);
  }
  return result;
};

// ---------------------------------------------------------------- spawning
Enemy.randomSpawnPoint = function (radius, distance) {
  var spawnDistance = distance == null ? CONFIG.ENEMY_START_DISTANCE : distance;
  var point = {
    x: Math.max(radius, Math.min(Level.pixelWidth() - radius, Player.x + spawnDistance)),
    y: Math.max(radius, Math.min(CONFIG.CANVAS_H - radius, Player.y - CONFIG.ENEMY_SPAWN_HEIGHT))
  };
  for (var attempt = 0; attempt < 20; attempt++) {
    var x = Math.max(radius, Math.min(Level.pixelWidth() - radius, point.x + (Math.random() - 0.5) * radius * 4)),
      y = Math.max(radius, Math.min(CONFIG.CANVAS_H - radius, point.y + (Math.random() - 0.5) * radius * 4));
    if (!Collide.hitsSolid(x - radius, y - radius, radius * 2, radius * 2)) return { x: x, y: y };
  }
  return point;
};
Enemy.dominoSpawnAt = function (rawTargetX) {
  var bounds = Enemy.dominoBounds({ angle: 0 });
  var minX = bounds.halfWidth, maxX = Level.pixelWidth() - bounds.halfWidth;
  var targetX = Math.max(minX, Math.min(maxX, rawTargetX));
  var spawnY = bounds.halfHeight, bestX = null, bestDistance = Infinity;
  for (var x = minX; x <= maxX; x += CONFIG.TILE / 2) {
    if (!Collide.hitsSolid(x - bounds.halfWidth, spawnY - bounds.halfHeight, bounds.halfWidth * 2, bounds.halfHeight * 2)) {
      var distanceFromTarget = Math.abs(x - targetX);
      if (distanceFromTarget < bestDistance) { bestX = x; bestDistance = distanceFromTarget; }
    }
  }
  return bestX === null ? { x: targetX, y: -bounds.halfHeight } : { x: bestX, y: spawnY };
};
Enemy.dominoSpawnPoint = function (distance) { return Enemy.dominoSpawnAt(Player.x + distance); };

// radius / hp / respawn time for each enemy (normal or Dimensional)
Enemy.statsFor = function (base, dim) {
  var C = CONFIG, D = C.DIM;
  switch (base) {
    case "drone": return dim ? { radius: C.CUOBID_SIZE / 2 * D.drone.scale, hp: D.drone.hp, respawn: D.drone.respawn } : { radius: C.CUOBID_SIZE / 2, hp: C.ENEMY_HP.drone, respawn: C.ENEMY_RESPAWN_FRAMES.drone };
    case "drill": return dim ? { radius: D.drill.radius, hp: D.drill.hp, respawn: D.drill.respawn } : { radius: C.EVIL_SPIKE_SIZE / 2, hp: C.ENEMY_HP.drill, respawn: C.ENEMY_RESPAWN_FRAMES.drill };
    case "greenBall4": return dim ? { radius: D.green.radius, hp: D.green.hp, respawn: D.green.respawn } : { radius: C.GREEN_BALL_SIZE / 2, hp: C.ENEMY_HP.greenBall4, respawn: C.ENEMY_RESPAWN_FRAMES.greenBall4 };
    case "ase": return dim ? { radius: D.ase.radius, hp: D.ase.hp, respawn: D.ase.respawn } : { radius: C.ASE_RADIUS, hp: C.ENEMY_HP.ase, respawn: C.ENEMY_RESPAWN_FRAMES.ase };
    case "domino": return { radius: C.DOMINO_HEIGHT / 2, hp: Infinity, respawn: 0 };
    case "roller": return { radius: dim ? D.roller.radius : C.ROLLER_RADIUS, hp: Infinity, respawn: 0 };
    case "rocket": return { radius: 10, hp: Infinity, respawn: 0 };
    default: return { radius: C.CUOBID_SIZE / 2, hp: Infinity, respawn: 0 }; // cuboid
  }
};

// extra (optional): { single, rift, noRespawn, moldVariant, spd, cd, warn, rad, windup, hpMult, delayBonus }
// single = one unit instead of the usual group. Returns the enemies it created.
Enemy.spawnType = function (id, x, y, extra) {
  var base = Enemy.baseOf(id), dim = Enemy.isDimId(id), C = CONFIG, s = Enemy.statsFor(base, dim), start = Enemy.enemies.length, single = !!(extra && extra.single), i, e;
  var flags = { dim: dim };
  if (base === "greenBall4") {
    for (i = 0; i < (single ? 1 : C.GREEN_BALL_COUNT); i++) Enemy.enemies.push(Enemy.makeEnemy("greenBall4", x + i * C.GREEN_BALL_SPAWN_X_SPACING * (dim ? 2 : 1), y - i * C.GREEN_BALL_SPAWN_Y_SPACING, s.radius, s.hp, s.respawn, flags));
  } else if (base === "cuboid") {
    if (dim) Enemy.enemies.push(Enemy.makeDimCuboid(x, y));
    else for (i = 0; i < (single ? 1 : C.CUOBID_GROUP_SIZE); i++) Enemy.enemies.push(Enemy.makeEnemy("cuboid", x + i * C.CUOBID_SPAWN_SPACING, y + (Math.random() * C.CUBOID_SPAWN_Y_RANGE - C.CUBOID_SPAWN_Y_RANGE / 2), s.radius, Infinity, 0, flags));
  } else if (base === "ase") {
    Enemy.enemies.push(Enemy.makeEnemy("ase", x, y, s.radius, s.hp, s.respawn, flags));
  } else if (base === "roller") {
    var rollerIndex = Enemy.count(function (en) { return en.type === "roller" && !en.dim && !en.moldVariant; });
    var roller = Enemy.makeEnemy("roller", x, y, s.radius, Infinity, 0, flags);
    if (dim) { roller.delayFrames = C.DIM.roller.baseDelay; roller.maxDelay = C.DIM.roller.maxDelay; roller.targetDelay = roller.delayFrames; roller.retarget = 0; }
    else roller.delayFrames = C.ROLLER_BASE_DELAY_FRAMES + rollerIndex * C.ROLLER_STACK_DELAY_FRAMES;
    roller.dormant = true;
    Enemy.enemies.push(roller);
  } else if (base === "mold") {
    Mold.makeCore(x, y, dim);
  } else if (base === "rocket") {
    Enemy.enemies.push(Enemy.makeEnemy("rocket", x, 16, s.radius, Infinity, 0, { dim: dim, noBody: true, noHit: true }));
  } else if (base === "domino") {
    Enemy.enemies.push(Enemy.makeEnemy("domino", x, y, s.radius, Infinity, 0, flags));
  } else { // drone / drill
    for (i = 0; i < (single ? 1 : (base === "drone" ? C.DRONE_COUNT : 1)); i++) Enemy.enemies.push(Enemy.makeEnemy(base, x + i * 70, y - i * 45, s.radius, s.hp, s.respawn, flags));
  }
  var made = Enemy.enemies.slice(start);
  if (extra) for (i = 0; i < made.length; i++) Enemy.applyExtra(made[i], extra);
  return made;
};
Enemy.applyExtra = function (e, extra) {
  for (var k in extra) { if (k === "single" || k === "hpMult" || k === "delayBonus") continue; e[k] = extra[k]; }
  if (extra.hpMult && e.hp !== Infinity) { e.hp = Math.max(1, Math.ceil(e.hp * extra.hpMult)); e.maxHp = e.hp; }
  if (extra.delayBonus && e.type === "roller") e.delayFrames += extra.delayBonus;
};
Enemy.makeEnemy = function (type, x, y, radius, hp, respawnFrames, opts) {
  var e = { type: type, x: x, y: y, spawnX: x, spawnY: y, vx: 0, vy: 0, state: "windup", timer: 0, shotTimer: 0, burstShots: 0, fireTimer: 0, radius: radius, angle: 0, targetAngle: 0, hp: hp, maxHp: hp, respawnFrames: respawnFrames, deadTimer: 0, jumpTimer: CONFIG.GREEN_BALL_JUMP_INTERVAL, grounded: false, combined: false, windup: CONFIG.ENEMY_WINDUP_FRAMES,
    spd: 1, cd: 1, warn: 1, rad: 1, dim: false }; // spd/cd/warn/rad = speed, cooldown, warning-time and blast-radius multipliers (mold versions are nerfed through these)
  if (opts) for (var k in opts) e[k] = opts[k];
  return e;
};

// ---------------------------------------------------------------- the loop
Enemy.update = function () {
  Enemy.frame++;
  Enemy.recordPlayer();
  Enemy.updatePortals();
  Enemy.updateExplosions();
  for (var i = 0; i < Enemy.enemies.length; i++) {
    var e = Enemy.enemies[i];
    if (e.remove) continue;
    if (e.deadTimer > 0) { e.deadTimer--; if (e.deadTimer === 0) Enemy.respawn(e); continue; }
    if (e.state === "windup") {
      e.windup--;
      if (e.growTotal) Enemy.growStep(e);
      if (e.windup > 0) continue;
      e.state = "approach";
    }
    Enemy.updateOne(e);
  }
  Enemy.sweep();
  if (Game.curseCount("unknownDimension") > 0 && CONFIG.CURSES.unknownDimension.allowCuboidMerge) Enemy.tryCombineCuboids();
  Enemy.updateBullets();
};
Enemy.updateOne = function (e) {
  switch (e.type) {
    case "cuboid": if (e.dim) Enemy.updateDimCuboid(e); else Enemy.updateCuboid(e); break;
    case "drone": if (e.dim) Enemy.updateDimDrone(e); else Enemy.updateDrone(e); break;
    case "drill": Enemy.updateDrill(e); break;
    case "greenBall4": Enemy.updateGreenBall(e); break;
    case "domino": Enemy.updateDomino(e); break;
    case "ase": Enemy.updateAse(e); break;
    case "roller": Enemy.updateRoller(e); break;
    case "rocket": Enemy.updateRocket(e); break;
    case "mold": Mold.updateCore(e); break;
    case "moldPlant": Mold.updatePlant(e); break;
  }
};
Enemy.sweep = function () {
  var any = false, i;
  for (i = 0; i < Enemy.enemies.length; i++) if (Enemy.enemies[i].remove) { any = true; break; }
  if (any) Enemy.enemies = Enemy.enemies.filter(function (e) { return !e.remove; });
};
// Things that bud out of mold start tiny and grow while they are "winding up" (harmless).
Enemy.growStep = function (e) {
  var f = 1 - Math.max(0, e.windup) / e.growTotal;
  e.radius = Math.max(3, e.fullRadius * (0.25 + 0.75 * f));
};
Enemy.kill = function (e) {
  e.hp = Math.min(e.hp, 0);
  if (e.noRespawn || !(e.respawnFrames > 0)) e.remove = true; else e.deadTimer = e.respawnFrames;
};
Enemy.respawn = function (e) {
  if (e.type === "mold") { Mold.respawnCore(e); return; }
  var point = e.type === "domino" ? Enemy.dominoSpawnPoint(CONFIG.ENEMY_RESPAWN_DISTANCE) : Enemy.randomSpawnPoint(e.radius, CONFIG.ENEMY_RESPAWN_DISTANCE);
  e.hp = e.maxHp; e.x = point.x; e.y = point.y; e.spawnX = e.x; e.spawnY = e.y; e.vx = 0; e.vy = 0;
  e.state = "windup"; e.timer = 0; e.grounded = false; e.windup = CONFIG.ENEMY_WINDUP_FRAMES;
  Enemy.clearState(e);
};
// A respawned enemy must not remember what it was doing when it died.
Enemy.clearState = function (e) {
  ["aseState", "aseTimer", "destX", "destY", "aseWarnTotal", "offsetX", "offsetY", "dashCount", "doubleDashUsed", "laser", "laserCd", "rState", "rTimer", "targets", "leapState", "leapTimer", "slamsLeft", "moldTimer", "growTimer", "budTimer"].forEach(function (key) { delete e[key]; });
  e.burstShots = 0; e.aimTimer = 0; e.shotTimer = 0; e.fireTimer = 0;
};

// ---------------------------------------------------------------- Domino
Enemy.dominoPause = function (e) { return Math.max(1, Math.round(CONFIG.DOMINO_GROUND_PAUSE_FRAMES * (e.cd || 1) * (Game.hasCurse("slamDunk") ? CONFIG.CURSES.slamDunk.pauseMultiplier : 1))); };
Enemy.dominoShockRadius = function (e) { return (e.dim ? CONFIG.DIM.domino.shockwaveRadius : CONFIG.DOMINO_SHOCKWAVE_RADIUS) * (e.rad || 1); };
Enemy.dominoShockForce = function (e) { return (e.dim ? CONFIG.DIM.domino.shockwaveForce : CONFIG.DOMINO_SHOCKWAVE_FORCE) * (e.rad || 1); };
Enemy.dominoStartCrouch = function (e, frames) {
  e.leapState = "crouch"; e.crouchTotal = frames; e.leapTimer = frames;
  // Slam Dunk: no random landing offset -- it aims straight at you.
  e.leapOffset = Game.hasCurse("slamDunk") ? 0 : (Math.random() * 2 - 1) * CONFIG.DOMINO_LEAP_RANGE;
};
Enemy.updateDomino = function (e) {
  if (e.leapState === undefined) { e.leapState = "grounded"; e.leapTimer = Enemy.dominoPause(e); e.squash = 0; e.slamsLeft = 0; }
  var halfW = CONFIG.DOMINO_WIDTH / 2, halfH = CONFIG.DOMINO_HEIGHT / 2;
  e.vy += CONFIG.GRAVITY;
  if (e.vy > CONFIG.MAX_FALL) e.vy = CONFIG.MAX_FALL;
  var nextY = e.y + e.vy;
  if (Collide.hitsSolid(e.x - halfW, nextY - halfH, CONFIG.DOMINO_WIDTH, CONFIG.DOMINO_HEIGHT)) {
    if (e.vy > 0) { e.y = Math.floor((nextY + halfH) / CONFIG.TILE) * CONFIG.TILE - halfH; if (e.leapState === "airborne") Enemy.dominoLand(e); }
    else if (e.vy < 0) { e.y = (Math.floor((nextY - halfH) / CONFIG.TILE) + 1) * CONFIG.TILE + halfH; }
    e.vy = 0;
  } else { e.y = nextY; }
  if (!Collide.hitsSolid(e.x - halfW + e.vx, e.y - halfH, CONFIG.DOMINO_WIDTH, CONFIG.DOMINO_HEIGHT)) e.x += e.vx; else e.vx = 0;
  // Probe 1px below so "grounded" is steady (resting gravity otherwise flickers it every other frame).
  e.grounded = Collide.hitsSolid(e.x - halfW, e.y - halfH + 1, CONFIG.DOMINO_WIDTH, CONFIG.DOMINO_HEIGHT);

  if (e.leapState === "grounded") {
    e.squash *= 0.8; e.angle *= 0.8;
    if (e.grounded) {
      e.leapTimer--;
      if (e.leapTimer <= 0) { Enemy.dominoStartCrouch(e, CONFIG.DOMINO_TELEGRAPH_FRAMES); e.slamsLeft = e.dim ? CONFIG.DIM.domino.slams - 1 : 0; }
    }
  } else if (e.leapState === "crouch") {
    e.squash = 1 - e.leapTimer / e.crouchTotal; e.leapTimer--;
    // The landing spot follows you during the crouch (shown as a dashed line), then locks when it leaps.
    e.targetX = Math.max(halfW, Math.min(Level.pixelWidth() - halfW, Enemy.pcx() + (e.leapOffset || 0)));
    if (e.leapTimer <= 0) {
      // Launch speed derived from the desired apex so DOMINO_JUMP_HEIGHT actually means "high".
      var jumpSpeed = Math.sqrt(2 * CONFIG.GRAVITY * CONFIG.DOMINO_JUMP_HEIGHT);
      var airFrames = Math.max(1, Math.round(2 * jumpSpeed / CONFIG.GRAVITY));
      e.vx = (e.targetX - e.x) / airFrames; e.vy = -jumpSpeed; e.grounded = false; e.leapState = "airborne"; e.squash = 0;
    }
  } else if (e.leapState === "airborne") {
    e.angle = Math.atan2(e.vy, e.vx) * 0.25;
    e.squash = -Math.min(1, Math.abs(e.vy) / 12) * 0.3;
    if (Game.hasCurse("slamDunk")) { // always aiming for you: keeps steering toward where you are right now
      var sd = CONFIG.CURSES.slamDunk, aim = Enemy.clamp(Enemy.pcx(), halfW, Level.pixelWidth() - halfW);
      e.vx = Enemy.clamp(e.vx + Enemy.clamp((aim - e.x) * 0.01 - e.vx * 0.06, -sd.steer, sd.steer), -sd.maxAirSpeed, sd.maxAirSpeed);
      e.targetX = aim;
    }
  } else if (e.leapState === "landed") {
    e.squash = e.leapTimer / CONFIG.DOMINO_SHOCKWAVE_LIFE; e.leapTimer--;
    if (e.leapTimer <= 0) {
      e.vx = 0; e.squash = 0;
      if (e.slamsLeft > 0) { e.slamsLeft--; Enemy.dominoStartCrouch(e, CONFIG.DIM.domino.quickTelegraph); } // Dimensional: straight into the next slam
      else { e.leapState = "grounded"; e.leapTimer = Enemy.dominoPause(e); }
    }
  }
};
Enemy.dominoLand = function (e) {
  e.leapState = "landed"; e.leapTimer = CONFIG.DOMINO_SHOCKWAVE_LIFE; e.vx = 0; e.angle = 0;
  var px = Enemy.pcx(), py = Enemy.pcy(), radius = Enemy.dominoShockRadius(e), forceMax = Enemy.dominoShockForce(e);
  var dx = px - e.x, dy = py - e.y, distance = Math.hypot(dx, dy) || 1;
  if (distance < radius) {
    var force = forceMax * (1 - distance / radius);
    Player.vx += dx / distance * force;
    Player.vy += dy / distance * force - force * 0.35;
  }
};
// Only lethal for the first CONFIG.DOMINO_LETHAL_FRAMES frames after it lands (frame 1 is the first update after impact).
// Optionally (CONFIG.DOMINO_AIRBORNE_LETHAL) also while it is falling.
Enemy.dominoCrushesPlayer = function (e) {
  var framesSinceLanding = CONFIG.DOMINO_SHOCKWAVE_LIFE - e.leapTimer;
  var justLanded = e.leapState === "landed" && framesSinceLanding >= 1 && framesSinceLanding <= CONFIG.DOMINO_LETHAL_FRAMES;
  var fallingLethal = CONFIG.DOMINO_AIRBORNE_LETHAL && e.leapState === "airborne" && e.vy >= 0;
  if (!justLanded && !fallingLethal) return false;
  var halfW = CONFIG.DOMINO_WIDTH / 2, halfH = CONFIG.DOMINO_HEIGHT / 2;
  var overlapX = Math.abs(Enemy.pcx() - e.x) < halfW + CONFIG.PLAYER_SIZE / 2;
  var overlapY = Math.abs(Enemy.pcy() - e.y) < halfH + CONFIG.PLAYER_SIZE / 2;
  return overlapX && overlapY;
};
Enemy.dominoBounds = function (e) {
  var cos = Math.abs(Math.cos(e.angle || 0)), sin = Math.abs(Math.sin(e.angle || 0));
  return { halfWidth: cos * CONFIG.DOMINO_WIDTH / 2 + sin * CONFIG.DOMINO_HEIGHT / 2, halfHeight: sin * CONFIG.DOMINO_WIDTH / 2 + cos * CONFIG.DOMINO_HEIGHT / 2 };
};
// Bullets/slashes test against the slab's real rectangle, not a 75px circle.
Enemy.dominoOverlapsCircle = function (e, x, y, r) {
  var a = e.angle || 0, cos = Math.cos(a), sin = Math.sin(a), dx = x - e.x, dy = y - e.y;
  var lx = dx * cos + dy * sin, ly = -dx * sin + dy * cos;
  var nx = Math.max(-CONFIG.DOMINO_WIDTH / 2, Math.min(CONFIG.DOMINO_WIDTH / 2, lx));
  var ny = Math.max(-CONFIG.DOMINO_HEIGHT / 2, Math.min(CONFIG.DOMINO_HEIGHT / 2, ly));
  return (lx - nx) * (lx - nx) + (ly - ny) * (ly - ny) < r * r;
};

// ---------------------------------------------------------------- Cuboid
// Unknown Dimension curse: the original pair of cuboids can merge. (Dimensional cuboids, clones and mold cuboids never merge this way.)
Enemy.tryCombineCuboids = function () {
  var cuboids = Enemy.enemies.filter(function (e) { return e.type === "cuboid" && !e.combined && !e.dim && !e.moldVariant && !e.rift && !e.remove; });
  if (cuboids.length < CONFIG.CUOBID_GROUP_SIZE) return;
  var cx = 0, cy = 0;
  cuboids.forEach(function (e) { cx += e.x; cy += e.y; });
  cx /= cuboids.length; cy /= cuboids.length;
  if (!cuboids.every(function (e) { return Math.hypot(e.x - cx, e.y - cy) < CONFIG.CUOBID_MERGE_DISTANCE; })) return;
  Enemy.enemies = Enemy.enemies.filter(function (e) { return cuboids.indexOf(e) < 0; });
  Enemy.enemies.push({ type: "cuboid", x: cx, y: cy, vx: 0, vy: 0, radius: CONFIG.CUOBID_SIZE / 2 * Math.sqrt(cuboids.length), angle: 0, combined: true, state: "approach", deadTimer: 0, hp: Infinity, maxHp: Infinity, respawnFrames: 0, spd: 1, cd: 1, warn: 1, rad: 1, dim: false });
};
Enemy.updateCuboid = function (e) {
  var dx = Player.x - e.x, dy = Player.y - e.y, distance = Math.sqrt(dx * dx + dy * dy) || 1, spd = e.spd || 1;
  var speedMultiplier = (e.combined ? CONFIG.CUOBID_COMBINED_SPEED_MULT : 1) * spd;
  var speed = Math.min((e.combined ? CONFIG.CUOBID_COMBINED_MAX_SPEED : CONFIG.CUOBID_MAX_SPEED) * spd, (CONFIG.CUOBID_SPEED + distance * CONFIG.CUOBID_DISTANCE_SPEED) * speedMultiplier);
  e.x += dx / distance * speed + e.vx; e.y += dy / distance * speed + e.vy;
  e.vx *= CONFIG.CUOBID_KNOCKBACK_DECAY; e.vy *= CONFIG.CUOBID_KNOCKBACK_DECAY;
  e.angle += 0.025;
};

// ---------------------------------------------------------------- Drone
Enemy.rollDroneOffset = function (e) {
  e.offsetX = (Math.random() * 2 - 1) * CONFIG.DRONE_OFFSET_X;
  e.offsetY = -CONFIG.DRONE_HEIGHT_ABOVE_PLAYER + (Math.random() * 2 - 1) * CONFIG.DRONE_OFFSET_Y;
};
// Shared by Drone and Dimensional Drone. slow = 1 while cruising, smaller while it is shooting.
Enemy.droneMove = function (e, slow, heightMult) {
  var pcx = Enemy.pcx(), pcy = Enemy.pcy();
  // Aim at where you're GOING, plus this drone's own random offset so several drones spread out.
  var targetX = Math.max(0, Math.min(Level.pixelWidth(), pcx + Player.effVx * CONFIG.DRONE_LEAD_FRAMES + e.offsetX));
  var targetY = Math.max(30, pcy + Player.vy * CONFIG.DRONE_LEAD_FRAMES * 0.25 + e.offsetY * (heightMult || 1));
  var mx = (targetX - e.x) * CONFIG.DRONE_FAST_FOLLOW_RATE * slow, my = (targetY - e.y) * CONFIG.DRONE_FAST_FOLLOW_RATE * slow;
  var mag = Math.hypot(mx, my), cap = CONFIG.DRONE_MAX_SPEED * slow * (e.spd || 1);
  if (mag > cap) { mx *= cap / mag; my *= cap / mag; }
  e.x += mx; e.y += my; // still creeping toward you while shooting, just slowly
};
Enemy.updateDrone = function (e) {
  if (e.offsetX === undefined) Enemy.rollDroneOffset(e);
  e.timer++; if (e.fireTimer > 0) e.fireTimer--; if (e.aimTimer > 0) e.aimTimer--;
  var pcx = Enemy.pcx(), pcy = Enemy.pcy(), firing = e.burstShots > 0 || e.fireTimer > 0;
  Enemy.droneMove(e, firing ? CONFIG.DRONE_FIRE_MOVE_FACTOR : 1, 1);
  e.shotTimer--;
  var slug = Game.hasCurse("shotgunSlug"), cdm = e.cd || 1, spm = e.spd || 1;
  if (e.shotTimer <= 0 && e.burstShots > 0) {
    var dx = pcx - e.x, dy = pcy - e.y, distance = Math.hypot(dx, dy) || 1, bulletSpeed = (slug ? CONFIG.CURSES.shotgunSlug.bulletSpeed : CONFIG.DRONE_BULLET_SPEED) * spm;
    Enemy.bullets.push({ x: e.x, y: e.y, vx: dx / distance * bulletSpeed, vy: dy / distance * bulletSpeed, life: CONFIG.DRONE_BULLET_LIFE, color: e.moldVariant ? "#5cff7a" : null });
    e.burstShots--;
    e.shotTimer = Math.round((slug ? CONFIG.DRONE_BURST_COOLDOWN : (e.burstShots ? CONFIG.DRONE_SHOT_INTERVAL : CONFIG.DRONE_BURST_COOLDOWN)) * cdm);
    if (e.burstShots === 0) Enemy.rollDroneOffset(e); // new position to approach for the next burst
  } else if (e.shotTimer <= 0 && e.burstShots === 0 && Math.hypot(pcx - e.x, pcy - e.y) < CONFIG.DRONE_FIRE_RANGE) {
    var aim = slug ? CONFIG.CURSES.shotgunSlug.aimFrames : CONFIG.DRONE_AIM_FRAMES;
    e.burstShots = slug ? 1 : CONFIG.DRONE_SHOTS; e.fireTimer = Math.max(CONFIG.DRONE_FIRE_TIME, aim); e.shotTimer = aim; e.aimTimer = aim; e.aimTotal = aim;
  }
};

// ---------------------------------------------------------------- ASE
Enemy.aseDirection = function (e) {
  // Horizontal only: remember which way you were last running (+1 right, -1 left).
  if (Math.abs(Player.effVx) > 0.8) e.dirX = Player.effVx > 0 ? 1 : -1;
  if (e.dirX === undefined) e.dirX = 1;
};
Enemy.aseDestination = function (e) {
  var pcx = Enemy.pcx(), pcy = Enemy.pcy(), r = e.radius, W = Level.pixelWidth();
  var sides = [e.dirX, -e.dirX], distances = [1, 0.85, 0.7], heights = [0, -70, 70];
  for (var s = 0; s < sides.length; s++) for (var i = 0; i < distances.length; i++) for (var h = 0; h < heights.length; h++) {
    var x = pcx + sides[s] * CONFIG.ASE_TELEPORT_DISTANCE * distances[i], y = Math.max(r, Math.min(CONFIG.CANVAS_H - r, pcy + heights[h]));
    if (x < r || x > W - r) continue;
    if (Math.abs(x - pcx) < CONFIG.ASE_MIN_DISTANCE) continue;
    if (!Collide.hitsSolid(x - r, y - r, r * 2, r * 2)) return { x: x, y: y };
  }
  // Nothing clean: straight ahead, clamped to the map.
  return { x: Math.max(r, Math.min(W - r, pcx + e.dirX * CONFIG.ASE_TELEPORT_DISTANCE)), y: Math.max(r, Math.min(CONFIG.CANVAS_H - r, pcy)) };
};
Enemy.updateAse = function (e) {
  var pcx = Enemy.pcx(), pcy = Enemy.pcy(), D = CONFIG.DIM.ase;
  var interval = Math.round((e.dim ? D.teleportInterval : CONFIG.ASE_TELEPORT_INTERVAL) * (e.cd || 1));
  Enemy.aseDirection(e);
  if (e.aseState === undefined) { e.aseState = "drift"; e.aseTimer = interval; }
  if (e.aseState === "drift") {
    // Same chase as a Cuboid (faster the farther away you are), just slower.
    var dx = pcx - e.x, dy = pcy - e.y, d = Math.hypot(dx, dy) || 1;
    var speed = Math.min(CONFIG.CUOBID_MAX_SPEED, CONFIG.CUOBID_SPEED + d * CONFIG.CUOBID_DISTANCE_SPEED) * CONFIG.ASE_SPEED_MULT * (e.spd || 1);
    e.x += dx / d * speed; e.y += dy / d * speed;
    e.aseTimer--;
    if (e.aseTimer <= 0) { e.aseWarnTotal = Math.round(CONFIG.ASE_TELEPORT_WARNING * (e.warn || 1)); e.aseState = "warning"; e.aseTimer = e.aseWarnTotal; var first = Enemy.aseDestination(e); e.destX = first.x; e.destY = first.y; }
  } else {
    // The ring tracks the spot ahead of you, then locks for the last 12 frames so you can react.
    if (e.aseTimer > 12) { var dest = Enemy.aseDestination(e); e.destX = dest.x; e.destY = dest.y; }
    e.aseTimer--;
    if (e.aseTimer <= 0) {
      e.x = e.destX; e.y = e.destY; e.aseState = "drift"; e.aseTimer = interval;
      if (e.dim) Enemy.aseBurst(e);
    }
  }
};

// ---------------------------------------------------------------- Roller
Enemy.recordPlayer = function () {
  var maxDelay = 0;
  for (var i = 0; i < Enemy.enemies.length; i++) { var r = Enemy.enemies[i]; if (r.type === "roller" && !r.remove) maxDelay = Math.max(maxDelay, r.maxDelay || r.delayFrames); }
  if (!maxDelay) return;
  Enemy.history.push({ x: Player.x + CONFIG.PLAYER_SIZE / 2, y: Player.y + CONFIG.PLAYER_SIZE / 2, angle: Player.angle });
  while (Enemy.history.length > Math.ceil(maxDelay) + 2) Enemy.history.shift();
};
// Where you were `delay` frames ago (delay can be fractional; the Dimensional Roller slides its delay smoothly).
Enemy.historySample = function (delay) {
  var index = Enemy.history.length - 1 - delay;
  if (index < 0) return null;
  var i0 = Math.floor(index), i1 = Math.min(i0 + 1, Enemy.history.length - 1), f = index - i0, a = Enemy.history[i0], b = Enemy.history[i1];
  return { x: a.x + (b.x - a.x) * f, y: a.y + (b.y - a.y) * f, angle: a.angle + (b.angle - a.angle) * f };
};
Enemy.updateRoller = function (e) {
  if (e.dim) Enemy.dimRollerRetarget(e);
  var sample = Enemy.historySample(e.delayFrames);
  if (!sample) { e.dormant = true; return; } // not enough history yet; harmless until it "arrives"
  e.dormant = false; e.x = sample.x; e.y = sample.y; e.angle = sample.angle;
};

// ---------------------------------------------------------------- Drill
Enemy.updateDrill = function (e) {
  e.timer++;
  var D = CONFIG.DIM.drill, dashSpeed = (e.dim ? D.dashSpeed : CONFIG.EVIL_SPIKE_DASH_SPEED) * (e.spd || 1), dashTime = e.dim ? D.dashTime : CONFIG.EVIL_SPIKE_DASH_TIME;
  var batteryDash = Game.curseCount("batteryLife") > 0 && CONFIG.CURSES.batteryLife.extraDrillDash ? 1 : 0;
  var maxDashes = (e.dim ? D.dashes : 1) + batteryDash; // Battery Life adds one more dash to the chain
  if (e.dashCount === undefined) e.dashCount = 0;
  if (e.state === "approach") {
    var dx = Player.x + CONFIG.PLAYER_SIZE / 2 - e.x, dy = Player.y + CONFIG.PLAYER_SIZE / 2 - e.y;
    e.targetAngle = Math.atan2(dy, dx);
    var turn = e.targetAngle - e.angle;
    while (turn > Math.PI) turn -= Math.PI * 2;
    while (turn < -Math.PI) turn += Math.PI * 2;
    e.angle += turn * CONFIG.DRILL_TURN_RATE;
    if (e.timer > CONFIG.EVIL_SPIKE_WARNING_TIME) {
      e.targetX = Player.x + CONFIG.PLAYER_SIZE / 2;
      e.targetY = Player.y + CONFIG.PLAYER_SIZE / 2;
      e.state = "warning";
      e.timer = 0;
    }
  } else if (e.state === "warning") {
    // 1st dash: the normal warning. Chained dashes of a Dimensional Drill: short warning. Battery Life's extra dash: its own (long) warning.
    var chainFrames = (e.dim && e.dashCount < D.dashes) ? D.chainWarning : CONFIG.CURSES.batteryLife.secondDashWarning;
    var warnFrames = Math.round((e.dashCount === 0 ? CONFIG.DRILL_DASH_DELAY : chainFrames) * (e.warn || 1));
    if (e.timer > warnFrames) {
      var targetDx = e.targetX - e.x, targetDy = e.targetY - e.y, targetDistance = Math.hypot(targetDx, targetDy) || 1;
      e.vx = targetDx / targetDistance * dashSpeed;
      e.vy = targetDy / targetDistance * dashSpeed;
      e.angle = Math.atan2(e.vy, e.vx);
      e.state = "dash";
      e.timer = 0;
    }
  } else if (e.state === "dash") {
    e.x += e.vx;
    e.y += e.vy;
    if (e.timer > dashTime) {
      e.dashCount++;
      if (e.dashCount < maxDashes) { e.state = "warning"; e.timer = 0; e.targetX = Player.x + CONFIG.PLAYER_SIZE / 2; e.targetY = Player.y + CONFIG.PLAYER_SIZE / 2; } // re-aim and go again
      else { e.state = "approach"; e.timer = 0; e.dashCount = 0; }
    }
  }
};

// ---------------------------------------------------------------- Green ball 4 (and mold rollers)
Enemy.updateGreenBall = function (e) {
  var C = CONFIG, G = C.DIM.green, M = C.MOLD, cd = e.cd || 1;
  e.jumpTimer--;
  e.vy += C.GRAVITY;
  var nextY = e.y + e.vy, falling = e.vy > 0, impact = e.vy, wasGrounded = e.grounded;
  if (Collide.hitsSolid(e.x - e.radius, nextY - e.radius, e.radius * 2, e.radius * 2)) {
    if (falling) e.y = Math.floor((nextY + e.radius) / C.TILE) * C.TILE - e.radius;
    else if (e.vy < 0) e.y = (Math.floor((nextY - e.radius) / C.TILE) + 1) * C.TILE + e.radius;
    e.vy = 0;
    e.grounded = falling;
  } else {
    e.y = nextY;
    e.grounded = false;
  }
  // Dimensional: a hard landing cracks a small, short-lived shockwave
  if (e.dim && e.grounded && !wasGrounded && impact >= G.slamMinFall) Enemy.addExplosion(e.x, e.y + e.radius, G.slamRadius * (e.rad || 1), { lethal: G.slamLethalFrames, life: G.slamLife, dim: true });
  if (e.grounded && e.jumpTimer <= 0) {
    if (e.moldRoller) { // mold rollers hop in random directions at random times (with a slight lean toward you)
      var lean = Enemy.pcx() > e.x ? 1.2 : -1.2;
      e.vx = (Math.random() * 2 - 1) * M.rollerJumpSpeed + lean;
      e.vy = -M.rollerBounce * (0.7 + Math.random() * 0.6);
      e.jumpTimer = M.rollerJumpMin + Math.floor(Math.random() * (M.rollerJumpMax - M.rollerJumpMin));
    } else {
      var dx = Enemy.pcx() - e.x, dy = Enemy.pcy() - e.y, distance = Math.sqrt(dx * dx + dy * dy) || 1;
      var jumpSpeed = C.GREEN_BALL_JUMP_SPEED * (e.spd || 1) * (e.dim ? G.jumpSpeedMult : 1), bounce = e.dim ? G.bounce : C.GREEN_BALL_BOUNCE;
      e.vx = dx / distance * jumpSpeed;
      e.vy = dy / distance * jumpSpeed - bounce;
      e.jumpTimer = Math.round((e.dim ? G.jumpInterval : C.GREEN_BALL_JUMP_INTERVAL) * cd);
    }
    e.grounded = false;
  }
  if (!Collide.hitsSolid(e.x - e.radius + e.vx, e.y - e.radius, e.radius * 2, e.radius * 2)) e.x += e.vx; else e.vx = 0;
  e.vx *= 0.96;
  e.angle += e.vx / e.radius;
};

// ---------------------------------------------------------------- bullets
// Plain bullets are just a moving dot. Explosive ones (missiles, rockets) are handled in enemy_extra.js.
Enemy.updateBullets = function () {
  for (var i = Enemy.bullets.length - 1; i >= 0; i--) {
    var b = Enemy.bullets[i];
    if (b.wait > 0) { b.wait--; continue; } // staggered salvo: not launched yet
    b.x += b.vx; b.y += b.vy; b.life--;
    if (b.explosive) { if (Enemy.updateExplosive(b)) Enemy.bullets.splice(i, 1); continue; }
    if (b.reflected && Enemy.damageAt(b.x, b.y, b.damage || 25, 6)) { Enemy.bullets.splice(i, 1); continue; }
    if (b.life <= 0 || Collide.hitsSolid(b.x - 4, b.y - 4, 8, 8)) Enemy.bullets.splice(i, 1);
  }
};

// ---------------------------------------------------------------- damage
Enemy.wear = function () { return Math.pow(CONFIG.CURSES.wearAndTear.damageMultiplier, Game.curseCount("wearAndTear")); };
Enemy.damageAt = function (x, y, damage, reach) {
  for (var i = 0; i < Enemy.enemies.length; i++) {
    var e = Enemy.enemies[i]; if (e.deadTimer > 0 || e.dormant || e.remove || e.noHit) continue;
    var dx = x - e.x, dy = y - e.y, hitReach = (reach || 0) + e.radius;
    if (e.type === "domino" ? Enemy.dominoOverlapsCircle(e, x, y, reach || 0) : dx * dx + dy * dy < hitReach * hitReach) {
      if (e.hp !== Infinity) e.hp -= damage * Enemy.wear();
      if (e.type === "cuboid") { var distance = Math.sqrt(dx * dx + dy * dy) || 1; e.vx -= dx / distance * CONFIG.CUOBID_HIT_KNOCKBACK; e.vy -= dy / distance * CONFIG.CUOBID_HIT_KNOCKBACK; }
      if (e.hp <= 0) Enemy.kill(e);
      return true;
    }
  }
  return false;
};
Enemy.damageRadius = function (x, y, radius, damage) {
  for (var i = 0; i < Enemy.enemies.length; i++) {
    var e = Enemy.enemies[i]; if (e.deadTimer > 0 || e.dormant || e.remove || e.noHit) continue;
    var dx = x - e.x, dy = y - e.y, distance = Math.hypot(dx, dy);
    if (distance < radius + e.radius) {
      if (e.hp !== Infinity) e.hp -= damage * (1 - Math.min(distance / (radius + e.radius), 1) * 0.5) * Enemy.wear();
      var force = CONFIG.BAZOOKA_KNOCKBACK * (1 - Math.min(distance / (radius + e.radius), 1));
      if (distance > 0) { e.vx += -dx / distance * force; e.vy += -dy / distance * force; }
      if (e.hp <= 0) Enemy.kill(e);
    }
  }
};

// ---------------------------------------------------------------- did something hit YOU?
Enemy.hitsPlayer = function () {
  var px = Enemy.pcx(), py = Enemy.pcy(), i;
  for (i = 0; i < Enemy.enemies.length; i++) {
    var e = Enemy.enemies[i];
    if (e.deadTimer > 0 || e.dormant || e.remove || e.state === "windup" || e.type === "drone" || e.noBody) continue; // drones, rockets, mold cores and plants only hurt via what they shoot
    var hit = e.type === "domino" ? Enemy.dominoCrushesPlayer(e) : Math.hypot(px - e.x, py - e.y) < e.radius + CONFIG.PLAYER_SIZE / 2;
    if (hit) {
      if (Weapons.parryBodyHit() || Player.isInvincible()) continue;
      return true;
    }
  }
  for (var j = Enemy.bullets.length - 1; j >= 0; j--) {
    var b = Enemy.bullets[j];
    if (b.explosive || b.wait > 0) continue; // missiles and rockets only hurt through their explosion (below)
    var bx = px - b.x, by = py - b.y;
    if (bx * bx + by * by < 18 * 18) {
      if (Weapons.parryProjectile(b) || Player.isInvincible()) continue;
      if (!b.reflected) return true;
    }
  }
  for (i = 0; i < Enemy.explosions.length; i++) {
    var ex = Enemy.explosions[i];
    if (ex.age < ex.lethal && Math.hypot(px - ex.x, py - ex.y) < ex.r + 8) {
      if (Weapons.parryBodyHit() || Player.isInvincible()) continue;
      return true;
    }
  }
  for (i = 0; i < Enemy.enemies.length; i++) {
    var d = Enemy.enemies[i];
    if (d.laser && d.laser.state === "fire" && d.deadTimer <= 0 && !d.remove && Enemy.laserHitsPlayer(d)) {
      if (Weapons.parryBodyHit() || Player.isInvincible()) continue;
      return true;
    }
  }
  return false;
};
