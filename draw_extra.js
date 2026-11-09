/* =====================================================================
   draw_extra.js -- THE LOOK (content pass 3).

   Loaded right after draw.js. It owns the frame (Draw.everything), the
   terrain, tesseracts, player, HUD, and everything new: beacon, jump pads,
   altars, ice, Tar, cogs, AK-47. The per-enemy drawing in draw.js is
   reused and just gets a glow and a few extra details here.

   Look: a void of deep violet, rock lit from above, neon edges that glow.
     terrain  = violet rock, bright top lip
     mint     = jump pads (the only mint on screen)
     white/lilac light = the beacon
     each altar has its own colour
     orange   = Dimensional, green = mold, cyan = invincible (as before)
   ===================================================================== */
Draw.sparks = []; Draw.trail = []; Draw.shake = 0; Draw.vignetteGradient = null; Draw.cameraY = 0;

// Camera: follows you sideways (clamped to the level) and upward (never below the ground view). It also keeps the mouse's world position current.
Draw.updateCamera = function () {
  var W = CONFIG.CANVAS_W, H = CONFIG.CANVAS_H, furthest = Math.max(0, Level.pixelWidth() - W);
  Draw.cameraX = Math.max(0, Math.min(furthest, Player.x - W / 2));
  var targetY = Math.min(0, Player.y + CONFIG.PLAYER_SIZE / 2 - H * 0.55);
  Draw.cameraY = Math.abs(targetY - Draw.cameraY) > 2000 ? targetY : Draw.cameraY + (targetY - Draw.cameraY) * 0.14;
  Input.mouseX = Input.screenX + Draw.cameraX; Input.mouseY = Input.screenY + Draw.cameraY;
};

Draw.F = function (px, bold) { return (bold ? "bold " : "") + px + "px Audiowide, monospace"; };
Draw.hash = function (a, b) { return ((a * 73856093) ^ (b * 19349663)) >>> 0; };
Draw.roundRect = function (x, y, w, h, r) {
  var ctx = Draw.ctx; ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
};
Draw.bar = function (x, y, w, h, frac, color) {
  var ctx = Draw.ctx; ctx.save(); ctx.fillStyle = "rgba(0,0,0,0.6)"; ctx.fillRect(x, y, w, h); ctx.fillStyle = color; ctx.fillRect(x + 1, y + 1, (w - 2) * Math.max(0, Math.min(1, frac)), h - 2); ctx.strokeStyle = "rgba(255,255,255,0.3)"; ctx.lineWidth = 1; ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1); ctx.restore();
};

// ---------------------------------------------------------------- effects
Draw.burst = function (x, y, color, count) {
  for (var i = 0; i < (count || 12); i++) {
    var a = Math.random() * Math.PI * 2, s = 1 + Math.random() * 4.5;
    Draw.sparks.push({ x: x, y: y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 0.6, life: 20 + Math.random() * 20, age: 0, color: color, size: 1.5 + Math.random() * 2.5 });
  }
  if (Draw.sparks.length > 400) Draw.sparks.splice(0, Draw.sparks.length - 400);
};
Draw.addShake = function (amount) { Draw.shake = Math.min(10, Draw.shake + amount); };
Draw.drawSparks = function () {
  var ctx = Draw.ctx;
  ctx.save(); ctx.globalCompositeOperation = "lighter";
  for (var i = Draw.sparks.length - 1; i >= 0; i--) {
    var p = Draw.sparks[i];
    if (Game.mode === "playing") { p.age++; p.x += p.vx; p.y += p.vy; p.vy += 0.12; p.vx *= 0.97; }
    if (p.age >= p.life) { Draw.sparks.splice(i, 1); continue; }
    ctx.globalAlpha = 1 - p.age / p.life; ctx.fillStyle = p.color; ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
  }
  ctx.restore();
};

// ---------------------------------------------------------------- the frame
Draw.everything = function () {
  var ctx = Draw.ctx;
  Draw.background();
  if (Game.mode !== "command") Draw.updateParticles();
  Draw.drawParticles();
  if (Game.mode === "playing") { Draw.trail.push({ x: Player.x + CONFIG.PLAYER_SIZE / 2, y: Player.y + CONFIG.PLAYER_SIZE / 2 }); if (Draw.trail.length > 10) Draw.trail.shift(); }
  var sx = Draw.shake > 0.3 ? (Math.random() - 0.5) * Draw.shake * 2 : 0, sy = Draw.shake > 0.3 ? (Math.random() - 0.5) * Draw.shake * 2 : 0;
  Draw.shake *= 0.86;
  ctx.save();
  ctx.translate(-Draw.cameraX + sx, -Draw.cameraY + sy);
  Draw.world();
  Draw.pads();
  Draw.altars();
  Draw.beacon();
  Draw.mold();
  Draw.tarClock();
  Draw.dominoEffects();
  Draw.portals();
  Draw.enemies();
  Draw.lasers();
  Draw.explosions();
  Draw.projectiles();
  Draw.akStuff();
  Draw.player();
  var W = Level.pixelWidth(), pw = CONFIG.PLAYER_SIZE; // edges wrap: show the other half of the ball on the far side
  if (Player.x < 40) { ctx.save(); ctx.translate(W, 0); Draw.player(); ctx.restore(); }
  else if (Player.x + pw > W - 40) { ctx.save(); ctx.translate(-W, 0); Draw.player(); ctx.restore(); }
  Draw.drawSparks();
  ctx.restore();
  Draw.vignette();
  Draw.hud();
};
Draw.background = function () {
  var ctx = Draw.ctx, W = CONFIG.CANVAS_W, H = CONFIG.CANVAS_H;
  var g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, "#04000a"); g.addColorStop(0.6, "#0f0221"); g.addColorStop(1, "#210740");
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  // two layers of distant monoliths, drifting slower than the world
  [{ speed: 0.18, gap: 190, alpha: 0.10, base: 90 }, { speed: 0.4, gap: 140, alpha: 0.16, base: 60 }].forEach(function (layer, li) {
    var offset = Draw.cameraX * layer.speed, first = Math.floor(offset / layer.gap) - 1;
    ctx.fillStyle = "rgba(157,63,255," + layer.alpha + ")";
    for (var i = first; i < first + Math.ceil(W / layer.gap) + 3; i++) {
      var h = Draw.hash(i, li + 7), w = 26 + (h % 40), ht = layer.base + ((h >> 5) % 150), x = i * layer.gap - offset + ((h >> 11) % 40);
      var lift = -Draw.cameraY * layer.speed * 0.6; ctx.beginPath(); ctx.moveTo(x, H + lift); ctx.lineTo(x, H + lift - ht + 14); ctx.lineTo(x + w / 2, H + lift - ht); ctx.lineTo(x + w, H + lift - ht + 14); ctx.lineTo(x + w, H + lift); ctx.closePath(); ctx.fill();
    }
  });
  var glow = ctx.createRadialGradient(W / 2, H + 40, 10, W / 2, H + 40, 380); glow.addColorStop(0, "rgba(199,125,255,0.20)"); glow.addColorStop(1, "rgba(199,125,255,0)");
  ctx.fillStyle = glow; ctx.fillRect(0, 0, W, H);
};
Draw.vignette = function () {
  var ctx = Draw.ctx, W = CONFIG.CANVAS_W, H = CONFIG.CANVAS_H;
  if (!Draw.vignetteGradient) { Draw.vignetteGradient = ctx.createRadialGradient(W / 2, H / 2, H * 0.45, W / 2, H / 2, W * 0.62); Draw.vignetteGradient.addColorStop(0, "rgba(0,0,0,0)"); Draw.vignetteGradient.addColorStop(1, "rgba(0,0,0,0.5)"); }
  ctx.fillStyle = Draw.vignetteGradient; ctx.fillRect(0, 0, W, H);
};

// ---------------------------------------------------------------- terrain
Draw.world = function () {
  var size = CONFIG.TILE, firstCol = Math.floor(Draw.cameraX / size) - 1, lastCol = firstCol + Math.ceil(CONFIG.CANVAS_W / size) + 2, ctx = Draw.ctx;
  var warning = Level.collapseWarning > 0, warningCols = warning ? Level.collapseColumns : null;
  for (var row = Math.floor(Draw.cameraY / size) - 1; row < CONFIG.ROWS; row++) for (var col = firstCol; col <= lastCol; col++) {
    var here = Level.charAt(col, row), x = col * size, y = row * size, atRisk = warning && warningCols.indexOf(col) >= 0;
    if (here === "#") { if (atRisk) Draw.blockWarning(x, y, size); else Draw.block(x, y, size); }
    else if (here === "^") { if (atRisk) Draw.spikeWarning(x, y, size); else Draw.spike(x, y, size); }
  }
  if (warning && warningCols.length) {
    var spanStart = Math.min.apply(null, warningCols) * size, spanEnd = (Math.max.apply(null, warningCols) + 1) * size;
    ctx.save(); ctx.globalAlpha = 0.55; ctx.strokeStyle = "#ffffff"; ctx.lineWidth = 3; ctx.setLineDash([10, 8]); ctx.lineDashOffset = -Date.now() / 30;
    ctx.beginPath(); ctx.moveTo(spanStart, 0); ctx.lineTo(spanStart, CONFIG.CANVAS_H); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(spanEnd, 0); ctx.lineTo(spanEnd, CONFIG.CANVAS_H); ctx.stroke();
    ctx.restore();
  }
  Level.redTesseracts.forEach(function (tesseract) { if (!tesseract.collected) Draw.tesseract(tesseract.x, tesseract.y, "#c724ff"); });
  if (Level.goldActive) Level.goldTesseracts.forEach(function (tesseract) { if (!tesseract.collected) Draw.tesseract(tesseract.x, tesseract.y, "#f2d9ff"); });
  Level.fakeTesseracts.forEach(function (tesseract) { Draw.fakeTesseract(tesseract.x, tesseract.y); });
};
Draw.block = function (x, y, size) {
  var ctx = Draw.ctx, col = Math.round(x / size), row = Math.round(y / size), h = Draw.hash(col, row);
  var airUp = !Level.isSolid(col, row - 1), airDown = !Level.isSolid(col, row + 1), airLeft = !Level.isSolid(col - 1, row), airRight = !Level.isSolid(col + 1, row);
  ctx.fillStyle = ["#3b1675", "#40187d", "#371270"][h % 3]; ctx.fillRect(x, y, size, size);
  ctx.fillStyle = "rgba(0,0,0,0.22)"; ctx.fillRect(x, y + size * 0.62, size, size * 0.38); // darker toward the bottom of each block
  ctx.strokeStyle = "rgba(255,255,255,0.06)"; ctx.lineWidth = 1; ctx.beginPath(); // a crack or two, different on every tile
  ctx.moveTo(x + 6 + (h & 15), y + 4); ctx.lineTo(x + 12 + ((h >> 4) & 15), y + 18 + ((h >> 8) & 7)); ctx.lineTo(x + 8 + ((h >> 12) & 15), y + size - 4); ctx.stroke();
  if (airUp) { ctx.fillStyle = "#a45cf0"; ctx.fillRect(x, y, size, 5); ctx.fillStyle = "#e3c4ff"; ctx.fillRect(x, y, size, 2); }
  if (airLeft) { ctx.fillStyle = "#7d3fd0"; ctx.fillRect(x, y, 2, size); }
  if (airRight) { ctx.fillStyle = "#24094a"; ctx.fillRect(x + size - 2, y, 2, size); }
  if (airDown) { ctx.fillStyle = "#1b0638"; ctx.fillRect(x, y + size - 3, size, 3); }
  if (Level.iceBuilt && Level.iceCols[col]) { // Sub-Zero
    ctx.fillStyle = "rgba(150,225,255,0.42)"; ctx.fillRect(x, y, size, size);
    if (airUp) { ctx.fillStyle = "#e9fbff"; ctx.fillRect(x, y, size, 4); ctx.fillStyle = "rgba(255,255,255,0.7)"; ctx.fillRect(x + 6 + (h % 14), y + 6, 10, 2); }
  }
};
Draw.blockWarning = function (x, y, size) {
  var ctx = Draw.ctx, on = Math.floor(Date.now() / 110) % 2 === 0;
  ctx.fillStyle = on ? "#ffffff" : "#ffd6f6"; ctx.fillRect(x, y, size, size);
  ctx.strokeStyle = "#ff2fd0"; ctx.lineWidth = 2; ctx.strokeRect(x + 1, y + 1, size - 2, size - 2);
};
Draw.spike = function (x, y, size) {
  var ctx = Draw.ctx, g = ctx.createLinearGradient(0, y, 0, y + size);
  g.addColorStop(0, "#f3dcff"); g.addColorStop(1, "#8a3bf0");
  ctx.save(); ctx.shadowColor = "#b36bff"; ctx.shadowBlur = 9; ctx.fillStyle = g;
  ctx.beginPath(); ctx.moveTo(x + 1, y + size); ctx.lineTo(x + size / 2, y); ctx.lineTo(x + size - 1, y + size); ctx.closePath(); ctx.fill(); ctx.restore();
  ctx.strokeStyle = "rgba(255,255,255,0.55)"; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(x + size / 2, y + 3); ctx.lineTo(x + size * 0.28, y + size - 3); ctx.stroke();
};
Draw.spikeWarning = function (x, y, size) {
  var ctx = Draw.ctx; ctx.fillStyle = Math.floor(Date.now() / 110) % 2 === 0 ? "#ffffff" : "#ffd6f6";
  ctx.beginPath(); ctx.moveTo(x, y + size); ctx.lineTo(x + size / 2, y); ctx.lineTo(x + size, y + size); ctx.closePath(); ctx.fill();
};
Draw.tesseract = function (x, y, color) {
  var ctx = Draw.ctx, t = Date.now() / 700 + x * 0.013;
  ctx.save(); ctx.translate(x, y + Math.sin(t * 2) * 2.5); ctx.shadowColor = color; ctx.shadowBlur = 16;
  ctx.save(); ctx.rotate(t); ctx.fillStyle = color; ctx.fillRect(-9, -9, 18, 18); ctx.restore();
  ctx.save(); ctx.rotate(-t * 1.4); ctx.fillStyle = "#1a0033"; ctx.fillRect(-5.5, -5.5, 11, 11); ctx.restore();
  ctx.shadowBlur = 0; ctx.fillStyle = "#ffffff"; ctx.globalAlpha = 0.85; ctx.fillRect(-1.5, -1.5, 3, 3);
  ctx.restore();
};

// ---------------------------------------------------------------- the beacon (replaces the Finish flag)
Draw.beacon = function () {
  var b = Level.beacon, ctx = Draw.ctx; if (!b) return;
  var t = Date.now() / 1000;
  if (!Level.beaconOpen()) {
    if (Game.hasCurse("diamondCuboid")) return; // the cuboid is the beacon this round
    ctx.save(); ctx.strokeStyle = "#c77dff"; ctx.globalAlpha = 0.28; ctx.lineWidth = 2; ctx.setLineDash([6, 8]); ctx.lineDashOffset = -t * 12;
    ctx.beginPath(); ctx.arc(b.x, b.y, 22, 0, Math.PI * 2); ctx.stroke();
    ctx.setLineDash([]); ctx.fillStyle = "#c77dff"; ctx.globalAlpha = 0.22; ctx.beginPath(); ctx.arc(b.x, b.y, 4, 0, Math.PI * 2); ctx.fill(); ctx.restore();
    return;
  }
  var pulse = 1 + Math.sin(t * 3) * 0.08;
  ctx.save(); ctx.globalCompositeOperation = "lighter";
  var beamW = 26 * pulse, beam = ctx.createLinearGradient(b.x - beamW, 0, b.x + beamW, 0);
  beam.addColorStop(0, "rgba(199,125,255,0)"); beam.addColorStop(0.5, "rgba(255,245,255,0.55)"); beam.addColorStop(1, "rgba(199,125,255,0)");
  ctx.fillStyle = beam; ctx.fillRect(b.x - beamW, -20, beamW * 2, b.platformY + 20);
  var halo = ctx.createRadialGradient(b.x, b.y, 4, b.x, b.y, 64 * pulse); halo.addColorStop(0, "rgba(255,255,255,0.95)"); halo.addColorStop(0.3, "rgba(224,179,255,0.55)"); halo.addColorStop(1, "rgba(157,63,255,0)");
  ctx.fillStyle = halo; ctx.beginPath(); ctx.arc(b.x, b.y, 64 * pulse, 0, Math.PI * 2); ctx.fill();
  ctx.translate(b.x, b.y); ctx.rotate(t * 0.5); ctx.fillStyle = "rgba(255,240,255,0.55)";
  for (var k = 0; k < 8; k++) { ctx.rotate(Math.PI / 4); ctx.beginPath(); ctx.moveTo(0, -10); ctx.lineTo(3, -(46 + (k % 2) * 18) * pulse); ctx.lineTo(-3, -(46 + (k % 2) * 18) * pulse); ctx.closePath(); ctx.fill(); }
  ctx.restore();
  ctx.save(); ctx.fillStyle = "#ffffff"; ctx.shadowColor = "#ffffff"; ctx.shadowBlur = 20; ctx.beginPath(); ctx.arc(b.x, b.y, 9, 0, Math.PI * 2); ctx.fill(); ctx.restore();
  ctx.save(); ctx.fillStyle = "#ffffff"; // motes rising up the beam
  for (var m = 0; m < 14; m++) { var my = b.platformY - ((t * 40 + m * 37) % b.platformY), mx = b.x + Math.sin(t * 2 + m * 1.7) * 14; ctx.globalAlpha = 0.5 * (my / b.platformY); ctx.fillRect(mx - 1, my, 2, 2); }
  ctx.restore();
};

// ---------------------------------------------------------------- jump pads
Draw.pads = function () {
  var ctx = Draw.ctx, T = CONFIG.TILE, left = Draw.cameraX - T, right = Draw.cameraX + CONFIG.CANVAS_W + T, now = Date.now();
  for (var k in Level.pads) {
    var p = Level.pads[k]; if (!Level.isSolid(p.c, p.r)) continue;
    var x = p.c * T, y = p.r * T; if (x < left || x > right) continue;
    var squash = Math.max(0, 1 - (now - p.t) / 220), bob = 0.5 + 0.5 * Math.sin(now / 260 + p.c);
    ctx.save(); ctx.globalCompositeOperation = "lighter"; // a faint beam shows it throws you upward
    var beam = ctx.createLinearGradient(0, y, 0, y - 420); beam.addColorStop(0, "rgba(77,255,210," + (0.22 + 0.1 * bob + squash * 0.3) + ")"); beam.addColorStop(1, "rgba(77,255,210,0)");
    ctx.fillStyle = beam; ctx.fillRect(x + 6, y - 420, T - 12, 420); ctx.restore();
    ctx.save(); ctx.shadowColor = "#4dffd2"; ctx.shadowBlur = 14;
    ctx.fillStyle = "#4dffd2"; ctx.fillRect(x, y - 2 - (1 - squash) * 3, T, 5);                   // glowing launch plate across the top
    ctx.fillStyle = "rgba(77,255,210,0.35)"; ctx.fillRect(x + 4, y + 6, T - 8, 3); ctx.restore();   // light line on the face of the block
    ctx.save(); ctx.strokeStyle = "#4dffd2"; ctx.lineWidth = 2.5; ctx.globalAlpha = 0.35 + 0.55 * bob;
    for (var c = 0; c < 3; c++) { var cy = y - 14 - c * 10 - bob * 5; ctx.beginPath(); ctx.moveTo(x + T / 2 - 7, cy + 5); ctx.lineTo(x + T / 2, cy - 2); ctx.lineTo(x + T / 2 + 7, cy + 5); ctx.stroke(); }
    ctx.restore();
  }
};

// ---------------------------------------------------------------- altars
Draw.altarSymbol = function (type, color, used) {
  var ctx = Draw.ctx; ctx.lineWidth = 2.5; ctx.strokeStyle = color; ctx.fillStyle = color;
  if (type === "chance") { // a die
    ctx.rotate(Math.PI / 4); ctx.strokeRect(-9, -9, 18, 18); ctx.rotate(-Math.PI / 4);
    [[-4, -4], [4, 4], [0, 0], [-4, 4], [4, -4]].forEach(function (d) { ctx.beginPath(); ctx.arc(d[0], d[1], 1.8, 0, Math.PI * 2); ctx.fill(); });
  } else if (type === "duality") { // two halves
    ctx.beginPath(); ctx.arc(0, 0, 12, 0, Math.PI * 2); ctx.stroke();
    ctx.beginPath(); ctx.arc(0, 0, 12, -Math.PI / 2, Math.PI / 2); ctx.closePath(); ctx.fill();
    ctx.fillStyle = used ? "#555" : "#12002a"; ctx.beginPath(); ctx.arc(0, -6, 3, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = color; ctx.beginPath(); ctx.arc(0, 6, 3, 0, Math.PI * 2); ctx.fill();
  } else if (type === "greed") { // a coin
    ctx.beginPath(); ctx.arc(0, 0, 12, 0, Math.PI * 2); ctx.stroke(); ctx.beginPath(); ctx.arc(0, 0, 8, 0, Math.PI * 2); ctx.stroke();
    ctx.font = Draw.F(12, true); ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText("$", 0, 1);
  } else { // an eye
    ctx.beginPath(); ctx.moveTo(-14, 0); ctx.quadraticCurveTo(0, -14, 14, 0); ctx.quadraticCurveTo(0, 14, -14, 0); ctx.closePath(); ctx.stroke();
    ctx.beginPath(); ctx.arc(0, 0, 4.5, 0, Math.PI * 2); ctx.fill();
  }
};
Draw.altars = function () {
  var ctx = Draw.ctx, T = CONFIG.TILE, left = Draw.cameraX - 60, right = Draw.cameraX + CONFIG.CANVAS_W + 60, now = Date.now(), near = Game.mode === "playing" ? Altars.near() : null;
  (Level.altars || []).forEach(function (a) {
    if (a.x < left || a.x > right || !Level.isSolid(a.col, a.row)) return;
    var def = Altars.defs[a.type], color = a.used ? "#5a4a70" : def.color, y = a.topY, bob = Math.sin(now / 500 + a.col) * 3;
    ctx.save();
    ctx.fillStyle = "#1c0838"; ctx.fillRect(a.x - 17, y - 8, 34, 8);                         // plinth
    var g = ctx.createLinearGradient(a.x - 12, 0, a.x + 12, 0); g.addColorStop(0, "#2d1055"); g.addColorStop(0.5, "#4a1f86"); g.addColorStop(1, "#24093f");
    ctx.fillStyle = g; ctx.fillRect(a.x - 12, y - 40, 24, 32);                               // shaft
    ctx.fillStyle = "#5b2aa3"; ctx.fillRect(a.x - 17, y - 46, 34, 6);                        // cap
    ctx.fillStyle = color; ctx.globalAlpha = a.used ? 0.4 : 1; ctx.fillRect(a.x - 17, y - 46, 34, 1.5); ctx.fillRect(a.x - 1.5, y - 36, 3, 18); // rune line
    ctx.globalAlpha = 1; ctx.shadowColor = color; ctx.shadowBlur = a.used ? 0 : 16;
    ctx.translate(a.x, y - 66 + bob); Draw.altarSymbol(a.type, color, a.used);
    ctx.restore();
    if (near === a) {
      ctx.save(); ctx.font = Draw.F(12, true); ctx.textAlign = "center"; var label = "[F]  " + def.name, w = ctx.measureText(label).width + 18;
      ctx.fillStyle = "rgba(10,0,22,0.82)"; Draw.roundRect(a.x - w / 2, y - 118, w, 22, 6); ctx.fill(); ctx.strokeStyle = def.color; ctx.lineWidth = 1.5; ctx.stroke();
      ctx.fillStyle = def.color; ctx.fillText(label, a.x, y - 102); ctx.restore();
    }
  });
};

// ---------------------------------------------------------------- Tar clock and cogs
Draw.gear = function (x, y, r, rot, color) {
  var ctx = Draw.ctx, teeth = 8;
  ctx.save(); ctx.translate(x, y); ctx.rotate(rot); ctx.fillStyle = color; ctx.beginPath();
  for (var i = 0; i < teeth * 2; i++) { var a = i / (teeth * 2) * Math.PI * 2, rr = i % 2 ? r * 0.72 : r; ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); }
  ctx.closePath(); ctx.fill(); ctx.fillStyle = "#1a0f00"; ctx.beginPath(); ctx.arc(0, 0, r * 0.28, 0, Math.PI * 2); ctx.fill(); ctx.restore();
};
Draw.tarClock = function () {
  var t = Features.tar, ctx = Draw.ctx, now = Date.now(); if (!t) return;
  var R = CONFIG.TAR.radius, awake = t.state === "awake", fill = awake ? 1 : t.missed / CONFIG.TAR.missesToWake;
  Features.cogs.forEach(function (cog) {
    var fade = cog.age > CONFIG.TAR.cogLife - 120 && Math.floor(cog.age / 6) % 2 === 0 ? 0.35 : 1; // blinks when about to expire
    ctx.save(); ctx.globalAlpha = fade; ctx.shadowColor = "#ffcc66"; ctx.shadowBlur = 14; Draw.gear(cog.x, cog.y + Math.sin(now / 300 + cog.x) * 3, 13, now / 500, "#ffcc66"); ctx.restore();
  });
  ctx.save(); ctx.translate(t.x, t.y);
  if (awake) { ctx.shadowColor = "#ff2a4d"; ctx.shadowBlur = 26; }
  ctx.fillStyle = "#16111f"; ctx.beginPath(); ctx.arc(0, 0, R, 0, Math.PI * 2); ctx.fill();
  ctx.save(); ctx.beginPath(); ctx.arc(0, 0, R - 3, 0, Math.PI * 2); ctx.clip();                  // tar level inside the clock
  var level = R - 3 - fill * (R * 2 - 6), wave = Math.sin(now / 300) * 3;
  ctx.fillStyle = "#07040c"; ctx.beginPath(); ctx.moveTo(-R, R); ctx.lineTo(-R, level);
  for (var x = -R; x <= R; x += 8) ctx.lineTo(x, level + Math.sin(x * 0.2 + now / 250) * 2 + wave * 0.3);
  ctx.lineTo(R, R); ctx.closePath(); ctx.fill(); ctx.restore();
  ctx.shadowBlur = awake ? 26 : 0; ctx.strokeStyle = awake ? "#ff5a73" : "#7d708f"; ctx.lineWidth = 5; ctx.beginPath(); ctx.arc(0, 0, R, 0, Math.PI * 2); ctx.stroke();
  ctx.shadowBlur = 0; ctx.strokeStyle = "rgba(255,255,255,0.35)"; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(0, 0, R - 9, Math.PI * 1.15, Math.PI * 1.45); ctx.stroke(); // gloss
  ctx.strokeStyle = awake ? "#ff9aa8" : "#a99dbc"; ctx.lineWidth = 2;
  for (var i = 0; i < 12; i++) { var a = i * Math.PI / 6; ctx.beginPath(); ctx.moveTo(Math.cos(a) * (R - 8), Math.sin(a) * (R - 8)); ctx.lineTo(Math.cos(a) * (R - 14), Math.sin(a) * (R - 14)); ctx.stroke(); }
  var sweep = -Math.PI / 2 + (1 - t.cogTimer / t.cogTotal) * Math.PI * 2;                              // the long hand sweeps to the next cog
  ctx.lineWidth = 3; ctx.strokeStyle = awake ? "#ff5a73" : "#ffcc66"; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(Math.cos(sweep) * (R - 14), Math.sin(sweep) * (R - 14)); ctx.stroke();
  ctx.strokeStyle = "#b9aecb"; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(Math.cos(-0.9) * (R * 0.5), Math.sin(-0.9) * (R * 0.5)); ctx.stroke();
  ctx.fillStyle = awake ? "#ff5a73" : "#ffcc66"; ctx.beginPath(); ctx.arc(0, 0, 4, 0, Math.PI * 2); ctx.fill();
  if (awake) { ctx.fillStyle = "#ff2a4d"; ctx.shadowColor = "#ff2a4d"; ctx.shadowBlur = 10; ctx.beginPath(); ctx.arc(-14, -16, 4, 0, Math.PI * 2); ctx.arc(14, -16, 4, 0, Math.PI * 2); ctx.fill(); }
  ctx.shadowBlur = 0; ctx.fillStyle = "#07040c"; // drips
  for (var d = -1; d <= 1; d++) { var dl = 10 + ((now / 160 + d * 7) % 14); ctx.fillRect(d * 16 - 2, R - 3, 4, dl); ctx.beginPath(); ctx.arc(d * 16, R - 3 + dl, 3, 0, Math.PI * 2); ctx.fill(); }
  ctx.restore();
};

// ---------------------------------------------------------------- AK-47
Draw.akShape = function (scale) {
  var ctx = Draw.ctx; ctx.save(); ctx.scale(scale, scale);
  ctx.fillStyle = "#6b4a2b"; ctx.fillRect(-18, -2, 9, 6);                  // stock
  ctx.fillStyle = "#3b3b45"; ctx.fillRect(-10, -4, 22, 6); ctx.fillRect(12, -3, 10, 3); // body + barrel
  ctx.fillStyle = "#2a2a32"; ctx.beginPath(); ctx.moveTo(-1, 2); ctx.lineTo(7, 2); ctx.lineTo(10, 12); ctx.lineTo(4, 12); ctx.closePath(); ctx.fill(); // mag
  ctx.fillStyle = "#6b4a2b"; ctx.fillRect(-6, 2, 4, 6);
  ctx.restore();
};
Draw.akStuff = function () {
  var ctx = Draw.ctx, t = Features.ak.thrown;
  Weapons.projectiles.forEach(function (p) {
    if (p.kind !== "akbullet") return;
    ctx.save(); ctx.globalCompositeOperation = "lighter"; ctx.strokeStyle = "#ffe08a"; ctx.lineWidth = 3; ctx.lineCap = "round"; ctx.shadowColor = "#ffb347"; ctx.shadowBlur = 8;
    ctx.beginPath(); ctx.moveTo(p.x - p.vx * 1.1, p.y - p.vy * 1.1); ctx.lineTo(p.x, p.y); ctx.stroke(); ctx.restore();
  });
  if (!t) return;
  ctx.save(); ctx.translate(t.x, t.y); ctx.rotate(t.spin); ctx.shadowColor = "#ffb347"; ctx.shadowBlur = 10; Draw.akShape(1.15); ctx.restore();
};

// ---------------------------------------------------------------- Diamond Cuboid (curse) -- wraps the cuboid drawing
Draw.diamond = function (e) {
  var ctx = Draw.ctx, r = e.radius, t = Date.now() / 400;
  ctx.save(); ctx.translate(e.x, e.y); ctx.shadowColor = "#bff6ff"; ctx.shadowBlur = 30;
  ctx.rotate(e.angle || 0);
  var g = ctx.createLinearGradient(-r, -r, r, r); g.addColorStop(0, "#f4feff"); g.addColorStop(0.5, "#7fd8ff"); g.addColorStop(1, "#b08cff");
  ctx.fillStyle = g; ctx.fillRect(-r, -r, r * 2, r * 2);
  ctx.shadowBlur = 0; ctx.strokeStyle = "rgba(255,255,255,0.9)"; ctx.lineWidth = 3; ctx.strokeRect(-r, -r, r * 2, r * 2);
  ctx.lineWidth = 1.5; ctx.strokeStyle = "rgba(255,255,255,0.65)";
  ctx.beginPath(); ctx.moveTo(-r, -r); ctx.lineTo(r, r); ctx.moveTo(r, -r); ctx.lineTo(-r, r); ctx.moveTo(0, -r); ctx.lineTo(0, r); ctx.moveTo(-r, 0); ctx.lineTo(r, 0); ctx.stroke();
  ctx.strokeRect(-r * 0.5, -r * 0.5, r, r);
  ctx.restore();
  ctx.save(); ctx.globalCompositeOperation = "lighter"; ctx.fillStyle = "#ffffff";
  for (var k = 0; k < 4; k++) { var a = t + k * Math.PI / 2, px = e.x + Math.cos(a) * r * 1.5, py = e.y + Math.sin(a) * r * 1.5; ctx.globalAlpha = 0.5 + 0.5 * Math.sin(t * 3 + k); ctx.fillRect(px - 1.5, py - 6, 3, 12); ctx.fillRect(px - 6, py - 1.5, 12, 3); }
  ctx.restore();
};
(function () {
  var oldCuboid = Draw.cuboid, oldDrone = Draw.drone, oldDrill = Draw.drill, oldGreen = Draw.greenBall, oldDomino = Draw.domino, oldDomEffects = Draw.dominoEffects;
  Draw.cuboid = function (e) { if (e.diamond) { Draw.diamond(e); return; } oldCuboid(e); if (!e.clone) { var ctx = Draw.ctx, r = e.radius; ctx.save(); ctx.translate(e.x, e.y); ctx.rotate(e.angle || 0); ctx.strokeStyle = "rgba(255,255,255,0.12)"; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(-r, -r); ctx.lineTo(r, r); ctx.moveTo(r, -r); ctx.lineTo(-r, r); ctx.stroke(); ctx.restore(); } };
  Draw.drone = function (e) {
    oldDrone(e);
    var ctx = Draw.ctx, s = e.dim ? CONFIG.DIM.drone.scale : 1, blink = Math.floor(Date.now() / 260) % 2;
    ctx.save(); ctx.translate(e.x, e.y); ctx.scale(s, s);
    ctx.fillStyle = e.moldVariant ? "#0a2a14" : "#2a0c47"; ctx.fillRect(-12, -7, 24, 8);                         // canopy
    ctx.fillStyle = blink ? "#ff2fd0" : "#60106a"; ctx.fillRect(-2, -5, 4, 4);                                  // status light
    ctx.fillStyle = "rgba(255,179,71,0.8)"; ctx.beginPath(); ctx.moveTo(-8, 12); ctx.lineTo(8, 12); ctx.lineTo(0, 12 + 6 + Math.random() * 5); ctx.closePath(); ctx.fill(); // thruster
    ctx.restore();
  };
  Draw.drill = function (e) {
    oldDrill(e);
    var ctx = Draw.ctx, r = e.radius; ctx.save(); ctx.translate(e.x, e.y); ctx.rotate(e.angle || 0);
    ctx.strokeStyle = "rgba(255,255,255,0.35)"; ctx.lineWidth = 2;
    for (var k = 1; k <= 3; k++) { var x = r + 8 - k * ((r * 2 + 8) / 4); var h = r * (1 - (r + 8 - x) / (r * 2 + 8)); ctx.beginPath(); ctx.moveTo(x, -h); ctx.lineTo(x + 3, h); ctx.stroke(); }
    ctx.restore();
  };
  Draw.greenBall = function (e) {
    oldGreen(e); var ctx = Draw.ctx;
    ctx.save(); ctx.fillStyle = "rgba(255,255,255,0.28)"; ctx.beginPath(); ctx.arc(e.x - e.radius * 0.35, e.y - e.radius * 0.4, e.radius * 0.22, 0, Math.PI * 2); ctx.fill(); ctx.restore();
  };
  Draw.domino = function (e) { var ctx = Draw.ctx; ctx.save(); if (e.leapState === "airborne" || e.ghost) ctx.globalAlpha = 0.8; oldDomino(e); ctx.restore(); }; // it phases through walls in the air
  Draw.dominoEffects = function () {
    oldDomEffects(); var ctx = Draw.ctx;
    Enemy.enemies.forEach(function (e) { // a ring on the surface it is going to land on
      if (e.type !== "domino" || e.deadTimer > 0 || (e.leapState !== "crouch" && e.leapState !== "airborne") || e.landY == null || e.landY > CONFIG.CANVAS_H + 100) return;
      ctx.save(); ctx.strokeStyle = "#ff2fd0"; ctx.fillStyle = "rgba(255,47,208,0.22)"; ctx.lineWidth = 2; ctx.globalAlpha = 0.6 + 0.4 * Math.sin(Date.now() / 90);
      ctx.beginPath(); ctx.ellipse(e.targetX, e.landY - 2, CONFIG.DOMINO_WIDTH / 2, 9, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); ctx.restore();
    });
  };
})();

// ---------------------------------------------------------------- enemies: same drawing as before, plus a glow in their own colour
Draw.glowFor = function (e) {
  if (e.moldVariant || e.moldRoller || e.type === "mold" || e.type === "moldPlant") return "#2ecc5a";
  if (e.dim) return "#ff9f1c";
  switch (e.type) { case "drone": return "#b45fe0"; case "drill": return "#b026ff"; case "domino": return "#d9c9f0"; case "ase": case "roller": case "rocket": return "#ff2fd0"; default: return "#c77dff"; }
};
Draw.enemies = function () {
  var ctx = Draw.ctx;
  for (var i = 0; i < Enemy.enemies.length; i++) {
    var e = Enemy.enemies[i];
    if (e.deadTimer > 0 || e.remove) continue;
    ctx.save(); ctx.shadowColor = Draw.glowFor(e); ctx.shadowBlur = e.type === "domino" ? 10 : 16;
    if (e.state === "windup" && e.type !== "roller") Draw.windup(e);
    switch (e.type) {
      case "cuboid": Draw.cuboid(e); break;
      case "drone": Draw.drone(e); break;
      case "drill": Draw.drill(e); break;
      case "domino": Draw.domino(e); break;
      case "greenBall4": Draw.greenBall(e); break;
      case "ase": Draw.ase(e); break;
      case "roller": Draw.roller(e); break;
      case "rocket": Draw.rocketLauncher(e); break;
      case "mold": Draw.moldCore(e); break;
      case "moldPlant": Draw.moldPlant(e); break;
    }
    ctx.restore();
  }
  Draw.enemyBullets();
};

// ---------------------------------------------------------------- player
Draw.player = function () {
  Draw.jetFlame();
  var ctx = Draw.ctx, r = CONFIG.PLAYER_RADIUS, cx = Player.x + CONFIG.PLAYER_SIZE / 2, cy = Player.y + CONFIG.PLAYER_SIZE / 2, inv = Player.isInvincible(), rim = inv ? "#66eaff" : "#c77dff";
  ctx.save();
  for (var i = 0; i < Draw.trail.length; i++) { var f = (i + 1) / Draw.trail.length; ctx.globalAlpha = f * 0.18; ctx.fillStyle = rim; ctx.beginPath(); ctx.arc(Draw.trail[i].x, Draw.trail[i].y, r * (0.35 + 0.55 * f), 0, Math.PI * 2); ctx.fill(); }
  ctx.restore();
  ctx.save(); ctx.shadowColor = rim; ctx.shadowBlur = inv ? 24 : 12;
  var g = ctx.createRadialGradient(cx - 5, cy - 6, 2, cx, cy, r); g.addColorStop(0, "#3a2368"); g.addColorStop(1, "#05000d");
  ctx.fillStyle = g; ctx.strokeStyle = rim; ctx.lineWidth = CONFIG.LINE_WIDTH; ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); ctx.restore();
  ctx.strokeStyle = "rgba(255,255,255,0.35)"; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(cx, cy, r - 4.5, Math.PI * 1.1, Math.PI * 1.45); ctx.stroke();
  var dotX = cx + Math.cos(Player.angle) * r * CONFIG.DOT_DISTANCE, dotY = cy + Math.sin(Player.angle) * r * CONFIG.DOT_DISTANCE;
  ctx.fillStyle = rim; ctx.beginPath(); ctx.arc(dotX, dotY, 4, 0, Math.PI * 2); ctx.fill();
  if (Game.hasCurse("heartbreaker")) { // the bomb: a red ring that drains
    var frac = Math.max(0, Features.heart.frames) / CONFIG.CURSES.heartbreaker.capFrames, urgent = Features.heart.frames < 300 && Math.floor(Date.now() / 150) % 2 === 0;
    ctx.save(); ctx.strokeStyle = urgent ? "#ffffff" : "#ff2a4d"; ctx.lineWidth = 3; ctx.shadowColor = "#ff2a4d"; ctx.shadowBlur = 8;
    ctx.beginPath(); ctx.arc(cx, cy, r + 6, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * frac); ctx.stroke(); ctx.restore();
  }
  if (Features.akActive() && !Features.ak.thrown) { // the AK-47 you are carrying, pointed at the mouse
    var ang = Math.atan2(Input.mouseY - cy, Input.mouseX - cx); ctx.save(); ctx.translate(cx, cy); ctx.rotate(ang); ctx.translate(r + 6, 0); if (Math.abs(ang) > Math.PI / 2) ctx.scale(1, -1); Draw.akShape(0.9); ctx.restore();
  }
};

// ---------------------------------------------------------------- HUD
Draw.panel = function (x, y, w, h, border) {
  var ctx = Draw.ctx; ctx.save(); ctx.fillStyle = "rgba(10,0,22,0.66)"; ctx.strokeStyle = border || "rgba(199,125,255,0.4)"; ctx.lineWidth = 1.5; Draw.roundRect(x, y, w, h, 8); ctx.fill(); ctx.stroke(); ctx.restore();
};
Draw.hud = function () {
  var ctx = Draw.ctx; if (!Player.classType) return;
  var W = CONFIG.CANVAS_W, stats = CONFIG.CLASS_STATS[Player.classType], redLeft = Level.redTesseracts.filter(function (t) { return !t.collected; }).length;
  var ak = Features.akActive(), ability = Draw.abilityStatus(), lines = [];
  var maxAmmo = stats.ammo + Game.blessings.ammo * CONFIG.BLESSING_EFFECTS.ammoBonus;
  if (ak) { var K = Features.ak; lines.push({ t: "AK-47  (not automatic)", c: "#ffe08a", bold: true }); lines.push({ t: "E  " + (K.thrown ? "OUT" : (K.abilityCd > 0 ? (K.abilityCd / 60).toFixed(1) + "s" : "THROW READY")), c: !K.thrown && K.abilityCd <= 0 ? "#66eaff" : "#c77dff" }); }
  else {
    lines.push({ t: Player.classType.toUpperCase() + (maxAmmo > 0 ? "   " + Weapons.ammo + " / " + maxAmmo : ""), c: "#ffffff", bold: true });
    if (Weapons.reloadTimer > 0) lines.push({ t: "RELOADING", c: "#ffb347", bar: 1 - Weapons.reloadTimer / CONFIG.WEAPON_RELOAD_FRAMES[Player.classType] });
    if (ability) lines.push({ t: "E  " + ability, c: ability === "READY" ? "#66eaff" : "#c77dff" });
  }
  lines.push({ t: "RED " + redLeft + "     GOLD " + Math.round(Game.goldTesseracts * 10) / 10, c: "#e0b3ff" });
  if (Game.upgrades.jets) lines.push({ t: "JET", c: "#ffb347", bar: Math.max(0, Player.jetFuel) / CONFIG.JET.fuelFrames, full: Player.jetFuel >= CONFIG.JET.fuelFrames });
  if (Game.upgrades.matrix) lines.push({ t: "MATRIX", c: "#ffb347" });
  if (Game.dualityLog.length) lines.push({ t: "BARGAINS " + Game.dualityLog.length, c: "#f0e6ff" });
  var h = 12, y;
  lines.forEach(function (l) { h += l.bar !== undefined ? 24 : 18; });
  Draw.panel(8, 8, 196, h + 4); y = 26;
  lines.forEach(function (l) {
    ctx.font = Draw.F(l.bold ? 14 : 12, l.bold); ctx.textAlign = "left"; ctx.fillStyle = l.c; ctx.fillText(l.t, 18, y);
    if (l.bar !== undefined) { Draw.bar(18, y + 4, 120, 6, l.bar, l.full ? "#66eaff" : l.c); y += 24; } else y += 18;
  });
  // right: level name and curses
  var curses = Game.curseSummary(), rows = 1 + curses.length;
  Draw.panel(W - 226, 8, 218, 14 + rows * 18 + 4);
  ctx.textAlign = "right"; ctx.font = Draw.F(12, true); ctx.fillStyle = "#ffffff"; ctx.fillText(Level.name, W - 18, 26);
  ctx.font = Draw.F(11, false);
  curses.forEach(function (c, i) {
    var label = (c.kind === "greater" ? "\u25C6 " : "") + c.name + (c.count > 1 ? " x" + c.count : "") + (c.left ? "  (" + c.left + ")" : "");
    ctx.fillStyle = c.kind === "greater" ? "#ff5a5a" : (c.kind === "temporary" ? "#7fe3ff" : "#ff6fd8"); ctx.fillText(label, W - 18, 44 + i * 18);
  });
  ctx.textAlign = "center";
  // top centre: Heartbreaker timer
  if (Game.hasCurse("heartbreaker")) {
    var secs = Math.max(0, Features.heart.frames) / 60, urgent = secs < 5 && Math.floor(Date.now() / 160) % 2 === 0;
    Draw.panel(W / 2 - 62, 8, 124, 34, "rgba(255,42,77,0.6)"); ctx.font = Draw.F(20, true); ctx.fillStyle = urgent ? "#ffffff" : "#ff5a73"; ctx.fillText("\u2665 " + secs.toFixed(1), W / 2, 33);
  }
  // Tar status
  if (Features.tar) {
    var t = Features.tar, awake = t.state === "awake", text = awake ? "TAR AWAKE  cogs " + t.calm + "/" + CONFIG.TAR.calmCogs : "TAR  " + t.missed + "/" + CONFIG.TAR.missesToWake + " missed";
    Draw.panel(W / 2 - 90, Game.hasCurse("heartbreaker") ? 48 : 8, 180, 24, awake ? "rgba(255,42,77,0.7)" : "rgba(255,204,102,0.5)");
    ctx.font = Draw.F(11, true); ctx.fillStyle = awake ? "#ff5a73" : "#ffcc66"; ctx.fillText(text, W / 2, (Game.hasCurse("heartbreaker") ? 48 : 8) + 16);
  }
  // banner when the map starts collapsing
  if (Features.banner > 0) {
    ctx.save(); ctx.globalAlpha = Math.min(1, Features.banner / 40); ctx.font = Draw.F(18, true); ctx.fillStyle = "#ffffff"; ctx.shadowColor = "#c77dff"; ctx.shadowBlur = 14;
    ctx.fillText(Game.hasCurse("diamondCuboid") ? "CATCH THE DIAMOND CUBOID" : "REACH THE BEACON", W / 2, 96); ctx.restore();
  }
  // pointer to the beacon / diamond when it is off-screen
  if (Level.goldActive) {
    var d = Enemy.diamondOf(), target = d ? { x: d.x, y: d.y } : (Level.beaconOpen() ? Level.beacon : null);
    if (target) {
      var tx = target.x - Draw.cameraX, ty = Enemy.clamp(target.y, 60, CONFIG.CANVAS_H - 60);
      if (tx < 24 || tx > W - 24) {
        var dir = tx < 24 ? -1 : 1, ax = dir < 0 ? 22 : W - 22;
        ctx.save(); ctx.fillStyle = "#ffffff"; ctx.shadowColor = "#ffffff"; ctx.shadowBlur = 12; ctx.globalAlpha = 0.7 + 0.3 * Math.sin(Date.now() / 200);
        ctx.beginPath(); ctx.moveTo(ax + dir * 10, ty); ctx.lineTo(ax - dir * 6, ty - 10); ctx.lineTo(ax - dir * 6, ty + 10); ctx.closePath(); ctx.fill(); ctx.restore();
      }
    }
  }
  ctx.textAlign = "left";
};
