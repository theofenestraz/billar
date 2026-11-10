// Rival controlado por el juego, de nivel medio.
// Busca tiros de tronera con la bola fantasma, los comprueba simulandolos y apunta con un pequeno error.
// No toca la pantalla ni la partida real: recibe copias y devuelve decisiones.

import { R, HALF_W, HALF_L, cueSpeed, POWER_SCALE } from '../physics/constants.js';

// La fuerza se calculo con la barra antigua: se corrige para pedir la misma velocidad con la nueva.
const RESCALE = 1 / Math.sqrt(POWER_SCALE);
import { POCKETS } from '../physics/table.js';
import { simulateShot, isLegalCuePosition, findFreeSpot } from '../physics/simulate.js';
import { groupOf, summarizeShot, applyShot, blackTarget } from '../rules/eightball.js';

const AIM_ERROR = 0.011; // amplitud del error de punteria, en radianes
const MAX_CUT_COS = 0.38; // cortes mas finos que esto no se intentan
const CHECKS = 6; // cuantos candidatos se simulan
const HEAD_Z = 0.495;

const clone = (o) => JSON.parse(JSON.stringify(o));

// Punto al que apuntar dentro de cada tronera, algo metido hacia la mesa.
const TARGETS = POCKETS.map((p) => ({
  x: p.x > 0 ? Math.min(p.x, HALF_W) - (p.z === 0 ? 0 : 0.012) : Math.max(p.x, -HALF_W) + (p.z === 0 ? 0 : 0.012),
  z: p.z === 0 ? 0 : (p.z > 0 ? HALF_L - 0.012 : -HALF_L + 0.012),
  side: p.z === 0,
}));

// Bolas que se pueden tocar primero sin hacer falta.
export function legalTargets(table, match) {
  const me = match.turn;
  const group = match.players[me].group;
  const live = table.balls.filter((b) => b.id !== 0 && !b.pocketed);
  if (match.phase === 'break') return live;
  if (group === null) return live.filter((b) => b.id !== 8);
  const mine = live.filter((b) => groupOf(b.id) === group);
  return mine.length ? mine : live.filter((b) => b.id === 8);
}

// Distancia de un punto al segmento a-b.
function distToSegment(px, pz, ax, az, bx, bz) {
  const dx = bx - ax;
  const dz = bz - az;
  const len2 = dx * dx + dz * dz;
  let t = len2 > 0 ? ((px - ax) * dx + (pz - az) * dz) / len2 : 0;
  t = t < 0 ? 0 : t > 1 ? 1 : t;
  return Math.hypot(px - (ax + dx * t), pz - (az + dz * t));
}

function pathClear(table, ax, az, bx, bz, skipA, skipB) {
  for (const b of table.balls) {
    if (b.pocketed || b.id === skipA || b.id === skipB) continue;
    if (distToSegment(b.x, b.z, ax, az, bx, bz) < 2 * R - 0.001) return false;
  }
  return true;
}

// Tiros de tronera posibles desde (cx, cz), ordenados de mejor a peor.
function candidates(table, match, cx, cz) {
  const out = [];
  const only = blackTarget(match, match.turn); // tronera obligatoria para la negra
  for (const ball of legalTargets(table, match)) {
    for (const [k, p] of TARGETS.entries()) {
      if (ball.id === 8 && only !== null && k !== only) continue;
      const tx = p.x - ball.x;
      const tz = p.z - ball.z;
      const d2 = Math.hypot(tx, tz);
      if (d2 < 1e-6) continue;
      const ux = tx / d2;
      const uz = tz / d2;
      // En las troneras laterales la bola tiene que llegar bastante de frente.
      if (p.side && Math.abs(ux) < 0.5) continue;
      const gx = ball.x - ux * 2 * R;
      const gz = ball.z - uz * 2 * R;
      const ax = gx - cx;
      const az = gz - cz;
      const d1 = Math.hypot(ax, az);
      if (d1 < 1e-6) continue;
      const dirX = ax / d1;
      const dirZ = az / d1;
      const cos = dirX * ux + dirZ * uz;
      if (cos < MAX_CUT_COS) continue;
      if (!pathClear(table, cx, cz, gx, gz, 0, ball.id)) continue;
      if (!pathClear(table, ball.x, ball.z, p.x, p.z, 0, ball.id)) continue;
      const power = Math.min(0.95, RESCALE * Math.max(0.24, Math.min(0.8, 0.2 + (0.17 * (d1 + d2)) / cos)));
      out.push({ dirX, dirZ, power, ball: ball.id, score: (cos * cos) / (1 + 0.6 * d1 + 0.9 * d2) });
    }
  }
  out.sort((a, b) => b.score - a.score);
  return out;
}

// Resultado de un tiro sobre copias de la mesa y la partida.
function outcome(table, match, shot) {
  const t = clone(table);
  const speed = cueSpeed(shot.power);
  const { events } = simulateShot(t, { dirX: shot.dirX, dirZ: shot.dirZ, speed });
  const next = applyShot(match, summarizeShot(events));
  const me = match.turn;
  const r = next.lastResult;
  return {
    foul: r.foul !== null,
    pots: r.continues || (next.phase === 'over' && next.winner === me),
    loses: next.phase === 'over' && next.winner !== me,
  };
}

function withError(shot, rand) {
  const e = (rand() + rand() + rand() - 1.5) * AIM_ERROR;
  const c = Math.cos(e);
  const s = Math.sin(e);
  return { dirX: shot.dirX * c - shot.dirZ * s, dirZ: shot.dirX * s + shot.dirZ * c, power: shot.power };
}

// Decide el tiro. rand devuelve numeros entre 0 y 1.
export function chooseShot(table, match, rand = Math.random) {
  const cue = table.balls[0];
  if (match.phase === 'break') {
    const apex = table.balls[1];
    const d = Math.hypot(apex.x - cue.x, apex.z - cue.z);
    return withError({ dirX: (apex.x - cue.x) / d, dirZ: (apex.z - cue.z) / d, power: 1 }, rand);
  }
  const list = candidates(table, match, cue.x, cue.z);
  let safe = null;
  for (let i = 0; i < list.length && i < CHECKS; i++) {
    const o = outcome(table, match, list[i]);
    if (o.loses || o.foul) continue;
    if (o.pots) return withError(list[i], rand);
    if (!safe) safe = list[i];
  }
  if (safe) return withError(safe, rand);
  // Sin tiro de tronera: tocar una bola propia sin hacer falta, la mas cercana primero.
  const targets = legalTargets(table, match)
    .map((b) => ({ b, d: Math.hypot(b.x - cue.x, b.z - cue.z) }))
    .sort((a, b) => a.d - b.d);
  // Se prueban varias fuerzas y algo de corte a cada lado; se evita sobre todo perder la partida.
  let fallback = null;
  let notLosing = null;
  for (const { b, d } of targets) {
    if (d < 1e-6) continue;
    const ux = (b.x - cue.x) / d;
    const uz = (b.z - cue.z) / d;
    for (const cut of [0, 0.35, -0.35, 0.7, -0.7]) {
      // Desplazar el punto de mira hacia un lado de la bola, en fracciones de diametro.
      const ax = b.x - uz * cut * 2 * R - cue.x;
      const az = b.z + ux * cut * 2 * R - cue.z;
      const al = Math.hypot(ax, az);
      for (const power of [0.22, 0.32, 0.16, 0.45]) {
        const shot = { dirX: ax / al, dirZ: az / al, power };
        if (!fallback) fallback = shot;
        const o = outcome(table, match, shot);
        if (o.loses) continue;
        if (!notLosing) notLosing = shot;
        if (!o.foul) return withError(shot, rand);
      }
    }
  }
  return withError(notLosing || fallback || { dirX: 0, dirZ: -1, power: 0.3 }, rand);
}

// Donde colocar la blanca con bola en mano.
export function choosePlacement(table, match) {
  const kitchen = match.ballInHand === 'kitchen';
  if (match.phase === 'break') return findFreeSpot(table, 0.14, HEAD_Z + 0.12, true);
  let best = null;
  const only = blackTarget(match, match.turn);
  for (const ball of legalTargets(table, match)) {
    for (const [k, p] of TARGETS.entries()) {
      if (ball.id === 8 && only !== null && k !== only) continue;
      const d2 = Math.hypot(p.x - ball.x, p.z - ball.z);
      if (d2 < 1e-6) continue;
      const ux = (p.x - ball.x) / d2;
      const uz = (p.z - ball.z) / d2;
      if (p.side && Math.abs(ux) < 0.5) continue;
      if (!pathClear(table, ball.x, ball.z, p.x, p.z, 0, ball.id)) continue;
      // Detras de la bola, en linea con la tronera.
      for (const back of [0.32, 0.22, 0.45]) {
        const x = ball.x - ux * (2 * R + back);
        const z = ball.z - uz * (2 * R + back);
        if (!isLegalCuePosition(table, x, z, kitchen)) continue;
        if (!pathClear(table, x, z, ball.x - ux * 2 * R, ball.z - uz * 2 * R, 0, ball.id)) continue;
        const score = 1 / (1 + d2);
        if (!best || score > best.score) best = { x, z, score };
        break;
      }
    }
  }
  if (best) return { x: best.x, z: best.z };
  return findFreeSpot(table, 0, kitchen ? HEAD_Z + 0.1 : 0, kitchen);
}
