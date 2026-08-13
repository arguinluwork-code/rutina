// Modelo y datos iniciales.
//
// Decisiones de modelo:
// - El ejercicio es una entidad de catálogo con id estable. Renombrarlo no parte el historial.
// - La rutina versiona el armado y los parámetros, no el ejercicio. Versionado append-only.
// - Los días son nombres (Día A · Empuje), no días de la semana. La adherencia se mide
//   contra un objetivo de sesiones por semana.

export const MUSCULOS = [
  'Pecho', 'Espalda', 'Hombros', 'Bíceps', 'Tríceps',
  'Cuádriceps', 'Femorales', 'Glúteos', 'Gemelos', 'Abdomen', 'Antebrazos',
];

/** Rango semanal de series por músculo que se dibuja de referencia. */
export const RANGO_SERIES = [10, 20];

export const UMBRALES = { carga: 3, volumen: 3, musculos: 2, adherencia: 3 };

export function uid() {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
}

function ej(id, nombre, prim, sec, incremento, tipo, tips) {
  return { id, nombre, prim, sec, incremento, tipo, tips };
}

function it(ejercicioId, series, repsMin, repsMax, rir, descanso) {
  return { ejercicioId, series, repsMin, repsMax, rir, descanso };
}

export function semillaInicial() {
  const cat = [
    ej('e-banca', 'Press banca', ['Pecho'], ['Tríceps', 'Hombros'], 2.5, 'peso',
      'Escápulas retraídas y hombros abajo\nLa barra baja al pecho, no al cuello\nPies firmes en el piso, sin rebotar la barra\nMuñecas alineadas sobre el codo'),
    ej('e-inclinado', 'Press inclinado con mancuernas', ['Pecho'], ['Hombros', 'Tríceps'], 2, 'peso',
      'Banco entre 30 y 45 grados\nNo trabar los codos arriba\nBajar controlado hasta sentir el pecho'),
    ej('e-militar', 'Press militar con mancuernas', ['Hombros'], ['Tríceps'], 2, 'peso',
      'Abdomen firme, sin arquear la espalda\nCodos apenas adelante de la línea del cuerpo'),
    ej('e-fondos', 'Fondos en paralelas', ['Pecho'], ['Tríceps', 'Hombros'], 2.5, 'corporal',
      'Torso inclinado adelante para pecho, vertical para tríceps\nBajar hasta que el brazo quede paralelo al piso'),
    ej('e-laterales', 'Elevaciones laterales', ['Hombros'], [], 1, 'peso',
      'Subir con el codo, no con la mano\nSin impulso de cadera'),
    ej('e-tricepspolea', 'Extensión de tríceps en polea', ['Tríceps'], [], 2.5, 'peso',
      'Codos pegados al cuerpo y quietos\nExtensión completa abajo'),

    ej('e-dominadas', 'Dominadas', ['Espalda'], ['Bíceps'], 2.5, 'corporal',
      'Pecho hacia la barra, no pera\nBajar hasta extender del todo\nSin balanceo'),
    ej('e-remobarra', 'Remo con barra', ['Espalda'], ['Bíceps'], 2.5, 'peso',
      'Torso a unos 45 grados y quieto\nLa barra toca el ombligo, no el pecho'),
    ej('e-jalon', 'Jalón al pecho', ['Espalda'], ['Bíceps'], 5, 'peso',
      'Pecho arriba, hombros abajo antes de tirar\nNo pasar la barra por atrás de la cabeza'),
    ej('e-remopolea', 'Remo en polea baja', ['Espalda'], ['Bíceps'], 5, 'peso',
      'Espalda neutra, sin mecerse\nJuntar las escápulas al final'),
    ej('e-curlz', 'Curl con barra Z', ['Bíceps'], ['Antebrazos'], 2.5, 'peso',
      'Codos quietos al costado\nSin usar la cadera para subir'),
    ej('e-martillo', 'Curl martillo', ['Bíceps'], ['Antebrazos'], 2, 'peso',
      'Muñeca neutra todo el recorrido\nBajar en tres tiempos'),

    ej('e-sentadilla', 'Sentadilla', ['Cuádriceps'], ['Glúteos', 'Femorales'], 2.5, 'peso',
      'Rodillas siguen la línea de los pies\nBajar por lo menos hasta paralelo\nAbdomen firme durante todo el movimiento'),
    ej('e-prensa', 'Prensa 45°', ['Cuádriceps'], ['Glúteos'], 5, 'peso',
      'No despegar la cadera del respaldo\nNo trabar las rodillas arriba'),
    ej('e-rumano', 'Peso muerto rumano', ['Femorales'], ['Glúteos', 'Espalda'], 2.5, 'peso',
      'La cadera va para atrás, la barra pegada a la pierna\nBajar hasta sentir el femoral, no más'),
    ej('e-femoral', 'Curl femoral acostado', ['Femorales'], [], 5, 'peso',
      'Cadera pegada al banco\nSin rebotar abajo'),
    ej('e-gemelos', 'Elevación de gemelos', ['Gemelos'], [], 5, 'peso',
      'Recorrido completo, pausa arriba\nSin rebote en el talón'),
  ];

  const ejercicios = {};
  for (const e of cat) ejercicios[e.id] = e;

  const ts = Date.now();
  const dias = [
    {
      id: 'd-a', nombre: 'Día A · Empuje', versionActual: 1,
      versiones: [{ n: 1, ts, nota: 'Rutina inicial', items: [
        it('e-banca', 4, 8, 10, 2, 120),
        it('e-inclinado', 4, 10, 12, 2, 90),
        it('e-militar', 3, 10, 12, 2, 90),
        it('e-fondos', 3, 8, 12, 1, 120),
        it('e-laterales', 4, 12, 15, 1, 60),
        it('e-tricepspolea', 4, 12, 15, 1, 60),
      ] }],
    },
    {
      id: 'd-b', nombre: 'Día B · Tirón', versionActual: 1,
      versiones: [{ n: 1, ts, nota: 'Rutina inicial', items: [
        it('e-dominadas', 4, 6, 10, 1, 120),
        it('e-remobarra', 4, 8, 10, 2, 120),
        it('e-jalon', 3, 10, 12, 2, 90),
        it('e-remopolea', 3, 10, 12, 2, 90),
        it('e-curlz', 4, 10, 12, 1, 60),
        it('e-martillo', 3, 12, 15, 1, 60),
      ] }],
    },
    {
      id: 'd-c', nombre: 'Día C · Piernas', versionActual: 1,
      versiones: [{ n: 1, ts, nota: 'Rutina inicial', items: [
        it('e-sentadilla', 4, 6, 8, 2, 180),
        it('e-prensa', 4, 10, 12, 2, 120),
        it('e-rumano', 4, 8, 10, 2, 120),
        it('e-femoral', 4, 12, 15, 1, 60),
        it('e-gemelos', 3, 15, 20, 0, 45),
      ] }],
    },
  ];

  return {
    v: 1,
    mtime: ts,
    ejercicios,
    rutina: { dias, objetivoSemanal: 4 },
    sesiones: [],
    sesionAbierta: null,
    meta: { ultimoExport: null, creado: ts },
  };
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

export function maximoEj(db, ejercicioId) {
  const h = historialEj(db, ejercicioId);
  if (!h.length) return null;
  return h.reduce((m, x) => (x.peso > m.peso ? x : m), h[0]);
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

/** Series efectivas por músculo: primario 1, secundario 0.5. */
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
