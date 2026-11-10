// Controles tactiles para caminar: joystick en un lado y arrastrar para mirar en el otro.

const STICK_RADIUS = 56; // pixeles de recorrido del joystick
const LOOK_RATE = 0.0048; // radianes por pixel

export function createTouchControls(root, handlers) {
  const layer = document.createElement('div');
  layer.className = 'touch';
  layer.hidden = true;
  layer.innerHTML = `
    <div class="zone zone-move"><div class="stick"><div class="nub"></div></div></div>
    <div class="zone zone-look"></div>`;
  root.prepend(layer);
  const moveZone = layer.querySelector('.zone-move');
  const lookZone = layer.querySelector('.zone-look');
  const stick = layer.querySelector('.stick');
  const nub = layer.querySelector('.nub');
  const move = { x: 0, z: 0 };
  let sensitivity = 1;
  let invertY = false;
  let moveId = null;
  let originX = 0;
  let originY = 0;
  let lookId = null;
  let lookX = 0;
  let lookY = 0;

  function resetStick() {
    moveId = null;
    move.x = 0;
    move.z = 0;
    stick.classList.remove('on');
  }

  moveZone.addEventListener('pointerdown', (e) => {
    if (moveId !== null) return;
    e.preventDefault();
    moveId = e.pointerId;
    originX = e.clientX;
    originY = e.clientY;
    try { moveZone.setPointerCapture(e.pointerId); } catch (err) { /* puntero ya liberado */ }
    stick.style.left = `${originX}px`;
    stick.style.top = `${originY}px`;
    nub.style.transform = 'translate(0px, 0px)';
    stick.classList.add('on');
  });
  moveZone.addEventListener('pointermove', (e) => {
    if (e.pointerId !== moveId) return;
    let dx = e.clientX - originX;
    let dy = e.clientY - originY;
    const d = Math.hypot(dx, dy);
    if (d > STICK_RADIUS) {
      dx = (dx / d) * STICK_RADIUS;
      dy = (dy / d) * STICK_RADIUS;
    }
    nub.style.transform = `translate(${dx}px, ${dy}px)`;
    move.x = dx / STICK_RADIUS;
    move.z = -dy / STICK_RADIUS;
  });
  for (const ev of ['pointerup', 'pointercancel']) {
    moveZone.addEventListener(ev, (e) => { if (e.pointerId === moveId) resetStick(); });
  }

  lookZone.addEventListener('pointerdown', (e) => {
    if (lookId !== null) return;
    e.preventDefault();
    lookId = e.pointerId;
    lookX = e.clientX;
    lookY = e.clientY;
    try { lookZone.setPointerCapture(e.pointerId); } catch (err) { /* puntero ya liberado */ }
  });
  lookZone.addEventListener('pointermove', (e) => {
    if (e.pointerId !== lookId) return;
    const k = LOOK_RATE * sensitivity;
    handlers.onLook(-(e.clientX - lookX) * k, -(e.clientY - lookY) * k * (invertY ? -1 : 1));
    lookX = e.clientX;
    lookY = e.clientY;
  });
  for (const ev of ['pointerup', 'pointercancel']) {
    lookZone.addEventListener(ev, (e) => { if (e.pointerId === lookId) lookId = null; });
  }

  return {
    move,
    // Solo se muestran mientras se camina con control tactil.
    setActive(on) {
      if (layer.hidden === !on) return;
      layer.hidden = !on;
      if (!on) {
        resetStick();
        lookId = null;
      }
    },
    setOptions(o) {
      sensitivity = o.sensitivity;
      invertY = o.invertY;
      layer.dataset.side = o.joystickSide;
    },
  };
}
