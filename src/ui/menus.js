// Menus: inicio, pausa, como se juega, ajustes y fin de partida.

const SCREENS = {
  inicio: `
    <h1>Billar</h1>
    <p class="sub">Bola 8 para dos jugadores, por turnos en este dispositivo.</p>
    <label>Jugador 1 <input class="name" data-i="0" maxlength="14" autocomplete="off" value="Jugador 1"></label>
    <label>Jugador 2 <input class="name" data-i="1" maxlength="14" autocomplete="off" value="Jugador 2"></label>
    <button class="btn primary" data-act="start">Jugar</button>
    <div class="row">
      <button class="btn" data-go="ayuda">Cómo se juega</button>
      <button class="btn" data-go="ajustes">Ajustes</button>
    </div>`,
  pausa: `
    <h2>Pausa</h2>
    <button class="btn primary" data-act="resume">Reanudar</button>
    <button class="btn" data-go="ajustes">Ajustes</button>
    <button class="btn" data-go="ayuda">Cómo se juega</button>
    <button class="btn" data-act="restart">Reiniciar partida</button>
    <button class="btn" data-act="quit">Salir al inicio</button>`,
  ayuda: `
    <h2>Cómo se juega</h2>
    <div class="help">
      <h3>Moverte</h3>
      <p class="only-desktop">Haz clic para mirar con el ratón. Camina con W A S D o las flechas, y mantén Mayús para ir más rápido.</p>
      <p class="only-touch">Arrastra en un lado de la pantalla para caminar y en el otro para mirar.</p>
      <h3>Tirar</h3>
      <p>Acércate a la mesa y pulsa <b>Tirar</b><span class="only-desktop"> (tecla E)</span>. Arrastra para apuntar y usa el ajuste fino para afinar. Baja la barra de fuerza y suéltala para golpear<span class="only-desktop">, o mantén Espacio</span>. Si la sueltas arriba del todo, no se tira.</p>
      <p>Con <b>Levantarse</b><span class="only-desktop"> (tecla Q)</span> vuelves a caminar sin tirar.</p>
      <h3>Reglas</h3>
      <p>El primero que emboca una bola después del saque se queda con su grupo, lisas o rayadas. Si embocas una de las tuyas, sigues tirando.</p>
      <p>Es falta embocar la blanca, no tocar ninguna bola o tocar primero una que no es tuya. Tras una falta, el rival coloca la blanca donde quiera.</p>
      <p>Cuando no te queden bolas, emboca la negra para ganar. Si la embocas antes de tiempo o junto con la blanca, pierdes.</p>
    </div>
    <button class="btn primary" data-act="back">Volver</button>`,
  ajustes: `
    <h2>Ajustes</h2>
    <div class="form">
      <label>Controles
        <select data-key="controls"><option value="auto">Automático</option><option value="touch">Táctil</option><option value="desktop">Teclado y ratón</option></select></label>
      <label>Sensibilidad <input type="range" data-key="sensitivity" min="0.3" max="2.5" step="0.1"></label>
      <label class="check"><input type="checkbox" data-key="invertY"> Invertir eje vertical</label>
      <label>Joystick
        <select data-key="joystickSide"><option value="left">A la izquierda</option><option value="right">A la derecha</option></select></label>
      <label>Calidad gráfica
        <select data-key="quality"><option value="alta">Alta</option><option value="baja">Baja</option></select></label>
      <label>Volumen <input type="range" data-key="volume" min="0" max="1" step="0.05"></label>
      <label class="check"><input type="checkbox" data-key="guide"> Línea guía al apuntar</label>
    </div>
    <button class="btn primary" data-act="back">Volver</button>`,
  fin: `
    <h2 class="winner"></h2>
    <p class="score-line"></p>
    <button class="btn primary" data-act="rematch">Revancha</button>
    <button class="btn" data-act="quit">Salir al inicio</button>`,
};

export function createMenus(root, settings, handlers) {
  const wrap = document.createElement('div');
  wrap.className = 'menu';
  wrap.hidden = true;
  wrap.innerHTML = '<div class="card"></div>';
  root.appendChild(wrap);
  const card = wrap.querySelector('.card');
  let current = null;
  let previous = null;
  const names = ['Jugador 1', 'Jugador 2'];

  function render(name, data) {
    current = name;
    card.dataset.screen = name;
    card.innerHTML = SCREENS[name];
    card.scrollTop = 0;
    if (name === 'inicio') {
      card.querySelectorAll('.name').forEach((inp) => {
        inp.value = names[Number(inp.dataset.i)];
        inp.addEventListener('input', () => { names[Number(inp.dataset.i)] = inp.value; });
      });
    } else if (name === 'ajustes') {
      card.querySelectorAll('[data-key]').forEach((inp) => {
        const key = inp.dataset.key;
        if (inp.type === 'checkbox') inp.checked = settings[key];
        else inp.value = String(settings[key]);
        inp.addEventListener('input', () => {
          if (inp.type === 'checkbox') settings[key] = inp.checked;
          else if (inp.type === 'range') settings[key] = Number(inp.value);
          else settings[key] = inp.value;
          handlers.onSettings(settings);
        });
      });
    } else if (name === 'fin' && data) {
      card.querySelector('.winner').textContent = `Gana ${data.winner}`;
      card.querySelector('.score-line').textContent = `${data.players[0].name} ${data.players[0].wins} · ${data.players[1].wins} ${data.players[1].name}`;
    }
  }

  card.addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    if (b.dataset.go) {
      previous = current;
      render(b.dataset.go);
      return;
    }
    switch (b.dataset.act) {
      case 'start': {
        const clean = names.map((n, i) => n.trim() || `Jugador ${i + 1}`);
        handlers.onStart(clean);
        break;
      }
      case 'resume': handlers.onResume(); break;
      case 'restart': handlers.onRestart(); break;
      case 'rematch': handlers.onRematch(); break;
      case 'quit': handlers.onQuit(); break;
      case 'back': render(previous || 'inicio'); break;
      default:
    }
  });

  return {
    get open() { return !wrap.hidden; },
    get screen() { return current; },
    show(name, data) {
      previous = null;
      render(name, data);
      wrap.hidden = false;
    },
    hide() {
      wrap.hidden = true;
      current = null;
    },
  };
}
