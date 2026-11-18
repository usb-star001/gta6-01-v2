// sidejobs.js — Rosa "The Broker": three story missions after Eddie's
// three are done, plus repeatable delivery gigs and taxi fares.
// Rosa's corner is at 5th & Harbor (1800, 1800). The taxi stand is at
// (1000, 1400). Gigs pay $80–$150, fares $40–$90.

import { makeVehicle } from './vehicles.js';
import { drawMarker } from './missions.js';

const GIG_BOARD = { x: 1800, y: 1800, label: "Rosa's corner — 5th & Harbor" };
const TAXI_STAND = { x: 1000, y: 1400, label: 'Taxi stand' };

// Road intersections used as random gig/fare endpoints.
const SPOTS = [
  { x: 200, y: 200 }, { x: 600, y: 600 }, { x: 1000, y: 1000 }, { x: 1400, y: 600 },
  { x: 1800, y: 1400 }, { x: 2200, y: 2200 }, { x: 2600, y: 1000 }, { x: 3000, y: 2200 },
  { x: 3400, y: 1400 }, { x: 600, y: 2200 }, { x: 1400, y: 2600 }, { x: 2600, y: 600 },
  { x: 1000, y: 1800 }, { x: 2200, y: 600 }, { x: 3000, y: 600 }, { x: 3400, y: 2600 },
];

function pickSpot(exclude) {
  let s;
  do {
    s = SPOTS[Math.floor(Math.random() * SPOTS.length)];
  } while (exclude && s.x === exclude.x && s.y === exclude.y);
  return s;
}

export const Rosa = {
  jobs: [
    {
      name: 'The Smuggler',
      reward: 400,
      pickup: { x: 1000, y: 1000, label: 'Market alley' },
      drop: { x: 3400, y: 2600, label: 'East dock gate' },
      brief: 'Rosa: "A crate in the market alley needs to reach the east dock gate. Don\'t open it."',
    },
    {
      name: 'The Tail',
      reward: 350,
      pickup: { x: 1800, y: 1800, label: "Rosa's corner" },
      drop: null,
      brief: 'Rosa: "Follow the grey sedan leaving my corner. Stay close for 20 seconds — don\'t lose him, don\'t spook him."',
    },
    {
      name: 'The Payoff',
      reward: 600,
      pickup: { x: 2600, y: 600, label: 'North garage' },
      drop: { x: 600, y: 2200, label: 'West tenements' },
      brief: 'Rosa: "Final run. An envelope at the north garage goes to the west tenements. This one settles a lot."',
    },
  ],

  current(S) {
    if (S.eddieDone < 3) return null;
    return S.rosaDone < this.jobs.length ? this.jobs[S.rosaDone] : null;
  },

  tryStart(S) {
    if (S.job) return false;
    const j = this.current(S);
    if (!j) return false;
    const p = S.player;
    if (Math.hypot(p.x - j.pickup.x, p.y - j.pickup.y) > 90) return false;
    if (p.onFoot) {
      S.notify("Rosa needs a driver — get in a car first (E).");
      return true;
    }
    if (j.name === 'The Tail') {
      // Spawn the target sedan and start following.
      const target = makeVehicle('car', j.pickup.x + 120, j.pickup.y, 0, '#8a94a6');
      target.traffic = false;
      target.tailTarget = true;
      target.speed = 150;
      S.cars.push(target);
      S.job = { kind: 'tail', name: j.name, reward: j.reward, target, follow: 0, need: 20, lost: 0 };
      S.notify('Tail started: stay within range of the grey sedan for 20 seconds.');
      return true;
    }
    S.job = { kind: 'rosa', name: j.name, reward: j.reward, drop: j.drop, pickup: j.pickup };
    S.notify('Job started: ' + j.name + ' — deliver to ' + j.drop.label + ' ($' + j.reward + ').');
    return true;
  },

  // Repeatable delivery gig from Rosa's board (after Eddie's three).
  tryGig(S) {
    if (S.job) return false;
    if (S.eddieDone < 3) return false;
    const p = S.player;
    if (Math.hypot(p.x - GIG_BOARD.x, p.y - GIG_BOARD.y) > 90) return false;
    if (p.onFoot) {
      S.notify('Gigs need a car — steal one first (E).');
      return true;
    }
    const from = pickSpot(null);
    const to = pickSpot(from);
    const reward = 80 + Math.floor(Math.random() * 8) * 10;
    S.job = { kind: 'gig', name: 'Delivery gig', reward, drop: to, pickup: from };
    S.notify('Gig: pick up at (' + from.x + ', ' + from.y + '), deliver to (' + to.x + ', ' + to.y + ') — $' + reward + '.');
    return true;
  },

  // Repeatable taxi fare from the taxi stand (available from the start).
  tryFare(S) {
    if (S.job) return false;
    const p = S.player;
    if (Math.hypot(p.x - TAXI_STAND.x, p.y - TAXI_STAND.y) > 90) return false;
    if (p.onFoot) {
      S.notify('Fares need a car — steal one first (E).');
      return true;
    }
    const to = pickSpot(null);
    const reward = 40 + Math.floor(Math.random() * 6) * 10;
    S.job = { kind: 'fare', name: 'Taxi fare', reward, drop: to, pickup: TAXI_STAND };
    S.notify('Fare: passenger wants (' + to.x + ', ' + to.y + ') — $' + reward + '.');
    return true;
  },

  update(S, dt) {
    const job = S.job;
    if (!job) return;
    const p = S.player;

    if (job.kind === 'tail') {
      const t = job.target;
      // Target drives a slow loop around the blocks.
      t.speed = 150;
      t.angle += Math.sin(S.time * 0.25) * 0.6 * dt;
      t.x += Math.cos(t.angle) * t.speed * dt;
      t.y += Math.sin(t.angle) * t.speed * dt;
      // keep it in the city
      if (t.x < 200) { t.x = 200; t.angle = 0; }
      if (t.x > 3400) { t.x = 3400; t.angle = Math.PI; }
      if (t.y < 200) { t.y = 200; t.angle = Math.PI / 2; }
      if (t.y > 2600) { t.y = 2600; t.angle = -Math.PI / 2; }
      const d = Math.hypot(p.x - t.x, p.y - t.y);
      if (d < 420) {
        job.follow += dt;
        job.lost = 0;
      } else if (d > 600) {
        job.lost += dt;
        if (job.lost > 5) {
          S.notify('You lost the sedan. The Tail failed — come back to Rosa to try again.');
          S.cars = S.cars.filter(c => c !== t);
          S.job = null;
          return;
        }
      }
      if (job.follow >= job.need) {
        S.money += job.reward;
        S.debt = Math.max(0, S.debt - job.reward);
        S.Stats.add('earned', job.reward);
        S.Stats.add('jobs', 1);
        S.rosaDone += 1;
        S.notify('The Tail: done. Rosa pays $' + job.reward + '.');
        if (S.AudioSys) S.AudioSys.cash();
        S.cars = S.cars.filter(c => c !== t);
        S.job = null;
      }
      return;
    }

    if (job.kind === 'rosa' || job.kind === 'gig' || job.kind === 'fare') {
      if (Math.hypot(p.x - job.drop.x, p.y - job.drop.y) < 70) {
        S.money += job.reward;
        S.debt = Math.max(0, S.debt - job.reward);
        S.Stats.add('earned', job.reward);
        S.Stats.add('jobs', 1);
        if (job.kind === 'rosa') S.rosaDone += 1;
        S.notify('Delivered: ' + job.name + ' — paid $' + job.reward + '.');
        if (S.AudioSys) S.AudioSys.cash();
        S.job = null;
        if (job.kind === 'rosa' && S.rosaDone === this.jobs.length) {
          S.notify('Rosa: "That\'s all my story work. Gigs and fares at my corner and the taxi stand still pay."');
        }
      }
    }
  },

  draw(ctx, S) {
    const j = this.current(S);
    if (S.job && (S.job.kind === 'rosa' || S.job.kind === 'gig' || S.job.kind === 'fare')) {
      drawMarker(ctx, S.job.drop.x, S.job.drop.y, '#3dd97e', 'DROP: ' + S.job.name, S.time);
      return;
    }
    if (S.job && S.job.kind === 'tail') {
      const t = S.job.target;
      drawMarker(ctx, t.x, t.y, '#ff9f43', 'TAIL HIM (' + Math.ceil(S.job.need - S.job.follow) + 's)', S.time);
      return;
    }
    if (j && !S.job) {
      drawMarker(ctx, j.pickup.x, j.pickup.y, '#c678ff', 'F: ' + j.name + ' ($' + j.reward + ')', S.time);
    }
    // Gig board (after Eddie) and taxi stand (always) when no job is active.
    if (!S.job) {
      if (S.eddieDone >= 3) {
        drawMarker(ctx, GIG_BOARD.x, GIG_BOARD.y, '#c678ff', 'F: Gigs ($80–$150)', S.time);
      }
      drawMarker(ctx, TAXI_STAND.x, TAXI_STAND.y, '#4dc3ff', 'F: Taxi fare ($40–$90)', S.time);
    }
  },
};
