// Malla de la mesa de billar, a escala: 2,36 x 1,37 por fuera, 1,98 x 0,99 de juego.

import * as THREE from 'three';
import { HALF_W, HALF_L, BED_Y, R } from '../physics/constants.js';
import { POCKETS, CUSHIONS } from '../physics/table.js';
import { makeNoiseTexture, makeBumpTexture } from './textures.js?v=7';

const OUT_X = 0.685; // media anchura exterior (1,37 / 2)
const OUT_Z = 1.18; // media longitud exterior (2,36 / 2)
const TOP_Y = 0.8; // borde superior
const CUSHION_DEPTH = 0.05;
const CAB_X = 0.655;
const CAB_Z = 1.15;
const CAB_BOTTOM = 0.36;
const CAB_TOP = 0.755;

function arcTo(path, cx, cy, r, x0, y0, x1, y1) {
  const a0 = Math.atan2(y0 - cy, x0 - cx);
  let a1 = Math.atan2(y1 - cy, x1 - cx);
  if (a1 <= a0) a1 += Math.PI * 2;
  path.absarc(cx, cy, r, a0, a1, false);
}

function roundedRect(shape, hx, hy, r) {
  shape.moveTo(-hx + r, -hy);
  shape.lineTo(hx - r, -hy);
  shape.absarc(hx - r, -hy + r, r, -Math.PI / 2, 0, false);
  shape.lineTo(hx, hy - r);
  shape.absarc(hx - r, hy - r, r, 0, Math.PI / 2, false);
  shape.lineTo(-hx + r, hy);
  shape.absarc(-hx + r, hy - r, r, Math.PI / 2, Math.PI, false);
  shape.lineTo(-hx, -hy + r);
  shape.absarc(-hx + r, -hy + r, r, Math.PI, Math.PI * 1.5, false);
}

// Marco superior negro con el hueco de juego y las seis troneras recortadas.
function buildFrame(mat) {
  const a = HALF_W + CUSHION_DEPTH;
  const b = HALF_L + CUSHION_DEPTH;
  const corner = POCKETS.find((p) => p.x > 0 && p.z > 0.5);
  const side = POCKETS.find((p) => p.x > 0 && p.z === 0);
  const rc = 0.066;
  const rs = 0.062;
  const zc = corner.z - Math.sqrt(rc * rc - (a - corner.x) ** 2);
  const xc = corner.x - Math.sqrt(rc * rc - (b - corner.z) ** 2);
  const zs = Math.sqrt(rs * rs - (a - side.x) ** 2);

  const shape = new THREE.Shape();
  roundedRect(shape, OUT_X, OUT_Z, 0.1);
  const hole = new THREE.Path();
  hole.moveTo(xc, -b);
  arcTo(hole, corner.x, -corner.z, rc, xc, -b, a, -zc);
  hole.lineTo(a, -zs);
  arcTo(hole, side.x, 0, rs, a, -zs, a, zs);
  hole.lineTo(a, zc);
  arcTo(hole, corner.x, corner.z, rc, a, zc, xc, b);
  hole.lineTo(-xc, b);
  arcTo(hole, -corner.x, corner.z, rc, -xc, b, -a, zc);
  hole.lineTo(-a, zs);
  arcTo(hole, -side.x, 0, rs, -a, zs, -a, -zs);
  hole.lineTo(-a, -zc);
  arcTo(hole, -corner.x, -corner.z, rc, -a, -zc, -xc, -b);
  hole.closePath();
  shape.holes.push(hole);

  const geo = new THREE.ExtrudeGeometry(shape, { depth: 0.05, bevelEnabled: true, bevelThickness: 0.004, bevelSize: 0.004, bevelSegments: 2, curveSegments: 20 });
  geo.rotateX(Math.PI / 2);
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.y = TOP_Y - 0.004;
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

// Tapete con los agujeros de las troneras.
function buildBed(mat) {
  const shape = new THREE.Shape();
  shape.moveTo(-0.6, -1.1);
  shape.lineTo(0.6, -1.1);
  shape.lineTo(0.6, 1.1);
  shape.lineTo(-0.6, 1.1);
  shape.closePath();
  for (const p of POCKETS) {
    const h = new THREE.Path();
    h.absarc(p.x, -p.z, 0.06, 0, Math.PI * 2, true);
    shape.holes.push(h);
  }
  const geo = new THREE.ShapeGeometry(shape, 24);
  geo.rotateX(-Math.PI / 2);
  // Coordenadas de textura en metros, para que el grano del fieltro sea uniforme.
  const pos = geo.attributes.position;
  const uv = geo.attributes.uv;
  for (let i = 0; i < pos.count; i++) uv.setXY(i, pos.getX(i) * 4, pos.getZ(i) * 4);
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.y = BED_Y;
  mesh.receiveShadow = true;
  return mesh;
}

// Perfil de banda extruido a lo largo de un segmento.
function buildCushion(c, mat, depth) {
  const midX = (c.x1 + c.x2) / 2;
  const midZ = (c.z1 + c.z2) / 2;
  // Normal hacia el cuerpo de la banda (lado contrario al de juego).
  let nx = c.nx;
  let nz = c.nz;
  let refX = 0;
  let refZ = 0;
  if (c.len < 0.2) {
    // Boca de tronera: el cuerpo queda del lado contrario al centro de la tronera.
    let best = POCKETS[0];
    let bestD = Infinity;
    for (const p of POCKETS) {
      const d = (p.x - midX) ** 2 + (p.z - midZ) ** 2;
      if (d < bestD) {
        bestD = d;
        best = p;
      }
    }
    refX = best.x;
    refZ = best.z;
  }
  if ((midX - refX) * nx + (midZ - refZ) * nz < 0) {
    nx = -nx;
    nz = -nz;
  }
  const h = TOP_Y - BED_Y;
  const profile = new THREE.Shape();
  profile.moveTo(0, h * 0.72);
  profile.lineTo(0, h);
  profile.lineTo(depth, h);
  profile.lineTo(depth, 0);
  profile.lineTo(depth * 0.4, 0);
  profile.closePath();
  const geo = new THREE.ExtrudeGeometry(profile, { depth: c.len, bevelEnabled: false });
  // Base: X = normal hacia fuera, Y = arriba, Z = tangente = X x Y.
  const tx = -nz;
  const tz = nx;
  const startIsP1 = (c.x2 - c.x1) * tx + (c.z2 - c.z1) * tz > 0;
  const sx = startIsP1 ? c.x1 : c.x2;
  const sz = startIsP1 ? c.z1 : c.z2;
  const m = new THREE.Matrix4().makeBasis(new THREE.Vector3(nx, 0, nz), new THREE.Vector3(0, 1, 0), new THREE.Vector3(tx, 0, tz));
  m.setPosition(sx, BED_Y, sz);
  geo.applyMatrix4(m);
  const mesh = new THREE.Mesh(geo, mat);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

function box(w, h, d, mat, x, y, z) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.position.set(x, y, z);
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

function roundedHole(cx, cy, w, h, target) {
  const r = h / 2;
  const p = target || new THREE.Path();
  p.moveTo(cx - w / 2 + r, cy - r);
  p.lineTo(cx + w / 2 - r, cy - r);
  p.absarc(cx + w / 2 - r, cy, r, -Math.PI / 2, Math.PI / 2, false);
  p.lineTo(cx - w / 2 + r, cy + r);
  p.absarc(cx - w / 2 + r, cy, r, Math.PI / 2, Math.PI * 1.5, false);
  return p;
}

export function buildTable() {
  const group = new THREE.Group();

  const cloth = new THREE.MeshStandardMaterial({
    color: '#ffffff',
    map: makeNoiseTexture({ base: '#2fae86', spread: 16, seed: 11 }),
    bumpMap: makeBumpTexture({ seed: 5 }),
    bumpScale: 0.15,
    roughness: 0.96,
  });
  cloth.map.repeat.set(1, 1);
  const black = new THREE.MeshPhysicalMaterial({ color: '#0c0c0e', roughness: 0.32, clearcoat: 0.7, clearcoatRoughness: 0.25 });
  const blackMatte = new THREE.MeshStandardMaterial({ color: '#0a0a0b', roughness: 0.75 });
  const alu = new THREE.MeshStandardMaterial({ color: '#c8ccd2', metalness: 1, roughness: 0.28 });
  const grey = new THREE.MeshStandardMaterial({ color: '#9a9da2', metalness: 0.35, roughness: 0.45, side: THREE.DoubleSide });
  const hollow = new THREE.MeshBasicMaterial({ color: '#020202', side: THREE.DoubleSide });

  group.add(buildBed(cloth));
  group.add(buildFrame(black));
  for (const c of CUSHIONS) group.add(buildCushion(c, cloth, c.len < 0.2 ? 0.022 : CUSHION_DEPTH));

  // Interior de las troneras.
  for (const p of POCKETS) {
    const tube = new THREE.Mesh(new THREE.CylinderGeometry(0.066, 0.06, 0.16, 24, 1, true), hollow);
    tube.position.set(p.x, BED_Y - 0.08 + 0.035, p.z);
    group.add(tube);
    const floor = new THREE.Mesh(new THREE.CircleGeometry(0.07, 20), hollow);
    floor.rotation.x = -Math.PI / 2;
    floor.position.set(p.x, BED_Y - 0.125, p.z);
    group.add(floor);
  }

  // Perfil de aluminio alrededor del marco.
  const trimH = 0.03;
  const trimY = TOP_Y - 0.004 - trimH / 2 - 0.012;
  for (const s of [-1, 1]) {
    group.add(box(0.012, trimH, OUT_Z * 2 - 0.34, alu, s * (OUT_X + 0.005), trimY, 0));
    group.add(box(OUT_X * 2 - 0.34, trimH, 0.012, alu, 0, trimY, s * (OUT_Z + 0.005)));
  }

  // Mueble: paredes este, oeste y sur, fondo, y panel norte con la ventanilla de bolas.
  const cabH = CAB_TOP - CAB_BOTTOM;
  const cabY = (CAB_TOP + CAB_BOTTOM) / 2;
  for (const s of [-1, 1]) group.add(box(0.02, cabH, CAB_Z * 2, black, s * (CAB_X - 0.01), cabY, 0));
  group.add(box(CAB_X * 2, cabH, 0.02, black, 0, cabY, CAB_Z - 0.01));
  group.add(box(CAB_X * 2, 0.02, CAB_Z * 2, blackMatte, 0, CAB_BOTTOM + 0.01, 0));

  const panel = new THREE.Shape();
  panel.moveTo(-CAB_X, CAB_BOTTOM);
  panel.lineTo(CAB_X, CAB_BOTTOM);
  panel.lineTo(CAB_X, CAB_TOP);
  panel.lineTo(-CAB_X, CAB_TOP);
  panel.closePath();
  panel.holes.push(roundedHole(0, 0.615, 0.42, 0.075));
  panel.holes.push(roundedHole(0, 0.5, 0.46, 0.1));
  const panelMesh = new THREE.Mesh(new THREE.ExtrudeGeometry(panel, { depth: 0.02, bevelEnabled: false, curveSegments: 12 }), black);
  panelMesh.position.z = -CAB_Z;
  panelMesh.castShadow = true;
  group.add(panelMesh);
  // Marcos de aluminio de las dos aberturas.
  for (const [cy, w, h] of [[0.615, 0.42, 0.075], [0.5, 0.46, 0.1]]) {
    const outer = roundedHole(0, cy, w + 0.02, h + 0.02, new THREE.Shape());
    outer.holes.push(roundedHole(0, cy, w, h));
    const ring = new THREE.Mesh(new THREE.ExtrudeGeometry(outer, { depth: 0.006, bevelEnabled: false, curveSegments: 12 }), alu);
    ring.position.z = -CAB_Z - 0.005;
    group.add(ring);
  }
  // Hueco tras el panel: fondo oscuro y bandeja donde descansan las bolas embocadas.
  group.add(box(CAB_X * 2 - 0.04, cabH - 0.04, 0.01, hollow, 0, cabY, -CAB_Z + 0.1));
  group.add(box(0.5, 0.012, 0.09, blackMatte, 0, TRAY_Y - R - 0.006, TRAY_Z));
  // Placa del fabricante entre las dos aberturas y en el extremo sur.
  group.add(box(0.09, 0.03, 0.004, alu, 0, 0.558, -CAB_Z - 0.002));
  group.add(box(0.1, 0.035, 0.004, alu, 0, 0.6, CAB_Z + 0.002));
  // Bandeja de monedas en el lado oeste.
  group.add(box(0.012, 0.06, 0.5, alu, -CAB_X - 0.004, 0.52, 0.25));
  group.add(box(0.016, 0.03, 0.4, blackMatte, -CAB_X - 0.008, 0.52, 0.25));

  // Esquinas grises del mueble.
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    // Solo el cuarto exterior del cilindro, para no asomar dentro de la tronera.
    const start = sx > 0 ? (sz > 0 ? 0 : Math.PI / 2) : sz < 0 ? Math.PI : Math.PI * 1.5;
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, cabH + 0.01, 16, 1, true, start - 0.3, Math.PI / 2 + 0.6), grey);
    post.position.set(sx * (OUT_X - 0.1), cabY + 0.005, sz * (OUT_Z - 0.1));
    post.castShadow = true;
    group.add(post);
    // Patas conicas con pie cromado.
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.055, CAB_BOTTOM - 0.02, 20), black);
    leg.position.set(sx * 0.47, (CAB_BOTTOM + 0.02) / 2, sz * 0.93);
    leg.castShadow = true;
    group.add(leg);
    const foot = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.055, 0.02, 20), alu);
    foot.position.set(sx * 0.47, 0.01, sz * 0.93);
    group.add(foot);
  }

  // Tiza azul sobre una esquina.
  const chalk = box(0.022, 0.022, 0.022, new THREE.MeshStandardMaterial({ color: '#2d6fd0', roughness: 0.9 }), -0.6, TOP_Y + 0.008, 1.09);
  chalk.rotation.y = 0.5;
  group.add(chalk);

  return group;
}

// Posicion de la bandeja de bolas embocadas, visible por la ventanilla norte.
export const TRAY_Y = 0.5 - 0.05 + R + 0.004;
export const TRAY_Z = -CAB_Z + 0.055;
export const TABLE_OUT_X = OUT_X;
export const TABLE_OUT_Z = OUT_Z;
