#!/usr/bin/env node
/**
 * Servidor estático local para HOUSE OF ODDS. Sin dependencias.
 *
 *   node server.mjs            → http://127.0.0.1:8080
 *   node server.mjs 3000       → puerto 3000
 *   PORT=3000 node server.mjs
 *
 * Por qué no `python -m http.server`: en Windows, Python puede servir los .js
 * con un tipo MIME incorrecto (text/plain) y el navegador rechaza los módulos
 * ES. Este servidor fija los tipos correctos y solo escucha en 127.0.0.1.
 */
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, resolve, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { buildManifest, scanAudio } from './scripts/audio-manifest.mjs';

const ROOT = resolve(fileURLToPath(new URL('.', import.meta.url)));

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.ttf': 'font/ttf',
  '.mp3': 'audio/mpeg',
  '.ogg': 'audio/ogg',
  '.wav': 'audio/wav',
  '.txt': 'text/plain; charset=utf-8',
  '.md': 'text/markdown; charset=utf-8',
};

/** Segmentos de ruta que nunca se sirven. */
function isBlocked(pathname) {
  return pathname.split('/').some((part) => part.startsWith('.') || part === 'node_modules');
}

export function createStaticServer({ root = ROOT } = {}) {
  const base = resolve(root);

  return createServer(async (req, res) => {
    const send = (status, body = '', headers = {}) => {
      res.writeHead(status, { 'X-Content-Type-Options': 'nosniff', ...headers });
      res.end(req.method === 'HEAD' ? undefined : body);
    };

    if (req.method !== 'GET' && req.method !== 'HEAD') {
      return send(405, 'Método no permitido', { Allow: 'GET, HEAD' });
    }

    let pathname;
    try {
      pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    } catch {
      return send(400, 'Petición incorrecta');
    }
    if (pathname.includes('\0')) return send(400, 'Petición incorrecta');

    // Manifiesto de audio generado al vuelo (en un alojamiento estático lo crea `npm run audio`).
    if (pathname === '/assets/audio/manifest.json') {
      const found = await scanAudio(base);
      return send(200, JSON.stringify(buildManifest(found)), { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-cache' });
    }

    let filePath = resolve(base, `.${pathname}`);
    if (filePath !== base && !filePath.startsWith(base + sep)) return send(403, 'Prohibido');
    if (isBlocked(pathname)) return send(403, 'Prohibido');

    try {
      let info = await stat(filePath);
      if (info.isDirectory()) {
        filePath = join(filePath, 'index.html');
        info = await stat(filePath);
      }
      const body = await readFile(filePath);
      return send(200, body, {
        'Content-Type': MIME[extname(filePath).toLowerCase()] ?? 'application/octet-stream',
        'Content-Length': body.length,
        'Cache-Control': 'no-cache',
      });
    } catch (error) {
      if (error.code === 'ENOENT' || error.code === 'ENOTDIR') return send(404, 'No encontrado');
      console.error(error);
      return send(500, 'Error interno');
    }
  });
}

function main() {
  const host = '127.0.0.1';
  const basePort = Number(process.env.PORT || process.argv[2]) || 8080;
  let port = basePort;
  const server = createStaticServer();

  server.on('error', (error) => {
    if (error.code === 'EADDRINUSE' && port < basePort + 10) {
      port += 1;
      server.listen(port, host);
    } else {
      console.error(error);
      process.exit(1);
    }
  });
  server.on('listening', () => {
    console.log(`HOUSE OF ODDS → http://${host}:${server.address().port}   (Ctrl+C para detener)`);
  });
  server.listen(port, host);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main();
