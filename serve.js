// Servidor estático para probar desde el teléfono en la red local.
//   node serve.js  [puerto]

const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');

const PUERTO = Number(process.argv[2]) || 8080;
const RAIZ = __dirname;

const TIPOS = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.woff2': 'font/woff2',
};

http.createServer((req, res) => {
  let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (p === '/') p = '/index.html';
  const archivo = path.join(RAIZ, path.normalize(p).replace(/^(\.\.[/\\])+/, ''));
  if (!archivo.startsWith(RAIZ)) { res.writeHead(403).end('no'); return; }

  fs.readFile(archivo, (err, buf) => {
    if (err) { res.writeHead(404, { 'content-type': 'text/plain' }).end('404'); return; }
    res.writeHead(200, {
      'content-type': TIPOS[path.extname(archivo)] || 'application/octet-stream',
      'cache-control': 'no-cache',
    });
    res.end(buf);
  });
}).listen(PUERTO, () => {
  const ips = Object.values(os.networkInterfaces()).flat()
    .filter(i => i && i.family === 'IPv4' && !i.internal).map(i => i.address);
  console.log('\n  Rutina andando en:\n');
  console.log(`    http://localhost:${PUERTO}`);
  for (const ip of ips) console.log(`    http://${ip}:${PUERTO}   <- desde el iPhone`);
  console.log('\n  Ctrl+C para cortar.\n');
});
