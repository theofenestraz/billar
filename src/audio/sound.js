// Sonidos de la mesa sintetizados con Web Audio. Son aproximaciones, no grabaciones.

const MAX_VOICES = 8;

export function createSound() {
  let ctx = null;
  let master = null;
  let noise = null;
  let volume = 0.8;
  let voices = 0;

  function ensure() {
    if (ctx) return true;
    const AC = globalThis.AudioContext || globalThis.webkitAudioContext;
    if (!AC) return false;
    try {
      ctx = new AC();
    } catch (e) {
      return false;
    }
    master = ctx.createGain();
    master.gain.value = volume;
    master.connect(ctx.destination);
    // Un segundo de ruido blanco reutilizable.
    noise = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const data = noise.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    return true;
  }

  function voice(dur) {
    if (!ctx || ctx.state !== 'running' || voices >= MAX_VOICES) return null;
    voices++;
    setTimeout(() => { voices--; }, dur * 1000 + 30);
    return ctx.currentTime;
  }

  // Rafaga de ruido filtrado.
  function burst(t, { type, freq, q = 1, gain, dur }) {
    const src = ctx.createBufferSource();
    src.buffer = noise;
    const f = ctx.createBiquadFilter();
    f.type = type;
    f.frequency.value = freq;
    f.Q.value = q;
    const g = ctx.createGain();
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.0005, t + dur);
    src.connect(f).connect(g).connect(master);
    src.start(t, Math.random() * 0.5, dur + 0.02);
  }

  // Tono que decae.
  function ping(t, { freq, to = freq, gain, dur, type = 'sine' }) {
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (to !== freq) o.frequency.exponentialRampToValueAtTime(to, t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.0005, t + dur);
    o.connect(g).connect(master);
    o.start(t);
    o.stop(t + dur + 0.02);
  }

  const level = (speed, ref) => Math.min(1, Math.pow(speed / ref, 0.8));

  return {
    // Hay que llamarlo desde un gesto del usuario para que el navegador permita el audio.
    unlock() {
      if (!ensure()) return;
      if (ctx.state === 'suspended') ctx.resume().catch(() => {});
    },
    setVolume(v) {
      volume = v;
      if (master) master.gain.value = v;
    },
    // Golpe del taco a la blanca.
    cue(power01) {
      const t = voice(0.12);
      if (t === null) return;
      const a = 0.25 + power01 * 0.75;
      burst(t, { type: 'bandpass', freq: 1500, q: 1.2, gain: 0.5 * a, dur: 0.045 });
      ping(t, { freq: 260, to: 120, gain: 0.35 * a, dur: 0.09 });
    },
    // Sucesos de la fisica.
    handle(e) {
      if (e.type === 'ballBall') {
        if (e.speed < 0.04) return;
        const t = voice(0.08);
        if (t === null) return;
        const a = level(e.speed, 5);
        burst(t, { type: 'bandpass', freq: 3600, q: 2.5, gain: 0.7 * a, dur: 0.028 });
        ping(t, { freq: 2100 + a * 500, gain: 0.25 * a, dur: 0.035, type: 'triangle' });
      } else if (e.type === 'cushion') {
        if (e.speed < 0.08) return;
        const t = voice(0.12);
        if (t === null) return;
        const a = level(e.speed, 5);
        burst(t, { type: 'lowpass', freq: 420, gain: 0.8 * a, dur: 0.08 });
        ping(t, { freq: 150, to: 80, gain: 0.3 * a, dur: 0.09 });
      } else if (e.type === 'pocket') {
        const t = voice(0.75);
        if (t === null) return;
        ping(t, { freq: 190, to: 70, gain: 0.55, dur: 0.16 });
        burst(t, { type: 'lowpass', freq: 600, gain: 0.5, dur: 0.1 });
        // Rodadura por dentro de la mesa.
        burst(t + 0.12, { type: 'lowpass', freq: 240, gain: 0.3, dur: 0.6 });
      }
    },
  };
}
