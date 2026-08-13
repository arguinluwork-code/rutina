import { h, plural, fPeso, hace, chev } from './ui.js';
import { S, ir, mutar } from './app.js';
import {
  MUSCULOS, RANGO_SERIES, UMBRALES, inicioSemana, seriesPorMusculo,
  semanasEntrenadas, semanasConDatos, maximoEj, ultimoEj, sesionesConEj,
} from './data.js';
import { vacio } from './charts.js';

const SEMANA = 7 * 864e5;

export function pantallaProgreso(db) {
  const semanas = semanasConDatos(db);
  if (S.progVista == null) S.progVista = 'semana';

  return h('main', { class: 'scr' },
    h('div', { class: 'hd' }, h('h1', null, 'Progreso')),
    h('div', { class: 'scr-scroll' },
      h('div', { class: 'stack', style: 'padding-top:8px' },
        semanas < UMBRALES.musculos
          ? vacio('Series semanales por músculo',
              `Faltan ${plural(UMBRALES.musculos - semanas, 'semana', 'semanas')} de entrenamiento para ver este gráfico.`)
          : bloqueMusculos(db),
        semanas < UMBRALES.adherencia
          ? vacio('Adherencia',
              `Faltan ${plural(UMBRALES.adherencia - semanas, 'semana', 'semanas')} para ver tu adherencia.`)
          : bloqueAdherencia(db),
        bloqueEjercicios(db),
      ),
    ),
  );
}

// ---------- series efectivas por músculo ----------

function bloqueMusculos(db) {
  const ahora = inicioSemana(Date.now());
  const esSemana = S.progVista === 'semana';
  const desde = esSemana ? ahora : ahora - 3 * SEMANA;
  const hasta = ahora + SEMANA;
  const div = esSemana ? 1 : 4;

  const crudo = seriesPorMusculo(db, desde, hasta);
  const datos = MUSCULOS
    .map(m => ({ m, v: Math.round((crudo[m] || 0) / div * 2) / 2 }))
    .filter(x => x.v > 0)
    .sort((a, b) => b.v - a.v);

  const [lo, hi] = RANGO_SERIES;
  const tope = Math.max(hi + 4, ...datos.map(d => d.v));

  const chip = (k, label) => h('button', {
    class: 'chip' + (S.progVista === k ? ' on' : ''), style: 'height:36px;font-size:13px',
    onclick: () => { S.progVista = k; mutar(() => {}); },
  }, label);

  return h('div', { class: 'chart' },
    h('h3', null, 'Series por músculo'),
    h('span', { class: 'tiny' }, `Primario cuenta 1, secundario 0.5 · referencia ${lo}–${hi} por semana`),
    h('div', { style: 'display:flex;gap:6px;margin-top:10px' }, chip('semana', 'Esta semana'), chip('prom', 'Prom. 4 sem')),
    datos.length === 0
      ? h('div', { class: 'empty', style: 'margin-top:10px' }, 'Todavía no hay series cargadas en este período.')
      : h('div', { class: 'bars', style: 'margin-top:12px' },
          datos.map(d => h('div', { class: 'bar' },
            h('span', { class: 'bl' }, d.m),
            h('span', { class: 'bt' },
              h('span', { class: 'band', style: `left:${lo / tope * 100}%;width:${(hi - lo) / tope * 100}%` }),
              h('span', { class: 'fill' + (d.v < lo ? ' low' : ''), style: `width:${Math.min(100, d.v / tope * 100)}%` }),
            ),
            h('span', { class: 'bv num' }, String(d.v)),
          )),
        ),
  );
}

// ---------- adherencia ----------

function bloqueAdherencia(db) {
  const objetivo = db.rutina.objetivoSemanal;
  const sem = semanasEntrenadas(db, 8);
  const tope = Math.max(objetivo, ...sem.map(s => s.n));
  const cumplidas = sem.filter(s => s.n >= objetivo).length;

  return h('div', { class: 'chart' },
    h('h3', null, 'Adherencia'),
    h('span', { class: 'tiny num' }, `Últimas 8 semanas · objetivo ${objetivo} por semana · ${cumplidas} de 8 cumplidas`),
    h('div', { class: 'wk', style: 'margin-top:14px' },
      sem.map(s => h('div', { class: 'c' },
        h('span', { class: 'col' },
          h('b', {
            class: s.n >= objetivo ? '' : 'miss',
            style: `height:${Math.max(3, s.n / tope * 100)}%`,
          }),
        ),
        h('small', null, etiquetaSemana(s.desde)),
      )),
    ),
    h('div', { class: 'tiny', style: 'margin-top:8px' },
      h('span', { style: 'display:inline-block;width:8px;height:8px;background:var(--acc);border-radius:2px;margin-right:6px' }),
      'cumplida  ',
      h('span', { style: 'display:inline-block;width:8px;height:8px;background:var(--fg-2);border-radius:2px;margin:0 6px 0 10px' }),
      'por debajo',
    ),
  );
}

function etiquetaSemana(ts) {
  const d = new Date(ts);
  return `${d.getDate()}/${d.getMonth() + 1}`;
}

// ---------- por ejercicio ----------

function bloqueEjercicios(db) {
  const items = Object.values(db.ejercicios)
    .map(e => ({ e, max: maximoEj(db, e.id), ult: ultimoEj(db, e.id), n: sesionesConEj(db, e.id) }))
    .filter(x => x.n > 0)
    .sort((a, b) => (b.ult?.fecha ?? 0) - (a.ult?.fecha ?? 0));

  return h('div', { class: 'stack tight' },
    h('span', { class: 'sec-title' }, 'Por ejercicio'),
    items.length === 0
      ? h('div', { class: 'empty' }, 'Cuando termines tu primera sesión vas a ver acá el máximo y el último de cada ejercicio.')
      : items.map(({ e, max, ult }) => h('button', {
          class: 'listrow', onclick: () => ir({ n: 'ficha', ejercicioId: e.id }),
        },
          h('span', { class: 'txt' },
            h('b', null, e.nombre),
            h('small', null,
              `Máx ${fPeso(max.peso)} kg × ${max.reps}  ·  último ${fPeso(ult.peso)} kg × ${ult.reps}, ${hace(ult.fecha)}`),
          ),
          chev(),
        )),
  );
}
