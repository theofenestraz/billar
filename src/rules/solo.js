// Reglas del modo en solitario: diez bolas, la negra al final.
// Modulo puro, con la misma forma de partida que eightball.js para que la interfaz no distinga.

export const SOLO_BALLS = [1, 2, 3, 4, 5, 9, 10, 11, 12]; // las nueve de color; la 8 va la ultima

import { OPPOSITE } from './eightball.js';

// opts.blackPocket: la negra va a la tronera contraria a la de la ultima bola de color.
export function newSolo(name, best = null, opts = {}) {
  return {
    mode: 'solo',
    blackPocket: !!opts.blackPocket,
    lastPocket: null,
    players: [{ name, group: null, wins: 0 }],
    turn: 0,
    phase: 'break', // 'break' | 'play' | 'over'
    ballInHand: 'kitchen',
    pocketed: [],
    winner: null, // 0 si se completa, -1 si se pierde
    shots: 0,
    best, // mejor marca en tiros de esta sesion
    lastResult: null,
  };
}

// Tronera obligatoria para la negra, o null si vale cualquiera.
export function soloBlackTarget(match) {
  if (!match.blackPocket || match.lastPocket === null || soloRemaining(match) > 0) return null;
  return OPPOSITE[match.lastPocket];
}

// Bolas de color que quedan por embocar.
export function soloRemaining(match) {
  let n = 0;
  for (const id of SOLO_BALLS) if (!match.pocketed.includes(id)) n++;
  return n;
}

export function applySoloShot(match, summary) {
  const next = { ...match, players: match.players.map((p) => ({ ...p })), pocketed: [...match.pocketed], ballInHand: null };
  const result = { foul: null, continues: true, assigned: null, rerack: false, message: '' };
  next.lastResult = result;
  next.shots = match.shots + 1;
  next.phase = 'play';
  const leftBefore = soloRemaining(match);
  const dropped = summary.pocketed.filter((id) => id !== 0);
  for (const id of dropped) if (!next.pocketed.includes(id)) next.pocketed.push(id);
  const left = soloRemaining(next);
  const at = summary.pocketOf || {};
  for (const id of dropped) if (id !== 8 && typeof at[id] === 'number') next.lastPocket = at[id];

  if (dropped.includes(8)) {
    next.phase = 'over';
    const target = soloBlackTarget(match);
    const wrongPocket = target !== null && leftBefore === 0 && at[8] !== target;
    const clean = leftBefore === 0 && !summary.cuePocketed && !wrongPocket;
    next.winner = clean ? 0 : -1;
    if (clean) {
      if (next.best === null || next.shots < next.best) next.best = next.shots;
      result.message = `Completado en ${next.shots} tiros`;
    } else {
      result.message = leftBefore > 0 ? 'Negra antes de tiempo: has perdido'
        : summary.cuePocketed ? 'Negra y blanca a la vez: has perdido' : 'Negra en otra tronera: has perdido';
    }
    return next;
  }
  if (summary.cuePocketed) {
    result.foul = 'scratch';
    result.message = 'Blanca embocada: vuelve a la salida';
  } else if (dropped.length > 0) {
    result.message = left === 0 ? 'Solo queda la negra' : `Quedan ${left} y la negra`;
  } else {
    result.message = '';
  }
  return next;
}
