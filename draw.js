/* =====================================================================
   draw.js -- EVERYTHING YOU CAN SEE.
   Color palette is purple-themed. Different roles get different shades
   on purpose (terrain vs. enemies vs. warnings vs. your own projectiles
   vs. enemy projectiles) so things stay readable instead of turning into
   one undifferentiated purple blob. Invincibility stays cyan (#66eaff)
   deliberately -- it's the one non-purple color on screen, so it reads
   instantly as "something special is happening."
   ===================================================================== */
var Draw = { canvas: null, ctx: null, cameraX: 0, particles: [] };
Draw.dominoEasterEggImage = new Image();
Draw.dominoEasterEggImage.src = "https://pbs.twimg.com/profile_images/1907274219173404672/eIWDuAGg_400x400.jpg";

Draw.setup = function () { Draw.canvas = document.getElementById("game"); Draw.ctx = Draw.canvas.getContext("2d"); Draw.initParticles(); };
Draw.updateCamera = function () { Draw.cameraX = Player.x - CONFIG.CANVAS_W / 2; if (Draw.cameraX < 0) Draw.cameraX = 0; var furthest = Level.pixelWidth() - CONFIG.CANVAS_W; if (furthest < 0) furthest = 0; if (Draw.cameraX > furthest) Draw.cameraX = furthest; };

Draw.initParticles = function () {
  Draw.particles = [];
  for (var i = 0; i < CONFIG.PARTICLE_COUNT; i++) {
    Draw.particles.push({
      x: Math.random() * CONFIG.CANVAS_W,
      y: Math.random() * CONFIG.CANVAS_H,
      size: 1 + Math.random() * 2.5,
      speed: 0.15 + Math.random() * 0.35,
      drift: (Math.random() - 0.5) * 0.15,
      alpha: 0.12 + Math.random() * 0.3
    });
  }
};
Draw.updateParticles = function () {
  Draw.particles.forEach(function (particle) {
    particle.y -= particle.speed;
    particle.x += particle.drift;
    if (particle.y < -4) { particle.y = CONFIG.CANVAS_H + 4; particle.x = Math.random() * CONFIG.CANVAS_W; }
    if (particle.x < -4) particle.x = CONFIG.CANVAS_W + 4;
    if (particle.x > CONFIG.CANVAS_W + 4) particle.x = -4;
  });
};
Draw.drawParticles = function () {
  var ctx = Draw.ctx;
  ctx.save();
  Draw.particles.forEach(function (particle) {
    ctx.globalAlpha = particle.alpha;
    ctx.fillStyle = "#c77dff";
    ctx.beginPath();
    ctx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
    ctx.fill();
  });
  ctx.restore();
};

Draw.everything = function () {
  var ctx = Draw.ctx;
  ctx.fillStyle = "#000000";
  ctx.fillRect(0, 0, CONFIG.CANVAS_W, CONFIG.CANVAS_H);
  Draw.updateParticles();
  Draw.drawParticles();
  ctx.save();
  ctx.translate(-Draw.cameraX, 0);
  Draw.world();
  Draw.rightWall();
  Draw.mold();
  Draw.dominoEffects();
  Draw.portals();
  Draw.enemies();
  Draw.lasers();
  Draw.explosions();
  Draw.projectiles();
  Draw.player();
  ctx.restore();
  Draw.hud();
};

Draw.world = function () {
  var size = CONFIG.TILE, firstCol = Math.floor(Draw.cameraX / size) - 1, lastCol = firstCol + Math.ceil(CONFIG.CANVAS_W / size) + 2, ctx = Draw.ctx;
  var warning = Level.collapseWarning > 0, warningCols = warning ? Level.collapseColumns : null;
  for (var row = 0; row < CONFIG.ROWS; row++) for (var col = firstCol; col <= lastCol; col++) {
    var here = Level.charAt(col, row), x = col * size, y = row * size;
    var atRisk = warning && warningCols.indexOf(col) >= 0;
    if (here === "#") { if (atRisk) Draw.blockWarning(x, y, size); else Draw.block(x, y, size); }
    if (here === "^") { if (atRisk) Draw.spikeWarning(x, y, size); else Draw.spike(x, y, size); }
    if (here === "F") Draw.finish(x, y, size);
  }
  if (warning && warningCols.length) {
    var spanStart = Math.min.apply(null, warningCols) * size, spanEnd = (Math.max.apply(null, warningCols) + 1) * size;
    ctx.save();
    ctx.globalAlpha = 0.55;
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 3;
    ctx.setLineDash([10, 8]);
    ctx.beginPath(); ctx.moveTo(spanStart, 0); ctx.lineTo(spanStart, CONFIG.CANVAS_H); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(spanEnd, 0); ctx.lineTo(spanEnd, CONFIG.CANVAS_H); ctx.stroke();
    ctx.restore();
  }
  Level.redTesseracts.forEach(function (tesseract) { if (!tesseract.collected) Draw.tesseract(tesseract.x, tesseract.y, "#c724ff"); });
  if (Level.goldActive) Level.goldTesseracts.forEach(function (tesseract) { if (!tesseract.collected) Draw.tesseract(tesseract.x, tesseract.y, "#e0b3ff"); });
  Level.fakeTesseracts.forEach(function (tesseract) { Draw.fakeTesseract(tesseract.x, tesseract.y); });
};
Draw.dominoEffects = function () {
  var ctx = Draw.ctx;
  Enemy.enemies.forEach(function (e) {
    if (e.type !== "domino" || e.deadTimer > 0) return;
    if (e.leapState === "crouch" || e.leapState === "airborne") {
      ctx.save();
      ctx.strokeStyle = "#ff2fd0";
      ctx.lineWidth = 2;
      ctx.setLineDash([8, 6]);
      ctx.beginPath();
      ctx.moveTo(e.targetX, 0);
      ctx.lineTo(e.targetX, CONFIG.CANVAS_H);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.restore();
    }
    if (e.shockwaveTimer > 0) {
      var progress = 1 - e.shockwaveTimer / CONFIG.DOMINO_SHOCKWAVE_LIFE;
      ctx.save();
      ctx.globalAlpha = 1 - progress;
      ctx.strokeStyle = "#ff2fd0";
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.arc(e.x, e.y, 12 + CONFIG.DOMINO_SHOCKWAVE_RADIUS * progress, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
  });
};
Draw.fakeTesseract = function (x, y) {
  var ctx = Draw.ctx, pulse = 1 + Math.sin(Date.now() / 160) * 0.1;
  ctx.save(); ctx.translate(x, y); ctx.scale(pulse, pulse);
  ctx.fillStyle = "#1a0033"; ctx.strokeStyle = "#ff2fd0"; ctx.lineWidth = 3; ctx.beginPath();
  for (var i = 0; i < 5; i++) { var angle = -Math.PI / 2 + i * Math.PI * 2 / 5; if (i === 0) ctx.moveTo(Math.cos(angle) * 12, Math.sin(angle) * 12); else ctx.lineTo(Math.cos(angle) * 12, Math.sin(angle) * 12); }
  ctx.closePath(); ctx.fill(); ctx.stroke(); ctx.restore();
};
Draw.tesseract = function (x, y, color) { var ctx = Draw.ctx; ctx.save(); ctx.translate(x, y); ctx.rotate(Math.PI / 4); ctx.fillStyle = color; ctx.fillRect(-9, -9, 18, 18); ctx.fillStyle = "#1a0033"; ctx.fillRect(-4, -4, 8, 8); ctx.restore(); };
Draw.block = function (x, y, size) { var ctx = Draw.ctx; ctx.fillStyle = "#9d3fff"; ctx.fillRect(x, y, size, size); ctx.strokeStyle = "#9d3fff"; ctx.lineWidth = CONFIG.LINE_WIDTH; ctx.strokeRect(x, y, size, size); };
Draw.blockWarning = function (x, y, size) { var ctx = Draw.ctx; ctx.fillStyle = "#ffffff"; ctx.fillRect(x, y, size, size); ctx.strokeStyle = "#ffffff"; ctx.lineWidth = CONFIG.LINE_WIDTH; ctx.strokeRect(x, y, size, size); };
Draw.spike = function (x, y, size) { var ctx = Draw.ctx; ctx.fillStyle = "#9d3fff"; ctx.beginPath(); ctx.moveTo(x, y + size); ctx.lineTo(x + size / 2, y); ctx.lineTo(x + size, y + size); ctx.closePath(); ctx.fill(); };
Draw.spikeWarning = function (x, y, size) { var ctx = Draw.ctx; ctx.fillStyle = "#ffffff"; ctx.beginPath(); ctx.moveTo(x, y + size); ctx.lineTo(x + size / 2, y); ctx.lineTo(x + size, y + size); ctx.closePath(); ctx.fill(); };
Draw.finish = function (x, y, size) { var ctx = Draw.ctx; ctx.fillStyle = "#9d3fff"; ctx.fillRect(x + size / 2 - 2, y, 4, size); ctx.beginPath(); ctx.moveTo(x + size / 2 + 2, y + 4); ctx.lineTo(x + size - 4, y + 12); ctx.lineTo(x + size / 2 + 2, y + 20); ctx.closePath(); ctx.fill(); };
// ===================================================================
// ENEMIES. Everything about how enemies look lives below.
// Palette: normal = purple, mold = greens, Dimensional = orange aura on top.
// ===================================================================
Draw.windup = function (e) {
  var ctx = Draw.ctx, total = e.growTotal || e.windupMax || CONFIG.ENEMY_WINDUP_FRAMES;
  ctx.save(); ctx.strokeStyle = e.moldVariant || e.moldRoller ? "#7dff9a" : "#f0e6ff"; ctx.lineWidth = 2;
  ctx.globalAlpha = Math.max(0.2, Math.min(1, 0.35 + 0.65 * (1 - e.windup / total)));
  ctx.beginPath(); ctx.arc(e.x, e.y, Math.max(e.radius, e.fullRadius || 0) + 8, 0, Math.PI * 2); ctx.stroke(); ctx.restore();
};
Draw.dimAura = function (x, y, r) {
  var ctx = Draw.ctx, t = Date.now();
  ctx.save(); ctx.translate(x, y);
  ctx.strokeStyle = "#ff9f1c"; ctx.lineWidth = 2; ctx.globalAlpha = 0.55 + 0.25 * Math.sin(t / 180);
  ctx.setLineDash([6, 5]); ctx.lineDashOffset = -t / 40;
  ctx.beginPath(); ctx.arc(0, 0, r + 10, 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]);
  ctx.fillStyle = "#ffb347"; ctx.globalAlpha = 0.9;
  for (var k = 0; k < 3; k++) { var a = t / 600 + k * Math.PI * 2 / 3; ctx.save(); ctx.translate(Math.cos(a) * (r + 10), Math.sin(a) * (r + 10)); ctx.rotate(Math.PI / 4); ctx.fillRect(-3, -3, 6, 6); ctx.restore(); }
  ctx.restore();
};
Draw.enemies = function () {
  var ctx = Draw.ctx;
  for (var i = 0; i < Enemy.enemies.length; i++) {
    var e = Enemy.enemies[i];
    if (e.deadTimer > 0 || e.remove) continue;
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
  }
  Draw.enemyBullets();
};
Draw.cuboid = function (e) {
  var ctx = Draw.ctx, r = e.radius, mold = e.moldVariant;
  if (e.clone && e.fuseTarget) { ctx.save(); ctx.strokeStyle = "#ff9f1c"; ctx.globalAlpha = 0.45; ctx.setLineDash([3, 4]); ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(e.x, e.y); ctx.lineTo(e.fuseTarget.x, e.fuseTarget.y); ctx.stroke(); ctx.restore(); }
  ctx.save(); ctx.translate(e.x, e.y); ctx.rotate(e.angle || 0);
  ctx.fillStyle = mold ? "#06180c" : "#080808"; ctx.fillRect(-r, -r, r * 2, r * 2);
  ctx.strokeStyle = mold ? "#2ecc5a" : (e.dim ? "#ff9f1c" : "#b026ff"); ctx.lineWidth = e.clone ? 2 : 3; ctx.strokeRect(-r, -r, r * 2, r * 2);
  if (e.dim && !e.clone) { ctx.lineWidth = 2; ctx.strokeStyle = "#b026ff"; ctx.strokeRect(-r * 0.5, -r * 0.5, r, r); }
  ctx.restore();
  if (e.dim && !e.clone) Draw.dimAura(e.x, e.y, r * 1.2);
};
Draw.drone = function (e) {
  var ctx = Draw.ctx, s = e.dim ? CONFIG.DIM.drone.scale : 1, mold = e.moldVariant;
  if (e.aimTimer > 0 && e.state !== "windup") {
    ctx.save(); ctx.strokeStyle = "#ff2fd0"; ctx.lineWidth = 2; ctx.setLineDash([6, 6]); ctx.globalAlpha = 0.35 + 0.5 * (1 - e.aimTimer / Math.max(1, e.aimTotal || CONFIG.DRONE_AIM_FRAMES));
    ctx.beginPath(); ctx.moveTo(e.x, e.y); ctx.lineTo(Enemy.pcx(), Enemy.pcy()); ctx.stroke(); ctx.restore();
  }
  ctx.save(); ctx.translate(e.x, e.y); ctx.scale(s, s);
  ctx.fillStyle = mold ? "#1f6b34" : (e.dim ? "#b45fe0" : "#9d4edd"); ctx.fillRect(-20, -12, 40, 24); ctx.fillRect(-28, -18, 56, 5);
  if (e.laser) { ctx.fillStyle = "#fff"; ctx.globalAlpha = 0.6 + 0.4 * Math.sin(Date.now() / 50); ctx.beginPath(); ctx.arc(0, 4, 6, 0, Math.PI * 2); ctx.fill(); }
  ctx.restore();
  if (e.dim) Draw.dimAura(e.x, e.y, e.radius);
};
Draw.drill = function (e) {
  var ctx = Draw.ctx, mold = e.moldVariant;
  if (e.state === "approach" || e.state === "warning") {
    ctx.save(); ctx.strokeStyle = "#ff2fd0"; ctx.lineWidth = 2; ctx.setLineDash([8, 6]); ctx.beginPath(); ctx.moveTo(e.x, e.y);
    ctx.lineTo(e.state === "warning" ? e.targetX : Enemy.pcx(), e.state === "warning" ? e.targetY : Enemy.pcy()); ctx.stroke(); ctx.restore();
  }
  ctx.save(); ctx.translate(e.x, e.y); ctx.rotate(e.angle || 0);
  ctx.fillStyle = mold ? "#1f6b34" : "#7b2cbf"; ctx.beginPath(); ctx.moveTo(e.radius + 8, 0); ctx.lineTo(-e.radius, -e.radius); ctx.lineTo(-e.radius, e.radius); ctx.closePath(); ctx.fill();
  ctx.restore();
  if (e.dim) Draw.dimAura(e.x, e.y, e.radius);
};
Draw.domino = function (e) {
  var ctx = Draw.ctx, dw = CONFIG.DOMINO_WIDTH, dh = CONFIG.DOMINO_HEIGHT, squash = e.squash || 0, mold = e.moldVariant;
  if (e.leapState === "airborne") { ctx.save(); ctx.strokeStyle = "#ff2fd0"; ctx.lineWidth = 2; ctx.setLineDash([8, 6]); ctx.beginPath(); ctx.moveTo(e.targetX, 0); ctx.lineTo(e.targetX, CONFIG.CANVAS_H); ctx.stroke(); ctx.restore(); }
  var sinceLanding = e.leapState === "landed" ? CONFIG.DOMINO_SHOCKWAVE_LIFE - e.leapTimer : 99, lethalNow = sinceLanding >= 1 && sinceLanding <= CONFIG.DOMINO_LETHAL_FRAMES;
  ctx.save(); ctx.translate(e.x, e.y); ctx.rotate(e.angle || 0); ctx.scale(1 + squash * 0.3, 1 - squash * 0.3);
  if (e.easterEgg && Draw.dominoEasterEggImage.complete && Draw.dominoEasterEggImage.naturalWidth) ctx.drawImage(Draw.dominoEasterEggImage, -dw / 2, -dh / 2, dw, dh);
  else {
    var pipX = dw * 0.22, pipY = dh * 0.22, pipR = Math.max(4, dw * 0.09), ink = mold ? "#0b2f17" : "#2e1a47";
    ctx.fillStyle = mold ? "#b7e8c0" : "#d9c9f0"; ctx.fillRect(-dw / 2, -dh / 2, dw, dh);
    ctx.strokeStyle = lethalNow ? "#ff2fd0" : ink; ctx.lineWidth = lethalNow ? 7 : 4; ctx.strokeRect(-dw / 2, -dh / 2, dw, dh); // thick magenta outline = the deadly frames
    ctx.strokeStyle = ink; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(-dw / 2, 0); ctx.lineTo(dw / 2, 0); ctx.stroke();
    ctx.fillStyle = ink; ctx.beginPath(); ctx.arc(-pipX, -pipY, pipR, 0, Math.PI * 2); ctx.arc(pipX, -pipY, pipR, 0, Math.PI * 2); ctx.arc(-pipX, pipY, pipR, 0, Math.PI * 2); ctx.arc(pipX, pipY, pipR, 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore();
  if (e.leapState === "landed") {
    var progress = 1 - e.leapTimer / CONFIG.DOMINO_SHOCKWAVE_LIFE;
    ctx.save(); ctx.globalAlpha = Math.max(0, 1 - progress); ctx.strokeStyle = e.dim ? "#ff9f1c" : "#ff2fd0"; ctx.lineWidth = 5;
    ctx.beginPath(); ctx.arc(e.x, e.y, progress * Enemy.dominoShockRadius(e), 0, Math.PI * 2); ctx.stroke(); ctx.restore();
  }
  if (e.dim) Draw.dimAura(e.x, e.y, dh / 2 - 10);
};
Draw.greenBall = function (e) {
  var ctx = Draw.ctx, mold = e.moldVariant || e.moldRoller;
  ctx.save(); ctx.translate(e.x, e.y); ctx.rotate(e.angle || 0);
  ctx.fillStyle = mold ? "#14472a" : "#c77dff"; ctx.beginPath(); ctx.arc(0, 0, e.radius, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = mold ? "#5cff7a" : "#e0aaff"; ctx.lineWidth = 1; ctx.stroke();
  if (mold) { ctx.fillStyle = "#0a2a14"; ctx.beginPath(); ctx.arc(-e.radius * 0.3, -e.radius * 0.2, e.radius * 0.28, 0, Math.PI * 2); ctx.arc(e.radius * 0.35, e.radius * 0.25, e.radius * 0.2, 0, Math.PI * 2); ctx.fill(); }
  ctx.restore();
  if (e.dim) Draw.dimAura(e.x, e.y, e.radius);
};
Draw.ase = function (e) {
  var ctx = Draw.ctx, px = Enemy.pcx(), py = Enemy.pcy(), warning = e.aseState === "warning", total = e.aseWarnTotal || CONFIG.ASE_TELEPORT_WARNING, mold = e.moldVariant;
  if (warning) {
    var t = 1 - e.aseTimer / total;
    ctx.save(); ctx.strokeStyle = "#ff2fd0"; ctx.lineWidth = 2; ctx.setLineDash([8, 6]); ctx.globalAlpha = 0.4 + 0.6 * t;
    ctx.beginPath(); ctx.arc(e.destX, e.destY, e.radius + 6 + (1 - t) * 18, 0, Math.PI * 2); ctx.stroke(); ctx.restore();
  }
  var look = Math.atan2(py - e.y, px - e.x), open = warning ? Math.max(0.15, 1 - (1 - e.aseTimer / total) * 0.85) : 1, r = e.radius;
  ctx.save(); ctx.translate(e.x, e.y);
  ctx.fillStyle = mold ? "#06180c" : "#1a0033"; ctx.strokeStyle = mold ? "#5cff7a" : "#e0aaff"; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.ellipse(0, 0, r * 1.35, r * 0.85 * open, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  ctx.fillStyle = mold ? "#2ecc5a" : "#ff2fd0"; ctx.beginPath(); ctx.arc(Math.cos(look) * r * 0.4, Math.sin(look) * r * 0.3 * open, r * 0.45, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = "#000"; ctx.beginPath(); ctx.arc(Math.cos(look) * r * 0.5, Math.sin(look) * r * 0.38 * open, r * 0.2, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
  if (e.dim) Draw.dimAura(e.x, e.y, r * 1.2);
};
Draw.roller = function (e) {
  var ctx = Draw.ctx;
  if (e.state === "windup") return;
  var color = e.moldVariant ? "#2ecc5a" : (e.dim ? "#ff9f1c" : "#ff2fd0");
  if (e.dormant) {
    var start = Enemy.history && Enemy.history[0];
    if (start) { ctx.save(); ctx.strokeStyle = color; ctx.lineWidth = 2; ctx.setLineDash([6, 6]); ctx.globalAlpha = 0.45; ctx.beginPath(); ctx.arc(start.x, start.y, e.radius + 8, 0, Math.PI * 2); ctx.stroke(); ctx.restore(); }
    return;
  }
  ctx.save(); ctx.fillStyle = "#000"; ctx.strokeStyle = color; ctx.lineWidth = CONFIG.LINE_WIDTH;
  ctx.beginPath(); ctx.arc(e.x, e.y, e.radius, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  ctx.fillStyle = color; ctx.beginPath(); ctx.arc(e.x + Math.cos(e.angle || 0) * e.radius * CONFIG.DOT_DISTANCE, e.y + Math.sin(e.angle || 0) * e.radius * CONFIG.DOT_DISTANCE, 4, 0, Math.PI * 2); ctx.fill();
  ctx.font = "11px monospace"; ctx.textAlign = "center"; ctx.fillText((e.delayFrames / 60).toFixed(1) + "s", e.x, e.y - e.radius - 8);
  ctx.restore();
  if (e.dim) Draw.dimAura(e.x, e.y, e.radius);
};
// The Rocket "enemy" is just a marker at the top of the screen; the real show is its warning column and the missile.
Draw.rocketLauncher = function (e) {
  var ctx = Draw.ctx, mold = e.moldVariant, color = mold ? "#2ecc5a" : "#ff2fd0";
  if (e.state === "windup") return;
  var warning = e.rState === "warn", locked = warning && e.rTimer <= CONFIG.ROCKET.lockFrames, total = e.rWarnTotal || 1, prog = warning ? 1 - e.rTimer / total : 0;
  ctx.save(); ctx.fillStyle = color; ctx.globalAlpha = warning ? 1 : 0.5;
  ctx.beginPath(); ctx.moveTo(e.x - 10, 4); ctx.lineTo(e.x + 10, 4); ctx.lineTo(e.x, 22); ctx.closePath(); ctx.fill(); ctx.restore();
  if (!warning) { if (e.dim) Draw.dimAura(e.x, 14, 8); return; }
  (e.targets || []).forEach(function (tx) {
    ctx.save(); ctx.strokeStyle = color; ctx.lineWidth = locked ? 3 : 2; if (!locked) ctx.setLineDash([8, 6]); ctx.globalAlpha = 0.35 + 0.5 * prog;
    ctx.beginPath(); ctx.moveTo(tx, 24); ctx.lineTo(tx, CONFIG.CANVAS_H); ctx.stroke(); ctx.restore();
  });
  // the "!" warning hovering above YOU
  var mx = e.targets && e.targets.length ? e.targets[Math.floor(e.targets.length / 2)] : e.x, my = Math.max(40, Player.y - 54);
  ctx.save(); ctx.translate(mx, my); ctx.fillStyle = locked ? "#fff" : color; ctx.globalAlpha = 0.7 + 0.3 * Math.sin(Date.now() / 60);
  ctx.beginPath(); ctx.moveTo(-12, -10); ctx.lineTo(12, -10); ctx.lineTo(0, 12); ctx.closePath(); ctx.fill();
  ctx.fillStyle = "#000"; ctx.font = "bold 12px monospace"; ctx.textAlign = "center"; ctx.fillText("!", 0, -1); ctx.restore();
  if (e.dim) Draw.dimAura(e.x, 14, 8);
};
Draw.moldCore = function (e) {
  var ctx = Draw.ctx, r = e.radius, pulse = 1 + 0.06 * Math.sin(Date.now() / 220), dim = e.dim;
  ctx.save(); ctx.translate(e.x, e.y + r * 0.4);
  ctx.fillStyle = "#0a2a14"; ctx.strokeStyle = dim ? "#b026ff" : "#2ecc5a"; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.arc(0, 0, r * pulse, Math.PI, 0); ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.fillStyle = "#14472a"; ctx.beginPath(); ctx.arc(-r * 0.35, -r * 0.35, r * 0.22, 0, Math.PI * 2); ctx.arc(r * 0.3, -r * 0.5, r * 0.16, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = "#8dffb0"; ctx.globalAlpha = 0.6 + 0.4 * Math.sin(Date.now() / 150); ctx.beginPath(); ctx.arc(0, -r * 0.55, 3, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
  if (e.hp < e.maxHp) { ctx.save(); ctx.fillStyle = "#000"; ctx.fillRect(e.x - 18, e.y - r - 10, 36, 5); ctx.fillStyle = "#5cff7a"; ctx.fillRect(e.x - 18, e.y - r - 10, 36 * Math.max(0, e.hp / e.maxHp), 5); ctx.restore(); }
  if (dim) Draw.dimAura(e.x, e.y, r);
};
Draw.moldPlant = function (e) {
  var ctx = Draw.ctx, grow = e.growTotal ? 1 - Math.max(0, e.windup) / e.growTotal : 1, tell = e.tell || 0, s = 0.3 + 0.7 * grow;
  ctx.save(); ctx.translate(e.x, e.y + e.radius); ctx.scale(s, s);
  ctx.strokeStyle = "#1f6b34"; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(0, 0); ctx.quadraticCurveTo(-5, -10, 0, -18); ctx.stroke();
  var bulb = 8 + tell * 4;
  ctx.fillStyle = tell > 0 ? "#c6ff7a" : "#2ecc5a"; ctx.strokeStyle = "#0a2a14"; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.arc(0, -20, bulb, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  ctx.fillStyle = "#0a2a14"; ctx.beginPath(); ctx.arc(0, -20, 3 + tell * 2, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
};
Draw.enemyBullets = function () {
  var ctx = Draw.ctx;
  for (var j = 0; j < Enemy.bullets.length; j++) {
    var b = Enemy.bullets[j];
    if (b.wait > 0) continue;
    if (b.explosive) {
      var ang = Math.atan2(b.vy, b.vx), big = b.kind === "missile", col = b.mold ? "#2ecc5a" : (b.dim ? "#ff9f1c" : "#ff2fd0");
      ctx.save(); ctx.translate(b.x, b.y); ctx.rotate(ang);
      ctx.fillStyle = "#ffb347"; ctx.globalAlpha = 0.8; ctx.beginPath(); ctx.moveTo(-(big ? 10 : 6), 0); ctx.lineTo(-(big ? 26 : 16), -(big ? 5 : 3)); ctx.lineTo(-(big ? 26 : 16), big ? 5 : 3); ctx.closePath(); ctx.fill(); // exhaust
      ctx.globalAlpha = 1; ctx.fillStyle = col; ctx.fillRect(-(big ? 10 : 6), -(big ? 4 : 3), big ? 20 : 12, big ? 8 : 6);
      ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.moveTo(big ? 10 : 6, -(big ? 4 : 3)); ctx.lineTo(big ? 17 : 11, 0); ctx.lineTo(big ? 10 : 6, big ? 4 : 3); ctx.closePath(); ctx.fill();
      ctx.restore();
      continue;
    }
    ctx.fillStyle = b.color || "#ff2fd0"; ctx.beginPath(); ctx.arc(b.x, b.y, 4, 0, Math.PI * 2); ctx.fill();
  }
};
Draw.explosions = function () {
  var ctx = Draw.ctx;
  Enemy.explosions.forEach(function (ex) {
    var progress = ex.age / ex.life, r = ex.r * (0.35 + 0.65 * Math.min(1, ex.age / 4)), lethal = ex.age < ex.lethal;
    var col = ex.mold ? "#2ecc5a" : (ex.dim ? "#ff9f1c" : "#ff2fd0");
    ctx.save(); ctx.globalAlpha = Math.max(0, 1 - progress);
    ctx.fillStyle = lethal ? "#fff" : col; ctx.globalAlpha *= lethal ? 0.55 : 0.35; ctx.beginPath(); ctx.arc(ex.x, ex.y, r, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = Math.max(0, 1 - progress); ctx.strokeStyle = col; ctx.lineWidth = 5; ctx.beginPath(); ctx.arc(ex.x, ex.y, r, 0, Math.PI * 2); ctx.stroke();
    ctx.restore();
  });
};
Draw.portals = function () {
  var ctx = Draw.ctx;
  Enemy.portals.forEach(function (p) {
    var prog = p.age / p.life, r = 10 + 28 * Math.sin(prog * Math.PI / 2);
    ctx.save(); ctx.translate(p.x, p.y);
    ctx.fillStyle = "#000"; ctx.globalAlpha = 0.85; ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.fill(); ctx.globalAlpha = 1;
    for (var k = 0; k < 3; k++) { ctx.save(); ctx.rotate(p.age * (k % 2 ? -0.12 : 0.15) + k); ctx.strokeStyle = k === 1 ? "#ff9f1c" : "#b026ff"; ctx.lineWidth = 2; ctx.setLineDash([10, 6]); ctx.beginPath(); ctx.arc(0, 0, r * (1 - k * 0.22), 0, Math.PI * 2); ctx.stroke(); ctx.restore(); }
    ctx.restore();
  });
};
Draw.lasers = function () {
  var ctx = Draw.ctx;
  Enemy.enemies.forEach(function (e) {
    if (!e.laser || e.deadTimer > 0 || e.remove) return;
    var L = e.laser, charging = L.state === "charge", prog = 1 - L.timer / L.total;
    ctx.save(); ctx.lineCap = "round";
    if (charging) {
      ctx.strokeStyle = "#ff2fd0"; ctx.lineWidth = 2; ctx.setLineDash([10, 8]); ctx.globalAlpha = 0.3 + 0.6 * prog;
      ctx.beginPath(); ctx.moveTo(e.x, e.y); ctx.lineTo(L.ex, L.ey); ctx.stroke();
    } else {
      var w = CONFIG.DIM.drone.laserWidth;
      ctx.strokeStyle = "#ff2fd0"; ctx.globalAlpha = 0.45; ctx.lineWidth = w * 2.4; ctx.beginPath(); ctx.moveTo(e.x, e.y); ctx.lineTo(L.ex, L.ey); ctx.stroke();
      ctx.globalAlpha = 1; ctx.strokeStyle = "#fff"; ctx.lineWidth = w; ctx.beginPath(); ctx.moveTo(e.x, e.y); ctx.lineTo(L.ex, L.ey); ctx.stroke();
    }
    ctx.restore();
  });
};
// ===================================================================
// MOLD TILES: a dark green rocky skin over solid blocks, with moss on top and a few glowing spores.
// ===================================================================
Draw.mold = function () {
  var ctx = Draw.ctx, T = CONFIG.TILE, left = Draw.cameraX - T, right = Draw.cameraX + CONFIG.CANVAS_W + T;
  for (var i = 0; i < Mold.list.length; i++) {
    var t = Mold.list[i], x = t.c * T, y = t.r * T;
    if (x < left || x > right || !Mold.valid(t)) continue;
    var h = ((t.c * 73856093) ^ (t.r * 19349663)) >>> 0, grow = Math.min(1, (Enemy.frame - t.born) / 40);
    ctx.save(); ctx.globalAlpha = 0.25 + 0.75 * grow;
    ctx.fillStyle = "#0b2f17"; ctx.fillRect(x, y, T, T);
    for (var k = 0; k < 3; k++) { // rock chips
      var cx = x + 4 + ((h >> (k * 5)) & 31) / 31 * (T - 14), cy = y + 4 + ((h >> (k * 5 + 2)) & 31) / 31 * (T - 14), s = 5 + ((h >> (k * 3)) & 7);
      ctx.fillStyle = k % 2 ? "#14472a" : "#071c0e"; ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + s, cy + 2); ctx.lineTo(cx + s - 2, cy + s); ctx.lineTo(cx - 2, cy + s - 3); ctx.closePath(); ctx.fill();
    }
    ctx.strokeStyle = t.dim ? "#6a2fb0" : "#1d6b35"; ctx.lineWidth = 2; ctx.strokeRect(x + 1, y + 1, T - 2, T - 2);
    if (Mold.airAbove(t.c, t.r)) { // vegetation along the top edge
      for (var b = 0; b < 6; b++) { var bx = x + 3 + b * 6.5, bh = 5 + ((h >> (b * 2)) & 7); ctx.fillStyle = b % 2 ? "#2f9e4f" : "#1f7a3a"; ctx.beginPath(); ctx.moveTo(bx, y + 2); ctx.lineTo(bx + 2.5, y - bh); ctx.lineTo(bx + 5, y + 2); ctx.closePath(); ctx.fill(); }
    }
    if (!Level.isSolid(t.c, t.r + 1)) { ctx.strokeStyle = "#1f7a3a"; ctx.lineWidth = 2; for (var v = 0; v < 2; v++) { var vx = x + 9 + v * 18 + ((h >> (v + 9)) & 3); ctx.beginPath(); ctx.moveTo(vx, y + T); ctx.lineTo(vx, y + T + 6 + ((h >> (v + 4)) & 7)); ctx.stroke(); } }
    if (h % 7 === 0) { ctx.fillStyle = "#8dffb0"; ctx.globalAlpha *= 0.5 + 0.5 * Math.sin(Date.now() / 300 + h); ctx.beginPath(); ctx.arc(x + 8 + (h % 20), y + 8 + ((h >> 4) % 20), 2, 0, Math.PI * 2); ctx.fill(); }
    ctx.restore();
  }
};

Draw.projectiles = function () { var ctx = Draw.ctx; for (var i = 0; i < Weapons.projectiles.length; i++) { var p = Weapons.projectiles[i]; ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.kind === "tomahawk" ? (p.spin || 0) : Math.atan2(p.vy, p.vx)); if (p.kind === "tomahawk") { ctx.fillStyle = "#5a3d7a"; ctx.fillRect(-9, -2, 18, 4); ctx.fillStyle = "#e8dcff"; ctx.beginPath(); ctx.moveTo(9, -8); ctx.lineTo(16, 0); ctx.lineTo(9, 8); ctx.closePath(); ctx.fill(); } else { ctx.fillStyle = p.kind === "bazooka" ? "#bf5fff" : "#a78bfa"; ctx.beginPath(); ctx.arc(0, 0, p.kind === "bazooka" ? 7 : 4, 0, Math.PI * 2); ctx.fill(); } ctx.restore(); } for (var s = 0; s < Weapons.slashes.length; s++) { var slash = Weapons.slashes[s], centerX = Player.x + CONFIG.PLAYER_SIZE / 2, centerY = Player.y + CONFIG.PLAYER_SIZE / 2; ctx.save(); ctx.strokeStyle = "#f0e6ff"; ctx.lineWidth = CONFIG.KATANA_SLASH_VISUAL_WIDTH; ctx.globalAlpha = 1 - slash.age / CONFIG.KATANA_SLASH_VISUAL_LIFE; ctx.beginPath(); ctx.arc(centerX, centerY, CONFIG.KATANA_SLASH_VISUAL_RADIUS, slash.angle - CONFIG.KATANA_SLASH_VISUAL_ARC, slash.angle + CONFIG.KATANA_SLASH_VISUAL_ARC); ctx.stroke(); ctx.restore(); } for (var j = 0; j < Weapons.explosions.length; j++) { var explosion = Weapons.explosions[j], progress = explosion.age / CONFIG.BAZOOKA_EXPLOSION_TIME; ctx.save(); ctx.globalAlpha = 1 - progress; ctx.strokeStyle = "#c77dff"; ctx.fillStyle = "#7b2cbf"; ctx.lineWidth = 5; ctx.beginPath(); ctx.arc(explosion.x, explosion.y, 12 + CONFIG.BAZOOKA_BLAST_RADIUS * progress, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); ctx.restore(); } };
Draw.abilityStatus = function () {
  var frames = 0;
  if (Player.classType === "tomahawk") frames = Weapons.abilityCooldown;
  else if (Player.classType === "katana") { if (Weapons.parryTimer > 0) return "PARRYING"; frames = Weapons.parryCooldown; }
  else if (Player.classType === "pistols") { if (Player.dashTimer > 0) return "DASHING"; frames = Player.dashCooldown; }
  else return null; // bazooka has no ability
  return frames > 0 ? (frames / 60).toFixed(1) + "s" : "READY";
};
Draw.hud = function () {
  var ctx = Draw.ctx; if (!Player.classType) return;
  var stats = CONFIG.CLASS_STATS[Player.classType], redLeft = Level.redTesseracts.filter(function (tesseract) { return !tesseract.collected; }).length;
  ctx.font = "14px monospace"; ctx.textAlign = "left";
  ctx.fillStyle = "#ffffff"; ctx.fillText(Player.classType.toUpperCase() + "  " + Weapons.ammo + "/" + (stats.ammo + Game.blessings.ammo * CONFIG.BLESSING_EFFECTS.ammoBonus) + (Weapons.reloadTimer > 0 ? "  RELOADING" : ""), 12, 20);
  ctx.fillStyle = "#c724ff"; ctx.fillText("RED " + redLeft, 12, 38);
  ctx.fillStyle = "#e0b3ff"; ctx.fillText("GOLD " + Game.goldTesseracts, 12, 56);
  var ability = Draw.abilityStatus();
  if (ability) { ctx.fillStyle = ability === "READY" ? "#66eaff" : "#c77dff"; ctx.fillText("E  " + ability, 12, 74); }
  var hudY = ability ? 92 : 74;
  if (Game.upgrades.jets) { ctx.fillStyle = "#ffb347"; ctx.fillText("JET", 12, hudY); ctx.strokeStyle = "#ffb347"; ctx.strokeRect(46, hudY - 10, 62, 10); ctx.fillStyle = Player.jetFuel >= CONFIG.JET.fuelFrames ? "#66eaff" : "#ffb347"; ctx.fillRect(47, hudY - 9, 60 * Math.max(0, Player.jetFuel) / CONFIG.JET.fuelFrames, 8); hudY += 18; }
  if (Game.upgrades.matrix) { ctx.fillStyle = "#ffb347"; ctx.fillText("MATRIX", 12, hudY); hudY += 18; }
  ctx.textAlign = "right";
  ctx.fillStyle = "#ffffff"; ctx.fillText(Level.name, CONFIG.CANVAS_W - 12, 20);
  ctx.fillStyle = "#ff6fd8";
  Game.curseSummary().forEach(function (curse, i) { ctx.fillText(curse.name + (curse.count > 1 ? " x" + curse.count : ""), CONFIG.CANVAS_W - 12, 38 + i * 18); });
  ctx.textAlign = "left";
};
Draw.jetFlame = function () {
  if (!Player.jetting) return;
  var ctx = Draw.ctx, cx = Player.x + CONFIG.PLAYER_SIZE / 2, by = Player.y + CONFIG.PLAYER_SIZE, flick = 10 + Math.random() * 10;
  ctx.save(); ctx.fillStyle = "#ff9f1c"; ctx.beginPath(); ctx.moveTo(cx - 7, by - 2); ctx.lineTo(cx + 7, by - 2); ctx.lineTo(cx, by + flick); ctx.closePath(); ctx.fill();
  ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.moveTo(cx - 3, by - 2); ctx.lineTo(cx + 3, by - 2); ctx.lineTo(cx, by + flick * 0.5); ctx.closePath(); ctx.fill(); ctx.restore();
};
Draw.player = function () { Draw.jetFlame(); var ctx = Draw.ctx, r = CONFIG.PLAYER_RADIUS, centerX = Player.x + CONFIG.PLAYER_SIZE / 2, centerY = Player.y + CONFIG.PLAYER_SIZE / 2; ctx.fillStyle = "#000000"; ctx.strokeStyle = Player.invincibilityTimer > 0 ? "#66eaff" : "#c77dff"; ctx.lineWidth = CONFIG.LINE_WIDTH; ctx.beginPath(); ctx.arc(centerX, centerY, r, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); var dotX = centerX + Math.cos(Player.angle) * r * CONFIG.DOT_DISTANCE, dotY = centerY + Math.sin(Player.angle) * r * CONFIG.DOT_DISTANCE; ctx.fillStyle = "#c77dff"; ctx.beginPath(); ctx.arc(dotX, dotY, 4, 0, Math.PI * 2); ctx.fill(); };
Draw.rightWall = function () {
  var size = CONFIG.TILE, x = Level.cols * size;
  if (x < Draw.cameraX - size || x > Draw.cameraX + CONFIG.CANVAS_W + size) return;
  for (var row = 0; row < CONFIG.ROWS; row++) Draw.block(x, row * size, size);
};