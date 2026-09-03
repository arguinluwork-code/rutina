import { h, hace, plural, confirmar, toast, fFechaLarga, icono } from './ui.js';
import { S, ir, mutar, volver, reemplazarDb } from './app.js';
import { tomarFoto, fotos, restaurarFoto } from './db.js';
import { sinRespaldar } from './s-inicio.js';
import * as nube from './nube.js';

function nombreArchivo() {
  const d = new Date();
  const p = n => String(n).padStart(2, '0');
  return `rutina-${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}.json`;
}

function exportar(db) {
  const datos = JSON.stringify({ app: 'rutina', v: db.v, exportado: Date.now(), db }, null, 2);
  const blob = new Blob([datos], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = h('a', { href: url, download: nombreArchivo() });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
  mutar(d => { d.meta.ultimoExport = Date.now(); });
  toast('Archivo generado');
}

async function copiar(db) {
  const datos = JSON.stringify({ app: 'rutina', v: db.v, exportado: Date.now(), db });
  try {
    await navigator.clipboard.writeText(datos);
    mutar(d => { d.meta.ultimoExport = Date.now(); });
    toast('Copiado al portapapeles');
  } catch {
    toast('No se pudo copiar');
  }
}

function importar(db, file) {
  const fr = new FileReader();
  fr.onload = async () => {
    let entrada;
    try { entrada = JSON.parse(String(fr.result)); }
    catch { toast('El archivo no es un JSON válido'); return; }
    const nuevo = entrada?.db ?? entrada;
    if (!nuevo || !(nuevo.plantillas || nuevo.rutina) || !Array.isArray(nuevo.sesiones)) {
      toast('Ese archivo no es un respaldo de Rutina');
      return;
    }
    confirmar({
      titulo: '¿Importar y reemplazar todo?',
      texto: `El archivo trae ${plural(nuevo.sesiones.length, 'sesión', 'sesiones')} y ` +
             `${plural(Object.keys(nuevo.ejercicios || {}).length, 'ejercicio', 'ejercicios')}.\n\n` +
             'Reemplaza todo lo que hay ahora. Antes se guarda una copia de seguridad de lo actual, ' +
             'así que se puede volver atrás.',
      ok: 'Importar',
      onOk: async () => {
        await tomarFoto(db, 'antes de importar');
        reemplazarDb(nuevo);
        toast('Datos importados');
      },
    });
  };
  fr.readAsText(file);
}

export function pantallaDatos(db) {
  const n = sinRespaldar(db);
  const t = db.meta.ultimoExport;

  const input = h('input', {
    type: 'file', accept: 'application/json,.json', style: 'display:none',
    onchange: (e) => { const f = e.target.files?.[0]; if (f) importar(db, f); e.target.value = ''; },
  });

  const lista = h('div', { class: 'stack tight' });
  fotos().then(fs => {
    lista.replaceChildren(
      ...(fs.length === 0
        ? [h('div', { class: 'empty' }, 'Todavía no hay copias. Se generan solas antes de cada operación que reemplaza datos.')]
        : fs.map((f, i) => h('div', { class: 'listrow' },
            h('span', { class: 'txt' },
              h('b', { class: 'num' }, `${plural(f.data.sesiones.length, 'sesión', 'sesiones')}`),
              h('small', null, `${f.motivo} · ${fFechaLarga(f.ts)}`),
            ),
            h('button', {
              class: 'btn', style: 'flex:none;width:auto;padding:0 14px;height:44px',
              onclick: () => confirmar({
                titulo: '¿Restaurar esta copia?',
                texto: 'Reemplaza todo lo actual. Antes se guarda otra copia de lo que hay ahora.',
                ok: 'Restaurar',
                onOk: async () => {
                  await tomarFoto(S.db, 'antes de restaurar');
                  const d = await restaurarFoto(i);
                  if (d) { reemplazarDb(d); toast('Copia restaurada'); }
                },
              }),
            }, icono('restaurar', 15), 'Restaurar'),
          ))),
    );
  });

  return h('main', { class: 'scr' },
    h('div', { class: 'hd-back' },
      h('button', { class: 'back', onclick: volver }, icono('atras', 24, 2.25)),
      h('h1', null, 'Datos'),
    ),
    h('div', { class: 'scr-scroll', style: 'padding-top:8px' },
      h('div', { class: 'stack' },

        h('div', { class: 'stack tight' },
          h('span', { class: 'kicker' }, 'Exportar'),
          h('button', { class: 'btn primary', style: 'height:68px;font-size:18px', onclick: () => exportar(db) },
            icono('exportar', 20, 2.25), 'Exportar todo'),
          h('button', { class: 'btn', onclick: () => copiar(db) }, icono('copiar', 16), 'Copiar al portapapeles'),
          h('span', { class: 'tiny num' },
            t ? `Último export: ${fFechaLarga(t)} (${hace(t)}) · ${plural(n, 'sesión sin respaldar', 'sesiones sin respaldar')}`
              : 'Todavía no exportaste nunca. Los datos viven solo en este teléfono.'),
        ),

        h('hr', { class: 'hr' }),

        h('div', { class: 'stack tight' },
          h('span', { class: 'kicker' }, 'Importar'),
          h('button', { class: 'btn', onclick: () => input.click() }, icono('importar', 16), 'Importar archivo'),
          input,
          h('div', { class: 'note' }, icono('alerta', 14),
            h('span', null, 'Reemplaza todo. Se guarda una copia de lo actual antes de importar.')),
        ),

        h('hr', { class: 'hr' }),

        bloqueNube(db),

        h('hr', { class: 'hr' }),

        h('div', { class: 'stack tight' },
          h('span', { class: 'kicker' }, 'Copias de seguridad'),
          h('span', { class: 'tiny' }, 'Las últimas 5, automáticas antes de cada operación destructiva.'),
          lista,
        ),

        h('hr', { class: 'hr' }),

        h('button', {
          class: 'btn danger', style: 'margin-bottom:8px',
          onclick: () => confirmar({
            titulo: '¿Borrar todo y empezar de cero?',
            texto: 'Se borran todas las sesiones y vuelve la rutina inicial. Se guarda una copia de seguridad antes.',
            ok: 'Borrar todo', peligro: true,
            onOk: async () => {
              await tomarFoto(S.db, 'antes de borrar todo');
              const { semillaInicial } = await import('./data.js');
              reemplazarDb(semillaInicial());
              toast('Todo borrado');
            },
          }),
        }, icono('basura', 17), 'Borrar todo'),
      ),
    ),
  );
}


// ---------------------------------------------------------------- nube

/**
 * La cuenta es un código, no un login. La misma acción sirve para crear uno
 * nuevo o entrar con el que ya tenías, que es lo que lo hace sentir un código.
 * La sincronización es automática: acá solo se elige el código y se ve el estado.
 */
function bloqueNube(db) {
  const est = nube.estado();

  if (!est.activo) {
    const sugerido = nube.codigoSugerido();
    const codigoIn = h('input', {
      type: 'text', value: sugerido, autocapitalize: 'characters',
      autocorrect: 'off', spellcheck: 'false', enterkeyhint: 'go',
    });
    const entrar = async (e) => {
      const b = e.currentTarget; b.disabled = true;
      try {
        const r = await nube.entrar(codigoIn.value);
        toast(r.nuevo ? 'Código creado, sincronizando' : 'Entraste, sincronizando');
        mutar(() => {});
      } catch (er) { toast(er.message); b.disabled = false; }
    };
    return h('div', { class: 'stack tight' },
      h('span', { class: 'kicker' }, 'Sincronización'),
      h('span', { class: 'tiny', style: 'line-height:1.45' },
        'Un código y listo, sin registro ni contraseña. Poné el mismo en otro teléfono ' +
        'y ahí aparecen tus datos.'),
      h('div', { class: 'field' }, codigoIn),
      h('div', { class: 'note' }, icono('alerta', 14),
        h('span', null, 'Anotalo. Es lo único que te devuelve los datos, y cualquiera que lo tenga puede borrarlos.')),
      h('button', { class: 'btn primary', onclick: entrar }, icono('nube', 17), 'Usar este código'),
    );
  }

  const t = db.meta.ultimoRespaldo;
  const estadoTxt = est.ultimoError
    ? `Sin subir: ${est.ultimoError}`
    : est.pendiente ? 'Subiendo cambios…'
      : t ? `Al día · última subida ${hace(t)}` : 'Al día';

  return h('div', { class: 'stack tight' },
    h('span', { class: 'kicker' }, 'Sincronización'),
    h('div', { class: 'card' }, h('div', { class: 'card-pad', style: 'gap:8px' },
      h('span', { class: 'kicker' }, 'Tu código'),
      h('span', { class: 'num', style: 'font-size:26px;font-weight:700;letter-spacing:.06em' }, est.codigo),
      h('span', { class: 'tiny num', style: est.ultimoError ? 'color:var(--warn)' : '' }, estadoTxt),
    )),
    h('button', {
      class: 'btn',
      onclick: async () => {
        try { await navigator.clipboard.writeText(est.codigo); toast('Código copiado'); }
        catch { toast('No se pudo copiar'); }
      },
    }, icono('copiar', 16), 'Copiar código'),
    h('span', { class: 'tiny', style: 'line-height:1.45' },
      'Se sube solo con cada cambio. No hace falta tocar nada.'),

    h('button', {
      class: 'btn',
      onclick: async () => {
        try {
          const r = await nube.resumenRemoto();
          if (!r || !r.sesiones) { toast('No hay nada guardado con este código'); return; }
          confirmar({
            titulo: '¿Traer lo de la nube?',
            texto: `Con este código hay ${plural(r.sesiones, 'sesión', 'sesiones')} y ${r.series} series.\n` +
                   `Acá tenés ${plural(db.sesiones.length, 'sesión', 'sesiones')}.\n\n` +
                   'Reemplaza todo lo de este teléfono. Antes se guarda una copia de lo actual.',
            ok: 'Traer',
            onOk: async () => {
              await tomarFoto(S.db, 'antes de traer de la nube');
              const traido = await nube.traer();
              if (!traido) { toast('No había nada para traer'); return; }
              reemplazarDb(traido);
              toast('Datos traídos');
            },
          });
        } catch (e) { toast('No se pudo consultar: ' + e.message); }
      },
    }, icono('importar', 16), 'Traer de la nube'),

    h('button', {
      class: 'btn ghost', style: 'height:44px;color:var(--fg-2);font-size:13px',
      onclick: () => confirmar({
        titulo: '¿Usar otro código?',
        texto: 'Los datos de este teléfono quedan como están; lo que ya subiste con el código ' +
               'actual sigue guardado y podés volver escribiéndolo de nuevo.',
        ok: 'Cambiar código',
        onOk: () => { nube.salir(); mutar(() => {}); },
      }),
    }, 'Usar otro código'),
  );
}
