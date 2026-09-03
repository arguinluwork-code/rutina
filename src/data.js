// Modelo y datos iniciales.
//
// Decisiones de modelo:
// - MOVIMIENTO (db.ejercicios): la entidad estable. "Elevación lateral" es un
//   movimiento; declara qué músculos trabaja y sus tips. Su id no cambia nunca.
// - VARIANTE (db.variantes): cómo lo hacés. Polea, mancuernas, máquina. Cada
//   variante lleva SU PROPIO peso, siempre crudo, nunca convertido: 12 kg de
//   mancuerna y 12 kg de polea no son lo mismo y guardarlos como si lo fueran
//   sería mentir. El `factor` se usa solo al graficar, para poder comparar la
//   progresión del movimiento entre variantes.
// - PLANTILLA: un entrenamiento armado, sin día de la semana. Elegís cuál hacer.
//   Lo que guía es el volumen semanal por músculo, no el calendario, y eso tiene
//   respaldo: con el volumen igualado, la frecuencia casi no mueve la hipertrofia.
// - Las plantillas se versionan append-only: editar es un borrador, guardar
//   crea una versión con fecha.

import { MUSCULOS, musculo, labelMusculo, UMBRAL_ESTIMULO } from './musculos.js';
export { MUSCULOS, musculo, labelMusculo, UMBRAL_ESTIMULO };

export const VERSION_DATOS = 4;

/** Salto de carga por tap. Editable por variante. */
export const PASO = 2.5;

export const UMBRALES = { carga: 3, volumen: 3, musculos: 2, adherencia: 3 };

export function uid() {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
}

// ---------- catálogo ----------

function mov(id, nombre, musculos, tips) {
  return { id, nombre, prim: musculos.slice(0, 1), sec: musculos.slice(1), tips: tips.join('\n') };
}

/**
 * @param factor equivalencia aproximada contra la variante de referencia del
 *   movimiento (1 = la referencia). Solo se usa para comparar en los gráficos,
 *   nunca para precargar un peso convertido.
 */
function va(id, ejercicioId, nombre, opts = {}) {
  const { tipo = 'peso', incremento = PASO, factor = 1, nota = '' } = opts;
  return { id, ejercicioId, nombre, tipo, incremento, factor, nota, ultimo: null };
}

const MOVIMIENTOS = [
  mov('ex_press_banca', 'Press banca', ['pecho', 'triceps', 'hombro-anterior'], [
    'Juntá y hundí los omóplatos contra el banco antes de sacar la barra. El pecho queda alto y el hombro deja de compensar.',
    'Bajá a la línea del pezón con los codos a unos 45 grados del torso, no abiertos a 90.',
    'Pies firmes y cadera apoyada. Si tenés que despegar la cola, el peso está de más.',
    'Volviendo de un parate, quedate en RIR 2 real las primeras semanas: el manguito rotador es lo que te saca de la rutina, no el pecho.',
  ]),
  mov('ex_press_inclinado', 'Press inclinado', ['pecho', 'hombro-anterior', 'triceps'], [
    'Banco entre 30 y 45 grados. Más inclinado pasa a ser press de hombro.',
    'Ajustá el asiento para que las manijas queden a la altura de la parte alta del pecho.',
    'Frená un segundo en el punto más profundo en vez de rebotar.',
    'No bloquees el codo del todo arriba: perdés tensión.',
  ]),
  mov('ex_press_hombro', 'Press de hombro', ['hombro-anterior', 'hombro-lateral', 'triceps'], [
    'Asiento regulado para que las manijas queden a la altura del hombro, no arriba.',
    'Costillas abajo, sin arquear la lumbar para sacar la última repetición.',
    'Bajá hasta que el codo quede apenas por debajo del hombro. Más abajo no suma y estresa la articulación.',
  ]),
  mov('ex_elevacion_lateral', 'Elevación lateral', ['hombro-lateral'], [
    'Codo levemente flexionado y fijo. El movimiento sale del hombro, no del codo.',
    'Subí hasta la línea del hombro. Más arriba entra el trapecio y el deltoides deja de trabajar.',
    'Si en las últimas repeticiones tirás el torso o encogés el hombro, no estás fallando de deltoides: bajá el peso.',
    'Es el ejercicio de mayor retorno de tu rutina: el lateral no recibe casi nada indirecto de los press.',
  ]),
  mov('ex_pushdown', 'Extensión de tríceps en polea alta', ['triceps'], [
    'Codos pegados al costado y quietos: solo se mueve el antebrazo.',
    'Torso apenas inclinado hacia adelante, no vertical, para que la polea quede alineada.',
    'Estirá del todo abajo y aguantá medio segundo.',
    'Si la barra recta te molesta la muñeca o el codo, pasate a la barra en V.',
  ]),
  mov('ex_triceps_overhead', 'Extensión de tríceps sobre la cabeza', ['triceps'], [
    'Con soga el agarre neutro evita la torsión de muñeca que genera la barra recta con los brazos atrás de la cabeza.',
    'Alejate de la polea hasta sentir el estiramiento del tríceps.',
    'Codos apuntando al frente y cerrados, no abiertos a los costados.',
    'Es el que más estira la porción larga: prioridad al rango, no al peso.',
  ]),
  mov('ex_triceps_unilateral', 'Extensión de tríceps unilateral', ['triceps'], [
    'Agarre supino, palma hacia arriba, para pegarle a la porción lateral.',
    'El codo no se mueve del costado.',
    'Sirve para emparejar diferencias entre brazos: igualá repeticiones, no peso.',
  ]),
  mov('ex_fondos', 'Fondos', ['triceps', 'pecho', 'hombro-anterior'], [
    'Torso vertical para cargar el tríceps. Inclinado adelante pasa a ser pecho.',
    'Bajá hasta que el codo llegue a 90 grados y no más, sobre todo volviendo de un parate.',
    'Hombros lejos de las orejas todo el recorrido.',
  ]),

  mov('ex_jalon', 'Jalón al pecho', ['dorsal', 'biceps', 'espalda-alta'], [
    'Empezá bajando el hombro antes de doblar el codo. Si arrancás tirando con el brazo, trabaja el bíceps.',
    'Llevá la barra a la clavícula con el pecho arriba, sin tirarte para atrás.',
    'Soltá controlado hasta sentir el estiramiento del dorsal, no dejes que te levante del asiento.',
  ]),
  mov('ex_remo_maquina', 'Remo con apoyo pectoral', ['espalda-alta', 'dorsal', 'biceps', 'hombro-posterior'], [
    'Sirve igual la T-bar si tiene apoyo pectoral. La T-bar tipo landmine no: ahí el torso lo sostiene la espalda baja.',
    'Pecho pegado al apoyo todo el recorrido: si se despega, estás usando la espalda baja.',
    'Codos rozando el torso, tirá hacia la cadera y no hacia arriba.',
    'Un segundo de pausa con los omóplatos juntos antes de soltar.',
  ]),
  mov('ex_jalon_unilateral', 'Jalón unilateral', ['dorsal', 'biceps'], [
    'Sentado o arrodillado frente a la polea, con una sola manija.',
    'Dejá que el hombro suba y el omóplato se abra arriba: ese estiramiento extra es la razón de hacerlo unilateral.',
    'Tirá hacia el costado de las costillas, no hacia el pecho.',
    'Igualá repeticiones entre lados, no peso. Arrancá siempre por el lado más débil.',
  ]),
  mov('ex_pullover', 'Pull-over en polea alta', ['dorsal'], [
    'Codos semi rígidos todo el movimiento. Si se doblan, se convierte en un jalón.',
    'Cadera atrás y torso inclinado: buscá que el dorsal quede estirado arriba.',
    'Bajá hasta los muslos y frená ahí.',
  ]),
  mov('ex_curl', 'Curl de bíceps', ['biceps'], [
    'Codo fijo al costado del torso: si viaja hacia adelante, entra el hombro.',
    'Supiná, girá la palma hacia arriba, mientras subís y no antes.',
    'Bajá en 2 segundos. La fase negativa es la mitad del estímulo.',
  ]),
  mov('ex_curl_martillo', 'Curl martillo', ['biceps', 'antebrazo'], [
    'Palmas enfrentadas todo el recorrido, sin rotar.',
    'Trabaja el braquial y el braquiorradial: es lo que te engrosa el brazo visto de costado.',
    'Nada de balanceo del torso, aunque sea la última serie.',
  ]),
  mov('ex_curl_predicador', 'Curl predicador', ['biceps'], [
    'Axila apoyada firme contra el respaldo, hombro por delante del codo.',
    'No estires del todo el codo abajo si es la primera vez que lo hacés: entrá al rango completo de a poco.',
    'Es la posición donde el bíceps queda más estirado, por eso pega tanto.',
  ]),
  mov('ex_face_pull', 'Face pull', ['hombro-posterior', 'espalda-alta'], [
    'Polea a la altura de la cara. Tirá hacia la frente separando las manos.',
    'Terminá con los codos altos y las manos atrás de la línea de la oreja.',
    'Peso liviano y ejecución impecable: es volumen para el posterior y salud del hombro a la vez.',
  ]),
  mov('ex_posterior', 'Pec deck inverso', ['hombro-posterior', 'espalda-alta'], [
    'Pecho apoyado, brazos casi extendidos con el codo apenas blando.',
    'Abrí llevando los codos hacia atrás, no las manos: si tirás con la mano entra el bíceps.',
    'Sin encoger el hombro. Si lo sentís en el trapecio, bajá el peso.',
  ]),

  mov('ex_prensa', 'Prensa 45', ['cuadriceps', 'gluteo', 'isquiotibiales'], [
    'Pies al ancho de hombros, a media altura de la plataforma.',
    'Bajá hasta donde la cadera se mantenga apoyada. Si la cola se despega, se te redondea la lumbar.',
    'No bloquees las rodillas arriba.',
  ]),
  mov('ex_hack', 'Hack o prensa unilateral', ['cuadriceps', 'gluteo'], [
    'Arrancá siempre por la pierna más débil y igualá las repeticiones con la otra.',
    'Rodilla siguiendo la línea del pie, sin caer hacia adentro.',
    'Rango completo antes que carga: la profundidad es lo que hace crecer el cuádriceps.',
  ]),
  mov('ex_curl_femoral', 'Curl femoral', ['isquiotibiales'], [
    'Cadera pegada al apoyo, sin levantarla para completar la repetición.',
    'El eje de la máquina tiene que coincidir con la rodilla.',
    'Bajá lento: el isquiotibial se lesiona en la fase excéntrica, entrenarlo ahí lo protege.',
  ]),
  mov('ex_extension_cuadriceps', 'Extensión de cuádriceps', ['cuadriceps'], [
    'Estirá del todo arriba y aguantá un segundo apretando.',
    'Espalda apoyada, sin tirar el torso hacia atrás para ayudarte.',
    'Si molesta la rodilla, acortá el rango de abajo, no el de arriba.',
  ]),
  mov('ex_rumano', 'Peso muerto rumano', ['isquiotibiales', 'gluteo', 'lumbar'], [
    'La cadera va para atrás y la barra pegada a la pierna.',
    'Bajá hasta sentir el femoral, no más. No es un peso muerto convencional.',
    'Espalda neutra todo el recorrido.',
  ]),
  mov('ex_gemelos', 'Gemelos en máquina', ['gemelos'], [
    'Bajá el talón todo lo que dé y aguantá dos segundos abajo.',
    'Subí hasta la punta del pie, sin rebotar.',
    'El gemelo responde al rango y a la pausa, no al peso.',
  ]),
  mov('ex_abdomen', 'Crunch en polea', ['abdomen'], [
    'Arrodillado frente a la polea, el movimiento es acercar las costillas a la pelvis.',
    'No tires con los brazos ni con la cadera: si el codo se aleja de la cabeza, estás haciendo otra cosa.',
    'Exhalá al cerrar y aguantá un segundo abajo.',
  ]),
];

const VARIANTES = [
  va('v_banca_barra', 'ex_press_banca', 'Barra'),
  va('v_banca_mancuernas', 'ex_press_banca', 'Mancuernas', { factor: 0.85, nota: 'Peso por mancuerna' }),

  va('v_inclinado_maquina', 'ex_press_inclinado', 'Máquina'),
  va('v_inclinado_mancuernas', 'ex_press_inclinado', 'Mancuernas', { factor: 0.55, nota: 'Peso por mancuerna' }),

  va('v_presshombro_maquina', 'ex_press_hombro', 'Máquina'),
  va('v_presshombro_mancuernas', 'ex_press_hombro', 'Mancuernas sentado', { factor: 0.5, nota: 'Peso por mancuerna' }),

  va('v_lateral_polea', 'ex_elevacion_lateral', 'Polea unilateral', {
    nota: 'Parate del lado opuesto a la polea: el cable cruza por delante y mantiene tensión abajo, que es donde la mancuerna la pierde.' }),
  va('v_lateral_maquina', 'ex_elevacion_lateral', 'Máquina', { factor: 1.6 }),
  va('v_lateral_mancuernas', 'ex_elevacion_lateral', 'Mancuernas', { factor: 1.15, nota: 'Peso por mancuerna' }),

  va('v_pushdown_barra', 'ex_pushdown', 'Barra recta'),
  va('v_pushdown_v', 'ex_pushdown', 'Barra en V'),
  va('v_pushdown_soga', 'ex_pushdown', 'Soga', { factor: 0.85 }),

  va('v_overhead_soga', 'ex_triceps_overhead', 'Soga'),
  va('v_triuni_polea', 'ex_triceps_unilateral', 'Polea, agarre supino'),

  va('v_fondos_asistida', 'ex_fondos', 'Máquina asistida', { tipo: 'asistido',
    nota: 'El número es la ayuda de la máquina: bajarlo es progresar.' }),
  va('v_fondos_paralelas', 'ex_fondos', 'Paralelas', { tipo: 'corporal', nota: 'Lastre, o 0 con el peso del cuerpo' }),

  va('v_jalon_neutro', 'ex_jalon', 'Agarre neutro'),
  va('v_jalon_prono', 'ex_jalon', 'Agarre prono ancho', { factor: 0.95 }),
  va('v_remo_maquina', 'ex_remo_maquina', 'Máquina'),
  va('v_remo_tbar', 'ex_remo_maquina', 'T-bar con apoyo'),
  va('v_jalonuni_polea', 'ex_jalon_unilateral', 'Polea alta'),
  va('v_pullover_polea', 'ex_pullover', 'Polea alta'),

  va('v_curl_mancuernas', 'ex_curl', 'Mancuernas alterno', { nota: 'Peso por mancuerna' }),
  va('v_curl_polea', 'ex_curl', 'Polea baja con barra', { factor: 2.1 }),
  va('v_curl_barraz', 'ex_curl', 'Barra Z', { factor: 2.2 }),
  va('v_martillo_mancuernas', 'ex_curl_martillo', 'Mancuernas'),
  va('v_predicador_maquina', 'ex_curl_predicador', 'Máquina'),
  va('v_predicador_barraz', 'ex_curl_predicador', 'Barra Z'),

  va('v_facepull_polea', 'ex_face_pull', 'Polea con soga'),
  va('v_posterior_maquina', 'ex_posterior', 'Máquina'),
  va('v_posterior_polea', 'ex_posterior', 'Poleas cruzadas', { factor: 0.7 }),

  va('v_prensa_45', 'ex_prensa', 'Prensa 45'),
  va('v_hack_maquina', 'ex_hack', 'Hack'),
  va('v_hack_unilateral', 'ex_hack', 'Prensa unilateral', { factor: 0.6 }),
  va('v_femoral_acostado', 'ex_curl_femoral', 'Acostado'),
  va('v_femoral_sentado', 'ex_curl_femoral', 'Sentado', { factor: 1.1 }),
  va('v_cuadriceps_maquina', 'ex_extension_cuadriceps', 'Máquina'),
  va('v_rumano_barra', 'ex_rumano', 'Barra'),
  va('v_gemelos_maquina', 'ex_gemelos', 'Máquina de pie'),
  va('v_abdomen_polea', 'ex_abdomen', 'Polea alta arrodillado'),
];

function it(ejercicioId, varianteId, series, repsMin, repsMax, rirMin, rirMax, descanso) {
  return { ejercicioId, varianteId, series, repsMin, repsMax, rirMin, rirMax, descanso };
}

/**
 * Las cuatro plantillas están calculadas para caer dentro de los objetivos
 * semanales haciendo una vez cada una, con 22 series por sesión.
 */
function plantillasIniciales(ts) {
  const p = (id, nombre, foco, items) => ({
    id, nombre, foco, versionActual: 1,
    versiones: [{ n: 1, ts, nota: 'Plantilla inicial', items }],
  });
  return [
    p('pl_empuje', 'Empuje', 'Pecho, tríceps y hombro', [
      it('ex_press_banca', 'v_banca_barra', 4, 6, 10, 2, 2, 120),
      it('ex_press_inclinado', 'v_inclinado_maquina', 4, 10, 12, 1, 2, 90),
      it('ex_elevacion_lateral', 'v_lateral_polea', 6, 10, 15, 1, 1, 60),
      it('ex_pushdown', 'v_pushdown_barra', 4, 10, 12, 1, 1, 60),
      it('ex_face_pull', 'v_facepull_polea', 4, 15, 20, 1, 1, 45),
    ]),
    p('pl_tiron', 'Tirón', 'Espalda y bíceps', [
      it('ex_jalon', 'v_jalon_neutro', 4, 8, 12, 2, 2, 120),
      it('ex_remo_maquina', 'v_remo_maquina', 4, 8, 12, 2, 2, 120),
      it('ex_jalon_unilateral', 'v_jalonuni_polea', 4, 10, 12, 1, 2, 90),
      it('ex_curl', 'v_curl_polea', 4, 10, 12, 1, 1, 60),
      it('ex_curl_martillo', 'v_martillo_mancuernas', 3, 12, 15, 0, 1, 45),
      it('ex_elevacion_lateral', 'v_lateral_mancuernas', 3, 12, 20, 0, 1, 45),
    ]),
    p('pl_brazos', 'Brazos y hombros', 'La prioridad de la rutina', [
      it('ex_elevacion_lateral', 'v_lateral_maquina', 6, 12, 20, 1, 1, 60),
      it('ex_press_hombro', 'v_presshombro_maquina', 3, 10, 12, 2, 2, 90),
      it('ex_curl_predicador', 'v_predicador_maquina', 4, 10, 12, 1, 1, 75),
      it('ex_triceps_overhead', 'v_overhead_soga', 4, 12, 15, 0, 1, 45),
      it('ex_posterior', 'v_posterior_maquina', 3, 15, 20, 1, 1, 45),
      it('ex_triceps_unilateral', 'v_triuni_polea', 2, 12, 15, 0, 1, 45),
    ]),
    p('pl_piernas', 'Piernas y core', 'Mantenimiento', [
      it('ex_prensa', 'v_prensa_45', 4, 10, 15, 2, 2, 120),
      it('ex_hack', 'v_hack_maquina', 4, 10, 12, 2, 2, 90),
      it('ex_curl_femoral', 'v_femoral_acostado', 4, 10, 15, 1, 1, 75),
      it('ex_gemelos', 'v_gemelos_maquina', 4, 12, 20, 0, 1, 45),
      it('ex_abdomen', 'v_abdomen_polea', 3, 12, 20, 1, 1, 45),
      it('ex_curl', 'v_curl_mancuernas', 3, 10, 12, 1, 1, 60),
    ]),
  ];
}

export function semillaInicial() {
  const ts = Date.now();
  const ejercicios = {};
  for (const m of MOVIMIENTOS) ejercicios[m.id] = JSON.parse(JSON.stringify(m));
  const variantes = {};
  for (const v of VARIANTES) variantes[v.id] = JSON.parse(JSON.stringify(v));

  return {
    v: VERSION_DATOS,
    mtime: ts,
    ejercicios,
    variantes,
    plantillas: plantillasIniciales(ts),
    // 4 sesiones es el techo cómodo; con 3 igual se llega a los mínimos.
    config: { objetivoSemanal: 4, maxSeriesSesion: 24 },
    sesiones: [],
    sesionAbierta: null,
    meta: { ultimoExport: null, creado: ts },
  };
}

// ---------- formato ----------

export function fRango(min, max) {
  return min === max ? String(min) : `${min}-${max}`;
}

export function fEsfuerzo(min, max) {
  if (min == null) return null;
  return `${fRango(min, max ?? min)} en el tanque`;
}

export function etiquetaCarga(vr) {
  if (vr?.tipo === 'asistido') return 'Asistencia';
  if (vr?.tipo === 'corporal') return 'Lastre';
  return 'Peso';
}

// ---------- selectores básicos ----------

export function plantillaPorId(db, id) { return db.plantillas.find(p => p.id === id); }

export function versionActual(pl) {
  return pl.versiones.find(v => v.n === pl.versionActual) || pl.versiones[pl.versiones.length - 1];
}

export function itemsDe(db, plantillaId) {
  const pl = plantillaPorId(db, plantillaId);
  return pl ? versionActual(pl).items : [];
}

export function nombreEj(db, id) { return db.ejercicios[id]?.nombre ?? 'Ejercicio'; }

export function variante(db, id) { return db.variantes[id] || null; }

export function variantesDe(db, ejercicioId) {
  return Object.values(db.variantes).filter(v => v.ejercicioId === ejercicioId);
}

/** "Elevación lateral · Máquina", o solo el movimiento si tiene una sola variante. */
export function nombreCompleto(db, ejercicioId, varianteId) {
  const m = db.ejercicios[ejercicioId];
  const v = db.variantes[varianteId];
  if (!m) return 'Ejercicio';
  if (!v || variantesDe(db, ejercicioId).length < 2) return m.nombre;
  return `${m.nombre} · ${v.nombre}`;
}

export function sesionesTerminadas(db) {
  return db.sesiones.filter(s => s.fin).sort((a, b) => b.inicio - a.inicio);
}

// ---------- precarga ----------

/**
 * Peso y reps con que arranca una serie. Se busca SIEMPRE dentro de la misma
 * variante: el peso de la polea no sirve para la mancuerna.
 */
export function precarga(db, varianteId, serieIdx) {
  for (const s of sesionesTerminadas(db)) {
    const hechas = s.sets.filter(x => x.varianteId === varianteId && x.estado === 'hecha');
    if (!hechas.length) continue;
    const exacta = hechas.find(x => x.serieIdx === serieIdx);
    const elegida = exacta || hechas[hechas.length - 1];
    return { peso: elegida.peso, reps: elegida.reps, fecha: s.inicio };
  }
  return null;
}

/**
 * Qué venías haciendo en OTRA variante del mismo movimiento. Es contexto para
 * cuando sustituís, no una precarga: el número no se convierte ni se aplica.
 */
export function referenciaHermana(db, ejercicioId, varianteId) {
  const hermanas = variantesDe(db, ejercicioId).filter(v => v.id !== varianteId);
  let mejor = null;
  for (const v of hermanas) {
    const p = precarga(db, v.id, 0) || (v.ultimo ? { peso: v.ultimo.peso, reps: v.ultimo.reps, fecha: v.ultimo.ts } : null);
    if (p && (!mejor || p.fecha > mejor.fecha)) mejor = { ...p, variante: v };
  }
  return mejor;
}

// ---------- historial ----------

export function historialEj(db, ejercicioId, { varianteId = null } = {}) {
  const out = [];
  for (const s of db.sesiones) {
    if (!s.fin) continue;
    for (const x of s.sets) {
      if (x.estado !== 'hecha') continue;
      if (x.ejercicioId !== ejercicioId) continue;
      if (varianteId && x.varianteId !== varianteId) continue;
      out.push({ ...x, sesionId: s.id, fecha: s.inicio });
    }
  }
  return out.sort((a, b) => a.fecha - b.fecha || a.serieIdx - b.serieIdx);
}

/** El peso llevado a la escala de la variante de referencia, para poder comparar. */
export function pesoNormalizado(db, set) {
  const v = db.variantes[set.varianteId];
  return set.peso * (v?.factor ?? 1);
}

export function maximoEj(db, ejercicioId, opts) {
  const hist = historialEj(db, ejercicioId, opts);
  if (!hist.length) return null;
  const asistido = (id) => db.variantes[id]?.tipo === 'asistido';
  return hist.reduce((m, x) => {
    const mejor = asistido(x.varianteId) ? x.peso < m.peso : x.peso > m.peso;
    return mejor ? x : m;
  }, hist[0]);
}

export function ultimoEj(db, ejercicioId, opts) {
  const hist = historialEj(db, ejercicioId, opts);
  return hist.length ? hist[hist.length - 1] : null;
}

export function sesionesConEj(db, ejercicioId) {
  return new Set(historialEj(db, ejercicioId).map(x => x.sesionId)).size;
}

// ---------- semanas y volumen ----------

/** Lunes 00:00 local de la semana de ts. */
export function inicioSemana(ts) {
  const d = new Date(ts);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return d.getTime();
}

/** Series fraccionadas que aporta un set: 1 al primario, 0.5 a cada secundario. */
export function aporteDeSet(db, set, acc = {}) {
  const m = db.ejercicios[set.ejercicioId];
  if (!m) return acc;
  for (const id of m.prim || []) acc[id] = (acc[id] || 0) + 1;
  for (const id of m.sec || []) acc[id] = (acc[id] || 0) + 0.5;
  return acc;
}

export function seriesPorMusculo(db, desde, hasta) {
  const acc = {};
  for (const s of db.sesiones) {
    if (!s.fin || s.inicio < desde || s.inicio >= hasta) continue;
    for (const x of s.sets) if (x.estado === 'hecha') aporteDeSet(db, x, acc);
  }
  return acc;
}

/** Lo que aportaría una plantilla si la hicieras entera. */
export function aporteDePlantilla(db, plantillaId) {
  const acc = {};
  for (const item of itemsDe(db, plantillaId)) {
    const m = db.ejercicios[item.ejercicioId];
    if (!m) continue;
    for (const id of m.prim || []) acc[id] = (acc[id] || 0) + item.series;
    for (const id of m.sec || []) acc[id] = (acc[id] || 0) + item.series * 0.5;
  }
  return acc;
}

export function seriesDePlantilla(db, plantillaId) {
  return itemsDe(db, plantillaId).reduce((a, x) => a + x.series, 0);
}

/**
 * Estado de la semana en curso: cuánto lleva cada músculo contra su objetivo.
 * Ordenado por lo que más falta, que es la pregunta que se hace uno al entrar
 * al gimnasio.
 */
export function estadoSemanal(db, ref = Date.now()) {
  const desde = inicioSemana(ref);
  const hecho = seriesPorMusculo(db, desde, desde + 7 * 864e5);
  return MUSCULOS.map(m => {
    const v = hecho[m.id] || 0;
    const falta = Math.max(0, m.objMin - v);
    return {
      ...m,
      hecho: Math.round(v * 2) / 2,
      falta: Math.round(falta * 2) / 2,
      estado: v >= m.objMin ? (v > m.objMax ? 'excedido' : 'listo') : (v > 0 ? 'corto' : 'sin-empezar'),
      progreso: m.objMin ? Math.min(1.5, v / m.objMin) : 0,
    };
  }).sort((a, b) => (b.falta - a.falta) || (a.prioridad - b.prioridad));
}

// ---------- recuperación ----------

/**
 * Horas desde la última sesión que le dio a cada músculo un estímulo real
 * (al menos UMBRAL_ESTIMULO series fraccionadas). Devuelve null si nunca.
 */
export function horasDesde(db, ref = Date.now()) {
  const ult = {};
  for (const s of db.sesiones) {
    if (!s.fin) continue;
    const acc = {};
    for (const x of s.sets) if (x.estado === 'hecha') aporteDeSet(db, x, acc);
    for (const [id, v] of Object.entries(acc)) {
      if (v >= UMBRAL_ESTIMULO && (!ult[id] || s.fin > ult[id])) ult[id] = s.fin;
    }
  }
  const out = {};
  for (const m of MUSCULOS) out[m.id] = ult[m.id] ? (ref - ult[m.id]) / 36e5 : null;
  return out;
}

/**
 * Músculos que una plantilla va a golpear fuerte y todavía no se recuperaron.
 * No bloquea nada: avisa, y vos decidís.
 */
export function avisosRecuperacion(db, plantillaId, ref = Date.now()) {
  const aporte = aporteDePlantilla(db, plantillaId);
  const horas = horasDesde(db, ref);
  const out = [];
  for (const [id, series] of Object.entries(aporte)) {
    if (series < UMBRAL_ESTIMULO) continue;
    const m = musculo(id);
    const h = horas[id];
    if (h != null && h < m.recuperacion) {
      out.push({ musculo: m, horas: Math.round(h), faltan: Math.round(m.recuperacion - h), series });
    }
  }
  return out.sort((a, b) => a.horas - b.horas);
}

/** Cuánto del déficit de la semana cubre cada plantilla. Para sugerir cuál toca. */
export function cobertura(db, plantillaId, ref = Date.now()) {
  const estado = estadoSemanal(db, ref);
  const aporte = aporteDePlantilla(db, plantillaId);
  let cubre = 0, total = 0;
  for (const m of estado) {
    total += m.falta;
    cubre += Math.min(m.falta, aporte[m.id] || 0);
  }
  return { cubre: Math.round(cubre * 2) / 2, deficit: Math.round(total * 2) / 2, ratio: total ? cubre / total : 0 };
}

// ---------- adherencia ----------

export function semanasEntrenadas(db, cantidad) {
  const hoy = inicioSemana(Date.now());
  const out = [];
  for (let i = cantidad - 1; i >= 0; i--) {
    const desde = hoy - i * 7 * 864e5;
    const n = db.sesiones.filter(s =>
      s.fin && s.inicio >= desde && s.inicio < desde + 7 * 864e5 && s.sets.some(x => x.estado === 'hecha')
    ).length;
    out.push({ desde, n });
  }
  return out;
}

export function semanasConDatos(db) {
  const ss = db.sesiones.filter(s => s.fin);
  if (!ss.length) return 0;
  const primera = inicioSemana(Math.min(...ss.map(s => s.inicio)));
  return Math.floor((inicioSemana(Date.now()) - primera) / (7 * 864e5)) + 1;
}
