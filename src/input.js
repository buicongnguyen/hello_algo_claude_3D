export class InputController {
  constructor() {
    this.keys = new Set();
    this.actions = new Set();
    this.touch = { x: 0, y: 0 };
    this.enabled = true;
    this.bindKeyboard();
    this.bindTouch();
  }

  bindKeyboard() {
    window.addEventListener("keydown", event => {
      if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Space"].includes(event.code)) event.preventDefault();
      if (!this.enabled) return;
      this.keys.add(event.code);
      if (!event.repeat) {
        if (["KeyQ", "Space"].includes(event.code)) this.actions.add("pulse");
        if (["ShiftLeft", "ShiftRight"].includes(event.code)) this.actions.add("dash");
        if (["KeyE", "Enter"].includes(event.code)) this.actions.add("interact");
        if (event.code === "Escape") this.actions.add("pause");
      }
    });
    window.addEventListener("keyup", event => this.keys.delete(event.code));
    window.addEventListener("blur", () => { this.keys.clear(); this.touch.x = 0; this.touch.y = 0; });
  }

  bindTouch() {
    const joystick = document.querySelector("#joystick");
    const knob = joystick?.querySelector("i");
    let pointerId = null;
    const update = event => {
      if (pointerId !== event.pointerId) return;
      const rect = joystick.getBoundingClientRect();
      const dx = event.clientX - (rect.left + rect.width / 2);
      const dy = event.clientY - (rect.top + rect.height / 2);
      const length = Math.hypot(dx, dy) || 1;
      const radius = Math.min(42, length);
      this.touch.x = (dx / length) * (radius / 42);
      this.touch.y = (dy / length) * (radius / 42);
      knob.style.transform = `translate(${this.touch.x * 34}px, ${this.touch.y * 34}px)`;
    };
    joystick?.addEventListener("pointerdown", event => { pointerId = event.pointerId; joystick.setPointerCapture(pointerId); update(event); });
    joystick?.addEventListener("pointermove", update);
    const release = event => {
      if (pointerId !== event.pointerId) return;
      pointerId = null; this.touch.x = 0; this.touch.y = 0;
      knob.style.transform = "translate(0, 0)";
    };
    joystick?.addEventListener("pointerup", release);
    joystick?.addEventListener("pointercancel", release);
    document.querySelectorAll("[data-touch]").forEach(button => button.addEventListener("pointerdown", event => {
      event.preventDefault();
      if (this.enabled) this.actions.add(button.dataset.touch);
    }));
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

  clear() {
    this.actions.clear();
    this.keys.clear();
  }
}
