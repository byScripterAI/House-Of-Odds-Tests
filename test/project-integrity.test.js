import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)));
const read = (file) => readFileSync(file, 'utf8');
const rel = (file) => relative(ROOT, file).split('\\').join('/');

function walk(dir, ext) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) out.push(...walk(full, ext));
    else if (full.endsWith(ext)) out.push(full);
  }
  return out;
}

/** Especificadores de import estáticos, side-effect y dinámicos. */
function importsOf(source) {
  const found = [];
  const patterns = [
    /^\s*(?:import|export)\b[^;'"]*?\bfrom\s*['"]([^'"]+)['"]/gm,
    /^\s*import\s*['"]([^'"]+)['"]/gm,
    /\bimport\(\s*['"]([^'"]+)['"]\s*\)/g,
  ];
  for (const re of patterns) for (const m of source.matchAll(re)) found.push(m[1]);
  return found;
}

const html = read(join(ROOT, 'index.html'));
const importMap = JSON.parse(html.match(/<script type="importmap">([\s\S]*?)<\/script>/)[1]).imports;
const srcFiles = walk(join(ROOT, 'src'), '.js');

test('el import map apunta a ficheros que existen', () => {
  for (const [name, target] of Object.entries(importMap)) {
    assert.ok(existsSync(resolve(ROOT, target)), `import map «${name}» → ${target} no existe`);
  }
});

test('three.module.js importa ficheros vecinos que existen (three.core.js)', () => {
  const file = resolve(ROOT, importMap.three);
  for (const spec of importsOf(read(file))) {
    assert.ok(spec.startsWith('.'), `three importa algo no relativo: ${spec}`);
    assert.ok(existsSync(resolve(dirname(file), spec)), `three importa ${spec}, que no está en vendor/`);
  }
});

test('todos los imports de src/ se resuelven (relativos a fichero, o presentes en el import map)', () => {
  assert.ok(srcFiles.length > 0);
  for (const file of srcFiles) {
    for (const spec of importsOf(read(file))) {
      if (spec.startsWith('.')) {
        assert.ok(existsSync(resolve(dirname(file), spec)), `${rel(file)}: import roto → ${spec}`);
        assert.ok(/\.m?js$/.test(spec), `${rel(file)}: los imports relativos deben llevar extensión → ${spec}`);
      } else {
        assert.ok(Object.hasOwn(importMap, spec), `${rel(file)}: «${spec}» no está en el import map`);
      }
    }
  }
});

test('index.html referencia hojas de estilo y scripts que existen', () => {
  const refs = [...html.matchAll(/<(?:link[^>]*href|script[^>]*src)="([^"]+)"/g)].map((m) => m[1]);
  assert.ok(refs.length >= 2);
  for (const ref of refs) {
    if (/^(https?:)?\/\//.test(ref)) assert.fail(`dependencia externa (CDN) no permitida: ${ref}`);
    assert.ok(existsSync(resolve(ROOT, ref)), `index.html referencia ${ref}, que no existe`);
  }
});

test('el CSS solo referencia recursos locales que existen', () => {
  for (const file of walk(join(ROOT, 'styles'), '.css')) {
    for (const m of read(file).matchAll(/url\(\s*['"]?([^'")]+)['"]?\s*\)/g)) {
      const ref = m[1];
      if (ref.startsWith('data:')) continue;
      assert.ok(!/^(https?:)?\/\//.test(ref), `${rel(file)}: recurso externo → ${ref}`);
      assert.ok(existsSync(resolve(dirname(file), ref)), `${rel(file)}: url() roto → ${ref}`);
    }
  }
});

test('capas: los módulos puros no importan Three.js ni el DOM', () => {
  const pure = [
    'src/config.js',
    'src/core/errors.js',
    'src/core/game-states.js',
    'src/core/event-bus.js',
    'src/core/state-machine.js',
    'src/core/rng.js',
    'src/core/loop.js',
  ];
  for (const file of pure) {
    const source = read(join(ROOT, file));
    assert.ok(!importsOf(source).includes('three'), `${file} no debe importar three`);
    assert.ok(!/\bdocument\./.test(source.replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, '')), `${file} no debe tocar document`);
  }
});

test('capas: core/ no depende de ui/ ni de dev/', () => {
  for (const file of srcFiles.filter((f) => rel(f).startsWith('src/core/'))) {
    for (const spec of importsOf(read(file))) {
      assert.ok(!/\/(ui|dev)\//.test(spec), `${rel(file)} importa ${spec}: core no puede depender de ui/dev`);
    }
  }
});

test('no hay llamadas a APIs de apuestas ni a servicios externos en el código', () => {
  for (const file of srcFiles) {
    const source = read(file);
    // única excepción: audio-engine carga sus .mp3 opcionales de assets/audio (mismo origen)
    if (/\bfetch\s*\(/.test(source)) {
      assert.equal(rel(file), 'src/audio/audio-engine.js', `${rel(file)}: el juego no debe hacer peticiones de red`);
      assert.ok(/fetch\(`\$\{AUDIO_DIR\}/.test(source), 'fetch solo puede apuntar a AUDIO_DIR');
    }
    assert.ok(!/XMLHttpRequest|WebSocket|sendBeacon/.test(source), `${rel(file)}: acceso a red no permitido`);
  }
});
