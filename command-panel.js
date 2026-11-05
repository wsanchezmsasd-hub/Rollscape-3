/* Hidden run editor. Hold Shift + Alt for one second, then enter FLOPPA. */
var CommandPanel = { holdTimer: null, shift: false, alt: false, previousMode: "playing", pieces: [], enemies: [], open: false };

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
  document.getElementById("command-password-submit").addEventListener("click", CommandPanel.unlock);
  document.getElementById("command-password-cancel").addEventListener("click", CommandPanel.closePassword);
  document.getElementById("command-password-input").addEventListener("keydown", function (event) { if (event.key === "Enter") CommandPanel.unlock(); });
  document.getElementById("command-close").addEventListener("click", CommandPanel.close);
};
CommandPanel.prompt = function () {
  CommandPanel.holdTimer = null;
  if (!CommandPanel.shift || !CommandPanel.alt) return;
  CommandPanel.previousMode = Game.mode;
  document.getElementById("command-password").hidden = false;
  var input = document.getElementById("command-password-input"); input.value = ""; input.focus();
};
CommandPanel.closePassword = function () { document.getElementById("command-password").hidden = true; };
CommandPanel.unlock = function () {
  var input = document.getElementById("command-password-input");
  if (input.value !== "FLOPPA") { CommandPanel.closePassword(); return; }
  CommandPanel.closePassword(); CommandPanel.openPanel();
};
CommandPanel.openPanel = function () {
  CommandPanel.open = true; Game.mode = "command";
  CommandPanel.pieces = ["start", "flat", "finish"];
  CommandPanel.enemies = Enemy.types.slice();
  document.getElementById("command-panel").hidden = false;
  CommandPanel.render();
};
CommandPanel.close = function () {
  CommandPanel.open = false; document.getElementById("command-panel").hidden = true;
  Game.mode = CommandPanel.previousMode === "command" ? "playing" : CommandPanel.previousMode;
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
  pieceNames.forEach(function (name) { var option = document.createElement("option"); option.value = name; option.textContent = name; add.appendChild(option); }); var addButton = document.createElement("button"); addButton.textContent = "Add piece"; addButton.onclick = function () { CommandPanel.pieces.push(add.value); CommandPanel.render(); }; box.appendChild(add); box.appendChild(addButton);
  var list = document.createElement("div"); list.className = "command-list"; CommandPanel.pieces.forEach(function (name, index) { var row = document.createElement("span"); row.textContent = (index + 1) + ". " + name; if (name !== "start" && name !== "finish") { var remove = document.createElement("button"); remove.textContent = "Remove"; remove.onclick = function () { CommandPanel.pieces.splice(index, 1); CommandPanel.render(); }; row.appendChild(remove); } list.appendChild(row); }); box.appendChild(list); return box;
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
  var actions = document.createElement("div"); actions.className = "command-actions"; var apply = document.createElement("button"); apply.textContent = "Apply custom run"; apply.onclick = CommandPanel.apply; actions.appendChild(apply); root.appendChild(actions);
};
CommandPanel.apply = function () {
  var pieces = CommandPanel.pieces.slice(); if (pieces.indexOf("start") < 0) pieces.unshift("start"); if (pieces.indexOf("finish") < 0) pieces.push("finish");
  Game.startCommandLevel({ name: "Command level", pieces: pieces }, CommandPanel.enemies); CommandPanel.close();
};
window.addEventListener("load", CommandPanel.start);