// Sonidos de la mesa sintetizados con Web Audio. Son aproximaciones, no grabaciones.

const MAX_VOICES = 12;

export function createSound() {
  let ctx = null;
  let master = null;
  let noise = null;
  let volume = 0.8;
  let voices = 0;
  let rollGain = null;

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
    // Un limitador evita que un saque con muchos choques a la vez sature.
    const limiter = ctx.createDynamicsCompressor();
    limiter.threshold.value = -10;
    limiter.knee.value = 8;
    limiter.ratio.value = 8;
    limiter.attack.value = 0.002;
    limiter.release.value = 0.12;
    master.connect(limiter).connect(ctx.destination);
    // Un segundo de ruido blanco reutilizable.
    noise = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const data = noise.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    // Rodadura: ruido grave continuo cuyo volumen sigue a la velocidad de las bolas.
    const rollSrc = ctx.createBufferSource();
    rollSrc.buffer = noise;
    rollSrc.loop = true;
    const rollFilter = ctx.createBiquadFilter();
    rollFilter.type = 'bandpass';
    rollFilter.frequency.value = 260;
    rollFilter.Q.value = 0.6;
    rollGain = ctx.createGain();
    rollGain.gain.value = 0;
    rollSrc.connect(rollFilter).connect(rollGain).connect(master);
    rollSrc.start();
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
    // Golpe del taco a la blanca: un toque seco de madera y cuero.
    cue(power01) {
      const t = voice(0.12);
      if (t === null) return;
      const a = 0.3 + power01 * 0.7;
      burst(t, { type: 'bandpass', freq: 2400, q: 0.9, gain: 0.55 * a, dur: 0.014 });
      ping(t, { freq: 620, to: 340, gain: 0.5 * a, dur: 0.045, type: 'triangle' });
      ping(t, { freq: 190, to: 110, gain: 0.3 * a, dur: 0.07 });
    },
    // Rodadura sobre el pano. level: suma de velocidades de las bolas, en m/s.
    roll(level) {
      if (!ctx || !rollGain || ctx.state !== 'running') return;
      const target = Math.min(0.16, level * 0.035);
      rollGain.gain.setTargetAtTime(target, ctx.currentTime, 0.08);
    },
    // Sucesos de la fisica.
    handle(e) {
      if (e.type === 'ballBall') {
        if (e.speed < 0.03) return;
        const t = voice(0.07);
        if (t === null) return;
        const a = level(e.speed, 4.5);
        const tune = 0.94 + Math.random() * 0.12; // cada choque suena un poco distinto
        // Chasquido de resina: un clic muy corto y dos resonancias agudas que se apagan enseguida.
        burst(t, { type: 'highpass', freq: 2600, gain: 0.9 * a, dur: 0.007 });
        ping(t, { freq: 3050 * tune, gain: 0.42 * a, dur: 0.03 });
        ping(t, { freq: 4900 * tune, gain: 0.22 * a, dur: 0.018 });
        if (a > 0.35) ping(t, { freq: 620, to: 380, gain: 0.22 * a, dur: 0.03, type: 'triangle' });
      } else if (e.type === 'cushion') {
        if (e.speed < 0.08) return;
        const t = voice(0.14);
        if (t === null) return;
        const a = level(e.speed, 5);
        // Golpe sordo de goma.
        burst(t, { type: 'lowpass', freq: 340, gain: 0.9 * a, dur: 0.07 });
        ping(t, { freq: 125, to: 70, gain: 0.45 * a, dur: 0.11 });
        burst(t, { type: 'bandpass', freq: 1300, q: 1.2, gain: 0.14 * a, dur: 0.012 });
      } else if (e.type === 'pocket') {
        const t = voice(0.9);
        if (t === null) return;
        // Caida en la tronera, un par de rebotes dentro y la bola rodando por el interior de la mesa.
        ping(t, { freq: 210, to: 80, gain: 0.6, dur: 0.14 });
        burst(t, { type: 'lowpass', freq: 700, gain: 0.55, dur: 0.07 });
        for (const [dt, g] of [[0.09, 0.3], [0.16, 0.18], [0.21, 0.1]]) {
          burst(t + dt, { type: 'bandpass', freq: 1700, q: 1.5, gain: g, dur: 0.012 });
          ping(t + dt, { freq: 300, to: 180, gain: g * 0.7, dur: 0.04 });
        }
        burst(t + 0.2, { type: 'lowpass', freq: 210, gain: 0.34, dur: 0.65 });
      }
    },
  };
}
