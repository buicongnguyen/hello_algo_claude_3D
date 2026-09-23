const distance = (a,b) => Math.hypot(a.x-b.x,a.z-b.z);

// One activity owns its setup, input, progress and completion. No follow-up switch is added.
export class DiscoveryActivity {
  constructor(game) {
    this.game = game;
    const {stage,world} = game;
    if (stage.type === "scan") {
      this.targets = stage.positions.map((p,index) => {
        const target = game.makeEntity("specimen", stage.specimens[index], p, 1, {id:index, label:stage.labels[index]});
        target.marker = world.createMarker(p,0xffd166,1.2);
        world.label?.(target.object,target.label,0xffd166,2.8);
        game.entities.push(target); return target;
      });
    } else if(stage.type === "escort") {
      this.buoy = game.makeEntity("escort", "beacon", {x:-2,z:12},.9);
      this.index = 0; this.waiting = false;
      world.label?.(this.buoy.object,"RESEARCH BUOY",0x65e5ff,2.8);
      world.createRoute([this.buoy,...stage.route],0x65e5ff);
      game.entities.push(this.buoy);
      if(stage.hazards) game.createHazards(3);
    } else {
      this.terminal = game.makeEntity("exhibit", "beacon", stage.goal,1.1);
      this.terminal.marker = world.createMarker(stage.goal,0xffd166,1.8);
      world.label?.(this.terminal.object,"SHARE THE ATLAS",0xffd166,2.8);
      // An optional victory lap: each exhibit recalls part of the journey but never gates the ending.
      this.exhibits = (stage.exhibits || []).map((p, index) => {
        const exhibit = { ...p, label: stage.exhibitLabels?.[index] || `Exhibit ${index + 1}`, active: true };
        exhibit.marker = world.createMarker(p, 0xbf8cff, 1.0);
        world.label?.(exhibit.marker, exhibit.label, 0xe0ccff, 2.2);
        return exhibit;
      });
    }
  }
  scanTarget() { return this.targets?.find(target=>target.active && distance(target,this.game.player)<=2.5); }
  interact() {
    const g=this.game;
    if(!g.running) return true;
    if(g.stage.type === "scan") {
      const target=this.scanTarget();
      if(!target) { g.ui.message("Move beside an unscanned gold marker",true); return true; }
      target.active=false; target.marker.visible=false; g.progressCount++;
      g.world.pulse(target,1.4,0x65e5ff); g.sfx?.("scan");
      g.world.particles?.emit(target.x, 1.4, target.z, { count: 18, color: 0x65e5ff, speed: 2.5, up: 2, life: .8, size: .22, gravity: 0 });
      g.ui.message(`Recorded: ${target.label}`);
      if(g.progressCount===g.stage.count) g.finish(true,g.stage.outcome);
    } else if(g.stage.type === "homecoming") {
      if(distance(g.player,this.terminal)>2.5) g.ui.message("Bring the atlas to the gold museum terminal",true);
      else { g.progressCount=1; g.finish(true,g.stage.outcome); }
    } else g.ui.message("Stay near the research buoy; no interaction button is needed.");
    return true;
  }
  update(dt) {
    const g=this.game;
    if(!g.running) return;
    for (const exhibit of this.exhibits || []) if (exhibit.active && distance(exhibit, g.player) < 2.4) {
      exhibit.active = false; exhibit.marker.visible = false;
      g.metrics.exhibits = (g.metrics.exhibits || 0) + 1;
      g.world.pulse(exhibit, 1.6, 0xbf8cff); g.sfx?.("scan");
      g.ui.message(`Exhibit · ${exhibit.label} · ${g.metrics.exhibits}/${this.exhibits.length}`);
    }
    if(!this.buoy || this.index>=g.stage.route.length) return;
    this.waiting=distance(g.player,this.buoy)>6;
    if(this.waiting) return;
    const target=g.stage.route[this.index], d=distance(this.buoy,target);
    if(d>.01) {
      const step=Math.min(d,dt*2.2);
      this.buoy.x+=(target.x-this.buoy.x)/d*step; this.buoy.z+=(target.z-this.buoy.z)/d*step;
      this.buoy.object.rotation.y=Math.atan2(target.x-this.buoy.x,target.z-this.buoy.z);
    }
    this.buoy.object.position.set(this.buoy.x,.6+Math.sin(g.elapsed*2)*.08,this.buoy.z);
    if(distance(this.buoy,target)<.15 && distance(this.buoy,g.player)<=6) {
      this.index++; g.progressCount=this.index;
      if(this.index===g.stage.route.length) g.finish(true,g.stage.outcome);
      else g.ui.message(`Buoy waypoint ${this.index}/${g.stage.count}`);
    }
  }
  prompt() {
    if(this.game.stage.type === "scan") return this.scanTarget() ? "E · SCAN DISCOVERY" : "";
    if(this.terminal) return distance(this.game.player,this.terminal)<=2.5 ? "E · SHARE THE ATLAS" : "";
    return this.waiting ? "BUOY WAITING · RETURN WITHIN 6 M" : "";
  }
  objective() {
    if(this.targets) {
      const next=[...this.targets].filter(t=>t.active).sort((a,b)=>distance(a,this.game.player)-distance(b,this.game.player))[0];
      return next ? {...next,label:`${next.label} · Use to scan`} : null;
    }
    if(this.buoy) return {...this.buoy,label:this.waiting?"Buoy waiting · come closer":"Escort buoy · stay within 6 m"};
    return {...this.terminal,label:"Museum terminal · Use to share atlas"};
  }
}
