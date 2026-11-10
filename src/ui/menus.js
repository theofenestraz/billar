// Menus: inicio, pausa, como se juega, ajustes y fin de partida.

const SCREENS = {
  // Portada: menu a la izquierda, la mesa se ve a la derecha.
  inicio: `
    <p class="kicker">Bola 8 · Primera persona</p>
    <h1 class="title">Billar</h1>
    <nav class="list">
      <button class="item" data-go="unjugador"><span>Un jugador</span><small>Contra la máquina o práctica en solitario</small></button>
      <button class="item" data-go="modo"><span>Multijugador</span><small>Elige cómo jugar con tus amigos</small></button>
      <button class="item" data-go="reglas"><span>Reglas</span><small>Bola 8, versión de bar</small></button>
      <button class="item" data-go="ayuda"><span>Controles</span><small>Cómo moverte y tirar</small></button>
      <button class="item" data-go="ajustes"><span>Ajustes</span><small>Gráficos, sonido y sensibilidad</small></button>
    </nav>
    <p class="status"></p>`,
  unjugador: `
    <p class="kicker">Un jugador</p>
    <h2>¿A qué juegas?</h2>
    <label>Tu nombre <input class="myname" maxlength="14" autocomplete="off"></label>
    <nav class="list">
      <button class="item" data-act="vs-ai"><span>Contra la máquina</span><small>Bola 8 contra un rival de nivel medio</small></button>
      <button class="item" data-act="solo"><span>En solitario</span><small>Diez bolas: mete las nueve y la negra al final, en los menos tiros posibles</small></button>
    </nav>
    <button class="btn ghost" data-act="back">Volver</button>`,
  modo: `
    <p class="kicker">Multijugador</p>
    <h2>¿Cómo queréis jugar?</h2>
    <nav class="list">
      <button class="item" data-go="local"><span>En este dispositivo</span><small>Dos jugadores, por turnos, en la misma pantalla</small></button>
      <button class="item" data-go="online"><span>En línea</span><small>Cada uno desde su dispositivo, con un código de sala</small></button>
    </nav>
    <button class="btn ghost" data-act="back">Volver</button>`,
  local: `
    <p class="kicker">En este dispositivo</p>
    <h2>¿Quién juega?</h2>
    <label>Jugador 1 <input class="name" data-i="0" maxlength="14" autocomplete="off" value="Jugador 1"></label>
    <label>Jugador 2 <input class="name" data-i="1" maxlength="14" autocomplete="off" value="Jugador 2"></label>
    <p class="sub">Saca el jugador 1. Os vais pasando el dispositivo en cada turno.</p>
    <button class="btn primary" data-act="start">Empezar partida</button>
    <button class="btn ghost" data-act="back">Volver</button>`,
  online: `
    <p class="kicker">En línea</p>
    <h2>Jugar a distancia</h2>
    <label>Tu nombre <input class="myname" maxlength="14" autocomplete="off"></label>
    <nav class="list">
      <button class="item" data-act="host"><span>Crear sala</span><small>Te da un código para pasárselo a tu rival</small></button>
      <button class="item" data-go="unirse"><span>Unirse a una sala</span><small>Con el código que te han pasado</small></button>
    </nav>
    <button class="btn ghost" data-act="back">Volver</button>`,
  crear: `
    <p class="kicker">Tu sala</p>
    <h2>Código de la sala</h2>
    <p class="code">····</p>
    <p class="sub">Pásale este código a tu rival. La partida empieza sola cuando entre, y sacas tú.</p>
    <p class="status">Creando la sala…</p>
    <button class="btn ghost" data-act="cancel-online">Cancelar</button>`,
  unirse: `
    <p class="kicker">Unirse</p>
    <h2>Escribe el código</h2>
    <input class="codein" maxlength="4" autocomplete="off" autocapitalize="characters" spellcheck="false" placeholder="ABCD" aria-label="Código de la sala">
    <p class="status"></p>
    <button class="btn primary" data-act="join">Entrar</button>
    <button class="btn ghost" data-act="cancel-online">Volver</button>`,
  reglas: `
    <p class="kicker">Reglas</p>
    <h2>Bola 8</h2>
    <div class="help">
      <h3>Objetivo</h3>
      <p>Hay siete bolas lisas, siete rayadas y la negra. Gana quien emboca todas las de su grupo y después la negra.</p>
      <h3>Saque</h3>
      <p>La blanca se coloca en la zona de saque, detrás de la línea. Si en el saque entra la negra, se repite el saque.</p>
      <h3>Grupos</h3>
      <p>Tras el saque la mesa está abierta. El primero que emboca una bola sin hacer falta se queda con ese grupo, lisas o rayadas, y el rival con el otro.</p>
      <h3>Turno</h3>
      <p>Si embocas una bola de tu grupo sin hacer falta, sigues tirando. Si no, pasa el turno.</p>
      <h3>Faltas</h3>
      <p>Es falta embocar la blanca, no tocar ninguna bola o tocar primero una que no es de tu grupo. Tras una falta, el rival tiene bola en mano y coloca la blanca donde quiera.</p>
      <h3>La negra</h3>
      <p>Solo puedes ir a por ella cuando no te queden bolas. Si la embocas antes de tiempo, o haces falta en el tiro en que entra, pierdes la partida.</p>
      <h3>En solitario</h3>
      <p>Juegas tú solo con diez bolas: nueve de color y la negra. Emboca las nueve en cualquier orden y la negra al final, en los menos tiros posibles. Si entra la blanca, vuelve al punto de salida y sigues. Si entra la negra antes de tiempo, pierdes.</p>
    </div>
    <button class="btn ghost" data-act="back">Volver</button>`,
  pausa: `
    <h2>Pausa</h2>
    <button class="btn primary" data-act="resume">Reanudar</button>
    <button class="btn" data-go="ajustes">Ajustes</button>
    <button class="btn" data-go="ayuda">Controles</button>
    <button class="btn" data-go="reglas">Reglas</button>
    <button class="btn" data-act="restart">Reiniciar partida</button>
    <button class="btn" data-act="quit">Salir al inicio</button>`,
  ayuda: `
    <h2>Controles</h2>
    <div class="help">
      <h3>Moverte</h3>
      <p class="only-desktop">Haz clic para mirar con el ratón. Camina con W A S D o las flechas, y mantén Mayús para ir más rápido.</p>
      <p class="only-touch">Arrastra en un lado de la pantalla para caminar y en el otro para mirar.</p>
      <h3>Tirar</h3>
      <p>Acércate a la mesa y pulsa <b>Tirar</b><span class="only-desktop"> (tecla E)</span>. Arrastra para apuntar y usa el ajuste fino para afinar. Baja la barra de fuerza y suéltala para golpear<span class="only-desktop">, o mantén Espacio</span>. Si la sueltas arriba del todo, no se tira.</p>
      <p>Con <b>Levantarse</b><span class="only-desktop"> (tecla Q)</span> vuelves a caminar sin tirar.</p>
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
        <select data-key="quality"><option value="auto">Automática</option><option value="alta">Alta</option><option value="media">Media</option><option value="baja">Baja</option></select></label>
      <label>Volumen <input type="range" data-key="volume" min="0" max="1" step="0.05"></label>
      <label class="check"><input type="checkbox" data-key="guide"> Línea guía de la blanca</label>
      <label class="check"><input type="checkbox" data-key="guideObject"> Dirección de la bola golpeada</label>
      <label class="check"><input type="checkbox" data-key="spin"> Efectos en la blanca</label>
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
  const trail = []; // pantallas anteriores, para Volver
  let cover = false; // la portada y lo que cuelga de ella
  const names = ['Jugador 1', 'Jugador 2'];
  let myName = 'Jugador';
  try { myName = localStorage.getItem('billar.nombre') || myName; } catch (e) { /* sin almacenamiento */ }
  const ownName = () => myName.trim() || 'Jugador';

  function render(name, data) {
    current = name;
    card.dataset.screen = name;
    card.innerHTML = SCREENS[name];
    card.scrollTop = 0;
    if (name === 'local') {
      card.querySelectorAll('.name').forEach((inp) => {
        inp.value = names[Number(inp.dataset.i)];
        inp.addEventListener('input', () => { names[Number(inp.dataset.i)] = inp.value; });
      });
    } else if (name === 'online' || name === 'unjugador') {
      const inp = card.querySelector('.myname');
      inp.value = myName;
      inp.addEventListener('input', () => {
        myName = inp.value;
        try { localStorage.setItem('billar.nombre', myName); } catch (e) { /* sin almacenamiento */ }
      });
    } else if (name === 'unirse') {
      const inp = card.querySelector('.codein');
      inp.addEventListener('input', () => { inp.value = inp.value.toUpperCase().replace(/[^A-Z]/g, ''); });
      inp.addEventListener('keydown', (e) => { if (e.key === 'Enter') card.querySelector('[data-act="join"]').click(); });
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
      card.querySelector('.winner').textContent = data.title || `Gana ${data.winner}`;
      card.querySelector('.score-line').textContent = data.line !== undefined
        ? data.line
        : `${data.players[0].name} ${data.players[0].wins} · ${data.players[1].wins} ${data.players[1].name}`;
      if (data.again) card.querySelector('[data-act="rematch"]').textContent = data.again;
    }
  }

  card.addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    if (b.dataset.go) {
      trail.push(current);
      render(b.dataset.go);
      return;
    }
    switch (b.dataset.act) {
      case 'start': {
        const clean = names.map((n, i) => n.trim() || `Jugador ${i + 1}`);
        handlers.onStart(clean);
        break;
      }
      case 'vs-ai': handlers.onVsAi(ownName()); break;
      case 'solo': handlers.onSolo(ownName()); break;
      case 'host':
        trail.push(current);
        render('crear');
        handlers.onHost(ownName());
        break;
      case 'join': {
        const code = card.querySelector('.codein').value;
        if (code.length < 4) {
          card.querySelector('.status').textContent = 'El código tiene cuatro letras';
          break;
        }
        b.disabled = true;
        card.querySelector('.status').textContent = 'Conectando…';
        handlers.onJoin(ownName(), code);
        break;
      }
      case 'cancel-online':
        handlers.onOnlineCancel();
        render(trail.pop() || 'inicio');
        break;
      case 'resume': handlers.onResume(); break;
      case 'restart': handlers.onRestart(); break;
      case 'rematch': handlers.onRematch(); break;
      case 'quit': handlers.onQuit(); break;
      case 'back': render(trail.pop() || 'inicio'); break;
      default:
    }
  });

  return {
    get open() { return !wrap.hidden; },
    get screen() { return current; },
    // true mientras se ve la portada o una pantalla abierta desde ella.
    get cover() { return !wrap.hidden && cover; },
    show(name, data) {
      trail.length = 0;
      cover = name === 'inicio';
      wrap.dataset.cover = cover ? '1' : '0';
      render(name, data);
      wrap.hidden = false;
    },
    // Escribe en la linea de estado de la pantalla actual, y el codigo de sala si se da.
    status(text, code) {
      const st = card.querySelector('.status');
      if (st) st.textContent = text;
      const cd = card.querySelector('.code');
      if (cd && code) cd.textContent = code;
      const join = card.querySelector('[data-act="join"]');
      if (join) join.disabled = false;
    },
    hide() {
      wrap.hidden = true;
      current = null;
    },
  };
}
