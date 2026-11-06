/* Hidden run editor. Hold Shift + Alt for one second, then enter FLOPPA. */
var CommandPanel = { holdTimer: null, shift: false, alt: false, previousMode: "playing", pieces: [], enemies: [], open: false, unlocked: false, configDefaults: null, savedPresetKey: "rollscape-command-preset" };

CommandPanel.start = function () {
  document.addEventListener("keydown", function (event) {
    if (event.key === "Shift") CommandPanel.shift = true;
    if (event.key === "Alt") CommandPanel.alt = true;
    if (CommandPanel.shift && CommandPanel.alt && !CommandPanel.holdTimer && !CommandPanel.open) {
      CommandPanel.holdTimer = window.setTimeout(CommandPanel.prompt, 1000);
    }
  });
  document.addEventListener("keyup", function (event) {
    if (event.key === "Shift") CommandPanel.shift = false;
    if (event.key === "Alt") CommandPanel.alt = false;
    if (!CommandPanel.shift || !CommandPanel.alt) { window.clearTimeout(CommandPanel.holdTimer); CommandPanel.holdTimer = null; }
  });
  CommandPanel.configDefaults = JSON.parse(JSON.stringify(CONFIG));
  document.getElementById("command-password-submit").addEventListener("click", CommandPanel.unlock);
  document.getElementById("command-password-cancel").addEventListener("click", CommandPanel.closePassword);
  document.getElementById("command-password-input").addEventListener("keydown", function (event) { if (event.key === "Enter") CommandPanel.unlock(); });
  document.getElementById("command-close").addEventListener("click", CommandPanel.close);
};
CommandPanel.prompt = function () {
  CommandPanel.holdTimer = null;
  if (!CommandPanel.shift || !CommandPanel.alt) return;
  CommandPanel.previousMode = Game.mode;
  if (CommandPanel.unlocked) { CommandPanel.openPanel(); return; }
  document.getElementById("command-password").hidden = false;
  var input = document.getElementById("command-password-input"); input.value = ""; input.focus();
};
CommandPanel.closePassword = function () { document.getElementById("command-password").hidden = true; };
CommandPanel.unlock = function () {
  var input = document.getElementById("command-password-input");
  if (input.value !== "FLOPPA") { CommandPanel.closePassword(); return; }
  CommandPanel.unlocked = true;
  CommandPanel.closePassword(); CommandPanel.openPanel();
};
CommandPanel.openPanel = function () {
  CommandPanel.open = true; Game.mode = "command";
  var definition = Level.getDefinition(Game.levelNumber);
  CommandPanel.pieces = definition && definition.pieces ? definition.pieces.slice() : ["spawn"];
  CommandPanel.enemies = Enemy.types.slice();
  document.getElementById("command-panel").hidden = false;
  CommandPanel.render();
};
CommandPanel.close = function () {
  CommandPanel.open = false; document.getElementById("command-panel").hidden = true;
  Game.mode = CommandPanel.previousMode === "command" ? "playing" : CommandPanel.previousMode;
};
CommandPanel.button = function (label, onClick) {
  var button = document.createElement("button"); button.textContent = label; button.addEventListener("click", onClick); return button;
};
CommandPanel.closeAnd = function (action) { CommandPanel.close(); action(); };
CommandPanel.resetConfig = function () {
  var restored = JSON.parse(JSON.stringify(CommandPanel.configDefaults));
  Object.keys(CONFIG).forEach(function (key) { delete CONFIG[key]; });
  Object.keys(restored).forEach(function (key) { CONFIG[key] = restored[key]; });
  CommandPanel.render();
};
CommandPanel.restartRun = function () {
  var pieces = CommandPanel.pieces.slice(), enemies = CommandPanel.enemies.slice();
  CommandPanel.closeAnd(function () { Game.startCommandLevel({ name: "Command level", pieces: pieces }, enemies); });
};
CommandPanel.advanceLevel = function () { CommandPanel.closeAnd(function () { Game.nextLevel(); }); };
CommandPanel.loseLevel = function () {
  CommandPanel.close();
  Game.levelNumber = CONFIG.START_LEVEL;
  Game.mode = "dead";
  Game.showMessage("Command action: level failed. Press R to return to class select.");
};
CommandPanel.playerState = function () {
  var box = document.createElement("div"), grid = document.createElement("div"); grid.className = "command-grid";
  grid.appendChild(CommandPanel.field("X position", Math.round(Player.x), function (value) { Player.x = Math.max(0, value); }));
  grid.appendChild(CommandPanel.field("Y position", Math.round(Player.y), function (value) { Player.y = value; }));
  grid.appendChild(CommandPanel.field("Horizontal velocity", Player.vx, function (value) { Player.vx = value; }));
  grid.appendChild(CommandPanel.field("Vertical velocity", Player.vy, function (value) { Player.vy = value; }));
  grid.appendChild(CommandPanel.field("Invincible", Player.invincibilityTimer > 0, function (value) { Player.invincibilityTimer = value ? 999999 : 0; }));
  grid.appendChild(CommandPanel.field("Ammo", Weapons.ammo, function (value) { Weapons.ammo = Math.max(0, Math.floor(value)); Weapons.reloadTimer = 0; }));
  grid.appendChild(CommandPanel.field("Ability cooldown", Weapons.abilityCooldown, function (value) { Weapons.abilityCooldown = Math.max(0, Math.floor(value)); }));
  grid.appendChild(CommandPanel.field("Dash cooldown", Player.dashCooldown, function (value) { Player.dashCooldown = Math.max(0, Math.floor(value)); }));
  box.appendChild(grid);
  var grant = document.createElement("div");
  grant.appendChild(CommandPanel.button("Clear fake tesseract hit", function () { Player.fakeTesseractHit = false; }));
  grant.appendChild(CommandPanel.button("Grant red tesseracts", function () { Level.redTesseracts.forEach(function (item) { item.collected = true; }); }));
  grant.appendChild(CommandPanel.button("Grant 10 gold", function () { Game.goldTesseracts += 10; }));
  grant.appendChild(CommandPanel.button("Refill ammo", function () { var stats = CONFIG.CLASS_STATS[Player.classType]; Weapons.ammo = stats ? stats.ammo + Game.blessings.ammo * CONFIG.BLESSING_EFFECTS.ammoBonus : 0; Weapons.reloadTimer = 0; }));
  box.appendChild(grant); return box;
};
CommandPanel.enemyControls = function () {
  var box = document.createElement("div"), choices = Enemy.choices.map(function (choice) { return { type: choice.type, name: choice.name }; });
  choices = choices.concat(Enemy.choices.map(function (choice) { return { type: "dim_" + choice.type, name: "Dimensional " + choice.name }; }));
  var select = document.createElement("select"); choices.forEach(function (choice) { var option = document.createElement("option"); option.value = choice.type; option.textContent = choice.name; select.appendChild(option); });
  box.appendChild(select);
  box.appendChild(CommandPanel.button("Spawn at player", function () { Enemy.spawnType(select.value, Player.x + CONFIG.PLAYER_SIZE * 3, Player.y); }));
  box.appendChild(CommandPanel.button("Spawn at cursor", function () { Enemy.spawnType(select.value, Input.mouseX, Input.mouseY); }));
  box.appendChild(CommandPanel.button("Remove all enemies", function () { Enemy.enemies = []; Enemy.bullets = []; Enemy.explosions = []; Enemy.portals = []; }));
  box.appendChild(CommandPanel.button("Kill all enemies", function () { Enemy.enemies.forEach(function (enemy) { Enemy.kill(enemy); }); }));
  box.appendChild(CommandPanel.button("Toggle enemy AI", function () { Enemy.aiPaused = !Enemy.aiPaused; this.textContent = Enemy.aiPaused ? "Enable enemy AI" : "Disable enemy AI"; }));
  return box;
};
CommandPanel.randomize = function () {
  function shuffle(items) { return items.slice().sort(function () { return Math.random() - 0.5; }); }
  var pieceNames = Object.keys(Level.pieces).filter(function (name) { return name.charAt(0) !== "_"; });
  CommandPanel.pieces = ["spawn"].concat(shuffle(pieceNames).slice(0, 4));
  CommandPanel.enemies = shuffle(Enemy.choices.map(function (choice) { return choice.type; })).slice(0, 3);
  Game.blessingOffers = [Game.nextBlessingOffer(), Game.nextBlessingOffer()];
  Game.curses = [Game.curseChoices[Math.floor(Math.random() * Game.curseChoices.length)].id];
  CommandPanel.render();
};
CommandPanel.savePreset = function () { localStorage.setItem(CommandPanel.savedPresetKey, JSON.stringify({ pieces: CommandPanel.pieces, enemies: CommandPanel.enemies, curses: Game.curses, blessings: Game.blessings, upgrades: Game.upgrades })); };
CommandPanel.loadPreset = function () {
  var raw = localStorage.getItem(CommandPanel.savedPresetKey); if (!raw) return;
  var preset = JSON.parse(raw);
  if (Array.isArray(preset.pieces)) CommandPanel.pieces = preset.pieces;
  if (Array.isArray(preset.enemies)) CommandPanel.enemies = preset.enemies;
  if (Array.isArray(preset.curses)) Game.curses = preset.curses;
  if (preset.blessings) Game.blessings = preset.blessings;
  if (preset.upgrades) Game.upgrades = preset.upgrades;
  CommandPanel.render();
};
CommandPanel.exportPreset = function () {
  var data = JSON.stringify({ pieces: CommandPanel.pieces, enemies: CommandPanel.enemies, curses: Game.curses, blessings: Game.blessings, upgrades: Game.upgrades }, null, 2);
  var link = document.createElement("a"); link.href = URL.createObjectURL(new Blob([data], { type: "application/json" })); link.download = "rollscape-command-preset.json"; link.click(); URL.revokeObjectURL(link.href);
};
CommandPanel.importPreset = function () {
  var raw = window.prompt("Paste a command preset JSON:");
  if (!raw) return;
  try { var preset = JSON.parse(raw); localStorage.setItem(CommandPanel.savedPresetKey, JSON.stringify(preset)); CommandPanel.loadPreset(); }
  catch (error) { window.alert("Invalid command preset JSON."); }
};
CommandPanel.section = function (title, content) { var section = document.createElement("details"); section.className = "command-section"; var summary = document.createElement("summary"); summary.textContent = title; section.appendChild(summary); section.appendChild(content); return section; };
CommandPanel.field = function (label, value, onChange) {
  var wrap = document.createElement("label"); wrap.className = "command-field"; var name = document.createElement("span"); name.textContent = label; wrap.appendChild(name);
  var input = document.createElement("input"); input.type = typeof value === "boolean" ? "checkbox" : "number"; if (input.type === "checkbox") input.checked = value; else { input.value = value; input.step = "any"; }
  input.addEventListener("change", function () { onChange(input.type === "checkbox" ? input.checked : Number(input.value)); }); wrap.appendChild(input); return wrap;
};
CommandPanel.configFields = function (object, prefix, parent) {
  Object.keys(object).forEach(function (key) {
    var value = object[key], path = prefix ? prefix + "." + key : key;
    if (value && typeof value === "object" && !Array.isArray(value)) CommandPanel.configFields(value, path, parent);
    else if (typeof value === "number" || typeof value === "boolean") parent.appendChild(CommandPanel.field(path, value, function (next) { var target = CONFIG, parts = path.split("."); for (var i = 0; i < parts.length - 1; i++) target = target[parts[i]]; target[parts[parts.length - 1]] = next; }));
  });
};
CommandPanel.configCategory = function (title, keys) {
  var section = document.createElement("details"); section.className = "command-subsection";
  var summary = document.createElement("summary"); summary.textContent = title; section.appendChild(summary);
  var grid = document.createElement("div"); grid.className = "command-grid";
  keys.forEach(function (key) { if (CONFIG[key] !== undefined) { var values = {}; values[key] = CONFIG[key]; CommandPanel.configFields(values, "", grid); } });
  section.appendChild(grid); return section;
};
CommandPanel.renderConfig = function () {
  var wrapper = document.createElement("div"), groups = [
    { title: "Player and movement", keys: ["TILE", "ROWS", "PIECE_COLS", "CANVAS_W", "CANVAS_H", "MOVE_SPEED", "JUMP_POWER", "GRAVITY", "MAX_FALL", "MAX_HORIZONTAL_SPEED", "MAX_VERTICAL_SPEED", "COYOTE_TIME_FRAMES", "PLAYER_SIZE", "PLAYER_RADIUS"] },
    { title: "Class functions and weapons", keys: ["WEAPON_PROJECTILE_SPEED", "WEAPON_PROJECTILE_LIFE", "WEAPON_HIT_REACH", "WEAPON_RELOAD_FRAMES", "CLASS_STATS", "BAZOOKA_FIRE_COOLDOWN", "BAZOOKA_BLAST_RADIUS", "BAZOOKA_KNOCKBACK", "BAZOOKA_EXPLOSION_TIME", "TOMAHAWK_COOLDOWN", "TOMAHAWK_THROW_SPEED", "TOMAHAWK_GRAVITY", "TOMAHAWK_SPIN_RATE", "TOMAHAWK_VOLLEY_SPREAD", "TOMAHAWK_VOLLEY_COOLDOWN", "PISTOL_DASH_SPEED", "PISTOL_DASH_TIME", "PISTOL_DASH_COOLDOWN", "KATANA_SLASH_COOLDOWN", "KATANA_PARRY_WINDOW", "KATANA_PARRY_HIT_COOLDOWN", "KATANA_PARRY_MISS_COOLDOWN", "KATANA_PARRY_LAUNCH", "KATANA_PARRY_SLOW_TIME", "KATANA_PARRY_INVINCIBILITY", "KATANA_SLASH_RANGE", "KATANA_SLASH_REACH", "KATANA_PARRY_REFLECT_SPEED", "KATANA_PARRY_SLOW_MULTIPLIER", "KATANA_SLASH_VISUAL_RADIUS", "KATANA_SLASH_VISUAL_ARC", "KATANA_SLASH_VISUAL_WIDTH", "KATANA_SLASH_VISUAL_LIFE"] },
    { title: "Enemy stats and behavior", keys: ["ENEMY_START_DISTANCE", "ENEMY_SPAWN_HEIGHT", "CUOBID_SPEED", "CUOBID_DISTANCE_SPEED", "CUOBID_MAX_SPEED", "CUOBID_COMBINED_SPEED_MULT", "CUOBID_COMBINED_MAX_SPEED", "CUOBID_GROUP_SIZE", "CUOBID_SIZE", "CUOBID_SPAWN_SPACING", "CUOBID_MERGE_DISTANCE", "CUOBID_HIT_KNOCKBACK", "CUOBID_KNOCKBACK_DECAY", "DRONE_FOLLOW_RATE", "DRONE_FAST_FOLLOW_RATE", "DRONE_HEIGHT_ABOVE_PLAYER", "DRONE_BULLET_SPEED", "DRONE_BULLET_LIFE", "DRONE_SHOT_INTERVAL", "DRONE_SHOTS", "DRONE_FIRE_TIME", "DRONE_AIM_FRAMES", "DRONE_BURST_COOLDOWN", "DRONE_FIRE_MOVE_FACTOR", "DRONE_COUNT", "DRONE_OFFSET_X", "DRONE_OFFSET_Y", "DRONE_LEAD_FRAMES", "DRONE_MAX_SPEED", "DRONE_FIRE_RANGE", "DRILL_TURN_RATE", "DRILL_DASH_DELAY", "GREEN_BALL_COUNT", "GREEN_BALL_BOUNCE", "GREEN_BALL_SIZE", "GREEN_BALL_JUMP_INTERVAL", "GREEN_BALL_JUMP_SPEED", "GREEN_BALL_SPAWN_X_SPACING", "GREEN_BALL_SPAWN_Y_SPACING", "CUBOID_SPAWN_Y_RANGE", "DOMINO_WIDTH", "DOMINO_HEIGHT", "DOMINO_SPEED", "DOMINO_JUMP_SPEED", "DOMINO_JUMP_HEIGHT", "DOMINO_LEAP_RANGE", "DOMINO_TELEGRAPH_FRAMES", "DOMINO_GROUND_PAUSE_FRAMES", "DOMINO_SHOCKWAVE_RADIUS", "DOMINO_SHOCKWAVE_FORCE", "DOMINO_SHOCKWAVE_LIFE", "DOMINO_LETHAL_FRAMES", "DOMINO_AIRBORNE_LETHAL", "EVIL_SPIKE_WARNING_TIME", "EVIL_SPIKE_DASH_SPEED", "EVIL_SPIKE_DASH_TIME", "EVIL_SPIKE_SIZE", "ASE_RADIUS", "ASE_SPEED_MULT", "ASE_TELEPORT_INTERVAL", "ASE_TELEPORT_WARNING", "ASE_TELEPORT_DISTANCE", "ASE_MIN_DISTANCE", "ROLLER_RADIUS", "ROLLER_BASE_DELAY_FRAMES", "ROLLER_STACK_DELAY_FRAMES", "ROCKET", "MOLD", "DIM"] },
    { title: "Enemy respawn times and health", keys: ["ENEMY_RESPAWN_DISTANCE", "ENEMY_RESPAWN_FRAMES", "ENEMY_HP"] },
    { title: "Tesseracts and progression", keys: ["RED_TESSERACTS_BASE", "RED_TESSERACTS_STEP", "GOLD_TESSERACTS_PER_LEVEL", "FIVE_CUBE_COUNT", "FIVE_CUBE_KILL_RADIUS", "TESSERACT_COLLECTION_RANGE", "TESSERACT_MAGNET_BONUS", "BLESSING_EFFECTS", "LATER_LEVEL_JUMP_BONUS", "LATER_LEVEL_SPIKE_MARGIN", "BLESSING_COSTS", "UPGRADE_COSTS", "MATRIX_SPEED", "JET", "DIMENSIONAL_CHANCE", "DIMENSIONAL_STACKS"] },
    { title: "Curses", keys: ["CURSES"] },
    { title: "World and display", keys: ["LINE_WIDTH", "DOT_DISTANCE", "COLLAPSE_INTERVAL", "COLLAPSE_WARNING_FRAMES", "COLLAPSE_MAP_FRACTION", "PARTICLE_COUNT", "START_LEVEL"] }
  ];
  var assigned = {};
  groups.forEach(function (group) { group.keys.forEach(function (key) { assigned[key] = true; }); wrapper.appendChild(CommandPanel.configCategory(group.title, group.keys)); });
  var remaining = Object.keys(CONFIG).filter(function (key) { return !assigned[key]; });
  if (remaining.length) wrapper.appendChild(CommandPanel.configCategory("Other", remaining));
  return wrapper;
};
CommandPanel.renderShop = function () {
  var box = document.createElement("div"), offers = Game.blessingOffers || [Game.blessingDefinitions[0], Game.blessingDefinitions[1]];
  [0, 1].forEach(function (index) { var label = document.createElement("label"); label.className = "command-select"; label.textContent = "Offer " + (index + 1); var select = document.createElement("select"); Game.blessingDefinitions.forEach(function (item) { var option = document.createElement("option"); option.value = item.type; option.textContent = item.name; option.selected = offers[index] && offers[index].type === item.type; select.appendChild(option); }); select.addEventListener("change", function () { Game.blessingOffers = Game.blessingOffers || offers.slice(); Game.blessingOffers[index] = Game.blessingDefinitions.filter(function (item) { return item.type === select.value; })[0]; }); label.appendChild(select); box.appendChild(label); });
  var stacks = document.createElement("div"); Game.blessingDefinitions.forEach(function (item) { stacks.appendChild(CommandPanel.field(item.name + " stacks", Game.blessings[item.type], function (value) { Game.blessings[item.type] = Math.max(0, Math.floor(value)); })); });
  box.appendChild(stacks); var upgrades = document.createElement("div"); Game.upgradeDefinitions.forEach(function (item) { upgrades.appendChild(CommandPanel.field(item.name, Game.upgrades[item.id], function (value) { Game.upgrades[item.id] = value; })); }); box.appendChild(upgrades); return box;
};
CommandPanel.renderCurses = function () {
  var box = document.createElement("div"); box.className = "command-grid";
  Game.curseChoices.forEach(function (curse) {
    var count = Game.curseCount(curse.id);
    box.appendChild(CommandPanel.field(curse.name, count, function (value) {
      Game.curses = Game.curses.filter(function (id) { return id !== curse.id; });
      for (var i = 0; i < Math.max(0, Math.floor(value)); i++) Game.curses.push(curse.id);
    }));
  });
  return box;
};
CommandPanel.renderBuilder = function () {
  var box = document.createElement("div"), pieceNames = Object.keys(Level.pieces).filter(function (name) { return name.charAt(0) !== "_"; }), add = document.createElement("select");
  pieceNames.forEach(function (name) { var option = document.createElement("option"); option.value = name; option.textContent = name; add.appendChild(option); });
  ["left", "right"].forEach(function (side) { var addButton = document.createElement("button"); addButton.textContent = "Add " + side; addButton.onclick = function () { var index = side === "left" ? 0 : CommandPanel.pieces.length; CommandPanel.pieces.splice(index, 0, add.value); CommandPanel.render(); }; box.appendChild(addButton); }); box.insertBefore(add, box.firstChild);
  var list = document.createElement("div"); list.className = "command-list"; CommandPanel.pieces.forEach(function (name, index) { var row = document.createElement("span"); row.textContent = (index + 1) + ". " + name; if (name !== "spawn") { var remove = document.createElement("button"); remove.textContent = "Remove"; remove.onclick = function () { CommandPanel.pieces.splice(index, 1); CommandPanel.render(); }; row.appendChild(remove); } list.appendChild(row); }); box.appendChild(list); return box;
};
CommandPanel.renderEnemies = function () {
  var box = document.createElement("div"), choices = Enemy.choices.map(function (choice) { return { type: choice.type, name: choice.name }; });
  choices = choices.concat(Enemy.choices.map(function (choice) { return { type: "dim_" + choice.type, name: "Dimensional " + choice.name }; }));
  var select = document.createElement("select"); choices.forEach(function (choice) { var option = document.createElement("option"); option.value = choice.type; option.textContent = choice.name; select.appendChild(option); }); var add = document.createElement("button"); add.textContent = "Add enemy"; add.onclick = function () { CommandPanel.enemies.push(select.value); CommandPanel.render(); }; box.appendChild(select); box.appendChild(add);
  var list = document.createElement("div"); list.className = "command-list"; CommandPanel.enemies.forEach(function (type, index) { var row = document.createElement("span"); row.textContent = (index + 1) + ". " + type; var remove = document.createElement("button"); remove.textContent = "Remove"; remove.onclick = function () { CommandPanel.enemies.splice(index, 1); CommandPanel.render(); }; row.appendChild(remove); list.appendChild(row); }); box.appendChild(list); return box;
};
CommandPanel.render = function () {
  var root = document.getElementById("command-sections"); root.innerHTML = "";
  root.appendChild(CommandPanel.section("Config values", CommandPanel.renderConfig()));
  root.appendChild(CommandPanel.section("Shop items and stacks", CommandPanel.renderShop())); root.appendChild(CommandPanel.section("Curse stacks", CommandPanel.renderCurses())); root.appendChild(CommandPanel.section("Build a level", CommandPanel.renderBuilder())); root.appendChild(CommandPanel.section("Enemy stacks", CommandPanel.renderEnemies()));
  root.appendChild(CommandPanel.section("Player state", CommandPanel.playerState()));
  root.appendChild(CommandPanel.section("Live enemy controls", CommandPanel.enemyControls()));
  var presets = document.createElement("div"); presets.appendChild(CommandPanel.button("Save preset", CommandPanel.savePreset)); presets.appendChild(CommandPanel.button("Load preset", CommandPanel.loadPreset)); presets.appendChild(CommandPanel.button("Randomize run", CommandPanel.randomize)); presets.appendChild(CommandPanel.button("Export preset", CommandPanel.exportPreset)); presets.appendChild(CommandPanel.button("Import preset", CommandPanel.importPreset)); root.appendChild(CommandPanel.section("Preset management", presets));
  var actions = document.createElement("div"); actions.className = "command-actions";
  actions.appendChild(CommandPanel.button("Restart current custom run", CommandPanel.restartRun));
  actions.appendChild(CommandPanel.button("Skip to next level", CommandPanel.advanceLevel));
  actions.appendChild(CommandPanel.button("Win current level", CommandPanel.advanceLevel));
  actions.appendChild(CommandPanel.button("Lose current level", CommandPanel.loseLevel));
  actions.appendChild(CommandPanel.button("Reset all config values", CommandPanel.resetConfig));
  actions.appendChild(CommandPanel.button("Pause / unpause game", CommandPanel.close));
  root.appendChild(CommandPanel.section("Quick actions", actions));
  var applyActions = document.createElement("div"); applyActions.className = "command-actions";
  applyActions.appendChild(CommandPanel.button("Apply changes", CommandPanel.apply));
  root.appendChild(applyActions);
};
CommandPanel.apply = function () {
  var pieces = CommandPanel.pieces.filter(function (name) { return name !== "start" && name !== "finish"; }); if (pieces.indexOf("spawn") < 0) pieces.unshift("spawn");
  Game.startCommandLevel({ name: "Command level", pieces: pieces }, CommandPanel.enemies); CommandPanel.close();
};
window.addEventListener("load", CommandPanel.start);