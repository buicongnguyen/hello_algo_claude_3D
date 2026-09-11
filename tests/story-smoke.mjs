import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { chromium } from "playwright-core";

const ROOT = process.cwd(), PORT = 49435;
const URL = process.env.GAME_URL || `http://127.0.0.1:${PORT}/`;
const OUT = join(ROOT, "test-results", "story-production");
mkdirSync(OUT, { recursive: true });
const executablePath = [
  join(process.env["ProgramFiles(x86)"] || "", "Microsoft", "Edge", "Application", "msedge.exe"),
  join(process.env.ProgramFiles || "", "Google", "Chrome", "Application", "chrome.exe"),
  "/usr/bin/google-chrome", "/usr/bin/chromium",
].find(path => existsSync(path));
assert.ok(executablePath, "Chrome or Edge is required");
const server = process.env.GAME_URL ? null : spawn(process.execPath, ["node_modules/vite/bin/vite.js", "--host", "127.0.0.1", "--port", String(PORT), "--strictPort"], { cwd: ROOT, stdio: ["ignore", "pipe", "inherit"] });
if (server) await new Promise((resolve, reject) => {
  const timeout = setTimeout(() => reject(new Error("Vite did not start")), 12000);
  server.stdout.on("data", chunk => { if (String(chunk).includes(`http://127.0.0.1:${PORT}`)) { clearTimeout(timeout); resolve(); } });
  server.once("exit", code => reject(new Error(`Vite exited early: ${code}`)));
});
let browser;
try {
  browser = await chromium.launch({ executablePath, headless: true, args: ["--use-angle=swiftshader", "--enable-webgl"] });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, hasTouch: true });
  const errors = [];
  page.on("pageerror", error => errors.push(error.message));
  page.on("console", message => { if (message.type() === "error" && /THREE|WebGL|shader/i.test(message.text())) errors.push(message.text()); });
  await page.goto(URL, { waitUntil: "networkidle" });
  await page.locator("#gameTitle").waitFor({ state: "visible" });
  await page.locator("#continueButton").click();
  assert.equal(await page.locator("#campaignModeSelect").inputValue(), "story");
  assert.match(await page.locator("#briefLocation").textContent(), /Breakwater Marina/);
  assert.equal(await page.locator("#briefBeats li").count(), 2);
  await page.screenshot({ path: join(OUT, "01-briefing-desktop.png") });
  await page.locator("#campaignModeSelect").selectOption("challenge");
  assert.match(await page.locator("#briefPace").textContent(), /Timed mission: 85 seconds/);
  await page.locator("#campaignModeSelect").selectOption("story");
  await page.setViewportSize({ width: 390, height: 844 });
  const launchBounds = await page.locator("#launchButton").boundingBox();
  assert.ok(launchBounds.y >= 0 && launchBounds.y + launchBounds.height <= 844, "mission launch stays visible on a phone");
  await page.screenshot({ path: join(OUT, "02-briefing-portrait.png") });
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
  await page.locator("#launchButton").click();
  assert.equal(await page.locator("#speakerName").textContent(), "LUMA");
  await page.locator("#nextDialogue").focus();
  await page.keyboard.press("Enter");
  assert.equal(await page.locator("#speakerName").textContent(), "BOLT");
  await page.locator("#nextDialogue").click();
  assert.equal(await page.locator("#dialogue").isVisible(), false);
  await page.setViewportSize({ width: 1440, height: 900 });

  const districtReports = [];
  for (const id of ["trail", "split-current", "approaches", "storm", "core"]) {
    districtReports.push(await page.evaluate(id => {
      const { game, world, ui, catalog } = window.__ROBOT_BEACH__;
      const item = catalog.find(item => item.stage.id === id);
      game.begin(item); game.paused = true; ui.hideDialogue(); game.updateHUD(.1);
      world.update(.05, game.player, true);
      return { district: world.mission.getObjectByName(`District_${item.chapter.id}`)?.name,
        sky: world.scene.background.getHex(), calls: world.renderer.info.render.calls, triangles: world.renderer.info.render.triangles,
        shelters: game.shelters.length, gates: game.gates.length };
    }, id));
    await page.screenshot({ path: join(OUT, `03-district-${id}.png`) });
  }
  assert.ok(districtReports.every(report => report.district && report.calls <= 450 && report.triangles <= 400000));
  assert.equal(new Set(districtReports.map(report => report.sky)).size, 5);
  assert.equal(districtReports[1].shelters, 2);
  assert.equal(districtReports[3].gates, 8);
  console.log("District rendering checks:", JSON.stringify(districtReports));

  const relay = await page.evaluate(() => {
    const { game, catalog } = window.__ROBOT_BEACH__;
    game.begin(catalog.find(item => item.stage.id === "trail")); game.paused = true;
    // Solve from the receiver backward; use the same nearby interaction as the UI.
    for (const node of [...game.relayNodes].reverse()) {
      const next = game.relayNodes[node.id + 1] || game.stage.receiver;
      const dx = next.x - node.x, dz = next.z - node.z;
      const desired = dx > 0 ? 1 : dx < 0 ? 3 : dz > 0 ? 2 : 0;
      game.player.x = node.x; game.player.z = node.z;
      while (node.turn !== desired) game.interact();
    }
    return { complete: game.relayState.complete, saved: game.progress.completed.includes("signal:trail"), outcome: document.querySelector("#departureStory").textContent };
  });
  assert.ok(relay.complete && relay.saved);
  assert.match(relay.outcome, /SUNDOWN/);
  await page.screenshot({ path: join(OUT, "04-story-departure.png") });
  await page.evaluate(() => { const { game, ui } = window.__ROBOT_BEACH__; game.completeVictory(); game.stop(); ui.showTitle(); ui.showJournal(); });
  assert.match(await page.locator("#modalText").textContent(), /SUNDOWN/);
  assert.doesNotMatch(await page.locator("#modalText").textContent(), /Protection protocol revised/);
  await page.screenshot({ path: join(OUT, "05-journal.png") });

  await page.evaluate(() => {
    const { game, catalog, ui } = window.__ROBOT_BEACH__;
    game.progress.completed = catalog.slice(0, -1).map(item => `${item.chapter.id}:${item.stage.id}`);
    game.begin(catalog.at(-1)); game.paused = true;
    game.core.health = 3; game.metrics.damageTaken = 2; game.spawned = game.finalWaveCount;
    game.updateFinale(0); ui.hideDialogue();
  });
  await page.reload({ waitUntil: "networkidle" });
  await page.locator("#resumeCheckpoint").waitFor({ state: "visible" });
  await page.locator("#resumeCheckpoint").click();
  const checkpoint = await page.evaluate(() => {
    const { game, ui } = window.__ROBOT_BEACH__; game.paused = true; ui.hideDialogue();
    return { phase: game.phase, core: game.core.health, damage: game.metrics.damageTaken, ammo: game.combat.ammo };
  });
  assert.deepEqual(checkpoint, { phase: "warden", core: 3, damage: 2, ammo: 36 });
  await page.evaluate(() => {
    const { game, world, ui } = window.__ROBOT_BEACH__;
    game.disableEntity(game.boss, false); game.updateFinale(0);
    game.player.x = game.wardenRepair.x + 2; game.player.z = game.wardenRepair.z;
    game.player.object.position.set(game.player.x, .55, game.player.z);
    game.updatePrompt(); game.updateHUD(.1); ui.hideDialogue();
    world.update(.05, game.player, true);
  });
  assert.match(await page.locator("#prompt").textContent(), /FREE REPAIR/);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: join(OUT, "06-warden-repair-portrait.png") });
  await page.evaluate(() => {
    const { game } = window.__ROBOT_BEACH__;
    game.combat.scrap = 0; game.interact();
    game.player.x = game.rocketGoal.x; game.player.z = game.rocketGoal.z; game.interact();
  });
  assert.match(await page.locator("#departureStory").textContent(), /Protection protocol revised/);
  await page.screenshot({ path: join(OUT, "07-festival-portrait.png") });
  await page.reload({ waitUntil: "networkidle" });
  await page.locator("#gameTitle").waitFor({ state: "visible" });
  assert.equal(await page.locator("#resumeCheckpoint").isVisible(), false);
  assert.ok(await page.evaluate(() => window.__ROBOT_BEACH__.game.progress.completed.includes("siege:signalbreak")));
  assert.deepEqual(errors, []);
  console.log("Story browser checks passed: briefings, both modes, attributed manual radio, five districts, relay actions, journal, checkpoint reload, free Warden repair, festival and mobile layout.");
} finally {
  if (browser) await browser.close();
  server?.kill("SIGTERM");
}
