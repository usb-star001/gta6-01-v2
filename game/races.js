// races.js — three street races across Port Azure.
// Drive to a race start, press F. Checkpoints must be hit in order.
// "Night Run" only starts at night. Winning pays $300 and counts toward
// "Mara's Record". Beating the par time is the bragging right.

import { drawMarker } from './missions.js';

const RACE_REWARD = 300;

export const Races = {
  list: [
    {
      id: 'harbor-sprint',
      name: 'Harbor Sprint',
      par: 60,
      nightOnly: false,
      checkpoints: [
        { x: 200, y: 2600 }, { x: 1800, y: 2600 }, { x: 1800, y: 1400 },
        { x: 3400, y: 1400 }, { x: 3400, y: 2600 },
      ],
    },
    {
      id: 'night-run',
      name: 'Night Run',
      par: 75,
      nightOnly: true,
      checkpoints: [
        { x: 600, y: 200 }, { x: 3000, y: 200 }, { x: 3000, y: 1800 },
        { x: 600, y: 1800 }, { x: 600, y: 200 },
      ],
    },
    {
      id: 'uptown-loop',
      name: 'Uptown Loop',
      par: 90,
      nightOnly: false,
      checkpoints: [
        { x: 1000, y: 600 }, { x: 2600, y: 600 }, { x: 2600, y: 2200 },
        { x: 1000, y: 2200 }, { x: 1000, y: 600 },
      ],
    },
  ],

  // Try to start a race at the player's position. Returns true if handled.
  tryStart(S) {
    if (S.race && S.race.active) return false;
    if (S.job) return false;
    const p = S.player;
    for (const r of this.list) {
      const start = r.checkpoints[0];
      if (Math.hypot(p.x - start.x, p.y - start.y) > 90) continue;
      if (r.nightOnly && !S.DayNight.isNight()) {
        S.notify('"Night Run" only runs at night. Come back after dark.');
        return true;
      }
      if (p.onFoot) {
        S.notify('Races need a car — steal one first (E).');
        return true;
      }
      S.race = { def: r, cp: 1, time: 0, active: true };
      S.notify('Race started: ' + r.name + ' — par ' + r.par + 's. Hit the checkpoints in order!');
      return true;
    }
    return false;
  },

  update(S, dt) {
    const race = S.race;
    if (!race || !race.active) return;
    race.time += dt;
    const p = S.player;
    const next = race.def.checkpoints[race.cp];
    if (next && Math.hypot(p.x - next.x, p.y - next.y) < 70) {
      race.cp += 1;
      if (S.AudioSys) S.AudioSys.pickup();
      if (race.cp >= race.def.checkpoints.length) {
        // finished: last checkpoint is the finish line
        const won = race.time <= race.def.par;
        S.money += RACE_REWARD;
        S.debt = Math.max(0, S.debt - RACE_REWARD);
        S.Stats.add('earned', RACE_REWARD);
        S.Stats.add('races', 1);
        S.notify(
          'Race won: ' + race.def.name + ' in ' + race.time.toFixed(1) + 's' +
          (won ? ' — under par! ' : ' (par ' + race.def.par + 's). ') +
          'Paid $' + RACE_REWARD + '.'
        );
        if (S.AudioSys) S.AudioSys.cash();
        S.race = null;
        return;
      }
    }
    // Give up if it drags on past twice the par time.
    if (race.time > race.def.par * 2) {
      S.notify('Race over: ' + race.def.name + ' — too slow. Come back and try again.');
      S.race = null;
    }
  },

  draw(ctx, S) {
    const race = S.race;
    if (race && race.active) {
      const def = race.def;
      // draw remaining checkpoints; next one highlighted
      for (let i = race.cp; i < def.checkpoints.length; i++) {
        const c = def.checkpoints[i];
        const isNext = i === race.cp;
        drawMarker(ctx, c.x, c.y, isNext ? '#ff9f43' : '#8a94a6',
          isNext ? 'NEXT ' + (i + 1) + '/' + def.checkpoints.length : '' + (i + 1), S.time);
      }
      return;
    }
    if (S.job) return;
    for (const r of this.list) {
      const s = r.checkpoints[0];
      const label = 'F: Race — ' + r.name + ' (par ' + r.par + 's' + (r.nightOnly ? ', night only' : '') + ')';
      drawMarker(ctx, s.x, s.y, '#ff9f43', label, S.time);
    }
  },
};
