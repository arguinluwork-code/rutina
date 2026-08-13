// Genera icon-180.png e icon-512.png (mismo dibujo que icon.svg).
//   node hacer-iconos.js

const zlib = require('zlib');
const fs = require('fs');

function crc32(buf) {
  let c, tabla = crc32.t;
  if (!tabla) {
    tabla = crc32.t = [];
    for (let n = 0; n < 256; n++) {
      c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1;
      tabla[n] = c >>> 0;
    }
  }
  let crc = 0xFFFFFFFF;
  for (const b of buf) crc = tabla[(crc ^ b) & 0xFF] ^ (crc >>> 8);
  return (crc ^ 0xFFFFFFFF) >>> 0;
}

function trozo(tipo, datos) {
  const largo = Buffer.alloc(4);
  largo.writeUInt32BE(datos.length);
  const cuerpo = Buffer.concat([Buffer.from(tipo, 'ascii'), datos]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(cuerpo));
  return Buffer.concat([largo, cuerpo, crc]);
}

function png(ancho, alto, pixel) {
  const filas = [];
  for (let y = 0; y < alto; y++) {
    const fila = Buffer.alloc(1 + ancho * 3);
    for (let x = 0; x < ancho; x++) {
      const [r, g, b] = pixel(x, y);
      fila[1 + x * 3] = r; fila[2 + x * 3] = g; fila[3 + x * 3] = b;
    }
    filas.push(fila);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(ancho, 0); ihdr.writeUInt32BE(alto, 4);
  ihdr[8] = 8; ihdr[9] = 2; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]),
    trozo('IHDR', ihdr),
    trozo('IDAT', zlib.deflateSync(Buffer.concat(filas), { level: 9 })),
    trozo('IEND', Buffer.alloc(0)),
  ]);
}

const FONDO = [0x0B, 0x0B, 0x0D];
const ACENTO = [0xCC, 0xFF, 0x33];

// Mancuerna: barra al medio y dos discos a los costados (coordenadas sobre 512).
const PARTES = [
  [96, 232, 320, 48],
  [48, 196, 56, 120],
  [408, 196, 56, 120],
];

function dibujar(lado) {
  const k = lado / 512;
  return (x, y) => {
    for (const [px, py, pw, ph] of PARTES) {
      if (x >= px * k && x < (px + pw) * k && y >= py * k && y < (py + ph) * k) return ACENTO;
    }
    return FONDO;
  };
}

for (const lado of [180, 512]) {
  fs.writeFileSync(`icon-${lado}.png`, png(lado, lado, dibujar(lado)));
  console.log(`icon-${lado}.png`);
}
