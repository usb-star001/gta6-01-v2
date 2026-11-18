// missions.js — Eddie Kline's three story jobs for Mara Voss.
// Done in order. Each job: drive to the pickup, press F to take it, then
// deliver to the drop-off. Pays on delivery. Requires the player to be
// in a car to take a job (Eddie needs a driver, not a pedestrian).

export const Eddie = {
  jobs: [
    {
      name: 'First Fare',
      reward: 150,
      pickup: { x: 600, y: 600, label: 'Eddie — Pier & 3rd' },
      drop: { x: 1800, y: 1400, label: 'The Marlin Bar' },
      brief: 'Eddie: "Pick up my guy at Pier & 3rd, drop him at the Marlin Bar. Easy money."',
    },
    {
      name: 'The Getaway',
      reward: 300,
      pickup: { x: 1800, y: 1400, label: 'The Marlin Bar' },
      drop: { x: 3000, y: 2200, label: 'South docks warehouse' },
      brief: 'Eddie: "The Marlin job went loud. Get my driver from the bar to the south docks. Fast."',
    },
    {
      name: 'Harbor Run',
      reward: 500,
      pickup: { x: 3000, y: 2200, label: 'South docks warehouse' },
      drop: { x: 1400, y: 2600, label: 'Harbor gate' },
      brief: 'Eddie: "Last one. A package at the docks needs to reach the harbor gate. No cops, no questions."',
    },
  ],

  current(S) {
    return S.eddieDone < this.jobs.length ? this.jobs[S.eddieDone] : null;
  },

  // Try to take the current job. Returns true if it started (or a message was shown).
  tryStart(S) {
    if (S.job) return false;
    const j = this.current(S);
    if (!j) return false;
    const p = S.player;
    if (Math.hypot(p.x - j.pickup.x, p.y - j.pickup.y) > 90) return false;
    if (p.onFoot) {
      S.notify("Eddie needs a driver — get in a car first (E).");
      return true;
    }
    S.job = { kind: 'eddie', name: j.name, reward: j.reward, drop: j.drop, pickup: j.pickup };
    S.notify('Job started: ' + j.name + ' — deliver to ' + j.drop.label + ' ($' + j.reward + ').');
    return true;
  },

  update(S, dt) {
    const job = S.job;
    if (!job || job.kind !== 'eddie') return;
    const p = S.player;
    if (Math.hypot(p.x - job.drop.x, p.y - job.drop.y) < 70) {
      S.money += job.reward;
      S.debt = Math.max(0, S.debt - job.reward);
      S.Stats.add('earned', job.reward);
      S.Stats.add('jobs', 1);
      S.eddieDone += 1;
      S.notify('Delivered: ' + job.name + ' — paid $' + job.reward + '.');
      if (S.AudioSys) S.AudioSys.cash();
      S.job = null;
      if (S.eddieDone === this.jobs.length) {
        S.notify("Eddie: \"You're square with me. Rosa the Broker has work now — find her at the corner of 5th & Harbor.\"");
      }
    }
  },

  draw(ctx, S) {
    const j = this.current(S);
    if (S.job && S.job.kind === 'eddie') {
      drawMarker(ctx, S.job.drop.x, S.job.drop.y, '#3dd97e', 'DROP: ' + S.job.name, S.time);
      return;
    }
    if (j && !S.job) {
      drawMarker(ctx, j.pickup.x, j.pickup.y, '#ffd94d', 'F: ' + j.name + ' ($' + j.reward + ')', S.time);
    }
  },
};

export function drawMarker(ctx, x, y, color, label, time) {
  const pulse = 1 + Math.sin(time * 5) * 0.12;
  ctx.save();
  ctx.translate(x, y);
  ctx.strokeStyle = color;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(0, 0, 26 * pulse, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = color;
  ctx.globalAlpha = 0.25;
  ctx.beginPath();
  ctx.arc(0, 0, 26 * pulse, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;
  ctx.font = 'bold 13px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'bottom';
  ctx.fillStyle = '#fff';
  ctx.strokeStyle = 'rgba(0,0,0,0.7)';
  ctx.lineWidth = 3;
  ctx.strokeText(label, 0, -32);
  ctx.fillText(label, 0, -32);
  ctx.restore();
}
