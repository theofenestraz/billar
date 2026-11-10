// Conexion entre dos dispositivos para jugar en linea.
// Los mensajes pasan por un servidor publico de mensajeria (MQTT sobre WebSocket) que los reenvia
// de un jugador al otro. Asi funciona en cualquier red, tambien con datos moviles.
// Con ?local en la direccion usa BroadcastChannel, que conecta dos pestanas del mismo navegador (pruebas).

const MQTT_URL = 'https://cdn.jsdelivr.net/npm/mqtt@5.10.4/dist/mqtt.min.js';
// Se prueban en orden. Quien se une busca la sala en cada uno.
const BROKERS = ['wss://broker.hivemq.com:8884/mqtt', 'wss://broker.emqx.io:8084/mqtt'];
const TOPIC = 'billar8/sala/';
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ'; // sin I ni O, que se confunden con 1 y 0
const JOIN_WAIT = 4000; // espera de respuesta de la sala en cada servidor
const PING_EVERY = 5000;
// Sin noticias del rival durante este tiempo: desconectado. Es largo a proposito, porque un movil
// con el navegador en segundo plano deja de enviar senales aunque el jugador siga ahi.
const SILENCE_LIMIT = 180000;

function loadMqtt() {
  return new Promise((resolve, reject) => {
    if (window.mqtt) { resolve(); return; }
    const s = document.createElement('script');
    s.src = MQTT_URL;
    s.onload = () => (window.mqtt ? resolve() : reject(new Error('script')));
    s.onerror = () => reject(new Error('script'));
    document.head.appendChild(s);
  });
}

function randomText(n, alphabet) {
  const v = new Uint32Array(n);
  crypto.getRandomValues(v);
  let out = '';
  for (let i = 0; i < n; i++) out += alphabet[v[i] % alphabet.length];
  return out;
}
export const randomCode = () => randomText(4, ALPHABET);
export const cleanCode = (text) => String(text || '').toUpperCase().replace(/[^A-Z]/g, '').slice(0, 4);

// handlers: onReady(code) sala creada y esperando, onConnected(role), onMessage(msg), onClosed(reason).
// reason: 'closed' | 'notfound' | 'network' | 'script'.
export function createOnline(handlers) {
  const local = new URLSearchParams(location.search).has('local');
  let role = null;
  let code = '';
  let sid = ''; // identifica esta partida: lo elige quien se une
  let connected = false;
  let over = false;
  let chan = null;
  let client = null;
  let joinTimer = 0;
  let pingTimer = 0;
  let lastSeen = 0;
  let outN = 0;
  let inN = 0;

  const topicIn = () => `${TOPIC}${code}/${role === 'host' ? 'h' : 'g'}`;
  const topicOut = () => `${TOPIC}${code}/${role === 'host' ? 'g' : 'h'}`;

  function dropTransport() {
    clearTimeout(joinTimer);
    try { if (chan) chan.close(); } catch (e) { /* ya cerrado */ }
    try { if (client) client.end(true); } catch (e) { /* ya cerrado */ }
    chan = null;
    client = null;
  }
  function end(reason) {
    if (over) return;
    over = true;
    clearInterval(pingTimer);
    dropTransport();
    handlers.onClosed(reason);
  }

  // Envia un objeto al otro lado.
  function raw(obj) {
    const text = JSON.stringify(obj);
    try {
      if (chan) chan.postMessage({ topic: topicOut(), text });
      else if (client) client.publish(topicOut(), text, { qos: 1 });
    } catch (e) { /* si la conexion ha caido, el silencio la cerrara */ }
  }

  function up() {
    if (connected || over) return;
    connected = true;
    clearTimeout(joinTimer);
    lastSeen = Date.now();
    pingTimer = setInterval(() => {
      raw({ sys: 'ping', sid });
      if (Date.now() - lastSeen > SILENCE_LIMIT) end('closed');
    }, PING_EVERY);
    handlers.onConnected(role);
  }

  function onRaw(text) {
    let obj;
    try { obj = JSON.parse(text); } catch (e) { return; }
    if (!obj || over) return;
    if (obj.sys === 'join') {
      if (role !== 'host' || typeof obj.sid !== 'string') return;
      if (!connected) {
        sid = obj.sid;
        raw({ sys: 'ok', sid });
        up();
      } else if (obj.sid === sid) raw({ sys: 'ok', sid }); // respuesta perdida: se repite
      return;
    }
    if (obj.sid !== sid) return; // de otra partida, o de un segundo que intenta entrar
    lastSeen = Date.now();
    if (obj.sys === 'ok') {
      if (role === 'guest') up();
    } else if (obj.sys === 'bye') end('closed');
    else if (obj.sys === 'ping') { /* solo cuenta como senal de vida */ }
    else if (connected && typeof obj.i === 'number' && obj.i > inN && obj.m && typeof obj.m.t === 'string') {
      inN = obj.i; // descarta repetidos
      handlers.onMessage(obj.m);
    }
  }

  function ask() {
    raw({ sys: 'join', sid });
  }

  // ----- Pestanas del mismo navegador -----
  function localStart() {
    chan = new BroadcastChannel('billar8-local');
    chan.onmessage = (e) => { if (e.data.topic === topicIn()) onRaw(e.data.text); };
    if (role === 'host') handlers.onReady(code);
    else {
      ask();
      joinTimer = setTimeout(() => end('notfound'), 2500);
    }
  }

  // ----- Servidor de mensajeria -----
  function tryBroker(k) {
    if (over) return;
    if (k >= BROKERS.length) {
      end(role === 'guest' ? 'notfound' : 'network');
      return;
    }
    let opened = false;
    let moved = false;
    const next = () => {
      if (moved || over) return;
      moved = true;
      clearTimeout(joinTimer);
      try { c.end(true); } catch (e) { /* nada */ }
      if (client === c) client = null;
      tryBroker(k + 1);
    };
    const c = window.mqtt.connect(BROKERS[k], {
      clientId: `billar8-${randomText(12, 'abcdefghijklmnopqrstuvwxyz0123456789')}`,
      clean: false, // si la red se corta un momento, el servidor guarda los mensajes pendientes
      keepalive: 20,
      connectTimeout: 8000,
      reconnectPeriod: 2000,
    });
    client = c;
    c.on('message', (topic, payload) => { if (client === c && topic === topicIn()) onRaw(payload.toString()); });
    c.on('connect', () => {
      if (client !== c || over || opened) return;
      opened = true;
      c.subscribe(topicIn(), { qos: 1 }, (err) => {
        if (client !== c || over) return;
        if (err) { next(); return; }
        if (role === 'host') handlers.onReady(code);
        else {
          ask();
          // Si la sala no contesta aqui, puede estar en el siguiente servidor.
          joinTimer = setTimeout(() => { if (!connected) next(); }, JOIN_WAIT);
        }
      });
    });
    // Antes de la primera conexion, un fallo significa que este servidor no sirve.
    const failed = () => { if (!opened && client === c) next(); };
    c.on('error', failed);
    c.on('close', failed);
  }

  async function start(r, c) {
    role = r;
    code = c;
    if (role === 'guest') sid = randomText(10, 'abcdefghijklmnopqrstuvwxyz0123456789');
    if (local) { localStart(); return; }
    try {
      await loadMqtt();
    } catch (e) {
      end('script');
      return;
    }
    tryBroker(0);
  }

  return {
    get connected() { return connected && !over; },
    host() { start('host', randomCode()); },
    join(text) { start('guest', cleanCode(text)); },
    send(msg) {
      if (!connected || over) return;
      raw({ sid, i: ++outN, m: msg });
    },
    // Cierra sin avisar a quien llama.
    close() {
      if (over) return;
      over = true;
      clearInterval(pingTimer);
      if (sid) raw({ sys: 'bye', sid });
      // Deja salir el aviso de cierre antes de cortar.
      const c = client;
      const ch = chan;
      client = null;
      chan = null;
      clearTimeout(joinTimer);
      setTimeout(() => {
        try { if (c) c.end(); } catch (e) { /* nada */ }
        try { if (ch) ch.close(); } catch (e) { /* nada */ }
      }, 400);
    },
  };
}
