// Movimiento en primera persona con colisiones contra cajas alineadas con los ejes.

import * as THREE from 'three';

const RADIUS = 0.25;
const EYE = 1.7;
const SPEED = 1.6;
const RUN = 3.2;
const STEP_UP = 0.45; // desnivel maximo que se puede subir de un paso
const PITCH_LIMIT = 1.45;

export function createWalker(colliders, floors, tableHalf) {
  const pos = { x: -0.5, z: 4.9 };
  let floorY = 0;
  let eyeY = EYE;
  let yaw = 0.1;
  let pitch = -0.08;
  // Desfase visual tras levantarse de un tiro: la camara se queda donde estaba
  // y vuelve a la altura de los ojos al empezar a caminar.
  const offset = new THREE.Vector3();
  const pose = { position: new THREE.Vector3(), quaternion: new THREE.Quaternion() };
  const euler = new THREE.Euler(0, 0, 0, 'YXZ');

  function groundAt(x, z, fromY) {
    let y = 0;
    for (const f of floors) {
      if (x >= f.minX && x <= f.maxX && z >= f.minZ && z <= f.maxZ && f.y > y && f.y <= fromY + STEP_UP) y = f.y;
    }
    return y;
  }
  // Suelo mas alto bajo el punto, sin limite de escalon.
  function topAt(x, z) {
    let y = 0;
    for (const f of floors) {
      if (x >= f.minX && x <= f.maxX && z >= f.minZ && z <= f.maxZ && f.y > y) y = f.y;
    }
    return y;
  }
  function blocked(x, z) {
    for (const c of colliders) {
      if (x > c.minX - RADIUS && x < c.maxX + RADIUS && z > c.minZ - RADIUS && z < c.maxZ + RADIUS) return true;
    }
    return topAt(x, z) > floorY + STEP_UP;
  }

  // Saca un punto de dentro de los obstaculos, por el lado mas cercano.
  function pushOut(x, z) {
    for (let iter = 0; iter < 8; iter++) {
      let moved = false;
      for (const c of colliders) {
        const x0 = c.minX - RADIUS, x1 = c.maxX + RADIUS, z0 = c.minZ - RADIUS, z1 = c.maxZ + RADIUS;
        if (x > x0 && x < x1 && z > z0 && z < z1) {
          const d = [x - x0, x1 - x, z - z0, z1 - z];
          const m = Math.min(d[0], d[1], d[2], d[3]);
          if (m === d[0]) x = x0 - 0.001;
          else if (m === d[1]) x = x1 + 0.001;
          else if (m === d[2]) z = z0 - 0.001;
          else z = z1 + 0.001;
          moved = true;
        }
      }
      if (!moved) break;
    }
    return { x, z };
  }

  function writePose() {
    euler.set(pitch, yaw, 0);
    pose.quaternion.setFromEuler(euler);
    pose.position.set(pos.x, eyeY, pos.z).add(offset);
  }

  const walker = {
    pose,
    get x() { return pos.x; },
    get z() { return pos.z; },
    get yaw() { return yaw; },

    look(dYaw, dPitch) {
      yaw += dYaw;
      pitch = Math.max(-PITCH_LIMIT, Math.min(PITCH_LIMIT, pitch + dPitch));
    },

    // moveX: derecha positivo. moveZ: adelante positivo. Ambos entre -1 y 1.
    update(dt, moveX, moveZ, run) {
      const mag = Math.hypot(moveX, moveZ);
      if (mag > 0.01) {
        const k = (run ? RUN : SPEED) * dt * Math.min(1, mag) / mag;
        const sin = Math.sin(yaw), cos = Math.cos(yaw);
        const dx = (moveX * cos - moveZ * sin) * k;
        const dz = (-moveX * sin - moveZ * cos) * k;
        if (!blocked(pos.x + dx, pos.z)) pos.x += dx;
        if (!blocked(pos.x, pos.z + dz)) pos.z += dz;
        offset.multiplyScalar(Math.exp(-7 * dt));
        if (offset.lengthSq() < 1e-6) offset.set(0, 0, 0);
      }
      floorY = groundAt(pos.x, pos.z, floorY);
      const target = floorY + EYE;
      eyeY += (target - eyeY) * Math.min(1, dt * 10);
      writePose();
    },

    // Adopta la pose actual de la camara (al levantarse de un tiro) sin saltos.
    adopt(camera) {
      euler.setFromQuaternion(camera.quaternion, 'YXZ');
      yaw = euler.y;
      pitch = euler.x;
      const p = pushOut(camera.position.x, camera.position.z);
      pos.x = p.x;
      pos.z = p.z;
      floorY = groundAt(pos.x, pos.z, 10);
      eyeY = floorY + EYE;
      offset.set(camera.position.x - pos.x, camera.position.y - eyeY, camera.position.z - pos.z);
      writePose();
    },

    setPosition(x, z, newYaw) {
      pos.x = x;
      pos.z = z;
      if (newYaw !== undefined) yaw = newYaw;
      floorY = groundAt(x, z, 10);
      eyeY = floorY + EYE;
      offset.set(0, 0, 0);
      writePose();
    },

    // Distancia horizontal al borde de la mesa.
    distanceToTable() {
      const dx = Math.max(Math.abs(pos.x) - tableHalf.x, 0);
      const dz = Math.max(Math.abs(pos.z) - tableHalf.z, 0);
      return Math.hypot(dx, dz);
    },
  };
  writePose();
  return walker;
}
