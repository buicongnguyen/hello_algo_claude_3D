import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { chromium } from "playwright-core";

const ROOT = process.cwd();
const PORT = 49431;
const URL = process.env.GAME_URL || `http://127.0.0.1:${PORT}/`;
const paths = [
  join(process.env["ProgramFiles(x86)"] || "", "Microsoft", "Edge", "Application", "msedge.exe"),
  join(process.env.ProgramFiles || "", "Microsoft", "Edge", "Application", "msedge.exe"),
  join(process.env.ProgramFiles || "", "Google", "Chrome", "Application", "chrome.exe"),
  "/usr/bin/google-chrome", "/usr/bin/chromium",
];
const executablePath = paths.find(path => path && existsSync(path));
if (!executablePath) throw new Error("Edge or Chrome is required for the smoke test");

const server = process.env.GAME_URL ? null : spawn(process.execPath, ["node_modules/vite/bin/vite.js", "--host", "127.0.0.1", "--port", String(PORT), "--strictPort"], { cwd: ROOT, stdio: ["ignore", "pipe", "inherit"] });
if (server) await new Promise((resolve, reject) => {
  const timeout = setTimeout(() => reject(new Error("Vite did not start")), 12_000);
  server.stdout.on("data", chunk => {
    if (String(chunk).includes(`http://127.0.0.1:${PORT}`)) { clearTimeout(timeout); resolve(); }
  });
  server.once("exit", code => reject(new Error(`Vite exited early (${code})`)));
});

let browser;
try {
  browser = await chromium.launch({ executablePath, headless: true, args: ["--use-angle=swiftshader", "--enable-webgl"] });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const errors = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.goto(URL, { waitUntil: "networkidle" });
  await page.getByRole("heading", { name: /Signalbreak/i }).waitFor({ state: "visible", timeout: 20_000 });
  await page.getByRole("button", { name: "Mission map" }).click();
  if (await page.locator(".chapter-card").count() !== 5) throw new Error("Expected five chapter cards");
  if (await page.locator(".stage-dots button").count() !== 15) throw new Error("Expected fifteen mission buttons");
  await page.locator(".stage-dots button").first().click();
  await page.getByRole("button", { name: "Enter mission" }).click();
  await page.waitForTimeout(350);
  if (!await page.locator("#hud").isVisible()) throw new Error("Mission HUD is not visible");
  const before = await page.evaluate(() => ({ x: window.__ROBOT_BEACH__.game.player.x, z: window.__ROBOT_BEACH__.game.player.z }));
  await page.keyboard.down("KeyW");
  await page.waitForTimeout(350);
  await page.keyboard.up("KeyW");
  const after = await page.evaluate(() => ({ x: window.__ROBOT_BEACH__.game.player.x, z: window.__ROBOT_BEACH__.game.player.z }));
  if (Math.hypot(after.x - before.x, after.z - before.z) < 0.4) throw new Error("Keyboard movement did not move KAI");
  await page.keyboard.press("KeyQ");
  await page.waitForTimeout(80);
  const cooldown = await page.evaluate(() => window.__ROBOT_BEACH__.game.pulseCooldown);
  if (cooldown <= 0) throw new Error("Pulse action did not trigger");
  await page.keyboard.press("Escape");
  await page.getByRole("heading", { name: "Wake the Beach" }).waitFor({ state: "visible" });
  await page.getByRole("button", { name: "Resume" }).click();

  const assets = await page.evaluate(() => {
    const api = window.__ROBOT_BEACH__;
    return { loaded: api.world.models.size, actualBlender: Boolean(api.world.models.get("kai").getObjectByName("KAI_Robot")), limbs: api.game.player.object.userData.limbs.length };
  });
  if (assets.loaded !== 12 || !assets.actualBlender || assets.limbs !== 4) throw new Error(`Blender asset/pivot regression: ${JSON.stringify(assets)}`);

  const missionSetup = await page.evaluate(async () => {
    const api = window.__ROBOT_BEACH__;
    const results = [];
    for (const item of api.catalog) {
      api.game.begin(item);
      await new Promise(resolve => setTimeout(resolve, 40));
      results.push({ id: item.stage.id, type: item.stage.type, running: api.game.running, entities: api.game.entities.length });
    }
    api.game.stop();
    return results;
  });
  if (missionSetup.length !== 15 || missionSetup.some(item => !item.running)) throw new Error("One or more campaign missions failed to initialize");

  const resources = await page.evaluate(() => {
    const { world, game, catalog } = window.__ROBOT_BEACH__;
    const cycle = () => {
      for (const item of catalog) {
        game.begin(item);
        for (let i = 0; i < 40; i++) world.pulse(game.player, 3);
        world.update(0.02, game.player);
        game.stop();
        world.update(0.02, null);
      }
      return { ...world.renderer.info.memory, effects: world.effectPool.length, drawCalls: world.renderer.info.render.calls };
    };
    const before = cycle();
    const after = cycle();
    return { before, after };
  });
  if (resources.after.geometries > resources.before.geometries + 1 || resources.after.textures > resources.before.textures + 1 || resources.after.effects > 24) throw new Error(`Restart resource growth: ${JSON.stringify(resources)}`);
  console.log(`Restart resource check: ${JSON.stringify(resources)}`);

  const combatResources = await page.evaluate(() => {
    const { world, game, brawl } = window.__ROBOT_BEACH__;
    const cycle = () => {
      game.begin(brawl);
      const c = game.combat;
      c.collect(c.pickups.find(p => p.type === "bubble"));
      for (let i = 0; i < 12; i++) {
        const enemy = game.spawnEnemy(false, i);
        enemy.x = -4 + i % 5 * 2; enemy.z = 5;
        enemy.object.position.set(enemy.x, 0.55, enemy.z);
        if (i < 8) c.hit(enemy, enemy.health);
      }
      game.player.x = 0; game.player.z = 5;
      c.repair();
      c.freezeCharges = 1; c.freeze();
      c.whistles = 1; c.callAnimals();
      for (let i = 0; i < 12; i++) {
        c.shoot(); game.update(0.05); world.update(0.05, game.player);
      }
      game.stop(); world.update(0.02, null);
      return { ...world.renderer.info.memory, effects: world.effectPool.length };
    };
    const before = cycle(), after = cycle();
    return { before, after };
  });
  if (combatResources.after.geometries > combatResources.before.geometries + 1 || combatResources.after.textures > combatResources.before.textures + 1 || combatResources.after.effects > 24) throw new Error(`Combat resource growth: ${JSON.stringify(combatResources)}`);
  console.log(`Combat resource check: ${JSON.stringify(combatResources)}`);

  await page.evaluate(() => { const api = window.__ROBOT_BEACH__; api.game.stop(); api.ui.showTitle(); });
  await page.getByRole("button", { name: /Beach Brawl · Play now/ }).click();
  await page.getByRole("button", { name: "Enter mission" }).click();
  await page.locator("#combatPanel:not(.hidden)").waitFor();
  await page.evaluate(() => {
    const { game } = window.__ROBOT_BEACH__;
    const crate = game.combat.pickups.find(p => p.type === "bubble");
    game.player.x = crate.x; game.player.z = crate.z;
  });
  await page.waitForFunction(() => window.__ROBOT_BEACH__.game.combat.weapon === "bubble");
  await page.evaluate(() => {
    const { game } = window.__ROBOT_BEACH__;
    const enemy = game.spawnEnemy(false, 1); enemy.x = game.player.x + 4; enemy.z = game.player.z;
  });
  await page.keyboard.down("Space");
  await page.waitForTimeout(400);
  await page.keyboard.up("Space");
  if (await page.evaluate(() => window.__ROBOT_BEACH__.game.combat.ammo) >= 36) throw new Error("Held Fire did not shoot the equipped weapon");
  await page.keyboard.press("Escape");
  await page.waitForFunction(() => window.__ROBOT_BEACH__.game.paused);
  const ammoWhilePaused = await page.evaluate(() => window.__ROBOT_BEACH__.game.combat.ammo);
  await page.keyboard.press("KeyJ");
  if (await page.evaluate(() => window.__ROBOT_BEACH__.game.combat.ammo) !== ammoWhilePaused) throw new Error("Pause allowed a weapon shot");
  if (!await page.evaluate(() => window.__ROBOT_BEACH__.game.paused)) throw new Error("Combat input resumed a paused game");

  const mobile = await browser.newPage({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
  mobile.on("pageerror", error => errors.push(error.message));
  await mobile.goto(URL, { waitUntil: "networkidle" });
  await mobile.getByRole("heading", { name: /Signalbreak/i }).waitFor({ state: "visible", timeout: 20_000 });
  const overflow = await mobile.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1);
  if (overflow) throw new Error("Mobile title has horizontal overflow");
  await mobile.getByRole("button", { name: "Mission map" }).click();
  if (!await mobile.locator(".chapter-card").first().isVisible()) throw new Error("Mobile mission map is not visible");
  await mobile.locator(".stage-dots button").first().click();
  await mobile.getByRole("button", { name: "Enter mission" }).click();
  await mobile.locator("#navigation:not(.hidden)").waitFor();
  if (!await mobile.locator("#hudShield").isVisible() || !await mobile.locator("#touchControls").isVisible()) throw new Error("Mobile shield or touch controls are hidden");
  await mobile.evaluate(() => { const api = window.__ROBOT_BEACH__; api.game.begin(api.brawl); });
  await mobile.locator("#combatPanel:not(.hidden)").waitFor();
  for (const action of ["shoot", "pulse", "dash", "interact", "freeze", "call"]) {
    if (!await mobile.locator(`[data-touch='${action}']`).isVisible()) throw new Error(`Mobile ${action} control missing`);
  }
  await mobile.evaluate(() => {
    const { game } = window.__ROBOT_BEACH__;
    game.combat.collect(game.combat.pickups.find(p => p.type === "bubble"));
    const enemy = game.spawnEnemy(false, 0);
    enemy.x = game.player.x + 4; enemy.z = game.player.z;
  });
  const fire = mobile.locator("[data-touch='shoot']");
  const fireBounds = await fire.boundingBox();
  const touchSession = await mobile.context().newCDPSession(mobile);
  await touchSession.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: fireBounds.x + fireBounds.width / 2, y: fireBounds.y + fireBounds.height / 2 }] });
  await mobile.waitForTimeout(400);
  await touchSession.send("Input.dispatchTouchEvent", { type: "touchCancel", touchPoints: [] });
  await touchSession.detach();
  if (await mobile.evaluate(() => window.__ROBOT_BEACH__.game.combat.ammo) >= 36) throw new Error("Touch Fire did not shoot");
  if (await mobile.evaluate(() => window.__ROBOT_BEACH__.input.held("shoot"))) throw new Error("Cancelled touch left firing stuck on");
  await mobile.close();

  if (errors.length) throw new Error(`Browser errors:\n${errors.join("\n")}`);
  console.log("Smoke test passed: 12 Blender models, 15 campaign stages, Beach Brawl, keyboard/touch fire, pause, mobile layout and restart resource stability.");
} finally {
  if (browser) await browser.close();
  server?.kill("SIGTERM");
}
