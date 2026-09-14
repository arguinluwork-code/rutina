// Gráficos. Sobrios: una sola serie en acento, el resto gris, sin grillas pesadas.

import { svg, h, fFecha, fPeso } from './ui.js';
import { CURVA, ZONAS } from './musculos.js';

const W = 320, PAD_L = 34, PAD_R = 8, PAD_T = 10, PAD_B = 20;

function escala(vals, minForzado) {
  let min = Math.min(...vals), max = Math.max(...vals);
  if (minForzado != null) min = Math.min(min, minForzado);
  if (max === min) { max = min + 1; }
  const pad = (max - min) * 0.12;
  return { min: Math.max(0, min - pad), max: max + pad };
}

function ejeY(min, max, alto, fmt) {
  const out = [];
  for (const t of [0, 0.5, 1]) {
    const v = min + (max - min) * t;
    const y = PAD_T + (1 - t) * (alto - PAD_T - PAD_B);
    out.push(svg('line', { x1: PAD_L, x2: W - PAD_R, y1: y, y2: y, stroke: '#2A2D33', 'stroke-width': 1, opacity: t === 0 ? 1 : 0.45 }));
    out.push(svg('text', { x: PAD_L - 6, y: y + 3, 'text-anchor': 'end', class: 'axis' }, txt(fmt(v))));
  }
  return out;
}

function txt(s) { const t = document.createTextNode(String(s)); return t; }

/** Línea de carga en el tiempo, con marcas donde cambió la rutina. */
export function graficoLinea(puntos, marcas = [], alto = 150) {
  const xs = puntos.map(p => p.x), ys = puntos.map(p => p.y);
  const x0 = Math.min(...xs), x1 = Math.max(...xs);
  const { min, max } = escala(ys);
  const px = t => PAD_L + ((t - x0) / Math.max(1, x1 - x0)) * (W - PAD_L - PAD_R);
  const py = v => PAD_T + (1 - (v - min) / (max - min)) * (alto - PAD_T - PAD_B);

  const d = puntos.map((p, i) => `${i ? 'L' : 'M'}${px(p.x).toFixed(1)},${py(p.y).toFixed(1)}`).join(' ');

  const g = svg('svg', { viewBox: `0 0 ${W} ${alto}`, role: 'img' },
    ejeY(min, max, alto, v => Math.round(v)),
    marcas.filter(m => m >= x0 && m <= x1).map(m => svg('line', {
      x1: px(m), x2: px(m), y1: PAD_T, y2: alto - PAD_B,
      stroke: '#9A9DA5', 'stroke-width': 1, 'stroke-dasharray': '3 4',
    })),
    svg('path', { d, fill: 'none', stroke: '#CCFF33', 'stroke-width': 2, 'stroke-linejoin': 'round', 'stroke-linecap': 'round' }),
    puntos.map(p => svg('circle', { cx: px(p.x), cy: py(p.y), r: 2.8, fill: '#CCFF33' })),
    puntos.map((p, i) => (p.rir && (i === puntos.length - 1 || i % Math.ceil(puntos.length / 5) === 0))
      ? svg('text', { x: px(p.x), y: py(p.y) - 8, 'text-anchor': 'middle', class: 'axis' }, txt(p.rir))
      : null),
    svg('text', { x: PAD_L, y: alto - 5, class: 'axis' }, txt(fFecha(x0))),
    svg('text', { x: W - PAD_R, y: alto - 5, 'text-anchor': 'end', class: 'axis' }, txt(fFecha(x1))),
  );
  return g;
}

/** Barras de volumen por sesión. */
export function graficoBarras(puntos, alto = 130) {
  const ys = puntos.map(p => p.y);
  const max = Math.max(...ys) * 1.12 || 1;
  const n = puntos.length;
  const ancho = (W - PAD_L - PAD_R) / n;
  const bw = Math.max(3, Math.min(22, ancho * 0.62));

  return svg('svg', { viewBox: `0 0 ${W} ${alto}`, role: 'img' },
    ejeY(0, max, alto, v => (v >= 1000 ? Math.round(v / 100) / 10 + 'k' : Math.round(v))),
    puntos.map((p, i) => {
      const cx = PAD_L + ancho * (i + 0.5);
      const hh = (p.y / max) * (alto - PAD_T - PAD_B);
      return svg('rect', {
        x: cx - bw / 2, y: alto - PAD_B - hh, width: bw, height: Math.max(1, hh),
        rx: 2, fill: '#CCFF33',
      });
    }),
    svg('text', { x: PAD_L, y: alto - 5, class: 'axis' }, txt(fFecha(puntos[0].x))),
    svg('text', { x: W - PAD_R, y: alto - 5, 'text-anchor': 'end', class: 'axis' }, txt(fFecha(puntos[n - 1].x))),
  );
}

export function tarjetaGrafico(titulo, ayuda, contenido) {
  return h('div', { class: 'chart' },
    h('h3', null, titulo),
    ayuda && h('span', { class: 'tiny' }, ayuda),
    h('div', { style: 'margin-top:10px' }, contenido),
  );
}

export function vacio(titulo, texto) {
  return h('div', { class: 'chart' },
    h('h3', null, titulo),
    h('div', { class: 'empty', style: 'margin-top:10px' }, texto),
  );
}

// ------------------------------------------------------- escala de volumen

/**
 * La curva de crecimiento con el objetivo de la planificación encima.
 *
 * Son dos cosas distintas y por eso se dibujan distinto: el color de fondo es
 * la evidencia (dónde crece un músculo, igual para todos), y el marco blanco es
 * una decisión tuya (cuánto de eso le toca a este músculo con el presupuesto
 * que tenés). Cuando el marco cae fuera del verde no es un error de la app:
 * es lo que significa especializar, y conviene verlo.
 *
 * @param hecho     series del período; si viene, se dibuja como barra y línea.
 * @param compacta  sin eje numérico, para las filas de una lista.
 */
export function escalaVolumen(m, hecho = null, compacta = false) {
  const pct = (n) => Math.max(0, Math.min(100, (n / CURVA.tope) * 100));
  const zonas = ZONAS.map(z => h('div', {
    class: 'z ' + z.id,
    style: `left:${pct(z.desde)}%;width:${pct(z.hasta) - pct(z.desde)}%`,
  }));
  const cortes = [CURVA.piso, CURVA.optMin, CURVA.optMax, CURVA.plano]
    .map(n => h('div', { class: 'corte', style: `left:${pct(n)}%` }));

  const objetivo = m.objMax > 0 ? h('div', {
    class: 'obj',
    style: `left:${pct(m.objMin)}%;width:${Math.max(2, pct(m.objMax) - pct(m.objMin))}%`,
    title: `Tu objetivo: ${m.objMin}–${m.objMax}`,
  }) : null;

  // Lo hecho va como barra abajo y no como relleno de toda la altura: pintar
  // encima de las zonas taparía justo la información que la escala aporta.
  const relleno = hecho != null && hecho > 0
    ? h('div', { class: 'rel', style: `width:${pct(hecho)}%` }) : null;
  if (compacta) return h('div', { class: 'esc esc-min' }, zonas, cortes, objetivo, relleno);

  return h('div', null,
    h('div', { class: 'esc' }, zonas, cortes, objetivo, relleno),
    // Los números van en la posición real de su corte, no repartidos parejo:
    // un eje que miente sobre dónde cae el 10 no sirve para leer la escala.
    h('div', { class: 'esc-pie' },
      [0, CURVA.piso, CURVA.optMin, CURVA.optMax, CURVA.tope].map((n, i, a) =>
        h('span', {
          style: `left:${pct(n)}%;transform:translateX(${i === 0 ? '0' : i === a.length - 1 ? '-100%' : '-50%'})`,
        }, n === CURVA.tope ? `${n}+` : String(n))),
    ),
  );
}

/** La leyenda, una sola vez por pantalla: repetirla en cada fila es ruido. */
export function leyendaEscala() {
  return h('div', { class: 'esc-ley' },
    h('span', null, h('i', { style: 'background:rgba(154,157,165,.45)' }), 'No alcanza'),
    h('span', null, h('i', { style: 'background:rgba(255,176,32,.6)' }), 'Falta para el óptimo'),
    h('span', null, h('i', { style: 'background:rgba(204,255,51,.7)' }), 'Óptimo'),
    h('span', null, h('i', { style: 'background:rgba(229,72,77,.6)' }), 'Rinde cada vez menos'),
    h('span', null, h('i', { style: 'border:1.5px dashed rgba(255,255,255,.62);background:transparent' }), 'Tu objetivo'),
    h('span', null, h('i', { style: 'background:var(--fg);height:5px;border-radius:2px' }), 'Lo que llevás'),
  );
}
