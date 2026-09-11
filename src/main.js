import "./styles.css";
import { World } from "./world.js";
import { InputController } from "./input.js";
import { UI } from "./ui.js";
import { Game } from "./game.js";
import { createProgress, earnedUpgrades, nextIncomplete } from "./rules.js";
import { ALL_STAGES, BRAWL } from "./missions.js";
import { Sound } from "./sound.js";
import { EXPEDITIONS } from "./expedition-data.js";
import { equipItem, EQUIPMENT, PAINTS } from "./equipment.js";

const STORAGE_KEY = "robot-beach-3d-signalbreak-v1";

function loadProgress() {
  try { return createProgress(JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}")); }
  catch { return createProgress(); }
}

function saveProgress(progress) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(progress)); return true; }
  catch { ui?.message("Progress kept for this session; browser storage is unavailable.", true); return false; }
}

let progress = loadProgress();
const canvas = document.querySelector("#game");
const input = new InputController();
const world = new World(canvas, progress.settings);
const sound = new Sound();
sound.enabled = progress.settings.sound !== false;
let game;
let ui;

ui = new UI(progress, {
  preview: enabled => {
    if (enabled) world.showRobotPreview(progress.equipment);
    else if (world.previewActor) world.clearMission();
  },
  paint: id => { if (Object.hasOwn(PAINTS, id)) { progress.equipment.paint = id; saveProgress(progress); } },
  equip: (id, remove) => {
    if (!Object.hasOwn(EQUIPMENT, id) || !progress.equipment.owned.includes(id)) return;
    if (remove) progress.equipment.equipped[EQUIPMENT[id].slot] = null;
    else equipItem(progress.equipment, id);
    world.previewAngle = EQUIPMENT[id].slot === "back" ? Math.PI + 0.4 : 0.4;
    saveProgress(progress);
  },
  continue: () => ui.showBriefing(nextIncomplete(progress)),
  brawl: () => ui.showBriefing(BRAWL),
  launch: item => { sound.unlock(); game.begin(item); },
  sound: kind => sound.play(kind),
  roam: () => {
    if (!earnedUpgrades(progress).freeRoam) return;
    sound.unlock();
    const last = ALL_STAGES.at(-1);
    game.begin({ ...last, stage: { ...last.stage, name: "Festival Free Roam", type: "roam", time: 0, count: 0, objective: "Explore the restored island with BOLT. Pause to return to your missions.", dialogue: ["No countdown. Just the sea, the light and all our friends."] } });
  },
  pause: () => game.pause(),
  reset: () => {
    if (!confirm("Reset all Signalbreak mission progress?")) return;
    progress = createProgress({ settings: progress.settings, equipment: progress.equipment, expeditionResults: progress.expeditionResults });
    saveProgress(progress);
    game.progress = progress;
    ui.setProgress(progress);
    ui.showMap();
  },
  settings: patch => {
    progress.settings = { ...progress.settings, ...patch };
    game.progress = progress;
    world.settings = progress.settings;
    if (patch.quality) world.setQuality(patch.quality);
    sound.enabled = progress.settings.sound !== false;
    saveProgress(progress);
  },
});

game = new Game(world, input, ui, progress, next => {
  progress = next;
  game.progress = next;
  const saved = saveProgress(next);
  world.setCampaign(next);
  return saved;
});

try {
  await world.initialize((amount, label) => ui.loading(amount, label));
  world.setCampaign(progress);
  ui.loading(1, "ready");
  setTimeout(() => ui.showTitle(), 280);
  if (world.failedModels.length) ui.message(`${world.failedModels.length} models could not load. Refresh to retry; the game remains playable.`, true);
} catch (error) {
  console.error(error);
  document.querySelector("#loadStatus").textContent = "The 3D island could not start. Try a WebGL-enabled browser.";
}

let lastTime = performance.now();
function frame(now) {
  const dt = Math.min(0.05, Math.max(0, (now - lastTime) / 1000));
  lastTime = now;
  game.update(dt);
  world.update(dt, game.running ? game.player : null, progress.settings.reducedMotion);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

document.addEventListener("visibilitychange", () => {
  lastTime = performance.now();
  if (document.hidden && game.running && !game.paused) game.pause();
});

window.__ROBOT_BEACH__ = { world, game, ui, input, catalog: ALL_STAGES, brawl: BRAWL, expeditions: EXPEDITIONS };
