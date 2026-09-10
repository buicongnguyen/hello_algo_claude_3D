import "./styles.css";
import { World } from "./world.js";
import { InputController } from "./input.js";
import { UI } from "./ui.js";
import { Game } from "./game.js";
import { createProgress, nextIncomplete } from "./rules.js";
import { ALL_STAGES } from "./missions.js";

const STORAGE_KEY = "robot-beach-3d-signalbreak-v1";

function loadProgress() {
  try { return createProgress(JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}")); }
  catch { return createProgress(); }
}

function saveProgress(progress) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
}

let progress = loadProgress();
const canvas = document.querySelector("#game");
const input = new InputController();
const world = new World(canvas, progress.settings);
let game;
let ui;

ui = new UI(progress, {
  continue: () => ui.showBriefing(nextIncomplete(progress)),
  launch: item => game.begin(item),
  pause: () => game.pause(),
  reset: () => {
    if (!confirm("Reset all Signalbreak mission progress?")) return;
    progress = createProgress({ settings: progress.settings });
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
    saveProgress(progress);
  },
});

game = new Game(world, input, ui, progress, next => {
  progress = next;
  game.progress = next;
  saveProgress(next);
});

try {
  await world.initialize((amount, label) => ui.loading(amount, label));
  ui.loading(1, "ready");
  setTimeout(() => ui.showTitle(), 280);
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

window.__ROBOT_BEACH__ = { world, game, ui, input, catalog: ALL_STAGES };
