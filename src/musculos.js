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
  { id: 'hombro-anterior', label: 'Hombro anterior', prioridad: 2, objMin: 6, objMax: 10, recuperacion: 60,
    nota: 'Deliberadamente bajo. Recibe indirecto de cada press; sumarle trabajo directo le roba lugar al lateral y al posterior, que son los que faltan.' },

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
