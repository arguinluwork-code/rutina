// Gráficos. Sobrios: una sola serie en acento, el resto gris, sin grillas pesadas.

import { svg, h, fFecha, fPeso } from './ui.js';

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
