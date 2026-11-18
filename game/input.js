// input.js — keyboard + mouse for Neon Harbor.
// WASD / arrows drive, E steal a car, Space handbrake, H stats screen,
// F interact (start a job / race at a marker), mouse aims, click shoots.
// Edge-triggered keys live in `pressed` and are cleared by endFrame().

export const Input = {
  keys: {},       // code -> held
  pressed: {},    // code -> pressed this frame (edge)
  mouse: { x: 0, y: 0, sx: 0, sy: 0, down: false, clicked: false },
  _canvas: null,

  init(canvas) {
    this._canvas = canvas;
    window.addEventListener('keydown', (e) => {
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) {
        e.preventDefault();
      }
      if (!this.keys[e.code]) this.pressed[e.code] = true;
      this.keys[e.code] = true;
    });
    window.addEventListener('keyup', (e) => {
      this.keys[e.code] = false;
    });
    window.addEventListener('blur', () => {
      this.keys = {};
    });
    canvas.addEventListener('mousemove', (e) => {
      const r = canvas.getBoundingClientRect();
      this.mouse.sx = e.clientX - r.left;
      this.mouse.sy = e.clientY - r.top;
    });
    canvas.addEventListener('mousedown', (e) => {
      if (e.button === 0) {
        this.mouse.down = true;
        this.mouse.clicked = true;
      }
    });
    window.addEventListener('mouseup', (e) => {
      if (e.button === 0) this.mouse.down = false;
    });
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  },

  // Driving axes, merged from WASD + arrows. Returns {up, down, left, right, hand}.
  drive() {
    return {
      up: !!(this.keys['KeyW'] || this.keys['ArrowUp']),
      down: !!(this.keys['KeyS'] || this.keys['ArrowDown']),
      left: !!(this.keys['KeyA'] || this.keys['ArrowLeft']),
      right: !!(this.keys['KeyD'] || this.keys['ArrowRight']),
      hand: !!this.keys['Space'],
    };
  },

  // On-foot movement axes (same keys).
  walk() {
    return this.drive();
  },

  // Edge-triggered action keys. True only on the frame the key went down.
  take(code) {
    if (this.pressed[code]) {
      this.pressed[code] = false;
      return true;
    }
    return false;
  },

  anyKey() {
    return Object.keys(this.pressed).length > 0;
  },

  // Mouse position converted to world coords given the camera.
  worldMouse(cam) {
    return { x: cam.x + this.mouse.sx, y: cam.y + this.mouse.sy };
  },

  endFrame() {
    this.pressed = {};
    this.mouse.clicked = false;
  },
};
