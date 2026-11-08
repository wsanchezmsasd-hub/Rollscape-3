/* =====================================================================
   features.js -- CONTENT PASS 3.

   Everything new in this pass that is not drawing lives here:
     * Beacon of light (replaces the Finish flag)
     * High platforms + jump pads (verticality)
     * Altars (chance / duality / greed / curses)
     * New curses: Sub-Zero, Adware, Diamond Cuboid, Moldy Aura,
       Heartbreaker, AK-47, Tar
   All numbers are in config.js. Drawing is in draw_extra.js.
   ===================================================================== */
var Features = { deathReason: null, interactWasDown: false, sawGold: false, banner: 0, ak: { held: false, cooldown: 0, abilityCd: 0, thrown: null }, heart: { frames: 0 }, tar: null, cogs: [] };
var Altars = { current: null };
var Ads = { list: [], timer: 0 };

Features.shuffle = function (list) { var a = list.slice(); for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)), t = a[i]; a[i] = a[j]; a[j] = t; } return a; };
Features.range = function (from, to) { var r = []; for (var i = from; i <= to; i++) r.push(i); return r; };
Features.pick = function (list) { return list[Math.floor(Math.random() * list.length)]; };

// ---------------------------------------------------------------- per-level reset
Features.resetLevel = function () {
  Features.deathReason = null; Features.sawGold = false; Features.banner = 0;
  Features.ak = { held: false, cooldown: 0, abilityCd: 0, thrown: null };
  Features.heart = { frames: CONFIG.CURSES.heartbreaker.startFrames };
  Features.tar = null; Features.cogs = [];
  Ads.clear(); Ads.timer = CONFIG.CURSES.adware.firstDelay;
  Altars.reset();
  if (Game.hasCurse("tar")) Features.spawnTar();
};
// Called when a curse is added in the middle of a level (Altar of Curses / Altar of Chance).
Features.onCurseAdded = function (id) {
  if (Game.mode === "choice") return; // between levels: resetLevel() sets everything up when the level starts
  if (id === "heartbreaker") Features.heart.frames = CONFIG.CURSES.heartbreaker.startFrames;
  if (id === "tar" && !Features.tar) Features.spawnTar();
  if (id === "ak47") Features.ak = { held: true, cooldown: 0, abilityCd: 0, thrown: null };
  if (id === "subZero") Level.ensureIce();
  if (id === "adware") Ads.timer = CONFIG.CURSES.adware.firstDelay;
  if (id === "diamondCuboid" && Level.goldActive) Enemy.ensureDiamond();
};

// ---------------------------------------------------------------- per-frame update (runs before Player.update)
Features.update = function () {
  if (!Input.mouseDown) Features.ak.held = false;
  if (Features.banner > 0) Features.banner--;
  if (Level.goldActive && !Features.sawGold) {
    Features.sawGold = true; Features.banner = 300;
    Game.showMessage(Game.hasCurse("diamondCuboid") ? "Red tesseracts done! Catch the Diamond Cuboid before the map is gone." : "Red tesseracts done! The map is collapsing. Reach the beacon above the spawn platform.");
  }
  Features.updateAk(); Features.updateHeart(); Features.updateTar(); Features.updateMoldyAura();
  if (Level.goldActive && Game.hasCurse("diamondCuboid")) Enemy.ensureDiamond();
  Ads.update();
  var down = !!Input.interact;
  if (down && !Features.interactWasDown) { var altar = Altars.near(); if (altar) Altars.open(altar); }
  Features.interactWasDown = down;
};
Features.goldValue = function () { return Math.max(1, Math.round(Math.pow(CONFIG.CURSES.unstablePlain.goldMultiplier, Game.curseCount("unstablePlain")) * Game.levelMods.gold * Game.mods.gold)); };
Features.collapseMult = function () { return Game.levelMods.collapse * Game.mods.collapse; };
Features.onCollect = function () { if (Game.hasCurse("heartbreaker")) { var H = CONFIG.CURSES.heartbreaker; Features.heart.frames = Math.min(H.capFrames, Features.heart.frames + H.perTesseract); } };
// Things that can kill you that are not enemies. Returns true on death.
Features.killsPlayer = function () {
  var pcx = Enemy.pcx(), pcy = Enemy.pcy();
  if (Game.hasCurse("heartbreaker") && Features.heart.frames <= 0) { Features.deathReason = "Heartbreaker detonated."; Enemy.addExplosion(pcx, pcy, 110, { lethal: 0, life: 26 }); return true; }
  var t = Features.tar;
  if (t && t.state === "awake" && !Player.isInvincible() && Math.hypot(pcx - t.x, pcy - t.y) < CONFIG.TAR.radius + 12) { Features.deathReason = "The Tar caught up with you."; return true; }
  return false;
};

// ================================================================ BEACON
// The beacon hovers above the platform of the spawn piece. Only the spawn piece survives the collapse, so it is always reachable.
Level.computeBeacon = function () {
  var T = CONFIG.TILE, c = Level.spawnStartCol + CONFIG.PIECE_COLS / 2, top = CONFIG.ROWS * T;
  for (var cc = c - 2; cc <= c + 1; cc++) for (var r = 0; r < CONFIG.ROWS; r++) if (Level.charAt(cc, r) === "#") { top = Math.min(top, r * T); break; }
  Level.beacon = { x: c * T, platformY: top, y: Math.max(48, top - CONFIG.BEACON.hover) };
};
Level.beaconOpen = function () { return Level.goldActive && !Game.hasCurse("diamondCuboid"); };
Level.beaconTouched = function () { var b = Level.beacon; return !!b && Level.beaconOpen() && Math.hypot(Enemy.pcx() - b.x, Enemy.pcy() - b.y) < CONFIG.BEACON.hitRadius + CONFIG.PLAYER_RADIUS; };
// true once every piece that can collapse has collapsed (the spawn piece is the only one left)
Level.collapseOver = function () { return Level.goldActive && Level.collapsePieceCursor >= Math.ceil(Level.collapseOrder.length * Math.max(0, Math.min(1, CONFIG.COLLAPSE_MAP_FRACTION))) && Level.collapseWarning <= 0; };

// ================================================================ LEVEL HELPERS
Level.setChar = function (c, r, ch) { if (r < 0 || r >= CONFIG.ROWS || c < 0 || c >= Level.cols) return; Level.grid[r] = Level.grid[r].substring(0, c) + ch + Level.grid[r].substring(c + 1); };
Level.colFree = function (c, r0, r1) { for (var r = r0; r <= r1; r++) if (Level.charAt(c, r) !== ".") return false; return true; };
// lowest solid block in a column that has no solid block above it (the "ground" you can stand on), or -1
Level.bottomSurface = function (c) { for (var r = CONFIG.ROWS - 1; r >= 0; r--) if (Level.charAt(c, r) === "#" && (r === 0 || Level.charAt(c, r - 1) !== "#")) return r; return -1; };

// ---------------------------------------------------------------- verticality: high platforms with tesseracts + a jump pad to reach each
Level.addVertical = function () {
  var V = CONFIG.VERTICAL, P = CONFIG.PIECE_COLS, pieceCount = Math.floor(Level.cols / P);
  Level.pads = {}; Level.extraSpots = [];
  Features.shuffle(Features.range(0, pieceCount - 1)).forEach(function (p) {
    if (Level.protectedPieceIndices.indexOf(p) >= 0 || Math.random() > V.platformChance) return;
    var width = V.minWidth + Math.floor(Math.random() * (V.maxWidth - V.minWidth + 1));
    var offsets = Features.shuffle(Features.range(0, P - width));
    for (var o = 0; o < offsets.length; o++) {
      var c0 = p * P + offsets[o], c1 = c0 + width - 1, fits = true;
      for (var c = c0; c <= c1; c++) if (!Level.colFree(c, 1, V.platformRow + 1)) fits = false;
      if (!fits) continue;
      var pad = Level.findPadColumn(c0, c1);
      if (!pad) continue;
      for (c = c0; c <= c1; c++) Level.setChar(c, V.platformRow, "#");
      var T = CONFIG.TILE, y = (V.platformRow - 1) * T + T / 2;
      (width >= 4 ? [c0 + 1, c1 - 1] : [c0 + Math.floor(width / 2)]).forEach(function (col) { Level.extraSpots.push({ x: col * T + T / 2, y: y }); });
      Level.pads[pad.c + "," + pad.r] = { c: pad.c, r: pad.r, h: Math.max(CONFIG.PAD.minHeight, pad.r * T - 80), t: 0 };
      return;
    }
  });
};
Level.findPadColumn = function (c0, c1) {
  var cands = [];
  for (var k = 1; k <= CONFIG.VERTICAL.padReach; k++) { cands.push(c0 - k); cands.push(c1 + k); }
  cands = Features.shuffle(cands);
  for (var i = 0; i < cands.length; i++) {
    var pc = cands[i];
    if (pc < 1 || pc > Level.cols - 2 || Level.isSpawnColumn(pc)) continue;
    var r = Level.bottomSurface(pc);
    if (r < 4 || !Level.colFree(pc, 0, r - 1) || Level.pads[pc + "," + r]) continue;
    return { c: pc, r: r };
  }
  return null;
};
Level.padAt = function (c, r) { var pad = Level.pads && Level.pads[c + "," + r]; return pad && Level.isSolid(c, r) ? pad : null; };
// Standing on a pad throws you up. The launch speed is solved from the pad's own height, so it works under any gravity.
Level.tryPad = function () {
  var pad = Level.padAt(Math.floor((Player.x + CONFIG.PLAYER_SIZE / 2) / CONFIG.TILE), Math.floor((Player.y + CONFIG.PLAYER_SIZE) / CONFIG.TILE));
  if (!pad) return;
  Player.vy = -Math.min(CONFIG.MAX_VERTICAL_SPEED, Math.sqrt(2 * Player.gravity() * pad.h));
  Player.onGround = false; Player.coyoteTimer = 0; pad.t = Date.now();
  if (typeof Draw !== "undefined" && Draw.burst) Draw.burst(Player.x + CONFIG.PLAYER_SIZE / 2, Player.y + CONFIG.PLAYER_SIZE, "#4dffd2", 10);
};

// ---------------------------------------------------------------- altars
Altars.types = ["chance", "duality", "greed", "curses"];
Level.addAltars = function (levelNumber) {
  Level.altars = [];
  if (Game.commandLevelDefinition || levelNumber < CONFIG.ALTAR.firstLevel) return;
  var want = Math.min(CONFIG.ALTAR.maxPerLevel, 1 + (Math.random() < 0.5 ? 1 : 0)), types = Features.shuffle(Altars.types), P = CONFIG.PIECE_COLS, T = CONFIG.TILE;
  Features.shuffle(Features.range(0, Math.floor(Level.cols / P) - 1)).forEach(function (p) {
    if (Level.altars.length >= want || Level.protectedPieceIndices.indexOf(p) >= 0) return;
    var cols = Features.shuffle(Features.range(p * P + 1, p * P + P - 2));
    for (var i = 0; i < cols.length; i++) {
      var c = cols[i], r = Level.bottomSurface(c);
      if (r < 0 || !Level.colFree(c, r - 3, r - 1) || Level.padAt(c, r) || Level.padAt(c - 1, r) || Level.padAt(c + 1, r)) continue;
      Level.altars.push({ type: types[Level.altars.length], col: c, row: r, x: c * T + T / 2, topY: r * T, used: false });
      return;
    }
  });
};

// ---------------------------------------------------------------- Sub-Zero: a few chunks of the map are frozen
Level.ensureIce = function () {
  if (!Game.hasCurse("subZero")) { Level.iceCols = {}; Level.iceBuilt = false; return; }
  if (Level.iceBuilt) return;
  var S = CONFIG.CURSES.subZero, tries = 0, made = 0;
  Level.iceCols = {};
  while (made < S.chunks && tries++ < 80) {
    var c0 = 1 + Math.floor(Math.random() * Math.max(1, Level.cols - S.chunkCols - 2)), ok = true, c;
    for (c = c0 - 1; c <= c0 + S.chunkCols; c++) if (Level.isSpawnColumn(c) || Level.iceCols[c]) ok = false;
    if (!ok) continue;
    for (c = 0; c < S.chunkCols; c++) Level.iceCols[c0 + c] = true;
    made++;
  }
  Level.iceBuilt = true;
};
Level.onIce = function () {
  if (!Level.iceBuilt || !Player.onGround) return false;
  var c = Math.floor((Player.x + CONFIG.PLAYER_SIZE / 2) / CONFIG.TILE), r = Math.floor((Player.y + CONFIG.PLAYER_SIZE) / CONFIG.TILE);
  return !!Level.iceCols[c] && Level.isSolid(c, r);
};

// ================================================================ DIAMOND CUBOID (curse): the beacon is a big cuboid that runs from you
Enemy.diamondOf = function () { for (var i = 0; i < Enemy.enemies.length; i++) if (Enemy.enemies[i].diamond && !Enemy.enemies[i].remove) return Enemy.enemies[i]; return null; };
Enemy.ensureDiamond = function () {
  if (Enemy.diamondOf() || !Level.beacon) return;
  var D = CONFIG.CURSES.diamondCuboid, pick = null, best = Infinity;
  Enemy.enemies.forEach(function (e) {
    if (e.type !== "cuboid" || e.dim || e.moldVariant || e.rift || e.remove || e.deadTimer > 0) return;
    var d = Math.hypot(e.x - Level.beacon.x, e.y - Level.beacon.y);
    if (d < best) { best = d; pick = e; }
  });
  if (pick) { pick.diamond = true; pick.radius = D.radius; pick.noBody = true; pick.noHit = true; pick.hp = Infinity; pick.maxHp = Infinity; pick.state = "approach"; pick.windup = 0; pick.combined = false; }
  else Enemy.enemies.push(Enemy.makeEnemy("cuboid", Level.beacon.x, Level.beacon.y, D.radius, Infinity, 0, { diamond: true, noBody: true, noHit: true, state: "approach", windup: 0 }));
  if (typeof Draw !== "undefined" && Draw.burst) Draw.burst(Level.beacon.x, Level.beacon.y, "#bff6ff", 24);
};
Enemy.updateDiamond = function (e) {
  var D = CONFIG.CURSES.diamondCuboid, W = Level.pixelWidth(), r = e.radius;
  e.angle += 0.012;
  if (Level.collapseOver()) { // spawn is the last piece: come home and wait above the platform
    var hx = Level.beacon.x - e.x, hy = Level.beacon.y - e.y, hd = Math.hypot(hx, hy) || 1, step = Math.min(hd, D.returnSpeed);
    e.x += hx / hd * step; e.y += hy / hd * step;
    return;
  }
  var dx = e.x - Enemy.pcx(), dy = e.y - Enemy.pcy(), d = Math.hypot(dx, dy) || 1;
  if (d < D.fleeRange) {
    var speed = D.fleeSpeed * (1 + (1 - d / D.fleeRange) * 0.4), mx = dx / d * speed, my = dy / d * speed;
    // cornered against a wall or the ceiling/floor: slide along it instead of sitting still
    if ((e.x - r < 8 && mx < 0) || (e.x + r > W - 8 && mx > 0)) { mx = 0; my = (dy >= 0 ? 1 : -1) * speed; }
    if ((e.y - r < 24 && my < 0) || (e.y + r > 330 && my > 0)) { my = 0; mx = (dx >= 0 ? 1 : -1) * speed; }
    e.x += mx; e.y += my;
  } else { // idle drift toward the middle of the arena
    e.x += (Level.beacon.x - e.x) * 0.0015; e.y += (150 - e.y) * 0.01;
  }
  e.x = Enemy.clamp(e.x, r, W - r); e.y = Enemy.clamp(e.y, r + 20, 330 - r);
};
Enemy.diamondTouched = function () { var e = Enemy.diamondOf(); return !!e && Math.hypot(Enemy.pcx() - e.x, Enemy.pcy() - e.y) < e.radius + CONFIG.PLAYER_RADIUS; };

// ================================================================ MOLDY AURA (curse)
Features.updateMoldyAura = function () {
  if (!Game.hasCurse("moldyAura")) return;
  var A = CONFIG.CURSES.moldyAura;
  if (Player.onGround && Math.abs(Player.effVx) > A.minSpeed && Math.random() < A.chance) Mold.add(Math.floor((Player.x + CONFIG.PLAYER_SIZE / 2) / CONFIG.TILE), Math.floor((Player.y + CONFIG.PLAYER_SIZE) / CONFIG.TILE), false);
};
// Mold that has no core keeps growing (and budding) while the curse is active.
Mold.updateOrphan = function () {
  if (!Game.hasCurse("moldyAura") || !Mold.list.length) return;
  if (Enemy.count(function (e) { return e.type === "mold" && e.deadTimer <= 0; })) return; // a real core is in charge
  var A = CONFIG.CURSES.moldyAura;
  Mold.orphanGrow = (Mold.orphanGrow === undefined ? A.growInterval : Mold.orphanGrow) - 1;
  Mold.orphanBud = (Mold.orphanBud === undefined ? A.budInterval : Mold.orphanBud) - 1;
  if (Enemy.frame % 60 === 0) Mold.prune();
  if (Mold.orphanGrow <= 0) { Mold.grow({ dim: false }); Mold.orphanGrow = A.growInterval; }
  if (Mold.orphanBud <= 0) { if (Mold.list.length >= 6) Mold.bud({ dim: false }); Mold.orphanBud = A.budInterval; }
};

// ================================================================ HEARTBREAKER (curse)
Features.updateHeart = function () { if (Game.hasCurse("heartbreaker")) Features.heart.frames--; };

// ================================================================ AK-47 (curse): not automatic, 7 damage, E throws it and it bounces back
Features.akActive = function () { return Game.hasCurse("ak47"); };
Features.akFire = function () {
  var ak = Features.ak, K = CONFIG.CURSES.ak47;
  if (ak.held) return; // not automatic: one shot per click
  ak.held = true;
  if (ak.thrown || ak.cooldown > 0) return;
  var sx = Enemy.pcx(), sy = Enemy.pcy(), dx = Input.mouseX - sx, dy = Input.mouseY - sy, d = Math.hypot(dx, dy) || 1;
  Weapons.projectiles.push({ kind: "akbullet", x: sx, y: sy, vx: dx / d * K.speed, vy: dy / d * K.speed, damage: K.damage, life: K.life, age: 0 });
  ak.cooldown = K.cooldown;
};
Features.akAbility = function () {
  var ak = Features.ak, K = CONFIG.CURSES.ak47;
  if (ak.thrown || ak.abilityCd > 0) return;
  var sx = Enemy.pcx(), sy = Enemy.pcy(), dx = Input.mouseX - sx, dy = Input.mouseY - sy, d = Math.hypot(dx, dy) || 1;
  ak.thrown = { x: sx, y: sy, vx: dx / d * K.throwSpeed, vy: dy / d * K.throwSpeed, t: 0, phase: "out", spin: 0, hitCd: 0, rx: dx / d, ry: dy / d };
};
Features.updateAk = function () {
  var ak = Features.ak, K = CONFIG.CURSES.ak47, t = ak.thrown;
  if (ak.cooldown > 0) ak.cooldown--;
  if (ak.abilityCd > 0) ak.abilityCd--;
  if (!t) return;
  t.spin += 0.55; if (t.hitCd > 0) t.hitCd--;
  if (t.phase === "out") {
    t.x += t.vx; t.y += t.vy; t.t++;
    if (t.hitCd <= 0 && Enemy.damageAt(t.x, t.y, K.throwDamage, 16)) { t.hitCd = K.hitInterval; t.phase = "back"; }
    if (t.t >= K.throwFrames || Collide.hitsSolid(t.x - 6, t.y - 6, 12, 12)) t.phase = "back";
    return;
  }
  var dx = Enemy.pcx() - t.x, dy = Enemy.pcy() - t.y, d = Math.hypot(dx, dy) || 1;
  t.rx = dx / d; t.ry = dy / d;
  t.x += t.rx * Math.min(d, K.returnSpeed); t.y += t.ry * Math.min(d, K.returnSpeed);
  if (t.hitCd <= 0 && Enemy.damageAt(t.x, t.y, K.throwDamage * 0.5, 14)) t.hitCd = K.hitInterval;
  if (d < 22) { // caught it. It smacks you a little on the way in.
    Player.vx += t.rx * K.knock; Player.vy += t.ry * K.knock * 0.5 - 1;
    ak.thrown = null; ak.abilityCd = K.abilityCooldown;
  }
};

// ================================================================ TAR (curse): a tar clock that wants cogs
Features.spawnTar = function () {
  var T = CONFIG.TAR, W = Level.pixelWidth(), side = Math.random() < 0.5 ? -1 : 1;
  var x = Enemy.clamp(Player.x + side * (380 + Math.random() * 300), 90, W - 90);
  Features.tar = { x: x, y: 95, homeX: x, state: "asleep", missed: 0, calm: 0, awake: 0, cogTimer: T.cogInterval, cogTotal: T.cogInterval };
  Features.cogs = [];
};
Features.spawnCog = function () {
  var W = Level.pixelWidth();
  for (var attempt = 0; attempt < 40; attempt++) {
    var x = Enemy.clamp(Enemy.pcx() + (Math.random() < 0.5 ? -1 : 1) * (140 + Math.random() * 280), 40, W - 40), y = 80 + Math.random() * 220;
    if (Collide.hitsSolid(x - 14, y - 14, 28, 28)) continue;
    Features.cogs.push({ x: x, y: y, age: 0 });
    return true;
  }
  return false;
};
Features.updateTar = function () {
  var t = Features.tar, T = CONFIG.TAR;
  if (!t) { if (Game.hasCurse("tar")) Features.spawnTar(); return; }
  var pcx = Enemy.pcx(), pcy = Enemy.pcy(), range = T.cogRange + Game.blessings.magnet * CONFIG.TESSERACT_MAGNET_BONUS * 0.5;
  for (var i = Features.cogs.length - 1; i >= 0; i--) {
    var cog = Features.cogs[i]; cog.age++;
    if (Math.hypot(pcx - cog.x, pcy - cog.y) < range) {
      Features.cogs.splice(i, 1);
      if (typeof Draw !== "undefined" && Draw.burst) Draw.burst(cog.x, cog.y, "#ffcc66", 10);
      if (t.state === "asleep") t.missed = Math.max(0, t.missed - 1);
      else if (++t.calm >= T.calmCogs) { t.state = "asleep"; t.missed = 0; t.calm = 0; t.cogTimer = T.cogInterval; t.cogTotal = T.cogInterval; Game.showMessage("The Tar settles back down."); }
    } else if (cog.age > T.cogLife) {
      Features.cogs.splice(i, 1);
      if (t.state === "asleep") t.missed++;
    }
  }
  t.cogTimer--;
  if (t.cogTimer <= 0) {
    if (Features.cogs.length < T.maxCogs) Features.spawnCog();
    t.cogTotal = t.state === "asleep" ? T.cogInterval : T.awakeCogInterval; t.cogTimer = t.cogTotal;
  }
  if (t.state === "asleep") {
    t.y = 95 + Math.sin(Date.now() / 900) * 4;
    if (t.missed >= T.missesToWake) { t.state = "awake"; t.awake = 0; t.calm = 0; t.cogTimer = Math.min(t.cogTimer, 60); t.cogTotal = T.awakeCogInterval; Game.showMessage("The Tar woke up! Collect " + T.calmCogs + " cogs to calm it."); if (typeof Draw !== "undefined") Draw.addShake(6); }
  } else {
    var dx = pcx - t.x, dy = pcy - t.y, d = Math.hypot(dx, dy) || 1, speed = Math.min(T.chaseMax, T.chaseSpeed + t.awake * T.chaseGrow);
    t.x += dx / d * speed; t.y += dy / d * speed; t.awake++;
  }
};

// ================================================================ ADWARE (curse)
Ads.slogans = ["LIMITED TIME OFFER!!", "ONE WEIRD BLESSING!", "YOUR BALL IS SLOW*", "ROLL LIKE A CHAMPION", "DOCTORS HATE THIS BLESSING", "ACT NOW!!!"];
Ads.update = function () {
  if (!Game.hasCurse("adware")) { if (Ads.list.length) Ads.clear(); return; }
  var A = CONFIG.CURSES.adware;
  if (--Ads.timer > 0) return;
  if (Ads.list.length < A.maxAds) Ads.spawn();
  Ads.timer = A.minFrames + Math.floor(Math.random() * (A.maxFrames - A.minFrames));
};
Ads.clear = function () { Ads.list.forEach(function (ad) { if (ad.el.parentNode) ad.el.parentNode.removeChild(ad.el); }); Ads.list = []; };
Ads.remove = function (ad) { if (ad.el.parentNode) ad.el.parentNode.removeChild(ad.el); var i = Ads.list.indexOf(ad); if (i >= 0) Ads.list.splice(i, 1); };
Ads.place = function (el) {
  var canvas = document.getElementById("game"), rect = canvas.getBoundingClientRect(), w = 250, h = 150;
  el.style.left = Math.round(rect.left + Math.random() * Math.max(10, rect.width - w)) + "px";
  el.style.top = Math.round(rect.top + Math.random() * Math.max(10, rect.height - h)) + "px";
};
Ads.spawn = function () {
  var layer = document.getElementById("ad-layer"); if (!layer) return;
  var offer = Features.pick(Game.blessingDefinitions), el = document.createElement("div"), ad = { el: el };
  el.className = "ad";
  el.innerHTML = '<div class="ad-bar"><span>AD</span><button class="ad-x" disabled>...</button></div><strong></strong><span class="ad-body"></span><button class="ad-buy">BUY NOW</button>';
  el.querySelector("strong").textContent = Features.pick(Ads.slogans);
  el.querySelector(".ad-body").textContent = offer.name + " (" + offer.description + ") for just " + offer.cost + " gold!";
  var buy = el.querySelector(".ad-buy"), close = el.querySelector(".ad-x");
  buy.addEventListener("click", function () {
    if (Game.goldTesseracts >= offer.cost) { Game.goldTesseracts -= offer.cost; Game.blessings[offer.type]++; Game.showMessage("Bought " + offer.name + " from an ad. Oh well."); Ads.remove(ad); }
    else { buy.textContent = "Need " + offer.cost + " gold!"; Ads.place(el); } // it moves, because of course it does
  });
  close.addEventListener("click", function () { Ads.remove(ad); });
  setTimeout(function () { close.disabled = false; close.textContent = "x"; }, CONFIG.CURSES.adware.closeDelayMs);
  Ads.place(el); layer.appendChild(el); Ads.list.push(ad);
};

// ================================================================ ENEMY HELPERS used by altars
// Opens `count` portals around you. Unlike the Dimensional Rift curse these ignore the rift cap (the Altar of Greed wants a flood).
Enemy.openPortals = function (count, types) {
  var R = CONFIG.CURSES.dimensionalRift, dominoes = 0;
  for (var i = 0; i < count; i++) {
    var spot = Enemy.riftSpot(); if (!spot) continue;
    var base = Features.pick(types);
    if (base === "domino" && ++dominoes > 1) base = "drone"; // one slab at a time is plenty
    Enemy.portals.push({ x: spot.x, y: spot.y, age: 0, life: R.portalFrames + i * 7, base: base });
  }
};
// permanent = true changes the whole run (Altar of Duality); false only this level (Altar of Chance)
Enemy.scaleSpeed = function (f, permanent) {
  if (permanent) Game.mods.enemySpeed *= f; else Game.levelMods.enemySpeed *= f;
  Enemy.enemies.forEach(function (e) { e.spd = (e.spd || 1) * f; });
};
Enemy.scaleCooldown = function (f) { Game.mods.enemyCooldown *= f; Enemy.enemies.forEach(function (e) { e.cd = (e.cd || 1) * f; }); };

// ================================================================ ALTARS
Altars.defs = {
  chance:  { name: "Altar of Chance",  color: "#6fd8ff", blurb: "A cracked die hangs above the stone. Fortune favors someone." },
  duality: { name: "Altar of Duality", color: "#f0e6ff", blurb: "Two faces, one price. Every gift here has a cost, and some of them change how the game plays." },
  greed:   { name: "Altar of Greed",   color: "#ffd24a", blurb: "Gold tesseracts are worth double this level. The crowd that comes with them is not shy." },
  curses:  { name: "Altar of Curses",  color: "#ff5c7a", blurb: "Take a curse that does not last, or one that does, and the altar pays in gold tesseracts." }
};
Altars.reset = function () { Altars.current = null; var p = document.getElementById("altar-choice"); if (p) p.hidden = true; };
Altars.near = function () {
  var pcx = Enemy.pcx(), pcy = Enemy.pcy(), list = Level.altars || [];
  for (var i = 0; i < list.length; i++) {
    var a = list[i];
    if (!a.used && Level.isSolid(a.col, a.row) && Math.abs(pcx - a.x) < CONFIG.ALTAR.useRange && Math.abs(pcy - (a.topY - 24)) < 70) return a;
  }
  return null;
};
Altars.open = function (a) {
  Altars.current = a; Game.mode = "altar"; Game.showMessage(Altars.defs[a.type].name);
  if (a.type === "chance") Altars.openChance(a);
  else if (a.type === "duality") Altars.openDuality(a);
  else if (a.type === "greed") Altars.openGreed(a);
  else Altars.openCurses(a);
};
Altars.leave = function () { var p = document.getElementById("altar-choice"); if (p) p.hidden = true; Altars.current = null; if (Game.mode === "altar") Game.mode = "playing"; };
Altars.consume = function (a) { a.used = true; if (typeof Draw !== "undefined" && Draw.burst) Draw.burst(a.x, a.topY - 60, Altars.defs[a.type].color, 24); };
// cards: [{ title, lines: [{ text, cls }], cls, onClick }]
Altars.show = function (def, text, cards) {
  var panel = document.getElementById("altar-choice"), box = document.getElementById("altar-cards");
  document.getElementById("altar-title").textContent = def.name; document.getElementById("altar-text").textContent = text;
  box.innerHTML = "";
  cards.forEach(function (card) {
    var b = document.createElement("button"), s = document.createElement("strong");
    b.className = "altar-card" + (card.cls ? " " + card.cls : ""); s.textContent = card.title; b.appendChild(s);
    (card.lines || []).forEach(function (line) { var sp = document.createElement("span"); sp.textContent = line.text; if (line.cls) sp.className = line.cls; b.appendChild(sp); });
    b.addEventListener("click", card.onClick); box.appendChild(b);
  });
  panel.style.setProperty("--altar", def.color); panel.hidden = false;
};
Altars.walkAway = { title: "Walk away", cls: "leave", lines: [{ text: "Nothing happens. The altar stays." }], onClick: function () { Altars.leave(); } };
Altars.result = function (def, kind, text) { Altars.show(def, kind + ": " + text, [{ title: "Continue", lines: [], onClick: Altars.leave }]); Game.showMessage(def.name + " - " + text); };

// ---- Chance: one roll. A buff, a nerf, or a change to the level.
Altars.chanceOutcomes = function () {
  var C = CONFIG.ALTAR.chance, blessingNames = { jump: "High Jump", ammo: "Deep Pockets", speed: "Quick Roll", dash: "Long Dash", magnet: "Tesseract Pull" };
  var tempIds = Game.curseChoices.filter(function (c) { return c.kind === "temporary" && !Game.hasCurse(c.id); });
  var summon = function () { Enemy.openPortals(2, CONFIG.CURSES.dimensionalRift.types); return "Two portals tear open nearby."; };
  return [
    { w: C.buffWeight, kind: "BUFF", run: function () { var t = Features.pick(Object.keys(Game.blessings)); Game.blessings[t]++; return "A free blessing: " + blessingNames[t] + "."; } },
    { w: C.buffWeight, kind: "BUFF", run: function () { var g = C.goldMin + Math.floor(Math.random() * (C.goldMax - C.goldMin + 1)); Game.goldTesseracts += g; return "+" + g + " gold tesseracts."; } },
    { w: C.buffWeight, kind: "BUFF", run: function () { Player.invincibilityTimer = C.shieldFrames; return "A divine shield. " + (C.shieldFrames / 60) + " seconds of invincibility."; } },
    { w: C.nerfWeight, kind: "NERF", run: summon },
    { w: C.nerfWeight, kind: "NERF", run: function () { if (!tempIds.length) return summon(); var c = Features.pick(tempIds); Game.addCurse(c.id, 1); return c.name + " clings to you for this level."; } },
    { w: C.nerfWeight, kind: "NERF", run: function () { if (Game.goldTesseracts <= 0) return summon(); var lost = Math.min(Game.goldTesseracts, 3); Game.goldTesseracts -= lost; return "The altar takes " + lost + " gold tesseracts."; } },
    { w: C.levelWeight, kind: "LEVEL", run: function () { Game.levelMods.gravity *= C.gravityLow; return "Featherweight. Gravity is " + Game.pct(C.gravityLow) + "% lower this level."; } },
    { w: C.levelWeight, kind: "LEVEL", run: function () { Game.levelMods.gravity *= C.gravityHigh; return "Heavy air. Gravity is " + Math.round((C.gravityHigh - 1) * 100) + "% higher this level."; } },
    { w: C.levelWeight, kind: "LEVEL", run: function () { Game.levelMods.collapse *= C.collapseFast; Level.collapseTimer = Math.min(Level.collapseTimer, Math.round(CONFIG.COLLAPSE_INTERVAL * Features.collapseMult())); return "Brittle ground. The collapse comes " + Game.pct(C.collapseFast) + "% faster."; } },
    { w: C.levelWeight, kind: "LEVEL", run: function () { Enemy.scaleSpeed(C.enemyCalm, false); return "Calm air. Enemies are " + Game.pct(C.enemyCalm) + "% slower this level."; } },
    { w: C.levelWeight, kind: "LEVEL", run: function () { Enemy.scaleSpeed(C.enemyFrenzy, false); return "Frenzy. Enemies are " + Math.round((C.enemyFrenzy - 1) * 100) + "% faster this level."; } }
  ];
};
Altars.openChance = function (a) {
  var def = Altars.defs.chance;
  Altars.show(def, def.blurb, [
    { title: "Roll the die", lines: [{ text: "Could buff you. Could nerf you. Could change the level." }], onClick: function () {
      var list = Altars.chanceOutcomes(), total = list.reduce(function (n, o) { return n + o.w; }, 0), roll = Math.random() * total, outcome = list[0];
      for (var i = 0; i < list.length; i++) { roll -= list[i].w; if (roll <= 0) { outcome = list[i]; break; } }
      var text = outcome.run(); Altars.consume(a); Altars.result(def, outcome.kind, text);
    } },
    Altars.walkAway
  ]);
};

// ---- Duality: pick one buff + nerf pair. These last the whole run.
Altars.dualities = [
  { id: "glass", name: "Glass Cannon", buff: "Weapon damage x1.75", nerf: "Enemies act 20% faster", apply: function () { Game.mods.damage *= 1.75; Enemy.scaleCooldown(0.8); } },
  { id: "machine", name: "Machine Spirit", buff: "Matrix Tesseract for free (flat speed, no momentum)", nerf: "Jump power -2", apply: function () { Game.upgrades.matrix = true; Game.mods.jumpAdd -= 2; } },
  { id: "rocketHeart", name: "Rocket Heart", buff: "Jet Boots for free", nerf: "Enemies move 15% faster", apply: function () { Game.upgrades.jets = true; Enemy.scaleSpeed(1.15, true); } },
  { id: "hoarder", name: "Hoarder's Bargain", buff: "Gold tesseracts are worth x1.5", nerf: "The collapse comes 25% faster", apply: function () { Game.mods.gold *= 1.5; Game.mods.collapse *= 0.75; } },
  { id: "featherfall", name: "Featherfall", buff: "Gravity x0.7 (you float)", nerf: "Acceleration x0.75", apply: function () { Game.mods.gravity *= 0.7; Game.mods.accel *= 0.75; } }
];
Altars.openDuality = function (a) {
  var def = Altars.defs.duality, pool = Features.shuffle(Altars.dualities.filter(function (d) { return Game.dualityLog.indexOf(d.id) < 0; })).slice(0, 3);
  if (!pool.length) { Altars.show(def, "You have already taken every bargain this altar offers.", [Altars.walkAway]); return; }
  Altars.show(def, def.blurb, pool.map(function (d) {
    return { title: d.name, lines: [{ text: "+ " + d.buff, cls: "buff" }, { text: "- " + d.nerf, cls: "nerf" }], onClick: function () { d.apply(); Game.dualityLog.push(d.id); Altars.consume(a); Altars.result(def, "BARGAIN", d.name + " accepted."); } };
  }).concat([Altars.walkAway]));
};

// ---- Greed: double gold tesseracts this level, a lot of enemies
Altars.openGreed = function (a) {
  var def = Altars.defs.greed, G = CONFIG.ALTAR;
  Altars.show(def, def.blurb, [
    { title: "Accept the offer", lines: [{ text: "+ Gold tesseracts x" + G.greedGoldMult + " this level", cls: "buff" }, { text: "- " + G.greedEnemies + " enemies pour in through portals", cls: "nerf" }], onClick: function () {
      Game.levelMods.gold *= G.greedGoldMult; Enemy.openPortals(G.greedEnemies, CONFIG.CURSES.dimensionalRift.types);
      Altars.consume(a); Altars.result(def, "GREED", "gold is worth double, and the crowd is coming."); } },
    Altars.walkAway
  ]);
};

// ---- Curses: a temporary or Greater curse for lots of gold
Altars.openCurses = function (a) {
  var def = Altars.defs.curses, offers = Game.rollCurseOffers(3, ["temporary", "greater"]);
  if (!offers.length) { Altars.show(def, "You already carry every curse this altar can give.", [Altars.walkAway]); return; }
  Altars.show(def, def.blurb, offers.map(function (c) {
    var reward = CONFIG.ALTAR.rewards[c.kind];
    return { title: c.name, cls: c.kind === "greater" ? "greater" : "", lines: [{ text: c.description }, { text: c.kind === "greater" ? "Greater: lasts the whole run" : "Temporary: lasts " + c.rounds + " rounds", cls: "nerf" }, { text: "+ " + reward + " gold tesseracts", cls: "buff" }],
      onClick: function () { Game.addCurse(c.id); Game.goldTesseracts += reward; Altars.consume(a); Altars.result(def, "CURSED", c.name + " taken for " + reward + " gold tesseracts."); } };
  }).concat([Altars.walkAway]));
};
