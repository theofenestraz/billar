# Billar en primera persona: diseño

Fecha: 2026-11-09

## Objetivo

Un juego de bola 8 en primera persona, jugable en el navegador, ambientado en una recreación de la sala real grabada en `IMG_8259.MOV`. Es para jugar por diversión con amigos. La prioridad es que resulte lo más realista posible, tanto en el aspecto de la sala como en el comportamiento de las bolas.

Éxito significa: un amigo abre un enlace en su móvil u ordenador, reconoce la sala, y puede jugar una partida completa de bola 8 contra otra persona pasándose el dispositivo.

## Alcance

**Primera versión**

- Dos jugadores por turnos en el mismo dispositivo.
- Sala recreada a partir del vídeo, con movimiento libre en primera persona.
- Bola 8 con reglas de bar.
- Tiro sencillo: dirección y fuerza, con línea guía.
- Móvil (táctil) y ordenador (teclado y ratón).

**Segunda fase (no se construye ahora, pero el diseño la deja preparada)**

- Efectos en la blanca (corrido, retroceso, lateral), activables en ajustes.
- Modo en línea, cada jugador en su dispositivo.

**Fuera de alcance**

- Jugar contra la máquina.
- Bolas que saltan fuera de la mesa, tiros de salto y massé.
- Reglas de torneo (anunciar tronera, banda obligatoria tras el contacto).
- Otras modalidades (bola 9, carambola).

## Material de referencia

- `referencia/fotogramas/`: 25 fotogramas del vídeo, uno cada 2 segundos.
- `referencia/medidas-mesa.png`: medidas de la mesa aportadas por el usuario.

Medidas confirmadas por el usuario: mesa de 236 × 137 cm por fuera y 198 × 99 cm de superficie de juego.

Medidas supuestas (no confirmadas): altura de la mesa 80 cm, bolas de 57 mm, sala de unos 12 × 10 m con techo a unos 2,8 m. Las dimensiones de la sala se estiman comparando con la mesa en los fotogramas y se ajustan al modelar.

## Enfoque técnico

Three.js para el 3D y física de billar escrita a medida. Se descartaron un motor de física genérico (menos preciso para billar y no determinista) y un motor de juegos completo (más pesado en móvil sin aportar nada necesario).

Página web estática, sin servidor. Publicación en GitHub Pages, solo tras confirmación del usuario.

## 1. La sala

**Zona jugable.** Rectángulo de unos 12 × 10 m con la mesa en el centro, en la posición y orientación del vídeo. Límites:

- Fondo: gradas naranjas y pared oscura con el neón verde.
- Izquierda: pared con el ventanal a la sala de tubos de neón de colores.
- Derecha: pared gris de la diana.
- Detrás: cristalera con plantas y la línea de pilares con el futbolín.

El pasillo de salida y la zona de cafetería se ven como fondo. Una barrera invisible impide entrar.

**Elementos modelados.**

- Gradas de madera naranja en varios niveles, con dos huecos de escalón. Se puede subir a ellas.
- Neón verde en forma de cuadrado irregular.
- Ventanal con tubos de neón de colores en zigzag al otro lado.
- Pilares de hormigón rectos e inclinados (los inclinados forman una A).
- Puf circular amarillo y gris, puf circular naranja y gris, puf gris pequeño, banco naranja.
- Sillón naranja, mesita blanca de rejilla, mesita negra, papelera negra.
- Diana sobre panel naranja, cartel verde, taquera de pared, cuadro eléctrico.
- Futbolín oscuro, banco de madera clara, extintor, armario rojo, cartel de salida.
- Taco apoyado en el pilar.
- Moqueta gris. Techo negro con tuberías vistas, carriles de focos y discos acústicos naranjas y blancos.

**Colisiones.** El jugador no atraviesa paredes, pilares, muebles ni la mesa. Los pilares inclinados bloquean según su huella en el suelo.

**Luz y materiales.** Ambiente oscuro. Focos de carril con charcos de luz sobre la moqueta, neón verde tiñendo gradas y borde de la mesa, tubos de colores brillando tras el cristal. Materiales con respuesta física a la luz: hormigón rugoso, moqueta mate, aluminio y cristal con reflejos. La mesa y las bolas proyectan sombras en tiempo real. El resto de sombras son fijas.

**Calidad.** Alta por defecto en todos los dispositivos, móvil incluido. Nunca se baja automáticamente. En ajustes se puede bajar a mano.

**Aproximaciones aceptadas.** Los textos de carteles y la diana se dibujan parecidos, no idénticos, salvo que el usuario aporte fotos de frente. Lo que hay tras las cristaleras es una imagen de fondo, no geometría.

## 2. Mesa, bolas y física

**Mesa.** A escala con las medidas confirmadas. Cuerpo negro, perfiles de aluminio, esquineras grises, tapete verde, seis troneras, ventanilla lateral donde se ven las bolas embocadas, tiza azul en una esquina.

**Bolas.** 16 bolas de pool: blanca, siete lisas, siete rayadas y la negra, con colores y números reales y acabado brillante. Colocación inicial en triángulo con la negra en el centro.

**Física.** Módulo independiente, sin dependencia de los gráficos.

- Cada bola tiene posición, velocidad y giro. El giro se guarda desde la primera versión aunque los efectos lleguen en la segunda fase.
- Fase de deslizamiento seguida de rodadura, con fricción del tapete.
- Choques entre bolas con pequeña pérdida de energía.
- Bandas que devuelven menos velocidad de la que reciben.
- Troneras con geometría real: una bola justa puede rebotar en la boca y quedarse fuera.
- Detección de colisiones en el instante exacto del contacto, de modo que ninguna bola atraviesa otra ni una banda a ninguna velocidad.
- Determinista: mismas condiciones iniciales, mismo resultado en cualquier dispositivo. Para garantizarlo se usa paso de tiempo fijo y ninguna fuente de azar.

Los coeficientes de fricción y rebote parten de valores publicados para mesas de pool y se ajustan probando.

La física recibe el estado de la mesa y un tiro (ángulo, fuerza y, en la segunda fase, punto de golpeo) y produce el movimiento y una lista de sucesos: qué bola tocó primero la blanca, qué bolas se embocaron y en qué orden, y qué bandas se tocaron.

**Sonido.** Golpe de taco, choque entre bolas con volumen según velocidad, banda, y caída en tronera con la bola rodando por dentro de la mesa.

## 3. Controles y cámara

**Modo caminar.** Primera persona a 1,70 m de altura.

- Ordenador: WASD o flechas para moverse, ratón para mirar con captura de puntero (clic para capturar, Esc para soltar), Mayús para ir más rápido.
- Móvil: joystick virtual en la mitad izquierda, arrastrar en la mitad derecha para mirar.

**Entrar a tirar.** A menos de 1,5 m de la mesa y en tu turno aparece el botón "Tirar" (tecla E). La cámara se desliza hasta detrás de la blanca, inclinada sobre el taco.

**Modo apuntar.**

- Giro alrededor de la blanca arrastrando. Ajuste fino con rueda del ratón o teclas en ordenador y con dos botones de flecha en móvil.
- Inclinación vertical de la vista, sin cambiar la dirección del tiro.
- Taco visible en primera persona.
- Línea guía: recorrido de la blanca hasta la primera bola y tramo corto de salida de esa bola. Desactivable.
- Fuerza: mantener pulsado y tirar hacia atrás. El taco retrocede y una barra indica la potencia. Al soltar, golpea. Volver al punto inicial cancela.
- Botón "Levantarse" (Esc) para volver a caminar sin tirar.

**Después del tiro.** La cámara se queda en su sitio y el jugador recupera el movimiento libre al instante. No se puede volver a tirar hasta que todas las bolas paran.

**Bola en mano.** Vista cenital. Se arrastra la blanca a cualquier punto libre de la mesa y se confirma. En el saque la colocación se limita a la zona de cabecera.

**Ajustes de control.** Esquema (detectado automáticamente y cambiable), sensibilidad, invertir eje vertical, lado del joystick.

**Orientación.** En móvil el juego pide ponerlo en horizontal.

## 4. Reglas y partida

**Reglas.** Módulo independiente. Recibe la lista de sucesos de un tiro y el estado de la partida, y devuelve el estado siguiente.

- Saque: blanca en la zona de cabecera. Embocar en el saque permite seguir tirando, con la mesa abierta.
- Grupos: se asignan con la primera bola embocada legalmente después del saque.
- Turno: embocar una bola propia sin falta permite seguir. En otro caso pasa el turno.
- Faltas: embocar la blanca, no tocar ninguna bola, tocar primero una bola del rival, o tocar primero la negra cuando aún quedan bolas propias. Con la mesa abierta, cualquier bola salvo la negra es válida como primer contacto. Penalización: bola en mano para el rival en cualquier punto.
- Negra: con el grupo propio terminado, embocarla sin falta gana. Embocarla antes de tiempo, o junto con la blanca, pierde.
- Negra en el saque: se vuelve a colocar el triángulo y saca el mismo jugador.

**Partida.** Dos jugadores con nombre. Indicador permanente de turno, grupo de cada jugador y bolas restantes. Aviso al cambiar de turno. Pantalla de ganador con revancha (saca quien perdió) y marcador de partidas ganadas en la sesión.

**Menús.** Inicio con "Jugar", "Cómo se juega" y "Ajustes". Pausa con reanudar, ajustes y reiniciar. Ajustes: controles, sensibilidad, calidad gráfica, volumen, línea guía. Las preferencias se guardan en el dispositivo.

## 5. Estructura

Carpeta `Proyectos Claude/Billar/`. Módulos:

| Módulo | Qué hace | Depende de |
|---|---|---|
| Física | Movimiento de bolas, choques, bandas, troneras. Produce sucesos. | Nada |
| Reglas | Turnos, grupos, faltas, victoria. | Nada (consume sucesos) |
| Sala y mesa | Geometría, materiales y luces. | Three.js |
| Jugador | Cámara, caminar, colisiones, modo apuntar. | Three.js, sala |
| Interfaz | Menús, marcador, controles táctiles. | Reglas (solo lectura del estado) |
| Sonido | Reproduce sonidos a partir de los sucesos. | Nada |
| Partida | Coordina los demás: recoge el tiro, lanza la física, pasa los sucesos a reglas y sonido. | Todos |

Física y reglas no conocen la pantalla. El modo en línea futuro consistirá en enviar cada tiro (ángulo y fuerza) al otro dispositivo, que lo reproduce con el mismo resultado gracias al determinismo.

## Errores y casos límite

- Dispositivo sin WebGL: mensaje claro en lugar de pantalla en negro.
- Pérdida de foco o pestaña en segundo plano durante un tiro: la simulación se pausa y continúa al volver, sin saltos.
- Captura de puntero rechazada o perdida: el juego pasa a pausa.
- Bola en mano sobre otra bola o fuera del tapete: la colocación no se acepta.
- Preferencias guardadas ilegibles o almacenamiento no disponible: se usan los valores por defecto.

## Pruebas

**Automáticas (física).** La energía total nunca aumenta. Ninguna bola sale del tapete. Un choque frontal transfiere la velocidad. Repetir un tiro da exactamente el mismo resultado. Una bola rápida no atraviesa bandas ni otras bolas.

**Automáticas (reglas).** Asignación de grupos, cada tipo de falta, cambio de turno, victoria y derrota con la negra, negra en el saque.

**Manuales.** Partida completa en ordenador y en móvil. Comprobación visual de la sala contra los fotogramas de referencia. Rendimiento en móvil con calidad alta.

## Orden de construcción

1. Física y reglas con sus pruebas.
2. Mesa jugable en una sala vacía, con controles de apuntar y tirar.
3. Sala completa con luces, colisiones y movimiento libre.
4. Menús, sonido y pulido en móvil.

## Pendiente del usuario (opcional)

- Fotos de frente de la pared de la diana, el neón verde, el ventanal de neones y la mesa desde arriba, para mejorar el parecido.
- Confirmar altura de la mesa y diámetro de las bolas si difieren de lo supuesto.
