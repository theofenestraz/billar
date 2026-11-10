// Simulacion de billar sobre el plano de la mesa.
// Solo usa + - * / y Math.sqrt para que el resultado sea identico en cualquier dispositivo.

import { R, G, MU_SLIDE, MU_ROLL, DT, V_REST } from './constants.js';

const SLIP_EPS = 1e-4; // por debajo de este deslizamiento la bola rueda
const K_SLIDE = (5 * MU_SLIDE * G) / (2 * R); // aceleracion angular al deslizar
const WY_DECAY = 10; // rad/s^2, frenado del giro vertical

export function makeBall(id, x, z) {
  return { id, x, z, vx: 0, vz: 0, wx: 0, wy: 0, wz: 0, pocketed: false };
}

function stopBall(b) {
  b.vx = 0;
  b.vz = 0;
  b.wx = 0;
  b.wz = 0;
}

// Friccion con el tapete durante un paso DT.
// Velocidad del punto de contacto: u = (vx + R*wz, vz - R*wx).
function applyFriction(b) {
  const ux = b.vx + R * b.wz;
  const uz = b.vz - R * b.wx;
  const u = Math.sqrt(ux * ux + uz * uz);
  if (u > SLIP_EPS) {
    // Deslizando. El deslizamiento baja a razon de 3,5 * mu * g.
    const du = 3.5 * MU_SLIDE * G * DT;
    const nx = ux / u;
    const nz = uz / u;
    if (du >= u) {
      const a = MU_SLIDE * G * DT * (u / du);
      b.vx -= a * nx;
      b.vz -= a * nz;
      b.wz = -b.vx / R;
      b.wx = b.vz / R;
    } else {
      const a = MU_SLIDE * G * DT;
      b.vx -= a * nx;
      b.vz -= a * nz;
      b.wx += K_SLIDE * DT * nz;
      b.wz -= K_SLIDE * DT * nx;
    }
  } else {
    // Rodando.
    const v = Math.sqrt(b.vx * b.vx + b.vz * b.vz);
    const a = MU_ROLL * G * DT;
    if (v <= V_REST || a >= v) {
      stopBall(b);
    } else {
      const s = (v - a) / v;
      b.vx *= s;
      b.vz *= s;
      b.wz = -b.vx / R;
      b.wx = b.vz / R;
    }
  }
  if (b.wy !== 0) {
    const d = WY_DECAY * DT;
    if (b.wy > d) b.wy -= d;
    else if (b.wy < -d) b.wy += d;
    else b.wy = 0;
  }
}

// Avanza una bola un paso DT sin colisiones.
export function stepFree(b) {
  b.x += b.vx * DT;
  b.z += b.vz * DT;
  applyFriction(b);
}

function isMoving(b) {
  return b.vx !== 0 || b.vz !== 0 || b.wx !== 0 || b.wz !== 0;
}

export function isAtRest(state) {
  const balls = state.balls;
  for (let i = 0; i < balls.length; i++) {
    if (!balls[i].pocketed && isMoving(balls[i])) return false;
  }
  return true;
}

// ---------- Colisiones ----------

import { E_BALL, E_CUSHION, HALF_W, HALF_L, MAX_STEPS, MU_CUSHION, MAX_TIP_OFFSET } from './constants.js';
import { POCKETS, CUSHIONS } from './table.js';

const MAX_HITS_PER_STEP = 64;
const OUT_MARGIN = 0.085; // mas alla de esto la bola se da por embocada
const D2 = 4 * R * R;

// Tiempo hasta que dos bolas se tocan, o -1 si no ocurre dentro de tMax.
export function toiBallBall(a, b, tMax) {
  const px = b.x - a.x;
  const pz = b.z - a.z;
  const vx = b.vx - a.vx;
  const vz = b.vz - a.vz;
  const bq = px * vx + pz * vz;
  if (bq >= 0) return -1; // no se acercan
  const c = px * px + pz * pz - D2;
  if (c <= 0) return 0; // ya en contacto y acercandose
  const aq = vx * vx + vz * vz;
  const disc = bq * bq - aq * c;
  if (disc < 0) return -1;
  const t = (-bq - Math.sqrt(disc)) / aq;
  return t <= tMax ? t : -1;
}

// Tiempo hasta que una bola toca un punto fijo, o -1.
export function toiBallPoint(b, ex, ez, tMax) {
  const px = b.x - ex;
  const pz = b.z - ez;
  const bq = px * b.vx + pz * b.vz;
  if (bq >= 0) return -1;
  const c = px * px + pz * pz - R * R;
  if (c <= 0) return 0;
  const aq = b.vx * b.vx + b.vz * b.vz;
  const disc = bq * bq - aq * c;
  if (disc < 0) return -1;
  const t = (-bq - Math.sqrt(disc)) / aq;
  return t <= tMax ? t : -1;
}

// Tiempo hasta que una bola toca el interior de un segmento de banda, o -1.
export function toiBallSegment(b, c, tMax) {
  const d = (b.x - c.x1) * c.nx + (b.z - c.z1) * c.nz;
  const vn = b.vx * c.nx + b.vz * c.nz;
  let t;
  if (d >= 0) {
    if (vn >= 0) return -1;
    t = d <= R ? 0 : (d - R) / -vn;
  } else {
    if (vn <= 0) return -1;
    t = -d <= R ? 0 : (-d - R) / vn;
  }
  if (t > tMax) return -1;
  // El punto de contacto debe caer dentro del segmento.
  const s = (b.x + b.vx * t - c.x1) * c.tx + (b.z + b.vz * t - c.z1) * c.tz;
  if (s < 0 || s > c.len) return -1;
  return t;
}

function bounceOff(b, nx, nz, events) {
  const vn = b.vx * nx + b.vz * nz;
  if (vn >= 0) return;
  const k = (1 + E_CUSHION) * vn;
  b.vx -= k * nx;
  b.vz -= k * nz;
  if (b.wy !== 0) {
    // Efecto lateral: la banda agarra la bola y la desvia a lo largo de la tangente (-nz, nx).
    // El punto de contacto se mueve a R * wy por el giro; el roce lo frena y consume parte del efecto.
    const u = R * b.wy;
    const grip = MU_CUSHION * -k;
    const full = (2 / 7) * (u < 0 ? -u : u);
    const mag = grip < full ? grip : full;
    const f = u > 0 ? -mag : mag;
    b.vx += f * -nz;
    b.vz += f * nx;
    b.wy += (2.5 * f) / R;
  }
  events.push({ type: 'cushion', ball: b.id, speed: -vn });
}

function pocketBall(b, pocketId, events) {
  // La velocidad de entrada viaja en el suceso: la usan el sonido y la animacion de la caida.
  const vx = b.vx;
  const vz = b.vz;
  b.pocketed = true;
  stopBall(b);
  b.wy = 0;
  events.push({ type: 'pocket', ball: b.id, pocket: pocketId, x: b.x, z: b.z, vx, vz });
}

function checkPockets(balls, events) {
  for (let i = 0; i < balls.length; i++) {
    const b = balls[i];
    if (b.pocketed || (b.vx === 0 && b.vz === 0)) continue;
    let nearest = 0;
    let nearestD = Infinity;
    for (let k = 0; k < POCKETS.length; k++) {
      const p = POCKETS[k];
      const dx = b.x - p.x;
      const dz = b.z - p.z;
      const d2 = dx * dx + dz * dz;
      if (d2 < nearestD) {
        nearestD = d2;
        nearest = k;
      }
    }
    const p = POCKETS[nearest];
    const outside = b.x > HALF_W + OUT_MARGIN || b.x < -HALF_W - OUT_MARGIN || b.z > HALF_L + OUT_MARGIN || b.z < -HALF_L - OUT_MARGIN;
    if (nearestD < p.r * p.r || outside) pocketBall(b, p.id, events);
  }
}

// Bolas a menos de eps de tocarse cuentan como un mismo grupo en un choque.
export const CLUSTER = { eps: 2e-4, iters: 40 };
// Choque dentro de un grupo de bolas en contacto (sobre todo el triangulo del saque): se resuelve
// a la vez, no pareja a pareja. Pareja a pareja, casi toda la energia acababa en las dos bolas de
// las esquinas de atras y el resto del triangulo apenas se movia. Con dos bolas da lo mismo que antes.
// Metodo: impulsos acumulados con Jacobi relajado, solo de empuje, hasta alcanzar la restitucion.
function resolveCluster(balls, ia, ib, events) {
  const n = balls.length;
  // Grupo: bolas unidas por contactos con la pareja que choca.
  const inC = new Array(n).fill(false);
  const stack = [ia, ib];
  inC[ia] = inC[ib] = true;
  const lim = (2 * R + CLUSTER.eps) * (2 * R + CLUSTER.eps);
  while (stack.length) {
    const i = stack.pop();
    for (let j = 0; j < n; j++) {
      if (inC[j] || balls[j].pocketed) continue;
      const dx = balls[j].x - balls[i].x, dz = balls[j].z - balls[i].z;
      if (dx * dx + dz * dz <= lim) { inC[j] = true; stack.push(j); }
    }
  }
  const pairs = [];
  for (let i = 0; i < n; i++) if (inC[i]) for (let j = i + 1; j < n; j++) if (inC[j]) {
    const a = balls[i], b = balls[j];
    let nx = b.x - a.x, nz = b.z - a.z;
    const d2 = nx * nx + nz * nz;
    if (d2 > lim) continue;
    const d = Math.sqrt(d2);
    pairs.push({ a, b, nx: nx / d, nz: nz / d, J: 0, target: null });
  }
  // Velocidad de separacion buscada en cada contacto: la de restitucion si se acercaban.
  for (const p of pairs) {
    const vrel = (p.b.vx - p.a.vx) * p.nx + (p.b.vz - p.a.vz) * p.nz;
    p.target = vrel < 0 ? -E_BALL * vrel : 0;
    p.v0 = vrel;
  }
  // Impulsos acumulados con Jacobi relajado: todos los contactos a la vez.
  const deg = new Map();
  for (const p of pairs) { deg.set(p.a, (deg.get(p.a) || 0) + 1); deg.set(p.b, (deg.get(p.b) || 0) + 1); }
  for (let it = 0; it < CLUSTER.iters; it++) {
    const dJ = pairs.map((p) => {
      const vrel = (p.b.vx - p.a.vx) * p.nx + (p.b.vz - p.a.vz) * p.nz;
      let d = 0.5 * (p.target - vrel); // impulso que falta (masa reducida 1/2)
      const w = 1 / Math.max(deg.get(p.a), deg.get(p.b));
      d *= w;
      if (p.J + d < 0) d = -p.J; // los contactos solo empujan
      return d;
    });
    let maxd = 0;
    pairs.forEach((p, k) => {
      const d = dJ[k];
      p.J += d;
      p.a.vx -= d * p.nx; p.a.vz -= d * p.nz;
      p.b.vx += d * p.nx; p.b.vz += d * p.nz;
      if (Math.abs(d) > maxd) maxd = Math.abs(d);
    });
    if (maxd < 1e-6) break;
  }
  for (const p of pairs) if (p.J > 1e-6 && p.v0 < 0) events.push({ type: 'ballBall', a: p.a.id, b: p.b.id, speed: -p.v0 });
}

// Avanza todas las bolas un paso DT con deteccion continua de colisiones.
export function step(state, events) {
  const balls = state.balls;
  const n = balls.length;
  let remaining = DT;
  for (let hit = 0; hit <= MAX_HITS_PER_STEP; hit++) {
    // Buscar el primer impacto dentro del tiempo restante.
    let tMin = remaining;
    let kind = 0; // 0 nada, 1 bola-bola, 2 segmento, 3 punto
    let ia = -1;
    let ib = -1;
    let cx = 0;
    let cz = 0;
    for (let i = 0; i < n; i++) {
      const a = balls[i];
      if (a.pocketed) continue;
      const aMoves = a.vx !== 0 || a.vz !== 0;
      for (let j = i + 1; j < n; j++) {
        const b = balls[j];
        if (b.pocketed) continue;
        if (!aMoves && b.vx === 0 && b.vz === 0) continue;
        const t = toiBallBall(a, b, tMin);
        if (t >= 0 && t < tMin) {
          tMin = t;
          kind = 1;
          ia = i;
          ib = j;
        }
      }
      if (!aMoves) continue;
      for (let k = 0; k < CUSHIONS.length; k++) {
        const c = CUSHIONS[k];
        let t = toiBallSegment(a, c, tMin);
        if (t >= 0 && t < tMin) {
          tMin = t;
          kind = 2;
          ia = i;
          ib = k;
        }
        t = toiBallPoint(a, c.x1, c.z1, tMin);
        if (t >= 0 && t < tMin) {
          tMin = t;
          kind = 3;
          ia = i;
          cx = c.x1;
          cz = c.z1;
        }
        t = toiBallPoint(a, c.x2, c.z2, tMin);
        if (t >= 0 && t < tMin) {
          tMin = t;
          kind = 3;
          ia = i;
          cx = c.x2;
          cz = c.z2;
        }
      }
    }
    // Si se agoto el cupo de impactos, el tiempo restante se descarta sin mover nada.
    if (kind !== 0 && hit === MAX_HITS_PER_STEP) break;

    if (tMin > 0) {
      for (let i = 0; i < n; i++) {
        const b = balls[i];
        if (b.pocketed) continue;
        b.x += b.vx * tMin;
        b.z += b.vz * tMin;
      }
      checkPockets(balls, events);
    }
    remaining -= tMin;
    if (kind === 0) break;

    if (kind === 1) {
      const a = balls[ia];
      const b = balls[ib];
      if (!a.pocketed && !b.pocketed) resolveCluster(balls, ia, ib, events);
    } else if (kind === 2) {
      const a = balls[ia];
      const c = CUSHIONS[ib];
      if (!a.pocketed) {
        const d = (a.x - c.x1) * c.nx + (a.z - c.z1) * c.nz;
        if (d >= 0) bounceOff(a, c.nx, c.nz, events);
        else bounceOff(a, -c.nx, -c.nz, events);
      }
    } else {
      const a = balls[ia];
      if (!a.pocketed) {
        let nx = a.x - cx;
        let nz = a.z - cz;
        const d = Math.sqrt(nx * nx + nz * nz);
        if (d > 0) bounceOff(a, nx / d, nz / d, events);
      }
    }
    if (remaining <= 0) break;
  }
  for (let i = 0; i < n; i++) {
    if (!balls[i].pocketed && isMoving(balls[i])) applyFriction(balls[i]);
  }
}

// ---------- Triangulo, tiro y colocacion de la blanca ----------

const RACK_ROWS = [[1], [9, 2], [3, 8, 10], [11, 4, 12, 5], [6, 13, 14, 7, 15]];
const SOLO_ROWS = 4; // el modo en solitario usa las cuatro primeras filas: diez bolas
const HEAD_Z = 0.495; // linea de cabecera
const FOOT_Z = -0.495; // vertice del triangulo

// variant 'solo': triangulo de diez bolas. Las otras cinco quedan fuera de la partida (out).
export function createRack(variant) {
  const balls = [];
  for (let i = 0; i < 16; i++) balls.push(makeBall(i, 0, 0));
  balls[0].z = HEAD_Z;
  const half = R + 0.5e-5; // media separacion entre centros
  const rowStep = half * Math.sqrt(3);
  const rows = variant === 'solo' ? SOLO_ROWS : RACK_ROWS.length;
  for (let row = rows; row < RACK_ROWS.length; row++) {
    for (const id of RACK_ROWS[row]) {
      balls[id].pocketed = true;
      balls[id].out = true;
    }
  }
  for (let row = 0; row < rows; row++) {
    const ids = RACK_ROWS[row];
    for (let j = 0; j < ids.length; j++) {
      const b = balls[ids[j]];
      b.x = (2 * j - row) * half;
      b.z = FOOT_Z - row * rowStep;
    }
  }
  return { balls };
}

// Golpea la blanca. shot = { dirX, dirZ, speed, side, top } con direccion unitaria.
// side y top dicen donde pega el taco, de -1 a 1: side > 0 a la derecha del centro, top > 0 por encima.
// Un golpe a distancia r del centro da un giro (5 / (2 R^2)) * (r x v).
export function strike(state, shot) {
  const cue = state.balls[0];
  cue.vx = shot.dirX * shot.speed;
  cue.vz = shot.dirZ * shot.speed;
  let side = shot.side || 0;
  let top = shot.top || 0;
  const m2 = side * side + top * top;
  if (m2 > 1) {
    const m = Math.sqrt(m2);
    side /= m;
    top /= m;
  }
  const k = (2.5 * MAX_TIP_OFFSET * shot.speed) / R;
  cue.wx = k * top * shot.dirZ;
  cue.wz = -k * top * shot.dirX;
  cue.wy = k * side;
}

// Detiene todo lo que siga en movimiento (limite de duracion alcanzado).
export function forceRest(state) {
  for (const b of state.balls) {
    stopBall(b);
    b.wy = 0;
  }
}

export function simulateShot(state, shot) {
  const events = [];
  strike(state, shot);
  let steps = 0;
  while (steps < MAX_STEPS && !isAtRest(state)) {
    step(state, events);
    steps++;
  }
  if (!isAtRest(state)) forceRest(state);
  return { events, steps };
}

const CUE_CLEARANCE = 2 * R + 1e-4;

export function isLegalCuePosition(state, x, z, kitchenOnly) {
  if (x > HALF_W - R || x < -HALF_W + R || z > HALF_L - R || z < -HALF_L + R) return false;
  if (kitchenOnly && z < HEAD_Z) return false;
  for (const b of state.balls) {
    if (b.id === 0 || b.pocketed) continue;
    const dx = b.x - x;
    const dz = b.z - z;
    if (dx * dx + dz * dz < CUE_CLEARANCE * CUE_CLEARANCE) return false;
  }
  return true;
}

// 16 direcciones unitarias fijas, para buscar en anillos sin trigonometria.
const C1 = 0.92388;
const S1 = 0.382683;
const H = 0.707107;
const RING = [
  [1, 0], [C1, S1], [H, H], [S1, C1], [0, 1], [-S1, C1], [-H, H], [-C1, S1],
  [-1, 0], [-C1, -S1], [-H, -H], [-S1, -C1], [0, -1], [S1, -C1], [H, -H], [C1, -S1],
];

// Punto legal mas cercano a (x, z) para colocar la blanca.
export function findFreeSpot(state, x, z, kitchenOnly) {
  if (isLegalCuePosition(state, x, z, kitchenOnly)) return { x, z };
  for (let k = 1; k <= 400; k++) {
    const r = k * R * 0.25;
    for (let i = 0; i < RING.length; i++) {
      const px = x + RING[i][0] * r;
      const pz = z + RING[i][1] * r;
      if (isLegalCuePosition(state, px, pz, kitchenOnly)) return { x: px, z: pz };
    }
  }
  return { x: 0, z: HEAD_Z };
}
