// Arranque, estado global y navegación.

import { cargar, guardar, pedirPersistencia, tomarFoto } from './db.js';
import { semillaInicial, VERSION_DATOS, PASO } from './data.js';
import { h, vaciar, cerrarHoja, confirmar, icono, toast, mmss, pitido, mantenerPantalla } from './ui.js';
import { ABANDONO_MS, terminarSesion, descartarSesion, restanteDescanso } from './session.js';

import { pantallaInicio } from './s-inicio.js';
import { pantallaEntrenar } from './s-entrenar.js';
import {
  pantallaPlantillas, pantallaPlantilla, pantallaItem, pantallaMovimiento,
  pantallaVersiones, pantallaObjetivos,
} from './s-plantillas.js';
import { pantallaHistorial, pantallaSesion, pantallaFicha } from './s-historial.js';
import { pantallaProgreso } from './s-progreso.js';
import { pantallaDatos } from './s-datos.js';
import * as nube from './nube.js';

export const S = {
  db: null,
  tab: 'entrenar',
  ruta: { n: 'inicio' },
  pila: [],
  // Cada repintado limpia esta lista; lo que necesite reloj se vuelve a anotar.
  tickers: [],
};

const RAIZ = { entrenar: 'inicio', rutina: 'plantillas', historial: 'historial', progreso: 'progreso' };

const PANTALLAS = {
  inicio: pantallaInicio,
  entrenar: pantallaEntrenar,
  plantillas: pantallaPlantillas,
  plantilla: pantallaPlantilla,
  item: pantallaItem,
  movimiento: pantallaMovimiento,
  versiones: pantallaVersiones,
  objetivos: pantallaObjetivos,
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
  nube.marcarSucio(S.db);
  render();
  return r;
}

export function reemplazarDb(nuevo) {
  S.db = nuevo;
  guardar(S.db);
  nube.marcarSucio(S.db);
  S.pila = [];
  S.borrador = null;
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
  // El filtro no es cosmético: Node.append(null) inserta el texto "null".
  app.append(...[cuerpo, franjaSesion(), barraTabs()].filter(Boolean));
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
  const mov = set ? S.db.ejercicios[set.ejercicioId] : null;
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
      : set
        ? `Serie ${(set.serieIdx ?? 0) + 1} de ${set.series} · ${hechas} hechas`
        : 'Sin ejercicios todavía';
  };
  pintar();
  S.tickers.push(pintar);

  return h('button', {
    class: 'franja',
    onclick: () => { S.tab = 'entrenar'; S.pila = []; S.ruta = { n: 'entrenar' }; render(); },
  },
    barra,
    h('span', { class: 'franja-txt' },
      h('b', null, mov?.nombre ?? ses.plantillaNombre ?? 'Entrenamiento'),
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
 * hay sesiones cargadas se conserva todo y solo se cambia la forma.
 */
async function migrar(db) {
  const desde = db.v || 1;
  if (desde >= VERSION_DATOS) return db;

  await tomarFoto(db, `antes de actualizar del formato ${desde}`);
  const virgen = db.sesiones.length === 0 && !db.sesionAbierta;

  // Sin nada registrado no hay nada que preservar: se resiembra con el modelo
  // nuevo, que además trae las plantillas calibradas contra los objetivos.
  if (virgen) {
    const nuevo = semillaInicial();
    guardar(nuevo);
    return nuevo;
  }

  if (desde < 3) {
    for (const e of Object.values(db.ejercicios || {})) e.incremento = PASO;
  }

  // v4: aparecen las variantes y los días pasan a ser plantillas.
  if (desde < 4) {
    db.variantes = db.variantes || {};
    for (const e of Object.values(db.ejercicios || {})) {
      const vid = `${e.id}__v`;
      db.variantes[vid] = {
        id: vid, ejercicioId: e.id, nombre: 'Estándar',
        tipo: e.tipo || 'peso', incremento: e.incremento ?? PASO,
        factor: 1, nota: '', ultimo: e.ultimo || null,
      };
      delete e.tipo; delete e.incremento; delete e.ultimo;
    }
    db.plantillas = (db.rutina?.dias || []).map(d => ({
      id: d.id, nombre: d.nombre, foco: d.foco || '',
      versionActual: d.versionActual,
      versiones: d.versiones.map(v => ({
        ...v,
        items: v.items.map(it => ({ ...it, varianteId: `${it.ejercicioId}__v` })),
      })),
    }));
    db.config = { objetivoSemanal: db.rutina?.objetivoSemanal ?? 4, maxSeriesSesion: 24 };
    delete db.rutina;
    for (const s of db.sesiones) {
      s.plantillaNombre = s.plantillaNombre ?? s.diaNombre;
      s.plantillaId = s.plantillaId ?? s.diaId;
      delete s.diaNombre; delete s.diaId;
      for (const x of s.sets) x.varianteId = x.varianteId ?? `${x.ejercicioId}__v`;
    }
    if (db.sesionAbierta) {
      const s = db.sesionAbierta;
      s.plantillaNombre = s.plantillaNombre ?? s.diaNombre;
      s.plantillaId = s.plantillaId ?? s.diaId;
      for (const x of s.sets) x.varianteId = x.varianteId ?? `${x.ejercicioId}__v`;
    }
    S.avisoModelo = true;
  }

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
      texto: `${ses.plantillaNombre} — ${new Date(ses.inicio).toLocaleDateString('es-AR')}\n` +
             `${ses.sets.filter(s => s.estado === 'hecha').length} series cargadas.\n\n` +
             '¿Lo retomás o lo cerrás así como está?',
      ok: 'Cerrarlo así',
      onOk: () => mutar((d) => { terminarSesion(d); }),
    });
    return;
  }
  render();
  if (S.avisoModelo) {
    S.avisoModelo = false;
    toast('Tus días pasaron a ser plantillas y se conservó todo el historial');
  }
  nube.alCambiarEstado(() => render());
  resolverNube();
}

/**
 * Al abrir con un código: si el teléfono está vacío y la nube tiene datos, se
 * ofrece bajarlos. Si los dos tienen datos y nunca sincronizaron, se pregunta
 * en vez de pisar cualquiera de las dos partes.
 */
async function resolverNube() {
  let r;
  try { r = await nube.alAbrir(S.db); } catch { return; }

  if (r.accion === 'bajar') {
    confirmar({
      titulo: 'Hay datos guardados con ese código',
      texto: `En la nube hay ${r.remoto.sesiones} sesiones y ${r.remoto.series} series.\n` +
             'Este teléfono está vacío. ¿Los traigo?',
      ok: 'Traer',
      onOk: async () => {
        const traido = await nube.traer();
        if (traido) { reemplazarDb(traido); toast('Datos traídos'); }
      },
    });
  } else if (r.accion === 'divergen') {
    confirmar({
      titulo: 'Los datos no coinciden',
      texto: `Acá tenés ${r.local} sesiones y en la nube hay ${r.remoto.sesiones}, y este teléfono ` +
             'nunca sincronizó con ese código.\n\n' +
             'No toco nada hasta que decidas: podés subir lo de acá o traer lo de la nube, desde Datos.',
      ok: 'Entendido',
      onOk: () => {},
    });
  }
  render();
}

window.addEventListener('pagehide', () => { if (S.db) { guardar(S.db); nube.subirAhora(S.db); } });
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden' && S.db) { guardar(S.db); nube.subirAhora(S.db); }
});

if ('serviceWorker' in navigator && location.protocol === 'https:') {
  navigator.serviceWorker.register('./sw.js').catch(() => {});
}

arrancar();

export { terminarSesion, descartarSesion };
