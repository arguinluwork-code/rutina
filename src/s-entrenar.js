import {
  h, fPeso, mmss, anillo, abrirHoja, cerrarHoja, stepBtn, toast, confirmar,
  prepararSonido, mantenerPantalla, plural, icono, chev,
} from './ui.js';
import { S, ir, mutar } from './app.js';
import { guardar } from './db.js';
import {
  setActual, porEjercicio, totalEjercicios, resumen, hechas,
  ajustarDraft, recalcularDraft, recordarCarga, completarSerie, saltearEjercicio,
  retomarEjercicio, irASet, deshacer, etiquetaUndo, arrancarDescanso,
  restanteDescanso, ajustarDescanso, cortarDescanso, terminarSesion,
  cambiarVariante, agregarEjercicio,
} from './session.js';
import {
  fRango, fEsfuerzo, esfuerzoDeSerie, etiquetaCarga, variante, variantesDe,
  nombreCompleto, labelMusculo,
} from './data.js';

let tGuardar = null;
function persistirPronto() {
  clearTimeout(tGuardar);
  tGuardar = setTimeout(() => guardar(S.db), 250);
}

export function pantallaEntrenar(db) {
  const ses = db.sesionAbierta;
  if (!ses) { queueMicrotask(() => ir({ n: 'inicio' }, { reemplazar: true })); return h('main', { class: 'scr' }); }

  if (ses.rest) {
    const resta = restanteDescanso(ses);
    if (resta > 0) return vistaDescanso(db, ses);
    const pasado = (Date.now() - ses.rest.hasta) / 1000;
    if (pasado > 90) {
      cortarDescanso(ses);
      mantenerPantalla(false);
      persistirPronto();
      toast(`El descanso terminó hace ${mmss(pasado)}`);
    } else {
      return vistaDale(db, ses);
    }
  }
  if (!ses.sets.length) return vistaVacia(db, ses);
  return vistaEntrenar(db, ses);
}

// ---------------------------------------------------------------- sesión suelta

function vistaVacia(db, ses) {
  return h('main', { class: 'scr' },
    h('div', { class: 'hd' },
      h('h1', null, ses.plantillaNombre),
      h('span', { class: 'tiny' }, 'Sesión suelta'),
    ),
    h('div', { class: 'scr-scroll', style: 'display:flex;flex-direction:column;justify-content:center' },
      h('div', { class: 'empty' }, 'Todavía no agregaste nada. Sumá el primer ejercicio y arrancá.'),
      h('button', {
        class: 'btn big', style: 'margin-top:16px',
        onclick: () => hojaAgregar(db, ses),
      }, h('span', { style: 'display:flex;align-items:center;gap:10px' }, icono('mas', 22, 2.25), 'Agregar ejercicio')),
    ),
  );
}

// ---------------------------------------------------------------- entrenar

function vistaEntrenar(db, ses) {
  const s = setActual(ses);
  const mov = db.ejercicios[s.ejercicioId];
  const vr = variante(db, s.varianteId);
  if (!ses.draft || ses.draft.setId !== s.id) recalcularDraft(db, ses);
  const d = ses.draft;
  const grupos = porEjercicio(ses);
  const gi = grupos.findIndex(g => g.exIdx === s.exIdx);
  const corrigiendo = s.estado === 'hecha';
  const r = resumen(ses);
  const todoListo = r.pendientes === 0;

  const pips = h('div', { class: 'pips' }, grupos.map((g, i) => h('i', {
    class: i === gi ? 'cur' : (g.sets.every(x => x.estado !== 'pendiente') ? 'done' : ''),
  })));
  const undoLbl = etiquetaUndo(ses);
  const top = h('div', { class: 'train-top' },
    h('div', { class: 'train-prog' },
      h('span', { class: 'kicker' }, `Ejercicio ${gi + 1} de ${totalEjercicios(ses)}`),
      pips,
    ),
    undoLbl && h('button', {
      class: 'undo',
      onclick: () => mutar(dd => { deshacer(dd, ses); toast('Deshecho'); }),
    }, h('span', null, `Deshacer: ${undoLbl}`), icono('deshacer', 16)),
  );

  const esf = esfuerzoDeSerie(s);
  const hayVariantes = variantesDe(db, s.ejercicioId).length > 1;
  const cabeza = h('div', { class: 'ex-head' },
    h('h2', null, mov?.nombre ?? 'Ejercicio'),
    h('div', { style: 'display:flex;align-items:center;gap:8px;flex-wrap:wrap' },
      hayVariantes && h('button', {
        class: 'chip', style: 'height:30px;padding:0 10px;font-size:12px;border-radius:9px',
        onclick: () => hojaVariantes(db, ses, s),
      }, vr?.nombre ?? 'Variante', icono('abajo', 13)),
      h('button', { class: 'link', style: 'border:0;padding:0', onclick: () => hojaTecnica(db, mov) },
        icono('tecnica', 14), 'Técnica'),
    ),
    h('div', { class: 'sub num' },
      `Serie ${s.serieIdx + 1} de ${s.series} · ${fRango(s.repsMin, s.repsMax)} reps`,
      esf ? h('span', { class: esf.ultima ? 'acc' : '' },
        ` · ${esf.rir} en el tanque${esf.ultima ? ', apretá esta' : ''}`) : null),
  );

  const pesoTxt = h('b', { class: 'num' }, fPeso(d.peso));
  const repsTxt = h('b', { class: 'num' }, String(d.reps));
  const paso = vr?.incremento ?? 2.5;

  const previoTxt = corrigiendo
    ? 'corrigiendo lo cargado'
    : d.origen?.tipo === 'sesion'
      ? `serie ${d.origen.serieIdx + 1} de hoy: ${fPeso(d.origen.peso)} × ${d.origen.reps}`
      : d.origen?.tipo === 'historial'
        ? `la vez pasada: ${fPeso(d.origen.peso)} × ${d.origen.reps}`
        : d.origen
          ? `lo dejaste en ${fPeso(d.origen.peso)} × ${d.origen.reps}`
          : d.hermana
            ? `en ${d.hermana.variante.nombre} venías ${fPeso(d.hermana.peso)} × ${d.hermana.reps}`
            : 'primera vez con esta variante';

  const cambiarPeso = (signo) => {
    ajustarDraft(ses, 'peso', signo, paso);
    pesoTxt.textContent = fPeso(d.peso);
    recordarCarga(db, s.varianteId, d.peso, d.reps);
    persistirPronto();
  };
  const cambiarReps = (signo) => {
    ajustarDraft(ses, 'reps', signo);
    repsTxt.textContent = String(d.reps);
    recordarCarga(db, s.varianteId, d.peso, d.reps);
    persistirPronto();
  };

  const cardPeso = h('div', { class: 'stepper' },
    h('div', { class: 'stepper-hd' },
      h('span', { class: 'kicker' }, etiquetaCarga(vr)),
      h('span', { class: 'tiny num' }, previoTxt),
    ),
    h('div', { class: 'stepper-body' },
      stepBtn('−', () => cambiarPeso(-1), 30),
      h('div', { class: 'sval' }, pesoTxt, h('span', null, 'kg')),
      stepBtn('+', () => cambiarPeso(+1), 30),
    ),
  );

  const cardReps = h('div', { class: 'stepper' },
    h('div', { class: 'stepper-hd' },
      h('span', { class: 'kicker' }, 'Reps'),
      h('span', { class: 'tiny num' }, `rango ${fRango(s.repsMin, s.repsMax)}`),
    ),
    h('div', { class: 'stepper-body' },
      stepBtn('−', () => cambiarReps(-1), 30),
      h('div', { class: 'sval' }, repsTxt),
      stepBtn('+', () => cambiarReps(+1), 30),
    ),
  );

  const opciones = ['4', '3', '2', '1', '0', 'Fallo'];
  const chips = h('div', { class: 'chips', style: 'flex-wrap:nowrap' },
    opciones.map(o => {
      const b = h('button', { class: 'chip wide' + (d.rir === o ? ' on' : '') }, o);
      b.onclick = () => {
        d.rir = d.rir === o ? null : o;
        for (const c of chips.children) c.classList.remove('on');
        if (d.rir) b.classList.add('on');
        persistirPronto();
      };
      return b;
    }),
  );

  const terminarAhora = () => confirmar({
    titulo: '¿Terminar el entrenamiento?',
    texto: `${r.hechas} de ${r.total} series.` +
      (r.pendientes ? `\n${plural(r.pendientes, 'serie queda pendiente y se registra como salteada', 'series quedan pendientes y se registran como salteadas')}.` : ''),
    ok: 'Terminar',
    onOk: () => {
      mantenerPantalla(false);
      mutar(dd => terminarSesion(dd));
      ir({ n: 'inicio' }, { reemplazar: true });
      toast('Sesión guardada');
    },
  });

  const completar = h('button', {
    class: 'btn completar',
    onclick: () => {
      prepararSonido();
      const res = mutar(dd => completarSerie(dd, ses, mov?.nombre ?? 'ejercicio'));
      if (!res) return;
      if (resumen(ses).pendientes === 0) { toast('Terminaste todas las series'); return; }
      if (res.descanso > 0) {
        mutar(() => arrancarDescanso(ses, res.descanso, res.set.id));
        mantenerPantalla(true);
      }
    },
  }, icono('tilde', 22, 2.75), corrigiendo ? 'Guardar corrección' : 'Completar serie');

  const pie = h('div', { class: 'train-foot' },
    todoListo
      ? h('button', { class: 'btn completar', onclick: terminarAhora }, icono('terminar', 22, 2.25), 'Terminar entrenamiento')
      : completar,
    h('div', { class: 'row' },
      h('button', {
        class: 'btn',
        onclick: () => mutar(dd => { saltearEjercicio(dd, ses, mov?.nombre ?? 'ejercicio'); toast('Ejercicio salteado'); }),
      }, icono('saltear', 16), 'Saltear'),
      h('button', { class: 'btn', onclick: () => hojaLoHecho(db, ses) },
        icono('lohecho', 16), `Lo hecho · ${hechas(ses).length}`),
    ),
    h('div', { class: 'row' },
      h('button', { class: 'btn ghost', style: 'height:44px;border:0;color:var(--fg-2);font-size:13px', onclick: () => hojaAgregar(db, ses) },
        icono('mas', 15), 'Agregar'),
      !todoListo && h('button', {
        class: 'btn ghost', style: 'height:44px;border:0;color:var(--fg-2);font-size:13px',
        onclick: terminarAhora,
      }, 'Terminar'),
    ),
  );

  return h('main', { class: 'scr' },
    h('div', { class: 'train' }, top, cabeza,
      h('div', { class: 'train-mid' }, cardPeso, cardReps,
        h('div', { class: 'stack tight' },
          h('span', { class: 'tiny', style: 'padding-left:2px' }, '¿Cuántas te quedaban?'),
          chips,
        ),
      ),
      pie,
    ),
  );
}

// ---------------------------------------------------------------- descanso

function vistaDescanso(db, ses) {
  const s = ses.sets.find(x => x.id === ses.rest.setId);
  const mov = db.ejercicios[s?.ejercicioId];

  const wrap = h('div', { class: 'ring-wrap' });
  const reloj = h('b', { class: 'num' }, mmss(restanteDescanso(ses)));
  const pintar = () => {
    const resta = restanteDescanso(ses);
    reloj.textContent = mmss(resta);
    wrap.replaceChildren(anillo(resta / ses.rest.dur), h('div', { class: 'ring-in' },
      reloj, h('span', { class: 'kicker' }, 'Descanso')));
  };
  pintar();

  // El pitido lo dispara el latido global de app.js, para que suene también si
  // te fuiste a otra pestaña. Acá solo se anima el anillo.
  S.tickers.push(() => {
    const resta = restanteDescanso(ses);
    if (resta <= 0) { mutar(() => {}); return; }
    const c = wrap.querySelector('circle:last-child');
    if (c) {
      const C = 2 * Math.PI * 104;
      c.setAttribute('stroke-dashoffset', String(C * (1 - resta / ses.rest.dur)));
    }
    reloj.textContent = mmss(resta);
  });

  const ajustar = (seg) => { ajustarDescanso(ses, seg); persistirPronto(); pintar(); };

  return h('main', { class: 'scr' },
    h('div', { class: 'rest' },
      h('div', { class: 'rest-main' },
        wrap,
        h('div', { class: 'sub', style: 'display:flex;align-items:center;gap:8px;text-align:center' },
          icono('descanso', 15),
          `${mov?.nombre ?? ''}, serie ${(s?.serieIdx ?? 0) + 1}`),
      ),
      h('div', { class: 'rest-foot' },
        h('div', { class: 'row' },
          h('button', { class: 'btn num', onclick: () => ajustar(30) }, '+30 s'),
          h('button', { class: 'btn num', onclick: () => ajustar(-30) }, '−30 s'),
        ),
        h('button', {
          class: 'btn ghost',
          onclick: () => { mantenerPantalla(false); mutar(() => cortarDescanso(ses)); },
        }, icono('saltear', 16), 'Saltar descanso'),
      ),
    ),
  );
}

function vistaDale(db, ses) {
  const s = ses.sets.find(x => x.id === ses.cursor);
  const mov = db.ejercicios[s?.ejercicioId];
  const seguir = () => { mantenerPantalla(false); mutar(() => cortarDescanso(ses)); };
  return h('main', { class: 'scr' },
    h('div', { class: 'dale', onclick: seguir },
      h('b', null, '¡Dale!'),
      h('span', null, s ? `${mov?.nombre ?? ''} · serie ${s.serieIdx + 1} de ${s.series}` : 'Seguí'),
    ),
  );
}

// ---------------------------------------------------------------- hojas

export function hojaTecnica(db, mov) {
  const tips = (mov?.tips || '').split('\n').map(t => t.trim()).filter(Boolean);
  abrirHoja({
    titulo: mov?.nombre ?? 'Técnica',
    meta: [...(mov?.prim || []), ...(mov?.sec || [])].map(labelMusculo).join(' · '),
    cuerpo: tips.length
      ? h('div', { class: 'bullets' }, tips.map(t => h('div', null, h('i'), h('p', null, t))))
      : h('p', { class: 'sub' }, 'Este movimiento todavía no tiene tips. Los podés escribir desde Entrenamientos.'),
    pie: h('button', { class: 'btn', style: 'flex:1', onclick: cerrarHoja }, icono('cerrar', 16), 'Cerrar'),
  });
}

/** Sustituir el implemento sin perder el movimiento ni mezclar historiales. */
function hojaVariantes(db, ses, set) {
  const mov = db.ejercicios[set.ejercicioId];
  abrirHoja({
    titulo: 'Cambiar variante',
    meta: mov?.nombre,
    ayuda: 'Cambia las series que faltan. Cada variante mantiene su propio peso.',
    cuerpo: h('div', { class: 'stack tight' },
      variantesDe(db, set.ejercicioId).map(v => {
        const actual = v.id === set.varianteId;
        return h('button', {
          class: 'listrow' + (actual ? '' : ''),
          style: actual ? 'border-color:var(--acc)' : '',
          onclick: () => {
            cerrarHoja();
            if (!actual) mutar(dd => { cambiarVariante(dd, ses, set.exIdx, v.id); toast(`Ahora: ${v.nombre}`); });
          },
        },
          h('span', { class: 'txt' },
            h('b', null, v.nombre),
            h('small', null, v.ultimo
              ? `último ${fPeso(v.ultimo.peso)} kg × ${v.ultimo.reps}`
              : 'sin registros todavía'),
          ),
          actual ? h('span', { class: 'badge on' }, 'En uso') : chev(),
        );
      }),
    ),
  });
}

/** Sumar un ejercicio a la sesión en curso. */
function hojaAgregar(db, ses) {
  const movs = Object.values(db.ejercicios).sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
  abrirHoja({
    titulo: 'Agregar a la sesión',
    alta: true,
    cuerpo: h('div', { class: 'stack tight' },
      movs.map(m => h('div', { class: 'grp' },
        h('div', { class: 'grp-hd' },
          h('b', null, m.nombre),
          h('span', { class: 'tiny' }, [...m.prim, ...m.sec].map(labelMusculo).join(', ')),
        ),
        h('div', { class: 'chips' },
          variantesDe(db, m.id).map(v => h('button', {
            class: 'chip',
            onclick: () => {
              cerrarHoja();
              mutar(dd => agregarEjercicio(dd, ses, { ejercicioId: m.id, varianteId: v.id }));
              toast(`${m.nombre} agregado`);
            },
          }, icono('mas', 13), v.nombre)),
        ),
      )),
    ),
  });
}

export function hojaLoHecho(db, ses) {
  const r = resumen(ses);
  const grupos = porEjercicio(ses);

  const cuerpo = grupos.map(g => {
    const hechasG = g.sets.filter(x => x.estado === 'hecha').length;
    const salteado = g.sets.every(x => x.estado === 'salteada');
    const nombre = nombreCompleto(db, g.ejercicioId, g.varianteId);

    if (salteado) {
      return h('div', { class: 'grp' },
        h('div', { class: 'grp-hd' },
          h('b', { class: 'dim' }, nombre),
          h('span', { class: 'badge' }, 'Salteado'),
        ),
        h('button', {
          class: 'setrow pend skip',
          onclick: () => { cerrarHoja(); mutar(dd => retomarEjercicio(dd, ses, g.exIdx, nombre)); },
        },
          h('i', null, icono('saltear', 12)),
          h('span', { class: 'dim' }, `${plural(g.sets.length, 'serie salteada', 'series salteadas')} · tocá para retomar`),
          chev(),
        ),
      );
    }

    return h('div', { class: 'grp' },
      h('div', { class: 'grp-hd' },
        h('b', null, nombre),
        h('span', { class: 'tiny num' }, `${hechasG} de ${g.sets.length}`),
      ),
      g.sets.map(x => {
        const hecha = x.estado === 'hecha';
        return h('button', {
          class: 'setrow' + (hecha ? '' : ' pend') + (x.id === ses.cursor ? ' cur' : ''),
          onclick: () => { cerrarHoja(); mutar(dd => irASet(dd, ses, x.id)); },
        },
          h('i', null, hecha ? icono('tilde', 14) : null),
          hecha
            ? h('span', { class: 'num' }, `Serie ${x.serieIdx + 1} — ${fPeso(x.peso)} kg × ${x.reps}`,
                x.rir ? h('em', null, ` · ${x.rir === 'Fallo' ? 'al fallo' : x.rir + ' en el tanque'}`) : null)
            : h('span', { class: 'num' }, `Serie ${x.serieIdx + 1} — ${x.estado === 'salteada' ? 'salteada' : 'pendiente'}`),
          chev(),
        );
      }),
    );
  });

  abrirHoja({
    titulo: 'Lo hecho',
    meta: `${ses.plantillaNombre} · ${r.hechas} de ${r.total} series`,
    ayuda: 'Tocá cualquier serie para volver ahí y corregirla.',
    alta: true,
    cuerpo,
  });
}
