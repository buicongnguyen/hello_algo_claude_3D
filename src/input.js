export class InputController {
  constructor() {
    this.keys = new Set();
    this.actions = new Set();
    this.touch = { x: 0, y: 0 };
    this.firePointers = new Set();
    this.enabled = false;
    this.bindKeyboard();
    this.bindTouch();
    const canvas = document.querySelector("#game");
    canvas?.addEventListener("pointerdown", event => {
      if (!this.enabled || event.button !== 0 || event.pointerType !== "mouse") return;
      canvas.setPointerCapture(event.pointerId); this.firePointers.add(event.pointerId);
    });
    for (const name of ["pointerup", "pointercancel", "lostpointercapture"]) canvas?.addEventListener(name, event => this.firePointers.delete(event.pointerId));
  }

  bindKeyboard() {
    window.addEventListener("keydown", event => {
      if (!this.enabled || event.ctrlKey || event.metaKey || event.altKey) return;
      // Radio controls retain native keyboard activation while gameplay is active.
      // Hidden launch/menu buttons can keep focus, so only visible controls intercept input.
      const control = event.target.closest?.("button, select, input, textarea");
      if (control?.getClientRects().length && (["Space", "Enter"].includes(event.code) || control.matches("select, input, textarea"))) return;
      if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Space", "Enter"].includes(event.code)) event.preventDefault();
      this.keys.add(event.code);
      if (!event.repeat) {
        if (event.code === "KeyQ") this.actions.add("pulse");
        if (event.code === "KeyF") this.actions.add("freeze");
        if (event.code === "KeyR") this.actions.add("call");
        if (["Space", "ShiftLeft", "ShiftRight"].includes(event.code)) this.actions.add("dash");
        if (["KeyE", "Enter"].includes(event.code)) this.actions.add("interact");
        if (event.code === "Escape") this.actions.add("pause");
      }
    });
    window.addEventListener("keyup", event => this.keys.delete(event.code));
    window.addEventListener("blur", () => this.clear());
  }

  bindTouch() {
    const joystick = document.querySelector("#joystick");
    const knob = joystick?.querySelector("i");
    this.joystick = joystick;
    this.knob = knob;
    this.pointerId = null;
    const update = event => {
      if (!this.enabled || this.pointerId !== event.pointerId) return;
      const rect = joystick.getBoundingClientRect();
      const dx = event.clientX - (rect.left + rect.width / 2);
      const dy = event.clientY - (rect.top + rect.height / 2);
      const length = Math.hypot(dx, dy) || 1;
      const radius = Math.min(42, length);
      this.touch.x = (dx / length) * (radius / 42);
      this.touch.y = (dy / length) * (radius / 42);
      knob.style.transform = `translate(${this.touch.x * 34}px, ${this.touch.y * 34}px)`;
    };
    joystick?.addEventListener("pointerdown", event => { if (!this.enabled) return; this.pointerId = event.pointerId; joystick.setPointerCapture(this.pointerId); update(event); });
    joystick?.addEventListener("pointermove", update);
    const release = event => {
      if (this.pointerId !== event.pointerId) return;
      this.pointerId = null; this.touch.x = 0; this.touch.y = 0;
      knob.style.transform = "translate(0, 0)";
    };
    joystick?.addEventListener("pointerup", release);
    joystick?.addEventListener("pointercancel", release);
    document.querySelectorAll("[data-touch]").forEach(button => {
      button.addEventListener("pointerdown", event => {
        event.preventDefault();
        if (!this.enabled) return;
        if (button.dataset.touch === "shoot") { button.setPointerCapture(event.pointerId); this.firePointers.add(event.pointerId); }
        else this.actions.add(button.dataset.touch);
      });
      for (const name of ["pointerup", "pointercancel", "lostpointercapture"]) button.addEventListener(name, event => this.firePointers.delete(event.pointerId));
    });
  }

  movement() {
    let x = this.touch.x;
    let y = this.touch.y;
    if (this.keys.has("KeyA") || this.keys.has("ArrowLeft")) x -= 1;
    if (this.keys.has("KeyD") || this.keys.has("ArrowRight")) x += 1;
    if (this.keys.has("KeyW") || this.keys.has("ArrowUp")) y -= 1;
    if (this.keys.has("KeyS") || this.keys.has("ArrowDown")) y += 1;
    const length = Math.hypot(x, y);
    return length > 1 ? { x: x / length, y: y / length } : { x, y };
  }

  consume(action) {
    if (!this.actions.has(action)) return false;
    this.actions.delete(action);
    return true;
  }

  held(action) { return this.enabled && action === "shoot" && (this.keys.has("KeyJ") || this.firePointers.size > 0); }

  clear() {
    this.actions.clear();
    this.keys.clear();
    this.firePointers.clear();
    this.touch.x = 0; this.touch.y = 0;
    if (this.pointerId != null && this.joystick?.hasPointerCapture(this.pointerId)) this.joystick.releasePointerCapture(this.pointerId);
    this.pointerId = null;
    if (this.knob) this.knob.style.transform = "translate(0, 0)";
  }
}
