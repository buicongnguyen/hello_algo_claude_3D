// Synthesized cues and ambience keep the game fully playable without audio downloads.
// Every voice is short-lived and disconnects itself; ambience is one long-lived bed per destination.
const AMBIENCE = {
  menu: { root: 196, chord: [1, 1.5, 2], noise: 0, filter: 900 },
  island: { root: 220, chord: [1, 1.25, 1.5], noise: .012, noiseFilter: 500, filter: 1100 },
  city: { root: 196, chord: [1, 1.26, 1.5, 2], noise: .006, noiseFilter: 300, filter: 1000 },
  country: { root: 220, chord: [1, 1.5, 1.68], noise: .01, noiseFilter: 1400, filter: 1300 },
  coast: { root: 174.6, chord: [1, 1.25, 1.5], noise: .03, noiseFilter: 420, swell: .09, filter: 900 },
  underwater: { root: 110, chord: [1, 1.5, 2.25], noise: .03, noiseFilter: 220, swell: .05, filter: 520 },
  surface: { root: 196, chord: [1, 1.33, 1.5], noise: .028, noiseFilter: 480, swell: .08, filter: 1000 },
  sky: { root: 246.9, chord: [1, 1.5, 2, 2.5], noise: .03, noiseFilter: 900, swell: .13, filter: 1600 },
  space: { root: 98, chord: [1, 1.5, 2, 3], noise: 0, filter: 700 },
  moon: { root: 110, chord: [1, 1.2, 1.5, 2.4], noise: 0, filter: 620 },
};

export class Sound {
  constructor() { this.enabled = true; this.last = {}; this.ambienceKey = null; }

  unlock() {
    if (!this.enabled) return;
    try {
      if (!this.context) {
        this.context = new (window.AudioContext || window.webkitAudioContext)();
        this.master = this.context.createGain();
        this.master.gain.value = .8;
        const limiter = this.context.createDynamicsCompressor();
        limiter.threshold.value = -14; limiter.ratio.value = 6;
        this.master.connect(limiter).connect(this.context.destination);
        const length = this.context.sampleRate;
        this.noise = this.context.createBuffer(1, length, this.context.sampleRate);
        const data = this.noise.getChannelData(0);
        for (let i = 0; i < length; i++) data[i] = Math.random() * 2 - 1;
      }
      if (this.context.state === "suspended") this.context.resume().catch(() => {});
      if (this.pendingAmbience !== undefined) { const key = this.pendingAmbience; this.pendingAmbience = undefined; this.ambience(key); }
    } catch { /* Audio is optional; the game remains playable. */ }
  }

  get ready() { return this.enabled && this.context?.state === "running"; }

  tone(type, from, to, duration, volume, when = 0, filter = null) {
    const t = this.context.currentTime + when;
    const oscillator = this.context.createOscillator();
    const gain = this.context.createGain();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(from, t);
    oscillator.frequency.exponentialRampToValueAtTime(Math.max(20, to), t + duration);
    gain.gain.setValueAtTime(.0001, t);
    gain.gain.exponentialRampToValueAtTime(volume, t + Math.min(.012, duration * .2));
    gain.gain.exponentialRampToValueAtTime(.0001, t + duration);
    oscillator.connect(gain);
    let lowpass = null;
    if (filter) {
      lowpass = this.context.createBiquadFilter();
      lowpass.type = "lowpass"; lowpass.frequency.value = filter;
      gain.connect(lowpass).connect(this.master);
    } else gain.connect(this.master);
    oscillator.start(t); oscillator.stop(t + duration + .02);
    oscillator.onended = () => { oscillator.disconnect(); gain.disconnect(); lowpass?.disconnect(); };
  }

  hiss(duration, volume, type, from, to = from, when = 0, q = 1) {
    const t = this.context.currentTime + when;
    const source = this.context.createBufferSource();
    source.buffer = this.noise;
    const filter = this.context.createBiquadFilter();
    filter.type = type; filter.Q.value = q;
    filter.frequency.setValueAtTime(from, t);
    filter.frequency.exponentialRampToValueAtTime(Math.max(40, to), t + duration);
    const gain = this.context.createGain();
    gain.gain.setValueAtTime(.0001, t);
    gain.gain.exponentialRampToValueAtTime(volume, t + Math.min(.02, duration * .25));
    gain.gain.exponentialRampToValueAtTime(.0001, t + duration);
    source.connect(filter).connect(gain).connect(this.master);
    source.start(t, Math.random() * .5); source.stop(t + duration + .02);
    source.onended = () => { source.disconnect(); filter.disconnect(); gain.disconnect(); };
  }

  play(kind) {
    if (!this.ready) return;
    const now = this.context.currentTime;
    if (kind !== "victory" && now - (this.last[kind] || 0) < (kind === "shot" ? .05 : .09)) return;
    this.last[kind] = now;
    switch (kind) {
      case "shot": this.tone("square", 900, 420, .07, .018, 0, 2400); break;
      case "hit": this.hiss(.06, .05, "bandpass", 1800, 900, 0, 2); this.tone("sine", 160, 70, .1, .05); break;
      case "defeat": this.hiss(.22, .05, "lowpass", 2400, 300); [660, 520, 390].forEach((f, i) => this.tone("triangle", f, f * .97, .12, .03, i * .06)); break;
      case "pickup": this.tone("triangle", 660, 660, .1, .035); this.tone("triangle", 990, 990, .16, .035, .07); break;
      case "collect": this.tone("sine", 1320, 1320, .18, .04); this.tone("sine", 1760, 1760, .28, .03, .06); break;
      case "dash": this.hiss(.24, .05, "bandpass", 500, 2600, 0, .8); break;
      case "hurt": this.tone("sawtooth", 200, 80, .28, .05, 0, 900); this.hiss(.18, .05, "lowpass", 900, 200); break;
      case "pulse": this.tone("sine", 280, 860, .22, .045, 0, 3000); this.hiss(.2, .02, "highpass", 2000, 6000); break;
      case "gate": this.tone("triangle", 1046, 1046, .22, .035); this.tone("triangle", 1318, 1318, .3, .03, .08); break;
      case "scan": this.tone("sine", 520, 1560, .35, .035); break;
      case "turn": this.tone("square", 420, 380, .05, .018, 0, 1800); this.tone("sine", 840, 840, .08, .02, .04); break;
      case "warning": this.tone("sine", 220, 140, .18, .04); break;
      case "victory": [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => this.tone("triangle", f, f, .45, .035, i * .14)); break;
      default: this.tone("sine", 620, 960, .15, .028);
    }
  }

  ambience(key) {
    if (!this.enabled) { this.stopAmbience(); return; }
    if (!this.context) { this.pendingAmbience = key; return; }
    if (key === this.ambienceKey) return;
    this.stopAmbience();
    this.ambienceKey = key;
    const look = AMBIENCE[key];
    if (!look) return;
    const ctx = this.context, t = ctx.currentTime;
    const bed = ctx.createGain();
    bed.gain.setValueAtTime(.0001, t);
    bed.gain.exponentialRampToValueAtTime(1, t + 2.5);
    bed.connect(this.master);
    const lowpass = ctx.createBiquadFilter();
    lowpass.type = "lowpass"; lowpass.frequency.value = look.filter; lowpass.Q.value = .6;
    lowpass.connect(bed);
    const lfo = ctx.createOscillator(), lfoGain = ctx.createGain();
    lfo.frequency.value = .07; lfoGain.gain.value = look.filter * .35;
    lfo.connect(lfoGain).connect(lowpass.frequency);
    const nodes = [bed, lowpass, lfo, lfoGain];
    for (const [i, ratio] of look.chord.entries()) {
      for (const detune of [-6, 6]) {
        const oscillator = ctx.createOscillator(), gain = ctx.createGain();
        oscillator.type = i ? "sine" : "triangle";
        oscillator.frequency.value = look.root * ratio;
        oscillator.detune.value = detune + i * 2;
        gain.gain.value = .0065 / (1 + i * .6);
        oscillator.connect(gain).connect(lowpass);
        oscillator.start(t);
        nodes.push(oscillator, gain);
      }
    }
    if (look.noise) {
      const source = ctx.createBufferSource(), filter = ctx.createBiquadFilter(), gain = ctx.createGain();
      source.buffer = this.noise; source.loop = true;
      filter.type = "lowpass"; filter.frequency.value = look.noiseFilter;
      gain.gain.value = look.noise;
      source.connect(filter).connect(gain).connect(bed);
      if (look.swell) {
        const swell = ctx.createOscillator(), depth = ctx.createGain();
        swell.frequency.value = look.swell; depth.gain.value = look.noise * .8;
        swell.connect(depth).connect(gain.gain); swell.start(t);
        nodes.push(swell, depth);
      }
      source.start(t);
      nodes.push(source, filter, gain);
    }
    lfo.start(t);
    this.bed = { gain: bed, nodes };
  }

  stopAmbience() {
    this.ambienceKey = null;
    const bed = this.bed;
    this.bed = null;
    if (!bed || !this.context) return;
    const t = this.context.currentTime;
    bed.gain.gain.cancelScheduledValues(t);
    bed.gain.gain.setValueAtTime(Math.max(.0001, bed.gain.gain.value), t);
    bed.gain.gain.exponentialRampToValueAtTime(.0001, t + 1.2);
    setTimeout(() => { for (const node of bed.nodes) { try { node.stop?.(); } catch { /* already stopped */ } node.disconnect(); } }, 1400);
  }
}

export function ambienceFor(stage, environments) {
  const environment = environments[stage?.scene];
  if (!environment) return { coral: "coast", scrapyard: "city", moonpool: "moon" }[stage?.theme] || "island";
  return { city: "city", country: "country", coast: "coast", underwater: "underwater", surface: "surface", sky: "sky", space: "space", moon: "moon" }[environment.kind] || "island";
}
