import { ENVIRONMENTS } from "./journey-data.js";
import { PLAY_RADIUS } from "./presentation.js";

// The radar shows the whole play space plus a small margin; its disc edge is the play boundary.
const SPAN = (PLAY_RADIUS + 2.5) * 2;
export function mapPoint(point, yaw, size = 160) {
  const scale = size / SPAN;
  return { x: size / 2 + (point.x * Math.cos(yaw) - point.z * Math.sin(yaw)) * scale,
    y: size / 2 + (point.x * Math.sin(yaw) + point.z * Math.cos(yaw)) * scale };
}

export function mapMarkers(game, target) {
  const markers = [];
  for (const p of game.world.mapLandmarks || []) markers.push({ ...p, type: "landmark" });
  for (const e of game.entities) {
    if (!e.active || e.carried) continue;
    if (["enemy", "boss"].includes(e.kind)) markers.push({ ...e, type: "enemy" });
    else if (["ally", "creature", "escort"].includes(e.kind)) markers.push({ ...e, type: "friend" });
    else if (["cell", "node", "relay-node", "specimen"].includes(e.kind)) markers.push({ ...e, type: "loot" });
  }
  for (const p of game.combat?.pickups || []) if (p.active) markers.push({ ...p, type: "loot" });
  for (const shelter of game.shelters || []) markers.push({ ...shelter, type: "friend" });
  for (const p of game.expedition?.discoveries || []) if (p.active) markers.push({ ...p, type: "loot" });
  for (const p of game.discovery?.exhibits || []) if (p.active) markers.push({ ...p, type: "loot" });
  for (const p of game.expedition?.friends || []) if (p.active && !p.carried) markers.push({ ...p, type: "friend" });
  if (game.expedition) {
    for (const p of [game.expedition.snail, game.expedition.clam, game.expedition.helper, game.expedition.sanctuary].filter(Boolean)) markers.push({ ...p, type: "friend" });
  }
  if (target) markers.push({ ...target, type: "target" });
  markers.push({ ...game.player, type: "player" });
  return markers;
}

export class Minimap {
  constructor(canvas) { this.canvas = canvas; this.ctx = canvas.getContext("2d"); }
  draw(game, target) {
    const ctx = this.ctx, size = this.canvas.width, yaw = game.world.cameraYaw || 0;
    ctx.clearRect(0, 0, size, size);
    ctx.fillStyle = "#123f5a"; ctx.fillRect(0, 0, size, size);
    ctx.beginPath(); ctx.arc(size / 2, size / 2, size * PLAY_RADIUS / SPAN, 0, Math.PI * 2);
    ctx.fillStyle = game.stage.theme === "moonpool" ? "#344a6d" : game.stage.theme === "scrapyard" ? "#535073" : "#758876";
    if (game.stage.scene) ctx.fillStyle = `#${ENVIRONMENTS[game.stage.scene].ground.toString(16).padStart(6,"0")}`;
    ctx.fill(); ctx.strokeStyle = "#bff4ff"; ctx.lineWidth = 2; ctx.setLineDash([5, 3]); ctx.stroke(); ctx.setLineDash([]);
    ctx.save(); ctx.clip();
    const colors = { enemy: "#ff735f", friend: "#6dffb5", loot: "#fbc563", target: "#fff1a4", landmark: "#bdcbde", player: "#ffffff" };
    for (const marker of mapMarkers(game, target)) {
      const p = mapPoint(marker, yaw, size);
      ctx.fillStyle = colors[marker.type];
      ctx.beginPath();
      if (marker.type === "player") {
        ctx.save(); ctx.translate(p.x, p.y);
        ctx.rotate(yaw - game.player.object.rotation.y);
        ctx.moveTo(0, 7); ctx.lineTo(-5, -5); ctx.lineTo(0, -2); ctx.lineTo(5, -5); ctx.closePath();
        ctx.fill(); ctx.strokeStyle = "#062b47"; ctx.lineWidth = 1.5; ctx.stroke(); ctx.restore();
      } else if (["loot", "friend", "target"].includes(marker.type)) {
        const r = marker.type === "target" ? 6 : 3;
        if (marker.type === "target") for (let i = 0; i < 10; i++) {
          const a = i * Math.PI / 5 - Math.PI / 2, radius = i % 2 ? r * 0.45 : r;
          const x = p.x + Math.cos(a) * radius, y = p.y + Math.sin(a) * radius;
          if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y);
        } else { ctx.moveTo(p.x, p.y - r); ctx.lineTo(p.x + r, p.y); ctx.lineTo(p.x, p.y + r); ctx.lineTo(p.x - r, p.y); }
        ctx.closePath(); ctx.fill();
      } else { ctx.arc(p.x, p.y, marker.type === "enemy" ? 2.8 : 2, 0, Math.PI * 2); ctx.fill(); }
    }
    ctx.restore();
    const north = mapPoint({ x: 0, z: -(PLAY_RADIUS + 1) }, yaw, size);
    ctx.font = "bold 9px Segoe UI"; ctx.fillStyle = "#ddfbff"; ctx.fillText("N", north.x - 3, north.y);
    this.canvas.setAttribute("aria-label", `Survey radar. KAI at ${Math.round(game.player.x)}, ${Math.round(game.player.z)}. ${target?.label || "Explore freely"}. White arrow: you; red circles: enemies; green diamonds: friends; gold diamonds: loot; star: objective.`);
  }
}
