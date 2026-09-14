import { h, plural, fPeso, hace, chev, icono, abrirHoja, cerrarHoja } from './ui.js';
import { S, ir, mutar } from './app.js';
import {
  MUSCULOS, musculo, UMBRALES, inicioSemana, seriesPorMusculo, estadoSemanal,
  horasDesde, semanasEntrenadas, semanasConDatos, maximoEj, ultimoEj,
  sesionesConEj, nombreCompleto, variantesDe,
  CURVA, ZONAS, zonaVolumen, fraccionCubierta, rendimientoMarginal,
} from './data.js';
import { vacio, escalaVolumen, leyendaEscala } from './charts.js';

const SEMANA = 7 * 864e5;
const TITULO_PRIORIDAD = { 1: 'Prioridad', 2: 'Sostén', 3: 'Mantenimiento' };

export function pantallaProgreso(db) {
  const semanas = semanasConDatos(db);
  if (S.progVista == null) S.progVista = 'semana';

  return h('main', { class: 'scr' },
    h('div', { class: 'hd' }, h('h1', null, 'Progreso')),
    h('div', { class: 'scr-scroll' },
      h('div', { class: 'stack', style: 'padding-top:8px' },
        bloqueVolumen(db),
        bloqueRecuperacion(db),
        semanas < UMBRALES.adherencia
          ? vacio('Adherencia', `Faltan ${plural(UMBRALES.adherencia - semanas, 'semana', 'semanas')} para ver tu adherencia.`)
          : bloqueAdherencia(db),
        bloqueEjercicios(db),
      ),
    ),
  );
}

// ---------- volumen semanal contra objetivo ----------

function bloqueVolumen(db) {
  const ahora = inicioSemana(Date.now());
  const esSemana = S.progVista === 'semana';
  const desde = esSemana ? ahora : ahora - 3 * SEMANA;
  const div = esSemana ? 1 : 4;
  const crudo = seriesPorMusculo(db, desde, ahora + SEMANA);

  const chip = (k, label) => h('button', {
    class: 'chip' + (S.progVista === k ? ' on' : ''), style: 'height:36px;font-size:13px',
    onclick: () => { S.progVista = k; mutar(() => {}); },
  }, label);

  const grupos = [1, 2, 3].map(p => ({
    p, items: MUSCULOS.filter(m => m.prioridad === p),
  }));

  // Todas las barras van contra la MISMA escala, la de la curva de crecimiento,
  // y no cada una contra su propio objetivo. Antes cada músculo se normalizaba
  // solo, así que dos barras iguales podían ser 4 series y 18: se veía el
  // cumplimiento pero no el volumen, que es lo que la evidencia mide.
  const barra = (m) => {
    const v = Math.round(((crudo[m.id] || 0) / div) * 2) / 2;
    return h('button', {
      class: 'bar', style: 'width:100%;background:none;text-align:left',
      onclick: () => hojaMusculo(db, m, v),
    },
      h('span', { class: 'bl' }, m.label),
      h('span', { style: 'flex:1;min-width:0' }, escalaVolumen(m, v, true)),
      h('span', { class: 'bv num' }, String(v)),
    );
  };

  return h('div', { class: 'chart' },
    h('h3', null, 'Series por músculo'),
    h('span', { class: 'tiny', style: 'line-height:1.45' },
      `Primario 1, secundario 0.5. El fondo es la curva de crecimiento (${CURVA.optMin}–${CURVA.optMax} es el óptimo, igual para todos los músculos) ` +
      'y el marco blanco es tu objetivo.'),
    leyendaEscala(),
    h('div', { style: 'display:flex;gap:6px;margin-top:10px' },
      chip('semana', 'Esta semana'), chip('prom', 'Prom. 4 sem')),
    h('div', { class: 'stack', style: 'margin-top:14px;gap:14px' },
      grupos.map(g => h('div', { class: 'stack', style: 'gap:8px' },
        h('span', { class: 'kicker' + (g.p === 1 ? ' on' : '') }, TITULO_PRIORIDAD[g.p]),
        h('div', { class: 'bars' }, g.items.map(barra)),
      )),
    ),
  );
}

function hojaMusculo(db, m, hecho) {
  const h24 = horasDesde(db)[m.id];
  abrirHoja({
    titulo: m.label,
    meta: `${hecho} de ${m.objMin}–${m.objMax}`,
    cuerpo: [
      escalaVolumen(m, hecho),
      leyendaEscala(),
      h('p', { class: 'sub', style: 'font-size:15px;line-height:1.5;margin:14px 0 0' }, m.nota),
      h('p', { class: 'tiny', style: 'margin:10px 0 0' },
        `Con ${hecho} series capturás el ${Math.round(fraccionCubierta(hecho) * 100)}% de la respuesta ` +
        `alcanzable, y una serie más rendiría el ${Math.round(rendimientoMarginal(hecho) * 100)}% de lo que ` +
        `rindió la primera. Zona: ${(ZONAS.find(z => z.id === zonaVolumen(hecho)) || {}).label.toLowerCase()}.`),
      h('p', { class: 'tiny num', style: 'margin:8px 0 0' },
        h24 == null
          ? 'Todavía no lo entrenaste con estímulo suficiente.'
          : `Último estímulo fuerte hace ${Math.round(h24)} h. Recuperación sugerida: ${m.recuperacion} h.`),
    ],
    pie: h('button', { class: 'btn', style: 'flex:1', onclick: cerrarHoja }, icono('cerrar', 16), 'Cerrar'),
  });
}

// ---------- recuperación ----------

function bloqueRecuperacion(db) {
  const horas = horasDesde(db);
  const items = MUSCULOS
    .map(m => ({ m, h: horas[m.id] }))
    .filter(x => x.h != null)
    .sort((a, b) => a.h - b.h);

  if (!items.length) {
    return vacio('Recuperación', 'Cuando termines tu primera sesión vas a ver acá cuánto hace que trabajaste cada músculo.');
  }

  return h('div', { class: 'chart' },
    h('h3', null, 'Recuperación'),
    h('span', { class: 'tiny' }, 'Horas desde el último estímulo fuerte, contra las que conviene esperar.'),
    h('div', { class: 'stack', style: 'margin-top:12px;gap:8px' },
      items.map(({ m, h: hs }) => {
        const listo = hs >= m.recuperacion;
        const frac = Math.min(1, hs / m.recuperacion);
        return h('div', { class: 'bar' },
          h('span', { class: 'bl' }, m.label),
          h('span', { class: 'bt' },
            h('span', { class: 'fill' + (listo ? '' : ' low'), style: `width:${frac * 100}%` }),
          ),
          h('span', { class: 'bv num', style: 'width:44px;color:' + (listo ? 'var(--fg)' : 'var(--warn)') },
            `${Math.round(hs)}h`),
        );
      }),
    ),
    h('div', { class: 'tiny', style: 'margin-top:10px' },
      h('span', { style: 'display:inline-block;width:8px;height:8px;background:var(--acc);border-radius:2px;margin-right:6px' }),
      'recuperado  ',
      h('span', { style: 'display:inline-block;width:8px;height:8px;background:var(--fg-2);border-radius:2px;margin:0 6px 0 10px' }),
      'todavía no',
    ),
  );
}

// ---------- adherencia ----------

function bloqueAdherencia(db) {
  const objetivo = db.config.objetivoSemanal;
  const sem = semanasEntrenadas(db, 8);
  const tope = Math.max(objetivo, ...sem.map(s => s.n));
  const cumplidas = sem.filter(s => s.n >= objetivo).length;

  return h('div', { class: 'chart' },
    h('h3', null, 'Adherencia'),
    h('span', { class: 'tiny num' }, `Últimas 8 semanas · objetivo ${objetivo} por semana · ${cumplidas} de 8 cumplidas`),
    h('div', { class: 'wk', style: 'margin-top:14px' },
      sem.map(s => h('div', { class: 'c' },
        h('span', { class: 'col' },
          h('b', { class: s.n >= objetivo ? '' : 'miss', style: `height:${Math.max(3, s.n / tope * 100)}%` }),
        ),
        h('small', null, etiquetaSemana(s.desde)),
      )),
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
      : items.map(({ e, max, ult }) => {
          const nVar = variantesDe(db, e.id).length;
          return h('button', {
            class: 'listrow', onclick: () => ir({ n: 'ficha', ejercicioId: e.id }),
          },
            h('span', { class: 'txt' },
              h('b', null, e.nombre),
              h('small', null,
                `Máx ${fPeso(max.peso)} kg × ${max.reps} · último ${hace(ult.fecha)}` +
                (nVar > 1 ? ` · ${nVar} variantes` : '')),
            ),
            chev(),
          );
        }),
  );
}
