// Arranque: une render, fisica, partida, jugador e interfaz.

import * as THREE from 'three';
import { DT, BED_Y, R } from './physics/constants.js';
import { buildTable, TABLE_OUT_X, TABLE_OUT_Z, TABLE_TOP_Y } from './render/tableMesh.js?v=22';
import { buildBalls } from './render/ballsMesh.js?v=22';
import { createGame } from './game/match.js';
import { remaining, blackTarget } from './rules/eightball.js';
import { POCKETS } from './physics/table.js';
import { createWalker } from './player/walk.js?v=22';
import { createAimView } from './player/aimView.js?v=22';
import { createDesktopInput } from './player/input.js?v=22';
import { createHud } from './ui/hud.js?v=22';
import { buildRoom } from './render/room.js?v=22';
import { setupLighting } from './render/lighting.js?v=22';
import { createTouchControls } from './player/touch.js?v=22';
import { mergeStatic } from './render/props.js?v=22';
import { chooseShot, choosePlacement } from './game/ai.js';
import { soloRemaining, soloBlackTarget } from './rules/solo.js';
import { findFreeSpot } from './physics/simulate.js';
import { createOnline } from './net/online.js?v=22';
import { createMenus } from './ui/menus.js?v=22';
import { loadSettings, saveSettings } from './ui/settings.js?v=22';
import { createSound } from './audio/sound.js?v=22';

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
lighting.setMobile(matchMedia('(pointer: coarse)').matches);
lighting.resize(innerWidth, innerHeight);

const tableGroup = buildTable();
scene.add(tableGroup);
// Sala y mesa no se mueven: se funden por material para dibujarlas en muchas menos llamadas.
const merged = { room: mergeStatic(room.group), table: mergeStatic(tableGroup) };
const balls = buildBalls();
// Aro verde sobre la tronera donde tiene que entrar la negra.
const pocketMark = new THREE.Mesh(
  new THREE.RingGeometry(0.072, 0.082, 40),
  new THREE.MeshBasicMaterial({ color: '#35e08f', transparent: true, opacity: 0.85, depthWrite: false, toneMapped: false }),
);
pocketMark.rotation.x = -Math.PI / 2;
pocketMark.renderOrder = 3;
pocketMark.visible = false;
scene.add(pocketMark);
let markedPocket = null;
function updatePocketMark(now) {
  const m = game.match;
  let k = null;
  if (m.phase !== 'over') k = m.mode === 'solo' ? soloBlackTarget(m) : blackTarget(m, m.turn);
  if (k === undefined) k = null;
  if (k !== null && k !== markedPocket && game.state !== 'rolling') hud.toast('La negra, a la tronera marcada en verde', 3600);
  markedPocket = k;
  pocketMark.visible = k !== null;
  if (!pocketMark.visible) return;
  const p = POCKETS[k];
  pocketMark.position.set(p.x, TABLE_TOP_Y + 0.002, p.z);
  pocketMark.material.opacity = 0.55 + 0.35 * Math.sin(now * 0.005);
}
scene.add(balls.group);
lighting.captureEnvironment([balls.group]);

// Prepara todos los sombreadores al cargar, tambien los de objetos que aun no se ven (taco, guia, marcas).
// Asi la primera vez que aparecen no hay un tiron mientras el navegador los compila.
function warmShaders() {
  const hidden = [];
  scene.traverse((o) => { if (!o.visible) { hidden.push(o); o.visible = true; } });
  try {
    renderer.compile(scene, camera);
  } finally {
    for (const o of hidden) o.visible = false;
  }
}

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

// ---------- En linea ----------
// Los dos dispositivos simulan la misma fisica: solo se envian las acciones de quien tira.
// me: 0 quien crea la sala, 1 quien se une. shots cuenta los tiros para descartar copias de estado viejas.
const net = { link: null, active: false, me: 0, name: '', shots: 0, shooter: false, applying: false, inbox: [], sent: { x: 0, z: 0, t: 0 } };
const myTurn = () => !net.active || game.match.turn === net.me;
const say = (msg) => { if (net.link) net.link.send(msg); };

// Las acciones propias se envian al rival; las del rival no se pueden hacer desde aqui.
for (const [fn, build] of [
  ['shoot', (a) => ({ t: 'shot', dx: a[0], dz: a[1], p: a[2], a: a[3] || 0, b: a[4] || 0 })],
  ['placeCue', (a) => ({ t: 'confirm', x: a[0], z: a[1] })],
  ['startPlacing', () => ({ t: 'replace' })],
]) {
  const orig = game[fn];
  game[fn] = (...a) => {
    if (net.active && !net.applying && !myTurn()) return false;
    const ok = orig(...a);
    if (ok && net.active) {
      if (fn === 'shoot') net.shots++;
      if (!net.applying) {
        if (fn === 'shoot') net.shooter = true;
        say(build(a));
      }
    }
    return ok;
  };
}

// ---------- Maquina ----------
// vsAi: partida contra la maquina, que es siempre el jugador 1.
const ai = { on: false, stage: 'idle', t: 0, shot: null };
const aiTurn = () => ai.on && game.match.turn === 1 && game.match.phase !== 'over';

function driveAi(dt) {
  if (!aiTurn() || (game.state !== 'aiming' && game.state !== 'placing')) {
    if (ai.stage !== 'idle' && game.state !== 'aiming') {
      ai.stage = 'idle';
      ai.t = 0;
    }
    if (aimView.auto && !aimView.striking && game.state !== 'aiming') aimView.exit();
    return;
  }
  ai.t += dt;
  if (ai.stage === 'idle' && ai.t > 1.0) {
    if (game.state === 'placing') {
      const s = choosePlacement(game.table, game.match);
      if (!game.placeCue(s.x, s.z)) {
        const f = findFreeSpot(game.table, 0, 0.6, game.match.ballInHand === 'kitchen');
        game.placeCue(f.x, f.z);
      }
    }
    ai.stage = 'think';
    ai.t = 0;
  } else if (ai.stage === 'think' && ai.t > 0.5 && game.state === 'aiming') {
    ai.shot = chooseShot(game.table, game.match);
    aimView.setSpin(0, 0);
    aimView.enterAuto(ai.shot.dirX, ai.shot.dirZ);
    ai.stage = 'pull';
    ai.t = 0;
  } else if (ai.stage === 'pull') {
    aimView.setPull(ai.shot.power * Math.min(1, ai.t / 0.9));
    if (ai.t > 1.15) {
      pendingCue = ai.shot.power;
      aimView.release();
      ai.stage = 'fired';
    }
  }
}

const canAct = () => (game.state === 'aiming' || game.state === 'placing') && myTurn() && !aiTurn() && walker.distanceToTable() < 1.5;

function enterAim() {
  if (mode !== 'walk' || paused || !canAct()) return;
  aimView.enter(walker.x, walker.z);
  aimView.setSpin(settings.spin ? spin.side : 0, settings.spin ? spin.top : 0);
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

// Calidad automatica: empieza segun el dispositivo y baja un nivel si la imagen va a tirones.
const perf = { level: coarse ? 'media' : 'alta', t: 0, frames: 0, slow: 0, skip: 1 };
try {
  const saved = localStorage.getItem('billar.calidad');
  if (['alta', 'media', 'baja'].includes(saved)) perf.level = saved;
} catch (e) { /* sin almacenamiento */ }
function watchPerformance(dt) {
  if (settings.quality !== 'auto' || document.hidden || dt >= 0.1) return;
  perf.t += dt;
  perf.frames++;
  if (perf.t < 2.5) return;
  const fps = perf.frames / perf.t;
  perf.t = 0;
  perf.frames = 0;
  if (perf.skip > 0) { perf.skip--; return; } // tras un cambio, la primera medida no cuenta
  // En movil primero baja la resolucion; la calidad solo baja si ya esta al minimo.
  perf.slow = fps < 42 && lighting.resAtMinimum ? perf.slow + 1 : 0;
  if (perf.slow >= 2 && perf.level !== 'baja') {
    perf.level = perf.level === 'alta' ? 'media' : 'baja';
    perf.slow = 0;
    perf.skip = 1;
    try { localStorage.setItem('billar.calidad', perf.level); } catch (e) { /* sin almacenamiento */ }
    lighting.setQuality(perf.level);
  }
}

const spin = { side: 0, top: 0 }; // efecto elegido por el jugador
let lastState = game.state;
let endTimer = 0;
game.onEvent((e) => {
  sound.handle(e);
  if (e.type === 'pocket') balls.drop(e);
});
balls.onHit((speed) => sound.handle({ type: 'pocketHit', speed }));
game.onChange(() => {
  // Tras cada tiro el efecto vuelve al centro.
  if (game.state === 'rolling' && lastState !== 'rolling') {
    spin.side = 0;
    spin.top = 0;
    aimView.setSpin(0, 0);
    hud.setSpin(0, 0);
  }
  if (game.state === 'rolling' && mode === 'aim') leaveAim();
  else if (mode === 'aim' && game.state !== lastState) startBlend();
  if (lastState === 'rolling' && game.state !== 'rolling' && game.match.lastResult && game.match.lastResult.message) hud.toast(game.match.lastResult.message);
  // Quien ha tirado envia como ha quedado todo, por si los dos dispositivos difieren en algo.
  if (lastState === 'rolling' && game.state !== 'rolling' && net.active && net.shooter) {
    net.shooter = false;
    say({ t: 'state', n: net.shots, s: game.snapshot() });
  }
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

function startOnline(names, blackPocket = settings.blackPocket) {
  game.options.blackPocket = blackPocket;
  net.active = true;
  net.shots = 0;
  net.shooter = false;
  sound.unlock();
  game.restart(names, 'duel');
  resetPlayer();
  startBlend();
  closeMenu();
  hud.toast(net.me === 0 ? 'Sacas tú' : `Saca ${names[0]}`);
}

function endOnline() {
  if (net.link) net.link.close();
  net.link = null;
  net.active = false;
  net.inbox.length = 0;
}

const NET_ERRORS = {
  notfound: 'No hay ninguna sala con ese código',
  network: 'Fallo de conexión. Inténtalo otra vez',
  script: 'No se ha podido cargar la conexión. Comprueba tu internet',
  closed: 'Se ha cerrado la conexión',
};

function openLink() {
  endOnline();
  const link = createOnline({
    onReady(code) {
      if (net.link === link) menus.status('Esperando a tu rival…', code);
    },
    onConnected(role) {
      if (net.link !== link) return;
      net.me = role === 'host' ? 0 : 1;
      if (role === 'guest') {
        say({ t: 'hello', name: net.name });
        menus.status('Sala encontrada. Empezando…');
      }
    },
    onMessage(msg) {
      if (net.link !== link) return;
      // El saludo y el arranque se atienden al momento, aunque la pestana este en segundo plano
      // (por ejemplo, mientras quien creo la sala manda el codigo por otra aplicacion).
      if (msg.t === 'hello' || msg.t === 'start') {
        net.applying = true;
        try {
          applyRemote(msg);
        } finally {
          net.applying = false;
        }
      } else net.inbox.push(msg);
    },
    onClosed(reason) {
      if (net.link !== link) return;
      const playing = net.active;
      net.link = null;
      net.active = false;
      net.inbox.length = 0;
      if (playing) {
        clearTimeout(endTimer);
        if (mode === 'aim') leaveAim();
        openMenu('inicio');
        menus.status('Tu rival se ha desconectado');
      } else menus.status(NET_ERRORS[reason] || NET_ERRORS.network);
    },
  });
  net.link = link;
  return link;
}

function applyRemote(m) {
  const cue = game.table.balls[0];
  switch (m.t) {
    case 'hello':
      if (net.me === 0 && !net.active) {
        const names = [net.name, String(m.name || 'Rival').slice(0, 14)];
        if (names[0] === names[1]) names[1] += ' 2';
        say({ t: 'start', names, bp: settings.blackPocket });
        startOnline(names);
      }
      break;
    case 'start':
      if (net.me === 1 && Array.isArray(m.names)) startOnline([String(m.names[0]).slice(0, 14), String(m.names[1]).slice(0, 16)], !!m.bp);
      break;
    case 'place':
      if (net.active && !myTurn() && game.state === 'placing' && game.isLegalPlacement(m.x, m.z)) {
        cue.x = m.x;
        cue.z = m.z;
      }
      break;
    case 'confirm':
      if (net.active && !myTurn()) game.placeCue(m.x, m.z);
      break;
    case 'replace':
      if (net.active && !myTurn()) game.startPlacing();
      break;
    case 'shot':
      if (net.active && !myTurn() && game.shoot(m.dx, m.dz, m.p, m.a || 0, m.b || 0)) sound.cue(m.p);
      break;
    case 'state':
      // Vale si es al menos tan reciente como lo que hay aqui. Tambien recupera un tiro que se haya perdido.
      if (net.active && m.n >= net.shots && typeof m.s === 'string') {
        net.shots = m.n;
        if (m.s !== game.snapshot()) game.adopt(m.s);
      }
      break;
    case 'rematch':
    case 'restart':
      if (!net.active) break;
      clearTimeout(endTimer);
      net.shots = 0;
      if (m.t === 'rematch') game.rematch();
      else game.restart();
      resetPlayer();
      if (menus.open) closeMenu();
      hud.toast(`Saca ${game.match.players[game.match.turn].name}`);
      break;
    default:
  }
}

// Aplica los mensajes del rival en orden. Mientras ruedan las bolas esperan, para no adelantarse al tiro.
function pumpNet(now) {
  while (net.inbox.length && game.state !== 'rolling') {
    const m = net.inbox.shift();
    net.applying = true;
    try {
      applyRemote(m);
    } finally {
      net.applying = false;
    }
  }
  // Mientras coloco la blanca, el rival la ve moverse.
  if (net.active && myTurn() && game.state === 'placing') {
    const cue = game.table.balls[0];
    if ((cue.x !== net.sent.x || cue.z !== net.sent.z) && now - net.sent.t > 70) {
      net.sent = { x: cue.x, z: cue.z, t: now };
      say({ t: 'place', x: cue.x, z: cue.z });
    }
  }
}

function showEnd() {
  if (game.state !== 'over') return;
  if (mode === 'aim') leaveAim();
  const m = game.match;
  if (m.mode === 'solo') {
    const best = m.best ? ` Tu mejor marca: ${m.best} tiros.` : '';
    openMenu('fin', {
      title: m.winner === 0 ? 'Completado' : 'Has perdido',
      line: (m.winner === 0 ? `Lo has hecho en ${m.shots} tiros.` : m.lastResult.message + '.') + best,
      again: 'Otra vez',
    });
    return;
  }
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
  aimView.setGuide(settings.guide, settings.guideObject);
  if (!settings.spin) aimView.setSpin(0, 0);
  sound.setVolume(settings.volume);
  lighting.setQuality(settings.quality === 'auto' ? perf.level : settings.quality);
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
  onSpin: (side, top) => { spin.side = side; spin.top = top; if (mode === 'aim') aimView.setSpin(side, top); },
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
  onHost(name) {
    ai.on = false;
    net.name = name;
    openLink().host();
  },
  onJoin(name, code) {
    ai.on = false;
    net.name = name;
    openLink().join(code);
  },
  onOnlineCancel: endOnline,
  onVsAi(name) {
    endOnline();
    ai.on = true;
    ai.stage = 'idle';
    ai.t = 0;
    sound.unlock();
    game.options.blackPocket = settings.blackPocket;
    game.restart([name, name === 'Máquina' ? 'Máquina 2' : 'Máquina'], 'duel');
    resetPlayer();
    startBlend();
    closeMenu();
    hud.toast('Sacas tú');
  },
  onSolo(name) {
    endOnline();
    ai.on = false;
    sound.unlock();
    game.options.blackPocket = settings.blackPocket;
    game.restart([name], 'solo');
    resetPlayer();
    startBlend();
    closeMenu();
    hud.toast('Mete las nueve de color y la negra al final', 4200);
  },
  onStart(names) {
    endOnline();
    ai.on = false;
    sound.unlock();
    game.options.blackPocket = settings.blackPocket;
    game.restart(names, 'duel');
    resetPlayer();
    startBlend(); // la camara baja desde la vista de portada hasta el jugador
    closeMenu();
    hud.toast(`Saca ${names[0]}`);
  },
  onResume: closeMenu,
  onRestart() {
    clearTimeout(endTimer);
    if (net.active) { say({ t: 'restart' }); net.shots = 0; }
    game.restart();
    resetPlayer();
    closeMenu();
    if (game.match.mode !== 'solo') hud.toast(`Saca ${game.match.players[0].name}`);
  },
  onRematch() {
    if (net.active) { say({ t: 'rematch' }); net.shots = 0; }
    game.rematch();
    resetPlayer();
    closeMenu();
    if (game.match.mode !== 'solo') hud.toast(`Saca ${game.match.players[game.match.turn].name}`);
  },
  onQuit() {
    clearTimeout(endTimer);
    endOnline();
    ai.on = false;
    if (aimView.auto) aimView.exit();
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
  if ((aiTurn() || (net.active && !myTurn())) && (game.state === 'aiming' || game.state === 'placing')) hint = `Turno de ${m.players[m.turn].name}. Espera su tiro`;
  hud.update({
    mode,
    touch: isTouch,
    state: game.state,
    turn: m.turn,
    over: m.phase === 'over',
    players: m.mode === 'solo'
      ? [
        { name: m.players[0].name, group: null, left: 0, text: soloRemaining(m) > 0 ? `Quedan ${soloRemaining(m)} y la negra` : 'A por la negra' },
        { name: 'Tiros', group: null, left: 0, text: m.best ? `${m.shots} · Mejor ${m.best}` : String(m.shots) },
      ]
      : m.players.map((p, i) => ({ name: net.active && i === net.me ? `${p.name} (tú)` : p.name, group: p.group, left: remaining(m, i) })),
    spin: settings.spin,
    noDraw: mode === 'aim' && aimView.blocked,
    noSpin: mode === 'aim' && aimView.noSpin,
    canAct: canAct(),
    actLabel: game.state === 'placing' ? 'Colocar blanca' : 'Tirar',
    canPlace: game.canPlace() && myTurn() && !aiTurn(),
    kitchen: m.ballInHand === 'kitchen',
    hint,
  });
}

// Contador de fotogramas por segundo, opcional en Ajustes.
const fpsBox = document.createElement('div');
fpsBox.className = 'fps';
fpsBox.hidden = true;
uiRoot.appendChild(fpsBox);
const fpsMeter = { t: 0, n: 0, worst: 0 };
function updateFps(dt) {
  fpsBox.hidden = !settings.showFps;
  if (!settings.showFps) return;
  fpsMeter.t += dt;
  fpsMeter.n++;
  fpsMeter.worst = Math.max(fpsMeter.worst, dt);
  if (fpsMeter.t >= 0.5) {
    const res = lighting.mobile ? ` · móvil ${Math.round(lighting.resScale * 100)} %` : '';
    fpsBox.textContent = `${Math.round(fpsMeter.n / fpsMeter.t)} fps · peor ${Math.round(fpsMeter.worst * 1000)} ms · ${lighting.quality}${res}`;
    fpsMeter.t = 0;
    fpsMeter.n = 0;
    fpsMeter.worst = 0;
  }
}

function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min((now - lastT) / 1000, 0.1);
  lastT = now;
  pumpNet(now);
  watchPerformance(dt);
  updateFps(dt);
  if (!paused) {
    acc += dt;
    let n = 0;
    while (acc >= DT && n < 8) {
      game.tick();
      acc -= DT;
      n++;
    }
    if (acc >= DT) acc = 0;

    driveAi(dt);
    if (mode === 'walk') {
      const mv = input.move();
      walker.update(dt, mv.x + touch.move.x, mv.z + touch.move.z, mv.run);
      // El taco de la maquina se anima aunque el jugador siga caminando.
      if (aimView.auto) aimView.update(dt, () => sound.cue(pendingCue));
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
  if (menus.cover) {
    // Portada: la camara se mece despacio al sureste de la mesa y la deja a la derecha del encuadre.
    const a = 0.72 + 0.4 * Math.sin(now * 0.00011);
    const fx = -Math.sin(a), fz = -Math.cos(a); // hacia la mesa
    const shift = camera.aspect > 1.2 ? 1.05 : 0;
    camera.position.set(-fx * 3.3, 1.85, -fz * 3.3);
    camera.lookAt(fz * shift, 0.72, -fx * shift);
  } else if (blend.t < 1) {
    blend.t = Math.min(1, blend.t + dt / BLEND_TIME);
    const e = blend.t * blend.t * (3 - 2 * blend.t);
    camera.position.lerpVectors(blend.pos, pose.position, e);
    camera.quaternion.slerpQuaternions(blend.quat, pose.quaternion, e);
  } else {
    camera.position.copy(pose.position);
    camera.quaternion.copy(pose.quaternion);
  }

  touch.setActive(isTouch && mode === 'walk' && !paused);
  // El cursor no se ve sobre la imagen mientras se juega; solo al colocar la blanca, que se arrastra.
  const cursor = paused ? '' : (mode === 'aim' && game.state === 'placing' ? 'grab' : 'none');
  if (canvas.style.cursor !== cursor) canvas.style.cursor = cursor;
  // Sonido de rodadura segun lo rapido que van las bolas.
  let rolling = 0;
  if (game.state === 'rolling' && !paused) {
    for (const b of game.table.balls) if (!b.pocketed) rolling += Math.sqrt(b.vx * b.vx + b.vz * b.vz);
  }
  sound.roll(rolling);
  balls.sync(game.table, paused ? 0 : dt);
  updatePocketMark(now);
  updateHud();
  lighting.render(game.state === 'rolling' || game.state === 'placing' || aimView.active, paused ? 0 : dt);
}
requestAnimationFrame(frame);

addEventListener('resize', () => {
  lighting.resize(innerWidth, innerHeight);
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  checkOrientation();
});

// Al cerrar la pagina se avisa al rival, para que no se quede esperando.
addEventListener('pagehide', () => { if (net.link) net.link.close(); });

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
warmShaders();
openMenu('inicio');

// Acceso para depurar desde la consola.
window.__billar = { balls, perf, merged, ai, net, pumpNet, settings, menus, pause, room, lighting, game, walker, aimView, camera, scene, renderer, get mode() { return mode; }, enterAim, leaveAim };
