// Ajustes del jugador, guardados en el dispositivo.

const KEY = 'billar.settings.v2'; // v2: la calidad por defecto pasa a ser automatica

export const DEFAULTS = {
  controls: 'auto', // 'auto' | 'touch' | 'desktop'
  sensitivity: 1,
  invertY: false,
  joystickSide: 'left', // 'left' | 'right'
  quality: 'auto', // 'auto' | 'alta' | 'media' | 'baja'
  volume: 0.8,
  guide: true, // linea de la blanca al apuntar
  guideObject: true, // direccion que tomara la bola golpeada
  spin: true, // selector de efecto en la blanca
  blackPocket: true, // la negra a la tronera contraria de la ultima bola del grupo
  showFps: false,
};

const oneOf = (v, list, d) => (list.includes(v) ? v : d);
const num = (v, min, max, d) => (typeof v === 'number' && Number.isFinite(v) ? Math.max(min, Math.min(max, v)) : d);
const bool = (v, d) => (typeof v === 'boolean' ? v : d);

function clean(raw) {
  const r = raw && typeof raw === 'object' ? raw : {};
  return {
    controls: oneOf(r.controls, ['auto', 'touch', 'desktop'], DEFAULTS.controls),
    sensitivity: num(r.sensitivity, 0.3, 2.5, DEFAULTS.sensitivity),
    invertY: bool(r.invertY, DEFAULTS.invertY),
    joystickSide: oneOf(r.joystickSide, ['left', 'right'], DEFAULTS.joystickSide),
    quality: oneOf(r.quality, ['auto', 'alta', 'media', 'baja'], DEFAULTS.quality),
    volume: num(r.volume, 0, 1, DEFAULTS.volume),
    guide: bool(r.guide, DEFAULTS.guide),
    guideObject: bool(r.guideObject, DEFAULTS.guideObject),
    spin: bool(r.spin, DEFAULTS.spin),
    blackPocket: bool(r.blackPocket, DEFAULTS.blackPocket),
    showFps: bool(r.showFps, DEFAULTS.showFps),
  };
}

function defaultStorage() {
  try {
    return globalThis.localStorage;
  } catch (e) {
    return undefined;
  }
}

// Nunca lanza: ante cualquier problema devuelve los valores por defecto.
export function loadSettings(storage = defaultStorage()) {
  try {
    return clean(JSON.parse(storage.getItem(KEY)));
  } catch (e) {
    return { ...DEFAULTS };
  }
}

export function saveSettings(settings, storage = defaultStorage()) {
  try {
    storage.setItem(KEY, JSON.stringify(clean(settings)));
  } catch (e) {
    // Sin almacenamiento disponible los ajustes solo duran esta sesion.
  }
}
