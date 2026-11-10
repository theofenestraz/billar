// Luces de la sala, reflejos de entorno, resplandor y niveles de calidad.

import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { ROOM } from './room.js?v=8';

const MAX_PIXEL_RATIO = 2;

export function setupLighting(renderer, scene, camera) {
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

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
  let width = 1;
  let height = 1;

  function buildComposer() {
    const pr = renderer.getPixelRatio();
    const rt = new THREE.WebGLRenderTarget(width * pr, height * pr, { type: THREE.HalfFloatType, samples: 4 });
    composer = new EffectComposer(renderer, rt);
    composer.setPixelRatio(pr);
    composer.setSize(width, height);
    composer.addPass(new RenderPass(scene, camera));
    bloom = new UnrealBloomPass(new THREE.Vector2(width, height), 0.4, 0.55, 3.2);
    composer.addPass(bloom);
    composer.addPass(new OutputPass());
  }

  function apply() {
    const high = quality === 'alta';
    renderer.setPixelRatio(high ? Math.min(devicePixelRatio, MAX_PIXEL_RATIO) : 1);
    renderer.setSize(width, height);
    renderer.shadowMap.enabled = high;
    key.castShadow = high;
    // En calidad baja se apaga la mitad de los focos y se sube el resto para compensar.
    fillLights.forEach((l, i) => {
      l.visible = high || i % 2 === 0;
      l.intensity = l.userData.base * (high ? 1 : 1.6);
    });
    scene.traverse((o) => { if (o.material) [].concat(o.material).forEach((m) => { m.needsUpdate = true; }); });
    if (composer) {
      composer.dispose();
      composer = null;
    }
    if (high) buildComposer();
  }

  return {
    captureEnvironment,
    get quality() { return quality; },
    setQuality(level) {
      if (level === quality && (composer || level === 'baja')) return;
      quality = level;
      apply();
    },
    resize(w, h) {
      width = w;
      height = h;
      apply();
    },
    render() {
      if (composer) composer.render();
      else renderer.render(scene, camera);
    },
  };
}
