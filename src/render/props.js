// Muebles y maquinas de la sala. Cada pieza funde su geometria por material
// para que cueste pocas llamadas de dibujo.

import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { makeFoosballFieldTexture, makeSnackMachineTexture, makeCoffeeMachineTexture } from './textures.js?v=8';

const std = (o) => new THREE.MeshStandardMaterial({ envMapIntensity: 0.15, ...o });
const unlit = (o) => new THREE.MeshBasicMaterial({ toneMapped: false, ...o });

// Acumula geometrias ya colocadas y las funde en una malla por material.
class Batch {
  constructor() {
    this.items = new Map();
    this.m = new THREE.Matrix4();
    this.q = new THREE.Quaternion();
    this.e = new THREE.Euler();
  }
  // pos y rot en el espacio de la pieza; parent es una matriz opcional que se aplica despues.
  add(geo, mat, x, y, z, rx = 0, ry = 0, rz = 0, parent = null) {
    this.q.setFromEuler(this.e.set(rx, ry, rz));
    this.m.compose(new THREE.Vector3(x, y, z), this.q, new THREE.Vector3(1, 1, 1));
    if (parent) this.m.premultiply(parent);
    const g = geo.clone().applyMatrix4(this.m);
    if (!this.items.has(mat)) this.items.set(mat, []);
    this.items.get(mat).push(g);
    return this;
  }
  box(mat, w, h, d, x, y, z, rx, ry, rz, parent) {
    return this.add(new THREE.BoxGeometry(w, h, d), mat, x, y, z, rx, ry, rz, parent);
  }
  build(shadows = true) {
    const group = new THREE.Group();
    for (const [mat, list] of this.items) {
      const mesh = new THREE.Mesh(mergeGeometries(list), mat);
      mesh.castShadow = shadows;
      mesh.receiveShadow = shadows;
      group.add(mesh);
      list.forEach((g) => g.dispose());
    }
    return group;
  }
}

// ---------- Futbolin ----------
// Eje largo en x. Mide 1,40 x 0,75 m y 0,90 m de alto, sin contar barras.
export function buildFoosball() {
  const L = 1.4;
  const Wd = 0.75;
  const TOP = 0.9;
  const FIELD = 0.8;
  const ROD_Y = 0.862;
  const b = new Batch();

  const black = std({ color: '#0d0d0f', roughness: 0.42 });
  const gloss = std({ color: '#060607', roughness: 0.16, envMapIntensity: 0.6 });
  const chrome = std({ color: '#b4b8bc', roughness: 0.42, metalness: 0.9, envMapIntensity: 0.9 });
  const rubber = std({ color: '#141416', roughness: 0.85 });
  const fieldMat = std({ map: makeFoosballFieldTexture(), roughness: 0.38, envMapIntensity: 0.3 });
  const skin = std({ color: '#ead9c8', roughness: 0.6 });
  const teamA = std({ color: '#2f5fc4', roughness: 0.5 });
  const teamB = std({ color: '#d2364a', roughness: 0.5 });
  const whiteKit = std({ color: '#efeeea', roughness: 0.55 });

  // Caja: laterales, testeros y fondo.
  for (const s of [-1, 1]) {
    b.box(black, L, 0.34, 0.03, 0, TOP - 0.17, s * (Wd / 2 - 0.015));
    b.box(black, 0.03, 0.34, Wd, s * (L / 2 - 0.015), TOP - 0.17, 0);
    // Listón superior, algo mas ancho que la pared.
    b.box(gloss, L + 0.02, 0.012, 0.05, 0, TOP + 0.006, s * (Wd / 2 - 0.015));
    b.box(gloss, 0.05, 0.012, Wd, s * (L / 2 - 0.015), TOP + 0.006, 0);
    // Cajones de recogida de bolas en cada lateral.
    for (const dx of [-0.32, 0.32]) {
      b.box(gloss, 0.52, 0.19, 0.008, dx, 0.685, s * (Wd / 2 + 0.003));
      b.add(new THREE.CylinderGeometry(0.014, 0.014, 0.012, 12), chrome, dx, 0.685, s * (Wd / 2 + 0.012), Math.PI / 2);
    }
    // Porterias: hueco oscuro en cada testero.
    b.box(rubber, 0.006, 0.07, 0.2, s * (L / 2 - 0.032), FIELD + 0.036, 0);
  }
  b.box(black, L, 0.02, Wd, 0, TOP - 0.33, 0);
  // Campo.
  const field = new THREE.PlaneGeometry(L - 0.06, Wd - 0.06);
  b.add(field, fieldMat, 0, FIELD, 0, -Math.PI / 2);

  // Patas cuadradas por fuera de los testeros, con tornillos, y travesanos.
  for (const sx of [-1, 1]) {
    const lx = sx * (L / 2 + 0.036);
    for (const sz of [-1, 1]) {
      const lz = sz * (Wd / 2 - 0.045);
      b.box(black, 0.072, 0.88, 0.085, lx, 0.44, lz);
      b.add(new THREE.CylinderGeometry(0.03, 0.036, 0.018, 12), rubber, lx, 0.009, lz);
      for (const by of [0.62, 0.8]) {
        b.add(new THREE.CylinderGeometry(0.011, 0.011, 0.01, 10), chrome, lx + sx * 0.039, by, lz, 0, 0, Math.PI / 2);
      }
    }
    b.box(black, 0.05, 0.075, Wd - 0.17, lx, 0.2, 0);
    b.box(black, 0.05, 0.16, Wd - 0.17, lx, 0.64, 0);
    // Marcador de cuentas sobre cada porteria.
    const mx = sx * (L / 2 - 0.015);
    b.add(new THREE.CylinderGeometry(0.003, 0.003, 0.3, 6), chrome, mx, TOP + 0.045, 0, Math.PI / 2);
    for (const pz of [-0.15, 0.15]) b.box(black, 0.012, 0.045, 0.012, mx, TOP + 0.03, pz);
    for (let k = 0; k < 10; k++) {
      b.box(sx < 0 ? teamA : teamB, 0.016, 0.016, 0.014, mx, TOP + 0.045, -0.13 + k * 0.016 + (k > 6 ? 0.1 : 0));
    }
  }

  // Barras con jugadores. Equipo A: barras 0, 1, 3 y 5. Los mangos alternan de lado por equipo.
  const counts = [1, 2, 3, 5, 5, 3, 2, 1];
  const gap = { 1: 0, 2: 0.24, 3: 0.19, 5: 0.118 };
  const slide = [0.03, -0.05, 0.04, -0.02, 0.03, -0.04, 0.05, -0.02];
  const spin = [0.15, -0.5, 0.35, 0.9, -0.25, 0.1, -0.7, 0.3];
  const rodGeo = new THREE.CylinderGeometry(0.0075, 0.0075, 1.24, 10);
  const handleGeo = new THREE.CylinderGeometry(0.017, 0.015, 0.115, 12);
  const capGeo = new THREE.CylinderGeometry(0.011, 0.011, 0.03, 10);
  const bumperGeo = new THREE.CylinderGeometry(0.015, 0.015, 0.022, 10);
  const torsoGeo = new THREE.BoxGeometry(0.03, 0.05, 0.04);
  const headGeo = new THREE.SphereGeometry(0.0145, 10, 8);
  const legGeo = new THREE.BoxGeometry(0.022, 0.05, 0.03);
  const footGeo = new THREE.BoxGeometry(0.03, 0.012, 0.03);
  const parent = new THREE.Matrix4();
  counts.forEach((count, i) => {
    const a = [0, 1, 3, 5].includes(i);
    const side = a ? -1 : 1;
    const x = -0.525 + i * 0.15;
    const z0 = side * 0.07 + slide[i];
    // La barra gira sobre su eje (z) y se desliza un poco, como si acabaran de jugar.
    parent.makeRotationZ(spin[i]).setPosition(x, ROD_Y, z0);
    b.add(rodGeo, chrome, 0, 0, 0, Math.PI / 2, 0, 0, parent);
    b.add(handleGeo, rubber, 0, 0, side * 0.575, Math.PI / 2, 0, 0, parent);
    b.add(capGeo, rubber, 0, 0, -side * 0.62, Math.PI / 2, 0, 0, parent);
    for (const s of [-1, 1]) b.add(bumperGeo, rubber, 0, 0, s * (Wd / 2 - 0.045) - z0, Math.PI / 2, 0, 0, parent);
    for (let k = 0; k < count; k++) {
      const z = (k - (count - 1) / 2) * gap[count] - side * 0.07;
      b.add(torsoGeo, a ? teamA : teamB, 0, 0.002, z, 0, 0, 0, parent);
      b.add(headGeo, skin, 0, 0.04, z, 0, 0, 0, parent);
      b.add(legGeo, whiteKit, 0, -0.045, z, 0, 0, 0, parent);
      b.add(footGeo, rubber, 0.004, -0.066, z, 0, 0, 0, parent);
    }
  });
  // Bola.
  b.add(new THREE.SphereGeometry(0.017, 12, 10), whiteKit, 0.11, FIELD + 0.017, 0.14);

  const g = b.build();
  g.userData.half = { x: L / 2 + 0.08, z: Wd / 2 + 0.2 };
  return g;
}

// ---------- Sillon naranja de carcasa ----------
// Mira hacia +z local.
export function buildShellChair(color = '#f08a1c') {
  const b = new Batch();
  const shell = std({ color, roughness: 0.5, side: THREE.DoubleSide });
  const metal = std({ color: '#101012', roughness: 0.4, metalness: 0.6 });
  // Respaldo envolvente: arco abierto por delante, mas alto atras.
  const span = Math.PI * 1.12;
  const back = new THREE.CylinderGeometry(0.33, 0.27, 0.4, 24, 4, true, Math.PI - span / 2, span);
  // Baja el borde superior hacia los brazos.
  const p = back.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const y = p.getY(i);
    if (y > -0.19) {
      const forward = Math.max(0, p.getZ(i) + 0.1) / 0.4; // 0 atras, 1 en la punta de los brazos
      p.setY(i, y - (y + 0.2) * 0.5 * Math.min(1, forward));
    }
  }
  back.computeVertexNormals();
  b.add(back, shell, 0, 0.62, 0);
  // Asiento acolchado.
  const seat = new THREE.CylinderGeometry(0.285, 0.26, 0.1, 24);
  seat.scale(1, 1, 0.96);
  b.add(seat, shell, 0, 0.43, 0.01);
  // Patas finas abiertas.
  const leg = new THREE.CylinderGeometry(0.009, 0.007, 0.42, 6);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    b.add(leg, metal, sx * 0.22, 0.2, sz * 0.2, sz * 0.16, 0, -sx * 0.16);
  }
  return b.build();
}

// ---------- Maquinas expendedoras ----------
// El frontal mira hacia +z local y brilla por si mismo, como una maquina encendida.
export function buildVendingMachine(kind = 'snack') {
  const snack = kind === 'snack';
  const w = snack ? 0.95 : 0.62;
  const h = 1.83;
  const d = snack ? 0.8 : 0.7;
  const b = new Batch();
  const body = std({ color: '#0b0b0d', roughness: 0.45 });
  b.box(body, w, h, d, 0, h / 2, 0);
  const front = unlit({ map: snack ? makeSnackMachineTexture() : makeCoffeeMachineTexture() });
  front.color.multiplyScalar(snack ? 1.25 : 1.05);
  b.add(new THREE.PlaneGeometry(w - 0.02, h - 0.02), front, 0, h / 2, d / 2 + 0.004);
  const g = b.build(false);
  g.userData.size = { w, h, d };
  return g;
}

// ---------- Mesa alta con microondas ----------
// Tablero de 0,55 (x) por 0,8 (z).
export function buildHighTable() {
  const b = new Batch();
  const wood = std({ color: '#b08a5c', roughness: 0.65 });
  const metal = std({ color: '#101012', roughness: 0.45, metalness: 0.5 });
  const white = std({ color: '#e4e3de', roughness: 0.5 });
  const dark = std({ color: '#18191b', roughness: 0.3 });
  b.box(wood, 0.55, 0.04, 0.8, 0, 1.05, 0);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) b.box(metal, 0.03, 1.03, 0.03, sx * 0.25, 0.515, sz * 0.37);
  for (const y of [0.22, 0.45]) {
    for (const sx of [-1, 1]) b.box(metal, 0.025, 0.025, 0.74, sx * 0.25, y, 0);
    for (const sz of [-1, 1]) b.box(metal, 0.5, 0.025, 0.025, 0, y, sz * 0.37);
  }
  // Microondas.
  b.box(white, 0.36, 0.25, 0.44, 0.02, 1.195, -0.08);
  b.box(dark, 0.004, 0.17, 0.27, -0.162, 1.2, -0.13);
  return b.build(false);
}

// ---------- Mesas y sillas lejanas de la cafeteria ----------
// Sin luces reales en esa zona: materiales que no dependen de la iluminacion.
export function buildCafeSet(chairColors) {
  const b = new Batch();
  const top = unlit({ color: '#8f8676' });
  const leg = unlit({ color: '#6f675a' });
  b.box(top, 1.3, 0.04, 0.8, 0, 0.74, 0);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) b.box(leg, 0.05, 0.72, 0.05, sx * 0.58, 0.36, sz * 0.33);
  const seats = [[-0.4, 0.62, Math.PI], [0.4, 0.62, Math.PI], [-0.4, -0.62, 0], [0.4, -0.62, 0]];
  const mats = new Map();
  seats.forEach(([x, z, ry], i) => {
    const color = chairColors[i % chairColors.length];
    if (!mats.has(color)) mats.set(color, unlit({ color }));
    const m = mats.get(color);
    const parent = new THREE.Matrix4().makeRotationY(ry).setPosition(x, 0, z);
    b.box(m, 0.42, 0.04, 0.4, 0, 0.45, 0, 0, 0, 0, parent);
    b.box(m, 0.42, 0.36, 0.04, 0, 0.66, -0.19, -0.1, 0, 0, parent);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) b.box(m, 0.03, 0.45, 0.03, sx * 0.18, 0.225, sz * 0.17, 0, 0, 0, parent);
  });
  return b.build(false);
}
