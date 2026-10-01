// Adaptive "Auto" quality, after Zoo Garden's governor (cute_game src/graphics.ts). Phones are
// limited by the pixels they shade, not by triangles, so a struggling device first gives up
// resolution, then a quality tier, and wins resolution back when frames are fast again. The
// result is remembered per device (never in the shared save), so the next session starts there.
const TIERS = ["low", "medium", "high"];
export const GRAPHICS_KEY = "robot-beach-3d-graphics";

export class QualityGovernor {
  constructor(stored = null) {
    this.cap = TIERS.includes(stored?.cap) ? stored.cap : "high"; // highest tier "auto" may pick
    this.scale = Number.isFinite(stored?.scale) ? Math.min(1, Math.max(.6, stored.scale)) : 1; // pixel-ratio multiplier
    this.frames = 0; this.elapsed = 0; this.slow = 0; this.fast = 0; this.fps = 0;
  }

  // Apply the cap to the tier "auto" would choose on its own.
  limit(tier) { return TIERS[Math.min(TIERS.indexOf(tier), TIERS.indexOf(this.cap))] ?? tier; }

  /**
   * Feed every frame's real duration. Once per second while playing on "auto": three slow seconds
   * in a row (under 40 fps) lower resolution by 15% down to 0.7×, then the tier; five fast seconds
   * (over 57 fps) restore resolution. Returns true when the caller should re-apply quality.
   */
  sample(dt, active, tier) {
    this.frames++; this.elapsed += dt;
    if (this.elapsed < 1) return false;
    this.fps = this.frames / this.elapsed; this.frames = 0; this.elapsed = 0;
    if (!active) { this.slow = this.fast = 0; return false; }
    if (this.fps < 40) {
      this.fast = 0;
      if (++this.slow < 3) return false;
      this.slow = 0;
      if (this.scale > .7 + 1e-6) { this.scale = Math.max(.7, this.scale - .15); return true; }
      const index = TIERS.indexOf(tier);
      if (index > 0) { this.cap = TIERS[index - 1]; this.scale = 1; return true; }
      return false;
    }
    this.slow = 0;
    if (this.fps > 57 && this.scale < 1 && ++this.fast >= 5) { this.fast = 0; this.scale = Math.min(1, this.scale + .15); return true; }
    if (this.fps <= 57) this.fast = 0;
    return false;
  }

  reset() { this.cap = "high"; this.scale = 1; this.slow = this.fast = 0; }

  toJSON() { return { cap: this.cap, scale: this.scale }; }
}

export function loadGovernor() {
  try { return new QualityGovernor(JSON.parse(localStorage.getItem(GRAPHICS_KEY) || "null")); }
  catch { return new QualityGovernor(); }
}

export function saveGovernor(governor) {
  try { localStorage.setItem(GRAPHICS_KEY, JSON.stringify(governor)); } catch { /* kept for this session */ }
}
