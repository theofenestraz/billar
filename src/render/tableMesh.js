// Malla de la mesa de billar, a escala: 2,36 x 1,37 por fuera, 1,98 x 0,99 de juego.

import * as THREE from 'three';
import { HALF_W, HALF_L, BED_Y, R } from '../physics/constants.js';
import { POCKETS, CUSHIONS } from '../physics/table.js';
import { makeNoiseTexture, makeBumpTexture, makeFeltTextures, makePocketLinerTexture } from './textures.js?v=23';

const OUT_X = 0.685; // media anchura exterior (1,37 / 2)
const OUT_Z = 1.18; // media longitud exterior (2,36 / 2)
const TOP_Y = 0.8; // borde superior
export const TABLE_TOP_Y = TOP_Y;
export const POCKET_HOLE = 0.06; // radio del agujero del tapete en cada tronera
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
    h.absarc(p.x, -p.z, POCKET_HOLE, 0, Math.PI * 2, true);
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

// Normal de un segmento de banda hacia su cuerpo (el lado contrario al de juego).
function bodyNormal(c) {
  const midX = (c.x1 + c.x2) / 2;
  const midZ = (c.z1 + c.z2) / 2;
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
  return { nx, nz };
}

// Vector de inglete en un extremo: los perfiles de dos bandas que se juntan caen en la misma linea,
// asi no queda hueco por fuera ni solape por dentro. Sin vecina, el corte es recto.
function miterAt(x, z, self, n) {
  for (const o of CUSHIONS) {
    if (o === self) continue;
    const shared = (Math.abs(o.x1 - x) < 1e-6 && Math.abs(o.z1 - z) < 1e-6) || (Math.abs(o.x2 - x) < 1e-6 && Math.abs(o.z2 - z) < 1e-6);
    if (!shared) continue;
    const m = bodyNormal(o);
    const dot = n.nx * m.nx + n.nz * m.nz;
    if (dot < -0.5) break; // casi opuestas: el inglete se iria muy lejos
    const k = 1 / (1 + dot);
    return { x: (n.nx + m.nx) * k, z: (n.nz + m.nz) * k };
  }
  return { x: n.nx, z: n.nz };
}

// Banda: el perfil recorre el segmento, con los extremos a inglete. La nariz que toca la bola esta
// redondeada hacia arriba y el canto se sombrea suave; por debajo, la goma se mete hacia dentro.
function buildCushion(c, mat, depth) {
  const n = bodyNormal(c);
  // Un pelo por debajo del marco: si las dos caras de arriba coinciden, parpadean.
  const h = TOP_Y - BED_Y - 0.0008;
  const nose = h * 0.72;
  const rn = 0.009; // radio del canto redondeado entre la nariz y la cara de arriba
  // Perfil en (distancia hacia el cuerpo, altura sobre el tapete), convexo, con marca de suavizado.
  const prof = [[depth * 0.4, 0, false], [0, nose, false]];
  for (let i = 0; i <= 6; i++) {
    const a = Math.PI - (i / 6) * (Math.PI / 2);
    prof.push([rn + rn * Math.cos(a), h - rn + rn * Math.sin(a), true]);
  }
  prof.push([depth, h, false], [depth, 0, false]);
  const k = prof.length;
  // Normal de cada lado del perfil, hacia fuera, en (o, y).
  const pc = prof.reduce((acc, p) => [acc[0] + p[0] / k, acc[1] + p[1] / k], [0, 0]);
  const edgeN = prof.map((p, i) => {
    const q = prof[(i + 1) % k];
    let no = q[1] - p[1];
    let ny = -(q[0] - p[0]);
    const l = Math.hypot(no, ny) || 1;
    no /= l;
    ny /= l;
    if (no * ((p[0] + q[0]) / 2 - pc[0]) + ny * ((p[1] + q[1]) / 2 - pc[1]) < 0) {
      no = -no;
      ny = -ny;
    }
    return [no, ny];
  });
  // Normal suave en los puntos del canto: media de los dos lados que se juntan.
  const smoothN = prof.map((p, i) => {
    const e0 = edgeN[(i - 1 + k) % k];
    const e1 = edgeN[i];
    const l = Math.hypot(e0[0] + e1[0], e0[1] + e1[1]) || 1;
    return [(e0[0] + e1[0]) / l, (e0[1] + e1[1]) / l];
  });
  const ends = [
    { x: c.x1, z: c.z1, m: miterAt(c.x1, c.z1, c, n) },
    { x: c.x2, z: c.z2, m: miterAt(c.x2, c.z2, c, n) },
  ];
  const tx = c.tx;
  const tz = c.tz;
  const ring = ends.map((e) => prof.map(([o, y]) => {
    const x = e.x + e.m.x * o;
    const z = e.z + e.m.z * o;
    // Coordenadas de textura en metros, como el tapete.
    return { p: [x, BED_Y + y, z], uv: [x * tx + z * tz, o + y] };
  }));
  // Centro del cuerpo, para orientar las tapas hacia fuera.
  const cx = (c.x1 + c.x2) / 2 + n.nx * depth * 0.5;
  const cy = BED_Y + h * 0.5;
  const cz = (c.z1 + c.z2) / 2 + n.nz * depth * 0.5;
  const pos = [];
  const uvs = [];
  const nor = [];
  // Normal 3D a partir de la del perfil: o crece hacia el cuerpo, en la direccion n.
  const to3 = ([no, ny]) => [n.nx * no, ny, n.nz * no];
  const push = (v, nn) => {
    pos.push(...v.p);
    uvs.push(...v.uv);
    nor.push(...nn);
  };
  const faceN = (a, b, d) => {
    const ux = b.p[0] - a.p[0], uy = b.p[1] - a.p[1], uz = b.p[2] - a.p[2];
    const vx = d.p[0] - a.p[0], vy = d.p[1] - a.p[1], vz = d.p[2] - a.p[2];
    return [uy * vz - uz * vy, uz * vx - ux * vz, ux * vy - uy * vx];
  };
  // Lados: cada tramo del perfil a lo largo de la banda.
  for (let i = 0; i < k; i++) {
    const j = (i + 1) % k;
    const a0 = ring[0][i], a1 = ring[0][j], b0 = ring[1][i], b1 = ring[1][j];
    const ni = to3(prof[i][2] ? smoothN[i] : edgeN[i]);
    const nj = to3(prof[j][2] ? smoothN[j] : edgeN[i]);
    // Orden de los vertices segun hacia donde mira la cara.
    const fn = faceN(a0, a1, b1);
    const en = to3(edgeN[i]);
    const flip = fn[0] * en[0] + fn[1] * en[1] + fn[2] * en[2] < 0;
    const quad = flip ? [[a0, ni], [b1, nj], [a1, nj], [a0, ni], [b0, ni], [b1, nj]]
      : [[a0, ni], [a1, nj], [b1, nj], [a0, ni], [b1, nj], [b0, ni]];
    for (const [v, nn] of quad) push(v, nn);
  }
  // Tapas de los extremos, planas.
  for (const r of ring) {
    for (let i = 1; i < k - 1; i++) {
      let tri = [r[0], r[i], r[i + 1]];
      const fn = faceN(...tri);
      const m = tri.reduce((acc, v) => [acc[0] + v.p[0] / 3 - cx / 3, acc[1] + v.p[1] / 3 - cy / 3, acc[2] + v.p[2] / 3 - cz / 3], [0, 0, 0]);
      if (fn[0] * m[0] + fn[1] * m[1] + fn[2] * m[2] < 0) tri = [r[0], r[i + 1], r[i]];
      const f = faceN(...tri);
      const l = Math.hypot(...f) || 1;
      for (const v of tri) push(v, [f[0] / l, f[1] / l, f[2] / l]);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
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

  // Fieltro: trama de fibras cortas y relieve fino. Sin brillo: bajo el foco de la mesa el pano se quemaba.
  const felt = makeFeltTextures();
  const cloth = new THREE.MeshStandardMaterial({
    color: '#707070', // el foco de la mesa es muy intenso: sin atenuar, el verde se quemaba hacia blanco
    map: felt.map,
    bumpMap: felt.bump,
    bumpScale: 0.3,
    roughness: 0.97,
    envMapIntensity: 0.1,
  });
  // Laca satinada: el brillo del foco sobre el marco queda como una franja suave, no un manchon blanco.
  // Medido a la altura de los ojos junto a la mesa: con mas brillo, el foco de encima volvia el marco gris claro.
  const black = new THREE.MeshPhysicalMaterial({
    color: '#08080a', roughness: 0.65, specularIntensity: 0.2,
    clearcoat: 0.1, clearcoatRoughness: 0.12, envMapIntensity: 0.3,
  });
  const blackMatte = new THREE.MeshStandardMaterial({ color: '#0a0a0b', roughness: 0.75 });
  const alu = new THREE.MeshStandardMaterial({ color: '#b9bdc3', metalness: 1, roughness: 0.4 });
  const grey = new THREE.MeshStandardMaterial({ color: '#9a9da2', metalness: 0.35, roughness: 0.45, side: THREE.DoubleSide });
  const hollow = new THREE.MeshBasicMaterial({ color: '#020202', side: THREE.DoubleSide });

  group.add(buildBed(cloth));
  group.add(buildFrame(black));
  // Todas las bandas llegan hasta el marco, tambien las bocas: asi no quedan huecos entre banda y marco.
  for (const c of CUSHIONS) group.add(buildCushion(c, cloth, CUSHION_DEPTH));

  // Interior de las troneras: copa de goma negra con costuras, que se oscurece hacia abajo, y el fondo
  // con la boca por donde se van las bolas. Empieza justo en el borde del agujero del tapete (radio
  // POCKET_HOLE), sin asomar por encima: por el lado exterior la pared la pone el propio marco.
  const liner = new THREE.MeshStandardMaterial({ map: makePocketLinerTexture(), roughness: 0.95, side: THREE.DoubleSide, envMapIntensity: 0.05 });
  const cup = new THREE.MeshStandardMaterial({ color: '#0c0c0d', roughness: 0.95 });
  for (const p of POCKETS) {
    const tube = new THREE.Mesh(new THREE.CylinderGeometry(POCKET_HOLE, POCKET_HOLE - 0.004, 0.14, 32, 1, true), liner);
    tube.position.set(p.x, BED_Y - 0.0715, p.z); // de BED_Y - 0,1415 a BED_Y - 0,0015, bajo el tapete
    tube.receiveShadow = true;
    group.add(tube);
    // Fondo en forma de cuenco y un hueco oscuro en el centro.
    const bowl = new THREE.Mesh(new THREE.SphereGeometry(POCKET_HOLE - 0.004, 24, 8, 0, Math.PI * 2, Math.PI * 0.62, Math.PI * 0.38), cup);
    bowl.position.set(p.x, BED_Y - 0.1, p.z);
    group.add(bowl);
    const hole = new THREE.Mesh(new THREE.CircleGeometry(0.03, 20), hollow);
    hole.rotation.x = -Math.PI / 2;
    hole.position.set(p.x, BED_Y - 0.158, p.z);
    group.add(hole);
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
  // Las piezas se tocan sin solaparse: asi ninguna cara coincide con otra y no parpadean.
  for (const s of [-1, 1]) group.add(box(0.02, cabH, CAB_Z * 2 - 0.02, black, s * (CAB_X - 0.01), cabY, 0.01));
  group.add(box(CAB_X * 2 - 0.04, cabH, 0.02, black, 0, cabY, CAB_Z - 0.01));
  group.add(box(CAB_X * 2 - 0.04, 0.02, CAB_Z * 2 - 0.04, blackMatte, 0, CAB_BOTTOM + 0.01, 0));

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
