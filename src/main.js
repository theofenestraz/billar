// Arranque: une render, fisica, partida, jugador e interfaz.

import * as THREE from 'three';
import { DT, BED_Y, R } from './physics/constants.js';
import { buildTable, TABLE_OUT_X, TABLE_OUT_Z } from './render/tableMesh.js?v=4';
import { buildBalls } from './render/ballsMesh.js?v=4';
import { createGame } from './game/match.js';
import { remaining } from './rules/eightball.js';
import { createWalker } from './player/walk.js?v=4';
import { createAimView } from './player/aimView.js?v=4';
import { createDesktopInput } from './player/input.js?v=4';
import { createHud } from './ui/hud.js?v=4';
import { buildRoom } from './render/room.js?v=4';
import { setupLighting } from './render/lighting.js?v=4';
import { createTouchControls } from './player/touch.js?v=4';
import { createMenus } from './ui/menus.js?v=4';
import { loadSettings, saveSettings } from './ui/settings.js?v=4';
import { createSound } from './audio/sound.js?v=4';

const canvas = document.getElementById('view');
const uiRoot = document.getElementById('ui');

function fatal(msg) {
  const f = document.getElementById('fatal');
  f.textContent = msg;
  f.hidden = false;
}

let renderer;
try {
  renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
} catch (e) {
  fatal('Tu dispositivo no puede mostrar gráficos 3D');
  throw e;
}

const scene = new THREE.Scene();
scene.background = new THREE.Color('#050506');
const camera = new THREE.PerspectiveCamera(65, innerWidth / innerHeight, 0.03, 80);

// ---------- Sala, mesa y luces ----------
const room = buildRoom();
scene.add(room.group);
const tableCollider = { minX: -TABLE_OUT_X, maxX: TABLE_OUT_X, minZ: -TABLE_OUT_Z, maxZ: TABLE_OUT_Z };
const colliders = [tableCollider, ...room.colliders];
const floors = room.floors;
const lighting = setupLighting(renderer, scene, camera);
lighting.resize(innerWidth, innerHeight);

scene.add(buildTable());
const balls = buildBalls();
scene.add(balls.group);
lighting.captureEnvironment([balls.group]);

// ---------- Partida y jugador ----------
const settings = loadSettings();
const coarse = matchMedia('(pointer: coarse)').matches;
let isTouch = coarse;
const sound = createSound();
const game = createGame(['Jugador 1', 'Jugador 2']);
const walker = createWalker(colliders, floors, { x: TABLE_OUT_X, z: TABLE_OUT_Z });
const aimView = createAimView(scene, game);

let acc = 0;
let lastT = performance.now();
let spaceCharge = false;
let mode = 'walk'; // 'walk' | 'aim'
let paused = true; // empieza en el menu de inicio
const blend = { t: 1, pos: new THREE.Vector3(), quat: new THREE.Quaternion() };
const BLEND_TIME = 0.6;

function startBlend() {
  blend.pos.copy(camera.position);
  blend.quat.copy(camera.quaternion);
  blend.t = 0;
}

const canAct = () => (game.state === 'aiming' || game.state === 'placing') && walker.distanceToTable() < 1.5;

function enterAim() {
  if (mode !== 'walk' || paused || !canAct()) return;
  aimView.enter(walker.x, walker.z);
  mode = 'aim';
  startBlend();
  input.unlock();
}

function leaveAim() {
  if (mode !== 'aim') return;
  aimView.exit();
  hud.setPower(0);
  walker.adopt(camera);
  mode = 'walk';
  if (!isTouch) input.lock();
}

let lastState = game.state;
let endTimer = 0;
game.onEvent((e) => sound.handle(e));
game.onChange(() => {
  if (game.state === 'rolling' && mode === 'aim') leaveAim();
  else if (mode === 'aim' && game.state !== lastState) startBlend();
  if (lastState === 'rolling' && game.state !== 'rolling' && game.match.lastResult) hud.toast(game.match.lastResult.message);
  if (game.state === 'over' && lastState !== 'over') {
    // Deja ver el final del tiro antes de mostrar el resultado.
    clearTimeout(endTimer);
    endTimer = setTimeout(showEnd, 1400);
  }
  lastState = game.state;
});

// ---------- Menus y pausa ----------
function openMenu(name, data) {
  paused = true;
  spaceCharge = false;
  input.unlock();
  menus.show(name, data);
  hud.setVisible(false);
  touch.setActive(false);
}

function closeMenu() {
  menus.hide();
  hud.setVisible(true);
  paused = false;
  lastT = performance.now();
  acc = 0;
  if (!isTouch && mode === 'walk') input.lock();
}

function showEnd() {
  if (game.state !== 'over') return;
  if (mode === 'aim') leaveAim();
  const m = game.match;
  openMenu('fin', { winner: m.players[m.winner].name, players: m.players });
}

function pause() {
  if (paused) return;
  if (mode === 'aim') leaveAim();
  openMenu('pausa');
}

function resetPlayer() {
  if (mode === 'aim') {
    aimView.exit();
    mode = 'walk';
  }
  walker.setPosition(-0.5, 4.9, 0.1);
  blend.t = 1;
}

function applySettings() {
  isTouch = settings.controls === 'touch' || (settings.controls === 'auto' && coarse);
  input.setOptions(settings);
  touch.setOptions(settings);
  aimView.setGuide(settings.guide);
  sound.setVolume(settings.volume);
  lighting.setQuality(settings.quality);
  menuRoot.dataset.touch = isTouch ? '1' : '0';
}

// ---------- Entrada ----------
const input = createDesktopInput(canvas, {
  onLook(dYaw, dPitch) {
    if (mode === 'walk' && !paused) walker.look(dYaw, dPitch);
  },
  onKeyDown(code) {
    if (paused) {
      if (code === 'Escape' && menus.screen === 'pausa') closeMenu();
      return;
    }
    if (mode === 'walk') {
      if (code === 'KeyE' || code === 'Enter') enterAim();
      if (code === 'Escape' || code === 'KeyP') pause();
    } else if (game.state === 'placing') {
      if (code === 'Enter' || code === 'KeyE') confirmPlace();
      if (code === 'Escape' || code === 'KeyQ') leaveAim();
    } else {
      if (code === 'Space') spaceCharge = true;
      if (code === 'Escape' || code === 'KeyQ') leaveAim();
    }
  },
  onKeyUp(code) {
    if (code === 'Space' && spaceCharge) {
      spaceCharge = false;
      if (mode === 'aim') releaseShot();
    }
  },
  onWheel(sign) {
    if (!paused && mode === 'aim' && game.state === 'aiming') aimView.rotate(-sign * 0.002);
  },
  // El navegador suelta el raton con Esc: se trata como pausa.
  onLockLost() {
    if (!paused && mode === 'walk') pause();
  },
});

function confirmPlace() {
  const cue = game.table.balls[0];
  game.placeCue(cue.x, cue.z);
}

function releaseShot() {
  const power = aimView.pull;
  if (aimView.release()) pendingCue = power;
  hud.setPower(0);
}
let pendingCue = 0;

const hud = createHud(uiRoot, {
  onAct: enterAim,
  onStand: leaveAim,
  onReplace: () => game.startPlacing(),
  onConfirm: confirmPlace,
  onPause: pause,
  onFine: (dir) => aimView.rotate(dir * 0.002),
  onPower: (p) => { aimView.setPull(p); hud.setPower(p); },
  onPowerRelease: releaseShot,
  onPowerCancel: () => { aimView.setPull(0); hud.setPower(0); },
});

const touch = createTouchControls(uiRoot, {
  onLook(dYaw, dPitch) {
    if (mode === 'walk' && !paused) walker.look(dYaw, dPitch);
  },
});

const menuRoot = document.createElement('div');
menuRoot.className = 'menu-root';
uiRoot.appendChild(menuRoot);
const menus = createMenus(menuRoot, settings, {
  onStart(names) {
    sound.unlock();
    game.restart(names);
    resetPlayer();
    closeMenu();
    hud.toast(`Saca ${names[0]}`);
  },
  onResume: closeMenu,
  onRestart() {
    clearTimeout(endTimer);
    game.restart();
    resetPlayer();
    closeMenu();
    hud.toast(`Saca ${game.match.players[0].name}`);
  },
  onRematch() {
    game.rematch();
    resetPlayer();
    closeMenu();
    hud.toast(`Saca ${game.match.players[game.match.turn].name}`);
  },
  onQuit() {
    clearTimeout(endTimer);
    openMenu('inicio');
  },
  onSettings(s) {
    saveSettings(s);
    applySettings();
  },
});

// Aviso para girar el telefono.
const rotateMsg = document.createElement('div');
rotateMsg.className = 'rotate';
rotateMsg.textContent = 'Gira el teléfono para jugar en horizontal';
rotateMsg.hidden = true;
uiRoot.appendChild(rotateMsg);
function checkOrientation() {
  rotateMsg.hidden = !(isTouch && innerHeight > innerWidth);
}

// Gestos sobre la imagen en modo apuntar: girar, inclinar y arrastrar la blanca.
const raycaster = new THREE.Raycaster();
const bedPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -(BED_Y + R));
const hitPoint = new THREE.Vector3();
const ndc = new THREE.Vector2();
let dragId = null;
let dragX = 0;
let dragY = 0;

function dragCueTo(e) {
  ndc.set((e.clientX / innerWidth) * 2 - 1, -(e.clientY / innerHeight) * 2 + 1);
  raycaster.setFromCamera(ndc, camera);
  if (raycaster.ray.intersectPlane(bedPlane, hitPoint)) aimView.dragCue(hitPoint.x, hitPoint.z);
}

canvas.addEventListener('pointerdown', (e) => {
  if (paused) return;
  sound.unlock();
  if (mode === 'walk') {
    if (!isTouch && e.pointerType === 'mouse') input.lock();
    return;
  }
  if (dragId !== null) return;
  dragId = e.pointerId;
  dragX = e.clientX;
  dragY = e.clientY;
  canvas.setPointerCapture(e.pointerId);
  if (game.state === 'placing' && blend.t >= 1) dragCueTo(e);
});
canvas.addEventListener('pointermove', (e) => {
  if (e.pointerId !== dragId || mode !== 'aim') return;
  if (game.state === 'placing') {
    if (blend.t >= 1) dragCueTo(e);
  } else {
    aimView.rotate(-(e.clientX - dragX) * 0.0035);
    aimView.tilt((e.clientY - dragY) * 0.004);
  }
  dragX = e.clientX;
  dragY = e.clientY;
});
const endDrag = (e) => { if (e.pointerId === dragId) dragId = null; };
canvas.addEventListener('pointerup', endDrag);
canvas.addEventListener('pointercancel', endDrag);

// ---------- Bucle ----------
function updateHud() {
  const m = game.match;
  let hint = '';
  if (mode === 'walk' && !isTouch && !input.locked) hint = 'Haz clic para mirar alrededor';
  else if (mode === 'aim' && game.state === 'aiming' && !isTouch) hint = 'Arrastra para apuntar · Espacio o la barra para dar fuerza';
  hud.update({
    mode,
    touch: isTouch,
    state: game.state,
    turn: m.turn,
    over: m.phase === 'over',
    players: m.players.map((p, i) => ({ name: p.name, group: p.group, left: remaining(m, i) })),
    canAct: canAct(),
    actLabel: game.state === 'placing' ? 'Colocar blanca' : 'Tirar',
    canPlace: game.canPlace(),
    kitchen: m.ballInHand === 'kitchen',
    hint,
  });
}

function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min((now - lastT) / 1000, 0.1);
  lastT = now;
  if (!paused) {
    acc += dt;
    let n = 0;
    while (acc >= DT && n < 8) {
      game.tick();
      acc -= DT;
      n++;
    }
    if (acc >= DT) acc = 0;

    if (mode === 'walk') {
      const mv = input.move();
      walker.update(dt, mv.x + touch.move.x, mv.z + touch.move.z, mv.run);
    } else {
      if (game.state === 'aiming') {
        const slow = input.isDown('ShiftLeft', 'ShiftRight') ? 0.15 : 1;
        const turn = (input.isDown('KeyA', 'ArrowLeft') ? 1 : 0) - (input.isDown('KeyD', 'ArrowRight') ? 1 : 0);
        if (turn) aimView.rotate(turn * 0.5 * slow * dt);
        const tilt = (input.isDown('KeyW', 'ArrowUp') ? 1 : 0) - (input.isDown('KeyS', 'ArrowDown') ? 1 : 0);
        if (tilt) aimView.tilt(tilt * 0.8 * dt);
        if (spaceCharge) {
          aimView.setPull(aimView.pull + dt * 0.7);
          hud.setPower(aimView.pull);
        }
      }
      aimView.update(dt, () => sound.cue(pendingCue));
    }
  }

  const pose = mode === 'walk' ? walker.pose : aimView.pose;
  if (blend.t < 1) {
    blend.t = Math.min(1, blend.t + dt / BLEND_TIME);
    const e = blend.t * blend.t * (3 - 2 * blend.t);
    camera.position.lerpVectors(blend.pos, pose.position, e);
    camera.quaternion.slerpQuaternions(blend.quat, pose.quaternion, e);
  } else {
    camera.position.copy(pose.position);
    camera.quaternion.copy(pose.quaternion);
  }

  touch.setActive(isTouch && mode === 'walk' && !paused);
  balls.sync(game.table);
  updateHud();
  lighting.render();
}
requestAnimationFrame(frame);

addEventListener('resize', () => {
  lighting.resize(innerWidth, innerHeight);
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  checkOrientation();
});

// Al volver de segundo plano la simulacion sigue donde estaba, sin saltos.
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    if (!paused && game.state !== 'rolling') pause();
  } else {
    lastT = performance.now();
    acc = 0;
  }
});

applySettings();
checkOrientation();
openMenu('inicio');

// Acceso para depurar desde la consola.
window.__billar = { settings, menus, pause, room, lighting, game, walker, aimView, camera, scene, renderer, get mode() { return mode; }, enterAim, leaveAim };
