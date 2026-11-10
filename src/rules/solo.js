// Reglas del modo en solitario: diez bolas, la negra al final.
// Modulo puro, con la misma forma de partida que eightball.js para que la interfaz no distinga.

export const SOLO_BALLS = [1, 2, 3, 4, 5, 9, 10, 11, 12]; // las nueve de color; la 8 va la ultima

export function newSolo(name, best = null) {
  return {
    mode: 'solo',
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

  if (dropped.includes(8)) {
    next.phase = 'over';
    const clean = leftBefore === 0 && !summary.cuePocketed;
    next.winner = clean ? 0 : -1;
    if (clean) {
      if (next.best === null || next.shots < next.best) next.best = next.shots;
      result.message = `Completado en ${next.shots} tiros`;
    } else {
      result.message = leftBefore === 0 ? 'Negra y blanca a la vez: has perdido' : 'Negra antes de tiempo: has perdido';
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
