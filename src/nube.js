// Respaldo en Supabase.
//
// La app sigue siendo local-first: el teléfono es la fuente de verdad mientras
// entrenás, porque en el gimnasio no hay señal. Esto es el respaldo durable.
//
// No usa supabase-js a propósito: traerlo de un CDN rompería la propiedad de
// que la app no pide NADA a la red en tiempo de ejecución, que es lo que la
// hace funcionar sin conexión. Contra PostgREST y GoTrue alcanza con fetch.
//
// La sincronización es deliberadamente simple: respaldar sube todo (idempotente,
// por upsert) y restaurar baja todo y reconstruye. Para un usuario con un
// teléfono, un motor de conflictos sería complejidad que nunca se ejercita; y
// cuando hay divergencia real, se pregunta en vez de resolver en silencio.

const URL_BASE = 'https://iaryulfcoisvkytfbuhk.supabase.co';
// Clave pública: va en el cliente por diseño. Lo que protege los datos es RLS,
// que ya está verificado: sin sesión no se ve una sola fila.
const ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imlhcnl1bGZjb2lzdmt5dGZidWhrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODg0NjUwNTAsImV4cCI6MjEwNDA0MTA1MH0.YoBlJHJyFZuU8cpZXs7kwqMyALBT2VXsoHfS2Yg8gr0';

const CLAVE_SESION = 'rutina:sesion-nube';
const LOTE = 200;

let sesion = null;
try { sesion = JSON.parse(localStorage.getItem(CLAVE_SESION) || 'null'); } catch { sesion = null; }

function guardarSesion(s) {
  sesion = s;
  if (s) localStorage.setItem(CLAVE_SESION, JSON.stringify(s));
  else localStorage.removeItem(CLAVE_SESION);
}

export function estado() {
  return {
    activo: !!sesion,
    userId: sesion?.user?.id ?? null,
    anonimo: sesion?.user?.is_anonymous ?? null,
    mail: sesion?.user?.email ?? null,
  };
}

// ---------- transporte ----------

async function pedir(ruta, opts = {}, conToken = true) {
  const cab = { apikey: ANON, 'Content-Type': 'application/json', ...(opts.headers || {}) };
  if (conToken && sesion?.access_token) cab.Authorization = `Bearer ${sesion.access_token}`;
  else cab.Authorization = `Bearer ${ANON}`;

  const r = await fetch(URL_BASE + ruta, { ...opts, headers: cab });
  if (r.status === 401 && conToken && sesion?.refresh_token) {
    await refrescar();
    return pedir(ruta, opts, conToken);
  }
  const txt = await r.text();
  let cuerpo = null;
  try { cuerpo = txt ? JSON.parse(txt) : null; } catch { cuerpo = txt; }
  if (!r.ok) {
    const msg = cuerpo?.message || cuerpo?.error_description || cuerpo?.msg || `HTTP ${r.status}`;
    throw new Error(msg);
  }
  return cuerpo;
}

async function refrescar() {
  try {
    const s = await pedir('/auth/v1/token?grant_type=refresh_token', {
      method: 'POST', body: JSON.stringify({ refresh_token: sesion.refresh_token }),
    }, false);
    guardarSesion(s);
  } catch {
    guardarSesion(null);
    throw new Error('La sesión con la nube venció. Volvé a activar el respaldo.');
  }
}

// ---------- cuenta ----------

/** Crea la cuenta sin pantalla de registro: usuario anónimo al vuelo. */
export async function activar() {
  if (sesion) return estado();
  const s = await pedir('/auth/v1/signup', { method: 'POST', body: JSON.stringify({ data: {} }) }, false);
  guardarSesion(s);
  return estado();
}

/**
 * Convierte la cuenta anónima en una con mail, para poder recuperar los datos
 * en otro teléfono. Manda un link, no pide contraseña.
 */
export async function vincularMail(email) {
  if (!sesion) throw new Error('Activá el respaldo primero.');
  await pedir('/auth/v1/user', { method: 'PUT', body: JSON.stringify({ email }) });
  return true;
}

export function desactivar() {
  guardarSesion(null);
}

// ---------- traducción entre el modelo local y las tablas ----------

const uid = () => sesion.user.id;

function aFilas(db) {
  const u = uid();
  const movimientos = Object.values(db.ejercicios).map(m => ({
    id: m.id, user_id: u, nombre: m.nombre,
    prim: m.prim || [], sec: m.sec || [], tips: m.tips || '',
  }));
  const variantes = Object.values(db.variantes).map(v => ({
    id: v.id, user_id: u, movimiento_id: v.ejercicioId, nombre: v.nombre,
    tipo: v.tipo, incremento: v.incremento, factor: v.factor,
    nota: v.nota || '', ultimo: v.ultimo ?? null,
  }));
  // El índice va a la base: el orden en que se muestran las plantillas es una
  // decisión tuya y no debe perderse al restaurar.
  const plantillas = db.plantillas.map((p, i) => ({
    id: p.id, user_id: u, nombre: p.nombre, foco: p.foco || '',
    version_actual: p.versionActual, versiones: p.versiones, orden: i,
  }));

  const todas = [...db.sesiones, ...(db.sesionAbierta ? [db.sesionAbierta] : [])];
  const sesiones = todas.map(s => ({
    id: s.id, user_id: u, plantilla_id: s.plantillaId ?? null,
    plantilla_nombre: s.plantillaNombre ?? null, version_n: s.versionN ?? null,
    inicio: new Date(s.inicio).toISOString(),
    fin: s.fin ? new Date(s.fin).toISOString() : null,
  }));
  const series = [];
  for (const s of todas) {
    for (const x of s.sets) {
      series.push({
        id: x.id, user_id: u, sesion_id: s.id,
        movimiento_id: x.ejercicioId, variante_id: x.varianteId,
        ex_idx: x.exIdx, serie_idx: x.serieIdx, series_plan: x.series ?? null,
        reps_min: x.repsMin ?? null, reps_max: x.repsMax ?? null,
        rir_min: x.rirMin ?? null, rir_max: x.rirMax ?? null,
        descanso: x.descanso ?? null,
        estado: x.estado, peso: x.peso ?? null, reps: x.reps ?? null, rir: x.rir ?? null,
        hecha_en: x.ts ? new Date(x.ts).toISOString() : null,
      });
    }
  }
  return { movimientos, variantes, plantillas, sesiones, series };
}

function deFilas(f, perfil) {
  const ejercicios = {};
  for (const m of f.movimientos) ejercicios[m.id] = { id: m.id, nombre: m.nombre, prim: m.prim, sec: m.sec, tips: m.tips };
  const variantes = {};
  for (const v of f.variantes) {
    variantes[v.id] = {
      id: v.id, ejercicioId: v.movimiento_id, nombre: v.nombre, tipo: v.tipo,
      incremento: Number(v.incremento), factor: Number(v.factor), nota: v.nota, ultimo: v.ultimo,
    };
  }
  const plantillas = f.plantillas
    .slice()
    .sort((a, b) => (a.orden ?? 0) - (b.orden ?? 0))
    .map(p => ({
      id: p.id, nombre: p.nombre, foco: p.foco, versionActual: p.version_actual, versiones: p.versiones,
    }));

  const porSesion = {};
  for (const x of f.series) (porSesion[x.sesion_id] = porSesion[x.sesion_id] || []).push({
    id: x.id, ejercicioId: x.movimiento_id, varianteId: x.variante_id,
    exIdx: x.ex_idx, serieIdx: x.serie_idx, series: x.series_plan,
    repsMin: x.reps_min, repsMax: x.reps_max, rirMin: x.rir_min, rirMax: x.rir_max,
    descanso: x.descanso, estado: x.estado,
    peso: x.peso == null ? null : Number(x.peso), reps: x.reps, rir: x.rir,
    ts: x.hecha_en ? Date.parse(x.hecha_en) : null,
  });

  const sesiones = [];
  let sesionAbierta = null;
  for (const s of f.sesiones) {
    const armada = {
      id: s.id, plantillaId: s.plantilla_id, plantillaNombre: s.plantilla_nombre,
      versionN: s.version_n, inicio: Date.parse(s.inicio),
      tocada: Date.parse(s.inicio), fin: s.fin ? Date.parse(s.fin) : null,
      sets: (porSesion[s.id] || []).sort((a, b) => a.exIdx - b.exIdx || a.serieIdx - b.serieIdx),
      cursor: null, undo: [], rest: null, draft: null,
    };
    if (armada.fin) sesiones.push(armada);
    else sesionAbierta = armada;
  }
  sesiones.sort((a, b) => a.inicio - b.inicio);

  return {
    v: perfil?.config?.v ?? 4,
    mtime: Date.now(),
    ejercicios, variantes, plantillas,
    config: perfil?.config?.config ?? { objetivoSemanal: 4, maxSeriesSesion: 24 },
    sesiones, sesionAbierta,
    meta: perfil?.config?.meta ?? { ultimoExport: null, creado: Date.now() },
  };
}

// ---------- operaciones ----------

async function subirLote(tabla, filas) {
  for (let i = 0; i < filas.length; i += LOTE) {
    await pedir(`/rest/v1/${tabla}?on_conflict=user_id,id`, {
      method: 'POST',
      headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
      body: JSON.stringify(filas.slice(i, i + LOTE)),
    });
  }
}

/**
 * Marca como borrado lo que ya no está en el teléfono. Borrado lógico, no
 * DELETE: así el registro queda y se puede auditar qué pasó.
 */
async function marcarBorrados(tabla, idsLocales) {
  const remotos = await pedir(`/rest/v1/${tabla}?select=id&borrado=is.false`);
  const sobran = remotos.filter(r => !idsLocales.has(r.id)).map(r => r.id);
  if (!sobran.length) return 0;
  for (let i = 0; i < sobran.length; i += LOTE) {
    const lista = sobran.slice(i, i + LOTE).map(x => `"${x}"`).join(',');
    await pedir(`/rest/v1/${tabla}?id=in.(${lista})`, {
      method: 'PATCH',
      headers: { Prefer: 'return=minimal' },
      body: JSON.stringify({ borrado: true }),
    });
  }
  return sobran.length;
}

/** Sube todo. Idempotente: se puede llamar cuantas veces haga falta. */
export async function respaldar(db) {
  if (!sesion) await activar();
  const f = aFilas(db);
  await pedir('/rest/v1/perfil?on_conflict=user_id', {
    method: 'POST',
    headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
    body: JSON.stringify([{
      user_id: uid(),
      config: { v: db.v, config: db.config, meta: db.meta },
      objetivos: {},
    }]),
  });
  // El orden importa poco porque no hay claves foráneas entre estas tablas,
  // pero se sube el catálogo antes que las series por prolijidad.
  await subirLote('movimientos', f.movimientos);
  await subirLote('variantes', f.variantes);
  await subirLote('plantillas', f.plantillas);
  await subirLote('sesiones', f.sesiones);
  await subirLote('series', f.series);

  // Subir es solo upsert, nunca borra. Sin este paso, algo que borraste en el
  // teléfono seguiría vivo en la nube y volvería en la próxima restauración.
  let borrados = 0;
  for (const [tabla, filas] of Object.entries(f)) {
    borrados += await marcarBorrados(tabla, new Set(filas.map(x => x.id)));
  }

  return {
    borrados,
    movimientos: f.movimientos.length, variantes: f.variantes.length,
    plantillas: f.plantillas.length, sesiones: f.sesiones.length, series: f.series.length,
  };
}

async function bajarTodo(tabla) {
  const out = [];
  for (let desde = 0; ; desde += 1000) {
    const trozo = await pedir(`/rest/v1/${tabla}?select=*&borrado=is.false&order=id`, {
      headers: { Range: `${desde}-${desde + 999}` },
    });
    out.push(...trozo);
    if (trozo.length < 1000) break;
  }
  return out;
}

/** Baja todo y arma una base local. No pisa nada por su cuenta. */
export async function traer() {
  if (!sesion) throw new Error('Activá el respaldo primero.');
  const [perfil, movimientos, variantes, plantillas, sesiones, series] = await Promise.all([
    pedir(`/rest/v1/perfil?select=*&user_id=eq.${uid()}`),
    bajarTodo('movimientos'), bajarTodo('variantes'), bajarTodo('plantillas'),
    bajarTodo('sesiones'), bajarTodo('series'),
  ]);
  if (!movimientos.length && !sesiones.length) return null;
  return deFilas({ movimientos, variantes, plantillas, sesiones, series }, perfil?.[0]);
}

/** Cuánto hay guardado del otro lado, para poder comparar antes de decidir. */
export async function resumenRemoto() {
  if (!sesion) return null;
  const cuenta = async (tabla) => {
    const r = await fetch(`${URL_BASE}/rest/v1/${tabla}?select=id&borrado=is.false`, {
      headers: { apikey: ANON, Authorization: `Bearer ${sesion.access_token}`, Prefer: 'count=exact', Range: '0-0' },
    });
    const rango = r.headers.get('content-range') || '';
    return Number(rango.split('/')[1] || 0);
  };
  const [sesiones, series, ultima] = await Promise.all([
    cuenta('sesiones'), cuenta('series'),
    pedir('/rest/v1/sesiones?select=inicio&order=inicio.desc&limit=1'),
  ]);
  return { sesiones, series, ultima: ultima?.[0]?.inicio ?? null };
}
