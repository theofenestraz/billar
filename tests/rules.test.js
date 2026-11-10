import { test, assert } from './harness.js';
import { newMatch, summarizeShot, applyShot, groupOf, remaining, rematch } from '../src/rules/eightball.js';

const shot = (firstContact, pocketed = [], cuePocketed = false) => ({ firstContact, pocketed, cuePocketed });
// Partida ya en juego, con el jugador 0 a lisas si se pide.
const playing = (assigned) => {
  let m = applyShot(newMatch(['A', 'B']), shot(1));
  // tras un saque sin embocar le toca a B; se devuelve el turno a A con un tiro en blanco de B
  m = applyShot(m, shot(1));
  if (assigned) m = applyShot(m, shot(1, [1]));
  return m;
};
const SOLIDS = [1, 2, 3, 4, 5, 6, 7];

test('rules: new match starts on the break with cue in the kitchen', () => {
  const m = newMatch(['A', 'B']);
  assert(m.turn === 0 && m.phase === 'break' && m.ballInHand === 'kitchen' && m.winner === null);
  assert(m.players[0].group === null && m.players[1].name === 'B');
  assert(groupOf(0) === 'cue' && groupOf(3) === 'solids' && groupOf(8) === 'eight' && groupOf(12) === 'stripes');
});

test('rules: summarizeShot reads first contact and pocketed balls in order', () => {
  const s = summarizeShot([
    { type: 'cushion', ball: 0, speed: 1 },
    { type: 'ballBall', a: 3, b: 5, speed: 1 },
    { type: 'ballBall', a: 0, b: 9, speed: 1 },
    { type: 'pocket', ball: 9, pocket: 2 },
    { type: 'pocket', ball: 0, pocket: 1 },
    { type: 'pocket', ball: 4, pocket: 1 },
  ]);
  assert(s.firstContact === 9 && s.cuePocketed === true);
  assert(JSON.stringify(s.pocketed) === '[9,4]');
});

test('rules 1: eight on the break means rerack, same player', () => {
  const m = applyShot(newMatch(['A', 'B']), shot(1, [3, 8], true));
  assert(m.lastResult.rerack && m.turn === 0 && m.phase === 'break' && m.pocketed.length === 0 && m.ballInHand === 'kitchen');
});

test('rules 2: eight with own group cleared and no foul wins', () => {
  let m = playing(true);
  m = { ...m, pocketed: [...SOLIDS], turn: 0 };
  const r = applyShot(m, shot(8, [8]));
  assert(r.phase === 'over' && r.winner === 0 && r.players[0].wins === 1);
});

test('rules 2: eight too early loses', () => {
  const r = applyShot(playing(true), shot(2, [8]));
  assert(r.phase === 'over' && r.winner === 1 && r.players[1].wins === 1);
});

test('rules 2: eight with the cue ball loses', () => {
  let m = playing(true);
  m = { ...m, pocketed: [...SOLIDS], turn: 0 };
  const r = applyShot(m, shot(8, [8], true));
  assert(r.winner === 1);
});

test('rules 2: last own ball and the eight in one shot loses', () => {
  let m = playing(true);
  m = { ...m, pocketed: [1, 2, 3, 4, 5, 6], turn: 0 };
  const r = applyShot(m, shot(7, [7, 8]));
  assert(r.winner === 1);
});

test('rules 3: scratch, no contact and wrong ball are fouls with ball in hand', () => {
  const m = playing(true);
  for (const [s, foul] of [[shot(1, [], true), 'scratch'], [shot(null), 'noContact'], [shot(9), 'wrongBall'], [shot(8), 'wrongBall']]) {
    const r = applyShot(m, s);
    assert(r.lastResult.foul === foul, `expected ${foul}, got ${r.lastResult.foul}`);
    assert(r.turn === 1 && r.ballInHand === 'anywhere' && r.lastResult.continues === false);
  }
});

test('rules 3: on an open table any ball but the eight is a legal first contact', () => {
  const m = playing(false);
  assert(applyShot(m, shot(9)).lastResult.foul === null);
  assert(applyShot(m, shot(8)).lastResult.foul === 'wrongBall');
});

test('rules 3: with the group cleared the eight is the legal first contact', () => {
  let m = playing(true);
  m = { ...m, pocketed: [...SOLIDS], turn: 0 };
  assert(applyShot(m, shot(8)).lastResult.foul === null);
  assert(applyShot(m, shot(9)).lastResult.foul === 'wrongBall');
});

test('rules 4: break keeps the turn only if a ball dropped, and assigns nothing', () => {
  const a = applyShot(newMatch(['A', 'B']), shot(1, [9]));
  assert(a.turn === 0 && a.phase === 'play' && a.players[0].group === null && a.ballInHand === null);
  const b = applyShot(newMatch(['A', 'B']), shot(1));
  assert(b.turn === 1 && b.phase === 'play');
});

test('rules 5: first ball pocketed on an open table assigns groups', () => {
  const r = applyShot(playing(false), shot(9, [9, 2]));
  assert(r.players[0].group === 'stripes' && r.players[1].group === 'solids' && r.turn === 0);
  assert(r.lastResult.assigned === 'stripes' && r.lastResult.continues);
});

test('rules 6: turn continues only when an own ball is pocketed', () => {
  const m = playing(true);
  assert(applyShot(m, shot(2, [2])).turn === 0, 'own ball');
  assert(applyShot(m, shot(2, [9])).turn === 1, 'rival ball only');
  assert(applyShot(m, shot(2, [9, 3])).turn === 0, 'own and rival');
  assert(applyShot(m, shot(2)).turn === 1, 'nothing');
});

test('rules 7: pocketed balls are recorded even on a foul', () => {
  const r = applyShot(playing(true), shot(2, [2, 9], true));
  assert(r.pocketed.includes(2) && r.pocketed.includes(9) && !r.pocketed.includes(0));
  assert(remaining(r, 0) === 5 && remaining(r, 1) === 6);
});

test('rules: applyShot does not mutate the match it receives', () => {
  const m = playing(true);
  const before = JSON.stringify(m);
  applyShot(m, shot(2, [2, 8], true));
  assert(JSON.stringify(m) === before);
});

test('rules: rematch keeps wins and the loser breaks', () => {
  const over = applyShot(playing(true), shot(2, [8]));
  const r = rematch(over);
  assert(r.phase === 'break' && r.turn === 0 && r.players[1].wins === 1 && r.players[0].group === null && r.pocketed.length === 0);
});

// ---------- Negra a la tronera contraria ----------
import { blackTarget, OPPOSITE } from '../src/rules/eightball.js';

const withPockets = (m) => m; // las partidas de abajo se construyen con el campo pocketOf
const ruled = () => {
  let m = applyShot(newMatch(['A', 'B'], 0, { blackPocket: true }), shot(1));
  m = applyShot(m, shot(1));
  m = applyShot(m, { firstContact: 1, pocketed: [1], cuePocketed: false, pocketOf: { 1: 3 } });
  return m;
};

test('black pocket: opposite pockets pair up through the centre', () => {
  for (let k = 0; k < 6; k++) assert(OPPOSITE[OPPOSITE[k]] === k && OPPOSITE[k] !== k);
  assert(OPPOSITE[0] === 3 && OPPOSITE[1] === 2 && OPPOSITE[4] === 5);
});

test('black pocket: remembers where the last ball of each group went', () => {
  const m = ruled();
  assert(m.players[0].group === 'solids' && m.lastPocket.solids === 3);
  const m2 = applyShot(m, { firstContact: 2, pocketed: [2, 9], cuePocketed: false, pocketOf: { 2: 4, 9: 1 } });
  assert(m2.lastPocket.solids === 4 && m2.lastPocket.stripes === 1);
  assert(blackTarget(m2, 0) === null, 'target before the group is cleared');
});

test('black pocket: black must go in the pocket opposite the last own ball', () => {
  let m = ruled();
  m = applyShot(m, { firstContact: 2, pocketed: [2, 3, 4, 5, 6, 7], cuePocketed: false, pocketOf: { 2: 0, 3: 0, 4: 0, 5: 0, 6: 0, 7: 5 } });
  assert(blackTarget(m, 0) === OPPOSITE[5] && blackTarget(m, 1) === null);
  const good = applyShot(m, { firstContact: 8, pocketed: [8], cuePocketed: false, pocketOf: { 8: 4 } });
  assert(good.phase === 'over' && good.winner === 0, 'right pocket did not win');
  const bad = applyShot(m, { firstContact: 8, pocketed: [8], cuePocketed: false, pocketOf: { 8: 3 } });
  assert(bad.phase === 'over' && bad.winner === 1 && /otra tronera/.test(bad.lastResult.message), 'wrong pocket did not lose');
});

test('black pocket: switched off, any pocket wins as before', () => {
  let m = applyShot(newMatch(['A', 'B']), shot(1));
  m = applyShot(m, shot(1));
  m = applyShot(m, { firstContact: 1, pocketed: [1, 2, 3, 4, 5, 6, 7], cuePocketed: false, pocketOf: { 7: 5 } });
  const any = applyShot(m, { firstContact: 8, pocketed: [8], cuePocketed: false, pocketOf: { 8: 3 } });
  assert(any.winner === 0 && blackTarget(m, 0) === null);
});

test('black pocket: rematch keeps the rule', () => {
  const m = { ...ruled(), phase: 'over', winner: 0 };
  assert(rematch(m).blackPocket === true);
});
