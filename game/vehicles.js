// vehicles.js — drivable vehicles for Neon Harbor.
// Types: car (player sedan 64x30), bike (Night Hawk, 1.6x speed), truck (Harbor Hauler).
// Pure physics + drawing; no DOM, no network.

export const VEHICLE_TYPES = {
  car:   { name: 'Sedan',        w: 64, h: 30, top: 380, accel: 320, brake: 520, turn: 3.1, grip: 2.6 },
  bike:  { name: 'Night Hawk',   w: 44, h: 20, top: 608, accel: 460, brake: 600, turn: 4.2, grip: 3.4 },
  truck: { name: 'Harbor Hauler',w: 92, h: 36, top: 300, accel: 210, brake: 420, turn: 2.3, grip: 2.0 },
};

const PAINT = ['#d94f3d', '#3d7bd9', '#e8b23a', '#3dd97e', '#9b59d0', '#e6e6e6', '#2b2f36', '#d97e3d'];

export function paintFor(seed) {
  return PAINT[Math.abs(seed) % PAINT.length];
}

export function makeVehicle(type, x, y, angle = 0, color = null) {
  const t = VEHICLE_TYPES[type] || VEHICLE_TYPES.car;
  return {
    kind: 'vehicle',
    type,
    name: t.name,
    x, y,
    angle,
    speed: 0,
    w: t.w, h: t.h,
    top: t.top, accel: t.accel, brake: t.brake, turn: t.turn, grip: t.grip,
    color: color || paintFor(Math.floor(x + y)),
    parked: false,
    traffic: false,
    police: false,
    driver: false,
    steer: 0,
    hp: 100,
    dead: false,
  };
}

// Drive a vehicle from input flags {up, down, left, right, hand}.
// Returns nothing; mutates v in place. dt in seconds.
export function driveVehicle(v, inp, dt) {
  const fwd = (inp.up ? 1 : 0) - (inp.down ? 1 : 0);
  if (fwd > 0) v.speed += v.accel * dt;
  else if (fwd < 0) {
    if (v.speed > 20) v.speed -= v.brake * dt;      // braking while moving forward
    else v.speed -= v.accel * 0.55 * dt;            // reverse
  } else {
    // drag / rolling resistance
    v.speed -= v.speed * 1.4 * dt;
    if (Math.abs(v.speed) < 4) v.speed = 0;
  }
  if (inp.hand) v.speed -= v.speed * 3.2 * dt;      // handbrake
  const maxRev = -v.top * 0.35;
  if (v.speed > v.top) v.speed = v.top;
  if (v.speed < maxRev) v.speed = maxRev;

  const steerIn = (inp.left ? 1 : 0) - (inp.right ? 1 : 0);
  const steerTarget = steerIn * (v.speed >= 0 ? 1 : -1);
  v.steer += (steerTarget - v.steer) * Math.min(1, dt * 8);
  const spdFactor = Math.min(1, Math.abs(v.speed) / 160);
  v.angle += v.steer * v.turn * spdFactor * dt * (v.speed >= 0 ? 1 : -1);

  // grip: velocity mostly along heading, slight drift
  const nx = v.x + Math.cos(v.angle) * v.speed * dt;
  const ny = v.y + Math.sin(v.angle) * v.speed * dt;
  v.x = nx;
  v.y = ny;
}

// Simple AI driver for traffic cars: follow the road grid, turn at intersections.
export function driveTraffic(v, dt, city) {
  // Traffic cars drive straight along their lane; at an intersection they may turn.
  v.speed += (v.top * 0.45 - v.speed) * Math.min(1, dt * 0.8);
  const ahead = 46;
  const px = v.x + Math.cos(v.angle) * ahead;
  const py = v.y + Math.sin(v.angle) * ahead;
  if (city.nearIntersection(px, py, 30)) {
    // decide a turn once per intersection
    if (!v._turnedAt || Math.hypot(v.x - v._turnedAt.x, v.y - v._turnedAt.y) > 120) {
      const r = city.hash(Math.floor(v.x / 100), Math.floor(v.y / 100));
      const choice = r < 0.55 ? 0 : (r < 0.78 ? 1 : -1); // 0 straight, 1 left, -1 right
      v._turnDir = choice;
      v._turnedAt = { x: v.x, y: v.y };
    }
    if (v._turnDir) v.angle += v._turnDir * 1.5 * dt;
  }
  v.x += Math.cos(v.angle) * v.speed * dt;
  v.y += Math.sin(v.angle) * v.speed * dt;
  // keep inside city
  if (v.x < 60) { v.x = 60; v.angle = 0; }
  if (v.x > city.W - 60) { v.x = city.W - 60; v.angle = Math.PI; }
  if (v.y < 60) { v.y = 60; v.angle = Math.PI / 2; }
  if (v.y > city.H - 60) { v.y = city.H - 60; v.angle = -Math.PI / 2; }
}

export function drawVehicle(ctx, v, isPlayer) {
  ctx.save();
  ctx.translate(v.x, v.y);
  ctx.rotate(v.angle);
  const w = v.w, h = v.h;
  // shadow
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  ctx.fillRect(-w / 2 + 3, -h / 2 + 4, w, h);
  // body
  ctx.fillStyle = v.color;
  roundRect(ctx, -w / 2, -h / 2, w, h, 7);
  ctx.fill();
  // cabin / windshield
  ctx.fillStyle = 'rgba(20,26,34,0.9)';
  if (v.type === 'bike') {
    ctx.fillRect(-6, -h / 2 + 3, 14, h - 6);
  } else {
    roundRect(ctx, -w * 0.18, -h / 2 + 4, w * 0.34, h - 8, 4);
    ctx.fill();
  }
  // headlights
  ctx.fillStyle = '#ffe9a8';
  ctx.fillRect(w / 2 - 3, -h / 2 + 3, 3, 5);
  ctx.fillRect(w / 2 - 3, h / 2 - 8, 3, 5);
  // taillights
  ctx.fillStyle = '#ff3b30';
  ctx.fillRect(-w / 2, -h / 2 + 3, 3, 5);
  ctx.fillRect(-w / 2, h / 2 - 8, 3, 5);
  if (v.police) {
    // light bar
    const on = Math.floor(performance.now() / 180) % 2 === 0;
    ctx.fillStyle = on ? '#ff2d2d' : '#2d7dff';
    ctx.fillRect(-6, -h / 2 - 2, 12, 5);
    ctx.fillStyle = on ? '#2d7dff' : '#ff2d2d';
    ctx.fillRect(-6, h / 2 - 3, 12, 5);
  }
  if (isPlayer) {
    ctx.strokeStyle = '#ffd94d';
    ctx.lineWidth = 2;
    ctx.strokeRect(-w / 2 - 3, -h / 2 - 3, w + 6, h + 6);
  }
  ctx.restore();
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
