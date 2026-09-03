// Respaldo en Supabase.
//
// La app sigue siendo local-first: el teléfono es la fuente de verdad mientras
// entrenás, porque en el gimnasio no hay señal. Esto es el respaldo durable.
//
// No usa supabase-js a propósito: traerlo de un CDN rompería la propiedad de
// que la app no pide NADA a la red en tiempo de ejecución, que es lo que la
// hace funcionar sin conexión. Contra PostgREST y GoTrue alcanza con fetch.
//
// La cuenta es un CÓDIGO, no un login: una sola cosa para escribir y la misma
// en cualquier teléfono. Abajo sigue siendo auth de verdad (el código es la
// credencial), porque lo que protege los datos no es que sean poco interesantes
// sino que nadie más pueda borrarlos.
//
// La sincronización es automática: cada cambio se sube solo y al abrir con un
// código en un teléfono sin datos se baja todo. Sube por upsert, así que es
// idempotente. Cuando hay divergencia real se pregunta, no se pisa en silencio.

const URL_BASE = 'https://iaryulfcoisvkytfbuhk.supabase.co';
// Clave pública: va en el cliente por diseño. Lo que protege los datos es RLS,
// que ya está verificado: sin sesión no se ve una sola fila.
const ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imlhcnl1bGZjb2lzdmt5dGZidWhrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODg0NjUwNTAsImV4cCI6MjEwNDA0MTA1MH0.YoBlJHJyFZuU8cpZXs7kwqMyALBT2VXsoHfS2Yg8gr0';

const CLAVE_SESION = 'rutina:sesion-nube';
const CLAVE_CODIGO = 'rutina:codigo';
const LOTE = 200;
const ESPERA_SYNC = 4000;

// Sin caracteres que se confundan al copiarlos a mano: ni O ni 0, ni I ni 1.
const ALFABETO = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

let sesion = null;
try { sesion = JSON.parse(localStorage.getItem(CLAVE_SESION) || 'null'); } catch { sesion = null; }

function guardarSesion(s) {
  sesion = s;
  if (s) localStorage.setItem(CLAVE_SESION, JSON.stringify(s));
  else localStorage.removeItem(CLAVE_SESION);
}

let codigo = localStorage.getItem(CLAVE_CODIGO) || null;

export function estado() {
  return {
    activo: !!sesion && !!codigo,
    codigo,
    userId: sesion?.user?.id ?? null,
    pendiente: !!pendienteDeSubir,
    ultimoError,
  };
}

/** Código sugerido: corto, legible y sin caracteres ambiguos. */
export function codigoSugerido() {
  const azar = (n) => Array.from(crypto.getRandomValues(new Uint8Array(n)))
    .map(b => ALFABETO[b % ALFABETO.length]).join('');
  return `${azar(4)}-${azar(4)}`;
}

export function normalizar(c) {
  return String(c || '').trim().toUpperCase().replace(/s+/g, '');
}

// El código es la credencial. El mail es sintético y nunca recibe nada: existe
// solo porque el proveedor de auth necesita un identificador con esa forma.
function credenciales(c) {
  const limpio = normalizar(c).replace(/[^A-Z0-9]/g, '').toLowerCase();
  return { email: `${limpio}@rutina.app`, password: `${limpio}::rutina-v1` };
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

/**
 * Entrar con un código. Si ya existe, entra; si no, lo crea. Es la misma acción
 * en los dos casos, que es lo que lo hace sentir un código y no un registro.
 * @returns {{nuevo: boolean}} si el código se acaba de crear
 */
export async function entrar(c) {
  const limpio = normalizar(c);
  if (limpio.replace(/[^A-Z0-9]/g, '').length < 6) {
    throw new Error('El código tiene que tener al menos 6 letras o números.');
  }
  const cred = credenciales(limpio);

  try {
    const s = await pedir('/auth/v1/token?grant_type=password', {
      method: 'POST', body: JSON.stringify(cred),
    }, false);
    guardarSesion(s);
    guardarCodigo(limpio);
    return { nuevo: false };
  } catch (e) {
    // Credenciales inválidas puede ser un código libre o uno ajeno; se sabe al
    // intentar crearlo.
    try {
      const s = await pedir('/auth/v1/signup', { method: 'POST', body: JSON.stringify(cred) }, false);
      if (!s.access_token) throw new Error('sin sesión');
      guardarSesion(s);
      guardarCodigo(limpio);
      return { nuevo: true };
    } catch {
      throw new Error('Ese código ya lo está usando otra cuenta, o lo escribiste mal.');
    }
  }
}

export function salir() {
  guardarSesion(null);
  guardarCodigo(null);
}

function guardarCodigo(c) {
  codigo = c;
  if (c) localStorage.setItem(CLAVE_CODIGO, c);
  else localStorage.removeItem(CLAVE_CODIGO);
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

// ---------- sincronización automática ----------
//
// El teléfono deja de tener botones de respaldo: cada cambio se sube solo,
// agrupado, y al abrir con un código en un teléfono sin datos se baja todo.

let pendienteDeSubir = false;
let ultimoError = null;
let temporizador = null;
let subiendo = false;
let alCambiar = null;

/** Avisa a la interfaz cuando cambia el estado de la sincronización. */
export function alCambiarEstado(fn) { alCambiar = fn; }
function avisar() { if (alCambiar) alCambiar(estado()); }

/**
 * Marca que hay algo para subir y programa la subida. Se llama en cada cambio;
 * agrupar evita subir veinte veces mientras tocás el stepper.
 */
export function marcarSucio(db) {
  if (!sesion || !codigo) return;
  pendienteDeSubir = true;
  avisar();
  clearTimeout(temporizador);
  temporizador = setTimeout(() => subirAhora(db), ESPERA_SYNC);
}

/** Sube ya, sin esperar. Para cerrar la app o terminar una sesión. */
export async function subirAhora(db) {
  if (!sesion || !codigo || subiendo || !pendienteDeSubir) return;
  subiendo = true;
  clearTimeout(temporizador);
  try {
    await respaldar(db);
    pendienteDeSubir = false;
    ultimoError = null;
    db.meta.ultimoRespaldo = Date.now();
  } catch (e) {
    // Queda pendiente a propósito: si no hay señal, se reintenta al próximo
    // cambio o al volver a abrir. Nada se pierde: lo local ya está guardado.
    ultimoError = e.message;
  } finally {
    subiendo = false;
    avisar();
  }
}

/**
 * Qué hacer al abrir la app con un código configurado.
 * - Si el teléfono está vacío y la nube tiene datos, se baja (teléfono nuevo).
 * - Si los dos tienen datos, no se toca nada y se avisa, porque pisar una de
 *   las dos partes en silencio es exactamente lo que no hay que hacer.
 */
export async function alAbrir(db) {
  if (!codigo) return { accion: 'sin-codigo' };
  if (!sesion) {
    try { await entrar(codigo); }
    catch (e) { ultimoError = e.message; return { accion: 'error', error: e.message }; }
  }
  let remoto;
  try { remoto = await resumenRemoto(); }
  catch (e) { ultimoError = e.message; return { accion: 'sin-red' }; }

  const localVacio = db.sesiones.length === 0 && !db.sesionAbierta;
  if (remoto?.sesiones > 0 && localVacio) return { accion: 'bajar', remoto };
  if (remoto?.sesiones > 0 && !localVacio && !db.meta.ultimoRespaldo) {
    return { accion: 'divergen', remoto, local: db.sesiones.length };
  }
  pendienteDeSubir = true;
  await subirAhora(db);
  return { accion: 'subido' };
}
