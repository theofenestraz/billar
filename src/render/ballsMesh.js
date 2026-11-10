// Mallas de las 16 bolas y su sincronizacion con el estado de la fisica.

import * as THREE from 'three';
import { R, BED_Y } from '../physics/constants.js';
import { makeBallTexture } from './textures.js?v=10';
import { TRAY_Y, TRAY_Z } from './tableMesh.js?v=10';

const UP = new THREE.Vector3(0, 1, 0);

export function buildBalls() {
  const group = new THREE.Group();
  const geo = new THREE.SphereGeometry(R, 40, 28);
  const meshes = [];
  const last = [];
  const axis = new THREE.Vector3();
  const q = new THREE.Quaternion();
  const trayOrder = []; // ids en el orden en que se embocaron

  for (let id = 0; id < 16; id++) {
    const mat = new THREE.MeshPhysicalMaterial({
      map: makeBallTexture(id),
      roughness: 0.08,
      metalness: 0,
      clearcoat: 1,
      clearcoatRoughness: 0.04,
      envMapIntensity: 1.1,
    });
    const m = new THREE.Mesh(geo, mat);
    m.castShadow = true;
    m.receiveShadow = true;
    // Orientacion inicial distinta para cada bola, fija.
    m.quaternion.setFromEuler(new THREE.Euler(id * 1.3, id * 2.1, id * 0.7));
    meshes.push(m);
    last.push(null);
    group.add(m);
  }

  // Coloca cada malla segun el estado y la hace rodar segun lo que se ha desplazado.
  function sync(state) {
    for (const b of state.balls) {
      const m = meshes[b.id];
      if (b.pocketed) {
        // Las bolas embocadas se ven en la bandeja de la ventanilla. La blanca se oculta.
        last[b.id] = null;
        m.visible = b.id !== 0;
        if (b.id !== 0) {
          const slot = trayOrder.indexOf(b.id) >= 0 ? trayOrder.indexOf(b.id) : trayOrder.push(b.id) - 1;
          m.position.set(((slot % 7) - 3) * (2 * R + 0.004), TRAY_Y, TRAY_Z + Math.floor(slot / 7) * (2 * R + 0.002));
        }
        continue;
      }
      m.visible = true;
      const ti = trayOrder.indexOf(b.id);
      if (ti >= 0) trayOrder.splice(ti, 1);
      const prev = last[b.id];
      if (prev) {
        const dx = b.x - prev.x;
        const dz = b.z - prev.z;
        const d = Math.sqrt(dx * dx + dz * dz);
        if (d > 1e-7 && d < 0.2) {
          axis.set(dz / d, 0, -dx / d);
          q.setFromAxisAngle(axis, d / R);
          m.quaternion.premultiply(q);
        }
        prev.x = b.x;
        prev.z = b.z;
      } else {
        last[b.id] = { x: b.x, z: b.z };
      }
      m.position.set(b.x, BED_Y + R, b.z);
    }
  }

  return { group, meshes, sync, UP };
}
