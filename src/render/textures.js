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
