// Luces de la sala, reflejos de entorno, resplandor y niveles de calidad.

import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { ROOM } from './room.js?v=17';

// Niveles de calidad. half: se apaga la mitad de los focos de relleno y se sube el resto.
const LEVELS = {
  alta: { pixelRatio: 2, msaa: 4, bloom: true, shadow: 2048, half: false },
  media: { pixelRatio: 1.5, msaa: 0, bloom: true, shadow: 1024, half: true },
  baja: { pixelRatio: 1, msaa: 0, bloom: false, shadow: 0, half: true },
};

export function setupLighting(renderer, scene, camera) {
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  // La sombra solo se recalcula cuando algo se mueve sobre la mesa (ver render).
  renderer.shadowMap.autoUpdate = false;

  scene.add(new THREE.HemisphereLight('#e4e6ea', '#9a9ba0', 3.8));

  // Foco principal sobre la mesa, el unico que proyecta sombras.
  const key = new THREE.SpotLight('#fff0d8', 48, 9, 0.85, 0.65, 1.4);
  key.position.set(0, ROOM.height - 0.1, 0);
  key.target.position.set(0, 0.76, 0);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  key.shadow.camera.near = 0.5;
  key.shadow.camera.far = 6;
  key.shadow.bias = -0.0003;
  key.shadow.normalBias = 0.012;
  scene.add(key, key.target);

  // Focos de carril sin sombra: posicion y punto al que apuntan.
  const fills = [
    [-3.6, -2.6, -3.45, -3.3, 13], // puf amarillo
    [-3.6, 0.4, -3.6, -0.6, 15], // sillon y mesita
    [-1.0, -4.4, -1.0, -6.0, 75], // gradas
    [1.2, -4.4, 1.2, -6.0, 60], // gradas, lado este
    [4.6, -4.2, 4.6, -5.6, 17], // puf naranja
    [5.4, -4.2, 7.3, -4.2, 35], // pared de la diana
    [5.4, -2.2, 7.3, -2.6, 30], // cartel
    [4.2, 4.3, 4.2, 5.2, 25], // banco de la cristalera
    [-1.8, 4.2, -2.4, 3.4, 28], // entrada
    [5.2, 1.0, 5.4, 2.4, 22], // futbolin
    [-2.2, 1.8, -3.0, 1.6, 20], // pilar con papelera
  ];
  const fillLights = [];
  for (const [x, z, tx, tz, power] of fills) {
    const s = new THREE.SpotLight('#ffe8c6', power, 9, 0.8, 0.85, 1.4);
    s.position.set(x, ROOM.height - 0.25, z);
    s.target.position.set(tx, 0.4, tz);
    scene.add(s, s.target);
    s.userData.base = power;
    fillLights.push(s);
  }

  // Luz de los neones.
  const n = ROOM.neon;
  const neon = new THREE.PointLight('#30ff80', 3.2, 6.5, 1.8);
  neon.position.set(n.x, n.y, n.z + 0.55);
  const neonCorner = new THREE.PointLight('#30ff80', 1.6, 4, 1.8);
  neonCorner.position.set(-3.3, 2.2, -7.5);
  const neonA = new THREE.PointLight('#30ff80', 2.4, 4.5, 1.8);
  neonA.position.set(2.5, 2.4, -6.6);
  const tubes = new THREE.PointLight('#ffd6ee', 5, 8, 1.7);
  tubes.position.set(-4.3, 1.9, 0.2);
  scene.add(neon, neonCorner, neonA, tubes);

  // Reflejos: una captura del entorno desde el centro de la mesa.
  const cubeRT = new THREE.WebGLCubeRenderTarget(256, { type: THREE.HalfFloatType });
  const cubeCam = new THREE.CubeCamera(0.2, 40, cubeRT);
  cubeCam.position.set(0, 1.3, 0);
  const pmrem = new THREE.PMREMGenerator(renderer);
  function captureEnvironment(hide = []) {
    for (const o of hide) o.visible = false;
    scene.environment = null;
    cubeCam.update(renderer, scene);
    scene.environment = pmrem.fromCubemap(cubeRT.texture).texture;
    scene.environmentIntensity = 0.3;
    for (const o of hide) o.visible = true;
  }

  // Resplandor.
  let composer = null;
  let bloom = null;
  let quality = 'alta';
  let applied = false;
  let shadowAge = 999; // fotogramas desde la ultima sombra calculada
  // Perfil movil: sin resplandor, sombra simple y a media frecuencia, cinco focos de relleno
  // y resolucion que baja sola cuando un fotograma tarda demasiado.
  let mobile = false;
  const MOBILE_FILLS = [1, 2, 5, 8, 9]; // sillon, gradas, pared de la diana, entrada y futbolin
  let resScale = 1;
  const RES_MIN = 0.6;
  const frameStats = { t: 0, n: 0, slowFor: 0, fastFor: 0 };
  let shadowSkip = false;
  let width = 1;
  let height = 1;

  function buildComposer() {
    const pr = renderer.getPixelRatio();
    const cfg = LEVELS[quality];
    const rt = new THREE.WebGLRenderTarget(width * pr, height * pr, { type: THREE.HalfFloatType, samples: cfg.msaa });
    composer = new EffectComposer(renderer, rt);
    composer.setPixelRatio(pr);
    composer.setSize(width, height);
    composer.addPass(new RenderPass(scene, camera));
    const k = cfg.msaa ? 1 : 0.5; // en calidad media el resplandor se calcula a media resolucion
    bloom = new UnrealBloomPass(new THREE.Vector2(width * k, height * k), 0.4, 0.55, 3.2);
    composer.addPass(bloom);
    composer.addPass(new OutputPass());
  }

  const basePixelRatio = () => Math.min(devicePixelRatio, LEVELS[quality].pixelRatio);
  function setPixelRatio() {
    renderer.setPixelRatio(basePixelRatio() * (mobile ? resScale : 1));
    renderer.setSize(width, height);
    if (composer) {
      composer.setPixelRatio(renderer.getPixelRatio());
      composer.setSize(width, height);
    }
  }

  function apply() {
    applied = true;
    const cfg = { ...LEVELS[quality] };
    if (mobile) {
      cfg.bloom = false;
      if (cfg.shadow) cfg.shadow = 1024;
    }
    renderer.shadowMap.type = mobile ? THREE.PCFShadowMap : THREE.PCFSoftShadowMap;
    if (composer) {
      composer.dispose();
      composer = null;
    }
    setPixelRatio();
    renderer.shadowMap.enabled = cfg.shadow > 0;
    key.castShadow = cfg.shadow > 0;
    if (cfg.shadow && key.shadow.mapSize.x !== cfg.shadow) {
      key.shadow.mapSize.set(cfg.shadow, cfg.shadow);
      if (key.shadow.map) {
        key.shadow.map.dispose();
        key.shadow.map = null;
      }
    }
    shadowAge = 999;
    fillLights.forEach((l, i) => {
      if (mobile) {
        l.visible = MOBILE_FILLS.includes(i);
        l.intensity = l.userData.base * 1.9;
      } else {
        l.visible = !cfg.half || i % 2 === 0;
        l.intensity = l.userData.base * (cfg.half ? 1.6 : 1);
      }
    });
    scene.traverse((o) => { if (o.material) [].concat(o.material).forEach((m) => { m.needsUpdate = true; }); });
    if (cfg.bloom) buildComposer();
  }

  // Resolucion dinamica en movil: baja un paso si los fotogramas tardan, sube cuando sobra tiempo.
  function adaptResolution(dt) {
    if (!mobile || dt <= 0 || dt > 0.25) return;
    frameStats.t += dt;
    frameStats.n++;
    if (frameStats.t < 1) return;
    const avg = frameStats.t / frameStats.n;
    frameStats.t = 0;
    frameStats.n = 0;
    if (avg > 0.0185) {
      frameStats.slowFor++;
      frameStats.fastFor = 0;
    } else if (avg < 0.0172) {
      frameStats.fastFor++;
      frameStats.slowFor = 0;
    } else {
      frameStats.slowFor = 0;
      frameStats.fastFor = 0;
    }
    let next = resScale;
    if (frameStats.slowFor >= 1 && resScale > RES_MIN) next = Math.max(RES_MIN, resScale - 0.1);
    else if (frameStats.fastFor >= 4 && resScale < 1) next = Math.min(1, resScale + 0.1);
    if (next !== resScale) {
      resScale = Math.round(next * 10) / 10;
      frameStats.slowFor = 0;
      frameStats.fastFor = 0;
      setPixelRatio();
    }
  }

  return {
    captureEnvironment,
    get quality() { return quality; },
    get mobile() { return mobile; },
    // Escala de resolucion actual (1 = completa). Solo cambia en movil.
    get resScale() { return resScale; },
    get resAtMinimum() { return !mobile || resScale <= RES_MIN; },
    setMobile(on) {
      if (mobile === on) return;
      mobile = on;
      resScale = 1;
      if (applied) apply();
    },
    setQuality(level) {
      if (!LEVELS[level] || (level === quality && applied)) return;
      quality = level;
      apply();
    },
    resize(w, h) {
      width = w;
      height = h;
      apply();
    },
    // moving: hay algo moviendose sobre la mesa. Si no, la sombra se refresca de tarde en tarde.
    render(moving = true, dt = 0) {
      adaptResolution(dt);
      shadowAge++;
      // En movil, mientras algo se mueve la sombra se recalcula un fotograma si y otro no.
      if (mobile && moving) {
        shadowSkip = !shadowSkip;
        if (shadowSkip) moving = false;
      }
      if (moving || shadowAge > 40) {
        renderer.shadowMap.needsUpdate = true;
        shadowAge = 0;
      }
      if (composer) composer.render();
      else renderer.render(scene, camera);
    },
  };
}
