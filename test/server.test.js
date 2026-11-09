import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { fileURLToPath } from 'node:url';
import { createStaticServer } from '../server.mjs';

let server;
let port;

before(async () => {
  server = createStaticServer();
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  port = server.address().port;
});

after(() => new Promise((resolve) => server.close(resolve)));

/** Petición con ruta cruda (fetch normalizaría «/../» antes de enviarla). */
function request(path, method = 'GET', targetPort = port) {
  return new Promise((resolve, reject) => {
    const req = http.request({ host: '127.0.0.1', port: targetPort, path, method }, (res) => {
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body: Buffer.concat(chunks) }));
    });
    req.on('error', reject);
    req.end();
  });
}

test('GET / sirve index.html', async () => {
  const r = await request('/');
  assert.equal(r.status, 200);
  assert.match(r.headers['content-type'], /^text\/html/);
  assert.match(r.body.toString(), /HOUSE/);
});

test('los módulos .js se sirven como text/javascript (imprescindible para ES modules)', async () => {
  for (const path of ['/src/main.js', '/vendor/three/three.module.js', '/vendor/three/three.core.js']) {
    const r = await request(path);
    assert.equal(r.status, 200, path);
    assert.match(r.headers['content-type'], /^text\/javascript/, path);
  }
});

test('CSS y fuentes tienen tipo MIME correcto', async () => {
  assert.match((await request('/styles/main.css')).headers['content-type'], /^text\/css/);
  assert.equal((await request('/assets/fonts/cinzel-latin-700-normal.woff2')).headers['content-type'], 'font/woff2');
});

test('404 para rutas inexistentes', async () => {
  assert.equal((await request('/no-existe.js')).status, 404);
});

test('no sirve nada fuera de la raíz (recorrido de directorios) y rechaza NUL', async () => {
  // Raíz = src/. Fuera de ella existe ../package.json, que NO debe poder leerse.
  const inner = createStaticServer({ root: fileURLToPath(new URL('../src/', import.meta.url)) });
  await new Promise((resolve) => inner.listen(0, '127.0.0.1', resolve));
  const innerPort = inner.address().port;
  try {
    // El parser de URL colapsa «/../»: queda dentro de la raíz → 404, nunca el fichero de fuera.
    assert.equal((await request('/../package.json', 'GET', innerPort)).status, 404);
    // «%2f» codificado sobrevive al parser; tras decodificar intenta salir de la raíz → 403.
    assert.equal((await request('/%2e%2e%2fpackage.json', 'GET', innerPort)).status, 403);
    assert.equal((await request('/..%2fpackage.json', 'GET', innerPort)).status, 403);
    // Control: un fichero que sí está dentro de la raíz se sirve.
    assert.equal((await request('/main.js', 'GET', innerPort)).status, 200);
  } finally {
    await new Promise((resolve) => inner.close(resolve));
  }
  assert.equal((await request('/src/main.js%00.png')).status, 400);
});

test('no sirve dotfiles ni node_modules', async () => {
  assert.equal((await request('/.git/config')).status, 403);
  assert.equal((await request('/node_modules/x')).status, 403);
});

test('solo permite GET y HEAD', async () => {
  assert.equal((await request('/', 'POST')).status, 405);
  const head = await request('/', 'HEAD');
  assert.equal(head.status, 200);
  assert.equal(head.body.length, 0);
});
