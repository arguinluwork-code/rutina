// Arranque, estado global y navegación.

import { cargar, guardar, pedirPersistencia } from './db.js';
import { semillaInicial, VERSION_DATOS, PASO } from './data.js';
import { tomarFoto } from './db.js';
import { h, vaciar, cerrarHoja, confirmar, icono, toast, mmss, pitido, mantenerPantalla } from './ui.js';
import { ABANDONO_MS, terminarSesion, descartarSesion, restanteDescanso } from './session.js';

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
  // Cada repintado limpia esta lista; lo que necesite reloj se vuelve a anotar.
  tickers: [],
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
  S.tickers = [];
  const fn = PANTALLAS[S.ruta.n] || pantallaInicio;
  const cuerpo = fn(S.db, S.ruta);
  vaciar(app);
  // La barra de tabs no se esconde nunca, ni entrenando: se puede ir a mirar el
  // historial y volver sin perder nada.
  app.append(cuerpo, franjaSesion(), barraTabs());
  document.getElementById('overlay-root').replaceChildren();
}

/**
 * Franja pegada arriba de los tabs con el entrenamiento en curso. Aparece
 * cuando estás en cualquier pantalla que no sea la de entrenar, y si hay
 * descanso corriendo muestra la cuenta regresiva. Tocarla te devuelve.
 */
function franjaSesion() {
  const ses = S.db?.sesionAbierta;
  if (!ses || S.ruta.n === 'entrenar') return null;

  const set = ses.sets.find(x => x.id === ses.cursor) || ses.sets[0];
  const ej = S.db.ejercicios[set?.ejercicioId];
  const hechas = ses.sets.filter(x => x.estado === 'hecha').length;

  const barra = h('span', { class: 'franja-barra' });
  const reloj = h('span', { class: 'franja-reloj num' });
  const sub = h('small', null, '');

  const pintar = () => {
    const resta = restanteDescanso(ses);
    const descansando = !!ses.rest && resta > 0;
    reloj.textContent = descansando ? mmss(resta) : '';
    reloj.hidden = !descansando;
    barra.style.width = descansando ? (resta / ses.rest.dur * 100) + '%' : '0%';
    sub.textContent = descansando
      ? `Descanso · serie ${(set?.serieIdx ?? 0) + 1}`
      : `Serie ${(set?.serieIdx ?? 0) + 1} de ${set?.series ?? 0} · ${hechas} hechas`;
  };
  pintar();
  S.tickers.push(pintar);

  return h('button', {
    class: 'franja',
    onclick: () => { S.tab = 'entrenar'; S.pila = []; S.ruta = { n: 'entrenar' }; render(); },
  },
    barra,
    h('span', { class: 'franja-txt' },
      h('b', null, ej?.nombre ?? 'Entrenamiento'),
      sub,
    ),
    reloj,
    icono('atras', 18, 2.25),
  );
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

// Un solo latido para todo lo que depende del reloj.
setInterval(() => {
  // El aviso de fin de descanso es global: suena estés en la pantalla que estés,
  // porque durante el descanso es normal irse a mirar otra cosa.
  const ses = S.db?.sesionAbierta;
  if (ses?.rest && !ses.rest.avisado && restanteDescanso(ses) <= 0) {
    ses.rest.avisado = true;
    pitido();
    mantenerPantalla(false);
    guardar(S.db);
    if (S.ruta.n !== 'entrenar') toast('Se terminó el descanso');
  }
  for (const t of S.tickers) t();
}, 250);

// ---------- migraciones ----------

/**
 * Lleva la base guardada al formato actual. Nunca pisa entrenamientos: si ya
 * hay sesiones cargadas, se conserva la rutina que tenías y solo se ajusta lo
 * que no es una decisión tuya.
 */
async function migrar(db) {
  const desde = db.v || 1;
  if (desde >= VERSION_DATOS) return db;

  await tomarFoto(db, `antes de actualizar del formato ${desde}`);

  // v2: rutina nueva. Sin nada registrado no hay nada que perder.
  if (desde < 2 && db.sesiones.length === 0 && !db.sesionAbierta) {
    const nuevo = semillaInicial();
    guardar(nuevo);
    return nuevo;
  }

  // v3: un solo salto de carga para todos los ejercicios.
  if (desde < 3) {
    for (const e of Object.values(db.ejercicios)) e.incremento = PASO;
  }

  if (desde < 2) S.avisoRutina = true;
  db.v = VERSION_DATOS;
  guardar(db);
  return db;
}

// ---------- arranque ----------

async function arrancar() {
  pedirPersistencia();
  let db = await cargar();
  if (!db) { db = semillaInicial(); guardar(db); }

  db = await migrar(db);
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
