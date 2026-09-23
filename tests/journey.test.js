import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {createHash} from "node:crypto";
import {ALL_STAGES} from "../src/missions.js";
import {ENVIRONMENTS,JOURNEY_MODEL_NAMES} from "../src/journey-data.js";
import {createProgress,recordResult,isUnlocked} from "../src/rules.js";
import {World} from "../src/world.js";

test("fifteen destinations have unique environments, stories, discoveries and no compound objectives",()=>{
  const stages=ALL_STAGES.map(i=>i.stage);
  for(const key of ["scene","story","outcome","discovery","location"]) assert.equal(new Set(stages.map(s=>s[key])).size,15,key);
  assert.deepEqual(stages.map(s=>ENVIRONMENTS[s.scene].kind),["city","country","coast","underwater","underwater","underwater","surface","surface","sky","sky","space","moon","moon","moon","city"]);
  for(const stage of stages) {
    assert.ok(stage.activity && stage.beats.length===2);
    assert.equal(stage.finalBeacon,undefined);
    if(["collect","combat","race-collect"].includes(stage.type)) assert.equal(stage.goal,undefined);
    if(stage.type==="defense") assert.equal(stage.prebuilt,true);
    if(stage.type==="escort") assert.equal(stage.route.length,stage.count);
    if(stage.type==="scan") assert.equal(stage.specimens.length,stage.count);
  }
});

test("revision migration archives old medals and preserves inventory, then remains idempotent",()=>{
  const old=createProgress(); old.version=1;delete old.campaignRevision;
  old.completed=["signal:wake","signal:trail"];old.results={"signal:wake":{medals:3,bestTimeLeft:75}};
  old.equipment.paint="sunset";old.brawlBest=501;old.expeditionResults={coral:600};
  const next=createProgress(old);
  assert.deepEqual(next.completed,[]);assert.deepEqual(next.results,{});
  assert.deepEqual(next.previousCampaign.completed,old.completed);assert.deepEqual(next.previousCampaign.results,old.results);
  assert.deepEqual(next.equipment,old.equipment);assert.equal(next.brawlBest,501);assert.deepEqual(next.expeditionResults,old.expeditionResults);
  assert.equal(next.checkpoint,null);assert.equal(isUnlocked(next,0,1),false);
  const saved=recordResult(next,ALL_STAGES[0].chapter,ALL_STAGES[0].stage,80,true);
  assert.deepEqual(createProgress(JSON.parse(JSON.stringify(saved))),saved);
  assert.equal(saved.completed.length,1);assert.deepEqual(saved.previousCampaign,next.previousCampaign);
});

test("Blender environments are real, compressed, content-versioned assets within a six-megabyte budget",()=>{
  const manifest=JSON.parse(readFileSync(new URL("../public/models/journey-manifest.json",import.meta.url)));
  assert.deepEqual(manifest.assets.map(a=>a.name),JOURNEY_MODEL_NAMES);
  let total=0;
  for(const asset of manifest.assets) {
    const bytes=readFileSync(new URL("../public/models/"+asset.file,import.meta.url));total+=bytes.length;
    assert.equal(bytes.toString("ascii",0,4),"glTF");assert.equal(bytes.length,asset.bytes);
    assert.equal(createHash("sha256").update(bytes).digest("hex").slice(0,16),asset.sha256);
    // One mesh per material batch keeps each destination to about twenty draw calls.
    assert.ok(asset.triangles<=80000 && asset.meshes<=20 && asset.bytes<1000000,asset.name);
    assert.ok(bytes.toString("utf8",20,20+bytes.readUInt32LE(12)).includes("KHR_draco_mesh_compression"),`${asset.name} is Draco-compressed`);
  }
  assert.ok(total<6000000);
});

test("environment collision never covers a spawn point, objective or exhibit",()=>{
  const manifest=JSON.parse(readFileSync(new URL("../public/models/journey-manifest.json",import.meta.url)));
  const colliders=Object.fromEntries(manifest.assets.map(asset=>[asset.name,asset.colliders]));
  const playerRadius=.9;
  for(const {stage} of ALL_STAGES) {
    const solid=colliders["journey_"+stage.scene];
    assert.ok(Array.isArray(solid),`${stage.scene} exports collision footprints`);
    const points=[{x:0,z:13},...(stage.positions||[]),...(stage.shelters||[]),...(stage.gatePositions||[]),...(stage.route||[]),...(stage.exhibits||[]),stage.goal,stage.source,stage.receiver].filter(Boolean);
    for(const point of points) for(const [x,z,radius] of solid) {
      assert.ok(Math.hypot(point.x-x,point.z-z)>=radius+playerRadius,`${stage.id}: (${point.x}, ${point.z}) is blocked by a collider at (${x}, ${z})`);
    }
    for(const [x,z,radius] of solid) assert.ok(Number.isFinite(x)&&Number.isFinite(z)&&radius>0&&radius<12);
  }
});

test("every journey asset has a safe fallback, including geology props",()=>{
  for(const name of JOURNEY_MODEL_NAMES) {
    const actor=World.prototype.fallback.call({},name);
    assert.ok(actor.children.length,name);
    actor.traverse(child=>{child.geometry?.dispose();child.material?.dispose();});
  }
});
