import test from "node:test";
import assert from "node:assert/strict";
import {InputController} from "../src/input.js";

function keyboard(run) {
  const originalWindow=globalThis.window,originalDocument=globalThis.document,listeners=new Map();
  globalThis.window={addEventListener:(type,listener)=>listeners.set(type,listener)};
  globalThis.document={querySelector:()=>null,querySelectorAll:()=>[]};
  try {
    const input=new InputController();input.enabled=true;
    const send=(code,options={})=>{
      const event={code,repeat:false,target:{closest:()=>null},preventDefault(){this.prevented=true;},...options};
      listeners.get("keydown")(event);return event;
    };
    run({input,send,up:code=>listeners.get("keyup")({code}),blur:()=>listeners.get("blur")()});
  } finally {
    if(originalWindow===undefined) delete globalThis.window;else globalThis.window=originalWindow;
    if(originalDocument===undefined) delete globalThis.document;else globalThis.document=originalDocument;
  }
}

test("Space is one dash, never Use or held fire, and auto-repeat cannot retrigger it",()=>keyboard(({input,send,up})=>{
  assert.equal(send("Space").prevented,true);
  assert.equal(input.consume("dash"),true);assert.equal(input.consume("interact"),false);assert.equal(input.held("shoot"),false);
  send("Space",{repeat:true});assert.equal(input.consume("dash"),false);
  up("Space");send("Space");assert.equal(input.consume("dash"),true);
}));

test("Use, Pulse, gadgets, pause and both Shift aliases stay distinct",()=>keyboard(({input,send,up})=>{
  for(const [code,action] of Object.entries({KeyE:"interact",Enter:"interact",KeyQ:"pulse",KeyF:"freeze",KeyR:"call",Escape:"pause",ShiftLeft:"dash",ShiftRight:"dash"})){
    send(code);assert.deepEqual([...input.actions],[action]);assert.equal(input.held("shoot"),false);input.consume(action);up(code);
  }
}));

test("J and mouse fire independently of Space, and blur clears held input",()=>keyboard(({input,send,up,blur})=>{
  send("KeyJ");assert.equal(input.held("shoot"),true);assert.equal(input.actions.size,0);
  send("Space");assert.equal(input.consume("dash"),true);up("Space");assert.equal(input.held("shoot"),true);
  up("KeyJ");assert.equal(input.held("shoot"),false);
  input.firePointers.add(7);assert.equal(input.held("shoot"),true);
  send("KeyW");blur();assert.equal(input.held("shoot"),false);assert.deepEqual(input.movement(),{x:0,y:0});
}));

test("visible UI buttons own Space and Enter while hidden launch buttons do not",()=>keyboard(({input,send})=>{
  const visible={closest:()=>({getClientRects:()=>[{}],matches:()=>false})};
  for(const code of ["Space","Enter"]){
    assert.equal(send(code,{target:visible}).prevented,undefined);assert.equal(input.actions.size,0);assert.equal(input.keys.size,0);
  }
  send("Space",{target:{closest:()=>({getClientRects:()=>[],matches:()=>false})}});
  assert.equal(input.consume("dash"),true);
}));

test("text fields, browser shortcuts and disabled gameplay never trigger actions",()=>keyboard(({input,send})=>{
  const field={closest:()=>({getClientRects:()=>[{}],matches:()=>true})};
  for(const code of ["Space","KeyE","KeyW","KeyJ"]) send(code,{target:field});
  for(const flag of ["ctrlKey","metaKey","altKey"]) send("Space",{[flag]:true});
  assert.equal(input.actions.size,0);assert.equal(input.keys.size,0);
  input.enabled=false;send("Space");send("KeyE");send("KeyJ");
  assert.equal(input.actions.size,0);assert.equal(input.held("shoot"),false);
}));

test("arrow and WASD movement remain normalized and do not produce action events",()=>keyboard(({input,send})=>{
  send("KeyW");send("ArrowRight");
  const movement=input.movement();assert.ok(movement.x>0 && movement.y<0);assert.ok(Math.abs(Math.hypot(movement.x,movement.y)-1)<1e-10);
  assert.equal(input.actions.size,0);
}));
