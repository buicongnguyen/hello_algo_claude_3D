export function fieldChallenge(stage) {
  if (stage.type === "roam") return null;
  if (stage.type === "expedition") return stage.mode === "salvage"
    ? { id: "freeze", text: "Freeze 3 different enemies", goal: 3 }
    : { id: "crew", text: "Call the animal crew", goal: 1 };
  if (["combat", "brawl"].includes(stage.type)) return { id: "repair", text: "Recruit a robot teammate", goal: 1 };
  if (stage.type === "sequence") return { id: "sequence", text: "No wrong signal activations" };
  if (stage.type === "finale") return { id: "core", text: "Keep all 5 core-integrity points" };
  if (["collect", "race-collect", "race"].includes(stage.type)) return { id: "speed", text: "Finish with half the clock left" };
  return { id: "clean", text: "Take no shield damage" };
}

export function challengeStatus(game) {
  const challenge = fieldChallenge(game.stage);
  if (!challenge) return null;
  const metrics = game.metrics || {};
  const count = challenge.id === "freeze" ? metrics.frozenEnemies || 0 : challenge.id === "crew" ? metrics.calls || 0 : metrics.recruited || 0;
  const done = challenge.goal ? count >= challenge.goal
    : challenge.id === "sequence" ? game.wrongActions === 0
    : challenge.id === "core" ? game.core?.health === 5
    : challenge.id === "speed" ? game.time >= game.stage.time / 2
    : (metrics.damageTaken || 0) === 0;
  return { ...challenge, done, count, label: challenge.goal ? `${Math.min(count, challenge.goal)}/${challenge.goal} · ${challenge.text}` : challenge.text };
}

export function runSummary(game) {
  const details = [`${Math.round(game.elapsed)}s played`, `${game.shields} shield left`];
  if (game.combat?.kills) details.push(`${game.combat.kills} bots rebooted`);
  const rescued = game.expedition?.rescued || (game.stage.type === "rescue" ? game.progressCount : 0);
  if (rescued) details.push(`${rescued} friends rescued`);
  if (game.metrics?.recruited) details.push(`${game.metrics.recruited} new teammates`);
  return details.join(" · ");
}
