import {
  h, plural, fDescanso, abrirHoja, cerrarHoja, confirmar, toast, stepBtn,
  fFechaLarga, fPeso, icono, chev,
} from './ui.js';
import { S, ir, mutar, volver } from './app.js';
import { guardar } from './db.js';
import {
  MUSCULOS, musculo, labelMusculo, plantillaPorId, versionActual, itemsDe,
  seriesDePlantilla, aporteDePlantilla, variantesDe, variante, nombreCompleto,
  uid, fRango, fEsfuerzo, PASO,
} from './data.js';

// El entrenamiento se edita sobre un borrador. Guardar crea UNA versión nueva.
function borrador(db, plantillaId) {
  if (!S.borrador || S.borrador.plantillaId !== plantillaId) {
    const v = versionActual(plantillaPorId(db, plantillaId));
    S.borrador = { plantillaId, items: JSON.parse(JSON.stringify(v.items)), abierto: null };
  }
  return S.borrador;
}

function detalleItem(db, it) {
  const esf = fEsfuerzo(it.rirMin, it.rirMax);
  return `${it.series} × ${fRango(it.repsMin, it.repsMax)}` +
    (esf ? ` · ${esf}` : '') + ` · ${fDescanso(it.descanso)}`;
}

// ------------------------------------------------------------ lista

export function pantallaPlantillas(db) {
  return h('main', { class: 'scr' },
    h('div', { class: 'hd' },
      h('h1', null, 'Entrenamientos'),
      h('span', { class: 'tiny num' }, plural(db.plantillas.length, 'plantilla', 'plantillas')),
    ),
    h('div', { class: 'scr-scroll' },
      h('div', { class: 'stack', style: 'padding-top:14px' },
        db.plantillas.map(p => {
          const aporte = aporteDePlantilla(db, p.id);
          const top = Object.entries(aporte).sort((a, b) => b[1] - a[1]).slice(0, 3)
            .map(([id, n]) => `${labelMusculo(id)} ${n}`).join(' · ');
          return h('div', { class: 'card' },
            h('div', { class: 'card-pad' },
              h('span', { style: 'font-size:19px;font-weight:700' }, p.nombre),
              p.foco && h('span', { class: 'sub' }, p.foco),
              h('span', { class: 'tiny num' },
                `${seriesDePlantilla(db, p.id)} series · ${plural(itemsDe(db, p.id).length, 'ejercicio', 'ejercicios')}`),
              top && h('span', { class: 'tiny num', style: 'color:var(--fg-2)' }, top),
            ),
            h('div', { class: 'card-foot' },
              h('button', { onclick: () => { S.borrador = null; ir({ n: 'plantilla', id: p.id }); } },
                icono('editar', 15), 'Editar'),
              h('div', { class: 'vr' }),
              h('button', { class: 'sec', onclick: () => ir({ n: 'versiones', id: p.id }) },
                icono('versiones', 15), 'Versiones'),
            ),
          );
        }),

        h('button', {
          class: 'btn dashed',
          onclick: () => mutar(d => {
            const id = uid();
            d.plantillas.push({
              id, nombre: 'Entrenamiento nuevo', foco: '', versionActual: 1,
              versiones: [{ n: 1, ts: Date.now(), nota: 'Creada', items: [] }],
            });
            S.borrador = null;
            ir({ n: 'plantilla', id });
          }),
        }, icono('mas', 18), 'Nueva plantilla'),

        h('hr', { class: 'hr' }),

        h('button', { class: 'listrow', onclick: () => ir({ n: 'objetivos' }) },
          h('span', { class: 'txt' },
            h('b', null, 'Objetivos semanales'),
            h('small', null, 'Series por músculo que guían la semana'),
          ),
          chev(),
        ),

        filaConfig(db, 'Sesiones por semana', 'objetivoSemanal', 1, 14),
        filaConfig(db, 'Tope de series por sesión', 'maxSeriesSesion', 8, 40),
      ),
    ),
  );
}

/**
 * Actualiza el número en el lugar y persiste. Repintar la pantalla entera acá
 * destruiría el botón mientras lo tenés apretado.
 */
function filaConfig(db, label, campo, min, max) {
  const val = h('span', { class: 'fval num' }, String(db.config[campo]));
  const set = (d) => {
    db.config[campo] = Math.max(min, Math.min(max, db.config[campo] + d));
    val.textContent = String(db.config[campo]);
    guardar(db);
  };
  return h('div', { class: 'frow' },
    h('span', { class: 'flab' }, label),
    stepBtn('−', () => set(-1), 24), val, stepBtn('+', () => set(+1), 24),
  );
}

// ------------------------------------------------------------ objetivos

export function pantallaObjetivos(db) {
  const grupos = [1, 2, 3].map(p => ({
    p, items: MUSCULOS.filter(m => m.prioridad === p),
  }));
  const titulo = { 1: 'Prioridad', 2: 'Sostén', 3: 'Mantenimiento' };

  return h('main', { class: 'scr' },
    h('div', { class: 'hd-back' },
      h('button', { class: 'back', onclick: volver }, icono('atras', 24, 2.25)),
      h('h1', null, 'Objetivos semanales'),
    ),
    h('div', { class: 'scr-scroll', style: 'padding-top:8px' },
      h('div', { class: 'stack' },
        h('span', { class: 'tiny', style: 'line-height:1.45' },
          'En series fraccionadas: el músculo primario de un ejercicio suma 1 por serie y cada secundario 0.5. ' +
          'Los números están calibrados contra 3 o 4 sesiones de hasta ' + db.config.maxSeriesSesion + ' series.'),
        grupos.map(g => h('div', { class: 'stack tight' },
          h('span', { class: 'sec-title' }, titulo[g.p]),
          g.items.map(m => h('button', {
            class: 'listrow',
            onclick: () => abrirHoja({
              titulo: m.label,
              meta: `${m.objMin}–${m.objMax} por semana`,
              cuerpo: [
                h('p', { class: 'sub', style: 'font-size:15px;line-height:1.5;margin:0' }, m.nota),
                h('p', { class: 'tiny', style: 'margin:0' },
                  `Recuperación sugerida: ${m.recuperacion} h entre estímulos fuertes.`),
              ],
              pie: h('button', { class: 'btn', style: 'flex:1', onclick: cerrarHoja }, icono('cerrar', 16), 'Cerrar'),
            }),
          },
            h('span', { class: 'txt' },
              h('b', null, m.label),
              h('small', null, `${m.recuperacion} h de recuperación`),
            ),
            h('span', { class: 'num', style: 'font-size:17px;font-weight:700;flex:none' }, `${m.objMin}–${m.objMax}`),
            chev(),
          )),
        )),
      ),
    ),
  );
}

// ------------------------------------------------------------ detalle

export function pantallaPlantilla(db, ruta) {
  const pl = plantillaPorId(db, ruta.id);
  if (!pl) { queueMicrotask(volver); return h('main', { class: 'scr' }); }
  const b = borrador(db, pl.id);
  const lista = h('div', { class: 'stack tight', 'data-scroll': '', style: 'flex:1;min-height:0;padding-bottom:8px' });

  const totalSeries = () => b.items.reduce((a, x) => a + x.series, 0);
  const contador = h('span', { class: 'tiny num' });
  const actualizarContador = () => {
    const t = totalSeries();
    contador.textContent = `${t} series`;
    contador.style.color = t > db.config.maxSeriesSesion ? 'var(--warn)' : 'var(--fg-2)';
  };

  const pintar = (arrastrando = null) => {
    actualizarContador();
    lista.replaceChildren(
      ...b.items.map((it, i) => {
        const abierto = b.abierto === i;
        return h('div', {
          class: 'card', 'data-i': i,
          style: 'background:var(--surf-2);border-radius:14px' + (arrastrando === i ? ';border-color:var(--fg)' : ''),
        },
          h('div', { class: 'listrow', style: 'border:0;background:transparent;border-radius:0' },
            h('span', { class: 'handle', 'data-drag': '' }, icono('asa', 20)),
            h('button', {
              class: 'txt', style: 'text-align:left;background:none',
              onclick: () => { b.abierto = abierto ? null : i; pintar(); },
            },
              h('b', null, nombreCompleto(db, it.ejercicioId, it.varianteId)),
              h('small', null, detalleItem(db, it)),
            ),
            chev(abierto ? 'abajo' : 'ir'),
          ),
          abierto && h('div', { style: 'display:flex;gap:8px;padding:0 12px 12px' },
            h('button', {
              class: 'btn solid', style: 'flex:1',
              onclick: () => ir({ n: 'item', id: pl.id, i }),
            }, icono('editar', 15), 'Editar'),
            h('button', {
              class: 'btn danger', style: 'flex:1',
              onclick: () => { b.items.splice(i, 1); b.abierto = null; pintar(); },
            }, icono('basura', 16), 'Quitar'),
          ),
        );
      }),
      h('button', { class: 'btn dashed', onclick: () => hojaAgregar(db, b, pintar) },
        icono('mas', 18), h('span', null, 'Agregar ejercicio')),
    );
    habilitarArrastre(lista, b, pintar);
  };
  pintar();

  const nombreIn = h('input', { type: 'text', value: pl.nombre, enterkeyhint: 'done' });
  const focoIn = h('input', { type: 'text', value: pl.foco || '', placeholder: 'Foco (opcional)' });

  const guardarTodo = () => {
    const v = versionActual(pl);
    const cambioNombre = nombreIn.value.trim() !== pl.nombre || focoIn.value.trim() !== (pl.foco || '');
    const cambioItems = JSON.stringify(v.items) !== JSON.stringify(b.items);
    if (!cambioNombre && !cambioItems) { toast('No hay cambios'); volver(); return; }
    mutar(d => {
      const p = plantillaPorId(d, pl.id);
      p.nombre = nombreIn.value.trim() || p.nombre;
      p.foco = focoIn.value.trim();
      if (cambioItems) {
        const n = Math.max(...p.versiones.map(x => x.n)) + 1;
        p.versiones.push({ n, ts: Date.now(), nota: diferencia(d, v.items, b.items), items: JSON.parse(JSON.stringify(b.items)) });
        p.versionActual = n;
      }
    });
    S.borrador = null;
    toast(cambioItems ? 'Guardado como versión nueva' : 'Guardado');
    volver();
  };

  return h('main', { class: 'scr' },
    h('div', { class: 'hd-back' },
      h('button', { class: 'back', onclick: () => { S.borrador = null; volver(); } }, icono('atras', 24, 2.25)),
      h('h1', null, pl.nombre),
      h('div', { style: 'flex:1' }),
      contador,
    ),
    h('div', { class: 'row', style: 'flex:none;padding-bottom:8px' }, nombreIn, focoIn),
    h('span', { class: 'tiny', style: 'flex:none' }, 'Arrastrá del asa para reordenar · tocá una fila para editar o quitar'),
    h('div', { style: 'display:flex;flex-direction:column;flex:1;min-height:0;padding-top:12px' }, lista),
    h('div', { class: 'row', style: 'padding:12px 0 16px;flex:none' },
      h('button', { class: 'btn', onclick: () => ir({ n: 'versiones', id: pl.id }) }, icono('versiones', 15), 'Versiones'),
      h('button', { class: 'btn solid', onclick: guardarTodo }, 'Guardar'),
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
  const nom = it => nombreCompleto(db, it.ejercicioId, it.varianteId);
  const partes = [];
  for (const it of ahora) if (!antes.some(x => x.varianteId === it.varianteId)) partes.push('+ ' + nom(it));
  for (const it of antes) if (!ahora.some(x => x.varianteId === it.varianteId)) partes.push('− ' + nom(it));
  for (const a of antes) {
    const b = ahora.find(x => x.varianteId === a.varianteId);
    if (b && b.series !== a.series) partes.push(`${nom(a)} ${a.series} → ${b.series} series`);
  }
  return partes.slice(0, 4).join('\n') || 'Cambios de parámetros';
}

function hojaAgregar(db, b, pintar) {
  const agregar = (ejercicioId, varianteId) => {
    b.items.push({ ejercicioId, varianteId, series: 3, repsMin: 8, repsMax: 12, rirMin: 1, rirMax: 2, descanso: 90 });
    cerrarHoja(); pintar();
  };
  const movs = Object.values(db.ejercicios).sort((a, b2) => a.nombre.localeCompare(b2.nombre, 'es'));

  abrirHoja({
    titulo: 'Agregar ejercicio',
    alta: true,
    cuerpo: h('div', { class: 'stack tight' },
      movs.map(m => {
        const vs = variantesDe(db, m.id);
        return h('div', { class: 'grp' },
          h('div', { class: 'grp-hd' },
            h('b', null, m.nombre),
            h('span', { class: 'tiny' }, [...m.prim, ...m.sec].map(labelMusculo).join(', ')),
          ),
          h('div', { class: 'chips' },
            vs.map(v => h('button', { class: 'chip', onclick: () => agregar(m.id, v.id) },
              icono('mas', 13), v.nombre)),
          ),
        );
      }),
    ),
  });
}

// ------------------------------------------------------------ item

export function pantallaItem(db, ruta) {
  const b = borrador(db, ruta.id);
  const it = b.items[ruta.i];
  if (!it) { queueMicrotask(volver); return h('main', { class: 'scr' }); }
  const mov = db.ejercicios[it.ejercicioId];
  const tmp = JSON.parse(JSON.stringify(it));

  const filaNum = (label, sub, leer, escribir, fmt = String, unidad = null) => {
    const val = h('span', { class: 'fval num' }, fmt(leer()), unidad && h('span', null, ' ' + unidad));
    const set = (d) => {
      escribir(d);
      val.replaceChildren(document.createTextNode(fmt(leer())), ...(unidad ? [h('span', null, ' ' + unidad)] : []));
    };
    return h('div', { class: 'frow' },
      h('span', { class: 'flab' }, label, sub && h('small', null, sub)),
      stepBtn('−', () => set(-1), 24), val, stepBtn('+', () => set(+1), 24),
    );
  };

  // Selector de variante: cambia el implemento sin perder el movimiento.
  const cajaVar = h('div', { class: 'chips' });
  const pintarVariantes = () => {
    cajaVar.replaceChildren(
      ...variantesDe(db, it.ejercicioId).map(v => {
        const c = h('button', { class: 'chip' + (tmp.varianteId === v.id ? ' on' : '') }, v.nombre);
        c.onclick = () => { tmp.varianteId = v.id; pintarVariantes(); };
        return c;
      }),
      h('button', {
        class: 'chip dash',
        onclick: () => hojaNuevaVariante(db, it.ejercicioId, (id) => { tmp.varianteId = id; pintarVariantes(); }),
      }, icono('mas', 13), 'Nueva'),
    );
  };
  pintarVariantes();

  const guardar = () => {
    Object.assign(it, tmp);
    toast('Guardado en el borrador');
    volver();
  };

  return h('main', { class: 'scr' },
    h('div', { class: 'hd-back' },
      h('button', { class: 'back', onclick: volver }, icono('atras', 24, 2.25)),
      h('h1', null, mov?.nombre ?? 'Ejercicio'),
    ),
    h('div', { class: 'scr-scroll' },
      h('div', { class: 'stack tight', style: 'padding-top:6px' },
        h('div', { class: 'field' },
          h('span', { class: 'kicker' }, 'Variante'),
          h('span', { class: 'tiny' }, 'Cada una guarda su propio peso. Cambiarla no mezcla los historiales.'),
          cajaVar,
        ),
        filaNum('Series', null, () => tmp.series, d => { tmp.series = Math.max(1, Math.min(10, tmp.series + d)); }),
        filaNum('Reps mínimas', null, () => tmp.repsMin, d => { tmp.repsMin = Math.max(1, Math.min(tmp.repsMax, tmp.repsMin + d)); }),
        filaNum('Reps máximas', null, () => tmp.repsMax, d => { tmp.repsMax = Math.max(tmp.repsMin, Math.min(50, tmp.repsMax + d)); }),
        filaNum('Esfuerzo mínimo', 'en el tanque', () => tmp.rirMin ?? 2,
          d => { tmp.rirMin = Math.max(0, Math.min(tmp.rirMax ?? 5, (tmp.rirMin ?? 2) + d)); }),
        filaNum('Esfuerzo máximo', 'en el tanque', () => tmp.rirMax ?? tmp.rirMin ?? 2,
          d => { tmp.rirMax = Math.max(tmp.rirMin ?? 0, Math.min(5, (tmp.rirMax ?? tmp.rirMin ?? 2) + d)); }),
        filaNum('Descanso', null, () => tmp.descanso, d => { tmp.descanso = Math.max(0, Math.min(600, tmp.descanso + d * 15)); }, fDescanso),

        h('button', {
          class: 'listrow', style: 'margin-top:8px',
          onclick: () => ir({ n: 'movimiento', ejercicioId: it.ejercicioId }),
        },
          h('span', { class: 'txt' },
            h('b', null, 'Editar el movimiento'),
            h('small', null, 'Nombre, músculos, tips y variantes'),
          ),
          chev(),
        ),
      ),
    ),
    h('div', { class: 'row', style: 'padding:12px 0 16px;flex:none;border-top:1px solid var(--line)' },
      h('button', { class: 'btn', style: 'flex:1', onclick: volver }, 'Cancelar'),
      h('button', { class: 'btn primary', style: 'flex:2', onclick: guardar }, 'Guardar'),
    ),
  );
}

function hojaNuevaVariante(db, ejercicioId, onCreada) {
  const nombreIn = h('input', { type: 'text', placeholder: 'Mancuernas, polea, máquina…' });
  let tipo = 'peso';
  const botones = [['peso', 'Peso'], ['corporal', 'Corporal'], ['asistido', 'Asistido']].map(([k, l]) => {
    const b = h('button', { class: 'chip wide' + (k === 'peso' ? ' on' : '') }, l);
    b.onclick = () => { tipo = k; botones.forEach(x => x.classList.remove('on')); b.classList.add('on'); };
    return b;
  });
  abrirHoja({
    titulo: 'Variante nueva',
    meta: db.ejercicios[ejercicioId]?.nombre,
    cuerpo: [
      h('div', { class: 'field' }, h('span', { class: 'kicker' }, 'Nombre'), nombreIn),
      h('div', { class: 'field' }, h('span', { class: 'kicker' }, 'Tipo de carga'), h('div', { class: 'row' }, botones)),
      h('span', { class: 'tiny' }, 'Arranca con su propio historial en cero. El factor de equivalencia se ajusta después, en el movimiento.'),
    ],
    pie: [
      h('button', { class: 'btn', style: 'flex:1', onclick: cerrarHoja }, 'Cancelar'),
      h('button', {
        class: 'btn primary', style: 'flex:1.4',
        onclick: () => {
          const nombre = nombreIn.value.trim();
          if (!nombre) { toast('Poné un nombre'); return; }
          const id = uid();
          mutar(d => {
            d.variantes[id] = { id, ejercicioId, nombre, tipo, incremento: PASO, factor: 1, nota: '', ultimo: null };
          });
          cerrarHoja();
          onCreada(id);
        },
      }, 'Crear'),
    ],
  });
}

// ------------------------------------------------------------ movimiento

export function pantallaMovimiento(db, ruta) {
  const orig = db.ejercicios[ruta.ejercicioId];
  if (!orig) { queueMicrotask(volver); return h('main', { class: 'scr' }); }
  const ej = JSON.parse(JSON.stringify(orig));

  const nombreIn = h('input', { type: 'text', value: ej.nombre, enterkeyhint: 'done' });
  const tipsIn = h('textarea', { rows: 5, placeholder: 'Un tip por línea' }, ej.tips || '');

  let repintar = null;
  const cajaPrim = h('div', { class: 'field', style: 'padding-top:6px' });
  const cajaSec = h('div', { class: 'field', style: 'padding-top:6px' });

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
          const otro = nivel === 'prim' ? 'sec' : 'prim';
          const j = (ej[otro] || []).indexOf(id);
          if (j >= 0) ej[otro].splice(j, 1);
        }
        repintar();
      };
      return c;
    }),
  );
  repintar = () => {
    cajaPrim.replaceChildren(
      h('span', { class: 'kicker on' }, 'Músculos primarios'),
      h('span', { class: 'tiny' }, 'Suman una serie entera al objetivo semanal.'),
      chipsM('prim', ''));
    cajaSec.replaceChildren(
      h('span', { class: 'kicker' }, 'Músculos secundarios'),
      h('span', { class: 'tiny' }, 'Suman media serie.'),
      chipsM('sec', 'dash'));
  };
  repintar();

  const listaVar = h('div', { class: 'stack tight' });
  const pintarVar = () => {
    listaVar.replaceChildren(
      ...variantesDe(db, ej.id).map(v => h('button', {
        class: 'listrow', onclick: () => hojaEditarVariante(db, v.id, pintarVar),
      },
        h('span', { class: 'txt' },
          h('b', null, v.nombre),
          h('small', null,
            `${v.tipo === 'asistido' ? 'Asistido' : v.tipo === 'corporal' ? 'Corporal' : 'Peso'} · paso ${fPeso(v.incremento)} kg · factor ${v.factor}` +
            (v.ultimo ? ` · último ${fPeso(v.ultimo.peso)} kg` : '')),
        ),
        chev(),
      )),
      h('button', {
        class: 'btn dashed',
        onclick: () => hojaNuevaVariante(db, ej.id, () => pintarVar()),
      }, icono('mas', 18), 'Nueva variante'),
    );
  };
  pintarVar();

  const guardarMov = () => {
    mutar(d => {
      const e = d.ejercicios[ej.id];
      e.nombre = nombreIn.value.trim() || e.nombre;
      e.prim = ej.prim; e.sec = ej.sec;
      e.tips = tipsIn.value;
    });
    toast('Movimiento guardado');
    volver();
  };

  return h('main', { class: 'scr' },
    h('div', { class: 'hd-back' },
      h('button', { class: 'back', onclick: volver }, icono('atras', 24, 2.25)),
      h('h1', null, 'Movimiento'),
    ),
    h('div', { class: 'scr-scroll' },
      h('div', { class: 'stack tight', style: 'padding-top:6px' },
        h('div', { class: 'field' }, h('span', { class: 'kicker' }, 'Nombre'), nombreIn),
        h('span', { class: 'tiny' }, 'Renombrarlo no parte el historial: los registros cuelgan del mismo id.'),
        cajaPrim,
        cajaSec,
        h('div', { class: 'field', style: 'padding-top:6px' },
          h('span', { class: 'kicker' }, 'Tips de técnica'), tipsIn),
        h('div', { class: 'field', style: 'padding-top:10px' },
          h('span', { class: 'kicker' }, 'Variantes'),
          h('span', { class: 'tiny' }, 'Cada una guarda su peso crudo. El factor solo se usa para comparar en los gráficos.'),
          listaVar,
        ),
      ),
    ),
    h('div', { class: 'row', style: 'padding:12px 0 16px;flex:none;border-top:1px solid var(--line)' },
      h('button', { class: 'btn', style: 'flex:1', onclick: volver }, 'Cancelar'),
      h('button', { class: 'btn primary', style: 'flex:2', onclick: guardarMov }, 'Guardar'),
    ),
  );
}

function hojaEditarVariante(db, varianteId, onListo) {
  const v = JSON.parse(JSON.stringify(db.variantes[varianteId]));
  const nombreIn = h('input', { type: 'text', value: v.nombre });

  const num = (label, sub, leer, escribir, fmt = String) => {
    const val = h('span', { class: 'fval num' }, fmt(leer()));
    const set = d => { escribir(d); val.textContent = fmt(leer()); };
    return h('div', { class: 'frow' },
      h('span', { class: 'flab' }, label, sub && h('small', null, sub)),
      stepBtn('−', () => set(-1), 22), val, stepBtn('+', () => set(+1), 22),
    );
  };

  let tipo = v.tipo;
  const botones = [['peso', 'Peso'], ['corporal', 'Corporal'], ['asistido', 'Asistido']].map(([k, l]) => {
    const b = h('button', { class: 'chip wide' + (k === tipo ? ' on' : '') }, l);
    b.onclick = () => { tipo = k; botones.forEach(x => x.classList.remove('on')); b.classList.add('on'); };
    return b;
  });

  abrirHoja({
    titulo: v.nombre,
    alta: true,
    cuerpo: [
      h('div', { class: 'field' }, h('span', { class: 'kicker' }, 'Nombre'), nombreIn),
      h('div', { class: 'field' }, h('span', { class: 'kicker' }, 'Tipo de carga'), h('div', { class: 'row' }, botones)),
      num('Incremento', 'salto por tap, en kg', () => v.incremento,
        d => { v.incremento = Math.max(0.5, Math.min(10, Math.round((v.incremento + d * 0.5) * 2) / 2)); }, fPeso),
      num('Factor de equivalencia', 'contra la variante de referencia', () => v.factor,
        d => { v.factor = Math.max(0.1, Math.min(5, Math.round((v.factor + d * 0.05) * 100) / 100)); }, x => x.toFixed(2)),
      h('span', { class: 'tiny', style: 'line-height:1.45' },
        'El factor no toca el peso que cargás: se usa solo para poner las variantes en la misma escala ' +
        'cuando el gráfico compara la progresión del movimiento.'),
      v.ultimo && h('span', { class: 'tiny num' },
        `Último peso registrado: ${fPeso(v.ultimo.peso)} kg × ${v.ultimo.reps}`),
    ],
    pie: [
      h('button', { class: 'btn', style: 'flex:1', onclick: cerrarHoja }, 'Cancelar'),
      h('button', {
        class: 'btn primary', style: 'flex:1.4',
        onclick: () => {
          mutar(d => {
            const x = d.variantes[varianteId];
            x.nombre = nombreIn.value.trim() || x.nombre;
            x.tipo = tipo; x.incremento = v.incremento; x.factor = v.factor;
          });
          cerrarHoja(); onListo();
        },
      }, 'Guardar'),
    ],
  });
}

// ------------------------------------------------------------ versiones

export function pantallaVersiones(db, ruta) {
  const pl = plantillaPorId(db, ruta.id);
  if (!pl) { queueMicrotask(volver); return h('main', { class: 'scr' }); }
  const vs = [...pl.versiones].sort((a, b) => b.n - a.n);

  return h('main', { class: 'scr' },
    h('div', { class: 'hd-back' },
      h('button', { class: 'back', onclick: volver }, icono('atras', 24, 2.25)),
      h('h1', null, 'Versiones · ' + pl.nombre),
    ),
    h('div', { class: 'scr-scroll' },
      h('div', { style: 'padding-top:8px' },
        vs.map((v, i) => {
          const actual = v.n === pl.versionActual;
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
                  h('span', { class: 'sub num' },
                    `${fFechaLarga(v.ts)} · ${plural(v.items.length, 'ejercicio', 'ejercicios')}, ${series} series`),
                  v.nota && h('div', { class: 'stack', style: 'gap:4px;margin-top:4px' },
                    v.nota.split('\n').map(l => h('span', {
                      style: 'font-size:14px;color:' + (l.startsWith('−') ? 'var(--fg-2)' : 'var(--fg)'),
                    }, l))),
                ),
                h('div', { class: 'card-foot' },
                  h('button', { onclick: () => hojaVerVersion(db, v) }, 'Ver'),
                  !actual && h('div', { class: 'vr' }),
                  !actual && h('button', {
                    class: 'sec',
                    onclick: () => confirmar({
                      titulo: `¿Volver a la versión ${v.n}?`,
                      texto: 'Se crea una versión nueva con ese contenido. No se borra nada del historial.',
                      ok: 'Volver a esta',
                      onOk: () => {
                        mutar(d => {
                          const p = plantillaPorId(d, pl.id);
                          const n = Math.max(...p.versiones.map(x => x.n)) + 1;
                          p.versiones.push({ n, ts: Date.now(), nota: `Vuelta a la versión ${v.n}`, items: JSON.parse(JSON.stringify(v.items)) });
                          p.versionActual = n;
                        });
                        S.borrador = null;
                        toast('Listo');
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

function hojaVerVersion(db, v) {
  abrirHoja({
    titulo: 'Versión ' + v.n,
    meta: fFechaLarga(v.ts),
    alta: true,
    cuerpo: h('div', { class: 'stack tight' },
      v.items.map(it => h('div', { class: 'listrow' },
        h('span', { class: 'txt' },
          h('b', null, nombreCompleto(db, it.ejercicioId, it.varianteId)),
          h('small', null, detalleItem(db, it)),
        ),
      )),
    ),
    pie: h('button', { class: 'btn', style: 'flex:1', onclick: cerrarHoja }, icono('cerrar', 16), 'Cerrar'),
  });
}
