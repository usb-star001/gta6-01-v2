// main.js — Neon Harbor: game loop, world, camera, rendering, HUD,
// minimap, menus, police, wanted level, stealing, combat, save/load.
// Canvas + ES modules, no libraries, no network. Entry via startGame().

import { Input } from './input.js';
import { AudioSys } from './audio.js';
import { Stats } from './stats.js';
import { Packages, PACKAGE_VALUE } from './collectibles.js';
import { Eddie } from './missions.js';
import { Rosa } from './sidejobs.js';
import { Races } from './races.js';
import { DayNight } from './daynight.js';
import { makeVehicle, driveVehicle, driveTraffic, drawVehicle, paintFor } from './vehicles.js';

export const CITY = { W: 3600, H: 2800 };
const ROAD_W = 80;
const ROADS_V = [200, 600, 1000, 1400, 1800, 2200, 2600, 3000, 3400];
const ROADS_H = [200, 600, 1000, 1400, 1800, 2200, 2600];
const SAVE_KEY = 'neonharbor-save-v2';
const INTRO_KEY = 'neonharbor-seen-intro';
const START_DEBT = 50000;

// Deterministic 0..1 hash from integer coords.
export function hash(x, y) {
  let h = (x * 374761393 + y * 668265263) ^ 0x5bf03635;
  h = (h ^ (h >> 13)) * 1274126177;
  return ((h ^ (h >> 16)) >>> 0) / 4294967295;
}

const S = {
  mode: 'menu', // 'intro' | 'menu' | 'playing' | 'stats'
  money: 0,
  debt: START_DEBT,
  wanted: 0,
  time: 0,
  eddieDone: 0,
  rosaDone: 0,
  job: null,
  race: null,
  player: { x: 600, y: 600, angle: 0, speed: 0, onFoot: true, car: null, hp: 100 },
  cars: [],
  peds: [],
  bullets: [],
  buildings: [],
  cam: { x: 0, y: 0 },
  shake: 0,
  messages: [],
  crimeT: 0,
  unseen: 0,
  decayT: 0,
  shootT: 0,
  saveT: 0,
  DayNight,
  Stats,
  AudioSys,
  notify(text) {
    S.messages.push({ text, t: 0 });
    if (S.messages.length > 4) S.messages.shift();
  },
};

let canvas, ctx, vw, vh;

export function startGame() {
  canvas = document.getElementById('game');
  if (!canvas) return;
  ctx = canvas.getContext('2d');
  Input.init(canvas);
  AudioSys.init();
  Stats.load();
  resize();
  window.addEventListener('resize', resize);

  buildWorld();
  loadSave();
  Packages.init(S._savedPackages || []);

  // Player start: saved position or the pier.
  if (!S._savedPos) {
    S.player.x = 600; S.player.y = 600;
  }
  // A parked sedan right next to the start so the first steal is obvious.
  const starter = makeVehicle('car', 660, 600, 0, '#d94f3d');
  starter.parked = true;
  S.cars.push(starter);

  const seenIntro = (() => { try { return localStorage.getItem(INTRO_KEY); } catch (e) { return null; } })();
  S.mode = seenIntro ? 'menu' : 'intro';

  requestAnimationFrame(loop);
}

function resize() {
  vw = window.innerWidth;
  vh = window.innerHeight;
  canvas.width = vw;
  canvas.height = vh;
}

// ---------- world ----------

function buildWorld() {
  // Buildings fill the blocks between roads.
  S.buildings = [];
  for (let i = 0; i < ROADS_V.length - 1; i++) {
    for (let j = 0; j < ROADS_H.length - 1; j++) {
      const x0 = ROADS_V[i] + ROAD_W / 2 + 12;
      const x1 = ROADS_V[i + 1] - ROAD_W / 2 - 12;
      const y0 = ROADS_H[j] + ROAD_W / 2 + 12;
      const y1 = ROADS_H[j + 1] - ROAD_W / 2 - 12;
      if (x1 - x0 < 90 || y1 - y0 < 90) continue;
      const h = hash(i * 7 + 1, j * 13 + 2);
      const count = h < 0.45 ? 1 : 2;
      for (let b = 0; b < count; b++) {
        const bh = hash(i * 31 + b, j * 17 + 5);
        const bw = 90 + bh * 110;
        const bht = 70 + hash(i + b * 3, j + b) * 110;
        const bx = x0 + hash(i * 11 + b, j * 3) * Math.max(10, (x1 - x0) - bw);
        const by = y0 + hash(i * 5, j * 7 + b * 2) * Math.max(10, (y1 - y0) - bht);
        const palette = ['#3a4a63', '#4a3a5e', '#2e4a3a', '#5e4632', '#333d4d', '#4d2f33'];
        const color = palette[Math.floor(hash(i * 3 + b, j * 5 + 1) * palette.length)];
        S.buildings.push({ x: bx, y: by, w: bw, h: bht, color, seed: i * 100 + j * 10 + b });
      }
    }
  }
  // Traffic cars on the roads.
  const dirs = [0, Math.PI / 2, Math.PI, -Math.PI / 2];
  for (let i = 0; i < 14; i++) {
    const vertical = hash(i, 3) < 0.5;
    let x, y, angle;
    if (vertical) {
      x = ROADS_V[Math.floor(hash(i, 7) * ROADS_V.length)] + (hash(i, 9) < 0.5 ? -18 : 18);
      y = 200 + hash(i, 11) * 2300;
      angle = hash(i, 13) < 0.5 ? Math.PI / 2 : -Math.PI / 2;
    } else {
      y = ROADS_H[Math.floor(hash(i, 15) * ROADS_H.length)] + (hash(i, 17) < 0.5 ? -18 : 18);
      x = 200 + hash(i, 19) * 3100;
      angle = hash(i, 21) < 0.5 ? 0 : Math.PI;
    }
    const c = makeVehicle('car', x, y, angle, paintFor(i * 7 + 3));
    c.traffic = true;
    c.speed = 120 + hash(i, 23) * 60;
    S.cars.push(c);
  }
  // Parked cars along road edges (stealable).
  const parkedSpots = [
    [600, 660, Math.PI / 2], [1400, 260, 0], [2200, 1060, Math.PI / 2],
    [1000, 1460, 0], [2600, 660, -Math.PI / 2], [1800, 2260, Math.PI],
    [3000, 1460, Math.PI / 2], [3400, 1060, 0],
  ];
  parkedSpots.forEach(([x, y, a], i) => {
    const c = makeVehicle('car', x, y, a, paintFor(i * 5 + 11));
    c.parked = true;
    S.cars.push(c);
  });
  // The special vehicles: Night Hawk bike and Harbor Hauler truck.
  const bike = makeVehicle('bike', 2600, 660, Math.PI / 2, '#ffd94d');
  bike.parked = true;
  S.cars.push(bike);
  const truck = makeVehicle('truck', 3050, 2540, 0, '#4dc3ff');
  truck.parked = true;
  S.cars.push(truck);

  // Pedestrians on the sidewalks.
  for (let i = 0; i < 20; i++) spawnPed(i);
}

function spawnPed(seed) {
  const vertical = hash(seed, 41) < 0.5;
  const off = hash(seed, 43) < 0.5 ? -56 : 56;
  let ped;
  if (vertical) {
    const rx = ROADS_V[Math.floor(hash(seed, 47) * ROADS_V.length)];
    ped = { road: 'v', coord: rx, off, pos: 200 + hash(seed, 53) * 2300, dir: hash(seed, 59) < 0.5 ? 1 : -1 };
  } else {
    const ry = ROADS_H[Math.floor(hash(seed, 61) * ROADS_H.length)];
    ped = { road: 'h', coord: ry, off, pos: 200 + hash(seed, 67) * 3100, dir: hash(seed, 71) < 0.5 ? 1 : -1 };
  }
  const colors = ['#e8b23a', '#3dd97e', '#d94f3d', '#9b59d0', '#e6e6e6', '#4dc3ff'];
  ped.x = 0; ped.y = 0;
  ped.speed = 42 + hash(seed, 73) * 30;
  ped.color = colors[Math.floor(hash(seed, 79) * colors.length)];
  ped.dead = false; ped.deadT = 0;
  syncPedPos(ped);
  S.peds.push(ped);
}

function syncPedPos(ped) {
  if (ped.road === 'v') { ped.x = ped.coord + ped.off; ped.y = ped.pos; }
  else { ped.x = ped.pos; ped.y = ped.coord + ped.off; }
}

function cityAPI() {
  return {
    W: CITY.W, H: CITY.H,
    hash,
    nearIntersection(x, y, r) {
      for (const rx of ROADS_V) for (const ry of ROADS_H) {
        if (Math.hypot(x - rx, y - ry) < r) return true;
      }
      return false;
    },
  };
}

function pointInBuildings(x, y, pad) {
  for (const b of S.buildings) {
    if (x > b.x - pad && x < b.x + b.w + pad && y > b.y - pad && y < b.y + b.h + pad) return b;
  }
  return null;
}

// Push a circle (x, y, r) out of buildings; returns corrected {x, y}.
function collideBuildings(x, y, r) {
  for (const b of S.buildings) {
    const cx = Math.max(b.x, Math.min(x, b.x + b.w));
    const cy = Math.max(b.y, Math.min(y, b.y + b.h));
    const dx = x - cx, dy = y - cy;
    const d = Math.hypot(dx, dy);
    if (d < r) {
      if (d < 0.01) { x = b.x + b.w + r; continue; }
      const push = (r - d) / d;
      x += dx * push;
      y += dy * push;
    }
  }
  return { x, y };
}

// ---------- save / load ----------

function saveGame() {
  try {
    const data = {
      money: S.money, debt: S.debt,
      eddieDone: S.eddieDone, rosaDone: S.rosaDone,
      packages: Packages.list.filter(p => p.taken).map(p => p.id),
      px: Math.round(S.player.x), py: Math.round(S.player.y),
      dayT: DayNight.t,
    };
    localStorage.setItem(SAVE_KEY, JSON.stringify(data));
  } catch (e) { /* storage unavailable */ }
}

function loadSave() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return;
    const d = JSON.parse(raw);
    S.money = d.money || 0;
    S.debt = d.debt != null ? d.debt : START_DEBT;
    S.eddieDone = d.eddieDone || 0;
    S.rosaDone = d.rosaDone || 0;
    S._savedPackages = d.packages || [];
    S._savedPos = (d.px != null) ? { x: d.px, y: d.py } : null;
    if (S._savedPos) { S.player.x = d.px; S.player.y = d.py; }
    if (d.dayT != null) DayNight.t = d.dayT;
  } catch (e) { /* ignore corrupt save */ }
}

// ---------- crimes / wanted ----------

function addWanted(n) {
  if (S.crimeT > 0) return;
  S.wanted = Math.min(5, S.wanted + n);
  S.crimeT = 2;
  AudioSys.setWanted(S.wanted);
  if (S.wanted >= 3) S.notify('Wanted level ' + S.wanted + ' — the whole city is looking for you.');
}

function updatePolice(dt) {
  const want = Math.min(S.wanted, 4);
  const police = S.cars.filter(c => c.police);
  if (S.wanted === 0) {
    if (police.length) {
      S.cars = S.cars.filter(c => !c.police);
      S.notify('You lost them. The heat is off — for now.');
    }
    return;
  }
  // Spawn up to the wanted count.
  if (police.length < want) {
    const a = Math.random() * Math.PI * 2;
    const d = 750;
    let x = S.player.x + Math.cos(a) * d;
    let y = S.player.y + Math.sin(a) * d;
    x = Math.max(120, Math.min(CITY.W - 120, x));
    y = Math.max(120, Math.min(CITY.H - 120, y));
    const pc = makeVehicle('car', x, y, 0, '#20242c');
    pc.police = true;
    pc.top = 430;
    pc.speed = 200;
    S.cars.push(pc);
  }
  // Chase the player.
  for (const pc of S.cars.filter(c => c.police)) {
    const dx = S.player.x - pc.x, dy = S.player.y - pc.y;
    const dist = Math.hypot(dx, dy) || 1;
    const wantAngle = Math.atan2(dy, dx);
    let diff = wantAngle - pc.angle;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    pc.angle += Math.max(-2.6 * dt, Math.min(2.6 * dt, diff));
    pc.speed += (pc.top * 0.92 - pc.speed) * Math.min(1, dt * 1.2);
    pc.x += Math.cos(pc.angle) * pc.speed * dt;
    pc.y += Math.sin(pc.angle) * pc.speed * dt;
    const fixed = collideBuildings(pc.x, pc.y, 26);
    pc.x = fixed.x; pc.y = fixed.y;
    // Ram the player's car.
    if (!S.player.onFoot && dist < 62) {
      const pc2 = S.player.car;
      if (pc2) {
        pc2.speed *= 0.55;
        pc2.x += Math.cos(pc.angle) * 26;
        pc2.y += Math.sin(pc.angle) * 26;
      }
      S.shake = 9;
      AudioSys.crash();
      pc.speed *= 0.4;
    }
  }
  // Wanted decays when no police can see the player.
  const near = S.cars.some(c => c.police && Math.hypot(c.x - S.player.x, c.y - S.player.y) < 700);
  if (!near) {
    S.unseen += dt;
    if (S.unseen > 8) {
      S.decayT += dt;
      if (S.decayT > 4) {
        S.decayT = 0;
        S.wanted = Math.max(0, S.wanted - 1);
        AudioSys.setWanted(S.wanted);
        if (S.wanted > 0) S.notify('Heat dying down… wanted level ' + S.wanted + '.');
      }
    }
  } else {
    S.unseen = 0;
    S.decayT = 0;
  }
}

// ---------- player ----------

function nearestCar(maxD) {
  let best = null, bd = maxD;
  for (const c of S.cars) {
    if (c.police || c.dead) continue;
    const d = Math.hypot(c.x - S.player.x, c.y - S.player.y);
    if (d < bd) { bd = d; best = c; }
  }
  return best;
}

function enterCar(car) {
  const p = S.player;
  p.car = car;
  p.onFoot = false;
  car.driver = true;
  if (car.parked || car.traffic) {
    car.parked = false;
    car.traffic = false;
    addWanted(1);
    Stats.add('carsStolen', 1);
    S.notify('Stole a ' + car.name + ' — the law noticed. (+1 wanted)');
    AudioSys.crash();
  } else {
    S.notify('Back in the ' + car.name + '.');
  }
}

function exitCar() {
  const p = S.player;
  const car = p.car;
  if (!car) return;
  car.driver = false;
  car.speed *= 0.3;
  p.onFoot = true;
  p.x = car.x - Math.sin(car.angle) * 46;
  p.y = car.y + Math.cos(car.angle) * 46;
  p.angle = car.angle;
  p.car = null;
}

function updatePlayer(dt) {
  const p = S.player;
  const inp = Input.drive();

  if (Input.take('KeyE')) {
    if (p.onFoot) {
      const car = nearestCar(85);
      if (car) enterCar(car);
      else S.notify('No car close enough to steal.');
    } else {
      exitCar();
    }
  }
  if (Input.take('KeyH')) {
    S.mode = 'stats';
    return;
  }
  if (Input.take('KeyF')) {
    if (Races.tryStart(S)) return;
    if (Eddie.tryStart(S)) return;
    if (Rosa.tryStart(S)) return;
    if (Rosa.tryGig(S)) return;
    if (Rosa.tryFare(S)) return;
  }

  if (p.onFoot) {
    const mv = Input.walk();
    const mx = (mv.right ? 1 : 0) - (mv.left ? 1 : 0);
    const my = (mv.down ? 1 : 0) - (mv.up ? 1 : 0);
    if (mx || my) {
      const len = Math.hypot(mx, my);
      p.x += (mx / len) * 185 * dt;
      p.y += (my / len) * 185 * dt;
      p.angle = Math.atan2(my, mx);
    }
    const fixed = collideBuildings(p.x, p.y, 14);
    p.x = fixed.x; p.y = fixed.y;
    p.x = Math.max(20, Math.min(CITY.W - 20, p.x));
    p.y = Math.max(20, Math.min(CITY.H - 20, p.y));
    // Aim + shoot on foot.
    const wm = Input.worldMouse(S.cam);
    p.aim = Math.atan2(wm.y - p.y, wm.x - p.x);
    S.shootT -= dt;
    if (Input.mouse.clicked && S.shootT <= 0) {
      S.shootT = 0.25;
      S.bullets.push({ x: p.x + Math.cos(p.aim) * 20, y: p.y + Math.sin(p.aim) * 20, angle: p.aim, speed: 920, life: 1.0 });
      AudioSys.shoot();
      Stats.add('shots', 1);
      addWanted(1);
    }
    p.speed = 0;
  } else {
    const car = p.car;
    driveVehicle(car, inp, dt);
    const fixed = collideBuildings(car.x, car.y, 26);
    if (fixed.x !== car.x || fixed.y !== car.y) {
      if (Math.abs(car.speed) > 120) { AudioSys.crash(); S.shake = 6; }
      car.speed *= 0.5;
    }
    car.x = fixed.x; car.y = fixed.y;
    car.x = Math.max(40, Math.min(CITY.W - 40, car.x));
    car.y = Math.max(40, Math.min(CITY.H - 40, car.y));
    p.x = car.x; p.y = car.y; p.angle = car.angle; p.speed = car.speed;
    // Running over a pedestrian is a crime.
    for (const ped of S.peds) {
      if (ped.dead) continue;
      if (Math.hypot(ped.x - p.x, ped.y - p.y) < 34 && Math.abs(car.speed) > 60) {
        ped.dead = true; ped.deadT = 0;
        addWanted(1);
        AudioSys.crash();
        S.shake = 8;
        S.notify('You hit a pedestrian. That was seen. (+1 wanted)');
      }
    }
  }
  AudioSys.setSpeed(p.onFoot ? 0 : p.speed);
}

function updateBullets(dt) {
  for (const b of S.bullets) {
    b.x += Math.cos(b.angle) * b.speed * dt;
    b.y += Math.sin(b.angle) * b.speed * dt;
    b.life -= dt;
    if (pointInBuildings(b.x, b.y, 0)) b.life = 0;
    for (const ped of S.peds) {
      if (ped.dead) continue;
      if (Math.hypot(ped.x - b.x, ped.y - b.y) < 16) {
        ped.dead = true; ped.deadT = 0;
        b.life = 0;
        addWanted(1);
        AudioSys.hit();
        S.notify('Shot fired at a pedestrian. (+1 wanted)');
      }
    }
    for (const c of S.cars) {
      if (c === S.player.car || c.dead) continue;
      if (Math.hypot(c.x - b.x, c.y - b.y) < 34) {
        c.hp -= 25;
        b.life = 0;
        AudioSys.hit();
        if (c.hp <= 0) { c.dead = true; c.traffic = false; }
      }
    }
  }
  S.bullets = S.bullets.filter(b => b.life > 0);
}

function updateTraffic(dt) {
  const city = cityAPI();
  for (const c of S.cars) {
    if (c.traffic && !c.dead) {
      driveTraffic(c, dt, city);
      const fixed = collideBuildings(c.x, c.y, 26);
      c.x = fixed.x; c.y = fixed.y;
    }
  }
  // Car vs car: simple push-apart so traffic does not pile up.
  const list = S.cars.filter(c => !c.dead);
  for (let i = 0; i < list.length; i++) {
    for (let j = i + 1; j < list.length; j++) {
      const a = list[i], b = list[j];
      const dx = b.x - a.x, dy = b.y - a.y;
      const d = Math.hypot(dx, dy);
      const min = 44;
      if (d > 0.01 && d < min) {
        const push = (min - d) / 2 / d;
        a.x -= dx * push; a.y -= dy * push;
        b.x += dx * push; b.y += dy * push;
      }
    }
  }
}

function updatePeds(dt) {
  for (const ped of S.peds) {
    if (ped.dead) {
      ped.deadT += dt;
      if (ped.deadT > 8) {
        // respawn fresh on a new sidewalk
        const i = S.peds.indexOf(ped);
        S.peds.splice(i, 1);
        spawnPed(Math.floor(Math.random() * 10000));
      }
      continue;
    }
    ped.pos += ped.dir * ped.speed * dt;
    const maxPos = ped.road === 'v' ? CITY.H - 120 : CITY.W - 120;
    if (ped.pos < 120 || ped.pos > maxPos) ped.dir *= -1;
    // At an intersection, sometimes turn onto the cross street.
    const cross = ped.road === 'v' ? ROADS_H : ROADS_V;
    for (const c of cross) {
      if (Math.abs(ped.pos - c) < 24 && Math.random() < 0.004) {
        ped.road = ped.road === 'v' ? 'h' : 'v';
        ped.coord = c;
        ped.pos = ped.road === 'v' ? ped.y : ped.x;
        ped.off = Math.random() < 0.5 ? -56 : 56;
        ped.dir = Math.random() < 0.5 ? 1 : -1;
        break;
      }
    }
    syncPedPos(ped);
  }
}

function update(dt) {
  S.time += dt;
  S.crimeT = Math.max(0, S.crimeT - dt);
  DayNight.update(dt);
  AudioSys.update(dt);
  updatePlayer(dt);
  updateTraffic(dt);
  updatePeds(dt);
  updateBullets(dt);
  updatePolice(dt);
  Eddie.update(S, dt);
  Rosa.update(S, dt);
  Races.update(S, dt);

  // Packages
  const got = Packages.update(S.player.x, S.player.y);
  if (got) {
    S.money += PACKAGE_VALUE;
    S.debt = Math.max(0, S.debt - PACKAGE_VALUE);
    Stats.add('earned', PACKAGE_VALUE);
    Stats.add('packages', 1);
    S.notify('Hidden package found! +$' + PACKAGE_VALUE + ' (' + Packages.found() + '/12).');
    AudioSys.pickup();
  }

  // Camera follows the player.
  S.cam.x = Math.max(0, Math.min(CITY.W - vw, S.player.x - vw / 2));
  S.cam.y = Math.max(0, Math.min(CITY.H - vh, S.player.y - vh / 2));
  if (S.shake > 0) S.shake = Math.max(0, S.shake - dt * 22);

  // Messages age out.
  for (const m of S.messages) m.t += dt;
  S.messages = S.messages.filter(m => m.t < 5);

  // Periodic save.
  S.saveT += dt;
  if (S.saveT > 10) { S.saveT = 0; saveGame(); }

  // Debt paid off?
  if (S.debt <= 0 && !S._debtPaid) {
    S._debtPaid = true;
    S.notify('DEBT PAID. $50,000 settled — Port Azure is yours, Mara.');
  }
}

// ---------- rendering ----------

function drawWorld() {
  // Ground
  ctx.fillStyle = '#171d26';
  ctx.fillRect(S.cam.x, S.cam.y, vw, vh);
  // City blocks
  ctx.fillStyle = '#202835';
  for (let i = 0; i < ROADS_V.length - 1; i++) {
    for (let j = 0; j < ROADS_H.length - 1; j++) {
      ctx.fillRect(ROADS_V[i] + ROAD_W / 2, ROADS_H[j] + ROAD_W / 2,
        ROADS_V[i + 1] - ROADS_V[i] - ROAD_W, ROADS_H[j + 1] - ROADS_H[j] - ROAD_W);
    }
  }
  // Roads
  ctx.fillStyle = '#2e343d';
  for (const x of ROADS_V) ctx.fillRect(x - ROAD_W / 2, 0, ROAD_W, CITY.H);
  for (const y of ROADS_H) ctx.fillRect(0, y - ROAD_W / 2, CITY.W, ROAD_W);
  // Center dashes
  ctx.fillStyle = '#c8a23a';
  for (const x of ROADS_V) {
    for (let y = 0; y < CITY.H; y += 64) ctx.fillRect(x - 2, y, 4, 30);
  }
  for (const y of ROADS_H) {
    for (let x = 0; x < CITY.W; x += 64) ctx.fillRect(x, y - 2, 30, 4);
  }
  // Harbor water along the south edge
  ctx.fillStyle = '#0e3a5c';
  ctx.fillRect(0, 2700, CITY.W, 100);
  ctx.fillStyle = '#155a8a';
  for (let x = 80; x < CITY.W; x += 260) ctx.fillRect(x, 2724, 180, 10);
  ctx.fillStyle = '#6b4a2f';
  ctx.fillRect(0, 2688, CITY.W, 12); // dock edge
  // Buildings
  for (const b of S.buildings) {
    ctx.fillStyle = b.color;
    ctx.fillRect(b.x, b.y, b.w, b.h);
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.fillRect(b.x + 6, b.y + 6, b.w - 12, b.h - 12);
    ctx.fillStyle = 'rgba(255,220,120,0.5)';
    const cols = Math.max(1, Math.floor(b.w / 34));
    const rows = Math.max(1, Math.floor(b.h / 30));
    for (let cx = 0; cx < cols; cx++) {
      for (let cy = 0; cy < rows; cy++) {
        if (hash(b.seed + cx, b.seed + cy * 7) < 0.45) {
          ctx.fillRect(b.x + 12 + cx * 34, b.y + 12 + cy * 30, 14, 10);
        }
      }
    }
  }
  Packages.draw(ctx, S.time);
  Eddie.draw(ctx, S);
  Rosa.draw(ctx, S);
  Races.draw(ctx, S);
  // Peds
  for (const ped of S.peds) {
    if (ped.dead) {
      ctx.fillStyle = '#5a2a2a';
      ctx.beginPath(); ctx.arc(ped.x, ped.y, 9, 0, Math.PI * 2); ctx.fill();
      continue;
    }
    ctx.fillStyle = ped.color;
    ctx.beginPath(); ctx.arc(ped.x, ped.y, 7, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.beginPath(); ctx.arc(ped.x, ped.y, 3, 0, Math.PI * 2); ctx.fill();
  }
  // Cars
  for (const c of S.cars) {
    if (c.dead) {
      ctx.save();
      ctx.translate(c.x, c.y); ctx.rotate(c.angle);
      ctx.fillStyle = '#3a3a3a';
      ctx.fillRect(-c.w / 2, -c.h / 2, c.w, c.h);
      ctx.restore();
      continue;
    }
    drawVehicle(ctx, c, c === S.player.car);
  }
  // Player on foot
  const p = S.player;
  if (p.onFoot) {
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(p.aim || 0);
    ctx.fillStyle = '#ffd94d';
    ctx.beginPath(); ctx.arc(0, 0, 10, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#20242c';
    ctx.fillRect(6, -3, 12, 6); // pistol
    ctx.restore();
    // aim reticle at the mouse
    const wm = Input.worldMouse(S.cam);
    ctx.strokeStyle = 'rgba(255,217,77,0.9)';
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(wm.x, wm.y, 10, 0, Math.PI * 2); ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(wm.x - 14, wm.y); ctx.lineTo(wm.x - 6, wm.y);
    ctx.moveTo(wm.x + 6, wm.y); ctx.lineTo(wm.x + 14, wm.y);
    ctx.moveTo(wm.x, wm.y - 14); ctx.lineTo(wm.x, wm.y - 6);
    ctx.moveTo(wm.x, wm.y + 6); ctx.lineTo(wm.x, wm.y + 14);
    ctx.stroke();
  }
  // Bullets
  ctx.fillStyle = '#ffe9a8';
  for (const b of S.bullets) {
    ctx.beginPath(); ctx.arc(b.x, b.y, 3, 0, Math.PI * 2); ctx.fill();
  }
}

function drawMinimap() {
  const mw = 190, mh = 148;
  const mx = vw - mw - 14, my = 14;
  const sx = mw / CITY.W, sy = mh / CITY.H;
  ctx.fillStyle = 'rgba(8,12,20,0.85)';
  ctx.fillRect(mx, my, mw, mh);
  ctx.strokeStyle = '#3a4a63';
  ctx.lineWidth = 1;
  ctx.strokeRect(mx, my, mw, mh);
  ctx.strokeStyle = '#5a6a80';
  for (const x of ROADS_V) { ctx.beginPath(); ctx.moveTo(mx + x * sx, my); ctx.lineTo(mx + x * sx, my + mh); ctx.stroke(); }
  for (const y of ROADS_H) { ctx.beginPath(); ctx.moveTo(mx, my + y * sy); ctx.lineTo(mx + mw, my + y * sy); ctx.stroke(); }
  ctx.fillStyle = '#0e3a5c';
  ctx.fillRect(mx, my + 2700 * sy, mw, 100 * sy);
  const dot = (x, y, color, r) => {
    ctx.fillStyle = color;
    ctx.beginPath(); ctx.arc(mx + x * sx, my + y * sy, r, 0, Math.PI * 2); ctx.fill();
  };
  for (const pk of Packages.list) if (!pk.taken) dot(pk.x, pk.y, '#b678ff', 2.5);
  if (S.job) dot(S.job.drop.x, S.job.drop.y, '#3dd97e', 4);
  if (S.race && S.race.active) {
    const n = S.race.def.checkpoints[S.race.cp];
    if (n) dot(n.x, n.y, '#ff9f43', 4);
  }
  for (const c of S.cars) if (c.police) dot(c.x, c.y, '#ff2d2d', 3);
  dot(S.player.x, S.player.y, '#ffd94d', 4);
  // wanted stars under the minimap
  const sy0 = my + mh + 8;
  ctx.font = 'bold 20px sans-serif';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  for (let i = 0; i < 5; i++) {
    ctx.fillStyle = i < S.wanted ? '#ff2d2d' : 'rgba(255,255,255,0.25)';
    ctx.fillText('★', mx + i * 24, sy0);
  }
  ctx.fillStyle = '#9fb3c8';
  ctx.font = '12px sans-serif';
  ctx.fillText(DayNight.label() + '  •  ' + AudioSys.loopNameNow(), mx, sy0 + 26);
}

function drawHUD() {
  // Money / debt
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillStyle = 'rgba(8,12,20,0.7)';
  ctx.fillRect(12, 12, 250, 62);
  ctx.fillStyle = '#ffd94d';
  ctx.font = 'bold 22px sans-serif';
  ctx.fillText('$' + S.money, 22, 20);
  ctx.fillStyle = S.debt <= 0 ? '#3dd97e' : '#ff8a7a';
  ctx.font = '14px sans-serif';
  ctx.fillText(S.debt <= 0 ? 'DEBT PAID — Port Azure is yours' : 'Syndicate debt: $' + S.debt, 22, 48);
  // Speed + vehicle
  ctx.fillStyle = 'rgba(8,12,20,0.7)';
  ctx.fillRect(12, vh - 58, 210, 46);
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 20px sans-serif';
  const spd = S.player.onFoot ? 0 : Math.abs(Math.round(S.player.speed * 0.12));
  ctx.fillText(spd + ' mph', 22, vh - 50);
  ctx.fillStyle = '#9fb3c8';
  ctx.font = '13px sans-serif';
  ctx.fillText(S.player.onFoot ? 'On foot' : (S.player.car ? S.player.car.name : 'Driving'), 22, vh - 26);
  // Active job / race line
  let line = '';
  if (S.race && S.race.active) {
    line = 'Race: ' + S.race.def.name + ' — ' + S.race.time.toFixed(1) + 's (par ' + S.race.def.par + 's)';
  } else if (S.job) {
    line = S.job.name + ' — deliver to (' + S.job.drop.x + ', ' + S.job.drop.y + ')  $' + S.job.reward;
    if (S.job.kind === 'tail') line = 'The Tail — stay close (' + Math.ceil(S.job.need - S.job.follow) + 's left)';
  } else if (S.eddieDone < 3) {
    line = 'Eddie has work — find the yellow marker. (F to start)';
  } else if (S.rosaDone < 3) {
    line = 'Rosa has work — find the purple marker. (F to start)';
  }
  if (line) {
    ctx.font = 'bold 15px sans-serif';
    const w = ctx.measureText(line).width;
    ctx.fillStyle = 'rgba(8,12,20,0.7)';
    ctx.fillRect(vw / 2 - w / 2 - 12, 12, w + 24, 28);
    ctx.fillStyle = '#fff';
    ctx.textAlign = 'center';
    ctx.fillText(line, vw / 2, 18);
  }
  // Messages
  ctx.textAlign = 'center';
  ctx.font = '14px sans-serif';
  let my = 52;
  for (const m of S.messages) {
    ctx.globalAlpha = Math.max(0, 1 - Math.max(0, m.t - 3.5) / 1.5);
    ctx.fillStyle = '#fff';
    ctx.strokeStyle = 'rgba(0,0,0,0.8)';
    ctx.lineWidth = 3;
    ctx.strokeText(m.text, vw / 2, my);
    ctx.fillText(m.text, vw / 2, my);
    my += 20;
  }
  ctx.globalAlpha = 1;
  // Context hint
  let hint = '';
  if (S.player.onFoot) {
    const car = nearestCar(85);
    if (car) hint = 'E — Steal the ' + car.name;
    else hint = 'WASD walk  •  E steal a car  •  Click to shoot  •  H records';
  } else {
    hint = 'WASD drive  •  Space handbrake  •  E get out  •  F job / race  •  H records';
  }
  ctx.font = '13px sans-serif';
  ctx.fillStyle = '#c8d3e0';
  ctx.fillText(hint, vw / 2, vh - 18);
  drawMinimap();
}

function drawMenu() {
  ctx.fillStyle = 'rgba(6,10,20,0.82)';
  ctx.fillRect(0, 0, vw, vh);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffd94d';
  ctx.font = 'bold 64px sans-serif';
  ctx.fillText('NEON HARBOR', vw / 2, vh / 2 - 150);
  ctx.fillStyle = '#4dc3ff';
  ctx.font = '20px sans-serif';
  ctx.fillText('Port Azure — Mara Voss owes the harbour syndicate $' + S.debt + '.', vw / 2, vh / 2 - 100);
  ctx.fillStyle = '#e6e6e6';
  ctx.font = '16px sans-serif';
  const lines = [
    'WASD / Arrows — drive or walk      E — steal / enter a car (E again to get out)',
    'Space — handbrake      Mouse — aim, Click — shoot (on foot)',
    'F — start a job or race at a marker      H — Mara\'s Record (stats)',
    '',
    'Eddie Kline has three jobs. Rosa the Broker has three more — plus gigs and fares.',
    'Three street races, twelve hidden packages, and the Night Hawk bike and Harbor Hauler truck.',
    'Pay the $50,000 back. Don\'t let the cops take you in.',
  ];
  let y = vh / 2 - 60;
  for (const l of lines) { ctx.fillText(l, vw / 2, y); y += 26; }
  ctx.fillStyle = '#ffd94d';
  ctx.font = 'bold 22px sans-serif';
  const blink = Math.floor(S.time * 2) % 2 === 0;
  if (blink) ctx.fillText('Press ENTER or click to start', vw / 2, vh / 2 + 130);
}

function drawIntro() {
  ctx.fillStyle = 'rgba(6,10,20,0.9)';
  ctx.fillRect(0, 0, vw, vh);
  const pw = Math.min(640, vw - 60);
  const px = (vw - pw) / 2;
  const py = Math.max(40, vh / 2 - 210);
  ctx.fillStyle = '#101828';
  ctx.strokeStyle = '#ffd94d';
  ctx.lineWidth = 2;
  ctx.fillRect(px, py, pw, 380);
  ctx.strokeRect(px, py, pw, 380);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffd94d';
  ctx.font = 'bold 30px sans-serif';
  ctx.fillText('NEON HARBOR', vw / 2, py + 28);
  ctx.fillStyle = '#e6e6e6';
  ctx.font = '16px sans-serif';
  const story = [
    'Mara Voss came back to Port Azure with nothing',
    'but a busted sedan and a name the harbour',
    'syndicate remembers.',
    '',
    'She owes them $50,000. They don\'t send letters.',
    'They send men.',
    '',
    'Eddie Kline has work. Rosa the Broker has more.',
    'Drive. Deliver. Don\'t get caught.',
    'Pay it all back — or Port Azure keeps you.',
  ];
  let y = py + 78;
  for (const l of story) { ctx.fillText(l, vw / 2, y); y += 24; }
  ctx.fillStyle = '#ffd94d';
  ctx.font = 'bold 18px sans-serif';
  if (Math.floor(S.time * 2) % 2 === 0) ctx.fillText('Press ENTER or click to continue', vw / 2, py + 340);
}

function render() {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = '#0a0e14';
  ctx.fillRect(0, 0, vw, vh);
  const shx = S.shake ? (Math.random() - 0.5) * S.shake : 0;
  const shy = S.shake ? (Math.random() - 0.5) * S.shake : 0;
  ctx.save();
  ctx.translate(-S.cam.x + shx, -S.cam.y + shy);
  drawWorld();
  ctx.restore();
  DayNight.drawOverlay(ctx, vw, vh);
  if (S.mode === 'playing') drawHUD();
  else if (S.mode === 'menu') { drawHUD(); drawMenu(); }
  else if (S.mode === 'intro') drawIntro();
  else if (S.mode === 'stats') { drawHUD(); Stats.draw(ctx, vw, vh, S.debt); }
}

let lastT = 0;
function loop(t) {
  const now = t / 1000;
  let dt = Math.min(0.05, now - (lastT || now));
  lastT = now;
  if (S.mode === 'playing') {
    update(dt);
  } else {
    S.time += dt;
    DayNight.update(dt * 0.2); // slow drift behind menus
  }
  render();
  // Menu / intro input
  if (S.mode === 'intro') {
    if (Input.take('Enter') || Input.mouse.clicked) {
      try { localStorage.setItem(INTRO_KEY, '1'); } catch (e) { /* ignore */ }
      S.mode = 'menu';
      AudioSys.resume();
    }
  } else if (S.mode === 'menu') {
    if (Input.take('Enter') || Input.mouse.clicked) {
      S.mode = 'playing';
      AudioSys.start();
      S.notify('Mara Voss — Port Azure. Debt $' + S.debt + '. Find Eddie (yellow marker).');
    }
  } else if (S.mode === 'stats') {
    if (Input.take('KeyH') || Input.take('Escape') || Input.take('Enter')) {
      S.mode = 'playing';
    }
  }
  Input.endFrame();
  requestAnimationFrame(loop);
}
