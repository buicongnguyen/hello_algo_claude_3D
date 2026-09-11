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
  assert.equal(await page.evaluate(()=>window.__ROBOT_BEACH__.world.models.size),42);
  await page.locator("#continueButton").click();
  assert.equal(await page.locator("#campaignModeSelect").inputValue(),"story");
  assert.match(await page.locator("#briefLocation").textContent(),/Meridian City/);
  assert.equal(await page.locator("#briefBeats li").count(),2);
  await page.screenshot({path:join(OUT,"01-briefing-desktop.png")});
  await page.locator("#campaignModeSelect").selectOption("challenge");
  assert.match(await page.locator("#briefPace").textContent(),/Timed mission: 85 seconds/);
  await page.locator("#campaignModeSelect").selectOption("story");
  await page.setViewportSize({width:390,height:844});
  const launch=await page.locator("#launchButton").boundingBox();
  assert.ok(launch.y>=0 && launch.y+launch.height<=844);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
  await page.screenshot({path:join(OUT,"02-briefing-portrait.png")});
  await page.locator("#launchButton").click();
  assert.equal(await page.locator("#speakerName").textContent(),"LUMA");
  await page.locator("#nextDialogue").click();
  assert.equal(await page.locator("#speakerName").textContent(),"BOLT");
  await page.locator("#nextDialogue").click();
  await page.setViewportSize({width:1440,height:900});
  const ids=await page.evaluate(()=>window.__ROBOT_BEACH__.catalog.map(i=>i.stage.id)), reports=[];
  for(const id of ids) {
    const report=await page.evaluate(id=>{
      const {game,world,ui,catalog}=window.__ROBOT_BEACH__,item=catalog.find(i=>i.stage.id===id);
      game.begin(item);game.paused=true;ui.hideDialogue();game.updateHUD(.1);
      world.update(.05,game.player,true);
      return {id,scene:world.journeyRoot?.name,shared:world.shared.visible,sky:world.scene.background.getHex(),calls:world.renderer.info.render.calls,triangles:world.renderer.info.render.triangles,failed:world.failedModels};
    },id);
    reports.push(report);
    await page.screenshot({path:join(OUT,"scene-"+id+".png")});
  }
  assert.equal(new Set(reports.map(r=>r.scene)).size,15);
  assert.equal(new Set(reports.map(r=>r.sky)).size,15);
  assert.ok(reports.every(r=>r.scene && !r.shared && r.calls<=450 && r.triangles<=400000 && !r.failed.length));
  console.log("Journey rendering:",JSON.stringify(reports));
  const relay=await page.evaluate(()=>{
    const {game,catalog,ui}=window.__ROBOT_BEACH__;
    game.begin(catalog[1]);game.paused=true;ui.hideDialogue();
    for(const node of [...game.relayNodes].reverse()) {
      const next=game.relayNodes[node.id+1] || game.stage.receiver;
      const dx=next.x-node.x,dz=next.z-node.z,desired=dx>0?1:dx<0?3:dz>0?2:0;
      game.player.x=node.x;game.player.z=node.z;
      for(let i=0;node.turn!==desired && i<4;i++) game.interact();
    }
    return {complete:game.relayState.complete,saved:game.progress.completed.includes("signal:trail"),outcome:document.querySelector("#departureStory").textContent};
  });
  assert.ok(relay.complete && relay.saved);assert.match(relay.outcome,/coastal survey/);
  assert.match(await page.locator("#nextDestination").textContent(),/Amber Strand/);
  await page.screenshot({path:join(OUT,"04-discovery-departure.png")});
  await page.evaluate(()=>{const {game,ui}=window.__ROBOT_BEACH__;game.completeVictory();game.stop();ui.showTitle();ui.showJournal();});
  assert.match(await page.locator("#modalText").textContent(),/coastal frequency/);
  assert.doesNotMatch(await page.locator("#modalText").textContent(),/KAI brought home more/);
  const newActions=await page.evaluate(()=>{
    const {game,catalog,ui}=window.__ROBOT_BEACH__,results=[];
    for(const id of ["split-current","storm","approaches","signalbreak"]) {
      game.begin(catalog.find(i=>i.stage.id===id));game.paused=true;ui.hideDialogue();
      const move=t=>{game.player.x=t.x;game.player.z=t.z;};
      if(game.discovery.targets) for(const target of game.discovery.targets){move(target);game.interact();}
      else if(game.discovery.buoy) for(let t=0;t<600 && game.running;t++){move(game.discovery.buoy);game.discovery.update(.1);}
      else {move(game.discovery.terminal);game.interact();}
      results.push({id,won:!game.running,saved:game.progress.completed.some(key=>key.endsWith(":"+id))});
      if(id!=="signalbreak") game.completeVictory();
    }
    return results;
  });
  assert.ok(newActions.every(r=>r.won && r.saved));
  await page.setViewportSize({width:390,height:844});
  await page.screenshot({path:join(OUT,"05-homecoming-portrait.png")});
  await page.reload({waitUntil:"networkidle"});
  await page.locator("#gameTitle").waitFor({state:"visible"});
  assert.ok(await page.evaluate(()=>window.__ROBOT_BEACH__.game.progress.completed.includes("siege:signalbreak")));
  // A second context exercises actual localStorage migration, not just the pure normalizer.
  const legacy=await browser.newPage({viewport:{width:390,height:844}});
  await legacy.addInitScript(()=>{
    if(!localStorage.getItem("migration-seeded")) {
      localStorage.setItem("migration-seeded","yes");
      localStorage.setItem("robot-beach-3d-signalbreak-v1",JSON.stringify({version:1,completed:["signal:wake"],results:{"signal:wake":{medals:3,bestTimeLeft:80}},brawlBest:99}));
    }
  });
  await legacy.goto(URL,{waitUntil:"networkidle"});await legacy.locator("#migrationNote").waitFor({state:"visible"});
  assert.equal(await legacy.locator("#campaignCount").textContent(),"0 / 15");
  const migration=await legacy.evaluate(()=>window.__ROBOT_BEACH__.game.progress);
  assert.equal(migration.previousCampaign.results["signal:wake"].medals,3);assert.equal(migration.brawlBest,99);
  await legacy.locator("#missionsButton").click();
  assert.equal(await legacy.locator(".stage-dots button:not(:disabled)").count(),1);
  assert.equal(await legacy.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
  const alignment=await legacy.locator(".stage-dots button").first().evaluate(button=>{
    const title=button.querySelector("strong").getBoundingClientRect(),location=button.querySelector("em").getBoundingClientRect();
    return Math.abs(title.x-location.x)<1 && location.y>=title.bottom;
  });
  assert.equal(alignment,true,"phone itinerary location belongs below its title, not beside it");
  await legacy.screenshot({path:join(OUT,"06-itinerary-portrait.png")});
  await legacy.close();
  assert.deepEqual(errors,[]);
  console.log("Journey browser checks passed: 15 unique Blender environments, mobile UI, scanning, escort, homecoming, relay, destination endings, discovery journal and legacy-save migration.");
} finally {
  if(browser) await browser.close();
  server?.kill("SIGTERM");
}
