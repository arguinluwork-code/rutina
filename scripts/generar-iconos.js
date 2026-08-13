const fs = require('fs');
const path = require('path');
const DIR = path.join(__dirname, 'node_modules', 'lucide-static', 'icons');

// nombre en la app -> nombre en lucide
const MAPA = {
  entrenar: 'dumbbell',
  rutina: 'clipboard-list',
  historial: 'history',
  progreso: 'trending-up',
  datos: 'database',
  atras: 'chevron-left',
  ir: 'chevron-right',
  abajo: 'chevron-down',
  deshacer: 'undo-2',
  mas: 'plus',
  menos: 'minus',
  tilde: 'check',
  asa: 'grip-vertical',
  tecnica: 'book-open',
  lohecho: 'list-checks',
  saltear: 'skip-forward',
  descanso: 'timer',
  alerta: 'triangle-alert',
  basura: 'trash-2',
  exportar: 'download',
  importar: 'upload',
  restaurar: 'rotate-ccw',
  terminar: 'circle-check',
  cerrar: 'x',
  reloj: 'clock',
  editar: 'pencil',
  agregar: 'plus',
  versiones: 'git-branch',
  copiar: 'copy',
  nube: 'cloud-off',
  fuego: 'flame',
  objetivo: 'target',
};

const faltan = [];
const salida = {};
for (const [clave, lucide] of Object.entries(MAPA)) {
  const f = path.join(DIR, lucide + '.svg');
  if (!fs.existsSync(f)) { faltan.push(`${clave} -> ${lucide}`); continue; }
  const svg = fs.readFileSync(f, 'utf8');
  const dentro = svg.replace(/^[\s\S]*?<svg[^>]*>/, '').replace(/<\/svg>[\s\S]*$/, '')
    .replace(/\s*\n\s*/g, '').trim();
  salida[clave] = dentro;
}

if (faltan.length) { console.log('FALTAN:', faltan.join(', ')); process.exit(1); }

const cuerpo = Object.entries(salida)
  .map(([k, v]) => `  ${k}: '${v.replace(/'/g, "\\'")}',`).join('\n');

const modulo = `// Íconos de Lucide (https://lucide.dev) — ISC. Geometría original, empaquetada
// acá para no depender de la red ni romper el modo sin conexión.
// Regenerar con scripts/generar-iconos.js

const TRAZOS = {
${cuerpo}
};

/**
 * Devuelve un <svg> de Lucide listo para insertar.
 * @param {string} nombre  clave de TRAZOS
 * @param {number} tam     lado en px
 * @param {number} grosor  grosor del trazo
 */
export function icono(nombre, tam = 20, grosor = 2) {
  const el = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  el.setAttribute('viewBox', '0 0 24 24');
  el.setAttribute('width', tam);
  el.setAttribute('height', tam);
  el.setAttribute('fill', 'none');
  el.setAttribute('stroke', 'currentColor');
  el.setAttribute('stroke-width', grosor);
  el.setAttribute('stroke-linecap', 'round');
  el.setAttribute('stroke-linejoin', 'round');
  el.setAttribute('aria-hidden', 'true');
  el.style.flex = 'none';
  el.style.display = 'block';
  el.innerHTML = TRAZOS[nombre] || '';
  return el;
}
`;

fs.writeFileSync(path.join(__dirname, 'icons.js'), modulo);
console.log('listo:', Object.keys(salida).length, 'íconos,', modulo.length, 'bytes');
