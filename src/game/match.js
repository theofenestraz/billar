// Coordinador de la partida: une la fisica con las reglas.
// No conoce la pantalla: la interfaz lo consulta y escucha sus avisos.

import { MIN_CUE_SPEED, MAX_CUE_SPEED, MAX_STEPS } from '../physics/constants.js';
import { createRack, strike, step, isAtRest, forceRest, findFreeSpot, isLegalCuePosition } from '../physics/simulate.js';
import { newMatch, summarizeShot, applyShot, rematch as rulesRematch } from '../rules/eightball.js';

const MIN_POWER = 0.03;
const HEAD_Z = 0.495;

export function createGame(names) {
  const eventListeners = [];
  const changeListeners = [];
  let shotEvents = [];
  let steps = 0;

  const changed = () => {
    for (const cb of changeListeners) cb(game);
  };

  function resolveShot() {
    if (!isAtRest(game.table)) forceRest(game.table);
    const summary = summarizeShot(shotEvents);
    game.match = applyShot(game.match, summary);
    if (game.match.lastResult.rerack) {
      game.table = createRack();
    } else if (summary.cuePocketed) {
      const cue = game.table.balls[0];
      const spot = findFreeSpot(game.table, 0, HEAD_Z, false);
      cue.pocketed = false;
      cue.x = spot.x;
      cue.z = spot.z;
    }
    if (game.match.phase === 'over') game.state = 'over';
    else game.state = game.match.ballInHand ? 'placing' : 'aiming';
    changed();
  }

  const game = {
    table: createRack(),
    match: newMatch(names),
    state: 'placing', // 'placing' | 'aiming' | 'rolling' | 'over'

    // power01 entre 0 y 1. Devuelve false si el tiro no se acepta.
    shoot(dirX, dirZ, power01) {
      if (game.state !== 'aiming' || !(power01 >= MIN_POWER)) return false;
      const p = power01 > 1 ? 1 : power01;
      const speed = MIN_CUE_SPEED + p * p * (MAX_CUE_SPEED - MIN_CUE_SPEED);
      strike(game.table, { dirX, dirZ, speed });
      shotEvents = [];
      steps = 0;
      game.state = 'rolling';
      changed();
      return true;
    },

    canPlace() {
      return game.match.ballInHand !== null && (game.state === 'placing' || game.state === 'aiming');
    },

    isLegalPlacement(x, z) {
      return isLegalCuePosition(game.table, x, z, game.match.ballInHand === 'kitchen');
    },

    // Coloca la blanca con bola en mano y pasa a apuntar.
    placeCue(x, z) {
      if (!game.canPlace() || !game.isLegalPlacement(x, z)) return false;
      const cue = game.table.balls[0];
      cue.x = x;
      cue.z = z;
      game.state = 'aiming';
      changed();
      return true;
    },

    // Vuelve a recolocar la blanca si aun hay bola en mano.
    startPlacing() {
      if (!game.canPlace()) return false;
      game.state = 'placing';
      changed();
      return true;
    },

    // Avanza un paso de fisica. Devuelve los sucesos de ese paso.
    tick() {
      if (game.state !== 'rolling') return [];
      const events = [];
      step(game.table, events);
      steps++;
      for (const e of events) {
        shotEvents.push(e);
        for (const cb of eventListeners) cb(e);
      }
      if (isAtRest(game.table) || steps >= MAX_STEPS) resolveShot();
      return events;
    },

    restart(newNames) {
      const n = newNames || [game.match.players[0].name, game.match.players[1].name];
      game.match = newMatch(n);
      game.table = createRack();
      game.state = 'placing';
      changed();
    },

    rematch() {
      game.match = rulesRematch(game.match);
      game.table = createRack();
      game.state = 'placing';
      changed();
    },

    onEvent(cb) {
      eventListeners.push(cb);
    },
    onChange(cb) {
      changeListeners.push(cb);
    },
  };
  return game;
}
