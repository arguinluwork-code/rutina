import {
  h, fPeso, mmss, anillo, abrirHoja, cerrarHoja, stepBtn, toast, confirmar,
  pitido, prepararSonido, mantenerPantalla, plural, icono, chev,
} from './ui.js';
import { S, ir, mutar, volver } from './app.js';
import { guardar } from './db.js';
import {
  setActual, indiceActual, porEjercicio, totalEjercicios, resumen, hechas,
  ajustarDraft, recalcularDraft, recordarCarga, completarSerie, saltearEjercicio, retomarEjercicio, irASet,
  deshacer, etiquetaUndo, arrancarDescanso, restanteDescanso, ajustarDescanso,
  cortarDescanso, terminarSesion,
} from './session.js';
import { fRango, fEsfuerzo, etiquetaCarga } from './data.js';

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
    // Se acabó. Si volvimos mucho después, no tiene sentido el aviso a pantalla llena.
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
  return vistaEntrenar(db, ses);
}

// ---------------------------------------------------------------- entrenar

function vistaEntrenar(db, ses) {
  const s = setActual(ses);
  const ej = db.ejercicios[s.ejercicioId];
  if (!ses.draft || ses.draft.setId !== s.id) recalcularDraft(db, ses);
  const d = ses.draft;
  const grupos = porEjercicio(ses);
  const gi = grupos.findIndex(g => g.exIdx === s.exIdx);
  const corrigiendo = s.estado === 'hecha';
  const r = resumen(ses);
  const todoListo = r.pendientes === 0;

  // --- cabecera: progreso + deshacer
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

  // --- ejercicio
  const esf = fEsfuerzo(s.rirMin, s.rirMax);
  const cabeza = h('div', { class: 'ex-head' },
    h('h2', null, ej?.nombre ?? 'Ejercicio'),
    h('div', { class: 'sub num' },
      `Serie ${s.serieIdx + 1} de ${s.series} · ${fRango(s.repsMin, s.repsMax)} reps` +
      (esf ? ` · Objetivo ${esf}` : '')),
    h('button', { class: 'link', onclick: () => hojaTecnica(ej) }, icono('tecnica', 14), 'Ver técnica'),
  );

  // --- steppers
  const pesoTxt = h('b', { class: 'num' }, fPeso(d.peso));
  const repsTxt = h('b', { class: 'num' }, String(d.reps));
  const paso = ej?.incremento ?? 2.5;

  const previoTxt = corrigiendo
    ? 'corrigiendo lo cargado'
    : d.origen?.tipo === 'sesion'
      ? `serie ${d.origen.serieIdx + 1} de hoy: ${fPeso(d.origen.peso)} × ${d.origen.reps}`
      : d.origen?.tipo === 'historial'
        ? `la vez pasada: ${fPeso(d.origen.peso)} × ${d.origen.reps}`
        : d.origen
          ? `lo dejaste en ${fPeso(d.origen.peso)} × ${d.origen.reps}`
          : 'primera vez con este ejercicio';

  // Cada ajuste se recuerda en el ejercicio, aunque no llegues a completar la
  // serie: si la máquina está ocupada y salteás, el peso no se pierde.
  const cambiarPeso = (signo) => {
    ajustarDraft(ses, 'peso', signo, paso);
    pesoTxt.textContent = fPeso(d.peso);
    recordarCarga(db, s.ejercicioId, d.peso, d.reps);
    persistirPronto();
  };
  const cambiarReps = (signo) => {
    ajustarDraft(ses, 'reps', signo);
    repsTxt.textContent = String(d.reps);
    recordarCarga(db, s.ejercicioId, d.peso, d.reps);
    persistirPronto();
  };

  const cardPeso = h('div', { class: 'stepper' },
    h('div', { class: 'stepper-hd' },
      h('span', { class: 'kicker' }, etiquetaCarga(ej)),
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

  // --- esfuerzo (opcional, un tap)
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
  const bloqueRir = h('div', { class: 'stack tight' },
    h('span', { class: 'tiny', style: 'padding-left:2px' }, '¿Cuántas te quedaban?'),
    chips,
  );

  // --- pie
  const completar = h('button', {
    class: 'btn completar',
    onclick: () => {
      prepararSonido();
      const res = mutar(dd => completarSerie(dd, ses, ej?.nombre ?? 'ejercicio'));
      if (!res) return;
      if (resumen(ses).pendientes === 0) { toast('Terminaste todas las series'); return; }
      if (res.descanso > 0) {
        mutar(() => arrancarDescanso(ses, res.descanso, res.set.id));
        mantenerPantalla(true);
      }
    },
  }, icono('tilde', 22, 2.75), corrigiendo ? 'Guardar corrección' : 'Completar serie');

  const terminar = h('button', {
    class: 'btn completar',
    onclick: () => confirmar({
      titulo: '¿Terminar el entrenamiento?',
      texto: `${r.hechas} de ${r.total} series.` + (r.salteadas ? `\n${plural(r.salteadas, 'serie salteada', 'series salteadas')}.` : ''),
      ok: 'Terminar',
      onOk: () => { mantenerPantalla(false); mutar(dd => terminarSesion(dd)); ir({ n: 'inicio' }, { reemplazar: true }); toast('Sesión guardada'); },
    }),
  }, icono('terminar', 22, 2.25), 'Terminar entrenamiento');

  const pie = h('div', { class: 'train-foot' },
    todoListo ? terminar : completar,
    h('div', { class: 'row' },
      h('button', {
        class: 'btn',
        onclick: () => mutar(dd => { saltearEjercicio(dd, ses, ej?.nombre ?? 'ejercicio'); toast('Ejercicio salteado'); }),
      }, icono('saltear', 16), 'Saltear'),
      h('button', { class: 'btn', onclick: () => hojaLoHecho(db, ses) },
        icono('lohecho', 16), `Lo hecho · ${hechas(ses).length}`),
    ),
    !todoListo && h('button', {
      class: 'btn ghost', style: 'height:44px;border:0;color:var(--fg-2);font-size:13px',
      onclick: () => confirmar({
        titulo: '¿Terminar el entrenamiento?',
        texto: `${r.hechas} de ${r.total} series.\n${plural(r.pendientes, 'serie queda pendiente y se registra como salteada', 'series quedan pendientes y se registran como salteadas')}.`,
        ok: 'Terminar',
        onOk: () => { mantenerPantalla(false); mutar(dd => terminarSesion(dd)); ir({ n: 'inicio' }, { reemplazar: true }); toast('Sesión guardada'); },
      }),
    }, 'Terminar entrenamiento'),
  );

  return h('main', { class: 'scr' },
    h('div', { class: 'train' }, top, cabeza,
      h('div', { class: 'train-mid' }, cardPeso, cardReps, bloqueRir),
      pie,
    ),
  );
}

// ---------------------------------------------------------------- descanso

function vistaDescanso(db, ses) {
  const s = ses.sets.find(x => x.id === ses.rest.setId);
  const ej = db.ejercicios[s?.ejercicioId];

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
          `Descanso — ${ej?.nombre ?? ''}, serie ${(s?.serieIdx ?? 0) + 1}`),
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
  const ej = db.ejercicios[s?.ejercicioId];
  const seguir = () => { mantenerPantalla(false); mutar(() => cortarDescanso(ses)); };
  return h('main', { class: 'scr' },
    h('div', { class: 'dale', onclick: seguir },
      h('b', null, '¡Dale!'),
      h('span', null, s ? `${ej?.nombre ?? ''} · serie ${s.serieIdx + 1} de ${s.series}` : 'Seguí'),
    ),
  );
}

// ---------------------------------------------------------------- hojas

export function hojaTecnica(ej) {
  const tips = (ej?.tips || '').split('\n').map(t => t.trim()).filter(Boolean);
  abrirHoja({
    titulo: ej?.nombre ?? 'Técnica',
    meta: 'Técnica',
    cuerpo: tips.length
      ? h('div', { class: 'bullets' }, tips.map(t => h('div', null, h('i'), h('p', null, t))))
      : h('p', { class: 'sub' }, 'Este ejercicio todavía no tiene tips. Los podés escribir desde Rutina → editar ejercicio.'),
    pie: h('button', { class: 'btn', style: 'flex:1', onclick: cerrarHoja }, icono('cerrar', 16), 'Cerrar'),
  });
}

export function hojaLoHecho(db, ses) {
  const r = resumen(ses);
  const grupos = porEjercicio(ses);

  const cuerpo = grupos.map(g => {
    const ej = db.ejercicios[g.ejercicioId];
    const hechasG = g.sets.filter(x => x.estado === 'hecha').length;
    const salteado = g.sets.every(x => x.estado === 'salteada');

    if (salteado) {
      return h('div', { class: 'grp' },
        h('div', { class: 'grp-hd' },
          h('b', { class: 'dim' }, ej?.nombre ?? ''),
          h('span', { class: 'badge' }, 'Salteado'),
        ),
        h('button', {
          class: 'setrow pend skip',
          onclick: () => { cerrarHoja(); mutar(dd => retomarEjercicio(dd, ses, g.exIdx, ej?.nombre ?? '')); },
        },
          h('i', null, icono('saltear', 12)),
          h('span', { class: 'dim' }, `${plural(g.sets.length, 'serie salteada', 'series salteadas')} · tocá para retomar`),
          chev(),
        ),
      );
    }

    return h('div', { class: 'grp' },
      h('div', { class: 'grp-hd' },
        h('b', null, ej?.nombre ?? ''),
        h('span', { class: 'tiny num' }, `${hechasG} de ${g.sets.length}`),
      ),
      g.sets.map(x => {
        const hecha = x.estado === 'hecha';
        const esActual = x.id === ses.cursor;
        return h('button', {
          class: 'setrow' + (hecha ? '' : ' pend') + (esActual ? ' cur' : ''),
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
    meta: `${ses.diaNombre.split('·')[0].trim()} · ${r.hechas} de ${r.total} series`,
    ayuda: 'Tocá cualquier serie para volver ahí y corregirla.',
    alta: true,
    cuerpo,
  });
}
