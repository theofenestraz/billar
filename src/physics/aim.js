// Prediccion geometrica del primer contacto de la blanca, para la linea guia.

import { HALF_W, HALF_L } from './constants.js';
import { CUSHIONS } from './table.js';
import { toiBallBall, toiBallPoint, toiBallSegment } from './simulate.js';

const REACH = 4; // mas largo que la diagonal de la mesa

// dir debe ser unitario. Devuelve el centro de la blanca en el primer contacto.
export function predictAim(state, dirX, dirZ) {
  const cue = state.balls[0];
  const probe = { x: cue.x, z: cue.z, vx: dirX, vz: dirZ };
  let tMin = REACH;
  let hitBall = null;
  let hitCushion = false;

  for (const b of state.balls) {
    if (b.id === 0 || b.pocketed) continue;
    const t = toiBallBall(probe, { x: b.x, z: b.z, vx: 0, vz: 0 }, tMin);
    if (t >= 0 && t < tMin) {
      tMin = t;
      hitBall = b.id;
    }
  }
  for (const c of CUSHIONS) {
    for (const t of [toiBallSegment(probe, c, tMin), toiBallPoint(probe, c.x1, c.z1, tMin), toiBallPoint(probe, c.x2, c.z2, tMin)]) {
      if (t >= 0 && t < tMin) {
        tMin = t;
        hitBall = null;
        hitCushion = true;
      }
    }
  }
  if (hitBall === null && !hitCushion) {
    // El camino entra en una tronera: cortar la linea al salir del tapete.
    const lim = (p, d, half) => (d > 0 ? (half - p) / d : d < 0 ? (-half - p) / d : REACH);
    tMin = Math.min(lim(cue.x, dirX, HALF_W + 0.03), lim(cue.z, dirZ, HALF_L + 0.03), REACH);
    if (tMin < 0) tMin = 0;
  }

  const endX = cue.x + dirX * tMin;
  const endZ = cue.z + dirZ * tMin;
  let objDirX = 0;
  let objDirZ = 0;
  if (hitBall !== null) {
    const b = state.balls.find((x) => x.id === hitBall);
    const dx = b.x - endX;
    const dz = b.z - endZ;
    const d = Math.sqrt(dx * dx + dz * dz);
    objDirX = dx / d;
    objDirZ = dz / d;
  }
  return { endX, endZ, hitBall, objDirX, objDirZ };
}
