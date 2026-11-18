// collectibles.js — twelve hidden packages scattered around Port Azure.
// Walk or drive over one to collect it. Each is worth $250 and counts
// toward the "Mara's Record" stats. Positions are fixed by hand so the
// set is the same every run.

export const PACKAGE_VALUE = 250;

const SPOTS = [
  { x: 200,  y: 200,  hint: 'Northwest corner, by the pier road' },
  { x: 1000, y: 600,  hint: 'Behind the blue warehouse uptown' },
  { x: 1800, y: 200,  hint: 'North edge, behind the depot' },
  { x: 2600, y: 1000, hint: 'East side, alley by the market' },
  { x: 3400, y: 600,  hint: 'Far east, near the old cannery' },
  { x: 600,  y: 1400, hint: 'West row, between the tenements' },
  { x: 1400, y: 1800, hint: 'Midtown, in the courtyard' },
  { x: 2200, y: 2200, hint: 'South-central, by the parking lot' },
  { x: 3000, y: 1000, hint: 'East midtown, behind the garage' },
  { x: 3400, y: 2200, hint: 'Southeast, at the dock gate' },
  { x: 1000, y: 2600, hint: 'Harbor road, under the crane' },
  { x: 2200, y: 1400, hint: 'Central, in the park corner' },
];

export const Packages = {
  list: [],

  init(savedTaken) {
    this.list = SPOTS.map((s, i) => ({
      id: i,
      x: s.x,
      y: s.y,
      hint: s.hint,
      taken: !!(savedTaken && savedTaken.includes(i)),
    }));
  },

  remaining() {
    return this.list.filter(p => !p.taken).length;
  },

  found() {
    return this.list.filter(p => p.taken).length;
  },

  // Returns the package just collected, or null.
  update(px, py) {
    for (const p of this.list) {
      if (p.taken) continue;
      const d = Math.hypot(px - p.x, py - p.y);
      if (d < 46) {
        p.taken = true;
        return p;
      }
    }
    return null;
  },

  draw(ctx, time) {
    for (const p of this.list) {
      if (p.taken) continue;
      const pulse = 1 + Math.sin(time * 4 + p.id) * 0.15;
      ctx.save();
      ctx.translate(p.x, p.y);
      // glow ring
      ctx.strokeStyle = 'rgba(190,120,255,0.9)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(0, 0, 16 * pulse, 0, Math.PI * 2);
      ctx.stroke();
      // the package
      ctx.fillStyle = '#b678ff';
      ctx.fillRect(-9, -7, 18, 14);
      ctx.fillStyle = '#e9d5ff';
      ctx.fillRect(-9, -2, 18, 4);
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 11px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('$', 0, 1);
      ctx.restore();
    }
  },
};
