import {
  h, fPeso, fFecha, fFechaLarga, fMesAño, fDuracion, hace, plural,
  abrirHoja, cerrarHoja, confirmar, toast, stepBtn, icono, chev,
} from './ui.js';
import { S, ir, mutar, volver } from './app.js';
import {
  sesionesTerminadas, historialEj, maximoEj, ultimoEj, sesionesConEj, UMBRALES,
} from './data.js';
import { graficoLinea, graficoBarras, tarjetaGrafico, vacio } from './charts.js';

// ------------------------------------------------------------ lista de sesiones

export function pantallaHistorial(db) {
  const ss = sesionesTerminadas(db);

  const porMes = [];
  for (const s of ss) {
    const k = fMesAño(s.inicio);
    let g = porMes.find(x => x.k === k);
    if (!g) { g = { k, items: [] }; porMes.push(g); }
    g.items.push(s);
  }

  return h('main', { class: 'scr' },
    h('div', { class: 'hd' },
      h('h1', null, 'Historial'),
      h('span', { class: 'tiny num' }, plural(ss.length, 'sesión', 'sesiones')),
    ),
    h('div', { class: 'scr-scroll' },
      ss.length === 0
        ? h('div', { class: 'empty', style: 'margin-top:20px' }, 'Todavía no hay sesiones terminadas. Cuando cierres tu primer entrenamiento va a aparecer acá.')
        : h('div', { class: 'stack', style: 'padding-top:8px' },
            porMes.map(g => h('div', { class: 'stack tight' },
              h('span', { class: 'sec-title' }, g.k),
              g.items.map(s => {
                const hechas = s.sets.filter(x => x.estado === 'hecha').length;
                return h('button', { class: 'listrow', onclick: () => ir({ n: 'sesion', id: s.id }) },
                  h('span', { class: 'txt' },
                    h('b', null, s.diaNombre),
                    h('small', null, `${fFecha(s.inicio)} · ${fDuracion(s.fin - s.inicio)} · ${plural(hechas, 'serie', 'series')}`),
                  ),
                  chev(),
                );
              }),
            )),
          ),
    ),
  );
}

// ------------------------------------------------------------ detalle de sesión

export function pantallaSesion(db, ruta) {
  const s = db.sesiones.find(x => x.id === ruta.id);
  if (!s) { queueMicrotask(volver); return h('main', { class: 'scr' }); }

  const grupos = [];
  for (const x of s.sets) {
    let g = grupos.find(y => y.exIdx === x.exIdx);
    if (!g) { g = { exIdx: x.exIdx, ejercicioId: x.ejercicioId, sets: [] }; grupos.push(g); }
    g.sets.push(x);
  }
  grupos.sort((a, b) => a.exIdx - b.exIdx);
  const hechas = s.sets.filter(x => x.estado === 'hecha').length;

  return h('main', { class: 'scr' },
    h('div', { class: 'hd-back' },
      h('button', { class: 'back', onclick: volver }, icono('atras', 24, 2.25)),
      h('h1', null, s.diaNombre),
    ),
    h('span', { class: 'tiny num', style: 'flex:none' },
      `${fFechaLarga(s.inicio)} · ${fDuracion(s.fin - s.inicio)} · ${hechas} series · corrida con la versión ${s.versionN}`),
    h('div', { class: 'scr-scroll', style: 'padding-top:14px' },
      h('div', { class: 'stack' },
        grupos.map(g => {
          const ej = db.ejercicios[g.ejercicioId];
          return h('div', { class: 'grp' },
            h('div', { class: 'grp-hd' },
              h('button', {
                style: 'background:none;font-size:16px;font-weight:700;color:var(--fg);text-align:left',
                onclick: () => ir({ n: 'ficha', ejercicioId: g.ejercicioId }),
              }, ej?.nombre ?? '—'),
              h('span', { class: 'tiny num' }, `${g.sets.filter(x => x.estado === 'hecha').length} de ${g.sets.length}`),
            ),
            g.sets.map(x => h('button', {
              class: 'setrow' + (x.estado === 'hecha' ? '' : ' pend'),
              onclick: () => hojaCorregir(db, s, x),
            },
              h('i', null, x.estado === 'hecha' ? icono('tilde', 14) : null),
              h('span', { class: 'num' },
                x.estado === 'hecha'
                  ? `Serie ${x.serieIdx + 1} — ${fPeso(x.peso)} kg × ${x.reps}`
                  : `Serie ${x.serieIdx + 1} — salteada`,
                x.rir ? h('em', null, ` · ${x.rir === 'Fallo' ? 'al fallo' : x.rir + ' en el tanque'}`) : null,
              ),
              chev(),
            )),
          );
        }),
        h('button', {
          class: 'btn danger', style: 'margin-top:8px',
          onclick: () => confirmar({
            titulo: '¿Borrar esta sesión?',
            texto: 'Se va del historial y de todos los gráficos. Se guarda una copia de seguridad antes.',
            ok: 'Borrar', peligro: true,
            onOk: async () => {
              const { tomarFoto } = await import('./db.js');
              await tomarFoto(db, 'antes de borrar una sesión');
              mutar(d => { d.sesiones = d.sesiones.filter(x => x.id !== s.id); });
              toast('Sesión borrada');
              volver();
            },
          }),
        }, 'Borrar sesión'),
      ),
    ),
  );
}

/** Corrige una serie ya registrada, de cualquier sesión. */
function hojaCorregir(db, ses, set) {
  const ej = db.ejercicios[set.ejercicioId];
  const paso = ej?.incremento ?? 2.5;
  const tmp = {
    peso: set.peso ?? 0,
    reps: set.reps ?? (set.repsMin || 8),
    rir: set.rir ?? null,
    estado: set.estado,
  };

  const pesoTxt = h('b', { class: 'num' }, fPeso(tmp.peso));
  const repsTxt = h('b', { class: 'num' }, String(tmp.reps));

  const chips = h('div', { class: 'chips', style: 'flex-wrap:nowrap' },
    ['4', '3', '2', '1', '0', 'Fallo'].map(o => {
      const b = h('button', { class: 'chip wide' + (tmp.rir === o ? ' on' : '') }, o);
      b.onclick = () => {
        tmp.rir = tmp.rir === o ? null : o;
        for (const c of chips.children) c.classList.remove('on');
        if (tmp.rir) b.classList.add('on');
      };
      return b;
    }),
  );

  abrirHoja({
    titulo: `Serie ${set.serieIdx + 1}`,
    meta: ej?.nombre ?? '',
    cuerpo: [
      h('div', { class: 'stepper' },
        h('div', { class: 'stepper-hd' }, h('span', { class: 'kicker' }, 'Peso')),
        h('div', { class: 'stepper-body' },
          stepBtn('−', () => { tmp.peso = Math.max(0, Math.round((tmp.peso - paso) * 2) / 2); pesoTxt.textContent = fPeso(tmp.peso); }),
          h('div', { class: 'sval' }, pesoTxt, h('span', null, 'kg')),
          stepBtn('+', () => { tmp.peso = Math.round((tmp.peso + paso) * 2) / 2; pesoTxt.textContent = fPeso(tmp.peso); }),
        ),
      ),
      h('div', { class: 'stepper' },
        h('div', { class: 'stepper-hd' }, h('span', { class: 'kicker' }, 'Reps')),
        h('div', { class: 'stepper-body' },
          stepBtn('−', () => { tmp.reps = Math.max(0, tmp.reps - 1); repsTxt.textContent = String(tmp.reps); }),
          h('div', { class: 'sval' }, repsTxt),
          stepBtn('+', () => { tmp.reps = Math.min(100, tmp.reps + 1); repsTxt.textContent = String(tmp.reps); }),
        ),
      ),
      h('div', { class: 'stack tight' },
        h('span', { class: 'tiny', style: 'padding-left:2px' }, '¿Cuántas te quedaban?'), chips),
      h('button', {
        class: 'btn', style: 'color:var(--fg-2)',
        onclick: () => {
          mutar(() => { set.estado = set.estado === 'hecha' ? 'salteada' : 'hecha'; });
          cerrarHoja(); toast(set.estado === 'hecha' ? 'Marcada como hecha' : 'Marcada como salteada');
        },
      }, set.estado === 'hecha' ? 'Marcar como salteada' : 'Marcar como hecha'),
    ],
    pie: [
      h('button', { class: 'btn', style: 'flex:1', onclick: cerrarHoja }, 'Cancelar'),
      h('button', {
        class: 'btn primary', style: 'flex:1.4',
        onclick: () => {
          mutar(() => { set.peso = tmp.peso; set.reps = tmp.reps; set.rir = tmp.rir; set.estado = 'hecha'; });
          cerrarHoja(); toast('Corregido');
        },
      }, 'Guardar'),
    ],
  });
}

// ------------------------------------------------------------ ficha de ejercicio

/** Momentos en que cambió alguna rutina que contiene este ejercicio. */
function marcasDeVersion(db, ejercicioId) {
  const out = [];
  for (const d of db.rutina.dias) {
    for (const v of d.versiones) {
      if (v.n > 1 && v.items.some(i => i.ejercicioId === ejercicioId)) out.push(v.ts);
    }
  }
  return out;
}

export function pantallaFicha(db, ruta) {
  const ej = db.ejercicios[ruta.ejercicioId];
  if (!ej) { queueMicrotask(volver); return h('main', { class: 'scr' }); }

  const hist = historialEj(db, ej.id);
  const max = maximoEj(db, ej.id);
  const ult = ultimoEj(db, ej.id);
  const nSes = sesionesConEj(db, ej.id);

  // Un punto por sesión: la serie más pesada de esa sesión.
  const porSesion = [];
  for (const x of hist) {
    let g = porSesion.find(p => p.sesionId === x.sesionId);
    if (!g) { g = { sesionId: x.sesionId, x: x.fecha, top: 0, vol: 0, rir: null }; porSesion.push(g); }
    if (x.peso > g.top) { g.top = x.peso; g.rir = x.rir; }
    g.vol += x.peso * x.reps;
  }
  porSesion.sort((a, b) => a.x - b.x);

  const faltanCarga = Math.max(0, UMBRALES.carga - nSes);
  const marcas = marcasDeVersion(db, ej.id);

  const dato = (kick, valor) => h('div', { class: 'card', style: 'flex:1' },
    h('div', { class: 'card-pad', style: 'gap:4px' },
      h('span', { class: 'kicker' }, kick),
      h('span', { class: 'num', style: 'font-size:17px;font-weight:700' }, valor),
    ));

  return h('main', { class: 'scr' },
    h('div', { class: 'hd-back' },
      h('button', { class: 'back', onclick: volver }, icono('atras', 24, 2.25)),
      h('h1', null, ej.nombre),
    ),
    h('div', { class: 'scr-scroll', style: 'padding-top:8px' },
      h('div', { class: 'stack' },
        h('div', { class: 'row' },
          dato('Máximo', max ? `${fPeso(max.peso)} kg × ${max.reps} · ${fFecha(max.fecha)}` : '—'),
          dato('Último', ult ? `${fPeso(ult.peso)} kg × ${ult.reps} · ${hace(ult.fecha)}` : '—'),
        ),

        faltanCarga > 0
          ? vacio('Carga en el tiempo', `Faltan ${plural(faltanCarga, 'sesión', 'sesiones')} de ${ej.nombre} para ver este gráfico.`)
          : tarjetaGrafico('Carga en el tiempo', 'Serie más pesada de cada sesión · la línea punteada marca un cambio de rutina',
              graficoLinea(porSesion.map(p => ({ x: p.x, y: p.top, rir: p.rir })), marcas)),

        faltanCarga > 0
          ? vacio('Volumen por sesión', `Faltan ${plural(faltanCarga, 'sesión', 'sesiones')} de ${ej.nombre} para ver este gráfico.`)
          : tarjetaGrafico('Volumen por sesión', 'Peso × repeticiones acumulado, en kg',
              graficoBarras(porSesion.map(p => ({ x: p.x, y: p.vol })))),

        h('span', { class: 'sec-title' }, 'Todo lo hecho'),
        hist.length === 0
          ? h('div', { class: 'empty' }, 'Todavía no registraste ninguna serie de este ejercicio.')
          : h('div', { class: 'stack tight' },
              [...porSesion].reverse().map(p => {
                const dets = hist.filter(x => x.sesionId === p.sesionId);
                return h('button', {
                  class: 'listrow', onclick: () => ir({ n: 'sesion', id: p.sesionId }),
                },
                  h('span', { class: 'txt' },
                    h('b', { class: 'num' }, fFechaLarga(p.x)),
                    h('small', null, dets.map(x => `${fPeso(x.peso)}×${x.reps}`).join('  ·  ')),
                  ),
                  chev(),
                );
              }),
            ),
      ),
    ),
  );
}
