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
