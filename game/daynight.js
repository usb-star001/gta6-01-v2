// daynight.js — day/night cycle for Neon Harbor.
// A full cycle takes about 5 minutes (300 s). t runs 0..1:
// 0.00 dawn, 0.25 noon, 0.50 dusk, 0.75 deep night, back to dawn.
// Lighting and the night-only race read from here.

export const DayNight = {
  t: 0.32,          // start late morning so the first minutes are bright
  CYCLE: 300,       // seconds per full cycle

  update(dt) {
    this.t = (this.t + dt / this.CYCLE) % 1;
  },

  isNight() {
    return this.t > 0.60 && this.t < 0.96;
  },

  isDusk() {
    return this.t > 0.48 && this.t <= 0.60;
  },

  // 0 = pitch dark, 1 = full daylight. Used for the overlay alpha.
  light() {
    const t = this.t;
    if (t < 0.20) return 0.55 + (t / 0.20) * 0.45;      // dawn -> morning
    if (t < 0.45) return 1.0;                            // day
    if (t < 0.60) return 1.0 - ((t - 0.45) / 0.15) * 0.62; // dusk falls
    if (t < 0.92) return 0.38;                           // night
    return 0.38 + ((t - 0.92) / 0.08) * 0.62;           // night -> dawn
  },

  // Warm dusk tint, 0..1 (strongest at t ~ 0.52).
  duskWarmth() {
    const d = 1 - Math.abs(this.t - 0.52) / 0.10;
    return Math.max(0, Math.min(1, d));
  },

  label() {
    if (this.isNight()) return 'Night';
    if (this.isDusk()) return 'Dusk';
    if (this.t < 0.20) return 'Dawn';
    return 'Day';
  },

  // Draw the darkness overlay over the whole screen (screen space).
  drawOverlay(ctx, w, h) {
    const l = this.light();
    if (l >= 0.995) return;
    const warm = this.duskWarmth();
    if (warm > 0.02) {
      ctx.fillStyle = `rgba(255,110,40,${(0.10 * warm).toFixed(3)})`;
      ctx.fillRect(0, 0, w, h);
    }
    ctx.fillStyle = `rgba(8,12,34,${((1 - l) * 0.55).toFixed(3)})`;
    ctx.fillRect(0, 0, w, h);
  },
};
