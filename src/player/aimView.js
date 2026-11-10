// Camara, taco y linea guia en modo apuntar, y vista cenital para colocar la blanca.

import * as THREE from 'three';
import { R, BED_Y, HALF_W, HALF_L } from '../physics/constants.js';

const RAIL_TOP = 0.04 - R; // altura del borde de la banda sobre el centro de la bola
const TIP_R = 0.009; // grosor del taco cerca de la punta
import { predictAim } from '../physics/aim.js';
import { makeCueTextures, CUE_PARTS } from '../render/textures.js?v=26';

const ARM = 0.62; // distancia de la camara a la blanca
const PITCH_MIN = 0.14;
const PITCH_MAX = 1.15;
const PULL_MAX = 0.25; // retroceso maximo del taco
const CUE_LEN = 1.45;
const STRIKE_TIME = 0.07;
const BALL_Y = BED_Y + R;
const BASE_TILT = 0.09; // inclinacion normal del taco, para salvar la banda
const MAX_TILT = 1.25; // con una bola pegada detras el taco casi se pone vertical
const DRAW_LIMIT = 0.3; // por encima de esta inclinacion (unos 17 grados) ya no se puede picar por abajo
const CUE_CLEAR = R + 0.014; // radio de la bola mas el grosor del taco a esa distancia, con margen

// Perfil del taco: radio segun la distancia a la punta. La punta queda en z = 0 y el tope en z = len.
function buildCueGeometry() {
  const P = CUE_PARTS;
  const pts = [];
  const add = (z, r) => pts.push(new THREE.Vector2(r, z));
  // Suela abombada.
  for (let i = 0; i <= 5; i++) {
    const a = (i / 5) * (Math.PI / 2);
    add(0.003 * (1 - Math.cos(a)), 0.0062 * Math.sin(a));
  }
  add(P.tip, 0.0062);
  add(P.tip, 0.0063);
  add(P.ferrule, 0.0063);
  // Fuste: casi recto los primeros palmos y luego se ensancha hacia la union.
  for (let i = 0; i <= 24; i++) {
    const t = i / 24;
    add(P.ferrule + t * (P.joint - P.ferrule), 0.0064 + 0.0034 * Math.pow(t, 1.6));
  }
  add(P.joint, 0.0108);
  add(P.collar, 0.0108);
  for (let i = 1; i <= 8; i++) {
    const t = i / 8;
    add(P.collar + t * (P.forearm - P.collar), 0.0108 + 0.002 * t);
  }
  add(P.wrap, 0.0136);
  add(P.bumper, 0.0147);
  // Tope de goma redondeado.
  for (let i = 0; i <= 5; i++) {
    const a = (i / 5) * (Math.PI / 2);
    add(P.bumper + (P.len - P.bumper) * Math.sin(a), 0.0144 * Math.cos(a) + 0.0003 * (1 - i / 5));
  }
  add(P.len, 0);
  const geo = new THREE.LatheGeometry(pts, 32);
  // La textura se reparte por longitud, no por numero de puntos.
  const pos = geo.attributes.position;
  const uv = geo.attributes.uv;
  for (let i = 0; i < pos.count; i++) uv.setY(i, Math.min(1, Math.max(0, pos.getY(i) / P.len)));
  geo.rotateX(Math.PI / 2); // eje del torno (y) al eje del taco (z)
  return geo;
}

function ribbon(mat) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), mat);
  m.rotation.x = -Math.PI / 2;
  m.renderOrder = 2;
  return m;
}

function placeRibbon(m, x1, z1, x2, z2, width) {
  const dx = x2 - x1, dz = z2 - z1;
  const len = Math.hypot(dx, dz);
  m.visible = len > 1e-4;
  if (!m.visible) return;
  m.position.set((x1 + x2) / 2, BED_Y + 0.0015, (z1 + z2) / 2);
  m.scale.set(width, len, 1);
  // Tumbada sobre el tapete, con su eje largo en la direccion del tramo.
  m.rotation.set(-Math.PI / 2, Math.atan2(-dx, -dz), 0, 'YXZ');
}

export function createAimView(scene, game) {
  let yaw = 0; // direccion de tiro: (-sin yaw, -cos yaw)
  let pitch = 0.42;
  let pull = 0;
  let strikeT = -1; // cuenta atras del golpe en curso
  let strikePower = 0;
  let showGuide = true;
  let showObject = true;
  let spinSide = 0; // efecto: donde pega el taco, de -1 a 1
  let spinTop = 0;
  let auto = false; // tiro de la maquina: se ve el taco, sin guia ni camara
  const pose = { position: new THREE.Vector3(), quaternion: new THREE.Quaternion() };
  const tmp = new THREE.Camera(); // lookAt de camara: orienta -z hacia el objetivo

  const group = new THREE.Group();
  group.visible = false;
  scene.add(group);

  // Taco de dos piezas, una sola malla de revolucion con su textura a lo largo (ver makeCueTextures).
  const cue = new THREE.Group();
  const cueTex = makeCueTextures();
  cueTex.map.flipY = false;
  cueTex.rough.flipY = false;
  const cueMesh = new THREE.Mesh(
    buildCueGeometry(),
    new THREE.MeshPhysicalMaterial({
      map: cueTex.map, roughnessMap: cueTex.rough, roughness: 1,
      clearcoat: 0.35, clearcoatRoughness: 0.3, envMapIntensity: 0.6,
    }),
  );
  cueMesh.castShadow = true;
  cue.add(cueMesh);
  group.add(cue);

  // Linea guia sobre el tapete.
  const lineMat = new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.6, depthWrite: false });
  const objMat = new THREE.MeshBasicMaterial({ color: '#ffd76a', transparent: true, opacity: 0.75, depthWrite: false });
  const pathLine = ribbon(lineMat);
  const objLine = ribbon(objMat);
  const ghost = new THREE.Mesh(new THREE.RingGeometry(R * 0.86, R, 40), lineMat);
  ghost.rotation.x = -Math.PI / 2;
  ghost.renderOrder = 2;
  const guide = new THREE.Group();
  guide.add(pathLine, objLine, ghost);
  group.add(guide);

  // Marcador de colocacion de la blanca.
  const placeRing = new THREE.Mesh(new THREE.RingGeometry(R * 1.25, R * 1.5, 40), new THREE.MeshBasicMaterial({ color: '#35e08f', transparent: true, opacity: 0.9, depthWrite: false }));
  placeRing.rotation.x = -Math.PI / 2;
  placeRing.renderOrder = 2;
  group.add(placeRing);

  const dir = () => ({ x: -Math.sin(yaw), z: -Math.cos(yaw) });

  function updateGuide() {
    const cueBall = game.table.balls[0];
    const placing = game.state === 'placing';
    guide.visible = showGuide && !auto && game.state === 'aiming' && strikeT < 0;
    placeRing.visible = placing;
    if (placing) placeRing.position.set(cueBall.x, BED_Y + 0.002, cueBall.z);
    if (!guide.visible) return;
    const d = dir();
    const a = predictAim(game.table, d.x, d.z);
    placeRibbon(pathLine, cueBall.x + d.x * R, cueBall.z + d.z * R, a.endX, a.endZ, 0.004);
    ghost.position.set(a.endX, BED_Y + 0.0015, a.endZ);
    if (a.hitBall !== null && showObject) {
      const b = game.table.balls[a.hitBall];
      placeRibbon(objLine, b.x + a.objDirX * R, b.z + a.objDirZ * R, b.x + a.objDirX * (R + 0.25), b.z + a.objDirZ * (R + 0.25), 0.004);
    } else {
      objLine.visible = false;
    }
  }

  // Inclinacion que necesita el taco para pasar por encima de las bolas que hay detras de la blanca.
  let tilt = BASE_TILT;
  // Inclinacion que pide la banda que queda detras de la blanca, o 0 si no pide nada especial.
  function railTilt(aimY) {
    const cueBall = game.table.balls[0];
    const d = dir();
    // Distancia, en la linea del taco hacia atras, hasta el borde de la banda.
    let s = Infinity;
    if (d.x < 0) s = Math.min(s, (HALF_W - cueBall.x) / -d.x);
    if (d.x > 0) s = Math.min(s, (cueBall.x + HALF_W) / d.x);
    if (d.z < 0) s = Math.min(s, (HALF_L - cueBall.z) / -d.z);
    if (d.z > 0) s = Math.min(s, (cueBall.z + HALF_L) / d.z);
    const rise = RAIL_TOP + TIP_R + 0.003 - aimY;
    return Math.atan(rise / Math.max(s, 0.004));
  }

  // aimY: altura del punto de la blanca al que apunta el taco, respecto a su centro.
  function neededTilt(aimY) {
    const cueBall = game.table.balls[0];
    const d = dir();
    let tan = Math.tan(Math.max(BASE_TILT, railTilt(aimY)));
    for (const b of game.table.balls) {
      if (b.id === 0 || b.pocketed) continue;
      const rx = b.x - cueBall.x;
      const rz = b.z - cueBall.z;
      const behind = -(rx * d.x + rz * d.z); // distancia detras de la blanca, en la linea del taco
      if (behind <= R) continue;
      const side = -rx * d.z + rz * d.x;
      if (Math.abs(side) >= CUE_CLEAR) continue;
      // El eje del taco tiene que ir por encima de la bola: altura necesaria a esa distancia.
      const rise = Math.sqrt(CUE_CLEAR * CUE_CLEAR - side * side);
      const need = (rise - aimY) / (behind - R);
      if (need > tan) tan = need;
    }
    return Math.min(MAX_TILT, Math.atan(tan) + (tan > Math.tan(BASE_TILT) ? 0.03 : 0));
  }
  // Con el taco muy inclinado por una bola se golpea desde arriba: no cabe efecto hacia atras.
  let blockedNow = false;
  let noSpinNow = false; // blanca pegada a la banda: el taco va por encima y no hay efecto
  const blocked = () => blockedNow || noSpinNow;
  const topUsed = () => (noSpinNow ? 0 : blockedNow && spinTop < 0 ? 0 : spinTop);
  const sideUsed = () => (noSpinNow ? 0 : spinSide);

  function updateCue() {
    const cueBall = game.table.balls[0];
    cue.visible = game.state === 'aiming' || strikeT >= 0;
    if (!cue.visible) return;
    const d = dir();
    if (strikeT < 0) {
      // Durante el golpe no cambia. Primero se prueba con el efecto elegido; si obliga a inclinar
      // demasiado, se golpea desde arriba sin efecto hacia atras.
      const off0 = 0.5 * R;
      noSpinNow = railTilt(0) > DRAW_LIMIT;
      if (noSpinNow) {
        blockedNow = true;
        tilt = neededTilt(0);
      } else {
        tilt = neededTilt(spinTop * off0);
        blockedNow = spinTop < 0 ? tilt > DRAW_LIMIT : neededTilt(-off0) > DRAW_LIMIT;
        if (blockedNow && spinTop < 0) tilt = neededTilt(0);
      }
    }
    const cosT = Math.cos(tilt);
    const sinT = Math.sin(tilt);
    // Eje del taco hacia el mango: hacia atras y hacia arriba.
    const ux = -d.x * cosT;
    const uy = sinT;
    const uz = -d.z * cosT;
    // Punto de la blanca donde apunta el taco, desplazado segun el efecto: a la derecha (-dz, dx) y hacia arriba.
    const off = 0.5 * R;
    const wx = -d.z * sideUsed() * off;
    const wy = topUsed() * off;
    const wz = d.x * sideUsed() * off;
    // La punta queda donde ese eje sale de la bola, con un pequeno hueco.
    const gap = strikeT >= 0 ? 0.002 : 0.012;
    const bq = wx * ux + wy * uy + wz * uz;
    const cq = wx * wx + wy * wy + wz * wz - (R + gap) * (R + gap);
    let t = -bq + Math.sqrt(bq * bq - cq);
    t += strikeT >= 0 ? (strikeT / STRIKE_TIME) * strikePower * PULL_MAX : pull * PULL_MAX;
    cue.position.set(cueBall.x + wx + ux * t, BALL_Y + wy + uy * t, cueBall.z + wz + uz * t);
    cue.rotation.set(-tilt, yaw, 0, 'YXZ');
  }

  // La camara no puede bajar del taco: va justo encima de su eje, asi que el angulo minimo es la
  // inclinacion del taco mas un margen que deja fuera del plano cercano el grosor del palo.
  // El margen (7 cm a la distancia de la camara) cubre el plano cercano de la camara y el radio del taco.
  const CUE_MARGIN = 0.07;
  function minPitch() {
    const lift = Math.max(0, topUsed()) * 0.5 * R; // el efecto alto sube el taco
    return Math.max(PITCH_MIN, tilt + (CUE_MARGIN + lift) / ARM);
  }

  function writePose() {
    const cueBall = game.table.balls[0];
    if (game.state !== 'placing') {
      // Con el taco casi vertical el minimo puede pasar del maximo normal: manda el taco.
      const lo = minPitch();
      pitch = Math.min(Math.max(PITCH_MAX, lo), Math.max(pitch, lo));
    }
    if (game.state === 'placing') {
      // Vista cenital, con el eje largo de la mesa en horizontal.
      tmp.position.set(0, BED_Y + 1.78, 0);
      tmp.up.set(1, 0, 0);
      tmp.lookAt(0, BED_Y, 0);
    } else {
      const d = dir();
      const h = Math.sin(pitch) * ARM;
      const b = Math.cos(pitch) * ARM;
      tmp.position.set(cueBall.x - d.x * b, BALL_Y + h, cueBall.z - d.z * b);
      tmp.up.set(0, 1, 0);
      tmp.lookAt(cueBall.x + d.x * 0.3, BALL_Y - 0.02, cueBall.z + d.z * 0.3);
    }
    pose.position.copy(tmp.position);
    pose.quaternion.copy(tmp.quaternion);
  }

  const view = {
    pose,
    get active() { return group.visible; },
    get striking() { return strikeT >= 0; },
    get yaw() { return yaw; },
    get auto() { return auto; },

    // fromX, fromZ: donde esta el jugador, para apuntar desde su lado de la mesa.
    enter(fromX, fromZ) {
      const cueBall = game.table.balls[0];
      const dx = cueBall.x - fromX, dz = cueBall.z - fromZ;
      if (Math.hypot(dx, dz) > 0.05) yaw = Math.atan2(-dx, -dz);
      pitch = 0.42;
      pull = 0;
      strikeT = -1;
      auto = false;
      group.visible = true;
      writePose();
    },
    // Muestra el taco apuntando en una direccion, para el tiro de la maquina.
    enterAuto(dirX, dirZ) {
      yaw = Math.atan2(-dirX, -dirZ);
      pull = 0;
      strikeT = -1;
      auto = true;
      group.visible = true;
    },
    exit() {
      group.visible = false;
      auto = false;
      pull = 0;
      strikeT = -1;
    },
    setGuide(on, objectOn = true) { showGuide = on; showObject = objectOn; },
    // Efecto: limitado a un circulo de radio 1.
    setSpin(side, top) {
      const m = Math.hypot(side, top);
      const k = m > 1 ? 1 / m : 1;
      spinSide = side * k;
      spinTop = top * k;
    },
    get spin() { return { side: spinSide, top: spinTop }; },
    // true si el taco va inclinado por una bola detras de la blanca.
    get blocked() { return blocked(); },
    // true si la blanca esta pegada a la banda y no se puede dar efecto.
    get noSpin() { return noSpinNow; },
    rotate(dAngle) { if (strikeT < 0) yaw += dAngle; },
    tilt(dPitch) { const lo = minPitch(); pitch = Math.max(lo, Math.min(Math.max(PITCH_MAX, lo), pitch + dPitch)); },
    setPull(p) { if (strikeT < 0) pull = Math.max(0, Math.min(1, p)); },
    get pull() { return pull; },

    // Suelta el taco. Devuelve true si se inicia el golpe.
    release() {
      if (strikeT >= 0 || game.state !== 'aiming') return false;
      const p = pull;
      pull = 0;
      if (p < 0.03) return false;
      strikePower = p;
      strikeT = STRIKE_TIME;
      return true;
    },

    // Mueve la blanca en la vista cenital hacia un punto del tapete, si es legal.
    dragCue(x, z) {
      if (game.state !== 'placing') return;
      const lim = (v, half) => Math.max(-half + R, Math.min(half - R, v));
      const kitchen = game.match.ballInHand === 'kitchen';
      const px = lim(x, HALF_W);
      const pz = kitchen ? Math.max(0.495, lim(z, HALF_L)) : lim(z, HALF_L);
      if (game.isLegalPlacement(px, pz)) {
        const cueBall = game.table.balls[0];
        cueBall.x = px;
        cueBall.z = pz;
      }
    },

    // onStrike(power) se llama en el instante del golpe.
    update(dt, onStrike) {
      if (strikeT >= 0) {
        strikeT -= dt;
        if (strikeT < 0) {
          const d = dir();
          const ok = game.shoot(d.x, d.z, strikePower, sideUsed(), topUsed());
          if (ok && onStrike) onStrike(strikePower);
        }
      }
      updateCue();
      updateGuide();
      writePose();
    },
  };
  return view;
}
