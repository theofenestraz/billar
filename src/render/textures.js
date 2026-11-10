// Texturas generadas con canvas. No se cargan imagenes externas.

import * as THREE from 'three';

function canvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

// Generador pseudoaleatorio con semilla, solo para dibujar texturas.
function rng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

function toTexture(c, repeatX = 1, repeatY = 1, color = true) {
  const t = new THREE.CanvasTexture(c);
  if (color) t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(repeatX, repeatY);
  t.anisotropy = 8;
  return t;
}

const BALL_COLORS = {
  1: '#f2c21a', 2: '#1d4fb5', 3: '#d6261e', 4: '#5b2a86',
  5: '#f07a1c', 6: '#1f7a44', 7: '#7a1f1f', 8: '#111111',
};
const IVORY = '#f4efe2';

// Textura equirectangular de una bola: color, franja si es rayada y numero en dos caras.
export function makeBallTexture(id) {
  const w = 512;
  const h = 256;
  const c = canvas(w, h);
  const g = c.getContext('2d');
  if (id === 0) {
    g.fillStyle = IVORY;
    g.fillRect(0, 0, w, h);
    return toTexture(c);
  }
  const color = BALL_COLORS[id > 8 ? id - 8 : id];
  if (id > 8) {
    g.fillStyle = IVORY;
    g.fillRect(0, 0, w, h);
    g.fillStyle = color;
    g.fillRect(0, h * 0.27, w, h * 0.46);
  } else {
    g.fillStyle = color;
    g.fillRect(0, 0, w, h);
  }
  for (const u of [0.25, 0.75]) {
    g.fillStyle = IVORY;
    g.beginPath();
    g.arc(w * u, h / 2, 34, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = '#111';
    g.font = `bold ${id > 9 ? 38 : 44}px Helvetica, Arial, sans-serif`;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText(String(id), w * u, h / 2 + 2);
  }
  return toTexture(c);
}

// Textura de ruido fino sobre un color base. Sirve para moqueta, hormigon y fieltro.
export function makeNoiseTexture({ base, spread = 18, size = 256, seed = 1, repeat = 1, blotches = 0 }) {
  const c = canvas(size, size);
  const g = c.getContext('2d');
  const col = new THREE.Color(base);
  const img = g.createImageData(size, size);
  const rand = rng(seed);
  const r0 = col.r * 255;
  const g0 = col.g * 255;
  const b0 = col.b * 255;
  for (let i = 0; i < size * size; i++) {
    const n = (rand() - 0.5) * spread;
    img.data[i * 4] = r0 + n;
    img.data[i * 4 + 1] = g0 + n;
    img.data[i * 4 + 2] = b0 + n;
    img.data[i * 4 + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  // Manchas suaves, para que las superficies grandes no se vean uniformes.
  for (let i = 0; i < blotches; i++) {
    const x = rand() * size;
    const y = rand() * size;
    const r = 20 + rand() * 60;
    const grad = g.createRadialGradient(x, y, 0, x, y, r);
    const dark = rand() > 0.5;
    grad.addColorStop(0, dark ? 'rgba(0,0,0,0.10)' : 'rgba(255,255,255,0.08)');
    grad.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = grad;
    g.fillRect(x - r, y - r, r * 2, r * 2);
  }
  return toTexture(c, repeat, repeat);
}

// Mapa de relieve de grano fino (escala de grises).
export function makeBumpTexture({ size = 256, seed = 7, repeat = 1, pits = 0 }) {
  const c = canvas(size, size);
  const g = c.getContext('2d');
  const img = g.createImageData(size, size);
  const rand = rng(seed);
  for (let i = 0; i < size * size; i++) {
    const n = 110 + rand() * 60;
    img.data[i * 4] = img.data[i * 4 + 1] = img.data[i * 4 + 2] = n;
    img.data[i * 4 + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  g.fillStyle = 'rgba(0,0,0,0.55)';
  for (let i = 0; i < pits; i++) {
    g.beginPath();
    g.arc(rand() * size, rand() * size, 0.6 + rand() * 1.8, 0, Math.PI * 2);
    g.fill();
  }
  return toTexture(c, repeat, repeat, false);
}

// Diana electronica aproximada.
export function makeDartboardTexture() {
  const s = 512;
  const c = canvas(s, s);
  const g = c.getContext('2d');
  g.clearRect(0, 0, s, s);
  const cx = s / 2;
  g.fillStyle = '#16161a';
  g.beginPath();
  g.arc(cx, cx, 250, 0, Math.PI * 2);
  g.fill();
  const ring = (r1, r2, a, b) => {
    for (let i = 0; i < 20; i++) {
      g.fillStyle = i % 2 ? a : b;
      g.beginPath();
      const a0 = ((i - 0.5) * Math.PI) / 10 - Math.PI / 2;
      g.arc(cx, cx, r2, a0, a0 + Math.PI / 10);
      g.arc(cx, cx, r1, a0 + Math.PI / 10, a0, true);
      g.closePath();
      g.fill();
    }
  };
  ring(20, 195, '#d9cfb4', '#222226');
  ring(180, 195, '#a82a22', '#1f6e3c');
  ring(105, 118, '#a82a22', '#1f6e3c');
  g.fillStyle = '#1f6e3c';
  g.beginPath();
  g.arc(cx, cx, 20, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = '#a82a22';
  g.beginPath();
  g.arc(cx, cx, 9, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = '#cfcfcf';
  g.font = 'bold 26px Helvetica, Arial, sans-serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  const nums = [20, 1, 18, 4, 13, 6, 10, 15, 2, 17, 3, 19, 7, 16, 8, 11, 14, 9, 12, 5];
  nums.forEach((n, i) => {
    const a = (i * Math.PI) / 10 - Math.PI / 2;
    g.fillText(String(n), cx + Math.cos(a) * 222, cx + Math.sin(a) * 222);
  });
  return toTexture(c);
}

// Cartel con lineas que simulan texto. No reproduce el texto real.
export function makePosterTexture({ w = 512, h = 320, bg = '#b9e06a', ink = 'rgba(40,70,20,0.55)', seed = 3, title = '' }) {
  const c = canvas(w, h);
  const g = c.getContext('2d');
  g.fillStyle = bg;
  g.fillRect(0, 0, w, h);
  const rand = rng(seed);
  g.fillStyle = ink;
  if (title) {
    g.font = `bold ${Math.round(h * 0.13)}px Helvetica, Arial, sans-serif`;
    g.textBaseline = 'top';
    g.fillText(title, w * 0.06, h * 0.06);
  }
  for (let y = h * (title ? 0.28 : 0.1); y < h * 0.92; y += h * 0.055) {
    let x = w * 0.06;
    while (x < w * 0.9) {
      const len = 12 + rand() * 60;
      if (rand() > 0.15) g.fillRect(x, y, Math.min(len, w * 0.94 - x), h * 0.018);
      x += len + 8;
    }
  }
  return toTexture(c);
}

// Letrero de texto corto (SALIDA, senales).
export function makeSignTexture({ text, w = 256, h = 96, bg = '#1c7a43', fg = '#ffffff' }) {
  const c = canvas(w, h);
  const g = c.getContext('2d');
  g.fillStyle = bg;
  g.fillRect(0, 0, w, h);
  g.fillStyle = fg;
  g.font = `bold ${Math.round(h * 0.56)}px Helvetica, Arial, sans-serif`;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText(text, w / 2, h / 2 + 2);
  return toTexture(c);
}

// ---------- Texturas de la segunda tanda de referencia ----------

// Campo del futbolin: verde palido con lineas blancas.
export function makeFoosballFieldTexture() {
  const w = 512;
  const h = 272;
  const c = canvas(w, h);
  const g = c.getContext('2d');
  g.fillStyle = '#8fbf9c';
  g.fillRect(0, 0, w, h);
  // Franjas de cesped, muy suaves.
  for (let i = 0; i < 8; i++) {
    g.fillStyle = i % 2 ? 'rgba(255,255,255,0.05)' : 'rgba(0,40,20,0.05)';
    g.fillRect((i * w) / 8, 0, w / 8, h);
  }
  g.strokeStyle = 'rgba(255,255,255,0.9)';
  g.lineWidth = 4;
  g.strokeRect(10, 10, w - 20, h - 20);
  g.beginPath();
  g.moveTo(w / 2, 10);
  g.lineTo(w / 2, h - 10);
  g.stroke();
  g.beginPath();
  g.arc(w / 2, h / 2, 38, 0, Math.PI * 2);
  g.stroke();
  for (const sx of [0, 1]) {
    const x = sx ? w - 10 - 70 : 10;
    g.strokeRect(x, h / 2 - 70, 70, 140);
    g.strokeRect(sx ? w - 10 - 28 : 10, h / 2 - 36, 28, 72);
  }
  const t = toTexture(c);
  t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
  return t;
}

// Frontal de la maquina de aperitivos: cristal con baldas de productos y botonera a la derecha.
export function makeSnackMachineTexture() {
  const w = 384;
  const h = 736;
  const c = canvas(w, h);
  const g = c.getContext('2d');
  const r = rng(77);
  g.fillStyle = '#0c0c0e';
  g.fillRect(0, 0, w, h);
  // Cristal.
  const gx = 18, gy = 24, gw = 268, gh = 500;
  g.fillStyle = '#1a2026';
  g.fillRect(gx, gy, gw, gh);
  const colors = ['#e8413a', '#f2c21a', '#3aa0e8', '#59c26a', '#f08a1c', '#e85aa8', '#f4f1e8', '#7a4ad0', '#35c8c0'];
  const rows = 6;
  for (let row = 0; row < rows; row++) {
    const y0 = gy + 10 + (row * (gh - 16)) / rows;
    const rh = (gh - 16) / rows - 16;
    const n = row < 4 ? 7 : 9;
    for (let i = 0; i < n; i++) {
      const cw = (gw - 16) / n;
      g.fillStyle = colors[Math.floor(r() * colors.length)];
      const ph = rh * (0.72 + r() * 0.28);
      g.fillRect(gx + 8 + i * cw + 2, y0 + rh - ph, cw - 5, ph);
      g.fillStyle = 'rgba(255,255,255,0.35)';
      g.fillRect(gx + 8 + i * cw + 4, y0 + rh - ph + 4, cw - 9, Math.max(3, ph * 0.18));
    }
    // Balda iluminada con sus etiquetas de precio.
    g.fillStyle = '#dfe9f2';
    g.fillRect(gx, y0 + rh + 2, gw, 7);
    g.fillStyle = '#20242a';
    for (let i = 0; i < n; i++) g.fillRect(gx + 12 + (i * (gw - 16)) / n, y0 + rh + 4, 10, 3);
  }
  // Reflejo del cristal.
  const sh = g.createLinearGradient(gx, gy, gx + gw, gy + gh);
  sh.addColorStop(0, 'rgba(255,255,255,0.10)');
  sh.addColorStop(0.4, 'rgba(255,255,255,0)');
  g.fillStyle = sh;
  g.fillRect(gx, gy, gw, gh);
  // Botonera.
  g.fillStyle = '#17181b';
  g.fillRect(298, 24, 70, 500);
  g.fillStyle = '#39d0e6';
  g.fillRect(308, 60, 50, 34);
  g.fillStyle = '#d6d8da';
  for (let i = 0; i < 12; i++) g.fillRect(310 + (i % 3) * 17, 120 + Math.floor(i / 3) * 17, 12, 12);
  g.fillStyle = '#2a2c30';
  g.fillRect(312, 220, 42, 60);
  g.fillStyle = '#f0b429';
  g.fillRect(316, 300, 34, 10);
  // Franja rosa inferior y cajon de recogida.
  g.fillStyle = '#ff5a9a';
  g.fillRect(40, 548, 220, 16);
  g.fillStyle = '#050506';
  g.fillRect(28, 590, 250, 96);
  g.strokeStyle = '#2c2e33';
  g.lineWidth = 3;
  g.strokeRect(28, 590, 250, 96);
  const t = toTexture(c);
  t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
  return t;
}

// Frontal de la maquina de cafe: paneles claros y pantalla azul.
export function makeCoffeeMachineTexture() {
  const w = 256;
  const h = 736;
  const c = canvas(w, h);
  const g = c.getContext('2d');
  g.fillStyle = '#0b0b0d';
  g.fillRect(0, 0, w, h);
  g.fillStyle = '#c9cacb';
  g.fillRect(30, 26, 150, 150);
  g.fillStyle = '#17181b';
  g.fillRect(196, 26, 36, 420);
  g.fillStyle = '#8a8d91';
  for (let i = 0; i < 9; i++) g.fillRect(204, 44 + i * 40, 20, 20);
  g.fillStyle = '#101114';
  g.fillRect(30, 196, 150, 250);
  g.fillStyle = '#2fd6f0';
  g.fillRect(58, 216, 94, 110);
  g.fillStyle = '#0d5f7a';
  g.fillRect(68, 290, 74, 26);
  g.fillStyle = '#e9f9ff';
  g.fillRect(76, 232, 58, 8);
  g.fillRect(76, 248, 40, 6);
  g.fillStyle = '#050506';
  g.fillRect(60, 346, 90, 84);
  g.fillStyle = '#c9cacb';
  g.fillRect(40, 474, 150, 190);
  g.strokeStyle = '#2c2e33';
  g.lineWidth = 3;
  g.strokeRect(8, 8, w - 16, h - 16);
  const t = toTexture(c);
  t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
  return t;
}

// Sala de neones tras el cristal del pasillo: expositores con barras de colores.
export function makeNeonRackTexture() {
  const w = 1024;
  const h = 384;
  const c = canvas(w, h);
  const g = c.getContext('2d');
  g.fillStyle = '#5f5a61';
  g.fillRect(0, 0, w, h);
  const palettes = [
    ['#ff9a2e', '#ff5a8a', '#ffd23c'],
    ['#39f08a', '#39f08a', '#39f08a'],
    ['#eaf6ff', '#55d8ff', '#eaf6ff'],
    ['#ff4fd0', '#ffd23c', '#ff4fd0'],
    ['#ffd23c', '#eaf6ff', '#ffd23c'],
    ['#eaf6ff', '#eaf6ff', '#55d8ff'],
  ];
  const pw = w / palettes.length;
  palettes.forEach((pal, p) => {
    const x0 = p * pw;
    g.fillStyle = '#2a2b30';
    g.fillRect(x0 + 6, 20, 10, h - 20);
    g.fillStyle = '#857f86';
    g.fillRect(x0 + 22, 40, pw - 34, h - 60);
    if (p === 1) {
      // Rotulo verde en forma de llave.
      g.strokeStyle = '#39f08a';
      g.shadowColor = '#39f08a';
      g.shadowBlur = 18;
      g.lineWidth = 9;
      g.beginPath();
      const cx = x0 + pw / 2;
      g.moveTo(cx + 22, 110);
      g.lineTo(cx - 6, 110);
      g.lineTo(cx - 6, 180);
      g.lineTo(cx - 24, 196);
      g.lineTo(cx - 6, 212);
      g.lineTo(cx - 6, 282);
      g.lineTo(cx + 22, 282);
      g.stroke();
      g.shadowBlur = 0;
      return;
    }
    for (let row = 0; row < 5; row++) {
      for (let col = 0; col < 4; col++) {
        const cx = x0 + 44 + col * ((pw - 70) / 3);
        const cy = 84 + row * 58;
        const color = pal[(row + col) % pal.length];
        g.save();
        g.translate(cx, cy);
        g.rotate(row % 2 ? 0.5 : -0.5);
        g.shadowColor = color;
        g.shadowBlur = 14;
        g.fillStyle = color;
        g.fillRect(-17, -6, 34, 12);
        g.restore();
      }
    }
  });
  const t = toTexture(c);
  t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
  return t;
}

// Pared con el bano de luz de un foco, para zonas lejanas sin luces reales.
export function makeWashTexture({ base = '#3f4246', light = '#8b8d8c', cx = 0.5, spread = 0.5 } = {}) {
  const s = 256;
  const c = canvas(s, s);
  const g = c.getContext('2d');
  g.fillStyle = base;
  g.fillRect(0, 0, s, s);
  g.save();
  g.translate(cx * s, 0.08 * s);
  g.scale(spread, 1);
  const grad = g.createRadialGradient(0, 0, 0, 0, 0, s * 0.95);
  grad.addColorStop(0, light);
  grad.addColorStop(0.35, light);
  grad.addColorStop(1, 'rgba(0,0,0,0)');
  g.globalAlpha = 0.9;
  g.fillStyle = grad;
  g.fillRect(-s * 2, 0, s * 4, s);
  g.restore();
  // Rodapie negro.
  g.fillStyle = '#0c0c0d';
  g.fillRect(0, s - 8, s, 8);
  const t = toTexture(c);
  t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
  return t;
}

// Panel negro con circulos blancos y naranjas.
export function makeCirclesPanelTexture() {
  const w = 512;
  const h = 720;
  const c = canvas(w, h);
  const g = c.getContext('2d');
  g.fillStyle = '#111214';
  g.fillRect(0, 0, w, h);
  const dot = (x, y, r, color) => {
    g.fillStyle = color;
    g.beginPath();
    g.arc(x, y, r, 0, Math.PI * 2);
    g.fill();
  };
  dot(300, 250, 170, '#cfcfca');
  dot(250, 560, 96, '#d9692c');
  dot(-10, 150, 90, '#d9692c');
  dot(120, 70, 34, '#cfcfca');
  dot(440, 50, 30, '#cfcfca');
  dot(70, 330, 36, '#cfcfca');
  dot(430, 470, 30, '#cfcfca');
  dot(440, 650, 30, '#cfcfca');
  dot(40, 470, 60, '#cfcfca');
  const t = toTexture(c);
  t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
  return t;
}

// Arrugas y brillos de un plastico transparente.
export function makePlasticTexture() {
  const w = 256;
  const h = 384;
  const c = canvas(w, h);
  const g = c.getContext('2d');
  const r = rng(41);
  g.clearRect(0, 0, w, h);
  for (let i = 0; i < 46; i++) {
    const x = r() * w;
    const lean = (r() - 0.5) * 60;
    g.strokeStyle = `rgba(255,255,255,${0.05 + r() * 0.2})`;
    g.lineWidth = 1 + r() * 5;
    g.beginPath();
    g.moveTo(x, r() * h * 0.3);
    g.bezierCurveTo(x + lean, h * 0.4, x - lean, h * 0.7, x + lean * 0.5, h * (0.7 + r() * 0.3));
    g.stroke();
  }
  const t = toTexture(c);
  t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
  return t;
}

// Senal de seguridad: fondo de color con pictograma y lineas de texto.
export function makeSafetySignTexture({ bg = '#c9302c', tall = true } = {}) {
  const w = 128;
  const h = tall ? 320 : 160;
  const c = canvas(w, h);
  const g = c.getContext('2d');
  g.fillStyle = '#efeeea';
  g.fillRect(0, 0, w, h);
  g.fillStyle = bg;
  g.fillRect(6, 6, w - 12, h - 12);
  g.fillStyle = '#f5f3ee';
  g.fillRect(24, 22, w - 48, w - 48);
  g.fillStyle = bg;
  g.fillRect(48, 40, 32, 44);
  g.fillStyle = '#f5f3ee';
  for (let y = w + 4; y < h - 24; y += 22) g.fillRect(20, y, w - 40 - ((y / 22) % 2) * 20, 8);
  const t = toTexture(c);
  t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
  return t;
}

// Fieltro de la mesa: color con trama de fibras y su mapa de relieve. Una repeticion cubre 0,5 m.
export function makeFeltTextures() {
  const size = 512;
  const rand = rng(1907);
  const c = canvas(size, size);
  const g = c.getContext('2d');
  const b = canvas(size, size);
  const gb = b.getContext('2d');
  g.fillStyle = '#189a7c';
  g.fillRect(0, 0, size, size);
  gb.fillStyle = '#808080';
  gb.fillRect(0, 0, size, size);
  // Grano de base.
  const img = g.getImageData(0, 0, size, size);
  const bim = gb.getImageData(0, 0, size, size);
  for (let i = 0; i < size * size; i++) {
    const n = (rand() - 0.5) * 20;
    img.data[i * 4] += n * 0.7;
    img.data[i * 4 + 1] += n;
    img.data[i * 4 + 2] += n * 0.8;
    const h = 128 + (rand() - 0.5) * 70;
    bim.data[i * 4] = bim.data[i * 4 + 1] = bim.data[i * 4 + 2] = h;
  }
  g.putImageData(img, 0, 0);
  gb.putImageData(bim, 0, 0);
  // Fibras cortas, peinadas mas o menos a lo largo de la mesa.
  g.lineCap = 'round';
  gb.lineCap = 'round';
  for (let i = 0; i < 9000; i++) {
    const x = rand() * size;
    const y = rand() * size;
    const a = Math.PI / 2 + (rand() - 0.5) * 1.1;
    const len = 2 + rand() * 5;
    const dx = Math.cos(a) * len;
    const dy = Math.sin(a) * len;
    const light = rand() > 0.5;
    const alpha = 0.05 + rand() * 0.09;
    g.strokeStyle = light ? `rgba(190,255,225,${alpha})` : `rgba(0,45,30,${alpha})`;
    g.lineWidth = 0.6 + rand() * 0.7;
    gb.strokeStyle = light ? `rgba(255,255,255,${alpha * 2.2})` : `rgba(0,0,0,${alpha * 2.2})`;
    gb.lineWidth = g.lineWidth;
    // Se dibuja tambien desplazada para que la textura repita sin costuras.
    for (const ox of [0, -size, size]) for (const oy of [0, -size, size]) {
      if (x + ox < -8 || x + ox > size + 8 || y + oy < -8 || y + oy > size + 8) continue;
      g.beginPath();
      g.moveTo(x + ox, y + oy);
      g.lineTo(x + ox + dx, y + oy + dy);
      g.stroke();
      gb.beginPath();
      gb.moveTo(x + ox, y + oy);
      gb.lineTo(x + ox + dx, y + oy + dy);
      gb.stroke();
    }
  }
  return { map: toTexture(c, 2, 2), bump: toTexture(b, 2, 2, false) };
}

// Forro de goma de las troneras: gris muy oscuro con costuras verticales, mas negro hacia el fondo.
export function makePocketLinerTexture() {
  const w = 256;
  const h = 128;
  const c = canvas(w, h);
  const g = c.getContext('2d');
  const r = rng(515);
  const grad = g.createLinearGradient(0, 0, 0, h);
  grad.addColorStop(0, '#3a3a3e');
  grad.addColorStop(0.35, '#202023');
  grad.addColorStop(1, '#050506');
  g.fillStyle = grad;
  g.fillRect(0, 0, w, h);
  // Grano de la goma.
  const img = g.getImageData(0, 0, w, h);
  for (let i = 0; i < w * h; i++) {
    const n = (r() - 0.5) * 14;
    img.data[i * 4] += n;
    img.data[i * 4 + 1] += n;
    img.data[i * 4 + 2] += n;
  }
  g.putImageData(img, 0, 0);
  // Costuras.
  for (let k = 0; k < 6; k++) {
    const x = (k + 0.5) * (w / 6);
    g.fillStyle = 'rgba(0,0,0,0.55)';
    g.fillRect(x - 1, 0, 2, h);
    g.fillStyle = 'rgba(255,255,255,0.08)';
    for (let y = 2; y < h; y += 7) g.fillRect(x + 2, y, 2, 3);
  }
  // Brillo del borde superior.
  g.fillStyle = 'rgba(255,255,255,0.10)';
  g.fillRect(0, 0, w, 3);
  const t = toTexture(c);
  t.wrapS = THREE.RepeatWrapping;
  t.wrapT = THREE.ClampToEdgeWrapping;
  return t;
}
