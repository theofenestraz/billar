import { test, assert } from './harness.js';
import { loadSettings, saveSettings, DEFAULTS } from '../src/ui/settings.js';

const fakeStorage = (initial = {}) => {
  const data = { ...initial };
  return {
    data,
    getItem: (k) => (k in data ? data[k] : null),
    setItem: (k, v) => { data[k] = String(v); },
  };
};

test('settings: defaults when nothing is stored', () => {
  const s = loadSettings(fakeStorage());
  assert(JSON.stringify(s) === JSON.stringify(DEFAULTS));
  assert(s.quality === 'auto' && s.guideObject === true && s.spin === true && s.guide === true && s.controls === 'auto' && s.volume === 0.8);
});

test('settings: defaults when the stored value is not valid JSON', () => {
  const s = loadSettings(fakeStorage({ 'billar.settings.v2': '{oops' }));
  assert(JSON.stringify(s) === JSON.stringify(DEFAULTS));
});

test('settings: defaults when storage throws or is missing', () => {
  const broken = { getItem() { throw new Error('denied'); }, setItem() { throw new Error('denied'); } };
  assert(JSON.stringify(loadSettings(broken)) === JSON.stringify(DEFAULTS));
  assert(JSON.stringify(loadSettings(undefined)) === JSON.stringify(DEFAULTS));
  saveSettings({ ...DEFAULTS }, broken); // no debe lanzar
  saveSettings({ ...DEFAULTS }, undefined);
});

test('settings: save then load keeps the values', () => {
  const st = fakeStorage();
  saveSettings({ ...DEFAULTS, quality: 'baja', sensitivity: 1.5, guide: false, joystickSide: 'right' }, st);
  const s = loadSettings(st);
  assert(s.quality === 'baja' && s.sensitivity === 1.5 && s.guide === false && s.joystickSide === 'right');
});

test('settings: invalid stored fields fall back to their defaults', () => {
  const st = fakeStorage({ 'billar.settings.v2': JSON.stringify({ quality: 'ultra', sensitivity: 'fast', volume: 7, invertY: true, extra: 1 }) });
  const s = loadSettings(st);
  assert(s.quality === 'auto' && s.sensitivity === 1 && s.volume === 1 && s.invertY === true);
  assert(!('extra' in s));
});
