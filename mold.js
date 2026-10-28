/* =====================================================================
   mold.js -- THE MOLD ENEMY.

   A Mold "core" seeds itself on the floor and slowly spreads a layer of
   mold over solid blocks that have an exposed face (it is drawn over the
   terrain, so the map looks rocky and overgrown; it never blocks you).
   From mold tiles it buds:
     * spore plants  (1 HP, rooted on top of a mold tile, shoot slow spores at you)
     * mold rollers  (5 HP, like Green ball 4 but they hop at random)
   Dimensional Mold also buds slightly nerfed "mold versions" of the basic enemies.
   Mold tiles vanish when their block is destroyed (bazooka / collapse); plants on them die.
   If the core's block is destroyed or the core is shot dead, growth stops until it respawns.
   Numbers: CONFIG.MOLD and CONFIG.DIM.mold.
   ===================================================================== */
var Mold = { tiles: {}, list: [] };

Mold.reset = function () { Mold.tiles = {}; Mold.list = []; };
Mold.key = function (c, r) { return c + "," + r; };
Mold.valid = function (t) { return Level.charAt(t.c, t.r) === "#"; };
Mold.add = function (c, r, dim) {
  var k = Mold.key(c, r);
  if (Mold.tiles[k] || Level.charAt(c, r) !== "#") return false;
  var t = { c: c, r: r, born: Enemy.frame, dim: !!dim };
  Mold.tiles[k] = t; Mold.list.push(t);
  return true;
};
Mold.exposed = function (c, r) { return !Level.isSolid(c, r - 1) || !Level.isSolid(c, r + 1) || !Level.isSolid(c - 1, r) || !Level.isSolid(c + 1, r); };
Mold.airAbove = function (c, r) { var above = Level.charAt(c, r - 1); return above !== "#" && above !== "^"; };
// forget tiles whose block no longer exists
Mold.prune = function () {
  for (var i = Mold.list.length - 1; i >= 0; i--) {
    if (!Mold.valid(Mold.list[i])) { delete Mold.tiles[Mold.key(Mold.list[i].c, Mold.list[i].r)]; Mold.list.splice(i, 1); }
  }
};
// spread to one new neighbouring block
Mold.grow = function (core) {
  if (!Mold.list.length) return false;
  var dirs = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, 1], [1, -1], [-1, -1]];
  for (var a = 0; a < CONFIG.MOLD.growAttempts; a++) {
    var t = Mold.list[Math.floor(Math.random() * Mold.list.length)];
    if (!Mold.valid(t)) continue;
    var d = dirs[Math.floor(Math.random() * dirs.length)], nc = t.c + d[0], nr = t.r + d[1];
    if (nc < 0 || nc >= Level.cols || Mold.tiles[Mold.key(nc, nr)] || !Mold.exposed(nc, nr)) continue;
    if (Mold.add(nc, nr, core.dim)) return true;
  }
  return false;
};

// ---------------------------------------------------------------- seeding
// Lowest walkable surface in a column (solid block with open air above), or -1.
Mold.surfaceRow = function (c) {
  for (var r = CONFIG.ROWS - 1; r >= 0; r--) if (Level.charAt(c, r) === "#" && Mold.airAbove(c, r)) return r;
  return -1;
};
Mold.seedPoint = function (distance) {
  var T = CONFIG.TILE, cores = Enemy.count(function (e) { return e.type === "mold"; });
  var pcx = Enemy.pcx(), targetCol = Math.floor((pcx + distance + cores * 320) / T), best = null, bestScore = Infinity;
  for (var c = 1; c < Level.cols - 1; c++) {
    var r = Mold.surfaceRow(c); if (r < 0) continue;
    if (Math.abs(c * T + T / 2 - pcx) < 160) continue; // never right on top of you
    var score = Math.abs(c - targetCol);
    if (score < bestScore) { best = { c: c, r: r }; bestScore = score; }
  }
  if (!best) return { x: Enemy.clamp(pcx + distance, 20, Level.pixelWidth() - 20), y: 300, c: -1, r: -1 };
  return { x: best.c * T + T / 2, y: best.r * T - CONFIG.MOLD.coreRadius * 0.5, c: best.c, r: best.r };
};
Mold.makeCore = function (x, y, dim) {
  var M = CONFIG.MOLD, T = CONFIG.TILE, c = Math.floor(x / T), r = Math.round((y + M.coreRadius * 0.5) / T);
  var core = Enemy.makeEnemy("mold", x, y, M.coreRadius, M.coreHp, M.coreRespawn, { dim: !!dim, noBody: true, tileC: c, tileR: r });
  Enemy.enemies.push(core);
  Mold.seedTiles(c, r, !!dim);
  return core;
};
Mold.seedTiles = function (c, r, dim) { Mold.add(c, r, dim); Mold.add(c - 1, r, dim); Mold.add(c + 1, r, dim); };
Mold.respawnCore = function (e) {
  var p = Mold.seedPoint(CONFIG.ENEMY_RESPAWN_DISTANCE);
  e.x = p.x; e.y = p.y; e.tileC = p.c; e.tileR = p.r; e.hp = e.maxHp; e.vx = 0; e.vy = 0;
  e.state = "windup"; e.windup = CONFIG.ENEMY_WINDUP_FRAMES;
  Enemy.clearState(e);
  if (p.c >= 0) Mold.seedTiles(p.c, p.r, !!e.dim);
};

// ---------------------------------------------------------------- the core
Mold.updateCore = function (e) {
  var M = CONFIG.MOLD, DM = CONFIG.DIM.mold;
  if (e.growTimer === undefined) { e.growTimer = M.growInterval; e.budTimer = e.dim ? DM.budInterval : M.budInterval; e.moldTimer = 0; }
  e.moldTimer++;
  // its block was destroyed (bazooka, collapse): the core dies and will re-seed elsewhere
  if (Level.charAt(e.tileC, e.tileR) !== "#") { Enemy.kill(e); return; }
  if (e.moldTimer % 60 === 0) Mold.prune();
  e.growTimer--;
  if (e.growTimer <= 0) { Mold.grow(e); e.growTimer = Math.round(M.growInterval / (e.dim ? DM.growMultiplier : 1)); }
  e.budTimer--;
  if (e.budTimer <= 0) { Mold.bud(e); e.budTimer = e.dim ? DM.budInterval : M.budInterval; }
};

// ---------------------------------------------------------------- budding
Mold.pickBudTile = function () {
  var M = CONFIG.MOLD, pcx = Enemy.pcx(), pcy = Enemy.pcy(), T = CONFIG.TILE, best = null, bestDist = Infinity;
  for (var n = 0; n < 12 && Mold.list.length; n++) {
    var t = Mold.list[Math.floor(Math.random() * Mold.list.length)];
    if (!Mold.valid(t) || !Mold.airAbove(t.c, t.r)) continue;
    var x = t.c * T + T / 2, y = t.r * T, dist = Math.hypot(x - pcx, y - pcy);
    if (dist < M.minSpawnDistance) continue;
    if (Enemy.count(function (e) { return e.type === "moldPlant" && e.tileC === t.c && e.tileR === t.r; })) continue; // one plant per block
    if (dist < bestDist) { best = t; bestDist = dist; } // prefer buds that are near you, so the fight comes to you
  }
  return best;
};
Mold.bud = function (core) {
  var M = CONFIG.MOLD, DM = CONFIG.DIM.mold, dim = !!core.dim;
  var plants = Enemy.count(function (e) { return e.type === "moldPlant"; });
  var rollers = Enemy.count(function (e) { return e.moldRoller; });
  var kids = Enemy.count(function (e) { return e.moldVariant; });
  var options = [];
  if (plants < (dim ? DM.maxPlants : M.maxPlants)) options.push("plant", "plant");
  if (rollers < (dim ? DM.maxRollers : M.maxRollers)) options.push("roller");
  if (dim && kids < DM.maxChildren) options.push("variant", "variant");
  if (!options.length) return;
  var pick = options[Math.floor(Math.random() * options.length)], tile = Mold.pickBudTile();
  if (!tile) return;
  var T = CONFIG.TILE, x = tile.c * T + T / 2, top = tile.r * T;
  if (pick === "plant") {
    Enemy.enemies.push(Enemy.makeEnemy("moldPlant", x, top - M.plantRadius, M.plantRadius, M.plantHp, 0,
      { noRespawn: true, noBody: true, windup: M.plantGrowFrames, growTotal: M.plantGrowFrames, fullRadius: M.plantRadius, tileC: tile.c, tileR: tile.r, shotTimer: Mold.plantDelay(), dim: dim }));
  } else if (pick === "roller") {
    var roller = Enemy.makeEnemy("greenBall4", x, top - M.rollerRadius, M.rollerRadius, M.rollerHp, 0,
      { noRespawn: true, moldRoller: true, windup: M.rollerGrowFrames, growTotal: M.rollerGrowFrames, fullRadius: M.rollerRadius, dim: dim });
    roller.radius = M.rollerRadius * 0.25; roller.jumpTimer = M.rollerJumpMin;
    Enemy.enemies.push(roller);
  } else Mold.spawnVariant(tile);
};
// Dimensional Mold: a slightly nerfed mold version of a basic enemy grows out of a mold tile.
Mold.variantTypes = ["cuboid", "drone", "drill", "greenBall4", "domino", "ase", "roller", "rocket"];
Mold.spawnVariant = function (tile) {
  var N = CONFIG.DIM.mold.nerf, T = CONFIG.TILE;
  var free = Mold.variantTypes.filter(function (type) { return !Enemy.count(function (e) { return e.moldVariant && e.type === type; }); });
  if (!free.length) return;
  var type = free[Math.floor(Math.random() * free.length)], x = tile.c * T + T / 2, y = tile.r * T - 30;
  var extra = { single: true, moldVariant: true, noRespawn: true, spd: N.speed, cd: N.cooldown, warn: N.warning, rad: N.radius, hpMult: N.hp, windup: CONFIG.MOLD.rollerGrowFrames, delayBonus: 30 };
  if (type === "domino") { var spot = Enemy.dominoSpawnAt(x); Enemy.spawnType("domino", spot.x, spot.y, extra); }
  else Enemy.spawnType(type, x, y, extra);
};

// ---------------------------------------------------------------- spore plants
Mold.plantDelay = function () { var M = CONFIG.MOLD; return M.plantFireMin + Math.floor(Math.random() * (M.plantFireMax - M.plantFireMin)); };
Mold.updatePlant = function (e) {
  var M = CONFIG.MOLD;
  if (!Mold.valid({ c: e.tileC, r: e.tileR })) { e.remove = true; return; } // its block is gone
  var pcx = Enemy.pcx(), pcy = Enemy.pcy(), d = Math.hypot(pcx - e.x, pcy - e.y);
  e.tell = 0;
  if (d >= M.plantRange) { if (e.shotTimer < M.plantTellFrames + 10) e.shotTimer = M.plantTellFrames + 10; return; } // never fires from out of range
  e.shotTimer--;
  if (e.shotTimer <= M.plantTellFrames) e.tell = 1 - Math.max(0, e.shotTimer) / M.plantTellFrames; // bulb swells before it shoots
  if (e.shotTimer <= 0) {
    var a = Math.atan2(pcy - e.y, pcx - e.x) + (Math.random() - 0.5) * 0.2;
    Enemy.bullets.push({ x: e.x, y: e.y - 8, vx: Math.cos(a) * M.sporeSpeed, vy: Math.sin(a) * M.sporeSpeed, life: M.sporeLife, color: "#5cff7a" });
    e.shotTimer = Mold.plantDelay();
  }
};
