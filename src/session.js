// Motor de la sesión de entrenamiento.
//
// El plan se materializa al arrancar: cada serie de la rutina se convierte en un slot.
// Así "volver atrás", "lo hecho" y el progreso son cuentas directas, y editar la rutina
// a mitad de sesión no rompe nada de lo ya cargado.

import { uid, diaPorId, versionActual, precarga } from './data.js';

const UNDO_MAX = 10;
/** Una sesión sin tocar durante este tiempo se considera abandonada y la app pregunta. */
export const ABANDONO_MS = 6 * 3600e3;

export function iniciarSesion(db, diaId) {
  const dia = diaPorId(db, diaId);
  const ver = versionActual(dia);
  const sets = [];
  ver.items.forEach((item, exIdx) => {
    for (let i = 0; i < item.series; i++) {
      sets.push({
        id: uid(),
        ejercicioId: item.ejercicioId,
        exIdx,
        serieIdx: i,
        series: item.series,
        repsMin: item.repsMin,
        repsMax: item.repsMax,
        rirMin: item.rirMin,
        rirMax: item.rirMax,
        descanso: item.descanso,
        estado: 'pendiente',
        peso: null, reps: null, rir: null, ts: null,
      });
    }
  });
  const ses = {
    id: uid(),
    diaId,
    diaNombre: dia.nombre,
    versionN: ver.n,
    inicio: Date.now(),
    tocada: Date.now(),
    fin: null,
    sets,
    cursor: sets[0]?.id ?? null,
    undo: [],
    rest: null,
    draft: null,
  };
  recalcularDraft(db, ses);
  db.sesionAbierta = ses;
  return ses;
}

export function setPorId(ses, id) { return ses.sets.find(s => s.id === id); }
export function setActual(ses) { return setPorId(ses, ses.cursor) || ses.sets[0]; }
export function indiceActual(ses) { return ses.sets.findIndex(s => s.id === ses.cursor); }

export function hechas(ses) { return ses.sets.filter(s => s.estado === 'hecha'); }
export function pendientes(ses) { return ses.sets.filter(s => s.estado === 'pendiente'); }

/** Ejercicios en orden, con sus series agrupadas. */
export function porEjercicio(ses) {
  const grupos = [];
  for (const s of ses.sets) {
    let g = grupos.find(x => x.exIdx === s.exIdx);
    if (!g) { g = { exIdx: s.exIdx, ejercicioId: s.ejercicioId, sets: [] }; grupos.push(g); }
    g.sets.push(s);
  }
  return grupos.sort((a, b) => a.exIdx - b.exIdx);
}

export function totalEjercicios(ses) { return porEjercicio(ses).length; }

/** El valor que arranca en pantalla para el slot bajo el cursor. */
export function recalcularDraft(db, ses) {
  const s = setActual(ses);
  if (!s) { ses.draft = null; return; }
  if (s.estado === 'hecha') {
    ses.draft = { setId: s.id, peso: s.peso, reps: s.reps, rir: s.rir, previo: null };
    return;
  }
  // Primero, lo que ya se cargó en esta misma sesión para este ejercicio.
  const enSesion = ses.sets
    .filter(x => x.ejercicioId === s.ejercicioId && x.estado === 'hecha')
    .sort((a, b) => a.serieIdx - b.serieIdx);
  const mismaSerie = enSesion.find(x => x.serieIdx === s.serieIdx);
  const base = mismaSerie || enSesion[enSesion.length - 1] || null;

  const prev = precarga(db, s.ejercicioId, s.serieIdx);
  ses.draft = {
    setId: s.id,
    peso: base ? base.peso : (prev ? prev.peso : 0),
    reps: base ? base.reps : (prev ? prev.reps : s.repsMin),
    rir: null,
    previo: prev,
    // De dónde salió el número que ve en pantalla.
    origen: base ? { tipo: 'sesion', serieIdx: base.serieIdx, peso: base.peso, reps: base.reps }
          : prev ? { tipo: 'historial', peso: prev.peso, reps: prev.reps }
          : null,
  };
}

export function ajustarDraft(ses, campo, delta, paso) {
  const d = ses.draft;
  if (!d) return;
  if (campo === 'peso') {
    d.peso = Math.max(0, Math.round((d.peso + delta * paso) * 2) / 2);
  } else if (campo === 'reps') {
    d.reps = Math.max(0, Math.min(100, d.reps + delta));
  }
  ses.tocada = Date.now();
}

// ---------- deshacer ----------

function fotoUndo(ses, label) {
  ses.undo.push({
    label,
    sets: JSON.parse(JSON.stringify(ses.sets)),
    cursor: ses.cursor,
    rest: ses.rest ? { ...ses.rest } : null,
  });
  if (ses.undo.length > UNDO_MAX) ses.undo.shift();
}

export function etiquetaUndo(ses) {
  return ses.undo.length ? ses.undo[ses.undo.length - 1].label : null;
}

export function deshacer(db, ses) {
  const u = ses.undo.pop();
  if (!u) return false;
  ses.sets = u.sets;
  ses.cursor = u.cursor;
  ses.rest = u.rest;
  ses.tocada = Date.now();
  recalcularDraft(db, ses);
  return true;
}

// ---------- acciones ----------

export function completarSerie(db, ses, nombreEj) {
  const s = setActual(ses);
  const d = ses.draft;
  if (!s || !d) return null;
  const eraHecha = s.estado === 'hecha';
  fotoUndo(ses, eraHecha ? `corrección de serie ${s.serieIdx + 1} de ${nombreEj}` : `serie ${s.serieIdx + 1} de ${nombreEj}`);

  s.estado = 'hecha';
  s.peso = d.peso;
  s.reps = d.reps;
  s.rir = d.rir;
  s.ts = Date.now();
  ses.tocada = Date.now();

  const siguiente = proximoPendiente(ses, s.id);
  if (siguiente) ses.cursor = siguiente.id;
  recalcularDraft(db, ses);

  return { set: s, siguiente, descanso: s.descanso };
}

export function proximoPendiente(ses, desdeId) {
  const i = ses.sets.findIndex(s => s.id === desdeId);
  for (let k = i + 1; k < ses.sets.length; k++) if (ses.sets[k].estado === 'pendiente') return ses.sets[k];
  for (let k = 0; k <= i; k++) if (ses.sets[k].estado === 'pendiente') return ses.sets[k];
  return null;
}

export function saltearEjercicio(db, ses, nombreEj) {
  const s = setActual(ses);
  if (!s) return;
  fotoUndo(ses, `saltear ${nombreEj}`);
  for (const x of ses.sets) {
    if (x.exIdx === s.exIdx && x.estado === 'pendiente') x.estado = 'salteada';
  }
  ses.tocada = Date.now();
  const sig = proximoPendiente(ses, s.id);
  if (sig) ses.cursor = sig.id;
  recalcularDraft(db, ses);
}

export function retomarEjercicio(db, ses, exIdx, nombreEj) {
  fotoUndo(ses, `retomar ${nombreEj}`);
  let primero = null;
  for (const x of ses.sets) {
    if (x.exIdx === exIdx && x.estado === 'salteada') {
      x.estado = 'pendiente';
      primero = primero || x;
    }
  }
  if (primero) ses.cursor = primero.id;
  ses.tocada = Date.now();
  recalcularDraft(db, ses);
}

export function irASet(db, ses, setId) {
  ses.cursor = setId;
  ses.rest = null;
  ses.tocada = Date.now();
  recalcularDraft(db, ses);
}

// ---------- descanso ----------
// Se guarda el instante de fin, no un contador. Si matan la app y volvés,
// el tiempo que queda es el real.

export function arrancarDescanso(ses, seg, setId) {
  ses.rest = { hasta: Date.now() + seg * 1000, dur: seg, setId, avisado: false };
}

export function restanteDescanso(ses) {
  if (!ses.rest) return 0;
  return Math.max(0, (ses.rest.hasta - Date.now()) / 1000);
}

export function ajustarDescanso(ses, seg) {
  if (!ses.rest) return;
  ses.rest.hasta = Math.max(Date.now(), ses.rest.hasta + seg * 1000);
  ses.rest.dur = Math.max(5, ses.rest.dur + seg);
  if (restanteDescanso(ses) > 0) ses.rest.avisado = false;
}

export function cortarDescanso(ses) { ses.rest = null; }

// ---------- cierre ----------

export function resumen(ses) {
  return {
    hechas: ses.sets.filter(s => s.estado === 'hecha').length,
    total: ses.sets.length,
    pendientes: ses.sets.filter(s => s.estado === 'pendiente').length,
    salteadas: ses.sets.filter(s => s.estado === 'salteada').length,
  };
}

export function terminarSesion(db) {
  const ses = db.sesionAbierta;
  if (!ses) return null;
  ses.fin = Date.now();
  ses.rest = null;
  ses.undo = [];
  ses.draft = null;
  // Lo que quedó pendiente al cerrar queda registrado como salteado: dato honesto.
  for (const s of ses.sets) if (s.estado === 'pendiente') s.estado = 'salteada';
  db.sesiones.push(ses);
  db.sesionAbierta = null;
  return ses;
}

export function descartarSesion(db) {
  const ses = db.sesionAbierta;
  db.sesionAbierta = null;
  return ses;
}

export function duracion(ses) {
  return (ses.fin || Date.now()) - ses.inicio;
}
