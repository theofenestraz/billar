// Reglas de bola 8, version de bar. Modulo puro: no conoce la pantalla ni la fisica.

export function groupOf(id) {
  if (id === 0) return 'cue';
  if (id === 8) return 'eight';
  return id < 8 ? 'solids' : 'stripes';
}

const GROUP_NAME = { solids: 'lisas', stripes: 'rayadas' };
const other = (g) => (g === 'solids' ? 'stripes' : 'solids');

export function newMatch(names, breaker = 0) {
  return {
    players: [
      { name: names[0], group: null, wins: 0 },
      { name: names[1], group: null, wins: 0 },
    ],
    turn: breaker,
    phase: 'break',
    ballInHand: 'kitchen',
    pocketed: [],
    winner: null,
    lastResult: null,
  };
}

function leftInGroup(pocketed, group) {
  let n = 0;
  for (let id = 1; id <= 15; id++) {
    if (groupOf(id) === group && !pocketed.includes(id)) n++;
  }
  return n;
}

// Bolas que le quedan a un jugador antes de ir a por la negra.
export function remaining(match, player) {
  const g = match.players[player].group;
  return g === null ? 7 : leftInGroup(match.pocketed, g);
}

// Resume los sucesos de la fisica en lo que importa para las reglas.
export function summarizeShot(events) {
  let firstContact = null;
  const pocketed = [];
  let cuePocketed = false;
  for (const e of events) {
    if (e.type === 'ballBall' && firstContact === null && (e.a === 0 || e.b === 0)) {
      firstContact = e.a === 0 ? e.b : e.a;
    } else if (e.type === 'pocket') {
      if (e.ball === 0) cuePocketed = true;
      else pocketed.push(e.ball);
    }
  }
  return { firstContact, pocketed, cuePocketed };
}

const FOUL_TEXT = {
  scratch: 'Falta: blanca embocada',
  noContact: 'Falta: no has tocado ninguna bola',
  wrongBall: 'Falta: primera bola incorrecta',
};

// Aplica un tiro a la partida y devuelve una partida nueva.
export function applyShot(match, summary) {
  const me = match.turn;
  const rival = 1 - me;
  const players = match.players.map((p) => ({ ...p }));
  const next = { ...match, players, pocketed: [...match.pocketed], ballInHand: null };
  const myName = players[me].name;
  const rivalName = players[rival].name;
  const myGroup = players[me].group;
  const clearedBefore = myGroup !== null && leftInGroup(match.pocketed, myGroup) === 0;
  const dropped = summary.pocketed.filter((id) => id !== 0);
  const eight = dropped.includes(8);
  const result = { foul: null, continues: false, assigned: null, rerack: false, message: '' };
  next.lastResult = result;

  if (summary.cuePocketed) result.foul = 'scratch';
  else if (summary.firstContact === null) result.foul = 'noContact';
  else {
    const g = groupOf(summary.firstContact);
    let valid;
    if (match.phase === 'break') valid = true;
    else if (myGroup === null) valid = g !== 'eight';
    else valid = clearedBefore ? g === 'eight' : g === myGroup;
    if (!valid) result.foul = 'wrongBall';
  }

  // 1. Negra en el saque: se repite.
  if (match.phase === 'break' && eight) {
    next.pocketed = [];
    next.ballInHand = 'kitchen';
    result.rerack = true;
    result.continues = true;
    result.message = 'Negra en el saque: se repite el saque';
    return next;
  }

  for (const id of dropped) if (!next.pocketed.includes(id)) next.pocketed.push(id);

  // 2. Negra embocada: fin de la partida.
  if (eight) {
    const win = clearedBefore && result.foul === null;
    next.winner = win ? me : rival;
    next.phase = 'over';
    players[next.winner].wins++;
    result.message = win
      ? `${myName} emboca la negra y gana`
      : `${myName} pierde: ${clearedBefore ? 'negra con falta' : 'negra antes de tiempo'}`;
    return next;
  }

  // 3. Falta.
  if (result.foul !== null) {
    next.phase = 'play';
    next.turn = rival;
    next.ballInHand = 'anywhere';
    result.message = `${FOUL_TEXT[result.foul]}. Bola en mano para ${rivalName}`;
    return next;
  }

  if (match.phase === 'break') {
    // 4. Saque sin falta.
    next.phase = 'play';
    result.continues = dropped.length > 0;
  } else if (myGroup === null) {
    // 5. Mesa abierta.
    if (dropped.length > 0) {
      const g = groupOf(dropped[0]);
      players[me].group = g;
      players[rival].group = other(g);
      result.assigned = g;
      result.continues = true;
    }
  } else {
    // 6. Grupo asignado.
    result.continues = dropped.some((id) => groupOf(id) === myGroup);
  }

  if (result.assigned) result.message = `${myName} va a ${GROUP_NAME[result.assigned]}`;
  else if (result.continues) result.message = `${myName} sigue tirando`;
  else result.message = `Turno de ${rivalName}`;
  if (!result.continues) next.turn = rival;
  return next;
}

// Partida nueva con los mismos jugadores. Saca quien perdio.
export function rematch(match) {
  const loser = match.winner === null ? 0 : 1 - match.winner;
  const m = newMatch([match.players[0].name, match.players[1].name], loser);
  m.players[0].wins = match.players[0].wins;
  m.players[1].wins = match.players[1].wins;
  return m;
}
