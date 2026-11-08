/* =====================================================================
   game.js -- THE RULES AND THE LOOP.
   ===================================================================== */
var Game = { mode: "choice", levelNumber: 0, nextEnemy: null, goldTesseracts: 0, curses: [], blessings: { jump: 0, ammo: 0, speed: 0, dash: 0, magnet: 0 }, upgrades: { matrix: false, jets: false }, tempCurses: [], dualityLog: [] };
// Run-wide modifiers (Altar of Duality) and per-level modifiers (Altar of Chance / Greed). Everything reads these; 1 / 0 = no change.
Game.defaultMods = function () { return { damage: 1, enemySpeed: 1, enemyCooldown: 1, jumpAdd: 0, accel: 1, gravity: 1, gold: 1, collapse: 1 }; };
Game.defaultLevelMods = function () { return { gravity: 1, gold: 1, collapse: 1, enemySpeed: 1 }; };
Game.mods = Game.defaultMods(); Game.levelMods = Game.defaultLevelMods();
Game.hasCurse = function (id) { return Game.curses.indexOf(id) >= 0; };
Game.curseCount = function (id) { return Game.curses.filter(function (curse) { return curse === id; }).length; };
Game.pct = function (multiplier) { return Math.round((1 - multiplier) * 100); };
// Descriptions are built from config.js so they can never drift out of date when you retune a curse.
Game.curseChoices = [
   { id: "subZero", name: "Sub-Zero", description: "A few chunks of the map freeze over and become super slippery. Permanent." },
   { id: "unknownDimension", name: "Unknown Dimension", description: "Cuboids can combine into one bigger, faster Cuboid." },
   { id: "batteryLife", name: "Battery Life", description: "Drills get a second dash." },
   { id: "lowerGravity", name: "Lower Gravity", description: "You fall slower but jump a little lower. You'd think this would be helpful. Stacks." },
   { id: "unstablePlain", name: "Unstable Plain", description: "Gold tesseracts are worth double, but the map collapses around you in quick bursts. Stacks." },
   { id: "shotgunSlug", name: "Shotgun Slug", description: "Drones fire one faster, focused shot instead of a burst." },
   { id: "fiveCube", name: "5-Cube", description: "Magenta pentagon fake tesseracts are lethal. Do not touch them." },
   { id: "wearAndTear", name: "Wear and Tear", description: "Your weapon damage is reduced by " + Game.pct(CONFIG.CURSES.wearAndTear.damageMultiplier) + "%. Stacks." },
   { id: "dimensionalRift", name: "Dimensional Rift", description: "While the map collapses, portals open and random enemies step out. Stacks (more portals per collapse)." },
   { id: "slamDunk", name: "Slam Dunk", description: "Dominoes are always aiming for you: no landing offset, they steer mid-air, and rest " + Game.pct(CONFIG.CURSES.slamDunk.pauseMultiplier) + "% less." },
   { id: "adware", name: "Adware", kind: "temporary", rounds: CONFIG.CURSES.adware.rounds, description: "Ads pop up and block your screen, begging you to buy a blessing." },
   { id: "diamondCuboid", name: "Diamond Cuboid", kind: "temporary", rounds: CONFIG.CURSES.diamondCuboid.rounds, description: "When the map collapses, a huge cuboid is the beacon. It runs from you until only the spawn piece is left." },
   { id: "moldyAura", name: "Moldy Aura", kind: "temporary", rounds: CONFIG.CURSES.moldyAura.rounds, description: "Rolling over terrain sometimes makes it moldy. Mold grows without a core." },
   { id: "heartbreaker", name: "Heartbreaker", kind: "greater", description: "A bomb timer is stapled to you: " + (CONFIG.CURSES.heartbreaker.startFrames / 60) + "s. Each tesseract adds " + (CONFIG.CURSES.heartbreaker.perTesseract / 60) + "s (cap " + (CONFIG.CURSES.heartbreaker.capFrames / 60) + "s). At zero, you explode." },
   { id: "ak47", name: "AK-47", kind: "greater", description: "Replaces your weapon with a not-even-real AK-47. Not automatic, " + CONFIG.CURSES.ak47.damage + " damage. E throws it and it bounces back, knocking you a little." },
   { id: "tar", name: "Tar", kind: "greater", description: "A tar clock spawns cogs every " + (CONFIG.TAR.cogInterval / 60) + "s. Collect them or it wakes up and chases you until you collect " + CONFIG.TAR.calmCogs + " cogs." }
];
Game.curseChoices.forEach(function (c) { if (!c.kind) c.kind = "permanent"; });
Game.curseTag = function (c) { return c.kind === "temporary" ? "<span class=\"tag\">Temporary: " + c.rounds + " rounds</span>" : (c.kind === "greater" ? "<span class=\"tag\">Greater curse</span>" : ""); };
// Cards between levels: permanent + temporary curses, with a small chance that one slot is a Greater curse.
Game.curseAvailable = function (c) { return c.kind === "permanent" || !Game.hasCurse(c.id); };
Game.rollCurseOffers = function (count, kinds) {
  var pool = Game.curseChoices.filter(function (c) { return Game.curseAvailable(c) && kinds.indexOf(c.kind) >= 0; }), out = [];
  while (out.length < count && pool.length) out.push(pool.splice(Math.floor(Math.random() * pool.length), 1)[0]);
  return out;
};
Game.rollStandardOffers = function () {
  var offers = Game.rollCurseOffers(3, ["permanent", "temporary"]), greater = Game.rollCurseOffers(1, ["greater"]);
  if (greater.length && offers.length && Math.random() < CONFIG.GREATER_CURSE_CHANCE) offers[offers.length - 1] = greater[0];
  return offers;
};
// Adds a curse. Temporary curses count down once per completed level (rounds = how many levels, including the one you are on).
Game.addCurse = function (id, rounds) {
  var def = Game.curseChoices.filter(function (c) { return c.id === id; })[0];
  Game.curses.push(id);
  if (def && def.kind === "temporary") Game.tempCurses.push({ id: id, left: rounds || def.rounds });
  Features.onCurseAdded(id);
};
Game.expireCurses = function () {
  for (var i = Game.tempCurses.length - 1; i >= 0; i--) {
    if (--Game.tempCurses[i].left > 0) continue;
    var at = Game.curses.lastIndexOf(Game.tempCurses[i].id); if (at >= 0) Game.curses.splice(at, 1);
    Game.tempCurses.splice(i, 1);
  }
};
// One-time upgrades: bought once on the gold screen, much pricier than blessings.
Game.upgradeDefinitions = [
   { id: "matrix", name: "Matrix Tesseract", description: "Removes momentum: you move at a flat speed. Knockback still throws you around.", cost: CONFIG.UPGRADE_COSTS.matrix },
   { id: "jets", name: "Jet Boots", description: "Hold jump in the air to fly up for " + (CONFIG.JET.fuelFrames / 60).toFixed(1) + "s. Refuels in " + (CONFIG.JET.refuelFrames / 60).toFixed(0) + "s on the ground.", cost: CONFIG.UPGRADE_COSTS.jets }
];
// [{ name, count }] for the HUD
Game.curseSummary = function () {
  var counts = {}, order = [];
  Game.curses.forEach(function (id) { if (!counts[id]) { counts[id] = 0; order.push(id); } counts[id]++; });
  return order.map(function (id) {
    var def = Game.curseChoices.filter(function (choice) { return choice.id === id; })[0], temp = Game.tempCurses.filter(function (t) { return t.id === id; })[0];
    return { name: def ? def.name : id, count: counts[id], kind: def ? def.kind : "permanent", left: temp ? temp.left : 0 };
  });
};
Game.startRound = function () { Game.showClassChoice(); };
Game.startLevel = function (levelNumber, enemyType) { Game.commandLevelDefinition = null; var resetRoster = levelNumber === CONFIG.START_LEVEL && !enemyType; Game.levelNumber = levelNumber; Game.levelMods = Game.defaultLevelMods(); Level.build(levelNumber); Player.reset(); Weapons.reset(); Enemy.reset(enemyType, resetRoster); Features.resetLevel(); Game.mode = "playing"; Game.showMessage("Level " + (levelNumber + 1) + " - " + Player.classType); };
Game.startCommandLevel = function (definition, enemyTypes) {
   Game.commandLevelDefinition = definition;
   Game.levelNumber = CONFIG.START_LEVEL;
   Game.levelMods = Game.defaultLevelMods();
   Level.build(Game.levelNumber);
   Player.reset(); Weapons.reset();
   Enemy.types = enemyTypes.slice(); Enemy.type = Enemy.types.length === 1 ? Enemy.types[0] : "mixed";
   Enemy.reset(null, false);
   Features.resetLevel();
   Game.mode = "playing";
   Game.showMessage("Command level - " + Player.classType);
};
Game.showClassChoice = function () { Game.mode = "choice"; Game.goldTesseracts = 0; Game.curses = []; Game.blessings = { jump: 0, ammo: 0, speed: 0, dash: 0, magnet: 0 }; Game.upgrades = { matrix: false, jets: false }; Game.mods = Game.defaultMods(); Game.levelMods = Game.defaultLevelMods(); Game.tempCurses = []; Game.dualityLog = []; Game.blessingOffers = null; var panel = document.getElementById("class-choice"), cards = document.getElementById("class-cards"); cards.innerHTML = ""; [{ type: "bazooka", name: "Bazooka", description: "85 DMG, 6 ammo, 4s reload. Explosive shots destroy terrain." }, { type: "tomahawk", name: "Tomahawk", description: "10 DMG throwing axes, automatic, 0.7s cooldown. E hurls a 3-axe volley." }, { type: "pistols", name: "Pistols", description: "4 DMG, 24 ammo, 3s reload. E dashes toward the mouse and grants immunity." }, { type: "katana", name: "Katana", description: "8 DMG melee slash every 0.6s. E parries attacks." }].forEach(function (choice) { var button = document.createElement("button"); button.className = "class-card"; button.innerHTML = "<strong>" + choice.name + "</strong><span>" + choice.description + "</span>"; button.addEventListener("click", function () { panel.hidden = true; Player.classType = choice.type; Game.showCurseChoice(CONFIG.START_LEVEL); }); cards.appendChild(button); }); panel.hidden = false; Game.showMessage("Choose your class"); };
Game.nextLevel = function () { Game.expireCurses(); Ads.clear(); Altars.reset(); Game.showBlessingChoice(Game.levelNumber + 1); };
Game.blessingDefinitions = [{ type: "jump", name: "High Jump", description: "+2 jump power", cost: CONFIG.BLESSING_COSTS.jump }, { type: "ammo", name: "Deep Pockets", description: "+2 ammo per reload", cost: CONFIG.BLESSING_COSTS.ammo }, { type: "speed", name: "Quick Roll", description: "+0.05 movement acceleration", cost: CONFIG.BLESSING_COSTS.speed }, { type: "dash", name: "Long Dash", description: "+6 dash frames", cost: CONFIG.BLESSING_COSTS.dash }, { type: "magnet", name: "Tesseract Pull", description: "+20 collection range", cost: CONFIG.BLESSING_COSTS.magnet }];
Game.nextBlessingOffer = function () { return Game.blessingDefinitions[Math.floor(Math.random() * Game.blessingDefinitions.length)]; };
Game.ensureBlessingOffers = function () { if (!Game.blessingOffers) Game.blessingOffers = [Game.nextBlessingOffer(), Game.nextBlessingOffer()]; };
Game.showCurseChoice = function (nextLevel) { Game.mode = "choice"; var panel = document.getElementById("curse-choice"), cards = document.getElementById("curse-cards"); cards.innerHTML = ""; var choices = Game.rollStandardOffers(); Game.showMessage("Choose a curse for level " + (nextLevel + 1)); choices.forEach(function (choice) { var button = document.createElement("button"); button.className = "curse-card" + (choice.kind === "greater" ? " greater" : ""); button.innerHTML = "<strong>" + choice.name + "</strong><span>" + choice.description + "</span>" + Game.curseTag(choice); button.addEventListener("click", function () { Game.addCurse(choice.id); panel.hidden = true; if (nextLevel === CONFIG.START_LEVEL) Game.startLevel(nextLevel); else Game.showEnemyChoice(nextLevel); }); cards.appendChild(button); }); panel.hidden = false; };
Game.showBlessingChoice = function (nextLevel) { Game.mode = "choice"; Game.ensureBlessingOffers(); var panel = document.getElementById("blessing-choice"), cards = document.getElementById("blessing-cards"); cards.innerHTML = ""; document.getElementById("blessing-gold").textContent = Game.goldTesseracts; Game.showMessage("Spend gold tesseracts before level " + (nextLevel + 1)); Game.blessingOffers.forEach(function (choice, offerIndex) { var button = document.createElement("button"); button.className = "blessing-card"; button.disabled = Game.goldTesseracts < choice.cost; button.innerHTML = "<strong>" + choice.name + "</strong><span>" + choice.description + "</span><span>Cost: " + choice.cost + " gold</span><span>Owned: " + Game.blessings[choice.type] + "</span>"; button.addEventListener("click", function () { if (Game.goldTesseracts < choice.cost) return; Game.goldTesseracts -= choice.cost; Game.blessings[choice.type]++; Game.blessingOffers[offerIndex] = Game.nextBlessingOffer(); Game.showBlessingChoice(nextLevel); }); cards.appendChild(button); }); var upgradeCards = document.getElementById("upgrade-cards"); upgradeCards.innerHTML = "";
  Game.upgradeDefinitions.forEach(function (upgrade) { var owned = Game.upgrades[upgrade.id], button = document.createElement("button"); button.className = "blessing-card upgrade-card"; button.disabled = owned || Game.goldTesseracts < upgrade.cost; button.innerHTML = "<strong>" + upgrade.name + "</strong><span>" + upgrade.description + "</span><span>" + (owned ? "OWNED" : "Cost: " + upgrade.cost + " gold (one-time)") + "</span>"; button.addEventListener("click", function () { if (Game.upgrades[upgrade.id] || Game.goldTesseracts < upgrade.cost) return; Game.goldTesseracts -= upgrade.cost; Game.upgrades[upgrade.id] = true; Game.showBlessingChoice(nextLevel); }); upgradeCards.appendChild(button); });
  var continueBox = document.getElementById("blessing-continue"); continueBox.innerHTML = "";
  var continueButton = document.createElement("button"); continueButton.className = "continue-button"; continueButton.textContent = "Continue"; continueButton.addEventListener("click", function () { panel.hidden = true; Game.showCurseChoice(nextLevel); }); continueBox.appendChild(continueButton); panel.hidden = false; };
Game.showEnemyChoice = function (nextLevel) { Game.mode = "choice"; var panel = document.getElementById("enemy-choice"), cards = document.getElementById("enemy-cards"); cards.innerHTML = ""; Game.showMessage("Choose an enemy for level " + (nextLevel + 1)); Enemy.randomChoices().forEach(function (choice) { var button = document.createElement("button"); button.className = "enemy-card" + (choice.dimensional ? " dimensional" : ""); button.innerHTML = (choice.dimensional ? "<em>&#9733; DIMENSIONAL (" + choice.tag + ")</em>" : "") + "<strong>" + choice.name + "</strong><span>" + choice.description + "</span>"; button.addEventListener("click", function () { panel.hidden = true; Game.startLevel(nextLevel, choice.type); }); cards.appendChild(button); }); panel.hidden = false; };
Game.showMessage = function (text) { document.getElementById("message").textContent = text; };
Game.update = function () {
   if (Game.mode === "command") return;
   if (Input.restart) { document.getElementById("enemy-choice").hidden = true; document.getElementById("blessing-choice").hidden = true; document.getElementById("curse-choice").hidden = true; Altars.reset(); Ads.clear(); Game.showClassChoice(); return; }
   if (Game.mode !== "playing") return;
   Features.update();
   if (Game.mode !== "playing") return; // an altar may have just opened
   Player.update(); Level.updateTesseracts(); Level.updateCollapse(); Level.finishCollapse(); Enemy.update();
   if (Player.isDead() || Enemy.hitsPlayer() || Features.killsPlayer()) { Game.levelNumber = CONFIG.START_LEVEL; Game.mode = "dead"; Ads.clear(); Draw.burst(Enemy.pcx(), Enemy.pcy(), "#c77dff", 30); Draw.addShake(8); Game.showMessage((Features.deathReason ? Features.deathReason + " " : "You hit something. ") + "Press R to return to class select."); return; }
   if (Player.hasWon()) Game.nextLevel();
};
Game.loop = function () { Game.update(); Draw.updateCamera(); Draw.everything(); window.requestAnimationFrame(Game.loop); };