// Geometria de bandas y troneras sobre el plano de la mesa.

import { HALF_W, HALF_L } from './constants.js';

const CORNER_OFFSET = 0.012; // centro de la tronera de esquina, hacia fuera de la esquina
const CORNER_R = 0.06; // radio de captura
const CORNER_CUT = 0.085; // distancia de la esquina a la que termina la banda
const CORNER_JAW = 0.042426; // 0,06 a 45 grados, por componente

const SIDE_OFFSET = 0.04; // centro de la tronera central, hacia fuera de la banda
const SIDE_R = 0.058;
const SIDE_CUT = 0.07; // media abertura de la boca central
const SIDE_JAW_OUT = 0.048296; // 0,05 * cos(15)
const SIDE_JAW_IN = 0.012941; // 0,05 * sin(15)

function build() {
  const pockets = [];
  const cushions = [];
  let id = 0;
  const signs = [-1, 1];
  // Troneras de esquina y centrales, en orden fijo.
  for (const sz of signs) for (const sx of signs) {
    pockets.push({ id: id++, x: sx * (HALF_W + CORNER_OFFSET), z: sz * (HALF_L + CORNER_OFFSET), r: CORNER_R });
  }
  for (const sx of signs) pockets.push({ id: id++, x: sx * (HALF_W + SIDE_OFFSET), z: 0, r: SIDE_R });

  const seg = (x1, z1, x2, z2) => cushions.push({ x1, z1, x2, z2 });
  for (const sx of signs) {
    for (const sz of signs) {
      // Media banda larga, de la boca central a la boca de esquina.
      seg(sx * HALF_W, sz * SIDE_CUT, sx * HALF_W, sz * (HALF_L - CORNER_CUT));
      // Boca central.
      seg(sx * HALF_W, sz * SIDE_CUT, sx * (HALF_W + SIDE_JAW_OUT), sz * (SIDE_CUT - SIDE_JAW_IN));
      // Bocas de esquina: una desde la banda larga y otra desde la corta.
      seg(sx * HALF_W, sz * (HALF_L - CORNER_CUT), sx * (HALF_W + CORNER_JAW), sz * (HALF_L - CORNER_CUT + CORNER_JAW));
      seg(sx * (HALF_W - CORNER_CUT), sz * HALF_L, sx * (HALF_W - CORNER_CUT + CORNER_JAW), sz * (HALF_L + CORNER_JAW));
    }
  }
  for (const sz of signs) {
    // Banda corta completa.
    seg(-(HALF_W - CORNER_CUT), sz * HALF_L, HALF_W - CORNER_CUT, sz * HALF_L);
  }
  // Datos derivados de cada segmento: longitud, direccion y normal unitarias.
  for (const c of cushions) {
    const dx = c.x2 - c.x1;
    const dz = c.z2 - c.z1;
    c.len = Math.sqrt(dx * dx + dz * dz);
    c.tx = dx / c.len;
    c.tz = dz / c.len;
    c.nx = -c.tz;
    c.nz = c.tx;
  }
  return { pockets, cushions };
}

const built = build();
export const POCKETS = built.pockets;
export const CUSHIONS = built.cushions;
