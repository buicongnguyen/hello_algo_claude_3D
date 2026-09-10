import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { chromium } from "playwright-core";

const ROOT = process.cwd();
const PORT = 49431;
const paths = [
  join(process.env["ProgramFiles(x86)"] || "", "Microsoft", "Edge", "Application", "msedge.exe"),
  join(process.env.ProgramFiles || "", "Microsoft", "Edge", "Application", "msedge.exe"),
  join(process.env.ProgramFiles || "", "Google", "Chrome", "Application", "chrome.exe"),
];
const executablePath = paths.find(path => path && existsSync(path));
if (!executablePath) throw new Error("Edge or Chrome is required for the smoke test");

const server = spawn(process.execPath, ["node_modules/vite/bin/vite.js", "--host", "127.0.0.1", "--port", String(PORT)], { cwd: ROOT, stdio: ["ignore", "pipe", "inherit"] });
await new Promise((resolve, reject) => {
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
  await page.goto(`http://127.0.0.1:${PORT}/`, { waitUntil: "networkidle" });
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

  const mobile = await browser.newPage({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
  await mobile.goto(`http://127.0.0.1:${PORT}/`, { waitUntil: "networkidle" });
  await mobile.getByRole("heading", { name: /Signalbreak/i }).waitFor({ state: "visible", timeout: 20_000 });
  const overflow = await mobile.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1);
  if (overflow) throw new Error("Mobile title has horizontal overflow");
  await mobile.getByRole("button", { name: "Mission map" }).click();
  if (!await mobile.locator(".chapter-card").first().isVisible()) throw new Error("Mobile mission map is not visible");
  await mobile.close();

  if (errors.length) throw new Error(`Browser errors:\n${errors.join("\n")}`);
  console.log("Smoke test passed: 3D boot, campaign map, mission launch, movement, pulse, pause and mobile layout.");
} finally {
  if (browser) await browser.close();
  server.kill("SIGTERM");
}
