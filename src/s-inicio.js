import { h, hace, plural, confirmar, toast, prepararSonido, fDuracion, icono } from './ui.js';
import { S, ir, mutar } from './app.js';
import { iniciarSesion, terminarSesion, descartarSesion, resumen } from './session.js';
import { sesionesTerminadas } from './data.js';

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

function proximoDia(db) {
  const dias = db.rutina.dias;
  if (!dias.length) return null;
  const ult = sesionesTerminadas(db)[0];
  if (!ult) return dias[0].id;
  const i = dias.findIndex(d => d.id === ult.diaId);
  return dias[(i + 1) % dias.length].id;
}

export function pantallaInicio(db) {
  const abierta = db.sesionAbierta;
  if (S.diaSel == null || !db.rutina.dias.some(d => d.id === S.diaSel)) S.diaSel = proximoDia(db);

  const cabecera = h('div', { class: 'hd' },
    h('h1', null, 'Rutina'),
    h('button', { class: 'iconbtn', 'aria-label': 'Datos', onclick: () => ir({ n: 'datos' }) },
      icono('datos', 21)),
  );

  const cuerpo = abierta ? bloqueEnCurso(db, abierta) : bloqueEmpezar(db);

  return h('main', { class: 'scr' },
    cabecera,
    h('div', { class: 'spacer' }),
    h('div', { class: 'stack', style: 'padding-bottom:14px' }, cuerpo, notaRespaldo(db)),
  );
}

function bloqueEmpezar(db) {
  const dias = db.rutina.dias;
  const ult = sesionesTerminadas(db)[0];

  return [
    h('div', { class: 'stack tight' },
      h('span', { class: 'kicker', style: 'padding-left:2px' }, 'Sesión de hoy'),
      h('div', { class: 'stack', style: 'gap:6px' },
        dias.map(d => {
          const sel = S.diaSel === d.id;
          const items = d.versiones.find(v => v.n === d.versionActual).items;
          return h('button', {
            class: 'listrow', style: 'min-height:58px;padding:8px 16px;' +
              (sel ? 'border-color:var(--fg);background:var(--surf-2)' : 'background:transparent'),
            onclick: () => { S.diaSel = d.id; mutar(() => {}); },
          },
            h('span', { class: 'txt' },
              h('b', { style: 'font-size:16px;color:' + (sel ? 'var(--fg)' : 'var(--fg-2)') }, d.nombre),
              d.foco && h('small', null, d.foco),
            ),
            h('span', { class: 'tiny num' }, `${items.length} ej`),
          );
        }),
      ),
    ),
    h('button', {
      class: 'btn big',
      onclick: () => {
        prepararSonido();
        mutar(d => iniciarSesion(d, S.diaSel));
        ir({ n: 'entrenar' });
      },
    }, h('span', { style: 'display:flex;align-items:center;gap:10px' }, icono('entrenar', 22, 2.25), 'Empezar entrenamiento')),
    ult && h('div', { class: 'card' }, h('div', { class: 'card-pad' },
      h('span', { class: 'kicker' }, 'Última sesión'),
      h('span', { class: 'num', style: 'font-size:16px;font-weight:600' },
        ult.diaNombre,
        h('span', { class: 'dim', style: 'font-weight:500' },
          ` — ${hace(ult.inicio)} · ${plural(resumen(ult).hechas, 'serie', 'series')}`),
      ),
    )),
  ];
}

function bloqueEnCurso(db, ses) {
  const r = resumen(ses);
  const actual = ses.sets.find(s => s.id === ses.cursor);
  const nombre = actual ? db.ejercicios[actual.ejercicioId]?.nombre : '';
  const detalle = actual ? `${ses.diaNombre.split('·')[0].trim()}, serie ${actual.serieIdx + 1} de ${nombre}` : ses.diaNombre;

  return [
    h('div', { class: 'card' }, h('div', {
      class: 'card-pad', style: 'flex-direction:row;align-items:center;justify-content:space-between',
    },
      h('div', { class: 'stack', style: 'gap:3px' },
        h('span', { class: 'kicker' }, 'En curso'),
        h('span', { class: 'sub num' }, `${ses.diaNombre} — ${fDuracion(Date.now() - ses.inicio)} · ${plural(r.hechas, 'serie', 'series')}`),
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
