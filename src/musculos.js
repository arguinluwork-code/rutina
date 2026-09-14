// Taxonomía muscular y objetivos semanales.
//
// Los objetivos están en SERIES FRACCIONADAS por semana: el músculo primario de
// un ejercicio suma 1 por serie, cada secundario 0.5. Ese conteo fraccionado es
// el que mejor predice hipertrofia en la meta-regresión de Pelland (2026, 67
// estudios), y es también el que usa la literatura de rangos (Baz-Valle 2022).
//
// Los números NO son el rango poblacional de 12-20 aplicado a todo: están
// calibrados contra un presupuesto real de 3-4 sesiones de 20-24 series, que da
// entre 66 y 88 series ejecutadas por semana. Pedir 12-20 en los dieciséis
// grupos serían ~200 fraccionadas y no entra en el calendario. Especializar es
// justamente eso: poner lo secundario en mantenimiento (~4-6 series alcanzan
// para no perder nada) y gastar el presupuesto en lo prioritario.

export const PRIORIDADES = {
  1: { label: 'Prioridad', color: 'var(--acc)' },
  2: { label: 'Sostén', color: 'var(--fg)' },
  3: { label: 'Mantenimiento', color: 'var(--fg-2)' },
};

/**
 * @property objMin/objMax  series fraccionadas semanales
 * @property recuperacion   horas que conviene esperar antes de volver a pegarle
 * @property nota           por qué ese número, para que sea auditable
 */
export const MUSCULOS = [
  { id: 'hombro-lateral', label: 'Hombro lateral', prioridad: 1, objMin: 14, objMax: 20, recuperacion: 48,
    nota: 'El de mayor retorno para hombros anchos. No recibe casi nada indirecto de los press, que le pegan al anterior: es volumen directo o nada.' },
  { id: 'biceps', label: 'Bíceps', prioridad: 1, objMin: 16, objMax: 20, recuperacion: 48,
    nota: 'Jalones y remos ya aportan media serie cada uno, así que buena parte del objetivo se cubre sin curl.' },
  { id: 'triceps', label: 'Tríceps', prioridad: 1, objMin: 14, objMax: 18, recuperacion: 48,
    nota: 'Enes (2024) lo encontró respondiendo bien a volumen alto. Los press ya aportan indirecto.' },
  { id: 'hombro-posterior', label: 'Hombro posterior', prioridad: 1, objMin: 8, objMax: 12, recuperacion: 48,
    nota: 'El más abandonado y el que equilibra el hombro de perfil.' },

  { id: 'pecho', label: 'Pecho', prioridad: 2, objMin: 8, objMax: 12, recuperacion: 60,
    nota: 'Sostén, no prioridad: con el presupuesto de sesión, subirlo sería a costa de brazos.' },
  { id: 'dorsal', label: 'Dorsal', prioridad: 2, objMin: 9, objMax: 13, recuperacion: 60,
    nota: 'Ancho de espalda. Jalones y remos.' },
  { id: 'espalda-alta', label: 'Espalda alta', prioridad: 2, objMin: 7, objMax: 10, recuperacion: 60,
    nota: 'Trapecio medio y romboides: espesor y postura.' },
  { id: 'hombro-anterior', label: 'Hombro anterior', prioridad: 2, objMin: 4, objMax: 10, recuperacion: 60,
    nota: 'Deliberadamente bajo, y el piso es lo que te dan los press solos. Sumarle trabajo directo le roba lugar al lateral y al posterior, que son los que faltan.' },

  { id: 'cuadriceps', label: 'Cuádriceps', prioridad: 3, objMin: 6, objMax: 10, recuperacion: 72,
    nota: 'Mantenimiento con margen. 6 series semanales alcanzan para no perder masa.' },
  { id: 'isquiotibiales', label: 'Isquiotibiales', prioridad: 3, objMin: 5, objMax: 8, recuperacion: 72,
    nota: 'Mantenimiento. Importante para la rodilla aunque no sea objetivo estético.' },
  { id: 'gemelos', label: 'Gemelos', prioridad: 3, objMin: 4, objMax: 7, recuperacion: 48,
    nota: 'Mantenimiento.' },
  { id: 'gluteo', label: 'Glúteo', prioridad: 3, objMin: 3, objMax: 6, recuperacion: 72,
    nota: 'Se cubre casi entero con lo indirecto de prensa y sentadilla.' },
  { id: 'abdomen', label: 'Abdomen', prioridad: 3, objMin: 3, objMax: 6, recuperacion: 48,
    nota: 'Mantenimiento.' },
  { id: 'antebrazo', label: 'Antebrazo', prioridad: 3, objMin: 0, objMax: 5, recuperacion: 48,
    nota: 'Se cubre solo con todo lo que tirás y agarrás.' },
  { id: 'trapecio-superior', label: 'Trapecio superior', prioridad: 3, objMin: 0, objMax: 5, recuperacion: 48,
    nota: 'Se cubre solo. Trabajo directo solo si te interesa el trapecio alto.' },
  { id: 'lumbar', label: 'Lumbar', prioridad: 3, objMin: 0, objMax: 5, recuperacion: 72,
    nota: 'Se cubre solo con peso muerto rumano, remo y prensa.' },
];

const PORID = Object.fromEntries(MUSCULOS.map(m => [m.id, m]));
export function musculo(id) { return PORID[id] || { id, label: id, prioridad: 3, objMin: 0, objMax: 0, recuperacion: 48 }; }
export function labelMusculo(id) { return musculo(id).label; }

// Antebrazo, trapecio superior y lumbar llevan mínimo 0 a propósito: reciben
// tanto trabajo indirecto que ponerles un piso solo genera una alarma falsa.

/** Series fraccionadas mínimas para considerar que una sesión "trabajó" un músculo. */
export const UMBRAL_ESTIMULO = 3;

// ---------------------------------------------------------------- la curva

/**
 * El óptimo de crecimiento por semana, en series fraccionadas.
 *
 * ES EL MISMO PARA TODOS LOS MÚSCULOS, y eso no es una simplificación: es lo
 * que dice la evidencia. La meta-regresión de Pelland (2026, 67 estudios) buscó
 * si la curva dosis-respuesta cambiaba según el grupo muscular y no encontró
 * moderación que valga la pena. Lo que cambia entre músculos no es dónde está
 * el óptimo sino cuánto trabajo indirecto ya reciben, y eso el conteo
 * fraccionado ya lo cuenta: media serie por cada músculo secundario.
 *
 * Inventar un óptimo distinto para el bíceps y para el cuádriceps sería
 * precisión fabricada. Lo que sí es una decisión propia, y por eso va aparte,
 * es el OBJETIVO de esta planificación: cuánto de ese óptimo se gasta en cada
 * músculo, que depende del presupuesto de sesiones y de qué querés priorizar.
 *
 * El modelo: la fracción de la respuesta alcanzable que capturás con n series
 * es 1 - e^(-n/TAU), con TAU = 8. Es una saturación, no una recta: cada serie
 * agregada rinde menos que la anterior, y el rendimiento marginal cae como
 * e^(-n/TAU). Calibrado contra tres anclas de la literatura:
 *
 * - Schoenfeld y Krieger (2017), dosis-respuesta: menos de 5 series por semana
 *   dan ES 0.24, de 5 a 9 dan 0.34, 10 o más dan 0.44. El salto grande está
 *   antes de 10 y se achica después. De ahí sale el piso: por debajo de 6 no
 *   es que no crezcas, es que dejás la mitad de la respuesta sin tocar.
 * - Baz-Valle (2022), revisión sistemática: 12 a 20 series por semana es donde
 *   se maximiza la hipertrofia en gente entrenada.
 * - Pelland (2026): sigue subiendo más allá de 20, pero tan poco que el costo
 *   en tiempo y en recuperación deja de valer la pena.
 *
 * De ahí salen los cuatro cortes. No son redondeos: son los puntos donde el
 * rendimiento marginal cruza un umbral.
 */
export const CURVA = {
  tau: 8,
  // Debajo de acá el volumen total no alcanza, por más que cada serie rinda
  // mucho: capturás menos de la mitad de la respuesta.
  piso: 6,
  // La zona donde conviene estar: del 71% al 92% de la respuesta alcanzable.
  optMin: 10,
  optMax: 20,
  // Pasado esto cada serie nueva rinde menos del 10% de lo que rendía la
  // primera. Sigue sumando, pero ya no compensa el tiempo ni la recuperación.
  decae: 20,
  // Menos del 3%: acá la curva es plana a efectos prácticos.
  plano: 28,
  // Hasta dónde se dibuja la escala.
  tope: 30,
};

/** Fracción de la respuesta alcanzable que capturás con n series semanales. */
export function fraccionCubierta(n) {
  return 1 - Math.exp(-Math.max(0, n) / CURVA.tau);
}

/**
 * Cuánto rinde la serie número n comparada con la primera. Es la derivada de la
 * curva, normalizada: el número que responde "¿vale la pena una serie más?".
 */
export function rendimientoMarginal(n) {
  return Math.exp(-Math.max(0, n) / CURVA.tau);
}

/** En qué zona de la curva cae un volumen semanal. */
export function zonaVolumen(n) {
  if (n < CURVA.piso) return 'insuficiente';
  if (n < CURVA.optMin) return 'creciendo';
  if (n <= CURVA.optMax) return 'optimo';
  if (n <= CURVA.plano) return 'decae';
  return 'plano';
}

export const ZONAS = [
  { id: 'insuficiente', desde: 0, hasta: CURVA.piso, label: 'No alcanza',
    detalle: 'Cada serie rinde mucho, pero el total no llega: capturás menos de la mitad de lo alcanzable.' },
  { id: 'creciendo', desde: CURVA.piso, hasta: CURVA.optMin, label: 'Crece, por debajo del óptimo',
    detalle: 'Ya es volumen que hace crecer, pero todavía te queda rendimiento barato sin usar.' },
  { id: 'optimo', desde: CURVA.optMin, hasta: CURVA.optMax, label: 'Óptimo',
    detalle: 'Del 71% al 92% de la respuesta alcanzable. Es donde conviene estar.' },
  { id: 'decae', desde: CURVA.optMax, hasta: CURVA.plano, label: 'Rinde poco',
    detalle: 'Sigue sumando, pero cada serie nueva rinde menos del 10% de lo que rendía la primera.' },
  { id: 'plano', desde: CURVA.plano, hasta: CURVA.tope, label: 'Rinde casi nada',
    detalle: 'Menos del 3%. A efectos prácticos la curva ya es plana.' },
];
