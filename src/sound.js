// Small synthesized cues keep the complete game playable without audio downloads.
export class Sound {
  constructor() { this.enabled = true; this.lastCue = 0; }
  unlock() {
    if (!this.enabled) return;
    try {
      this.context ||= new (window.AudioContext || window.webkitAudioContext)();
      if (this.context.state === "suspended") this.context.resume().catch(() => {});
    } catch { /* Audio is optional; game interaction stays available. */ }
  }
  play(kind) {
    if (!this.enabled || this.context?.state !== "running") return;
    const time = this.context.currentTime;
    if (kind !== "victory" && time - this.lastCue < 0.12) return;
    this.lastCue = time;
    const oscillator = this.context.createOscillator();
    const gain = this.context.createGain();
    const warning = kind === "warning";
    if (kind === "victory") {
      oscillator.type = "triangle";
      for (const [index, note] of [523.25, 659.25, 783.99, 1046.5].entries()) oscillator.frequency.setValueAtTime(note, time + index * 0.16);
      gain.gain.setValueAtTime(0.025, time);
      gain.gain.exponentialRampToValueAtTime(0.0001, time + 0.8);
      oscillator.connect(gain).connect(this.context.destination);
      oscillator.start(time); oscillator.stop(time + 0.85);
      oscillator.onended = () => { oscillator.disconnect(); gain.disconnect(); };
      return;
    }
    oscillator.type = "sine";
    oscillator.frequency.setValueAtTime(warning ? 220 : 620, time);
    oscillator.frequency.exponentialRampToValueAtTime(warning ? 140 : 960, time + 0.11);
    gain.gain.setValueAtTime(0.0001, time);
    gain.gain.exponentialRampToValueAtTime(0.045, time + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + 0.18);
    oscillator.connect(gain).connect(this.context.destination);
    oscillator.start(time); oscillator.stop(time + 0.2);
    oscillator.onended = () => { oscillator.disconnect(); gain.disconnect(); };
  }
}
