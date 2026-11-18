// stats.js — "Mara's Record": session totals and all-time totals.
// All-time totals live in localStorage; session totals reset each launch.

const KEY = 'neonharbor-stats-v2';

function blank() {
  return { earned: 0, jobs: 0, races: 0, packages: 0, shots: 0, carsStolen: 0 };
}

export const Stats = {
  session: blank(),
  total: blank(),

  load() {
    this.session = blank();
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) {
        const t = JSON.parse(raw);
        this.total = { ...blank(), ...t };
      }
    } catch (e) {
      this.total = blank();
    }
  },

  save() {
    try {
      localStorage.setItem(KEY, JSON.stringify(this.total));
    } catch (e) { /* storage unavailable */ }
  },

  // kind: 'earned' (amount = dollars) | 'jobs' | 'races' | 'packages' | 'shots' | 'carsStolen'
  add(kind, amount = 1) {
    if (kind === 'earned') {
      this.session.earned += amount;
      this.total.earned += amount;
    } else {
      this.session[kind] = (this.session[kind] || 0) + amount;
      this.total[kind] = (this.total[kind] || 0) + amount;
    }
    this.save();
  },

  // Draw the records screen overlay (screen space).
  draw(ctx, w, h, debt) {
    ctx.fillStyle = 'rgba(6,10,20,0.88)';
    ctx.fillRect(0, 0, w, h);
    const pw = Math.min(560, w - 40);
    const px = (w - pw) / 2;
    const py = Math.max(30, h / 2 - 220);
    ctx.fillStyle = '#101828';
    ctx.strokeStyle = '#ffd94d';
    ctx.lineWidth = 2;
    ctx.fillRect(px, py, pw, 400);
    ctx.strokeRect(px, py, pw, 400);

    ctx.fillStyle = '#ffd94d';
    ctx.font = 'bold 26px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText("MARA'S RECORD", w / 2, py + 18);

    ctx.fillStyle = '#9fb3c8';
    ctx.font = '14px sans-serif';
    ctx.fillText('Port Azure — everything Mara has done, this run and always.', w / 2, py + 52);

    const rows = [
      ['Money earned', '$' + this.session.earned, '$' + this.total.earned],
      ['Jobs completed', '' + this.session.jobs, '' + this.total.jobs],
      ['Races won', '' + this.session.races, '' + this.total.races],
      ['Packages found', '' + this.session.packages + ' / 12', '' + this.total.packages + ' / 12'],
      ['Shots fired', '' + this.session.shots, '' + this.total.shots],
      ['Cars stolen', '' + this.session.carsStolen, '' + this.total.carsStolen],
    ];
    ctx.textAlign = 'left';
    ctx.font = 'bold 15px sans-serif';
    ctx.fillStyle = '#e6e6e6';
    ctx.fillText('Session', px + 220, py + 92);
    ctx.fillText('All time', px + 380, py + 92);
    ctx.strokeStyle = '#2b3a4d';
    ctx.beginPath();
    ctx.moveTo(px + 24, py + 114);
    ctx.lineTo(px + pw - 24, py + 114);
    ctx.stroke();

    let y = py + 128;
    ctx.font = '15px sans-serif';
    for (const [label, s, t] of rows) {
      ctx.fillStyle = '#c8d3e0';
      ctx.fillText(label, px + 24, y);
      ctx.fillStyle = '#ffffff';
      ctx.fillText(s, px + 220, y);
      ctx.fillText(t, px + 380, y);
      y += 30;
    }

    const paid = Math.max(0, 50000 - debt);
    ctx.fillStyle = '#9fb3c8';
    ctx.font = '14px sans-serif';
    ctx.fillText('Syndicate debt: $' + debt + ' left  ($' + paid + ' paid off)', px + 24, py + 330);
    ctx.fillStyle = '#ffd94d';
    ctx.font = '13px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Press H to close', w / 2, py + 368);
  },
};
