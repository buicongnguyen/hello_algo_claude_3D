import { spawn } from "node:child_process";
import { existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { chromium } from "playwright-core";

const ROOT = process.cwd();
const PORT = 49433;
const OUT = join(ROOT, "test-results");
mkdirSync(OUT, { recursive: true });
const paths = [
  join(process.env["ProgramFiles(x86)"] || "", "Microsoft", "Edge", "Application", "msedge.exe"),
  join(process.env.ProgramFiles || "", "Microsoft", "Edge", "Application", "msedge.exe"),
  join(process.env.ProgramFiles || "", "Google", "Chrome", "Application", "chrome.exe"),
];
const executablePath = paths.find(path => path && existsSync(path));
if (!executablePath) throw new Error("Edge or Chrome is required");

const server = spawn(process.execPath, ["node_modules/vite/bin/vite.js", "--host", "127.0.0.1", "--port", String(PORT)], { cwd: ROOT, stdio: ["ignore", "pipe", "inherit"] });
await new Promise((resolve, reject) => {
  const timer = setTimeout(() => reject(new Error("Vite did not start")), 12_000);
  server.stdout.on("data", chunk => { if (String(chunk).includes(`http://127.0.0.1:${PORT}`)) { clearTimeout(timer); resolve(); } });
});

let browser;
try {
  browser = await chromium.launch({ executablePath, headless: true, args: ["--use-angle=swiftshader", "--enable-webgl"] });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
  await page.goto(`http://127.0.0.1:${PORT}/`, { waitUntil: "networkidle" });
  await page.waitForFunction(() => window.__ROBOT_BEACH__?.world.models.size === 25);
  await page.getByRole("heading", { name: /Signalbreak/i }).waitFor({ state: "visible", timeout: 20_000 });
  if (!process.env.ART_ONLY) {
  await page.screenshot({ path: join(OUT, "01-title.png") });
  await page.getByRole("button", { name: "Mission map" }).click();
  await page.screenshot({ path: join(OUT, "02-map.png"), fullPage: true });
  await page.locator(".stage-dots button").first().click();
  await page.getByRole("button", { name: "Enter mission" }).click();
  await page.waitForTimeout(600);
  await page.screenshot({ path: join(OUT, "03-mission.png") });

  const mobile = await browser.newPage({ viewport: { width: 844, height: 390 }, hasTouch: true });
  await mobile.goto(`http://127.0.0.1:${PORT}/`, { waitUntil: "networkidle" });
  await mobile.getByRole("heading", { name: /Signalbreak/i }).waitFor({ state: "visible", timeout: 20_000 });
  await mobile.getByRole("button", { name: "Begin journey" }).click();
  await mobile.getByRole("button", { name: "Enter mission" }).click();
  await mobile.waitForTimeout(500);
  await mobile.screenshot({ path: join(OUT, "04-compact-mission.png") });
  await mobile.setViewportSize({ width: 390, height: 844 });
  await mobile.screenshot({ path: join(OUT, "05-portrait-mission.png") });
  await page.evaluate(() => {
    const api = window.__ROBOT_BEACH__;
    api.game.begin(api.catalog.find(item => item.stage.id === "core"));
  });
  await page.waitForTimeout(600);
  await page.screenshot({ path: join(OUT, "06-circuit.png") });
  const setupBrawl = () => {
    const api = window.__ROBOT_BEACH__;
    api.game.begin(api.brawl);
    const c = api.game.combat;
    c.collect(c.pickups.find(p => p.type === "bubble"));
    c.freezeCharges = 2; c.whistles = 1;
    for (let i = 0; i < 3; i++) {
      const e = api.game.spawnEnemy(false, i);
      e.x = -4 + i * 4; e.z = 5;
    }
    c.callAnimals();
    api.ui.hideDialogue();
  };
  await page.evaluate(setupBrawl);
  await page.waitForTimeout(650);
  await page.screenshot({ path: join(OUT, "07-brawl-desktop.png") });
  await mobile.evaluate(setupBrawl);
  await mobile.waitForTimeout(650);
  await mobile.screenshot({ path: join(OUT, "08-brawl-portrait.png") });
  await mobile.setViewportSize({ width: 844, height: 390 });
  await mobile.screenshot({ path: join(OUT, "09-brawl-landscape.png") });
  await page.evaluate(() => { const api = window.__ROBOT_BEACH__; api.game.stop(); api.ui.showExpeditions(); });
  await page.screenshot({ path: join(OUT, "10-expeditions.png"), fullPage: true });
  for (let i = 0; i < 3; i++) {
    await page.evaluate(index => {
      const api = window.__ROBOT_BEACH__;
      api.game.begin(api.expeditions[index]);
      for (const item of api.game.expedition.discoveries) api.game.expedition.collect(item);
      api.game.combat.collect(api.game.combat.pickups.find(p => p.type === "bubble"));
      api.game.player.x = 0; api.game.player.z = 7; api.game.player.object.position.set(0, 0.55, 7);
      api.ui.hideDialogue();
    }, i);
    await page.waitForTimeout(1400);
    await page.screenshot({ path: join(OUT, `11-expedition-${i}.png`) });
  }
  await page.evaluate(() => { const api = window.__ROBOT_BEACH__; api.game.stop(); api.ui.showWorkshop(); });
  await page.getByRole("button", { name: "Candy pink", exact: true }).click();
  await page.waitForTimeout(1200);
  await page.screenshot({ path: join(OUT, "12-workshop.png") });
  await mobile.setViewportSize({ width: 390, height: 844 });
  await mobile.evaluate(() => {
    const api = window.__ROBOT_BEACH__; api.game.begin(api.expeditions[0]);
    for (const item of api.game.expedition.discoveries) api.game.expedition.collect(item);
    api.ui.hideDialogue();
  });
  await mobile.waitForTimeout(1200);
  await mobile.screenshot({ path: join(OUT, "13-expedition-portrait.png") });
  await mobile.evaluate(() => { const api = window.__ROBOT_BEACH__; api.game.stop(); api.ui.showWorkshop(); });
  await mobile.waitForTimeout(1200);
  await mobile.screenshot({ path: join(OUT, "14-workshop-portrait.png") });
  await mobile.setViewportSize({ width: 844, height: 390 });
  await mobile.evaluate(() => { const api = window.__ROBOT_BEACH__; api.game.begin(api.expeditions[2]); api.ui.hideDialogue(); });
  await mobile.waitForTimeout(1000);
  await mobile.screenshot({ path: join(OUT, "15-expedition-landscape.png") });
  const stageClear = () => {
    const { game, world, catalog, ui } = window.__ROBOT_BEACH__;
    game.begin(catalog[0]);
    for (const cell of game.entities.filter(e => e.kind === "cell")) game.collect(cell);
    game.player.x = game.goal.x; game.player.z = game.goal.z; game.interact();
    ui.hideDialogue();
    world.update(1.8, null);
  };
  await page.evaluate(stageClear);
  await page.screenshot({ path: join(OUT, "17-departure-desktop.png") });
  await page.getByRole("button", { name: "View results · Skip launch", exact: true }).click();
  await page.screenshot({ path: join(OUT, "18-results-desktop.png") });
  await mobile.setViewportSize({ width: 390, height: 844 });
  await mobile.evaluate(stageClear);
  await mobile.screenshot({ path: join(OUT, "19-departure-portrait.png") });
  await mobile.getByRole("button", { name: "View results · Skip launch", exact: true }).click();
  await mobile.screenshot({ path: join(OUT, "20-results-portrait.png") });
  await mobile.setViewportSize({ width: 844, height: 390 });
  await mobile.evaluate(stageClear);
  await mobile.screenshot({ path: join(OUT, "21-departure-landscape.png") });
  await mobile.close();
  }
  if (process.env.ART_ONLY) {
    await page.evaluate(() => {
      const { game, world, ui, catalog } = window.__ROBOT_BEACH__;
      game.begin(catalog[0]); ui.hideDialogue();
      for (let i = 0; i < 30; i++) world.update(.1, game.player);
    });
    await page.screenshot({ path: join(OUT, "24-art-mission-desktop.png") });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.evaluate(() => {
      const { game, world } = window.__ROBOT_BEACH__;
      world.setQuality("auto");
      for (let i = 0; i < 30; i++) world.update(.1, game.player);
    });
    await page.screenshot({ path: join(OUT, "25-art-mission-portrait.png") });
    await page.setViewportSize({ width: 1440, height: 900 });
  }
  // Inspection-only close-up: gameplay keeps the compact proportions.
  await page.addStyleTag({ content: "#app > :not(#game) { visibility: hidden !important; }" });
  await page.evaluate(() => {
    const { game, world } = window.__ROBOT_BEACH__;
    game.stop(); world.clearMission(); world.landmarks.visible = false;
    world.setQuality("high");
    for (const [name, x, label] of [["octopus", -5, "Octopus"], ["starfish", -2.5, "Starfish"], ["snail", 0, "NORI"], ["clam", 2.5, "Clam"], ["software_disc", 5, "Software CD"]]) {
      const actor = world.createActor(name, { x, z: 0 }, 1, world.mission, { nativeScale: true });
      world.animateSeaLife(actor, 0);
      const caption = world.label(actor, label, 0xffffff, 2);
      caption.scale.set(2, 0.38, 1);
    }
    world.camera.position.set(0, 6.5, 12.5); world.camera.lookAt(0, 0.75, 0);
    world.update = () => world.renderer.render(world.scene, world.camera);
    world.update();
  });
  await page.screenshot({ path: join(OUT, "16-detail-inspection.png") });
  await page.evaluate(() => {
    const { world } = window.__ROBOT_BEACH__;
    world.clearMission(); world.landmarks.visible = false;
    for (const [name, x] of [["kai", -2.5], ["bolt", 0], ["zombie_dog", 2.5]]) {
      const actor = world.createActor(name, { x, z: 0 }, 1, world.mission, { nativeScale: true });
      actor.rotation.y = -0.55;
    }
    world.camera.position.set(0, 4.3, 9); world.camera.lookAt(0, 1, 0); world.update();
  });
  await page.screenshot({ path: join(OUT, "22-robot-dog-inspection.png") });
  await page.evaluate(() => {
    const { world } = window.__ROBOT_BEACH__;
    world.clearMission(); world.landmarks.visible = false; world.boardwalk.visible = world.planks.visible = false;
    for (const [name, x, scale] of [["palm", -3.8, .95], ["starship", 0, 1.25], ["lighthouse", 4, .55]]) {
      const actor = world.createActor(name, { x, z: 0 }, scale, world.mission, { nativeScale: true });
      actor.rotation.y = -.35;
    }
    world.camera.position.set(0, 6, 12); world.camera.lookAt(0, 1.8, 0); world.update();
  });
  await page.screenshot({ path: join(OUT, "23-coastal-models.png") });
  console.log("Art inspection render:", await page.evaluate(() => ({ ...window.__ROBOT_BEACH__.world.renderer.info.render })));
  console.log(`Visual captures written to ${OUT}`);
} finally {
  if (browser) await browser.close();
  server.kill("SIGTERM");
}
