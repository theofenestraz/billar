// Coordinador de la partida: une la fisica con las reglas.
// No conoce la pantalla: la interfaz lo consulta y escucha sus avisos.

import { MAX_STEPS, cueSpeed } from '../physics/constants.js';
import { createRack, strike, step, isAtRest, forceRest, findFreeSpot, isLegalCuePosition } from '../physics/simulate.js';
import { newMatch, summarizeShot, applyShot, rematch as rulesRematch } from '../rules/eightball.js';
import { newSolo, applySoloShot } from '../rules/solo.js';

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
    const solo = game.match.mode === 'solo';
    game.match = solo ? applySoloShot(game.match, summary) : applyShot(game.match, summary);
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
    // blackPocket: regla de la negra a la tronera contraria. Se aplica al empezar cada partida.
    options: { blackPocket: false },
    table: createRack(),
    match: newMatch(names),
    state: 'placing', // 'placing' | 'aiming' | 'rolling' | 'over'

    // power01 entre 0 y 1. Devuelve false si el tiro no se acepta.
    // side y top: efecto, de -1 a 1 (ver strike).
    shoot(dirX, dirZ, power01, side = 0, top = 0) {
      if (game.state !== 'aiming' || !(power01 >= MIN_POWER)) return false;
      const speed = cueSpeed(power01);
      strike(game.table, { dirX, dirZ, speed, side, top });
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

    // mode 'solo': un jugador con diez bolas. Sin mode se mantiene el modo actual.
    restart(newNames, mode) {
      const solo = mode ? mode === 'solo' : game.match.mode === 'solo';
      if (solo) {
        const name = newNames ? newNames[0] : game.match.players[0].name;
        const best = game.match.mode === 'solo' ? game.match.best : null;
        game.match = newSolo(name, best, game.options);
        game.table = createRack('solo');
      } else {
        const n = newNames || [game.match.players[0].name, game.match.players[1].name];
        game.match = newMatch(n, 0, game.options);
        game.table = createRack();
      }
      game.state = 'placing';
      changed();
    },

    rematch() {
      if (game.match.mode === 'solo') {
        game.restart();
        return;
      }
      game.match = rulesRematch(game.match);
      game.table = createRack();
      game.state = 'placing';
      changed();
    },

    // Copia del estado completo como texto, para enviarla a otro dispositivo.
    snapshot() {
      return JSON.stringify({ table: game.table, match: game.match, state: game.state });
    },
    // Sustituye el estado por una copia recibida. Solo entre tiros.
    adopt(text) {
      if (game.state === 'rolling') return false;
      const s = JSON.parse(text);
      game.table = s.table;
      game.match = s.match;
      game.state = s.state;
      changed();
      return true;
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
