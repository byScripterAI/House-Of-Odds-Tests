import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Todos los `import { a, b } from './…'` del juego apuntan a exportaciones que existen. En el navegador, un
 * nombre que falta rompe la carga entera (pantalla de carga colgada) y las demás pruebas no lo ven porque
 * no importan los módulos que dependen de Three.js.
 */
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'src');
const files = [];
const walk = (d) => {
  for (const f of readdirSync(d)) {
    const p = join(d, f);
    if (statSync(p).isDirectory()) walk(p);
    else if (p.endsWith('.js')) files.push(p);
  }
};
walk(ROOT);

function exportsOf(path) {
  const src = readFileSync(path, 'utf8');
  const names = new Set();
  for (const m of src.matchAll(/export\s+(?:async\s+)?(?:function\*?|const|let|var|class)\s+([A-Za-z_$][\w$]*)/g)) names.add(m[1]);
  for (const m of src.matchAll(/export\s*\{([^}]*)\}/g)) {
    for (const part of m[1].split(',')) {
      const name = part.trim().split(/\s+as\s+/).pop()?.trim();
      if (name) names.add(name);
    }
  }
  if (/export\s+default/.test(src)) names.add('default');
  return names;
}

test('cada import con nombre de un módulo propio existe en ese módulo', () => {
  const problems = [];
  for (const file of files) {
    const src = readFileSync(file, 'utf8');
    for (const m of src.matchAll(/import\s*\{([^}]*)\}\s*from\s*['"](\.[^'"]+)['"]/g)) {
      const target = resolve(dirname(file), m[2]);
      let names;
      try {
        names = exportsOf(target);
      } catch {
        problems.push(`${file.replace(ROOT, 'src')}: no existe ${m[2]}`);
        continue;
      }
      for (const part of m[1].split(',')) {
        const name = part.trim().split(/\s+as\s+/)[0]?.trim();
        if (name && !names.has(name)) problems.push(`${file.replace(ROOT, 'src')}: «${name}» no se exporta en ${m[2]}`);
      }
    }
  }
  assert.deepEqual(problems, []);
});
