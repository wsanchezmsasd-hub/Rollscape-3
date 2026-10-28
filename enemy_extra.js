/* =====================================================================
   enemy_extra.js -- ROCKET, EXPLOSIONS, DIMENSIONAL VARIANTS, RIFT PORTALS.
   Everything here hangs off the Enemy object defined in enemy.js.
   All numbers live in config.js (ROCKET, DIM, CURSES.dimensionalRift).
   ===================================================================== */

// ---------------------------------------------------------------- explosions
// A circle that is lethal for its first `lethal` frames and then just fades out.
Enemy.addExplosion = function (x, y, r, opts) {
  opts = opts || {};
  Enemy.explosions.push({ x: x, y: y, r: r, age: 0, life: opts.life || 22, lethal: opts.lethal == null ? 6 : opts.lethal, dim: !!opts.dim, mold: !!opts.mold });
};
Enemy.updateExplosions = function () {
  for (var i = Enemy.explosions.length - 1; i >= 0; i--) {
    Enemy.explosions[i].age++;
    if (Enemy.explosions[i].age >= Enemy.explosions[i].life) Enemy.explosions.splice(i, 1);
  }
};
// Missiles and rockets: they detonate on terrain, when they get close to you, or when they run out of life.
// Returns true when the bullet is finished and should be removed.
Enemy.updateExplosive = function (b) {
  if (b.y > CONFIG.CANVAS_H + 80) return true; // fell out of the bottom of the map
  var boom = b.life <= 0 || Collide.hitsSolid(b.x - 4, b.y - 4, 8, 8) || Math.hypot(Enemy.pcx() - b.x, Enemy.pcy() - b.y) < (b.fuse || 24);
  if (!boom) return false;
  Enemy.addExplosion(b.x, b.y, b.blast, { lethal: b.lethal, life: b.blastLife, dim: b.dim, mold: b.mold });
  return true;
};

// ---------------------------------------------------------------- ROCKET
// An unkillable launcher at the top of the screen. It tracks a spot above you (shown as a warning), locks it for the last
// few frames, then a missile falls down that column and explodes where it lands.
Enemy.updateRocket = function (e) {
  var B = CONFIG.ROCKET, D = CONFIG.DIM.rocket, W = Level.pixelWidth();
  var warnFrames = Math.round((e.dim ? D.warningFrames : B.warningFrames) * (e.warn || 1));
  var cooldown = Math.round((e.dim ? D.cooldown : B.cooldown) * (e.cd || 1));
  var lead = e.dim ? D.leadFrames : B.leadFrames;
  if (e.rState === undefined) { e.rState = "idle"; e.rTimer = B.startDelay; e.targets = []; }
  e.y = 16;
  if (e.rState === "idle") {
    e.x = Enemy.clamp(Enemy.pcx(), 20, W - 20);
    e.rTimer--;
    if (e.rTimer <= 0) { e.rState = "warn"; e.rTimer = warnFrames; e.rWarnTotal = warnFrames; Enemy.rocketAim(e, lead); }
  } else {
    e.rTimer--;
    if (e.rTimer > B.lockFrames) Enemy.rocketAim(e, lead); // follows you, then locks for the last lockFrames so you can react
    if (e.rTimer <= 0) { Enemy.rocketFire(e); e.rState = "idle"; e.rTimer = cooldown; e.targets = []; }
  }
};
Enemy.rocketAim = function (e, lead) {
  var W = Level.pixelWidth(), cx = Enemy.pcx() + Player.effVx * lead;
  if (e.dim) {
    var D = CONFIG.DIM.rocket; e.targets = [];
    for (var k = 0; k < D.salvo; k++) e.targets.push(Enemy.clamp(cx + (k - (D.salvo - 1) / 2) * D.spacing, 20, W - 20));
  } else e.targets = [Enemy.clamp(cx, 20, W - 20)];
  e.x = e.targets[0];
};
Enemy.rocketFire = function (e) {
  var B = CONFIG.ROCKET, D = CONFIG.DIM.rocket, radius = (e.dim ? D.blastRadius : B.blastRadius) * (e.rad || 1);
  for (var k = 0; k < e.targets.length; k++) {
    Enemy.bullets.push({ kind: "missile", explosive: true, x: e.targets[k], y: -30, vx: 0, vy: B.missileSpeed, life: B.missileLife, wait: e.dim ? k * D.stagger : 0,
      blast: radius, lethal: B.blastLethalFrames, blastLife: B.blastLife, fuse: 24, dim: !!e.dim, mold: !!e.moldVariant });
  }
};

// ---------------------------------------------------------------- DIMENSIONAL DRONE
// Sized-up drone: bursts of 2 small-blast rockets, and now and then a long laser that turns slowly toward you.
Enemy.updateDimDrone = function (e) {
  var D = CONFIG.DIM.drone;
  if (e.offsetX === undefined) Enemy.rollDroneOffset(e);
  if (e.laserCd === undefined) e.laserCd = D.laserFirstDelay;
  e.timer++; if (e.fireTimer > 0) e.fireTimer--; if (e.aimTimer > 0) e.aimTimer--; if (e.laserCd > 0) e.laserCd--;
  var pcx = Enemy.pcx(), pcy = Enemy.pcy(), slug = Game.hasCurse("shotgunSlug"), cdm = e.cd || 1;
  if (e.laser) { Enemy.droneMove(e, 0.08, D.heightMultiplier); Enemy.updateLaser(e); return; } // hovering while it fires
  var busy = e.burstShots > 0 || e.fireTimer > 0;
  Enemy.droneMove(e, busy ? D.firingMoveFactor : 1, D.heightMultiplier);
  e.shotTimer--;
  if (e.shotTimer <= 0 && e.burstShots > 0) {
    var dx = pcx - e.x, dy = pcy - e.y, dist = Math.hypot(dx, dy) || 1, speed = D.rocketSpeed * (slug ? 1.3 : 1) * (e.spd || 1);
    Enemy.bullets.push({ kind: "rocket", explosive: true, x: e.x, y: e.y + 8, vx: dx / dist * speed, vy: dy / dist * speed, life: D.rocketLife,
      blast: D.blastRadius * (e.rad || 1), lethal: D.blastLethalFrames, blastLife: D.blastLife, fuse: 26, dim: true });
    e.burstShots--;
    e.shotTimer = Math.round((e.burstShots ? D.rocketInterval : D.burstCooldown) * cdm);
    if (e.burstShots === 0) {
      Enemy.rollDroneOffset(e);
      if (e.laserCd <= 0 && Math.random() < D.laserChance) Enemy.startLaser(e);
    }
  } else if (e.shotTimer <= 0 && e.burstShots === 0 && Math.hypot(pcx - e.x, pcy - e.y) < CONFIG.DRONE_FIRE_RANGE * 1.3) {
    var aim = slug ? Math.max(D.aimFrames, CONFIG.CURSES.shotgunSlug.aimFrames) : D.aimFrames;
    e.burstShots = slug ? 1 : D.rockets; e.fireTimer = Math.max(CONFIG.DRONE_FIRE_TIME, aim); e.shotTimer = aim; e.aimTimer = aim; e.aimTotal = aim;
  }
};
Enemy.startLaser = function (e) {
  var D = CONFIG.DIM.drone;
  e.laser = { state: "charge", timer: D.laserChargeFrames, total: D.laserChargeFrames, angle: Math.atan2(Enemy.pcy() - e.y, Enemy.pcx() - e.x), ex: e.x, ey: e.y };
  Enemy.laserTrace(e);
};
Enemy.updateLaser = function (e) {
  var D = CONFIG.DIM.drone, L = e.laser, want = Math.atan2(Enemy.pcy() - e.y, Enemy.pcx() - e.x), diff = Enemy.angleDiff(want, L.angle);
  if (L.state === "charge") {
    // Locks onto you quickly, but freezes the aim for the last 12 frames so you can read it and move.
    if (L.timer > 12) L.angle += Enemy.clamp(diff, -D.laserTrackRate, D.laserTrackRate);
    L.timer--;
    if (L.timer <= 0) { L.state = "fire"; L.timer = D.laserFireFrames; }
  } else {
    // While firing the beam only turns slowly toward you, so running steadily sideways outpaces it.
    L.angle += Enemy.clamp(diff, -D.laserTurnRate, D.laserTurnRate);
    L.timer--;
    if (L.timer <= 0) { e.laser = null; e.laserCd = D.laserCooldown; e.shotTimer = Math.max(e.shotTimer, 70); return; }
  }
  Enemy.laserTrace(e);
};
// The beam stops at the first solid block.
Enemy.laserTrace = function (e) {
  var L = e.laser, D = CONFIG.DIM.drone, dx = Math.cos(L.angle), dy = Math.sin(L.angle), x = e.x, y = e.y;
  for (var d = 24; d <= D.laserLength; d += 10) {
    x = e.x + dx * d; y = e.y + dy * d;
    if (Collide.hitsSolid(x - 2, y - 2, 4, 4)) break;
  }
  L.ex = x; L.ey = y;
};
Enemy.laserHitsPlayer = function (e) {
  var L = e.laser, D = CONFIG.DIM.drone, px = Enemy.pcx(), py = Enemy.pcy();
  var vx = L.ex - e.x, vy = L.ey - e.y, len2 = vx * vx + vy * vy || 1;
  var t = Math.max(0, Math.min(1, ((px - e.x) * vx + (py - e.y) * vy) / len2));
  return Math.hypot(px - (e.x + vx * t), py - (e.y + vy * t)) < D.laserWidth / 2 + 12;
};

// ---------------------------------------------------------------- DIMENSIONAL CUBOID
// One big "mother" cube. It spits tiny clones (agar.io style). Clones chase you for a while, then fuse back:
// into the mother, or into each other (the bigger one absorbs the smaller). Clones can be shot; mass lost that way is gone for good,
// but the mother slowly regrows.
Enemy.dimCuboidRadius = function (mass) { return CONFIG.DIM.cuboid.unit * Math.sqrt(mass); };
Enemy.makeDimCuboid = function (x, y) {
  var D = CONFIG.DIM.cuboid;
  return Enemy.makeEnemy("cuboid", x, y, Enemy.dimCuboidRadius(D.startMass), Infinity, 0, { dim: true, mass: D.startMass, launchTimer: D.launchInterval });
};
Enemy.updateDimCuboid = function (e) {
  if (e.clone) { Enemy.updateCuboidClone(e); return; }
  var D = CONFIG.DIM.cuboid, dx = Player.x - e.x, dy = Player.y - e.y, d = Math.hypot(dx, dy) || 1;
  var speed = Math.min(CONFIG.CUOBID_MAX_SPEED, CONFIG.CUOBID_SPEED + d * CONFIG.CUOBID_DISTANCE_SPEED) * D.speedMult * (e.spd || 1);
  e.x += dx / d * speed + e.vx; e.y += dy / d * speed + e.vy;
  e.vx *= CONFIG.CUOBID_KNOCKBACK_DECAY; e.vy *= CONFIG.CUOBID_KNOCKBACK_DECAY;
  e.angle += 0.02;
  if (e.mass < D.maxMass) e.mass = Math.min(D.maxMass, e.mass + D.regen);
  e.radius = Enemy.dimCuboidRadius(e.mass);
  e.launchTimer--;
  if (e.launchTimer <= 0) {
    var clones = Enemy.count(function (c) { return c.clone; });
    if (d < D.launchRange && clones < D.maxClones && e.mass - D.cloneMass >= D.minMass) Enemy.launchClone(e);
    e.launchTimer = D.launchInterval;
  }
};
Enemy.launchClone = function (e) {
  var D = CONFIG.DIM.cuboid, a = Math.atan2(Enemy.pcy() - e.y, Enemy.pcx() - e.x) + (Math.random() - 0.5) * 0.6;
  e.mass -= D.cloneMass; e.radius = Enemy.dimCuboidRadius(e.mass);
  var clone = Enemy.makeEnemy("cuboid", e.x + Math.cos(a) * e.radius, e.y + Math.sin(a) * e.radius, Enemy.dimCuboidRadius(D.cloneMass), D.cloneHp, 0,
    { dim: true, clone: true, mass: D.cloneMass, mergeTimer: D.mergeDelay, state: "approach", windup: 0, noRespawn: true });
  clone.vx = Math.cos(a) * D.launchSpeed; clone.vy = Math.sin(a) * D.launchSpeed;
  Enemy.enemies.push(clone);
};
Enemy.updateCuboidClone = function (e) {
  var D = CONFIG.DIM.cuboid;
  e.radius = Enemy.dimCuboidRadius(e.mass); e.angle += 0.05;
  e.vx *= D.launchFriction; e.vy *= D.launchFriction;
  if (e.mergeTimer > 0) { // phase 1: flung out, then crawls toward you
    e.mergeTimer--;
    var dx = Player.x - e.x, dy = Player.y - e.y, d = Math.hypot(dx, dy) || 1;
    e.x += e.vx + dx / d * D.cloneSpeed; e.y += e.vy + dy / d * D.cloneSpeed;
    e.fuseTarget = null;
    return;
  }
  // phase 2: head for the nearest fuse partner (the mother, or another clone that is ready) and merge on touch
  var best = null, bestDist = Infinity;
  for (var i = 0; i < Enemy.enemies.length; i++) {
    var o = Enemy.enemies[i];
    if (o === e || o.remove || o.type !== "cuboid" || !o.dim || o.deadTimer > 0) continue;
    if (o.clone && o.mergeTimer > 0) continue;
    var dd = Math.hypot(o.x - e.x, o.y - e.y);
    if (dd < bestDist) { best = o; bestDist = dd; }
  }
  e.fuseTarget = best;
  if (!best) { e.x += e.vx; e.y += e.vy; return; }
  var fx = best.x - e.x, fy = best.y - e.y, fd = Math.hypot(fx, fy) || 1;
  e.x += e.vx + fx / fd * D.fuseSpeed; e.y += e.vy + fy / fd * D.fuseSpeed;
  if (fd < e.radius + best.radius) {
    if (best.clone && best.mass < e.mass) { e.mass += best.mass; e.hp += best.hp; e.maxHp = e.hp; best.remove = true; } // we are bigger: absorb it
    else if (best.clone) { best.mass += e.mass; best.hp += e.hp; best.maxHp = best.hp; e.remove = true; }
    else { best.mass = Math.min(D.maxMass, best.mass + e.mass); e.remove = true; } // fused back into the mother
  }
};

// ---------------------------------------------------------------- DIMENSIONAL ROLLER
// Same idea as the Roller (it replays your own path), but it keeps re-choosing how far behind you it is. Every few frames it looks
// along your recent path for the point that best cuts you off (where you are heading), and slides its delay toward that.
// It will never be closer than DIM.roller.minDelay (0.6 s), and it avoids parking right on top of you.
Enemy.dimRollerRetarget = function (e) {
  var D = CONFIG.DIM.roller;
  if (Enemy.history.length < D.baseDelay + 2) return; // not enough of your path recorded yet: stay on the base delay
  e.retarget = (e.retarget || 0) - 1;
  if (e.retarget <= 0) {
    e.retarget = D.retargetFrames;
    var pcx = Enemy.pcx(), pcy = Enemy.pcy(), px = pcx + Player.effVx * D.predictFrames, py = pcy + Player.vy * D.predictFrames;
    var best = null, bestScore = Infinity;
    for (var d = D.minDelay; d <= D.maxDelay; d += 6) {
      var s = Enemy.historySample(d); if (!s) break;
      if (Math.hypot(s.x - pcx, s.y - pcy) < D.safeDistance) continue;
      var score = Math.hypot(s.x - px, s.y - py) + d * 0.1; // closest to where you are going; a slight preference for the longer delay
      if (score < bestScore) { bestScore = score; best = d; }
    }
    e.targetDelay = best === null ? D.baseDelay : best;
  }
  var diff = e.targetDelay - e.delayFrames;
  e.delayFrames += Math.max(-D.shiftRate, Math.min(D.shiftRate, diff));
  e.delayFrames = Math.max(D.minDelay, Math.min(D.maxDelay, e.delayFrames));
};

// ---------------------------------------------------------------- DIMENSIONAL ASE
Enemy.aseBurst = function (e) {
  var D = CONFIG.DIM.ase, offset = Math.random() * Math.PI;
  for (var k = 0; k < D.burstBullets; k++) {
    var a = offset + k / D.burstBullets * Math.PI * 2;
    Enemy.bullets.push({ x: e.x, y: e.y, vx: Math.cos(a) * D.burstSpeed, vy: Math.sin(a) * D.burstSpeed, life: D.burstLife, color: null });
  }
};

// ---------------------------------------------------------------- DIMENSIONAL RIFT (curse)
// While the map is collapsing, each collapse opens a portal (per curse stack). After CURSES.dimensionalRift.portalFrames it
// spits out a random enemy that stays for the rest of the level.
Enemy.riftEnemyCount = function () { return Enemy.count(function (e) { return e.rift; }); };
Enemy.openRift = function (stacks) {
  var R = CONFIG.CURSES.dimensionalRift;
  for (var n = 0; n < Math.max(1, stacks); n++) {
    if (Enemy.riftEnemyCount() + Enemy.portals.length >= R.maxActive) return;
    var spot = Enemy.riftSpot(); if (!spot) continue;
    Enemy.portals.push({ x: spot.x, y: spot.y, age: 0, life: R.portalFrames, base: R.types[Math.floor(Math.random() * R.types.length)] });
  }
};
Enemy.riftSpot = function () {
  var R = CONFIG.CURSES.dimensionalRift, W = Level.pixelWidth(), pcx = Enemy.pcx();
  for (var attempt = 0; attempt < 30; attempt++) {
    var side = Math.random() < 0.5 ? -1 : 1, distance = R.minDistance + Math.random() * (R.maxDistance - R.minDistance);
    var x = Enemy.clamp(pcx + side * distance, 60, W - 60), y = 70 + Math.random() * (CONFIG.CANVAS_H - 190);
    if (Math.abs(x - pcx) < R.minDistance * 0.7) continue; // clamped back onto you
    if (!Collide.hitsSolid(x - 28, y - 28, 56, 56)) return { x: x, y: y };
  }
  return null;
};
Enemy.updatePortals = function () {
  for (var i = Enemy.portals.length - 1; i >= 0; i--) {
    var p = Enemy.portals[i];
    p.age++;
    if (p.age >= p.life) { Enemy.spawnRiftEnemy(p); Enemy.portals.splice(i, 1); }
  }
};
Enemy.spawnRiftEnemy = function (p) {
  var extra = { single: true, rift: true, noRespawn: true, windup: CONFIG.CURSES.dimensionalRift.spawnWindup };
  if (p.base === "domino") { var spot = Enemy.dominoSpawnAt(p.x); Enemy.spawnType("domino", spot.x, spot.y, extra); }
  else Enemy.spawnType(p.base, p.x, p.y, extra);
};
