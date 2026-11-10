// Unidades: metros, segundos, radianes.
// Origen en el centro de la mesa. x hacia el este, z hacia el sur, eje largo en z.

export const R = 0.028575; // radio de bola (57,15 mm de diametro)
export const HALF_W = 0.495; // media anchura de la superficie de juego
export const HALF_L = 0.99; // media longitud de la superficie de juego
export const BED_Y = 0.76; // altura de la superficie de juego

export const G = 9.81;
export const MU_SLIDE = 0.2; // friccion bola-tapete deslizando
export const MU_ROLL = 0.01; // resistencia a la rodadura
export const E_BALL = 0.95; // restitucion bola-bola
export const E_CUSHION = 0.75; // restitucion bola-banda

export const DT = 1 / 240; // paso fijo de simulacion
export const V_REST = 0.005; // por debajo de esta velocidad la bola se detiene
export const MIN_CUE_SPEED = 0.3;
export const MAX_CUE_SPEED = 9;
export const TOP_BOOST = 1.5; // extra solo en lo mas alto de la barra, para el saque
// Toda la barra de fuerza da el 75 % de lo que daba antes (pedido por el usuario el 2026-11-10).
export const POWER_SCALE = 0.75;

// Velocidad de la blanca segun la fuerza elegida (0 a 1). El termino p^8 solo pesa cerca del
// maximo, que llega a 0,75 x 10,5 = 7,875 m/s.
export function cueSpeed(p) {
  const q = p < 0 ? 0 : p > 1 ? 1 : p;
  const q2 = q * q;
  const q8 = q2 * q2 * q2 * q2;
  return POWER_SCALE * (MIN_CUE_SPEED + q2 * (MAX_CUE_SPEED - MIN_CUE_SPEED) + q8 * TOP_BOOST);
}
export const MAX_STEPS = 240 * 45; // limite de duracion de un tiro

export const MU_CUSHION = 0.14; // agarre de la banda sobre el efecto lateral
export const MAX_TIP_OFFSET = 0.5; // desplazamiento maximo del golpe, en radios de bola
