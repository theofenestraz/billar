// Mallas de las 16 bolas y su sincronizacion con el estado de la fisica.

import * as THREE from 'three';
import { R, BED_Y } from '../physics/constants.js';
import { POCKETS } from '../physics/table.js';
import { makeBallTexture } from './textures.js?v=21';
import { TRAY_Y, TRAY_Z, POCKET_HOLE } from './tableMesh.js?v=21';

const UP = new THREE.Vector3(0, 1, 0);

// Caida dentro de la tronera. Solo es dibujo: las reglas ya cuentan la bola como embocada.
const G = 9.81;
const WALL_R = POCKET_HOLE - R; // el centro de la bola no pasa de aqui: pared de la copa
const HOLE_R = POCKET_HOLE; // hueco del tapete
const FLOOR_Y = BED_Y - 0.12 + R; // fondo visible de la tronera
const WALL_E = 0.45; // rebote contra el fondo de la tronera
const MAX_DROP_TIME = 1.1;

// Sombra de contacto: mancha oscura y difusa justo debajo de cada bola. La sombra del foco sola no basta,
// porque las luces de relleno aclaran el tapete y la bola parece flotar.
function makeContactTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  grad.addColorStop(0, 'rgba(0,0,0,0.95)');
  grad.addColorStop(0.22, 'rgba(0,0,0,0.75)');
  grad.addColorStop(0.5, 'rgba(0,0,0,0.28)');
  grad.addColorStop(0.78, 'rgba(0,0,0,0.07)');
  grad.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 128, 128);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export function buildBalls() {
  const group = new THREE.Group();
  const geo = new THREE.SphereGeometry(R, 40, 28);
  const contactMat = new THREE.MeshBasicMaterial({
    map: makeContactTexture(), transparent: true, opacity: 0.6, depthWrite: false,
    polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2,
  });
  const contactGeo = new THREE.PlaneGeometry(R * 3.2, R * 3.2);
  contactGeo.rotateX(-Math.PI / 2);
  const contacts = [];
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
      // La sombra se calcula con la cara de arriba. Con la de abajo (lo que hace three.js por defecto)
      // el centro de la sombra quedaba iluminado y se veia un aro alrededor de la bola.
      shadowSide: THREE.FrontSide,
    });
    const m = new THREE.Mesh(geo, mat);
    m.castShadow = true;
    m.receiveShadow = true;
    // Orientacion inicial distinta para cada bola, fija.
    m.quaternion.setFromEuler(new THREE.Euler(id * 1.3, id * 2.1, id * 0.7));
    meshes.push(m);
    last.push(null);
    group.add(m);
    const cs = new THREE.Mesh(contactGeo, contactMat);
    cs.renderOrder = 1;
    contacts.push(cs);
    group.add(cs);
  }

  const drops = new Map(); // id -> caida en curso
  let onHit = null;

  // Empieza la caida de una bola desde el suceso de la fisica.
  function drop(e) {
    const p = POCKETS[e.pocket];
    if (!p) return;
    // Hacia fuera de la mesa desde la tronera: ahi esta el fondo contra el que choca.
    const ol = Math.hypot(p.x, p.z);
    drops.set(e.ball, {
      p, ox: p.x / ol, oz: p.z / ol,
      x: e.x, z: e.z, y: BED_Y + R,
      vx: e.vx || 0, vz: e.vz || 0, vy: 0,
      t: 0, bounces: 0, lastHit: -1,
      captured: false, // ya esta dentro del hueco: no puede volver al tapete
    });
  }

  // Avanza una caida. Devuelve false cuando la bola ya ha desaparecido por debajo.
  function stepDrop(d, m, dt) {
    const n = 6;
    const h = dt / n;
    const px = d.x;
    const pz = d.z;
    for (let i = 0; i < n; i++) {
      d.t += h;
      const rx = d.x - d.p.x;
      const rz = d.z - d.p.z;
      const r = Math.hypot(rx, rz);
      if (r < WALL_R) d.captured = true;
      // Sobre el tapete la bola se apoya; encima del hueco cae.
      const supported = !d.captured && r > HOLE_R && d.y >= BED_Y + R - 1e-4;
      if (supported) d.vy = 0;
      else d.vy -= G * h;
      d.x += d.vx * h;
      d.z += d.vz * h;
      d.y += d.vy * h;
      // Pared: la mitad exterior siempre; dentro del hueco, todo alrededor.
      const qx = d.x - d.p.x;
      const qz = d.z - d.p.z;
      const qd = Math.hypot(qx, qz);
      if (qd > WALL_R && qd > 1e-6) {
        const nx = qx / qd;
        const nz = qz / qd;
        const below = d.y < BED_Y + R * 0.2;
        // Antes de entrar del todo solo esta el fondo; despues la rodean el fondo y las bocas.
        if (below || d.captured || nx * d.ox + nz * d.oz > -0.15) {
          const vn = d.vx * nx + d.vz * nz;
          if (vn > 0) {
            // Rebote contra el fondo: pierde fuerza, conserva parte del giro y sube un poco por el borde.
            d.vx -= (1 + WALL_E) * vn * nx;
            d.vz -= (1 + WALL_E) * vn * nz;
            d.vx *= 0.85;
            d.vz *= 0.85;
            if (!below) d.vy += 0.22 * vn;
            if (onHit && vn > 0.25 && d.t - d.lastHit > 0.04) onHit(vn);
            d.lastHit = d.t;
          }
          d.x = d.p.x + nx * WALL_R;
          d.z = d.p.z + nz * WALL_R;
        }
      }
      // Fondo de la tronera.
      if (d.y < FLOOR_Y) {
        d.y = FLOOR_Y;
        if (d.vy < 0) {
          if (onHit && -d.vy > 0.4) onHit(-d.vy * 0.6);
          d.vy = -d.vy * 0.3;
          d.vx *= 0.6;
          d.vz *= 0.6;
          d.bounces++;
        }
      }
    }
    // Gira segun lo que avanza.
    const dx = d.x - px;
    const dz = d.z - pz;
    const dl = Math.hypot(dx, dz);
    if (dl > 1e-7 && dl < 0.2) {
      axis.set(dz / dl, 0, -dx / dl);
      q.setFromAxisAngle(axis, dl / R);
      m.quaternion.premultiply(q);
    }
    m.position.set(d.x, d.y, d.z);
    const settled = d.y <= FLOOR_Y + 1e-4 && Math.abs(d.vy) < 0.15 && Math.hypot(d.vx, d.vz) < 0.15;
    return !(d.t > MAX_DROP_TIME || (d.bounces > 0 && settled && d.t > 0.25));
  }

  // Coloca cada malla segun el estado y la hace rodar segun lo que se ha desplazado.
  function sync(state, dt = 1 / 60) {
    for (const b of state.balls) {
      const m = meshes[b.id];
      const cs = contacts[b.id];
      cs.visible = !b.pocketed;
      if (!b.pocketed) cs.position.set(b.x, BED_Y + 0.0004, b.z);
      if (b.pocketed && drops.has(b.id)) {
        last[b.id] = null;
        m.visible = true;
        if (stepDrop(drops.get(b.id), m, Math.min(dt, 0.05))) continue;
        drops.delete(b.id);
      }
      if (!b.pocketed) drops.delete(b.id);
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

  return {
    group, meshes, sync, drop, UP,
    // cb(velocidad) en cada golpe de la bola dentro de la tronera.
    onHit(cb) { onHit = cb; },
  };
}
