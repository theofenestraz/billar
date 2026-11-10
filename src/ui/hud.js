// Interfaz durante la partida: marcador, avisos, boton de tirar y controles de apuntar.

const GROUP_LABEL = { solids: 'Lisas', stripes: 'Rayadas' };

function el(tag, cls, html) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (html !== undefined) e.innerHTML = html;
  return e;
}

export function createHud(root, handlers) {
  const hud = el('div', 'hud');
  hud.innerHTML = `
    <div class="score">
      <div class="chip" data-p="0"><span class="name"></span><span class="left"></span></div>
      <div class="chip" data-p="1"><span class="name"></span><span class="left"></span></div>
    </div>
    <button class="btn icon pause" aria-label="Pausa">II</button>
    <div class="toast" role="status"></div>
    <div class="crosshair"></div>
    <div class="hint"></div>
    <div class="prompt"><button class="btn primary act"></button></div>
    <div class="aim">
      <div class="aim-left">
        <button class="btn stand">Levantarse</button>
        <button class="btn replace">Mover blanca</button>
      </div>
      <div class="fine">
        <button class="btn icon" data-dir="1" aria-label="Ajuste fino a la izquierda">&#9664;</button>
        <span>Ajuste fino</span>
        <button class="btn icon" data-dir="-1" aria-label="Ajuste fino a la derecha">&#9654;</button>
      </div>
      <div class="spin" title="Efecto">
        <div class="spin-ball"><div class="spin-dot"></div></div>
        <span class="spin-label">Efecto</span>
      </div>
      <div class="power">
        <div class="track"><div class="fill"></div><div class="knob"></div></div>
        <span class="power-label">Fuerza</span>
      </div>
    </div>
    <div class="place">
      <span class="place-text"></span>
      <button class="btn primary confirm">Confirmar</button>
    </div>`;
  root.appendChild(hud);
  const q = (s) => hud.querySelector(s);
  const chips = [...hud.querySelectorAll('.chip')];
  const toast = q('.toast');
  const act = q('.act');
  const track = q('.track');
  const fill = q('.fill');
  const knob = q('.knob');
  let toastTimer = 0;
  let lastKey = '';

  const click = (sel, fn) => q(sel).addEventListener('click', (e) => { e.currentTarget.blur(); fn(); });
  click('.act', () => handlers.onAct());
  click('.stand', () => handlers.onStand());
  click('.replace', () => handlers.onReplace());
  click('.confirm', () => handlers.onConfirm());
  click('.pause', () => handlers.onPause());

  // Ajuste fino: un toque mueve un paso, mantener repite.
  for (const b of hud.querySelectorAll('.fine .btn')) {
    let timer = 0;
    const dir = Number(b.dataset.dir);
    const stop = () => { clearInterval(timer); timer = 0; };
    b.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      handlers.onFine(dir);
      stop();
      timer = setInterval(() => handlers.onFine(dir), 60);
    });
    for (const ev of ['pointerup', 'pointercancel', 'pointerleave']) b.addEventListener(ev, stop);
  }

  // Efecto: se arrastra el punto sobre la bola. Doble toque lo devuelve al centro.
  const spinBall = q('.spin-ball');
  const spinDot = q('.spin-dot');
  let spinId = null;
  let spinTap = 0;
  let shown = { side: 0, top: 0 };
  let noDraw = false; // el taco va inclinado: la mitad de abajo no cuenta
  const showSpin = (side, top) => {
    shown = { side, top };
    const t = noDraw && top < 0 ? 0 : top;
    spinDot.style.left = `${50 + side * 36}%`;
    spinDot.style.top = `${50 - t * 36}%`;
  };
  const spinAt = (e) => {
    const r = spinBall.getBoundingClientRect();
    let side = ((e.clientX - r.left) / r.width - 0.5) / 0.36;
    let top = -((e.clientY - r.top) / r.height - 0.5) / 0.36;
    const m = Math.hypot(side, top);
    if (m > 1) { side /= m; top /= m; }
    if (m < 0.14) { side = 0; top = 0; } // cerca del centro se queda en el centro
    showSpin(side, top);
    handlers.onSpin(side, top);
  };
  spinBall.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    const now = performance.now();
    if (now - spinTap < 320) {
      showSpin(0, 0);
      handlers.onSpin(0, 0);
      spinTap = 0;
      return;
    }
    spinTap = now;
    spinId = e.pointerId;
    try { spinBall.setPointerCapture(e.pointerId); } catch (err) { /* puntero sintetico */ }
    spinAt(e);
  });
  spinBall.addEventListener('pointermove', (e) => { if (e.pointerId === spinId) spinAt(e); });
  for (const ev of ['pointerup', 'pointercancel']) spinBall.addEventListener(ev, (e) => { if (e.pointerId === spinId) spinId = null; });

  // Barra de fuerza: pulsar, arrastrar hacia abajo y soltar para golpear.
  let powerId = null;
  const powerAt = (e) => {
    const r = track.getBoundingClientRect();
    return Math.max(0, Math.min(1, (e.clientY - r.top - 14) / (r.height - 28)));
  };
  track.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    powerId = e.pointerId;
    track.setPointerCapture(e.pointerId);
    handlers.onPower(powerAt(e));
  });
  track.addEventListener('pointermove', (e) => {
    if (e.pointerId === powerId) handlers.onPower(powerAt(e));
  });
  const endPower = (e, cancel) => {
    if (e.pointerId !== powerId) return;
    powerId = null;
    if (cancel) handlers.onPowerCancel();
    else handlers.onPowerRelease();
  };
  track.addEventListener('pointerup', (e) => endPower(e, false));
  track.addEventListener('pointercancel', (e) => endPower(e, true));

  return {
    root: hud,
    setVisible(v) { hud.hidden = !v; },

    // Aviso temporal en el centro superior.
    toast(text, ms = 2600) {
      toast.textContent = text;
      toast.classList.add('show');
      clearTimeout(toastTimer);
      toastTimer = setTimeout(() => toast.classList.remove('show'), ms);
    },

    setSpin: showSpin,

    setPower(p) {
      fill.style.height = `${p * 100}%`;
      knob.style.top = `calc(14px + ${p} * (100% - 28px))`;
      track.classList.toggle('charging', p > 0);
    },

    // vm describe lo que hay que mostrar. Solo se toca el DOM si algo cambia.
    update(vm) {
      const key = JSON.stringify(vm);
      if (key === lastKey) return;
      lastKey = key;
      hud.dataset.mode = vm.mode;
      hud.dataset.touch = vm.touch ? '1' : '0';
      vm.players.forEach((p, i) => {
        const c = chips[i];
        c.classList.toggle('active', vm.turn === i && !vm.over);
        c.querySelector('.name').textContent = p.name;
        let text = 'Mesa abierta';
        if (p.group) text = p.left > 0 ? `${GROUP_LABEL[p.group]} · ${p.left}` : 'A por la negra';
        if (p.text !== undefined) text = p.text; // texto propio del modo de juego
        c.querySelector('.left').textContent = text;
        c.dataset.group = p.group || '';
      });
      act.innerHTML = vm.touch ? vm.actLabel : `${vm.actLabel} <kbd>E</kbd>`;
      q('.prompt').classList.toggle('show', vm.mode === 'walk' && vm.canAct);
      q('.aim').classList.toggle('show', vm.mode === 'aim' && vm.state === 'aiming');
      q('.replace').hidden = !vm.canPlace;
      q('.spin').hidden = !vm.spin;
      if (noDraw !== !!vm.noDraw) {
        noDraw = !!vm.noDraw;
        spinBall.classList.toggle('nodraw', noDraw);
        q('.spin-label').textContent = noDraw ? 'Sin efecto atrás' : 'Efecto';
        showSpin(shown.side, shown.top);
      }
      q('.place').classList.toggle('show', vm.mode === 'aim' && vm.state === 'placing');
      q('.place-text').textContent = vm.kitchen ? 'Arrastra la blanca dentro de la zona de saque' : 'Arrastra la blanca a donde quieras';
      q('.crosshair').classList.toggle('show', vm.mode === 'walk');
      const hint = q('.hint');
      hint.textContent = vm.hint || '';
      hint.classList.toggle('show', !!vm.hint);
    },
  };
}
