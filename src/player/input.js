// Teclado y raton para ordenador.

const LOOK_RATE = 0.0022; // radianes por pixel de raton

export function createDesktopInput(canvas, handlers) {
  const keys = new Set();
  let sensitivity = 1;
  let invertY = false;
  let expectUnlock = false;

  addEventListener('keydown', (e) => {
    if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) return;
    if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault();
    if (!e.repeat) handlers.onKeyDown && handlers.onKeyDown(e.code);
    keys.add(e.code);
  });
  addEventListener('keyup', (e) => {
    keys.delete(e.code);
    handlers.onKeyUp && handlers.onKeyUp(e.code);
  });
  addEventListener('blur', () => keys.clear());

  document.addEventListener('mousemove', (e) => {
    if (document.pointerLockElement !== canvas) return;
    const k = LOOK_RATE * sensitivity;
    handlers.onLook(-e.movementX * k, -e.movementY * k * (invertY ? -1 : 1));
  });
  document.addEventListener('pointerlockchange', () => {
    const locked = document.pointerLockElement === canvas;
    if (!locked && !expectUnlock) handlers.onLockLost && handlers.onLockLost();
    expectUnlock = false;
    handlers.onLockChange && handlers.onLockChange(locked);
  });
  // Algunos navegadores rechazan capturar el raton si se acaba de soltar (pasa en Windows al
  // reanudar justo despues de Esc). Se reintenta una vez pasado ese margen.
  let retry = 0;
  let wantLock = false;
  let retries = 0;
  document.addEventListener('pointerlockerror', () => {
    handlers.onLockChange && handlers.onLockChange(false);
    clearTimeout(retry);
    if (wantLock && retries < 2) {
      retries++;
      retry = setTimeout(() => { if (wantLock && document.pointerLockElement !== canvas) request(); }, 1300);
    }
  });
  function request() {
    try {
      const p = canvas.requestPointerLock();
      if (p && p.catch) p.catch(() => {});
    } catch (e) { /* el navegador puede rechazarlo sin gesto del usuario */ }
  }
  canvas.addEventListener('wheel', (e) => {
    e.preventDefault();
    handlers.onWheel && handlers.onWheel(Math.sign(e.deltaY));
  }, { passive: false });

  const down = (...codes) => codes.some((c) => keys.has(c));

  return {
    get locked() { return document.pointerLockElement === canvas; },
    lock() {
      wantLock = true;
      retries = 0;
      if (document.pointerLockElement === canvas) return;
      request();
    },
    // Suelta el raton a proposito, sin que cuente como perdida de captura.
    unlock() {
      wantLock = false;
      clearTimeout(retry);
      if (document.pointerLockElement === canvas) {
        expectUnlock = true;
        document.exitPointerLock();
      }
    },
    setOptions(o) {
      sensitivity = o.sensitivity;
      invertY = o.invertY;
    },
    // Movimiento para caminar: x derecha, z adelante.
    move() {
      return {
        x: (down('KeyD', 'ArrowRight') ? 1 : 0) - (down('KeyA', 'ArrowLeft') ? 1 : 0),
        z: (down('KeyW', 'ArrowUp') ? 1 : 0) - (down('KeyS', 'ArrowDown') ? 1 : 0),
        run: down('ShiftLeft', 'ShiftRight'),
      };
    },
    isDown: down,
  };
}
