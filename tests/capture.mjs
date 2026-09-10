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
  await page.getByRole("heading", { name: /Signalbreak/i }).waitFor({ state: "visible", timeout: 20_000 });
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
  console.log(`Visual captures written to ${OUT}`);
} finally {
  if (browser) await browser.close();
  server.kill("SIGTERM");
}
