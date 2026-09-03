import {
  h, hace, plural, confirmar, toast, prepararSonido, fDuracion, icono, chev,
} from './ui.js';
import { S, ir, mutar } from './app.js';
import { iniciarSesion, iniciarSesionLibre, terminarSesion, descartarSesion, resumen } from './session.js';
import {
  sesionesTerminadas, estadoSemanal, cobertura, avisosRecuperacion,
  seriesDePlantilla, itemsDe, semanasEntrenadas,
} from './data.js';

/** Sesiones cargadas después del último respaldo. */
export function sinRespaldar(db) {
  const t = db.meta.ultimoExport || 0;
  return db.sesiones.filter(s => s.fin && s.fin > t).length;
}

function notaRespaldo(db) {
  const n = sinRespaldar(db);
  const t = db.meta.ultimoExport;
  const dias = t ? (Date.now() - t) / 864e5 : Infinity;
  const alerta = n >= 10 || dias > 30 || !t;
  const txt = t
    ? `Último respaldo: ${hace(t)} · ${plural(n, 'sesión sin respaldar', 'sesiones sin respaldar')}`
    : 'Todavía no exportaste nada. Los datos viven solo en este teléfono.';
  return h('button', {
    class: 'note' + (alerta ? '' : ' ok'), style: 'width:100%;text-align:left',
    onclick: () => ir({ n: 'datos' }),
  }, icono(alerta ? 'alerta' : 'nube', 14), h('span', null, txt));
}

function avisoInstalar(db) {
  const instalada = window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
  if (instalada || db.meta.ocultarInstalar) return null;
  return h('div', { style: 'display:flex;align-items:center;gap:10px;padding:2px' },
    h('span', { class: 'tiny', style: 'flex:1;line-height:1.35' },
      'Compartir → Agregar a pantalla de inicio: se va la barra del navegador.'),
    h('button', {
      class: 'iconbtn', style: 'width:36px;height:36px;flex:none', 'aria-label': 'No mostrar más',
      onclick: () => mutar(d => { d.meta.ocultarInstalar = true; }),
    }, icono('cerrar', 15)),
  );
}

// ---------------------------------------------------------------- semana

/** Resumen de la semana: sesiones hechas y los músculos que más faltan. */
function bloqueSemana(db) {
  const objetivo = db.config.objetivoSemanal;
  const sem = semanasEntrenadas(db, 1)[0];
  const estado = estadoSemanal(db);
  const faltantes = estado.filter(m => m.falta > 0).slice(0, 4);
  const listos = estado.filter(m => m.estado === 'listo' || m.estado === 'excedido').length;

  return h('button', {
    class: 'card', style: 'width:100%;text-align:left',
    onclick: () => { S.tab = 'progreso'; S.pila = []; S.ruta = { n: 'progreso' }; mutar(() => {}); },
  },
    h('div', { class: 'card-pad', style: 'gap:10px' },
      h('div', { style: 'display:flex;align-items:baseline;justify-content:space-between;gap:10px' },
        h('span', { class: 'kicker' }, 'Esta semana'),
        h('span', { class: 'tiny num' }, `${sem.n} de ${objetivo} sesiones · ${listos}/${estado.length} músculos al día`),
      ),
      faltantes.length === 0
        ? h('span', { class: 'sub' }, 'Todos los músculos llegaron a su objetivo semanal.')
        : h('div', { class: 'stack', style: 'gap:7px' },
            faltantes.map(m => h('div', { class: 'bar' },
              h('span', { class: 'bl' }, m.label),
              h('span', { class: 'bt', style: 'height:14px' },
                h('span', {
                  class: 'fill' + (m.prioridad === 1 ? '' : ' low'),
                  style: `width:${Math.min(100, m.progreso * 100)}%`,
                }),
              ),
              h('span', { class: 'bv num', style: 'width:52px;font-size:12px' }, `${m.hecho}/${m.objMin}`),
            )),
          ),
    ),
  );
}

// ---------------------------------------------------------------- pantalla

export function pantallaInicio(db) {
  const abierta = db.sesionAbierta;

  const cabecera = h('div', { class: 'hd' },
    h('h1', null, 'Rutina'),
    h('button', { class: 'iconbtn', 'aria-label': 'Datos', onclick: () => ir({ n: 'datos' }) },
      icono('datos', 21)),
  );

  return h('main', { class: 'scr' },
    cabecera,
    h('div', { class: 'scr-scroll', style: 'display:flex;flex-direction:column' },
      h('div', { class: 'stack', style: 'padding:6px 0 14px' },
        abierta ? bloqueEnCurso(db, abierta) : bloqueElegir(db),
        avisoInstalar(db),
        notaRespaldo(db),
      ),
    ),
  );
}

function bloqueElegir(db) {
  if (S.plSel == null || !db.plantillas.some(p => p.id === S.plSel)) {
    // Arranca elegida la que más déficit cubre. Es un dato, no un consejo.
    S.plSel = [...db.plantillas]
      .map(p => ({ id: p.id, r: cobertura(db, p.id).cubre }))
      .sort((a, b) => b.r - a.r)[0]?.id ?? db.plantillas[0]?.id;
  }
  const mejor = [...db.plantillas]
    .map(p => ({ id: p.id, r: cobertura(db, p.id).cubre }))
    .sort((a, b) => b.r - a.r)[0];

  const ult = sesionesTerminadas(db)[0];

  return [
    bloqueSemana(db),

    h('div', { class: 'stack tight' },
      h('span', { class: 'kicker', style: 'padding-left:2px' }, 'Entrenamiento'),
      h('div', { class: 'stack', style: 'gap:6px' },
        db.plantillas.map(p => {
          const sel = S.plSel === p.id;
          const cob = cobertura(db, p.id);
          const avisos = avisosRecuperacion(db, p.id);
          return h('button', {
            class: 'listrow', style: 'min-height:60px;padding:10px 14px;' +
              (sel ? 'border-color:var(--fg);background:var(--surf-2)' : 'background:transparent'),
            onclick: () => { S.plSel = p.id; mutar(() => {}); },
          },
            h('span', { class: 'txt' },
              h('b', { style: 'font-size:16px;color:' + (sel ? 'var(--fg)' : 'var(--fg-2)') },
                p.nombre,
                mejor && mejor.id === p.id && mejor.r > 0
                  ? h('span', { class: 'badge on', style: 'margin-left:8px' }, 'Cubre más')
                  : null,
              ),
              h('small', null,
                `${seriesDePlantilla(db, p.id)} series · ${plural(itemsDe(db, p.id).length, 'ejercicio', 'ejercicios')}` +
                (cob.cubre > 0 ? ` · cubre ${cob.cubre} de ${cob.deficit} que faltan` : ''),
              ),
            ),
            avisos.length
              ? h('span', { class: 'chev', style: 'color:var(--warn)' }, icono('alerta', 17))
              : null,
          );
        }),
      ),
    ),

    avisoRecuperacionSel(db),

    h('button', {
      class: 'btn big',
      onclick: () => {
        prepararSonido();
        mutar(d => iniciarSesion(d, S.plSel));
        ir({ n: 'entrenar' });
      },
    }, h('span', { style: 'display:flex;align-items:center;gap:10px' },
      icono('entrenar', 22, 2.25), 'Empezar entrenamiento')),

    h('button', {
      class: 'btn',
      onclick: () => {
        prepararSonido();
        mutar(d => iniciarSesionLibre(d));
        ir({ n: 'entrenar' });
      },
    }, icono('mas', 16), 'Sesión suelta, sin plantilla'),

    ult && h('div', { class: 'card' }, h('div', { class: 'card-pad' },
      h('span', { class: 'kicker' }, 'Última sesión'),
      h('span', { class: 'num', style: 'font-size:16px;font-weight:600' },
        ult.plantillaNombre ?? 'Suelto',
        h('span', { class: 'dim', style: 'font-weight:500' },
          ` — ${hace(ult.inicio)} · ${plural(resumen(ult).hechas, 'serie', 'series')}`),
      ),
    )),
  ];
}

/** El aviso de recuperación de la plantilla elegida, en detalle. */
function avisoRecuperacionSel(db) {
  const avisos = avisosRecuperacion(db, S.plSel);
  if (!avisos.length) return null;
  return h('div', { class: 'card', style: 'border-color:var(--warn);background:transparent' },
    h('div', { class: 'card-pad', style: 'gap:8px' },
      h('div', { style: 'display:flex;align-items:center;gap:8px;color:var(--warn)' },
        icono('alerta', 16),
        h('span', { class: 'kicker', style: 'color:var(--warn)' }, 'Todavía en recuperación'),
      ),
      ...avisos.map(a => h('span', { class: 'tiny num', style: 'color:var(--fg-2)' },
        `${a.musculo.label}: entrenado hace ${a.horas} h, le faltan ${a.faltan} h. Esta plantilla le da ${a.series} series.`)),
      h('span', { class: 'tiny' }, 'Podés hacerla igual. Es un dato, no un bloqueo.'),
    ),
  );
}

function bloqueEnCurso(db, ses) {
  const r = resumen(ses);
  const actual = ses.sets.find(s => s.id === ses.cursor);
  const nombre = actual ? db.ejercicios[actual.ejercicioId]?.nombre : '';
  const detalle = actual ? `serie ${actual.serieIdx + 1} de ${nombre}` : ses.plantillaNombre;

  return [
    h('div', { class: 'card' }, h('div', {
      class: 'card-pad', style: 'flex-direction:row;align-items:center;justify-content:space-between',
    },
      h('div', { class: 'stack', style: 'gap:3px' },
        h('span', { class: 'kicker' }, 'En curso'),
        h('span', { class: 'sub num' },
          `${ses.plantillaNombre} — ${fDuracion(Date.now() - ses.inicio)} · ${plural(r.hechas, 'serie', 'series')}`),
      ),
      h('span', { style: 'width:8px;height:8px;border-radius:4px;background:var(--acc);flex:none' }),
    )),
    h('button', {
      class: 'btn big',
      onclick: () => { prepararSonido(); ir({ n: 'entrenar' }); },
    }, 'Retomar entrenamiento', h('small', null, detalle)),
    h('div', { class: 'row' },
      h('button', {
        class: 'btn',
        onclick: () => confirmar({
          titulo: '¿Terminar la sesión?',
          texto: `${r.hechas} de ${r.total} series cargadas.` +
            (r.pendientes ? `\n${plural(r.pendientes, 'serie queda pendiente y se registra como salteada', 'series quedan pendientes y se registran como salteadas')}.` : ''),
          ok: 'Terminar',
          onOk: () => { mutar(d => terminarSesion(d)); toast('Sesión guardada'); },
        }),
      }, icono('terminar', 17), 'Terminar sesión'),
      h('button', {
        class: 'btn',
        onclick: () => confirmar({
          titulo: '¿Descartar la sesión?',
          texto: `Se pierden las ${r.hechas} series cargadas. Esto no se puede deshacer.`,
          ok: 'Descartar', peligro: true,
          onOk: () => { mutar(d => descartarSesion(d)); toast('Sesión descartada'); },
        }),
      }, icono('basura', 17), 'Descartar'),
    ),
  ];
}
