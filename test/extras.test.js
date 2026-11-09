import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { Tutorial, INTRO_STEPS, HINTS } from '../src/systems/tutorial.js';
import { SOUNDS, SOUND_NAMES } from '../src/audio/sound-list.js';
import { MAIN_CREDITS, FINAL_CREDITS } from '../src/data/credits.js';
import { Progress, normalizeState } from '../src/systems/progress.js';
import { sanitizeSettings } from '../src/save/save-manager.js';

test('Tutorial: avanza en orden y cuenta eventos ocurridos antes de su paso', () => {
  const changes = [];
  const t = new Tutorial({ onChange: (step, done) => changes.push([step?.id, done]) });
  assert.equal(t.current.id, 'look');
  t.report('spin'); // adelantado: no avanza todavía
  assert.equal(t.current.id, 'look');
  t.report('look');
  assert.equal(t.current.id, 'move');
  t.report('move');
  t.report('enterMachine'); // y 'spin' ya contaba → salta a 'leave'
  assert.equal(t.current.id, 'leave');
  for (const e of ['leaveMachine', 'openShop', 'buy']) t.report(e);
  assert.equal(t.active, false);
  assert.equal(t.current, null);
  assert.equal(changes.at(-1)[1], true);
  assert.equal(t.report('look'), false);
});

test('Tutorial: pasos y avisos tienen ids únicos y texto', () => {
  const ids = [...INTRO_STEPS, ...HINTS].map((s) => s.id);
  assert.equal(new Set(ids).size, ids.length);
  for (const s of INTRO_STEPS) assert.ok(s.text.length > 5 && s.event);
});

test('Progress: los tutoriales vistos se guardan, se limpian y no se duplican', () => {
  const p = new Progress(null, { tutorials: ['intro', 'intro', 7, 'x'.repeat(100)] });
  assert.deepEqual(p.state.tutorials, ['intro']);
  p.markTutorial('hint-wing');
  p.markTutorial('hint-wing');
  assert.deepEqual(p.toJSON().tutorials, ['intro', 'hint-wing']);
  assert.deepEqual(normalizeState({}).tutorials, []);
});

test('Sonidos: nombres únicos y SOUNDS.md documenta todos', () => {
  assert.equal(new Set(SOUND_NAMES).size, SOUND_NAMES.length);
  assert.ok(existsSync(new URL('../assets/audio/SOUNDS.md', import.meta.url)));
  const md = readFileSync(new URL('../assets/audio/SOUNDS.md', import.meta.url), 'utf8');
  for (const s of SOUNDS) assert.ok(md.includes(`\`${s.name}.mp3\``), `falta ${s.name}.mp3 en SOUNDS.md`);
});

test('Créditos: contienen a todo el equipo y los textos exigidos', () => {
  const flat = (c) => c.map((b) => b.v ?? '').join('\n');
  for (const name of ['Hugo Gonzalez', 'Ethan Caldwell', 'Lucía Fernández', 'Lucas Whitmore', 'Marc Belmonte', 'Oliver Hayes', 'Gabriel Ashford', 'Clara Bennett', 'Marta Villanueva', 'Sebastian Cole', 'Pablo Ferrer']) {
    assert.ok(flat(MAIN_CREDITS).includes(name) && flat(FINAL_CREDITS).includes(name), name);
  }
  assert.ok(flat(MAIN_CREDITS).includes('Núria Castañer'));
  assert.ok(flat(FINAL_CREDITS).includes('Nuria Salvatierra'));
  assert.ok(flat(FINAL_CREDITS).includes('YOU BUILT THE HOUSE.'));
  assert.ok(flat(FINAL_CREDITS).includes('THANK YOU FOR PLAYING'));
  assert.ok(flat(MAIN_CREDITS).includes('© 2026 VANTA INTERACTIVE. ALL RIGHTS RESERVED.'));
});

test('Ajustes: screenFx se valida y por defecto está activo', () => {
  assert.equal(sanitizeSettings({}).graphics.screenFx, true);
  assert.equal(sanitizeSettings({ graphics: { screenFx: false } }).graphics.screenFx, false);
  assert.equal(sanitizeSettings({ graphics: { screenFx: 'no' } }).graphics.screenFx, true);
});

test('El juego no menciona apuestas ni dinero real en su interfaz', () => {
  for (const f of ['../src/ui/main-menu.js', '../src/machines/classic.js', '../src/world/world.js', '../index.html']) {
    const src = readFileSync(new URL(f, import.meta.url), 'utf8');
    assert.ok(!/sin apuestas|dinero real|casa nunca|cada giro suma/i.test(src), f);
  }
});
