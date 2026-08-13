import {
  h, plural, fDescanso, abrirHoja, cerrarHoja, confirmar, toast, stepBtn, fFechaLarga, fPeso,
  icono, chev,
} from './ui.js';
import { S, ir, mutar, volver } from './app.js';
import {
  MUSCULOS, labelMusculo, diaPorId, versionActual, uid, fRango, fEsfuerzo,
} from './data.js';

// El día se edita sobre un borrador. Guardar crea UNA versión nueva (append-only).
function borrador(db, diaId) {
  if (!S.borrador || S.borrador.diaId !== diaId) {
    const v = versionActual(diaPorId(db, diaId));
    S.borrador = { diaId, items: JSON.parse(JSON.stringify(v.items)), abierto: null };
  }
  return S.borrador;
}

function detalleItem(db, it) {
  const esf = fEsfuerzo(it.rirMin, it.rirMax);
  return `${it.series} × ${fRango(it.repsMin, it.repsMax)}` +
    (esf ? ` · ${esf}` : '') + ` · descanso ${fDescanso(it.descanso)}`;
}

// ------------------------------------------------------------ lista de días

export function pantallaRutina(db) {
  return h('main', { class: 'scr' },
    h('div', { class: 'hd' },
      h('h1', null, 'Rutina'),
      h('span', { class: 'tiny num' }, plural(db.rutina.dias.length, 'día', 'días')),
    ),
    h('div', { class: 'scr-scroll' },
      h('div', { class: 'stack', style: 'padding-top:14px' },
        db.rutina.dias.map(d => {
          const v = versionActual(d);
          const series = v.items.reduce((a, x) => a + x.series, 0);
          return h('div', { class: 'card' },
            h('div', { class: 'card-pad' },
              h('span', { style: 'font-size:19px;font-weight:700' }, d.nombre),
              d.foco && h('span', { class: 'sub' }, d.foco),
              h('span', { class: 'tiny num' }, `${plural(v.items.length, 'ejercicio', 'ejercicios')}, ${series} series`),
            ),
            h('div', { class: 'card-foot' },
              h('button', { onclick: () => { S.borrador = null; ir({ n: 'dia', diaId: d.id }); } }, 'Editar día'),
              h('div', { class: 'vr' }),
              h('button', { class: 'sec', onclick: () => ir({ n: 'versiones', diaId: d.id }) },
                icono('versiones', 15), 'Ver versiones'),
            ),
          );
        }),
        h('div', { class: 'frow', style: 'min-height:auto;padding:14px 16px;flex-direction:column;align-items:stretch;gap:10px' },
          h('span', { class: 'kicker' }, 'Objetivo semanal'),
          h('div', { style: 'display:flex;align-items:center;gap:10px' },
            h('span', { class: 'sub', style: 'flex:1' }, 'Sesiones por semana'),
            stepBtn('−', () => mutar(d => { d.rutina.objetivoSemanal = Math.max(1, d.rutina.objetivoSemanal - 1); })),
            h('span', { class: 'fval num' }, String(db.rutina.objetivoSemanal)),
            stepBtn('+', () => mutar(d => { d.rutina.objetivoSemanal = Math.min(14, d.rutina.objetivoSemanal + 1); })),
          ),
        ),
        h('button', {
          class: 'btn dashed',
          onclick: () => mutar(d => {
            const n = d.rutina.dias.length;
            d.rutina.dias.push({
              id: uid(), nombre: `Día ${String.fromCharCode(65 + n)}`, versionActual: 1,
              versiones: [{ n: 1, ts: Date.now(), nota: 'Día creado', items: [] }],
            });
          }),
        }, 'Agregar día'),
      ),
    ),
  );
}

// ------------------------------------------------------------ detalle del día

export function pantallaDia(db, ruta) {
  const dia = diaPorId(db, ruta.diaId);
  if (!dia) { queueMicrotask(volver); return h('main', { class: 'scr' }); }
  const b = borrador(db, dia.id);
  const lista = h('div', { class: 'stack tight', style: 'flex:1;min-height:0;overflow-y:auto;padding-bottom:8px' });

  const pintar = (arrastrando = null) => {
    lista.replaceChildren(
      ...b.items.map((it, i) => {
        const ej = db.ejercicios[it.ejercicioId];
        const abierto = b.abierto === i;
        const fila = h('div', {
          class: 'card' + (arrastrando === i ? ' drag' : ''), 'data-i': i,
          style: 'background:var(--surf-2);border-radius:14px' + (arrastrando === i ? ';border-color:var(--fg)' : ''),
        },
          h('div', { class: 'listrow', style: 'border:0;background:transparent;border-radius:0' },
            h('span', { class: 'handle', 'data-drag': '' }, icono('asa', 20)),
            h('button', {
              class: 'txt', style: 'text-align:left;background:none',
              onclick: () => { b.abierto = abierto ? null : i; pintar(); },
            },
              h('b', null, ej?.nombre ?? '—'),
              h('small', null, detalleItem(db, it)),
            ),
            chev(abierto ? 'abajo' : 'ir'),
          ),
          abierto && h('div', { style: 'display:flex;gap:8px;padding:0 12px 12px' },
            h('button', {
              class: 'btn solid', style: 'flex:1',
              onclick: () => ir({ n: 'editar-ej', diaId: dia.id, i }),
            }, icono('editar', 15), 'Editar'),
            h('button', {
              class: 'btn danger', style: 'flex:1',
              onclick: () => { b.items.splice(i, 1); b.abierto = null; pintar(); },
            }, icono('basura', 16), 'Quitar del día'),
          ),
        );
        return fila;
      }),
      h('button', { class: 'btn dashed', onclick: () => hojaAgregar(db, b, pintar) },
        icono('mas', 18), h('span', null, 'Agregar ejercicio')),
    );
    habilitarArrastre(lista, b, pintar);
  };
  pintar();

  const guardar = () => {
    const v = versionActual(dia);
    if (JSON.stringify(v.items) === JSON.stringify(b.items)) { toast('No hay cambios'); volver(); return; }
    mutar(d => {
      const dd = diaPorId(d, dia.id);
      const n = Math.max(...dd.versiones.map(x => x.n)) + 1;
      dd.versiones.push({ n, ts: Date.now(), nota: diferencia(d, v.items, b.items), items: JSON.parse(JSON.stringify(b.items)) });
      dd.versionActual = n;
    });
    S.borrador = null;
    toast('Guardado como versión nueva');
    volver();
  };

  return h('main', { class: 'scr' },
    h('div', { class: 'hd-back' },
      h('button', { class: 'back', onclick: () => { S.borrador = null; volver(); } }, icono('atras', 24, 2.25)),
      h('h1', null, dia.nombre),
    ),
    h('span', { class: 'tiny', style: 'flex:none' }, 'Arrastrá del asa para reordenar · tocá una fila para editar o quitar'),
    h('div', { style: 'display:flex;flex-direction:column;flex:1;min-height:0;padding-top:14px' }, lista),
    h('div', { class: 'row', style: 'padding:12px 0 16px;flex:none' },
      h('button', { class: 'btn', onclick: () => ir({ n: 'versiones', diaId: dia.id }) }, 'Ver versiones'),
      h('button', { class: 'btn solid', onclick: guardar }, 'Guardar día'),
    ),
  );
}

function habilitarArrastre(cont, b, pintar) {
  cont.querySelectorAll('[data-drag]').forEach(asa => {
    asa.addEventListener('pointerdown', (ev) => {
      ev.preventDefault();
      const filas = [...cont.querySelectorAll('[data-i]')];
      const medios = filas.map(f => { const r = f.getBoundingClientRect(); return r.top + r.height / 2; });
      let cur = Number(asa.closest('[data-i]').dataset.i);
      b.abierto = null;
      pintar(cur);
      const mover = (e) => {
        let destino = medios.findIndex(m => e.clientY < m);
        if (destino < 0) destino = filas.length - 1;
        if (destino !== cur) {
          const [m] = b.items.splice(cur, 1);
          b.items.splice(destino, 0, m);
          cur = destino;
          pintar(cur);
        }
      };
      const soltar = () => {
        document.removeEventListener('pointermove', mover);
        document.removeEventListener('pointerup', soltar);
        document.removeEventListener('pointercancel', soltar);
        pintar(null);
      };
      document.addEventListener('pointermove', mover);
      document.addEventListener('pointerup', soltar);
      document.addEventListener('pointercancel', soltar);
    });
  });
}

function diferencia(db, antes, ahora) {
  const nom = id => db.ejercicios[id]?.nombre ?? '—';
  const idsA = antes.map(x => x.ejercicioId), idsB = ahora.map(x => x.ejercicioId);
  const partes = [];
  for (const id of idsB) if (!idsA.includes(id)) partes.push('+ ' + nom(id));
  for (const id of idsA) if (!idsB.includes(id)) partes.push('− ' + nom(id));
  for (const a of antes) {
    const b = ahora.find(x => x.ejercicioId === a.ejercicioId);
    if (b && b.series !== a.series) partes.push(`${nom(a.ejercicioId)} ${a.series} → ${b.series} series`);
  }
  if (!partes.length && JSON.stringify(idsA) !== JSON.stringify(idsB)) partes.push('Reordenado');
  return partes.slice(0, 4).join('\n') || 'Cambios de parámetros';
}

function hojaAgregar(db, b, pintar) {
  const usados = new Set(b.items.map(x => x.ejercicioId));
  const libres = Object.values(db.ejercicios).filter(e => !usados.has(e.id))
    .sort((x, y) => x.nombre.localeCompare(y.nombre, 'es'));

  const agregar = (ejercicioId) => {
    b.items.push({ ejercicioId, series: 3, repsMin: 8, repsMax: 12, rirMin: 2, rirMax: 2, descanso: 90 });
    cerrarHoja(); pintar();
  };

  abrirHoja({
    titulo: 'Agregar ejercicio',
    alta: true,
    cuerpo: [
      h('button', {
        class: 'btn dashed',
        onclick: () => {
          const id = uid();
          mutar(d => { d.ejercicios[id] = { id, nombre: 'Ejercicio nuevo', prim: [], sec: [], incremento: 2.5, tipo: 'peso', tips: '' }; });
          agregar(id);
          ir({ n: 'editar-ej', diaId: b.diaId, i: b.items.length - 1 });
        },
      }, 'Crear un ejercicio nuevo'),
      h('div', { class: 'stack tight' },
        libres.map(e => h('button', { class: 'listrow', onclick: () => agregar(e.id) },
          h('span', { class: 'txt' },
            h('b', null, e.nombre),
            h('small', null, [...(e.prim || []), ...(e.sec || [])].map(labelMusculo).join(', ') || 'sin músculos declarados'),
          ),
          chev('mas'),
        )),
      ),
    ],
  });
}

// ------------------------------------------------------------ editar ejercicio

export function pantallaEditarEj(db, ruta) {
  const b = borrador(db, ruta.diaId);
  const it = b.items[ruta.i];
  if (!it) { queueMicrotask(volver); return h('main', { class: 'scr' }); }
  const orig = db.ejercicios[it.ejercicioId];
  const ej = JSON.parse(JSON.stringify(orig));
  const tmp = JSON.parse(JSON.stringify(it));

  const filaNum = (label, sub, leer, escribir, fmt = String, unidad = null) => {
    const val = h('span', { class: 'fval num' }, fmt(leer()), unidad && h('span', null, ' ' + unidad));
    const set = (d) => { escribir(d); val.replaceChildren(document.createTextNode(fmt(leer())), ...(unidad ? [h('span', null, ' ' + unidad)] : [])); };
    return h('div', { class: 'frow' },
      h('span', { class: 'flab' }, label, sub && h('small', null, sub)),
      stepBtn('−', () => set(-1)), val, stepBtn('+', () => set(+1)),
    );
  };

  const chipsM = (nivel, clase) => h('div', { class: 'chips' },
    MUSCULOS.map(({ id, label }) => {
      const on = () => (ej[nivel] || []).includes(id);
      const c = h('button', { class: 'chip ' + clase + (on() ? ' on' : '') }, label);
      c.onclick = () => {
        const l = ej[nivel] = ej[nivel] || [];
        const i = l.indexOf(id);
        if (i >= 0) l.splice(i, 1);
        else {
          l.push(id);
          // Primario y secundario son excluyentes: si estaba en el otro nivel, sale.
          const otro = nivel === 'prim' ? 'sec' : 'prim';
          const j = (ej[otro] || []).indexOf(id);
          if (j >= 0) ej[otro].splice(j, 1);
        }
        c.classList.toggle('on', on());
        if (repintarChips) repintarChips();
      };
      return c;
    }),
  );

  let repintarChips = null;
  const cajaPrim = h('div', { class: 'field', style: 'padding-top:6px' });
  const cajaSec = h('div', { class: 'field', style: 'padding-top:6px' });
  repintarChips = () => {
    cajaPrim.replaceChildren(h('span', { class: 'kicker on' }, 'Músculos primarios'), chipsM('prim', ''));
    cajaSec.replaceChildren(
      h('span', { class: 'kicker' }, 'Músculos secundarios'),
      h('span', { class: 'tiny' }, 'Cuentan media serie en el gráfico semanal.'),
      chipsM('sec', 'dash'),
    );
  };
  repintarChips();

  const nombreIn = h('input', { type: 'text', value: ej.nombre, enterkeyhint: 'done' });
  const tipsIn = h('textarea', { rows: 4, placeholder: 'Un tip por línea' }, ej.tips || '');

  let tipoSel = ej.tipo || 'peso';
  const TIPOS = [
    ['peso', 'Peso'],
    ['corporal', 'Corporal'],
    ['asistido', 'Asistido'],
  ];
  const botonesTipo = TIPOS.map(([k, label]) => {
    const b = h('button', { class: 'chip wide' + (tipoSel === k ? ' on' : '') }, label);
    b.onclick = () => {
      tipoSel = k;
      for (const x of botonesTipo) x.classList.remove('on');
      b.classList.add('on');
    };
    return b;
  });

  const guardar = () => {
    Object.assign(it, tmp);
    mutar(d => {
      const e = d.ejercicios[ej.id];
      e.nombre = nombreIn.value.trim() || e.nombre;
      e.prim = ej.prim; e.sec = ej.sec;
      e.incremento = ej.incremento; e.tipo = tipoSel;
      e.tips = tipsIn.value;
    });
    toast('Guardado en el borrador del día');
    volver();
  };

  return h('main', { class: 'scr' },
    h('div', { class: 'hd-back' },
      h('button', { class: 'back', onclick: volver }, icono('atras', 24, 2.25)),
      h('h1', null, 'Editar ejercicio'),
    ),
    h('div', { class: 'scr-scroll' },
      h('div', { class: 'stack tight', style: 'padding-top:6px' },
        h('div', { class: 'field' }, h('span', { class: 'kicker' }, 'Nombre'), nombreIn),
        h('span', { class: 'tiny' }, 'Renombrarlo no parte el historial: los registros siguen colgando del mismo ejercicio.'),
        filaNum('Series', null, () => tmp.series, d => { tmp.series = Math.max(1, Math.min(10, tmp.series + d)); }),
        filaNum('Reps mínimas', null, () => tmp.repsMin, d => { tmp.repsMin = Math.max(1, Math.min(tmp.repsMax, tmp.repsMin + d)); }),
        filaNum('Reps máximas', null, () => tmp.repsMax, d => { tmp.repsMax = Math.max(tmp.repsMin, Math.min(50, tmp.repsMax + d)); }),
        filaNum('Esfuerzo mínimo', 'en el tanque', () => tmp.rirMin ?? 2,
          d => { tmp.rirMin = Math.max(0, Math.min(tmp.rirMax ?? 5, (tmp.rirMin ?? 2) + d)); }),
        filaNum('Esfuerzo máximo', 'en el tanque', () => tmp.rirMax ?? tmp.rirMin ?? 2,
          d => { tmp.rirMax = Math.max(tmp.rirMin ?? 0, Math.min(5, (tmp.rirMax ?? tmp.rirMin ?? 2) + d)); }),
        filaNum('Descanso', null, () => tmp.descanso, d => { tmp.descanso = Math.max(0, Math.min(600, tmp.descanso + d * 15)); }, fDescanso),
        filaNum('Incremento de carga', null, () => ej.incremento, d => { ej.incremento = Math.max(0.5, Math.min(10, Math.round((ej.incremento + d * 0.5) * 2) / 2)); }, fPeso, 'kg'),
        h('div', { class: 'field', style: 'padding-top:6px' },
          h('span', { class: 'kicker' }, 'Tipo de carga'),
          h('div', { class: 'row' }, botonesTipo),
          tipoSel === 'asistido' && h('span', { class: 'tiny' },
            'En asistido el número es la ayuda de la máquina: bajarlo es progresar.'),
        ),
        cajaPrim,
        cajaSec,
        h('div', { class: 'field', style: 'padding-top:6px' },
          h('span', { class: 'kicker' }, 'Tips de técnica'), tipsIn,
        ),
      ),
    ),
    h('div', { class: 'row', style: 'padding:12px 0 16px;flex:none;border-top:1px solid var(--line)' },
      h('button', { class: 'btn', style: 'flex:1', onclick: volver }, 'Cancelar'),
      h('button', { class: 'btn primary', style: 'flex:2', onclick: guardar }, 'Guardar'),
    ),
  );
}

// ------------------------------------------------------------ versiones

export function pantallaVersiones(db, ruta) {
  const dia = diaPorId(db, ruta.diaId);
  if (!dia) { queueMicrotask(volver); return h('main', { class: 'scr' }); }
  const vs = [...dia.versiones].sort((a, b) => b.n - a.n);

  return h('main', { class: 'scr' },
    h('div', { class: 'hd-back' },
      h('button', { class: 'back', onclick: volver }, icono('atras', 24, 2.25)),
      h('h1', null, 'Versiones · ' + dia.nombre.split('·')[0].trim()),
    ),
    h('div', { class: 'scr-scroll' },
      h('div', { style: 'padding-top:8px' },
        vs.map((v, i) => {
          const actual = v.n === dia.versionActual;
          const series = v.items.reduce((a, x) => a + x.series, 0);
          return h('div', { class: 'tl' },
            h('div', { class: 'tl-rail' },
              i > 0 && h('span', { class: 'l', style: 'flex:none;height:20px' }),
              h('span', { class: 'd' + (actual ? ' on' : '') }),
              i < vs.length - 1 && h('span', { class: 'l' }),
            ),
            h('div', { class: 'tl-body' },
              h('div', { class: 'card', style: actual ? '' : 'background:transparent' },
                h('div', { class: 'card-pad' },
                  h('div', { style: 'display:flex;align-items:center;gap:10px' },
                    h('span', { class: 'num', style: 'font-size:18px;font-weight:700' }, 'Versión ' + v.n),
                    actual && h('span', { class: 'badge on' }, 'Actual'),
                  ),
                  h('span', { class: 'sub num' }, `${fFechaLarga(v.ts)} · ${plural(v.items.length, 'ejercicio', 'ejercicios')}, ${series} series`),
                  v.nota && h('div', { class: 'stack', style: 'gap:4px;margin-top:4px' },
                    v.nota.split('\n').map(l => h('span', {
                      style: 'font-size:14px;color:' + (l.startsWith('−') ? 'var(--fg-2)' : 'var(--fg)'),
                    }, l))),
                ),
                h('div', { class: 'card-foot' },
                  h('button', { onclick: () => hojaVerVersion(db, dia, v) }, 'Ver'),
                  !actual && h('div', { class: 'vr' }),
                  !actual && h('button', {
                    class: 'sec',
                    onclick: () => confirmar({
                      titulo: `¿Volver a la versión ${v.n}?`,
                      texto: 'Se crea una versión nueva con ese contenido. No se borra nada del historial.',
                      ok: 'Volver a esta',
                      onOk: () => {
                        mutar(d => {
                          const dd = diaPorId(d, dia.id);
                          const n = Math.max(...dd.versiones.map(x => x.n)) + 1;
                          dd.versiones.push({ n, ts: Date.now(), nota: `Vuelta a la versión ${v.n}`, items: JSON.parse(JSON.stringify(v.items)) });
                          dd.versionActual = n;
                        });
                        S.borrador = null;
                        toast(`Ahora corre la versión ${Math.max(...dia.versiones.map(x => x.n))}`);
                      },
                    }),
                  }, 'Volver a esta'),
                ),
              ),
            ),
          );
        }),
      ),
    ),
  );
}

function hojaVerVersion(db, dia, v) {
  abrirHoja({
    titulo: 'Versión ' + v.n,
    meta: fFechaLarga(v.ts),
    alta: true,
    cuerpo: h('div', { class: 'stack tight' },
      v.items.map(it => h('div', { class: 'listrow' },
        h('span', { class: 'txt' },
          h('b', null, db.ejercicios[it.ejercicioId]?.nombre ?? '—'),
          h('small', null, detalleItem(db, it)),
        ),
      )),
    ),
    pie: h('button', { class: 'btn', style: 'flex:1', onclick: cerrarHoja }, icono('cerrar', 16), 'Cerrar'),
  });
}
