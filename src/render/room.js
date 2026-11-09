// Recreacion de la sala a partir de los fotogramas de referencia.
// Ejes: x este, z sur, origen en el centro de la mesa. Medidas estimadas con la mesa como escala.

import * as THREE from 'three';
import { makeNoiseTexture, makeBumpTexture, makeDartboardTexture, makePosterTexture, makeSignTexture } from './textures.js';

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
  const std = (o) => new THREE.MeshStandardMaterial({ envMapIntensity: 0.15, ...o });
  const carpet = std({ map: makeNoiseTexture({ base: '#7b7c80', spread: 30, seed: 21, repeat: 10 }), bumpMap: makeBumpTexture({ seed: 9, repeat: 10 }), bumpScale: 0.6, roughness: 1 });
  const wallDark = std({ map: makeNoiseTexture({ base: '#4a4e52', spread: 8, seed: 3, repeat: 3 }), roughness: 0.95 });
  const wallGrey = std({ map: makeNoiseTexture({ base: '#63676b', spread: 8, seed: 4, repeat: 3 }), roughness: 0.95 });
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
  const glass = new THREE.MeshPhysicalMaterial({ color: '#ffffff', transparent: true, opacity: 0.12, roughness: 0.03, metalness: 0, envMapIntensity: 1.6, depthWrite: false });
  // Material que emite luz. boost > 1 lo saca del rango normal para que el resplandor lo recoja.
  const emissive = (color, boost = 1) => {
    const m = new THREE.MeshBasicMaterial({ color });
    m.color.multiplyScalar(boost);
    m.toneMapped = false;
    return m;
  };

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
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(30, 26), carpet);
  carpet.map.repeat.set(30, 26);
  carpet.bumpMap.repeat.set(30, 26);
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(3, 0, 0);
  floor.receiveShadow = true;
  group.add(floor);
  const ceiling = new THREE.Mesh(new THREE.PlaneGeometry(30, 26), ceilingMat);
  ceiling.rotation.x = Math.PI / 2;
  ceiling.position.set(3, H, 0);
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
  block(W - 0.2, W, 0, H, WIN.z1, 3.2, wallDark, { cast: false });
  collide(W - 0.2, W, N, 3.2);
  // Marco blanco del ventanal y cristales.
  block(W - 0.04, W + 0.04, WIN.y0 - 0.05, WIN.y0, WIN.z0, WIN.z1, white, { cast: false });
  block(W - 0.04, W + 0.04, WIN.y1, WIN.y1 + 0.05, WIN.z0, WIN.z1, white, { cast: false });
  const pane = new THREE.Mesh(new THREE.PlaneGeometry(WIN.z1 - WIN.z0, WIN.y1 - WIN.y0), glass);
  pane.position.set(W - 0.01, (WIN.y0 + WIN.y1) / 2, (WIN.z0 + WIN.z1) / 2);
  pane.rotation.y = Math.PI / 2;
  group.add(pane);
  for (let i = 1; i < 4; i++) {
    const z = WIN.z0 + ((WIN.z1 - WIN.z0) * i) / 4;
    block(W - 0.015, W - 0.005, WIN.y0, WIN.y1, z - 0.006, z + 0.006, metalDark, { cast: false });
  }
  // Sala blanca tras el ventanal, con los tubos de neon de colores.
  const whiteRoom = emissive('#ece6e2');
  const BACK = W - 2.0;
  block(BACK - 0.1, BACK, 0.6, H, N, 3.2, whiteRoom, { cast: false });
  block(BACK, W - 0.2, 0.7, 0.75, N, 3.2, emissive('#8f8a87'), { cast: false });
  block(BACK, W - 0.2, H - 0.3, H - 0.25, N, 3.2, emissive('#a7a19e'), { cast: false });
  block(BACK, W - 0.2, 0.6, H, N - 0.05, N, whiteRoom, { cast: false });
  block(BACK, W - 0.2, 0.6, H, 3.2, 3.25, whiteRoom, { cast: false });
  const tubeColors = ['#fff6e8', '#ffd23c', '#ff9a2e', '#ff5a8a', '#ff4fd0', '#fff6e8', '#eaf6ff', '#55d8ff', '#55d8ff'];
  const tubeGeo = new THREE.CylinderGeometry(0.018, 0.018, 0.34, 8);
  tubeColors.forEach((color, col) => {
    const mat = emissive(color, 5);
    for (let row = 0; row < 4; row++) {
      const t = new THREE.Mesh(tubeGeo, mat);
      t.position.set(BACK + 0.13, 1.42 + row * 0.3, 1.6 - col * 0.42);
      t.rotation.x = (col + row) % 2 ? 0.6 : -0.6;
      group.add(t);
      glow.push(t);
    }
  });

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
  // Banco de madera clara bajo la cristalera.
  block(2.9, 5.2, 0.4, 0.46, S - 0.75, S - 0.3, wood);
  for (const x of [3.0, 4.05, 5.1]) block(x - 0.05, x + 0.05, 0, 0.4, S - 0.7, S - 0.35, wood);
  collide(2.9, 5.2, S - 0.75, S);
  // Pilar recto sur.
  block(0.55, 1.2, 0, H, S - 0.35, S + 0.3, concrete, { collide: true });
  // Pasillo de salida: se ve pero no se entra.
  const C0 = -0.7;
  const C1 = 0.35;
  block(C0 - 0.2, C0, 0, H, S, S + 4.2, wallDark, { cast: false });
  block(C1, C1 + 0.2, 0, H, S, S + 4.2, wallDark, { cast: false });
  block(C0 - 0.2, C1 + 0.2, 0, H, S + 4.2, S + 4.3, wallGrey, { cast: false });
  block(C0, C1, 2.25, H, S - 0.05, S + 0.05, wallDark, { cast: false });
  block(C1, 0.55, 0, H, S - 0.05, S + 0.05, wallDark, { cast: false });
  panel(0.5, 0.17, new THREE.MeshBasicMaterial({ map: makeSignTexture({ text: 'SALIDA' }), toneMapped: false }), (C0 + C1) / 2, 2.42, S - 0.06, 'n');
  collide(C0 - 0.2, 0.6, S - 0.12, S + 0.3);
  // Pared curva del suroeste, en tramos.
  const arc = [[C0, S], [-1.8, S - 0.1], [-2.9, S - 0.5], [-3.8, S - 1.2], [-4.3, S - 1.9], [W, 3.2]];
  for (let i = 0; i < arc.length - 1; i++) {
    const [x0, z0] = arc[i];
    const [x1, z1] = arc[i + 1];
    const len = Math.hypot(x1 - x0, z1 - z0);
    const m = new THREE.Mesh(new THREE.BoxGeometry(len + 0.06, H, 0.2), wallDark);
    m.position.set((x0 + x1) / 2, H / 2, (z0 + z1) / 2);
    m.rotation.y = -Math.atan2(z1 - z0, x1 - x0);
    m.translateZ(-0.1);
    m.receiveShadow = true;
    group.add(m);
    collide(Math.min(x0, x1) - 0.05, Math.max(x0, x1) + 0.05, Math.min(z0, z1) - 0.05, S + 1);
  }
  // Armario rojo, extintor, senal y puerta clara sobre la pared curva.
  function onWall(x0, z0, x1, z1, t, build) {
    const g = new THREE.Group();
    g.position.set(x0 + (x1 - x0) * t, 0, z0 + (z1 - z0) * t);
    g.rotation.y = -Math.atan2(z1 - z0, x1 - x0);
    build(g);
    group.add(g);
  }
  onWall(-1.8, S - 0.1, -2.9, S - 0.5, 0.4, (g) => {
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(0.22, 0.6), std({ color: '#c8322e', roughness: 0.6 }));
    sign.position.set(0, 2.0, 0.012);
    const teal = new THREE.Mesh(new THREE.CircleGeometry(0.13, 24), emissive('#3db8c4'));
    teal.position.set(0.55, 1.75, 0.012);
    g.add(sign, teal);
  });
  onWall(-2.9, S - 0.5, -3.8, S - 1.2, 0.5, (g) => {
    const cab = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.65, 0.16), red);
    cab.position.set(0, 1.45, 0.08);
    const ext = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.42, 12), red);
    ext.position.set(0.5, 1.05, 0.1);
    g.add(cab, ext);
  });
  onWall(-3.8, S - 1.2, -4.3, S - 1.9, 0.5, (g) => {
    const door = new THREE.Mesh(new THREE.PlaneGeometry(0.85, 2.05), std({ color: '#dcd9d2', roughness: 0.6 }));
    door.position.set(0, 1.03, 0.012);
    g.add(door);
  });

  // Limite del sureste: la zona de cafeteria se ve pero no se pisa.
  collide(8.0, 12, E_END, S + 0.4);
  collide(E, 12, E_END - 0.2, E_END + 0.2);
  // Fondo de la cafeteria: pared lejana y bultos calidos.
  block(13, 13.1, 0, H, -2, 10, wallDark, { cast: false });
  panel(2.4, 1.0, emissive('#b5651f'), 12.95, 1.3, 2.0, 'w');
  panel(0.9, 0.8, emissive('#e0c020'), 12.95, 0.9, 4.6, 'w');
  block(9.6, 10.6, 0, 0.45, 3.4, 4.4, orangeFabric, { cast: false });
  block(10.4, 11.6, 0.7, 0.74, 0.8, 1.8, white, { cast: false });
  block(E + 0.2, 13, 0, H, E_END - 2.2, E_END - 2.0, wallDark, { cast: false });

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
  block(G0, S2[0], 0, 0.92, N, T2, tierMat);
  block(S2[1], G1, 0, 0.92, N, T2, tierMat);
  block(S2[0], S2[1], 0, 0.92, N, T2 - 0.45, tierMat);
  block(S2[0], S2[1], 0, 0.72, T2 - 0.45, T2, tierMat);
  floors.push({ minX: G0, maxX: G1, minZ: N, maxZ: T2 - 0.45, y: 0.92 }, { minX: G0, maxX: S2[0], minZ: T2 - 0.45, maxZ: T2, y: 0.92 },
    { minX: S2[1], maxX: G1, minZ: T2 - 0.45, maxZ: T2, y: 0.92 }, { minX: S2[0], maxX: S2[1], minZ: T2 - 0.45, maxZ: T2, y: 0.72 });
  // Nivel 3: respaldo contra la pared, no pisable.
  block(G0, 2.7, 0, 1.32, N, T3, tierMat, { collide: true });

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
  leaningPillar(3.5, 1.6, 1.6, 1.15, 0.6);
  leaningPillar(7.2, 2.4, -1.75, 0.9, 0.6);
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
  wireTable(-2.8, -0.1, 0.24, 0.42);
  wireTable(-4.0, -4.95, 0.2, 0.4);

  // Sillon naranja.
  const chair = new THREE.Group();
  const seat = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.1, 0.55), orangeSeat);
  seat.position.set(0, 0.42, 0);
  const back = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.5, 0.09), orangeSeat);
  back.position.set(0, 0.68, -0.27);
  back.rotation.x = -0.18;
  chair.add(seat, back);
  for (const sd of [-1, 1]) {
    const arm = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.24, 0.5), orangeSeat);
    arm.position.set(sd * 0.3, 0.54, -0.02);
    chair.add(arm);
    for (const t of [-1, 1]) {
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.4, 6), blackMat);
      leg.position.set(sd * 0.25, 0.2, t * 0.22);
      leg.rotation.z = sd * -0.1;
      chair.add(leg);
    }
  }
  chair.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  chair.position.set(-4.05, 0, -1.5);
  chair.rotation.y = Math.PI / 2 - 0.25;
  group.add(chair);
  collide(-4.4, -3.7, -1.85, -1.15);

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
  // Lona con circulos al final de la pared este.
  const tarp = new THREE.Group();
  const sheet = new THREE.Mesh(new THREE.PlaneGeometry(1.3, 2.1), std({ color: '#b9bdc0', roughness: 0.25, transparent: true, opacity: 0.8, side: THREE.DoubleSide }));
  sheet.position.y = 1.3;
  tarp.add(sheet);
  for (const [x, y, c] of [[-0.25, 1.95, '#e9e9e4'], [0.25, 1.5, '#e06a2a'], [-0.2, 1.05, '#e9e9e4'], [0.3, 0.7, '#e06a2a']]) {
    const dot = new THREE.Mesh(new THREE.CircleGeometry(0.22, 20), std({ color: c, roughness: 0.6 }));
    dot.position.set(x, y, 0.01);
    tarp.add(dot);
  }
  tarp.position.set(E - 0.3, 0, -0.4);
  tarp.rotation.y = -Math.PI / 2 - 0.35;
  group.add(tarp);

  // Futbolin.
  const fb = new THREE.Group();
  const body = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.3, 0.76), darkWood);
  body.position.y = 0.78;
  const field = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.01, 0.62), std({ color: '#2f7d4a', roughness: 0.8 }));
  field.position.y = 0.9;
  fb.add(body, field);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.64, 0.09), darkWood);
    leg.position.set(sx * 0.6, 0.32, sz * 0.3);
    fb.add(leg);
  }
  const blue = std({ color: '#3a66c8', roughness: 0.6 });
  for (let i = 0; i < 8; i++) {
    const x = -0.52 + i * 0.148;
    const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 1.15, 8), chrome);
    rod.rotation.x = Math.PI / 2;
    rod.position.set(x, 0.99, 0);
    fb.add(rod);
    const count = [1, 2, 3, 5, 5, 3, 2, 1][i];
    for (let k = 0; k < count; k++) {
      const man = new THREE.Mesh(new THREE.BoxGeometry(0.025, 0.1, 0.035), [0, 1, 3, 5].includes(i) ? white : blue);
      man.position.set(x, 0.96, (k - (count - 1) / 2) * (0.5 / Math.max(count, 2)));
      fb.add(man);
    }
  }
  fb.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  fb.position.set(5.4, 0, 2.4);
  fb.rotation.y = 0.12;
  group.add(fb);
  collide(4.65, 6.15, 1.95, 2.85);

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
