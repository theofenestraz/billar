// Recreacion de la sala a partir de los fotogramas de referencia.
// Ejes: x este, z sur, origen en el centro de la mesa. Medidas estimadas con la mesa como escala.

import * as THREE from 'three';
import {
  makeNoiseTexture, makeBumpTexture, makeDartboardTexture, makePosterTexture, makeSignTexture,
  makeNeonRackTexture, makeWashTexture, makeCirclesPanelTexture, makePlasticTexture, makeSafetySignTexture,
} from './textures.js?v=13';
import { buildFoosball, buildShellChair, buildVendingMachine, buildHighTable, buildCafeSet } from './props.js?v=13';

export const ROOM = {
  minX: -4.6, maxX: 7.3, minZ: -8.0, maxZ: 5.7, height: 3.0,
  neon: { x: -0.4, y: 2.25, z: -7.86 },
};
const H = ROOM.height;

export function buildRoom() {
  const group = new THREE.Group();
  const colliders = [];
  const floors = [];
  const glow = []; // mallas emisivas, por si la iluminacion necesita localizarlas

  // ---------- Materiales ----------
  // Las superficies mate apenas reflejan el entorno, para que no pierdan color.
  // Los materiales iguales se comparten, para que sus piezas puedan fundirse en una sola malla.
  const cache = new Map();
  const shared = (kind, o, make) => {
    for (const v of Object.values(o)) if (v && typeof v === 'object') return make(); // con texturas no se comparte
    const key = kind + JSON.stringify(o);
    if (!cache.has(key)) cache.set(key, make());
    return cache.get(key);
  };
  const std = (o) => shared('std', o, () => new THREE.MeshStandardMaterial({ envMapIntensity: 0.15, ...o }));
  const carpet = std({ map: makeNoiseTexture({ base: '#7b7c80', spread: 30, seed: 21, repeat: 10 }), bumpMap: makeBumpTexture({ seed: 9, repeat: 10 }), bumpScale: 0.6, roughness: 1 });
  const wallDark = std({ map: makeNoiseTexture({ base: '#4a4e52', spread: 8, seed: 3, repeat: 3 }), roughness: 0.95 });
  const wallGrey = std({ map: makeNoiseTexture({ base: '#63676b', spread: 8, seed: 4, repeat: 3 }), roughness: 0.95 });
  for (const m of [wallDark, wallGrey]) {
    m.emissive = new THREE.Color('#ffffff');
    m.emissiveMap = m.map;
    m.emissiveIntensity = 2.8;
  }
  const wallPale = std({ color: '#b3a199', roughness: 0.9 });
  const ceilingMat = std({ color: '#1b1b1e', roughness: 1 });
  const concrete = std({ map: makeNoiseTexture({ base: '#d6d3c8', spread: 14, seed: 8 }), bumpMap: makeBumpTexture({ seed: 12, pits: 260 }), bumpScale: 0.5, roughness: 0.92 });
  concrete.map.repeat.set(2, 7);
  concrete.bumpMap.repeat.set(2, 7);
  const orangeTop = std({ map: makeNoiseTexture({ base: '#f26a12', spread: 14, seed: 5, repeat: 2 }), roughness: 0.8 });
  const riser = std({ color: '#2b1f17', roughness: 0.85 });
  const tierMat = [riser, riser, orangeTop, riser, riser, riser];
  const blackMat = std({ color: '#0e0e10', roughness: 0.6 });
  const metalDark = std({ color: '#1a1b1d', roughness: 0.5, metalness: 0.6 });
  const white = std({ color: '#ecebe6', roughness: 0.7 });
  const yellow = std({ color: '#f0cf22', roughness: 0.7 });
  const greyFabric = std({ color: '#b6b7b1', roughness: 0.85 });
  const orangeFabric = std({ color: '#f0a020', roughness: 0.75 });
  const orangeSeat = std({ color: '#f08a1c', roughness: 0.55 });
  const wood = std({ color: '#d9c39a', roughness: 0.7 });
  const darkWood = std({ color: '#2a1c16', roughness: 0.5 });
  const chrome = std({ color: '#d0d3d6', roughness: 0.25, metalness: 1, envMapIntensity: 1 });
  const red = std({ color: '#b3202a', roughness: 0.5 });
  const glass = new THREE.MeshPhysicalMaterial({ color: '#ffffff', transparent: true, opacity: 0.1, roughness: 0.03, metalness: 0, envMapIntensity: 0.7, depthWrite: false });
  // Material que emite luz. boost > 1 lo saca del rango normal para que el resplandor lo recoja.
  const emissive = (color, boost = 1) => shared('emi', { color, boost }, () => {
    const m = new THREE.MeshBasicMaterial({ color });
    m.color.multiplyScalar(boost);
    m.toneMapped = false;
    return m;
  });

  // ---------- Ayudas ----------
  function block(x0, x1, y0, y1, z0, z1, mat, opts = {}) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(x1 - x0, y1 - y0, z1 - z0), mat);
    m.position.set((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
    m.castShadow = opts.cast !== false;
    m.receiveShadow = true;
    group.add(m);
    if (opts.collide) colliders.push({ minX: x0, maxX: x1, minZ: z0, maxZ: z1 });
    return m;
  }
  const collide = (x0, x1, z0, z1) => colliders.push({ minX: x0, maxX: x1, minZ: z0, maxZ: z1 });
  function cyl(r, h, mat, x, y, z, seg = 24, rTop = r) {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(rTop, r, h, seg), mat);
    m.position.set(x, y, z);
    m.castShadow = true;
    m.receiveShadow = true;
    group.add(m);
    return m;
  }
  // Panel plano pegado a una pared. face: 'w' mira al oeste, 'e' al este, 'n' al norte, 's' al sur.
  function panel(w, h, mat, x, y, z, face) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
    m.position.set(x, y, z);
    m.rotation.y = { w: -Math.PI / 2, e: Math.PI / 2, n: Math.PI, s: 0 }[face];
    m.receiveShadow = true;
    group.add(m);
    return m;
  }
  const textured = (tex, extra = {}) => std({ map: tex, roughness: 0.8, ...extra });

  // ---------- Suelo y techo ----------
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(46, 30), carpet);
  carpet.map.repeat.set(46, 30);
  carpet.bumpMap.repeat.set(46, 30);
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(6, 0, 0);
  floor.receiveShadow = true;
  group.add(floor);
  const ceiling = new THREE.Mesh(new THREE.PlaneGeometry(46, 30), ceilingMat);
  ceiling.rotation.x = Math.PI / 2;
  ceiling.position.set(6, H, 0);
  group.add(ceiling);

  const W = ROOM.minX; // pared oeste
  const E = ROOM.maxX; // pared este
  const N = ROOM.minZ; // pared norte
  const S = ROOM.maxZ; // pared sur

  // ---------- Paredes ----------
  // Norte.
  block(W - 0.2, E + 0.2, 0, H, N - 0.2, N, wallDark, { collide: true, cast: false });
  // Pared clara en diagonal del noroeste, con su tira verde.
  {
    const a = [W, -4.2];
    const b = [-3.6, N];
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    const m = new THREE.Mesh(new THREE.BoxGeometry(len, H, 0.12), wallPale);
    m.position.set((a[0] + b[0]) / 2, H / 2, (a[1] + b[1]) / 2);
    m.rotation.y = -Math.atan2(b[1] - a[1], b[0] - a[0]);
    m.receiveShadow = true;
    group.add(m);
    collide(W, -4.35, -5.5, -4.2);
    collide(W, -4.05, -6.7, -5.5);
    collide(W, -3.75, N, -6.7);
    block(-3.62, -3.54, 0, H, N, N + 0.08, emissive('#28d86a', 1.6), { cast: false });
  }
  // Este (pared gris de la diana). Termina antes de la zona abierta del sureste.
  const E_END = 0.6;
  block(E, E + 0.2, 0, H, N, E_END, wallGrey, { collide: true, cast: false });
  // Oeste, con el ventanal.
  const WIN = { z0: -4.15, z1: 2.4, y0: 1.25, y1: 2.5 };
  block(W - 0.2, W, 0, WIN.y0, WIN.z0, WIN.z1, wallDark, { cast: false });
  block(W - 0.2, W, WIN.y1, H, WIN.z0, WIN.z1, wallDark, { cast: false });
  block(W - 0.2, W, 0, H, N, WIN.z0, wallDark, { cast: false });
  // Junto al pilar la pared oeste se abre al pasillo de las maquinas, que corre hacia el oeste.
  // Lado norte del pasillo: murete con cristal encima. Lado sur: la pared curva.
  const COR = { n: 2.6, s: S - 0.5, glassEnd: -10.4, end: -12.6, sill: 1.12, top: 2.45 };
  block(W - 0.2, W, 0, H, WIN.z1, COR.n, wallDark, { cast: false });
  collide(W - 0.2, W, N, COR.n);
  block(COR.glassEnd, W - 0.2, 0, COR.sill, COR.n - 0.2, COR.n, wallDark, { cast: false });
  block(COR.glassEnd, W - 0.2, COR.sill, COR.sill + 0.03, COR.n - 0.22, COR.n + 0.02, blackMat, { cast: false });
  block(COR.glassEnd, W - 0.2, COR.top, H, COR.n - 0.2, COR.n, wallDark, { cast: false });
  block(COR.glassEnd - 0.45, COR.glassEnd, 0, H, COR.n - 0.25, COR.n + 0.03, std({ color: '#d9d5d0', roughness: 0.85 }), { cast: false });
  block(COR.end, COR.glassEnd - 0.45, 0, H, COR.n - 0.2, COR.n, wallDark, { cast: false });
  const pane2 = new THREE.Mesh(new THREE.PlaneGeometry(W - COR.glassEnd, COR.top - COR.sill), glass);
  pane2.position.set((W + COR.glassEnd) / 2, (COR.sill + COR.top) / 2, COR.n - 0.01);
  group.add(pane2);
  for (const x of [-6.05, -7.5, -8.95]) block(x - 0.006, x + 0.006, COR.sill, COR.top, COR.n - 0.015, COR.n - 0.005, metalDark, { cast: false });
  // Marco blanco del ventanal y cristales.
  // El marco cubre todo el canto del muro y sobresale un poco, para que ninguna cara coincida con otra.
  block(W - 0.215, W + 0.04, WIN.y0 - 0.05, WIN.y0 + 0.012, WIN.z0 - 0.01, WIN.z1 + 0.01, white, { cast: false });
  block(W - 0.215, W + 0.04, WIN.y1 - 0.012, WIN.y1 + 0.05, WIN.z0 - 0.01, WIN.z1 + 0.01, white, { cast: false });
  const pane = new THREE.Mesh(new THREE.PlaneGeometry(WIN.z1 - WIN.z0, WIN.y1 - WIN.y0), glass);
  pane.position.set(W - 0.03, (WIN.y0 + WIN.y1) / 2, (WIN.z0 + WIN.z1) / 2);
  pane.rotation.y = Math.PI / 2;
  group.add(pane);
  for (let i = 1; i < 4; i++) {
    const z = WIN.z0 + ((WIN.z1 - WIN.z0) * i) / 4;
    block(W - 0.045, W - 0.015, WIN.y0 + 0.012, WIN.y1 - 0.012, z - 0.008, z + 0.008, metalDark, { cast: false });
  }
  // Sala blanca tras el ventanal, con los tubos de neon de colores.
  const whiteRoom = emissive('#ece6e2');
  const BACK = W - 2.0;
  block(BACK - 0.1, BACK, 0.6, H, N, 2.4, whiteRoom, { cast: false });
  block(BACK, W - 0.2, 0.7, 0.75, N, 2.35, emissive('#8f8a87'), { cast: false });
  block(BACK, W - 0.2, H - 0.3, H - 0.25, N, 2.35, emissive('#a7a19e'), { cast: false });
  block(BACK, W - 0.2, 0.6, H, N - 0.05, N, whiteRoom, { cast: false });
  block(BACK, W - 0.2, 0.6, H, 2.35, 2.4, whiteRoom, { cast: false });
  const tubeColors = ['#fff6e8', '#ffd23c', '#ffb02e', '#ffe9ef', '#ff5aa8', '#ff8fd0', '#fff6e8', '#fff6e8', '#bfeaff', '#55d8ff'];
  const tubeGeo = new THREE.CylinderGeometry(0.02, 0.02, 0.36, 8);
  tubeColors.forEach((color, col) => {
    const mat = emissive(color, 2.2);
    for (let row = 0; row < 3; row++) {
      const t = new THREE.Mesh(tubeGeo, mat);
      t.position.set(BACK + 0.13, 1.5 + row * 0.36, 1.9 - col * 0.4);
      // Zigzag: cada fila se inclina al reves que la anterior.
      t.rotation.x = row % 2 ? 0.62 : -0.62;
      group.add(t);
      glow.push(t);
    }
  });
  // Rotulo de neon colgado delante de los tubos, con la misma silueta que el verde.
  {
    const logo = [[-0.6, 0.7], [0.55, 0.7], [0.65, 0.6], [0.65, 0.12], [0.44, -0.1], [0.44, -0.22], [0.63, -0.58], [0.52, -0.7], [-0.6, -0.7], [-0.68, -0.6], [-0.68, 0.6]]
      .map(([a, b]) => new THREE.Vector3(BACK + 0.55, 1.95 + b * 0.5, 0.1 + a * 0.5));
    const half = Math.ceil(logo.length / 2);
    const top = new THREE.CatmullRomCurve3(logo.slice(0, half + 1), false, 'catmullrom', 0.12);
    const bottom = new THREE.CatmullRomCurve3([...logo.slice(half), logo[0]], false, 'catmullrom', 0.12);
    const l1 = new THREE.Mesh(new THREE.TubeGeometry(top, 60, 0.012, 6), emissive('#6ff0e0', 4));
    const l2 = new THREE.Mesh(new THREE.TubeGeometry(bottom, 60, 0.012, 6), emissive('#ff6ad0', 4));
    group.add(l1, l2);
    glow.push(l1, l2);
  }
  // Carril de focos negros dentro de la sala blanca.
  block(W - 1.0, W - 0.97, 2.56, 2.59, -2.6, 1.6, blackMat, { cast: false });
  for (const z of [-2.2, -1.0, 0.2, 1.3]) block(W - 1.03, W - 0.94, 2.4, 2.56, z - 0.04, z + 0.04, blackMat, { cast: false });

  // Sala de neones tras el cristal del pasillo, al oeste de la sala blanca.
  {
    const X0 = COR.glassEnd;
    const X1 = BACK - 0.1;
    const ZB = -1.0;
    const dim = emissive('#8c8789');
    block(X0, X1, 0.4, H, ZB - 0.1, ZB, dim, { cast: false });
    block(X0, X1, 0.5, 0.55, ZB, COR.n - 0.2, emissive('#5d5a5e'), { cast: false });
    block(X0, X1, 2.62, 2.67, ZB, COR.n - 0.2, emissive('#a39ea0'), { cast: false });
    block(X0 - 0.05, X0, 0.5, H, ZB, COR.n - 0.25, dim, { cast: false });
    const rackMat = new THREE.MeshBasicMaterial({ map: makeNeonRackTexture(), toneMapped: false });
    rackMat.color.multiplyScalar(1.7);
    panel(X1 - X0 - 0.1, 1.65, rackMat, (X0 + X1) / 2, 1.72, 1.2, 's');
    const rackFar = rackMat.clone();
    rackFar.color.multiplyScalar(0.6);
    panel(X1 - X0 - 0.1, 1.65, rackFar, (X0 + X1) / 2 - 0.5, 1.72, 0.1, 's');
  }

  // Sur: cristalera con plantas, pilar, pasillo de salida y pared curva.
  const GL0 = 1.2;
  const GL1 = 7.2;
  block(GL0, GL1, 0, 0.5, S, S + 0.4, wallDark, { cast: false });
  const southGlass = new THREE.Mesh(new THREE.PlaneGeometry(GL1 - GL0, H - 0.5), glass);
  southGlass.position.set((GL0 + GL1) / 2, 0.5 + (H - 0.5) / 2, S + 0.15);
  southGlass.rotation.y = Math.PI;
  group.add(southGlass);
  for (let x = GL0; x <= GL1 + 0.01; x += (GL1 - GL0) / 5) block(x - 0.04, x + 0.04, 0.5, H, S + 0.1, S + 0.2, metalDark, { cast: false });
  collide(GL0, 9, S, S + 0.4);
  // Plantas y fondo tras la cristalera.
  const leaf = std({ color: '#1f4a2a', roughness: 0.9 });
  for (const [x, z, sc] of [[1.9, 6.8, 1], [3.1, 7.1, 1.3], [4.3, 6.7, 0.9], [5.5, 7.2, 1.2]]) {
    const p = new THREE.Mesh(new THREE.SphereGeometry(0.55 * sc, 10, 8), leaf);
    p.scale.set(1, 1.5, 1);
    p.position.set(x, 1.5, z);
    group.add(p);
    cyl(0.2, 0.6, blackMat, x, 0.5, z, 10);
  }
  block(0.4, 12, 0, H, 10, 10.1, wallDark, { cast: false });
  panel(1.6, 0.9, emissive('#c76a1e'), 2.6, 1.2, 9.95, 'n');
  panel(1.0, 0.5, emissive('#2bd67a'), 4.8, 1.7, 9.95, 'n');
  // Banco curvo de madera clara bajo la cristalera, con cojines redondos grises.
  {
    const cx = 4.05, cz = S + 1.75, r0 = 1.95, r1 = 2.45, a0 = -Math.PI / 2 - 0.62, a1 = -Math.PI / 2 + 0.62;
    const sh = new THREE.Shape();
    sh.absarc(0, 0, r1, a0, a1, false);
    sh.absarc(0, 0, r0, a1, a0, true);
    const geo = new THREE.ExtrudeGeometry(sh, { depth: 0.44, bevelEnabled: false, curveSegments: 20 });
    geo.rotateX(Math.PI / 2); // la forma (x, y) pasa al suelo (x, z) y el grosor queda hacia abajo
    const bench = new THREE.Mesh(geo, wood);
    bench.position.set(cx, 0.44, cz);
    bench.castShadow = true;
    bench.receiveShadow = true;
    group.add(bench);
    for (const a of [-0.42, 0, 0.42]) {
      const ang = -Math.PI / 2 + a;
      cyl(0.2, 0.035, greyFabric, cx + Math.cos(ang) * 2.2, 0.458, cz + Math.sin(ang) * 2.2, 20);
    }
    collide(2.5, 5.6, S - 0.75, S);
  }
  // Pilar recto sur.
  block(0.55, 1.2, 0, H, S - 0.35, S + 0.3, concrete, { collide: true });
  // Pasillo de salida: se ve pero no se entra.
  const C0 = -0.7;
  const C1 = 0.35;
  block(C0 - 0.2, C0, 0, H, S, S + 4.2, wallDark, { cast: false });
  block(C1, C1 + 0.2, 0, H, S, S + 4.2, wallDark, { cast: false });
  block(C0 - 0.2, C1 + 0.2, 0, H, S + 4.2, S + 4.3, wallGrey, { cast: false });
  block(C0, C1, 2.25, H, S - 0.05, S + 0.05, wallDark, { cast: false });
  block(C1, 0.55, 0, H, S - 0.05, S, wallDark, { cast: false });
  panel(0.5, 0.17, new THREE.MeshBasicMaterial({ map: makeSignTexture({ text: 'SALIDA' }), toneMapped: false }), (C0 + C1) / 2, 2.42, S - 0.06, 'n');
  collide(C0 - 0.2, 0.6, S - 0.12, S + 0.3);
  // Pared curva del suroeste: sale de la salida, gira y sigue hacia el oeste como lado sur del pasillo.
  const arc = [[C0, S], [-1.8, S - 0.05], [-3.0, S - 0.2], [-4.2, S - 0.4], [-5.4, COR.s], [COR.end, COR.s]];
  for (let i = 0; i < arc.length - 1; i++) {
    const [x0, z0] = arc[i];
    const [x1, z1] = arc[i + 1];
    const len = Math.hypot(x1 - x0, z1 - z0);
    const m = new THREE.Mesh(new THREE.BoxGeometry(len + 0.08, H, 0.2), wallDark);
    m.position.set((x0 + x1) / 2, H / 2, (z0 + z1) / 2);
    m.rotation.y = -Math.atan2(z1 - z0, x1 - x0);
    m.translateZ(-0.1);
    m.receiveShadow = true;
    group.add(m);
    if (x0 > W) collide(Math.max(W, Math.min(x0, x1)) - 0.05, Math.max(x0, x1) + 0.05, Math.min(z0, z1) - 0.05, S + 1);
  }
  // El pasillo es decorativo: una pared invisible lo cierra a la altura de la pared oeste.
  collide(W - 0.4, W, COR.n - 0.2, S + 1);
  // Fondo del pasillo y techo rebajado.
  block(COR.end - 0.2, COR.end, 0, H, COR.n - 0.2, COR.s + 0.2, std({ color: '#3f3c45', roughness: 0.95, emissive: '#3f3c45', emissiveIntensity: 0.5 }), { cast: false });
  const soffit = std({ color: '#4c4d50', roughness: 1, emissive: '#4c4d50', emissiveIntensity: 0.45 });
  block(COR.end, -3.75, 2.5, H, COR.n, COR.s + 0.1, soffit, { cast: false });
  for (const [x, z] of [[-4.6, 3.4], [-5.9, 4.4], [-7.2, 3.3], [-8.5, 4.4], [-9.8, 3.4], [-11.2, 4.2]]) {
    block(x - 0.035, x + 0.035, 2.37, 2.5, z - 0.035, z + 0.035, blackMat, { cast: false });
    const lens = new THREE.Mesh(new THREE.CircleGeometry(0.026, 10), emissive('#fff3da', 4));
    lens.rotation.x = Math.PI / 2;
    lens.position.set(x, 2.366, z);
    group.add(lens);
  }
  block(-6.9, -6.55, 2.49, 2.5, 3.6, 4.2, blackMat, { cast: false });
  block(-9.4, -9.05, 2.49, 2.5, 3.5, 4.1, blackMat, { cast: false });
  // Maquinas expendedoras al fondo, mirando al este, y mesa alta contra la pared sur.
  {
    const snack = buildVendingMachine('snack');
    snack.position.set(COR.end + 0.4, 0, COR.s - 0.62);
    snack.rotation.y = Math.PI / 2;
    const coffee = buildVendingMachine('coffee');
    coffee.position.set(COR.end + 0.35, 0, COR.s - 1.48);
    coffee.rotation.y = Math.PI / 2;
    const table = buildHighTable();
    table.position.set(COR.end + 1.45, 0, COR.s - 0.32);
    table.rotation.y = -Math.PI / 2;
    group.add(snack, coffee, table);
  }
  // Senales, armario rojo, extintor y puerta sobre la pared sur del pasillo.
  function onWall(x0, z0, x1, z1, t, build) {
    const g = new THREE.Group();
    g.position.set(x0 + (x1 - x0) * t, 0, z0 + (z1 - z0) * t);
    g.rotation.y = -Math.atan2(z1 - z0, x1 - x0);
    build(g);
    group.add(g);
  }
  const flat = (w, h, mat, x, y) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
    m.position.set(x, y, 0.012);
    return m;
  };
  const signTall = std({ map: makeSafetySignTexture({ tall: true }), roughness: 0.6 });
  const signSmall = std({ map: makeSafetySignTexture({ tall: false }), roughness: 0.6 });
  onWall(...arc[3], ...arc[4], 0.5, (g) => {
    const bell = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.075, 0.07, 16), red);
    bell.rotation.x = Math.PI / 2;
    bell.position.set(0, 2.15, 0.05);
    g.add(flat(0.2, 0.5, signTall, 0, 1.75), bell, flat(0.11, 0.22, signSmall, 0, 2.38));
  });
  // Tramo recto: x local crece hacia el oeste, desde el final de la curva.
  onWall(...arc[4], ...arc[5], 0, (g) => {
    const teal = new THREE.Mesh(new THREE.CircleGeometry(0.13, 24), emissive('#3db8c4'));
    teal.position.set(0.4, 1.75, 0.012);
    const cab = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.85, 0.16), red);
    cab.position.set(1.9, 1.42, 0.08);
    const call = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, 0.04), red);
    call.position.set(1.2, 0.78, 0.02);
    const ext = new THREE.Mesh(new THREE.CylinderGeometry(0.065, 0.065, 0.42, 12), red);
    ext.position.set(2.5, 0.98, 0.09);
    const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.03, 0.1, 8), blackMat);
    neck.position.set(2.5, 1.24, 0.09);
    const frame = flat(0.98, 2.14, std({ color: '#e6e3dc', roughness: 0.6 }), 3.6, 1.07);
    const door = flat(0.84, 2.04, std({ color: '#cfccc5', roughness: 0.55 }), 3.6, 1.02);
    door.position.z = 0.016;
    g.add(teal, flat(0.1, 0.24, signSmall, 0.95, 2.05), flat(0.1, 0.24, signSmall, 1.12, 2.05), cab, call, ext, neck, frame, door,
      flat(0.1, 0.1, emissive('#39c46a'), 4.3, 1.62));
  });

  // Limite del sureste: la zona de cafeteria se ve pero no se pisa.
  collide(8.0, 30, E_END, S + 1);
  collide(E, 30, E_END - 0.2, E_END + 0.2);
  {
    // Sin luces reales tan lejos: materiales que ya llevan pintado su bano de luz.
    const far = (color) => shared('far', { color }, () => new THREE.MeshBasicMaterial({ color, toneMapped: false }));
    const wash = (o) => new THREE.MeshBasicMaterial({ map: makeWashTexture(o), toneMapped: false });
    // Tramo de pared con el panel de circulos envuelto en plastico y los cubos azules.
    block(E + 0.2, 9.25, 0, H, E_END - 0.2, E_END, wallDark, { cast: false });
    panel(1.7, 2.4, std({ map: makeCirclesPanelTexture(), roughness: 0.5 }), 8.35, 1.22, E_END + 0.03, 's');
    const wrap = panel(1.95, 2.55, new THREE.MeshPhysicalMaterial({
      map: makePlasticTexture(), color: '#ffffff', transparent: true, opacity: 0.55, roughness: 0.12, envMapIntensity: 1.2, depthWrite: false,
    }), 8.35, 1.28, E_END + 0.1, 's');
    wrap.rotation.x = 0.03;
    const bucket = std({ color: '#2456b8', roughness: 0.45 });
    cyl(0.13, 0.27, bucket, 8.95, 0.135, E_END + 0.45, 16, 0.16);
    cyl(0.13, 0.27, bucket, 9.25, 0.135, E_END + 0.3, 16, 0.16);
    // Hueco de puerta con suelo naranja.
    block(9.25, 9.95, 0, 0.012, -1.6, E_END, far('#c4561a'), { cast: false });
    block(9.25, 9.95, 0, H, -1.7, -1.6, far('#17181a'), { cast: false });
    block(9.25, 9.95, 2.2, H, E_END - 0.2, E_END, far('#1d1e21'), { cast: false });
    // Bloque gris iluminado por un foco.
    block(9.95, 13.3, 0, H, -2.0, 1.7, far('#33363a'), { cast: false });
    panel(3.35, H, wash({ base: '#3a3d41', light: '#8f918e', spread: 0.55 }), 11.625, H / 2, 1.705, 's');
    panel(1.1, H, wash({ base: '#2c2e32', light: '#4a4c4f', spread: 0.6 }), 9.945, H / 2, 1.15, 'w');
    panel(0.2, 0.2, far('#e8cf1c'), 9.94, 1.92, 1.25, 'w').geometry = new THREE.CircleGeometry(0.1, 20);
    // Segundo bloque, mas lejos, con cartel, extintor y macetero.
    block(15.0, 16.0, 0, H, -2.0, 2.4, far('#4b4e53'), { cast: false });
    panel(1.0, H, wash({ base: '#484b50', light: '#7d7f80', spread: 0.6 }), 14.995, H / 2, 1.9, 'w');
    panel(0.22, 0.16, far('#d9d9d6'), 14.99, 1.85, 1.9, 'w');
    cyl(0.06, 0.4, far('#8f1f24'), 14.9, 0.9, 2.5, 10);
    cyl(0.2, 0.4, far('#a9a8a2'), 14.6, 0.2, 2.6, 16);
    // Pared del fondo, con dos banos de luz, y cierre norte y sur de la cafeteria.
    block(23, 23.1, 0, H, -2, 9, far('#2b2d31'), { cast: false });
    panel(4.5, H, wash({ base: '#2b2d31', light: '#5c5e60', spread: 0.6 }), 22.99, H / 2, 2.6, 'w');
    panel(4.5, H, wash({ base: '#2b2d31', light: '#5c5e60', spread: 0.6 }), 22.99, H / 2, 6.6, 'w');
    block(16.0, 23, 0, H, 0.6, 0.7, far('#26282b'), { cast: false });
    block(GL1, 23, 0, H, 7.6, 7.7, far('#1b1c1f'), { cast: false });
    // Pilar verde palido y puf blanco.
    block(12.3, 13.3, 0, H, 5.9, 6.4, far('#8fa095'), { cast: false });
    cyl(0.6, 0.42, far('#a7a6a1'), 17.0, 0.21, 2.6, 24);
    // Mesas con sillas claras y una amarilla.
    const set1 = buildCafeSet(['#b9b4a8', '#b9b4a8', '#b9b4a8', '#b9b4a8']);
    set1.position.set(18.6, 0, 3.6);
    const set2 = buildCafeSet(['#b9b4a8', '#d9b21c', '#b9b4a8', '#b9b4a8']);
    set2.position.set(20.6, 0, 4.4);
    set2.rotation.y = 0.2;
    const set3 = buildCafeSet(['#b9b4a8', '#b9b4a8', '#d9b21c', '#b9b4a8']);
    set3.position.set(19.4, 0, 6.2);
    set3.rotation.y = -0.15;
    group.add(set1, set2, set3);
    // Lineas de luz del techo liso de esa zona.
    for (const [x, z] of [[11.0, 3.4], [13.6, 4.6], [16.4, 3.2], [18.8, 5.0], [21.0, 3.6]]) {
      block(x - 0.4, x + 0.4, H - 0.015, H - 0.005, z - 0.03, z + 0.03, emissive('#f3f1ea', 2), { cast: false });
    }
  }

  // ---------- Gradas ----------
  const G0 = -3.3; // extremo oeste de los niveles
  const G1 = 2.0; // extremo este de los niveles 1 y 2
  const T0 = -4.5; // frente de la tarima base
  const T1 = T0 - 0.9;
  const T2 = T1 - 0.9;
  const T3 = T2 - 0.9;
  // Tarima base: parte principal y parte oeste, mas retrasada.
  block(W, -2.5, 0, 0.12, N, T0 - 0.6, tierMat);
  block(-2.5, 2.7, 0, 0.12, N, T0, tierMat);
  floors.push({ minX: W, maxX: -2.5, minZ: N, maxZ: T0 - 0.6, y: 0.12 }, { minX: -2.5, maxX: 2.7, minZ: N, maxZ: T0, y: 0.12 });
  // Nivel 1, con hueco de paso.
  const S1 = [-2.25, -0.95];
  block(G0, S1[0], 0, 0.52, N, T1, tierMat);
  block(S1[1], G1, 0, 0.52, N, T1, tierMat);
  block(S1[0], S1[1], 0, 0.52, N, T1 - 0.45, tierMat);
  block(S1[0], S1[1], 0, 0.32, T1 - 0.45, T1, tierMat);
  floors.push({ minX: G0, maxX: G1, minZ: N, maxZ: T1 - 0.45, y: 0.52 }, { minX: G0, maxX: S1[0], minZ: T1 - 0.45, maxZ: T1, y: 0.52 },
    { minX: S1[1], maxX: G1, minZ: T1 - 0.45, maxZ: T1, y: 0.52 }, { minX: S1[0], maxX: S1[1], minZ: T1 - 0.45, maxZ: T1, y: 0.32 });
  // Nivel 2, con hueco de paso.
  const S2 = [-2.5, -1.25];
  // Cada nivel entra unos milimetros respecto al de abajo, para que sus costados no coincidan.
  block(G0 + 0.004, S2[0], 0, 0.92, N, T2, tierMat);
  block(S2[1], G1 - 0.004, 0, 0.92, N, T2, tierMat);
  block(S2[0], S2[1], 0, 0.92, N, T2 - 0.45, tierMat);
  block(S2[0], S2[1], 0, 0.72, T2 - 0.45, T2, tierMat);
  floors.push({ minX: G0, maxX: G1, minZ: N, maxZ: T2 - 0.45, y: 0.92 }, { minX: G0, maxX: S2[0], minZ: T2 - 0.45, maxZ: T2, y: 0.92 },
    { minX: S2[1], maxX: G1, minZ: T2 - 0.45, maxZ: T2, y: 0.92 }, { minX: S2[0], maxX: S2[1], minZ: T2 - 0.45, maxZ: T2, y: 0.72 });
  // Nivel 3: respaldo contra la pared, no pisable.
  block(G0 + 0.008, 2.7 - 0.004, 0, 1.32, N, T3, tierMat, { collide: true });

  // Neon verde de la pared norte.
  const n = ROOM.neon;
  const pts = [[-0.6, 0.7], [0.55, 0.7], [0.65, 0.6], [0.65, 0.12], [0.44, -0.1], [0.44, -0.22], [0.63, -0.58], [0.52, -0.7], [-0.6, -0.7], [-0.68, -0.6], [-0.68, 0.6]]
    .map(([x, y]) => new THREE.Vector3(n.x + x * 1.06, n.y + y * 1.04, n.z));
  const neonCurve = new THREE.CatmullRomCurve3(pts, true, 'catmullrom', 0.12);
  const neon = new THREE.Mesh(new THREE.TubeGeometry(neonCurve, 160, 0.024, 8, true), emissive('#3dff8a', 6));
  group.add(neon);
  glow.push(neon);

  // ---------- Pilares ----------
  // Pilar inclinado: pie en (x, z), cabeza desplazada lean metros en x al llegar al techo.
  function leaningPillar(x, z, lean, w, d) {
    const len = Math.hypot(lean, H) + 0.5;
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, len, d), concrete);
    m.position.set(x + lean / 2, H / 2, z);
    m.rotation.z = -Math.atan2(lean, H);
    m.castShadow = true;
    m.receiveShadow = true;
    group.add(m);
    collide(x - w / 2 - 0.05, x + w / 2 + 0.05, z - d / 2, z + d / 2);
  }
  // A del norte, junto a las gradas, con un banco naranja al fondo.
  leaningPillar(2.9, -7.2, 1.5, 0.75, 0.6);
  leaningPillar(5.9, -7.2, -1.5, 0.75, 0.6);
  block(2.7, 6.2, 0, 0.45, N, -7.5, tierMat, { collide: true });
  // A del sureste, sobre el futbolin.
  // Los dos pies a la misma profundidad y las cabezas juntas, para que formen la A.
  leaningPillar(3.6, 2.4, 1.85, 1.0, 0.6);
  leaningPillar(7.2, 2.4, -1.75, 1.0, 0.6);
  // Pilar recto junto a la entrada, con el taco apoyado y la papelera.
  const P = { x: -3.05, z: 1.5, h: 0.4 };
  block(P.x - P.h, P.x + P.h, 0, H, P.z - P.h, P.z + P.h, concrete, { collide: true });
  const leanCue = new THREE.Group();
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.012, 1.45, 10), std({ color: '#e2c48d', roughness: 0.5 }));
  shaft.position.y = 0.725;
  leanCue.add(shaft);
  leanCue.position.set(P.x + 0.1, 0, P.z - P.h - 0.13);
  leanCue.rotation.x = 0.085;
  group.add(leanCue);
  block(P.x + P.h + 0.05, P.x + P.h + 0.43, 0, 0.72, P.z + 0.1, P.z + 0.48, blackMat, { collide: true });
  block(P.x + P.h + 0.03, P.x + P.h + 0.45, 0.7, 0.76, P.z + 0.08, P.z + 0.5, std({ color: '#1c1c1f', roughness: 0.3 }));

  // ---------- Mobiliario ----------
  // Puf circular de cuatro gajos.
  function roundPouf(x, z, r, a, b) {
    const h = 0.42;
    for (let i = 0; i < 4; i++) {
      const g = new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, 24, 1, false, (i * Math.PI) / 2 + 0.5, Math.PI / 2), i % 2 ? a : b);
      g.position.set(x, h / 2, z);
      g.castShadow = true;
      g.receiveShadow = true;
      group.add(g);
    }
    cyl(r * 0.24, 0.03, greyFabric, x, h + 0.005, z);
    const c = r * 0.9;
    collide(x - c, x + c, z - c, z + c);
  }
  roundPouf(-3.45, -3.3, 1.15, greyFabric, yellow);
  roundPouf(4.6, -5.6, 1.1, greyFabric, orangeFabric);
  // Puf gris pequeno y banco naranja.
  cyl(0.25, 0.45, greyFabric, 3.5, 0.225, -6.7);
  collide(3.25, 3.75, -6.95, -6.45);
  block(E - 0.75, E - 0.1, 0, 0.45, -5.9, -4.5, orangeFabric, { collide: true });

  // Mesita de rejilla: cilindro de alambre con tapa.
  function wireTable(x, z, r, h) {
    const wire = new THREE.Mesh(new THREE.CylinderGeometry(r, r * 0.92, h, 14, 4, true), new THREE.MeshBasicMaterial({ color: '#9a9994', wireframe: true }));
    wire.position.set(x, h / 2, z);
    group.add(wire);
    cyl(r + 0.01, 0.02, white, x, h + 0.01, z);
    collide(x - r, x + r, z - r, z + r);
  }
  wireTable(-3.2, -0.75, 0.24, 0.42);
  wireTable(-4.0, -4.95, 0.2, 0.4);

  // Sillones naranjas: uno junto al pilar y dos dentro del pasillo, de espaldas al murete.
  for (const [x, z, ry, solid] of [[-4.0, 0.15, Math.PI / 2 - 0.2, true], [-5.6, 3.1, 0.15, false], [-6.9, 3.25, -0.55, false]]) {
    const chair = buildShellChair();
    chair.position.set(x, 0, z);
    chair.rotation.y = ry;
    group.add(chair);
    if (solid) collide(x - 0.33, x + 0.33, z - 0.33, z + 0.33);
  }
  {
    // Mesita de rejilla entre los dos sillones del pasillo, sin colision porque no se llega.
    const wire = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.156, 0.36, 14, 4, true), new THREE.MeshBasicMaterial({ color: '#9a9994', wireframe: true }));
    wire.position.set(-6.3, 0.18, 3.0);
    group.add(wire);
    cyl(0.18, 0.02, white, -6.3, 0.37, 3.0);
  }

  // Pared este: cuadro electrico, pizarra, diana, cartel, taquera, senales y mesita.
  const EW = E - 0.01;
  block(E - 0.12, E, 1.45, 2.05, -6.6, -6.05, std({ color: '#e6e3da', roughness: 0.6 }), { cast: false });
  panel(0.45, 0.33, std({ color: '#f1f1ee', roughness: 0.5 }), EW, 1.6, -5.6, 'w');
  panel(0.85, 0.95, std({ color: '#d9913f', roughness: 0.8 }), EW, 1.75, -4.0, 'w');
  panel(0.45, 0.45, textured(makeDartboardTexture(), { transparent: true }), EW - 0.02, 1.85, -4.0, 'w');
  panel(1.2, 0.85, textured(makePosterTexture({ title: 'Torneo de billar' })), EW, 1.65, -2.6, 'w');
  // Taquera con un taco colgado delante del cartel.
  block(E - 0.1, E, 2.14, 2.2, -3.0, -2.5, darkWood, { cast: false });
  block(E - 0.14, E, 0.72, 0.8, -2.97, -2.53, darkWood, { cast: false });
  const hung = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.012, 1.4, 10), std({ color: '#3a2a1e', roughness: 0.5 }));
  hung.position.set(E - 0.08, 1.48, -2.75);
  group.add(hung);
  panel(0.26, 0.26, emissive('#3db8c4'), EW, 2.1, -1.8, 'w');
  panel(0.2, 0.26, std({ color: '#1f8a5a', roughness: 0.6 }), EW, 1.72, -1.8, 'w');
  block(E - 0.5, E - 0.05, 0, 0.36, -3.55, -3.1, blackMat, { collide: true });
  for (const z of [-3.44, -3.22]) {
    const leaflet = panel(0.2, 0.28, textured(makePosterTexture({ w: 256, h: 360, bg: '#d6ecd2', seed: z > -3.3 ? 5 : 9 })), E - 0.3, 0.5, z, 'w');
    leaflet.rotation.x = -0.15;
  }
  // Tablero verde lima sobre un pie, junto a la pared este.
  cyl(0.012, 1.5, blackMat, E - 0.35, 0.75, -0.75, 8);
  cyl(0.16, 0.03, blackMat, E - 0.35, 0.015, -0.75, 16);
  panel(0.55, 0.8, std({ color: '#c3dc4a', roughness: 0.7, side: THREE.DoubleSide }), E - 0.37, 1.72, -0.75, 'w');

  // Futbolin, bajo la A del sureste.
  const fb = buildFoosball();
  fb.position.set(5.4, 0, 2.4);
  fb.rotation.y = 0.12;
  group.add(fb);
  collide(4.6, 6.2, 1.8, 3.0);

  // ---------- Techo: tuberias, carriles de focos y discos acusticos ----------
  const pipe = (x0, z0, x1, z1, r = 0.045) => {
    const len = Math.hypot(x1 - x0, z1 - z0);
    const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, len, 10), metalDark);
    m.position.set((x0 + x1) / 2, H - 0.16, (z0 + z1) / 2);
    m.lookAt(x1, H - 0.16, z1);
    m.rotateX(Math.PI / 2);
    group.add(m);
  };
  pipe(-2.4, N + 0.1, -2.4, 4.6);
  pipe(-2.4, -4.6, 1.2, -4.6);
  pipe(1.2, -4.6, 1.2, N + 0.1);
  pipe(2.6, -1.6, E - 0.1, -1.6, 0.035);
  // Conductos de aire.
  block(1.4, 3.2, H - 0.34, H - 0.02, -6.6, -4.2, metalDark, { cast: false });
  block(3.8, 5.0, H - 0.3, H - 0.02, -1.0, 0.2, metalDark, { cast: false });

  const spots = []; // posiciones de los focos de carril
  const headGeo = new THREE.CylinderGeometry(0.035, 0.035, 0.13, 10);
  function track(x0, z0, x1, z1, heads) {
    const len = Math.hypot(x1 - x0, z1 - z0);
    const rail = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.03, len), blackMat);
    rail.position.set((x0 + x1) / 2, H - 0.08, (z0 + z1) / 2);
    rail.lookAt(x1, H - 0.08, z1);
    group.add(rail);
    for (let i = 0; i < heads; i++) {
      const t = (i + 0.5) / heads;
      const x = x0 + (x1 - x0) * t;
      const z = z0 + (z1 - z0) * t;
      const head = new THREE.Mesh(headGeo, blackMat);
      head.position.set(x, H - 0.17, z);
      group.add(head);
      const lens = new THREE.Mesh(new THREE.CircleGeometry(0.028, 12), emissive('#fff3da', 5));
      lens.rotation.x = Math.PI / 2;
      lens.position.set(x, H - 0.236, z);
      group.add(lens);
      spots.push({ x, z });
    }
  }
  track(-3.6, -3.8, -3.6, 2.2, 4);
  track(-1.2, -1.7, 1.6, -1.7, 3);
  track(-1.2, 1.7, 1.6, 1.7, 3);
  track(5.6, -6.6, 5.6, -0.4, 4);
  track(2.4, 4.3, 6.0, 4.3, 3);
  track(-3.0, 4.2, -0.6, 4.2, 2);
  track(-2.2, -5.4, 1.4, -5.4, 3);

  const discGeo = new THREE.CylinderGeometry(1, 1, 0.04, 28);
  const discOrange = std({ color: '#e8651c', roughness: 0.85 });
  const discWhite = std({ color: '#e6e3da', roughness: 0.85 });
  const discs = [
    [-3.4, -6.2, 0.5, 1], [-1.8, -4.4, 0.42, 0], [-3.2, -3.0, 0.34, 1], [-1.2, -6.8, 0.55, 1], [-0.2, -5.6, 0.45, 0],
    [0.8, -3.4, 0.4, 1], [2.6, -3.0, 0.36, 1], [3.6, -2.2, 0.5, 0], [4.8, -4.4, 0.45, 1], [5.6, -2.0, 0.4, 0],
    [-2.0, -0.6, 0.5, 0], [-3.6, 0.8, 0.4, 1], [2.2, 0.2, 0.5, 1], [0.4, 3.0, 0.55, 0], [-1.2, 2.6, 0.4, 1],
    [3.0, 3.4, 0.45, 0], [4.6, 1.2, 0.4, 1], [3.4, 5.0, 0.5, 1], [-3.2, 3.2, 0.45, 0], [6.0, 0.9, 0.45, 1],
  ];
  for (const [x, z, r, orange] of discs) {
    const d = new THREE.Mesh(discGeo, orange ? discOrange : discWhite);
    d.scale.set(r, 1, r);
    d.position.set(x, H - 0.38, z);
    group.add(d);
    const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.004, 0.36, 4), blackMat);
    rod.position.set(x, H - 0.19, z);
    group.add(rod);
  }

  return { group, colliders, floors, spots, glow };
}
