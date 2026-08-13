// Modelo y datos iniciales.
//
// Decisiones de modelo:
// - El ejercicio es una entidad de catálogo con id estable. Renombrarlo no parte el historial.
// - La rutina versiona el armado y los parámetros, no el ejercicio. Versionado append-only.
// - Los días llevan el nombre que les pongas. La adherencia se mide contra un objetivo
//   de sesiones por semana, no contra días de la semana fijos.
// - En la lista de músculos de un ejercicio, el PRIMERO es el primario y cuenta una serie
//   entera; los demás son secundarios y cuentan media.

export const VERSION_DATOS = 2;

export const MUSCULOS = [
  { id: 'pecho', label: 'Pecho' },
  { id: 'dorsal', label: 'Dorsal' },
  { id: 'espalda-alta', label: 'Espalda alta' },
  { id: 'hombro-anterior', label: 'Hombro anterior' },
  { id: 'hombro-lateral', label: 'Hombro lateral' },
  { id: 'hombro-posterior', label: 'Hombro posterior' },
  { id: 'biceps', label: 'Bíceps' },
  { id: 'triceps', label: 'Tríceps' },
  { id: 'antebrazo', label: 'Antebrazo' },
  { id: 'cuadriceps', label: 'Cuádriceps' },
  { id: 'isquiotibiales', label: 'Isquiotibiales' },
  { id: 'gluteo', label: 'Glúteo' },
  { id: 'gemelos', label: 'Gemelos' },
];

const LABELS = Object.fromEntries(MUSCULOS.map(m => [m.id, m.label]));
export function labelMusculo(id) { return LABELS[id] || id; }

/** Rango semanal de series por músculo que se dibuja de referencia. */
export const RANGO_SERIES = [10, 20];

export const UMBRALES = { carga: 3, volumen: 3, musculos: 2, adherencia: 3 };

export function uid() {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
}

/**
 * @param tipo 'peso' | 'corporal' | 'asistido'
 *   asistido: el número de la máquina es la ayuda, así que menos es mejor.
 */
function ej(id, nombre, musculos, incremento, tipo, tips) {
  return { id, nombre, prim: musculos.slice(0, 1), sec: musculos.slice(1), incremento, tipo, tips: tips.join('\n') };
}

function it(ejercicioId, series, repsMin, repsMax, rirMin, rirMax, descanso) {
  return { ejercicioId, series, repsMin, repsMax, rirMin, rirMax, descanso };
}

const CATALOGO = [
  // ---------- lunes ----------
  ej('ex_press_banca', 'Press banca con barra',
    ['pecho', 'triceps', 'hombro-anterior'], 2.5, 'peso', [
    'Juntá y hundí los omóplatos contra el banco antes de sacar la barra. El pecho queda alto y el hombro deja de compensar.',
    'Bajá a la línea del pezón con los codos a unos 45° del torso, no abiertos a 90°.',
    'Pies firmes y cadera apoyada. Si tenés que despegar la cola, el peso está de más.',
    'Volviendo de un parate, quedate en RIR 2 real las primeras semanas: el manguito rotador es lo que te saca de la rutina, no el pecho.',
  ]),
  ej('ex_press_militar_mancuernas', 'Press militar sentado con mancuernas',
    ['hombro-anterior', 'hombro-lateral', 'triceps'], 2, 'peso', [
    'Respaldo casi vertical y costillas abajo: no arquees la lumbar para sacar la última repetición.',
    'Bajá hasta que el codo quede apenas por debajo del hombro. Más abajo no suma y estresa la articulación.',
    'Las mancuernas viajan levemente hacia adentro al subir, no en línea recta hacia afuera.',
  ]),
  ej('ex_press_inclinado_maquina', 'Press inclinado en máquina',
    ['pecho', 'hombro-anterior', 'triceps'], 5, 'peso', [
    'Ajustá el asiento para que las manijas queden a la altura de la parte alta del pecho.',
    'Frená un segundo en el punto más profundo en vez de rebotar.',
    'No bloquees el codo del todo arriba: perdés tensión.',
  ]),
  ej('ex_elevacion_lateral_polea', 'Elevación lateral en polea, unilateral',
    ['hombro-lateral'], 2.5, 'peso', [
    'Parate del lado opuesto a la polea: el cable cruza por delante del cuerpo y mantiene tensión abajo, que es donde la mancuerna la pierde.',
    'Codo levemente flexionado y fijo. El movimiento sale del hombro, no del codo.',
    'Subí hasta la línea del hombro. Más arriba entra el trapecio y el deltoides deja de trabajar.',
    'Si en las últimas repeticiones tirás el torso o encogés el hombro, no estás fallando de deltoides: bajá el peso.',
    'Si no hay peso intermedio en la torre: las dos primeras series pesadas en 8-12, y las dos últimas con la mitad de carga al fallo real.',
  ]),
  ej('ex_pushdown_barra', 'Extensión de tríceps en polea alta (barra)',
    ['triceps'], 5, 'peso', [
    'Barra recta o en V: permite más carga que la soga, y este es el ejercicio pesado de tríceps del día.',
    'Codos pegados al costado y quietos: solo se mueve el antebrazo.',
    'Torso apenas inclinado hacia adelante, no vertical, para que la polea quede alineada.',
    'Estirá del todo abajo y aguantá medio segundo.',
    'Si la barra recta te molesta la muñeca o el codo, pasate a la barra en V.',
  ]),
  ej('ex_triceps_overhead_soga', 'Extensión de tríceps sobre la cabeza en polea (soga)',
    ['triceps'], 2.5, 'peso', [
    'Con soga: el agarre neutro evita la torsión de muñeca que genera la barra recta con los brazos atrás de la cabeza.',
    'Alejate de la polea hasta sentir el estiramiento del tríceps.',
    'Codos apuntando al frente y cerrados, no abiertos a los costados.',
    'Es el ejercicio que más estira la porción larga: prioridad al rango, no al peso.',
  ]),

  // ---------- miércoles ----------
  ej('ex_jalon_pecho', 'Jalón al pecho, agarre neutro',
    ['dorsal', 'biceps', 'espalda-alta'], 5, 'peso', [
    'Empezá bajando el hombro antes de doblar el codo. Si arrancás tirando con el brazo, trabaja el bíceps.',
    'Llevá la barra a la clavícula con el pecho arriba, sin tirarte para atrás.',
    'Soltá controlado hasta sentir el estiramiento del dorsal, no dejes que te levante del asiento.',
  ]),
  ej('ex_remo_maquina', 'Remo en máquina con apoyo pectoral',
    ['espalda-alta', 'dorsal', 'biceps', 'hombro-posterior'], 5, 'peso', [
    'Sirve igual la T-bar SI tiene apoyo pectoral. La T-bar tipo landmine (parado, inclinado, barra anclada al piso) no: ahí el torso lo sostiene la espalda baja.',
    'Pecho pegado al apoyo todo el recorrido: si se despega, estás usando la espalda baja.',
    'Codos rozando el torso, tirá hacia la cadera y no hacia arriba.',
    'Un segundo de pausa con los omóplatos juntos antes de soltar.',
  ]),
  ej('ex_jalon_unilateral', 'Jalón unilateral en polea alta',
    ['dorsal', 'biceps'], 2.5, 'peso', [
    'Sentado o arrodillado frente a la polea, con una sola manija. Cada lado por separado empareja diferencias entre lados.',
    'Dejá que el hombro suba y el omóplato se abra arriba: ese estiramiento extra es la razón de hacerlo unilateral.',
    'Tirá hacia el costado de las costillas, no hacia el pecho, y bajá el hombro antes de doblar el codo.',
    'No rotes el torso para ganar rango: la mano libre agarrada al asiento o al armazón.',
    'Igualá repeticiones entre lados, no peso. Arrancá siempre por el lado más débil.',
  ]),
  ej('ex_pullover_polea', 'Pull-over en polea alta',
    ['dorsal'], 2.5, 'peso', [
    'Codos semi rígidos todo el movimiento. Si se doblan, se convierte en un jalón.',
    'Cadera atrás y torso inclinado: buscá que el dorsal quede estirado arriba.',
    'Bajá hasta los muslos y frená ahí.',
  ]),
  ej('ex_curl_mancuernas', 'Curl con mancuernas alterno',
    ['biceps'], 2, 'peso', [
    'Codo fijo al costado del torso: si viaja hacia adelante, entra el hombro.',
    'Supiná (girá la palma hacia arriba) mientras subís, no antes.',
    'Bajá en 2 segundos. La fase negativa es la mitad del estímulo.',
  ]),
  ej('ex_curl_martillo', 'Curl martillo con mancuernas',
    ['biceps', 'antebrazo'], 2, 'peso', [
    'Palmas enfrentadas todo el recorrido, sin rotar.',
    'Trabaja el braquial y el braquiorradial: es lo que te engrosa el brazo visto de costado.',
    'Nada de balanceo del torso, aunque sea la última serie.',
  ]),

  // ---------- viernes ----------
  ej('ex_prensa', 'Prensa 45°',
    ['cuadriceps', 'gluteo', 'isquiotibiales'], 5, 'peso', [
    'Pies al ancho de hombros, a media altura de la plataforma.',
    'Bajá hasta donde la cadera se mantenga apoyada. Si la cola se despega, se te redondea la lumbar.',
    'No bloquees las rodillas arriba.',
  ]),
  ej('ex_prensa_unilateral', 'Prensa unilateral o hack machine',
    ['cuadriceps', 'gluteo'], 5, 'peso', [
    'Arrancá siempre por la pierna más débil y igualá las repeticiones con la otra.',
    'Rodilla siguiendo la línea del pie, sin caer hacia adentro.',
    'Rango completo antes que carga: la profundidad es lo que hace crecer el cuádriceps.',
  ]),
  ej('ex_curl_femoral', 'Curl femoral',
    ['isquiotibiales'], 5, 'peso', [
    'Cadera pegada al apoyo, sin levantarla para completar la repetición.',
    'El eje de la máquina tiene que coincidir con la rodilla.',
    'Bajá lento: el isquiotibial se lesiona en la fase excéntrica, entrenarlo ahí lo protege.',
  ]),
  ej('ex_extension_cuadriceps', 'Extensión de cuádriceps',
    ['cuadriceps'], 5, 'peso', [
    'Estirá del todo arriba y aguantá un segundo apretando.',
    'Espalda apoyada, sin tirar el torso hacia atrás para ayudarte.',
    'Si molesta la rodilla, acortá el rango de abajo, no el de arriba.',
  ]),
  ej('ex_gemelos', 'Gemelos en máquina',
    ['gemelos'], 5, 'peso', [
    'Bajá el talón todo lo que dé y aguantá dos segundos abajo.',
    'Subí hasta la punta del pie, sin rebotar.',
    'El gemelo responde al rango y a la pausa, no al peso.',
  ]),
  ej('ex_face_pull', 'Face pull en polea',
    ['hombro-posterior', 'espalda-alta'], 2.5, 'peso', [
    'Polea a la altura de la cara. Tirá hacia la frente separando las manos.',
    'Terminá con los codos altos y las manos atrás de la línea de la oreja.',
    'Es trabajo de salud del hombro: peso liviano, ejecución impecable.',
  ]),

  // ---------- sábado ----------
  ej('ex_elevacion_lateral_maquina', 'Elevación lateral en máquina',
    ['hombro-lateral'], 2.5, 'peso', [
    'Si no hay máquina, polea unilateral. Distinto implemento que el lunes para variar el perfil de resistencia.',
    'Almohadilla apoyada en el brazo, no en el codo.',
    'Subí hasta la línea del hombro y controlá la bajada.',
  ]),
  ej('ex_press_hombro_maquina', 'Press de hombro en máquina',
    ['hombro-anterior', 'hombro-lateral', 'triceps'], 5, 'peso', [
    'Asiento regulado para que las manijas queden a la altura del hombro, no arriba.',
    'Bajá hasta el hombro y frená ahí.',
    'Costillas abajo, sin arquear la lumbar.',
  ]),
  ej('ex_curl_predicador', 'Curl predicador',
    ['biceps'], 2.5, 'peso', [
    'Axila apoyada firme contra el respaldo, hombro por delante del codo.',
    'No estires del todo el codo abajo si es la primera vez que lo hacés: entrá al rango completo de a poco.',
    'Es la posición donde el bíceps queda más estirado, por eso pega tanto.',
  ]),
  ej('ex_curl_polea_baja', 'Curl en polea baja con barra',
    ['biceps'], 2.5, 'peso', [
    'Un paso atrás de la polea para que haya tensión desde la primera repetición.',
    'Codos pegados y quietos.',
    'Bajá controlado hasta estirar, sin dejar que la torre te tire del brazo.',
  ]),
  ej('ex_fondos_asistidos', 'Fondos en máquina asistida',
    ['triceps', 'pecho', 'hombro-anterior'], 5, 'asistido', [
    'Torso vertical para cargar el tríceps. Inclinado adelante pasa a ser pecho.',
    'Bajá hasta que el codo llegue a 90° y no más, sobre todo volviendo de un parate.',
    'Hombros lejos de las orejas todo el recorrido.',
    'Acá el número es la ayuda de la máquina: bajarlo es progresar.',
  ]),
  ej('ex_triceps_unilateral_polea', 'Extensión de tríceps unilateral en polea',
    ['triceps'], 2.5, 'peso', [
    'Agarre supino (palma hacia arriba) para pegarle a la porción lateral.',
    'El codo no se mueve del costado.',
    'Sirve para emparejar diferencias entre brazos: igualá repeticiones, no peso.',
  ]),
];

export function semillaInicial() {
  const ejercicios = {};
  for (const e of CATALOGO) ejercicios[e.id] = JSON.parse(JSON.stringify(e));

  const ts = Date.now();
  const dia = (id, nombre, foco, items) => ({
    id, nombre, foco, versionActual: 1,
    versiones: [{ n: 1, ts, nota: 'Rutina inicial', items }],
  });

  const dias = [
    dia('d_lun', 'Lunes', 'Pecho / hombro / tríceps', [
      it('ex_press_banca', 4, 6, 10, 2, 2, 120),
      it('ex_press_militar_mancuernas', 3, 8, 12, 2, 2, 120),
      it('ex_press_inclinado_maquina', 3, 10, 12, 1, 2, 90),
      it('ex_elevacion_lateral_polea', 4, 8, 12, 1, 1, 60),
      it('ex_pushdown_barra', 3, 10, 12, 1, 1, 60),
      it('ex_triceps_overhead_soga', 2, 12, 15, 0, 1, 45),
    ]),
    dia('d_mie', 'Miércoles', 'Espalda / bíceps', [
      it('ex_jalon_pecho', 4, 8, 12, 2, 2, 120),
      it('ex_remo_maquina', 4, 8, 12, 2, 2, 120),
      it('ex_jalon_unilateral', 3, 10, 12, 1, 2, 90),
      it('ex_pullover_polea', 3, 12, 15, 1, 1, 60),
      it('ex_curl_mancuernas', 3, 10, 12, 1, 1, 60),
      it('ex_curl_martillo', 3, 12, 15, 0, 1, 45),
    ]),
    dia('d_vie', 'Viernes', 'Piernas + hombro posterior', [
      it('ex_prensa', 4, 10, 15, 2, 2, 120),
      it('ex_prensa_unilateral', 3, 10, 12, 2, 2, 90),
      it('ex_curl_femoral', 4, 10, 15, 1, 1, 75),
      it('ex_extension_cuadriceps', 3, 12, 15, 1, 1, 60),
      it('ex_gemelos', 4, 12, 20, 0, 1, 45),
      it('ex_face_pull', 3, 15, 20, 1, 1, 45),
    ]),
    dia('d_sab', 'Sábado', 'Brazos + hombros (opcional)', [
      it('ex_elevacion_lateral_maquina', 4, 12, 20, 1, 1, 60),
      it('ex_press_hombro_maquina', 3, 10, 12, 2, 2, 90),
      it('ex_curl_predicador', 3, 10, 12, 1, 1, 75),
      it('ex_curl_polea_baja', 3, 12, 15, 0, 1, 45),
      it('ex_fondos_asistidos', 3, 8, 12, 2, 2, 90),
      it('ex_triceps_unilateral_polea', 3, 12, 15, 0, 1, 45),
    ]),
  ];

  return {
    v: VERSION_DATOS,
    mtime: ts,
    // El sábado es opcional, así que el objetivo semanal arranca en 3. Editable en Rutina.
    rutina: { dias, objetivoSemanal: 3 },
    ejercicios,
    sesiones: [],
    sesionAbierta: null,
    meta: { ultimoExport: null, creado: ts },
  };
}

// ---------- formato ----------

export function fRango(min, max) {
  return min === max ? String(min) : `${min}-${max}`;
}

/** Etiqueta del esfuerzo objetivo, o null si el ejercicio no declara uno. */
export function fEsfuerzo(min, max) {
  if (min == null) return null;
  return `${fRango(min, max ?? min)} en el tanque`;
}

/** 'Peso' para la mayoría, 'Asistencia' para las máquinas que te ayudan. */
export function etiquetaCarga(ej) {
  if (ej?.tipo === 'asistido') return 'Asistencia';
  if (ej?.tipo === 'corporal') return 'Lastre';
  return 'Peso';
}

// ---------- selectores ----------

export function diaPorId(db, id) { return db.rutina.dias.find(d => d.id === id); }

export function versionActual(dia) {
  return dia.versiones.find(v => v.n === dia.versionActual) || dia.versiones[dia.versiones.length - 1];
}

export function versionN(dia, n) { return dia.versiones.find(v => v.n === n); }

export function nombreEj(db, id) { return db.ejercicios[id]?.nombre ?? 'Ejercicio'; }

export function sesionesTerminadas(db) {
  return db.sesiones.filter(s => s.fin).sort((a, b) => b.inicio - a.inicio);
}

/**
 * Peso y reps con que arranca una serie: los de la MISMA serie de la última
 * sesión donde se hizo ese ejercicio. Si esa serie no existía, la última que sí.
 */
export function precarga(db, ejercicioId, serieIdx) {
  for (const s of sesionesTerminadas(db)) {
    const hechas = s.sets.filter(x => x.ejercicioId === ejercicioId && x.estado === 'hecha');
    if (!hechas.length) continue;
    const exacta = hechas.find(x => x.serieIdx === serieIdx);
    const elegida = exacta || hechas[hechas.length - 1];
    return { peso: elegida.peso, reps: elegida.reps, deSerie: elegida.serieIdx, fecha: s.inicio };
  }
  return null;
}

/** Todas las series hechas de un ejercicio, de la más vieja a la más nueva. */
export function historialEj(db, ejercicioId) {
  const out = [];
  for (const s of db.sesiones) {
    if (!s.fin) continue;
    for (const x of s.sets) {
      if (x.ejercicioId === ejercicioId && x.estado === 'hecha') {
        out.push({ ...x, sesionId: s.id, fecha: s.inicio });
      }
    }
  }
  return out.sort((a, b) => a.fecha - b.fecha || a.serieIdx - b.serieIdx);
}

/**
 * El registro tope. En las máquinas asistidas "mejor" es MENOS carga,
 * así que ahí devuelve el mínimo: mostrar el máximo sería mentir.
 */
export function maximoEj(db, ejercicioId) {
  const h = historialEj(db, ejercicioId);
  if (!h.length) return null;
  const asistido = db.ejercicios[ejercicioId]?.tipo === 'asistido';
  return h.reduce((m, x) => ((asistido ? x.peso < m.peso : x.peso > m.peso) ? x : m), h[0]);
}

export function ultimoEj(db, ejercicioId) {
  const h = historialEj(db, ejercicioId);
  return h.length ? h[h.length - 1] : null;
}

/** Lunes 00:00 local de la semana de ts. */
export function inicioSemana(ts) {
  const d = new Date(ts);
  d.setHours(0, 0, 0, 0);
  const dow = (d.getDay() + 6) % 7; // lunes = 0
  d.setDate(d.getDate() - dow);
  return d.getTime();
}

/** Series efectivas por músculo: el primario suma 1, cada secundario 0.5. */
export function seriesPorMusculo(db, desde, hasta) {
  const acc = {};
  for (const s of db.sesiones) {
    if (!s.fin || s.inicio < desde || s.inicio >= hasta) continue;
    for (const x of s.sets) {
      if (x.estado !== 'hecha') continue;
      const e = db.ejercicios[x.ejercicioId];
      if (!e) continue;
      for (const m of e.prim || []) acc[m] = (acc[m] || 0) + 1;
      for (const m of e.sec || []) acc[m] = (acc[m] || 0) + 0.5;
    }
  }
  return acc;
}

export function semanasEntrenadas(db, cantidad) {
  const hoy = inicioSemana(Date.now());
  const out = [];
  for (let i = cantidad - 1; i >= 0; i--) {
    const desde = hoy - i * 7 * 864e5;
    const hasta = desde + 7 * 864e5;
    const n = db.sesiones.filter(s =>
      s.fin && s.inicio >= desde && s.inicio < hasta && s.sets.some(x => x.estado === 'hecha')
    ).length;
    out.push({ desde, n });
  }
  return out;
}

/** Cuántas semanas completas de datos hay, para los umbrales de los gráficos. */
export function semanasConDatos(db) {
  const ss = db.sesiones.filter(s => s.fin);
  if (!ss.length) return 0;
  const primera = inicioSemana(Math.min(...ss.map(s => s.inicio)));
  return Math.floor((inicioSemana(Date.now()) - primera) / (7 * 864e5)) + 1;
}

export function sesionesConEj(db, ejercicioId) {
  return new Set(historialEj(db, ejercicioId).map(x => x.sesionId)).size;
}
