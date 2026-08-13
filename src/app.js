// Arranque, estado global y navegación.

import { cargar, guardar, pedirPersistencia } from './db.js';
import { semillaInicial, VERSION_DATOS } from './data.js';
import { tomarFoto } from './db.js';
import { h, vaciar, cerrarHoja, confirmar, icono, toast } from './ui.js';
import { ABANDONO_MS, terminarSesion, descartarSesion } from './session.js';

import { pantallaInicio } from './s-inicio.js';
import { pantallaEntrenar } from './s-entrenar.js';
import { pantallaRutina, pantallaDia, pantallaEditarEj, pantallaVersiones } from './s-rutina.js';
import { pantallaHistorial, pantallaSesion, pantallaFicha } from './s-historial.js';
import { pantallaProgreso } from './s-progreso.js';
import { pantallaDatos } from './s-datos.js';

export const S = {
  db: null,
  tab: 'entrenar',
  ruta: { n: 'inicio' },
  pila: [],
  onTick: null,
};

const RAIZ = { entrenar: 'inicio', rutina: 'rutina', historial: 'historial', progreso: 'progreso' };

const PANTALLAS = {
  inicio: pantallaInicio,
  entrenar: pantallaEntrenar,
  rutina: pantallaRutina,
  dia: pantallaDia,
  'editar-ej': pantallaEditarEj,
  versiones: pantallaVersiones,
  historial: pantallaHistorial,
  sesion: pantallaSesion,
  ficha: pantallaFicha,
  progreso: pantallaProgreso,
  datos: pantallaDatos,
};

/** Muta la base y persiste antes de repintar. Nunca al revés. */
export function mutar(fn) {
  const r = fn(S.db);
  guardar(S.db);
  render();
  return r;
}

export function reemplazarDb(nuevo) {
  S.db = nuevo;
  guardar(S.db);
  S.pila = [];
  S.ruta = { n: RAIZ[S.tab] };
  render();
}

export function ir(ruta, { reemplazar = false } = {}) {
  cerrarHoja();
  if (!reemplazar) S.pila.push(S.ruta);
  S.ruta = ruta;
  render();
}

export function volver() {
  cerrarHoja();
  S.ruta = S.pila.pop() || { n: RAIZ[S.tab] };
  render();
}

export function irATab(tab) {
  cerrarHoja();
  S.tab = tab;
  S.pila = [];
  S.ruta = { n: RAIZ[tab] };
  render();
}

export function render() {
  const app = document.getElementById('app');
  S.onTick = null;
  const fn = PANTALLAS[S.ruta.n] || pantallaInicio;
  const cuerpo = fn(S.db, S.ruta);
  const sinTabs = S.ruta.n === 'entrenar';
  vaciar(app);
  app.append(cuerpo);
  if (!sinTabs) app.append(barraTabs());
  document.getElementById('overlay-root').replaceChildren();
  if (S.overlay) document.getElementById('overlay-root').append(S.overlay());
}

function barraTabs() {
  const items = [
    ['entrenar', 'Entrenar'], ['rutina', 'Rutina'],
    ['historial', 'Historial'], ['progreso', 'Progreso'],
  ];
  return h('nav', { class: 'tabs' },
    items.map(([k, label]) => h('button', {
      class: 'tab' + (S.tab === k ? ' on' : ''), 'data-t': k, onclick: () => irATab(k),
    }, icono(k, 21), h('span', null, label))),
  );
}

// Un solo latido para todo lo que depende del reloj (el descanso).
setInterval(() => { if (S.onTick) S.onTick(); }, 250);

// ---------- arranque ----------

async function arrancar() {
  pedirPersistencia();
  let db = await cargar();
  if (!db) { db = semillaInicial(); guardar(db); }

  // Rutina nueva. Si todavía no hay nada registrado no se pierde nada al
  // reemplazarla; si ya entrenaste, no se toca y el cambio lo hacés vos.
  if ((db.v || 1) < VERSION_DATOS) {
    const virgen = db.sesiones.length === 0 && !db.sesionAbierta;
    if (virgen) {
      db = semillaInicial();
      guardar(db);
    } else {
      await tomarFoto(db, 'antes de actualizar el formato');
      db.v = VERSION_DATOS;
      guardar(db);
      S.avisoRutina = true;
    }
  }
  S.db = db;

  const ses = db.sesionAbierta;
  if (ses && Date.now() - (ses.tocada || ses.inicio) > ABANDONO_MS) {
    render();
    confirmar({
      titulo: 'Tenías un entrenamiento abierto',
      texto: `${ses.diaNombre} — ${new Date(ses.inicio).toLocaleDateString('es-AR')}\n` +
             `${ses.sets.filter(s => s.estado === 'hecha').length} series cargadas.\n\n` +
             '¿Lo retomás o lo cerrás así como está?',
      ok: 'Cerrarlo así',
      onOk: () => mutar((d) => { terminarSesion(d); }),
    });
    return;
  }
  render();
  if (S.avisoRutina) {
    S.avisoRutina = false;
    toast('La rutina vieja se conservó porque ya tenés sesiones cargadas');
  }
}

window.addEventListener('pagehide', () => { if (S.db) guardar(S.db); });
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden' && S.db) guardar(S.db);
});

if ('serviceWorker' in navigator && location.protocol === 'https:') {
  navigator.serviceWorker.register('./sw.js').catch(() => {});
}

arrancar();

export { terminarSesion, descartarSesion };
