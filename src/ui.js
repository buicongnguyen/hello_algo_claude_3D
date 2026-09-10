import { CHAPTERS, TOTAL_STAGES } from "./missions.js";
import { earnedUpgrades, isUnlocked, stageKey } from "./rules.js";

export class UI {
  constructor(progress, callbacks) {
    this.progress = progress;
    this.callbacks = callbacks;
    this.screens = ["loading", "titleScreen", "mapScreen", "briefing"];
    this.hud = document.querySelector("#hud");
    this.touch = document.querySelector("#touchControls");
    this.cache = {};
    this.messageTimer = 0;
    this.pulseMeter = document.querySelector("#pulseMeter");
    this.dashMeter = document.querySelector("#dashMeter");
    this.touchMeters = { pulse: document.querySelector('[data-touch="pulse"]'), dash: document.querySelector('[data-touch="dash"]') };
    this.bind();
  }

  bind() {
    document.querySelector("#continueButton").addEventListener("click", () => this.callbacks.continue());
    document.querySelector("#missionsButton").addEventListener("click", () => this.showMap());
    document.querySelector("#roamButton").addEventListener("click", () => this.callbacks.roam());
    document.querySelectorAll("[data-screen='title']").forEach(button => button.addEventListener("click", () => this.showTitle()));
    document.querySelectorAll("[data-screen='map']").forEach(button => button.addEventListener("click", () => this.showMap()));
    document.querySelector("#launchButton").addEventListener("click", () => this.callbacks.launch(this.selected));
    document.querySelector("#pauseButton").addEventListener("click", () => this.callbacks.pause());
    document.querySelector("#howButton").addEventListener("click", () => document.querySelector("#helpPanel").classList.remove("hidden"));
    document.querySelector("#closeHelp").addEventListener("click", () => document.querySelector("#helpPanel").classList.add("hidden"));
    document.querySelector("#resetButton").addEventListener("click", () => this.callbacks.reset());
    document.querySelector("#quality").value = this.progress.settings.quality;
    document.querySelector("#quality").addEventListener("change", event => this.callbacks.settings({ quality: event.target.value }));
    document.querySelector("#reducedMotion").checked = this.progress.settings.reducedMotion;
    document.querySelector("#reducedMotion").addEventListener("change", event => this.callbacks.settings({ reducedMotion: event.target.checked }));
    document.querySelector("#soundEnabled").checked = this.progress.settings.sound !== false;
    document.querySelector("#soundEnabled").addEventListener("change", event => this.callbacks.settings({ sound: event.target.checked }));
    document.querySelector("#skipDialogue").addEventListener("click", () => this.hideDialogue());
  }

  setProgress(progress) {
    this.progress = progress;
    this.updateCampaign();
  }

  loading(amount, label) {
    document.querySelector("#loadBar").style.width = `${Math.round(amount * 100)}%`;
    document.querySelector("#loadStatus").textContent = amount >= 1 ? "Island ready" : `Loading ${label.replaceAll("_", " ")}…`;
  }

  showOnly(id) {
    this.hideDialogue();
    this.screens.forEach(screen => document.querySelector(`#${screen}`).classList.toggle("hidden", screen !== id));
    this.hud.classList.add("hidden");
    this.touch.classList.add("hidden");
    document.querySelector("#modal").classList.add("hidden");
  }

  showTitle() {
    this.showOnly("titleScreen");
    this.updateCampaign();
  }

  updateCampaign() {
    const complete = this.progress.completed.length;
    document.querySelector("#campaignCount").textContent = `${complete} / ${TOTAL_STAGES}`;
    document.querySelector("#campaignBar").style.width = `${(complete / TOTAL_STAGES) * 100}%`;
    document.querySelector("#continueButton").textContent = complete ? "Continue journey" : "Begin journey";
    document.querySelector("#roamButton").classList.toggle("hidden", !earnedUpgrades(this.progress).freeRoam);
  }

  showMap() {
    this.showOnly("mapScreen");
    const rail = document.querySelector("#chapterRail");
    rail.replaceChildren(...CHAPTERS.map((chapter, chapterIndex) => {
      const card = document.createElement("article");
      card.className = "chapter-card glass";
      card.style.setProperty("--chapter-color", chapter.color);
      const complete = chapter.stages.filter(stage => this.progress.completed.includes(stageKey(chapter.id, stage.id))).length;
      card.innerHTML = `<div class="chapter-number">${chapter.number}</div><div class="chapter-copy"><span>${chapter.icon}</span><p class="eyebrow">Chapter ${chapter.number} · ${complete}/3</p><h3>${chapter.name}</h3><p>${chapter.summary}</p><small>Reward · ${chapter.reward}</small></div><div class="stage-dots"></div>`;
      const dots = card.querySelector(".stage-dots");
      chapter.stages.forEach((stage, stageIndex) => {
        const button = document.createElement("button");
        const unlocked = isUnlocked(this.progress, chapterIndex, stageIndex);
        const result = this.progress.results[stageKey(chapter.id, stage.id)];
        button.disabled = !unlocked;
        button.className = result ? "complete" : "";
        button.innerHTML = `<span>${unlocked ? stageIndex + 1 : "🔒"}</span><strong>${stage.name}</strong><small>${result ? `${"◆".repeat(result.medals)}${"◇".repeat(3 - result.medals)}` : unlocked ? stage.objective : "Complete the previous mission"}</small>`;
        button.addEventListener("click", () => this.showBriefing({ chapter, stage, chapterIndex, stageIndex }));
        dots.append(button);
      });
      return card;
    }));
  }

  showBriefing(item) {
    this.selected = item;
    this.showOnly("briefing");
    document.querySelector("#briefIcon").textContent = item.chapter.icon;
    document.querySelector("#briefChapter").textContent = `Chapter ${item.chapter.number} · Mission ${item.stageIndex + 1}`;
    document.querySelector("#briefTitle").textContent = item.stage.name;
    document.querySelector("#briefStory").textContent = item.stage.story;
    document.querySelector("#briefObjective").textContent = item.stage.objective;
    document.querySelector("#briefReward").textContent = item.stageIndex === 2 ? `Chapter reward · ${item.chapter.reward}` : `Next · ${item.chapter.stages[item.stageIndex + 1]?.name || item.chapter.reward}`;
  }

  showGame(item) {
    this.screens.forEach(screen => document.querySelector(`#${screen}`).classList.add("hidden"));
    this.hud.classList.remove("hidden");
    this.touch.classList.toggle("hidden", !matchMedia("(pointer: coarse)").matches);
    this.write("hudChapter", `Chapter ${item.chapter.number} · Mission ${item.stageIndex + 1}`);
    this.write("hudTitle", item.stage.name);
    this.write("hudObjective", item.stage.objective);
  }

  updateHUD(state) {
    this.write("hudTime", state.untimed ? "—" : Math.max(0, Math.ceil(state.time)));
    this.write("hudProgress", state.progressText);
    this.write("hudProgressIcon", state.progressIcon || "⚡");
    this.write("hudShield", `${"◆".repeat(state.shields)}${"◇".repeat(Math.max(0, state.maxShields - state.shields))}`);
    for (const [id, element, value] of [["pulse", this.pulseMeter, state.pulseReady], ["dash", this.dashMeter, state.dashReady]]) {
      const rounded = Math.round(value * 100);
      if (this.cache[id] !== rounded) { element.style.setProperty("--ready", `${rounded}%`); this.touchMeters[id].style.setProperty("--ready", `${rounded}%`); this.cache[id] = rounded; }
    }
  }

  navigation(target, player, yaw) {
    const nav = document.querySelector("#navigation");
    nav.classList.toggle("hidden", !target);
    if (!target) return;
    const dx = target.x - player.x;
    const dz = target.z - player.z;
    const right = dx * Math.cos(yaw) - dz * Math.sin(yaw);
    const forward = -dx * Math.sin(yaw) - dz * Math.cos(yaw);
    const angle = Math.round(Math.atan2(right, forward) * 180 / Math.PI);
    if (this.cache.navAngle !== angle) { document.querySelector("#navArrow").style.transform = `rotate(${angle}deg)`; this.cache.navAngle = angle; }
    this.write("navLabel", target.label);
    this.write("navDistance", `${Math.round(Math.hypot(dx, dz))} m`);
  }

  write(id, value) {
    if (this.cache[id] === value) return;
    document.querySelector(`#${id}`).textContent = value;
    this.cache[id] = value;
  }

  prompt(text) {
    const element = document.querySelector("#prompt");
    if (this.cache.prompt !== text) {
      const touch = matchMedia("(pointer: coarse)").matches;
      element.textContent = touch ? (text || "").replace(/^E · /, "USE · ") : text || "";
      element.classList.toggle("hidden", !text);
      this.cache.prompt = text;
    }
  }

  message(text, bad = false) {
    if (this.lastMessage === text && performance.now() - this.lastMessageTime < 1600) return;
    this.lastMessage = text; this.lastMessageTime = performance.now();
    this.callbacks.sound?.(bad ? "warning" : "note");
    const element = document.querySelector("#message");
    clearTimeout(this.messageTimer);
    element.textContent = text;
    element.classList.toggle("bad", bad);
    element.classList.remove("hidden");
    this.messageTimer = setTimeout(() => element.classList.add("hidden"), 1900);
  }

  dialogue(lines, onDone) {
    clearTimeout(this.dialogueTimer);
    if (!lines?.length) return onDone?.();
    const panel = document.querySelector("#dialogue");
    let index = 0;
    panel.classList.remove("hidden");
    const next = () => {
      document.querySelector("#speakerName").textContent = index === 0 ? "LUMA" : "BOLT";
      document.querySelector("#speakerPortrait").textContent = index === 0 ? "🔆" : "🐕";
      document.querySelector("#dialogueText").textContent = lines[index];
      index += 1;
      if (index >= lines.length) {
        clearTimeout(this.dialogueTimer);
        this.dialogueTimer = setTimeout(() => { this.hideDialogue(); onDone?.(); }, 2600);
      } else {
        clearTimeout(this.dialogueTimer);
        this.dialogueTimer = setTimeout(next, 2600);
      }
    };
    next();
  }

  hideDialogue() {
    clearTimeout(this.dialogueTimer);
    document.querySelector("#dialogue").classList.add("hidden");
  }

  modal({ icon, eyebrow, title, text, stats = [], actions = [] }) {
    this.hideDialogue();
    const modal = document.querySelector("#modal");
    document.querySelector("#modalIcon").textContent = icon;
    document.querySelector("#modalEyebrow").textContent = eyebrow;
    document.querySelector("#modalTitle").textContent = title;
    document.querySelector("#modalText").textContent = text;
    document.querySelector("#modalStats").innerHTML = stats.map(([value, label]) => `<div><strong>${value}</strong><span>${label}</span></div>`).join("");
    const container = document.querySelector("#modalActions");
    container.replaceChildren(...actions.map((action, index) => {
      const button = document.createElement("button");
      button.textContent = action.label;
      if (index === 0) button.className = "primary";
      button.addEventListener("click", () => { modal.classList.add("hidden"); action.run(); });
      return button;
    }));
    modal.classList.remove("hidden");
    container.querySelector("button")?.focus();
  }
}
