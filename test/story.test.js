import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DICTIONARIES } from '../src/i18n/index.js';
import { DIALOGUES, SMALLTALK, allLines } from '../src/story/dialogues.js';
import { QUESTS } from '../src/story/quests.js';
import { Q, QuestEngine, freshStory, normalizeStory } from '../src/story/quest-engine.js';
import { NAMED } from '../src/entities/npc-data.js';
import { POIS, STORY_SPOTS } from '../src/world/layout.js';
import { UPGRADES } from '../src/data/upgrades.js';

const langs = Object.keys(DICTIONARIES);

test('cada línea y respuesta de diálogo tiene texto en los 6 idiomas', () => {
  for (const line of allLines()) for (const l of langs) assert.ok(DICTIONARIES[l][line.key], `${l}: falta ${line.key}`);
});

test('los grafos de diálogo son coherentes (nodos, saltos, finales, hablantes)', () => {
  for (const [id, d] of Object.entries(DIALOGUES)) {
    assert.ok(d.nodes.start, `${id}: sin nodo start`);
    assert.ok(NAMED[d.npc], `${id}: personaje desconocido ${d.npc}`);
    const reachable = new Set();
    const visit = (n) => {
      if (reachable.has(n)) return;
      assert.ok(d.nodes[n], `${id}: salto a nodo inexistente «${n}»`);
      reachable.add(n);
      const node = d.nodes[n];
      if (node.say) assert.ok(node.say === 'player' || NAMED[node.say], `${id}.${n}: hablante desconocido`);
      if (node.next) visit(node.next);
      for (const c of node.choices ?? []) visit(c.next);
      for (const b of node.branch ?? []) visit(b.next);
      if (node.else) visit(node.else);
      assert.ok(node.end || node.next || node.choices || node.branch, `${id}.${n}: nodo sin salida`);
    };
    visit('start');
    for (const n of Object.keys(d.nodes)) assert.ok(reachable.has(n), `${id}: nodo inalcanzable ${n}`);
  }
});

test('los efectos de diálogo apuntan a misiones, mejoras y personajes existentes', () => {
  for (const [id, d] of Object.entries(DIALOGUES)) {
    for (const node of Object.values(d.nodes)) {
      for (const e of [...(node.effects ?? []), ...(node.choices ?? []).flatMap((c) => c.effects ?? [])]) {
        if (e.start) assert.ok(QUESTS[e.start], `${id}: start ${e.start}`);
        if (e.grant) assert.ok(UPGRADES[e.grant], `${id}: grant ${e.grant}`);
        if (e.rel) assert.ok(NAMED[e.rel[0]], `${id}: rel ${e.rel[0]}`);
      }
    }
  }
});

test('misiones: textos, objetivos y referencias válidos', () => {
  for (const q of Object.values(QUESTS)) {
    for (const l of langs) {
      assert.ok(DICTIONARIES[l][`quest.${q.id}.title`], `${l}: título ${q.id}`);
      assert.ok(DICTIONARIES[l][`quest.${q.id}.desc`], `${l}: desc ${q.id}`);
      for (const o of q.objectives) assert.ok(DICTIONARIES[l][`quest.${q.id}.obj.${o.id}`], `${l}: objetivo ${q.id}.${o.id}`);
    }
    assert.ok(NAMED[q.giver], `${q.id}: giver`);
    for (const o of q.objectives) {
      if (o.type === 'talk') assert.ok(DIALOGUES[o.dialogue] && DIALOGUES[o.dialogue].npc === o.npc, `${q.id}.${o.id}: diálogo`);
      if (o.type === 'visit') for (const p of o.points) assert.ok(POIS[p], `${q.id}: POI ${p}`);
      if (o.type === 'interact') assert.ok(STORY_SPOTS[o.target], `${q.id}: interactuable ${o.target}`);
    }
    if (q.offer) assert.ok(DIALOGUES[q.offer], `${q.id}: oferta`);
  }
  for (const [npc, list] of Object.entries(SMALLTALK)) {
    assert.ok(NAMED[npc]);
    for (const e of list) assert.ok(DIALOGUES[e.id] && DIALOGUES[e.id].npc === npc, `smalltalk ${e.id}`);
  }
});

const ctx = (spins = 0, prestige = 0, owned = []) => ({ spins, prestige, owned });

test('campaña: M01 arranca sola y se completa por pasos, con recompensa una sola vez', () => {
  const e = new QuestEngine(freshStory(), QUESTS);
  const n0 = e.evaluate(ctx());
  assert.equal(e.status('m01'), Q.ACTIVE);
  assert.ok(n0.some((n) => n.kind === 'started' && n.quest === 'm01'));
  assert.equal(e.objective('m01').def.id, 'meet');
  e.emit({ type: 'dialogue', id: 'm01_intro' }, ctx());
  assert.equal(e.objective('m01').def.id, 'tour');
  for (const p of ['classic', 'counter', 'cards']) e.emit({ type: 'visit', point: p }, ctx());
  e.emit({ type: 'visit', point: 'classic' }, ctx()); // repetido: no cuenta
  assert.equal(e.objective('m01').progress.n, 3);
  e.emit({ type: 'visit', point: 'roulette' }, ctx());
  const notes = e.emit({ type: 'dialogue', id: 'm01_report' }, ctx());
  const done = notes.find((n) => n.kind === 'completed' && n.quest === 'm01');
  assert.ok(done && done.first && done.rewards.marks === 100);
  assert.equal(e.status('m02'), Q.ACTIVE, 'M02 arranca al completar M01');
  assert.ok(e.relation('victoria').points >= 10);
  // completar otra vez no vuelve a pagar
  const again = e.complete('m01', ctx());
  assert.equal(again[0].first, false);
  assert.deepEqual(again[0].rewards, {});
});

test('M03 respeta la separación de tiradas tras M02', () => {
  const e = new QuestEngine(freshStory(), QUESTS);
  e.evaluate(ctx());
  e.emit({ type: 'dialogue', id: 'm01_intro' });
  for (const p of ['classic', 'counter', 'cards', 'roulette']) e.emit({ type: 'visit', point: p });
  e.emit({ type: 'dialogue', id: 'm01_report' });
  e.emit({ type: 'dialogue', id: 'm02_intro' }, ctx(0));
  e.emit({ type: 'interact', target: 'classic_panel' }, ctx(0));
  e.emit({ type: 'interact', target: 'toolbox' }, ctx(0));
  const mech = e.emit({ type: 'interact', target: 'classic_mechanism' }, ctx(0));
  assert.ok(e.hasFlag('classic_repaired'));
  assert.ok(mech.some((n) => n.onDone?.boot));
  e.emit({ type: 'spin', tier: 'none' }, ctx(1));
  e.emit({ type: 'dialogue', id: 'm02_outro' }, ctx(1));
  assert.equal(e.status('m02'), Q.COMPLETED);
  assert.equal(e.status('m03'), Q.LOCKED);
  const pend = e.pendingUnlock(ctx(5));
  assert.equal(pend.quest, 'm03');
  assert.equal(pend.n, 4);
  e.evaluate(ctx(12));
  assert.equal(e.status('m03'), Q.LOCKED);
  e.evaluate(ctx(13));
  assert.equal(e.status('m03'), Q.ACTIVE);
});

test('misión de oferta: disponible → la arranca el diálogo; desafío con «win» por niveles', () => {
  const st = freshStory();
  st.quests.m02 = { s: Q.COMPLETED, i: 6, p: { n: 0, seen: [] }, b: 0, r: true, at: 0 };
  const e = new QuestEngine(st, QUESTS);
  e.evaluate(ctx(0, 30));
  assert.equal(e.status('s01'), Q.AVAILABLE);
  assert.equal(e.status('x01'), Q.AVAILABLE);
  e.start('x01', ctx(0, 30));
  for (let i = 0; i < 10; i++) e.emit({ type: 'spin', tier: 'none' }, ctx(i + 1, 30));
  assert.equal(e.objective('x01').def.id, 'bonus');
  e.emit({ type: 'spin', tier: 'none' });
  assert.equal(e.objective('x01').def.id, 'bonus');
  e.emit({ type: 'spin', tier: 'small' });
  assert.equal(e.objective('x01').def.id, 'combo');
  e.emit({ type: 'spin', tier: 'small' });
  assert.equal(e.objective('x01').def.id, 'combo');
  e.emit({ type: 'spin', tier: 'jackpot' });
  assert.equal(e.objective('x01').def.id, 'report');
});

test('normalizeStory tolera basura y conserva solo datos válidos', () => {
  const s = normalizeStory({ quests: { m01: { s: 'active', i: 99 }, hack: { s: 'completed' }, m02: { s: 'weird' } }, vars: { ok: 'x', '<bad>': 1, big: 'x'.repeat(99) }, rel: { victoria: 999, daniel: -5 }, flags: ['a', 'a', 7, 'b c'], tracked: 'nope' }, QUESTS);
  assert.deepEqual(Object.keys(s.quests), ['m01']);
  assert.equal(s.quests.m01.i, QUESTS.m01.objectives.length);
  assert.deepEqual(s.vars, { ok: 'x' });
  assert.deepEqual(s.rel, { victoria: 100, daniel: 0 });
  assert.deepEqual(s.flags, ['a']);
  assert.equal(s.tracked, null);
  assert.deepEqual(normalizeStory(null, QUESTS), freshStory());
});

test('condiciones del motor', () => {
  const e = new QuestEngine(freshStory(), QUESTS);
  e.setVar('x', 'y');
  e.setFlag('f');
  e.addRelation('victoria', 35);
  assert.ok(e.test({ var: 'x', eq: 'y' }));
  assert.ok(e.test({ all: [{ flag: 'f' }, { not: { flag: 'g' } }] }));
  assert.ok(e.test({ rel: ['victoria', 2] }));
  assert.ok(!e.test({ rel: ['victoria', 3] }));
  assert.ok(e.test({ quest: 'm01', state: 'locked' }));
});

test('docs/DIALOGUE_AUDIO.md está al día con los diálogos (npm run dialogues)', async () => {
  const { readFileSync } = await import('node:fs');
  const { renderDialogueAudio } = await import('../scripts/dialogue-audio-lib.mjs');
  const current = readFileSync(new URL('../docs/DIALOGUE_AUDIO.md', import.meta.url), 'utf8');
  assert.equal(current, renderDialogueAudio(), 'ejecuta «npm run dialogues» para regenerarlo');
});

test('partidas antiguas (sin historia) entran con THE CLASSIC reparada y M01/M02 hechas', async () => {
  const { normalizeState } = await import('../src/systems/progress.js');
  const old = normalizeState({ marks: 500, stats: { totalActivations: 42 } });
  assert.equal(old.story.quests.m01.s, Q.COMPLETED);
  assert.equal(old.story.quests.m02.s, Q.COMPLETED);
  assert.ok(old.story.flags.includes('classic_repaired'));
  const fresh = normalizeState(null);
  assert.deepEqual(fresh.story, freshStory());
  const e = new QuestEngine(old.story, QUESTS);
  e.evaluate({ spins: 42 + 13, prestige: 0, owned: [] });
  assert.equal(e.status('m03'), Q.ACTIVE, 'con tiradas suficientes desde la migración, M03 arranca');
});

test('M03: antes de abrir las puertas hay que limpiar, dar la luz y que Daniel repare los desperfectos', () => {
  const m03 = QUESTS.m03;
  const ids = m03.objectives.map((o) => o.id);
  const at = (id) => ids.indexOf(id);
  assert.ok(at('clean') >= 0 && at('lights') >= 0 && at('repair') >= 0 && at('sign') >= 0);
  assert.ok(at('clean') < at('sign') && at('lights') < at('sign') && at('repair') < at('sign'), 'el cartel de ABIERTO va después de limpiar, iluminar y reparar');
  const repair = m03.objectives[at('repair')];
  assert.equal(repair.type, 'talk');
  assert.equal(repair.npc, 'daniel');
  assert.ok(DIALOGUES[repair.dialogue], 'existe la conversación de las reparaciones');
  assert.equal(repair.onDone?.repairHall, true);
  // y la primera limpieza retira todos los trastos del suelo (umbral de los trastos: 0,5)
  assert.ok(1 - UPGRADES['clean-1'].effect.clean < 0.5, 'tras clean-1 la suciedad queda por debajo del umbral de los trastos');
});
