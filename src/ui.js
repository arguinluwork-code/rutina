// Helpers de DOM, formato e interacción.

import { icono } from './icons.js';
export { icono };

/** Chevron de "entrar acá", el mismo en toda la app. */
export function chev(nombre = 'ir') {
  return h('span', { class: 'chev' }, icono(nombre, 18));
}

export function h(tag, props, ...kids) {
  const el = document.createElement(tag);
  if (props) {
    for (const [k, v] of Object.entries(props)) {
      if (v == null || v === false) continue;
      if (k === 'class') el.className = v;
      else if (k === 'style') el.setAttribute('style', v);
      else if (k === 'html') el.innerHTML = v;
      else if (k.startsWith('on')) el.addEventListener(k.slice(2).toLowerCase(), v);
      else el.setAttribute(k, v === true ? '' : String(v));
    }
  }
  añadir(el, kids);
  return el;
}

function añadir(el, kids) {
  for (const k of kids) {
    if (k == null || k === false) continue;
    if (Array.isArray(k)) añadir(el, k);
    else el.append(k instanceof Node ? k : document.createTextNode(String(k)));
  }
}

export function svg(tag, props, ...kids) {
  const el = document.createElementNS('http://www.w3.org/2000/svg', tag);
  if (props) for (const [k, v] of Object.entries(props)) {
    if (v == null || v === false) continue;
    el.setAttribute(k, String(v));
  }
  for (const k of kids.flat()) if (k) el.append(k);
  return el;
}

export function vaciar(el) { while (el.firstChild) el.removeChild(el.firstChild); return el; }

// ---------- formato ----------

export function fPeso(n) {
  if (n == null) return '—';
  return Number.isInteger(n) ? String(n) : n.toFixed(1);
}

export function mmss(seg) {
  const s = Math.max(0, Math.round(seg));
  return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');
}

export function fDescanso(seg) {
  return seg >= 60 ? mmss(seg) : seg + ' s';
}

const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
const MESES_L = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

export function fFecha(ts) {
  const d = new Date(ts);
  return `${d.getDate()} ${MESES[d.getMonth()]}`;
}

export function fFechaLarga(ts) {
  const d = new Date(ts);
  return `${d.getDate()} de ${MESES_L[d.getMonth()]}`;
}

export function fMesAño(ts) {
  const d = new Date(ts);
  const m = MESES_L[d.getMonth()];
  return m[0].toUpperCase() + m.slice(1) + ' ' + d.getFullYear();
}

export function hace(ts) {
  if (!ts) return 'nunca';
  const dias = Math.floor((hoy0() - dia0(ts)) / 864e5);
  if (dias <= 0) return 'hoy';
  if (dias === 1) return 'ayer';
  if (dias < 30) return `hace ${dias} días`;
  const m = Math.floor(dias / 30);
  return m === 1 ? 'hace un mes' : `hace ${m} meses`;
}

function dia0(ts) { const d = new Date(ts); d.setHours(0, 0, 0, 0); return d.getTime(); }
function hoy0() { return dia0(Date.now()); }

export function fDuracion(ms) {
  const min = Math.round(ms / 60000);
  if (min < 60) return `${min} min`;
  return `${Math.floor(min / 60)} h ${String(min % 60).padStart(2, '0')}`;
}

export function plural(n, sing, plu) { return `${n} ${n === 1 ? sing : plu}`; }

// ---------- interacción ----------

/** Botón de más/menos: un toque suma uno, mantener apretado acelera. */
export function mantener(el, fn) {
  let t = null, iv = null, veces = 0;
  const parar = () => {
    clearTimeout(t); clearInterval(iv);
    t = iv = null; veces = 0;
    window.removeEventListener('pointerup', parar, true);
    window.removeEventListener('pointercancel', parar, true);
  };
  el.addEventListener('pointerdown', (ev) => {
    ev.preventDefault();
    parar();
    fn();
    // Los listeners de corte van en window y en captura a propósito: si algo
    // repinta la pantalla y destruye este botón, el pointerup igual llega y el
    // temporizador no queda corriendo solo, disparando el número al infinito.
    window.addEventListener('pointerup', parar, true);
    window.addEventListener('pointercancel', parar, true);
    t = setTimeout(() => {
      iv = setInterval(() => {
        veces++;
        fn();
        if (veces === 8) { clearInterval(iv); iv = setInterval(fn, 60); }
      }, 110);
    }, 380);
  });
  el.addEventListener('pointerleave', parar);
  return el;
}

export function stepBtn(signo, fn, tam = 30) {
  const mas = signo === '+';
  return mantener(h('button', {
    class: 'sbtn', type: 'button', 'aria-label': mas ? 'más' : 'menos',
  }, icono(mas ? 'mas' : 'menos', tam, 2.25)), fn);
}

let _toastT = null;
export function toast(msg) {
  document.querySelector('.toast')?.remove();
  const el = h('div', { class: 'toast' }, msg);
  document.body.append(el);
  clearTimeout(_toastT);
  _toastT = setTimeout(() => el.remove(), 2600);
}

// ---------- hojas y diálogos ----------

export function abrirHoja({ titulo, meta, ayuda, cuerpo, pie, alta }) {
  cerrarHoja();
  const root = document.getElementById('sheet-root');
  const scrim = h('div', { class: 'scrim', onclick: cerrarHoja });
  const hoja = h('div', { class: 'sheet' + (alta ? ' tall' : '') },
    h('div', { class: 'sheet-hd' },
      h('div', { class: 'grab' }),
      h('div', { class: 'sheet-title' },
        h('h2', null, titulo),
        meta && h('span', { class: 'tiny num' }, meta),
      ),
      ayuda && h('span', { class: 'tiny' }, ayuda),
    ),
    h('div', { class: 'sheet-body' }, cuerpo),
    pie && h('div', { class: 'sheet-foot' }, pie),
  );
  root.append(scrim, hoja);
  return hoja;
}

export function cerrarHoja() {
  const root = document.getElementById('sheet-root');
  if (root) vaciar(root);
}

export function confirmar({ titulo, texto, ok = 'Confirmar', peligro = false, onOk }) {
  abrirHoja({
    titulo,
    cuerpo: h('p', { class: 'sub', style: 'font-size:16px;line-height:1.45;margin:0;white-space:pre-line' }, texto),
    pie: [
      h('button', { class: 'btn', style: 'flex:1', onclick: cerrarHoja }, 'Cancelar'),
      h('button', {
        class: 'btn ' + (peligro ? 'danger' : 'primary'), style: 'flex:1.4',
        onclick: () => { cerrarHoja(); onOk(); },
      }, ok),
    ],
  });
}

// ---------- audio y pantalla ----------

let ctx = null;
export function prepararSonido() {
  try {
    ctx = ctx || new (window.AudioContext || window.webkitAudioContext)();
    if (ctx.state === 'suspended') ctx.resume();
    // Un buffer mudo dentro del gesto del usuario habilita el audio en iOS.
    const b = ctx.createBuffer(1, 1, 22050);
    const s = ctx.createBufferSource();
    s.buffer = b; s.connect(ctx.destination); s.start(0);
  } catch { /* sin audio, el aviso sigue siendo visual */ }
}

export function pitido() {
  if (!ctx) return;
  try {
    if (ctx.state === 'suspended') ctx.resume();
    const t0 = ctx.currentTime;
    for (let i = 0; i < 3; i++) {
      const o = ctx.createOscillator(), g = ctx.createGain();
      const t = t0 + i * 0.22;
      o.type = 'square';
      o.frequency.setValueAtTime(i === 2 ? 1320 : 880, t);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.28, t + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.17);
      o.connect(g); g.connect(ctx.destination);
      o.start(t); o.stop(t + 0.2);
    }
  } catch { /* nada */ }
}

let lock = null, quiereLock = false;
export async function mantenerPantalla(on) {
  quiereLock = on;
  try {
    if (on) { lock = lock || await navigator.wakeLock?.request('screen'); }
    else { await lock?.release(); lock = null; }
  } catch { lock = null; }
}
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && quiereLock && !lock) mantenerPantalla(true);
});

// ---------- gráficos ----------

/** Anillo del descanso. frac = 1 lleno, 0 vacío. */
export function anillo(frac) {
  const R = 104, C = 2 * Math.PI * R;
  const off = C * (1 - Math.max(0, Math.min(1, frac)));
  return svg('svg', { viewBox: '0 0 248 248' },
    svg('circle', { cx: 124, cy: 124, r: R, fill: 'none', stroke: '#2A2D33', 'stroke-width': 10 }),
    svg('circle', {
      cx: 124, cy: 124, r: R, fill: 'none', stroke: '#CCFF33', 'stroke-width': 10,
      'stroke-linecap': 'round', 'stroke-dasharray': C, 'stroke-dashoffset': off,
    }),
  );
}
