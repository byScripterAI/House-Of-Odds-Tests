import { FEATURES } from '../config.js';
/**
 * CONVERSACIONES (datos). Cada nodo es una línea (`say`) o una elección (`choices`).
 *
 *  Texto:  dlg.<conversación>.<nodo>            (líneas)
 *          dlg.<conversación>.<nodo>.<opción>   (respuestas del jugador)
 *  Voz:    assets/audio/voice/<conversación>__<nodo>.mp3  (opcional; con variante por idioma
 *          assets/audio/voice/<idioma>/<conversación>__<nodo>.mp3). Ver docs/DIALOGUE_AUDIO.md.
 *
 *  `say`: id del personaje o 'player'. `next`: nodo siguiente. `end`: fin.
 *  `effects` (al mostrar la línea o al elegir la opción):
 *     {rel:[pnj, n]} · {set:[variable, valor]} · {flag} · {start: misión} · {grant: mejora} ·
 *     {shop: proveedor} · {npcPost:[pnj, puesto]}
 *  `branch`: [{cond, next}] · `else`: nodo — saltos condicionales sin texto.
 *  `cond` en opciones: solo se muestran si se cumple (ver QuestEngine.test).
 */

const L = (say, next, extra = {}) => ({ say, next, ...extra });
const E = (say, extra = {}) => ({ say, end: true, ...extra });

const ALL_DIALOGUES = {
  // ================================================================== M01 · A NEW BEGINNING
  m01_intro: {
    npc: 'victoria', quest: 'm01',
    nodes: {
      start: L('victoria', 'c1'),
      c1: { choices: [
        { id: 'a', next: 'v1', effects: [{ rel: ['victoria', 2] }] },
        { id: 'b', next: 'v1' },
        { id: 'c', next: 'v1', effects: [{ rel: ['victoria', 1] }] },
      ] },
      v1: L('victoria', 'v2'),
      v2: L('victoria', 'v3'),
      v3: L('victoria', 'p1'),
      p1: L('player', 'v4'),
      v4: L('victoria', 'v5'),
      v5: L('victoria', 'v6'),
      v6: L('victoria', 'v7'),
      v7: E('victoria'),
    },
  },
  m01_report: {
    npc: 'victoria', quest: 'm01',
    nodes: {
      start: L('victoria', 'c1'),
      c1: { choices: [
        { id: 'a', next: 'va', effects: [{ rel: ['victoria', 8] }, { set: ['victoria_attitude', 'committed'] }] },
        { id: 'b', next: 'vb', effects: [{ rel: ['victoria', 2] }, { set: ['victoria_attitude', 'pragmatic'] }] },
        { id: 'c', next: 'vc', effects: [{ set: ['victoria_attitude', 'distant'] }] },
      ] },
      va: L('victoria', 'v1'),
      vb: L('victoria', 'v1'),
      vc: L('victoria', 'v1'),
      v1: L('victoria', 'v2'),
      v2: E('victoria'),
    },
  },

  // ================================================================== M02 · THE FIRST MACHINE
  m02_intro: {
    npc: 'daniel', quest: 'm02',
    nodes: {
      start: L('daniel', 'c1'),
      c1: { choices: [
        { id: 'a', next: 'd1', effects: [{ rel: ['daniel', 2] }] },
        { id: 'b', next: 'db', effects: [{ rel: ['daniel', 1] }] },
        { id: 'c', next: 'd1' },
      ] },
      db: L('daniel', 'd1'),
      d1: L('daniel', 'd2'),
      d2: L('daniel', 'd3'),
      d3: L('daniel', 'd4'),
      d4: E('daniel'),
    },
  },
  m02_panel: {
    npc: 'daniel', quest: 'm02',
    nodes: { start: L('daniel', 'd2'), d2: E('daniel') },
  },
  m02_mechanism: {
    npc: 'daniel', quest: 'm02',
    nodes: {
      start: L('daniel', 'd2'),
      d2: L('daniel', 'c1'),
      c1: { choices: [
        { id: 'a', next: 'da', effects: [{ rel: ['daniel', 5] }, { set: ['daniel_classic', 'love'] }] },
        { id: 'b', next: 'db1', effects: [{ rel: ['daniel', 1] }, { set: ['daniel_classic', 'replace'] }] },
      ] },
      da: L('daniel', 'dend'),
      db1: L('daniel', 'db2'),
      db2: L('daniel', 'dend'),
      dend: E('daniel'),
    },
  },
  m02_outro: {
    npc: 'daniel', quest: 'm02',
    nodes: { start: L('daniel', 'd2'), d2: L('daniel', 'd3'), d3: L('daniel', 'd4'), d4: E('daniel') },
  },

  // ================================================================== M03 · OPEN FOR BUSINESS
  m03_intro: {
    npc: 'isabella', quest: 'm03',
    nodes: { start: L('isabella', 'i2'), i2: L('isabella', 'i3'), i3: L('isabella', 'i4'), i4: L('isabella', 'i5'), i5: E('isabella') },
  },
  m03_repair: {
    npc: 'daniel', quest: 'm03',
    nodes: {
      start: L('daniel', 'd2'),
      d2: L('daniel', 'c1'),
      c1: { choices: [
        { id: 'a', next: 'da', effects: [{ rel: ['daniel', 3] }] },
        { id: 'b', next: 'db', effects: [{ rel: ['daniel', 1] }] },
      ] },
      da: L('daniel', 'dend'),
      db: L('daniel', 'dend'),
      dend: E('daniel'),
    },
  },
  m03_outro: {
    npc: 'isabella', quest: 'm03',
    nodes: {
      start: L('isabella', 'i2'),
      i2: L('isabella', 'c1'),
      c1: { choices: [
        { id: 'a', next: 'ia', effects: [{ set: ['reopening_style', 'elegant'] }, { grant: 'decor-carpet' }, { rel: ['isabella', 3] }] },
        { id: 'b', next: 'ib', effects: [{ set: ['reopening_style', 'flashy'] }, { grant: 'lighting-2' }, { rel: ['isabella', 3] }] },
        { id: 'c', next: 'ic', effects: [{ set: ['reopening_style', 'repairs'] }, { flag: 'daniel_extra' }, { rel: ['daniel', 3] }] },
      ] },
      ia: L('isabella', 'iend'),
      ib: L('isabella', 'iend'),
      ic: L('isabella', 'iend'),
      iend: E('isabella'),
    },
  },

  // ================================================================== M04 · THE HOUSE OF CARDS
  m04_intro: {
    npc: 'oliver', quest: 'm04',
    nodes: {
      start: L('oliver', 'o2'),
      o2: L('oliver', 'o3'),
      o3: L('oliver', 'o4'),
      o4: L('oliver', 'c1'),
      c1: { choices: [
        { id: 'a', next: 'oa', effects: [{ set: ['bj_tutorial', 'full'] }, { rel: ['oliver', 3] }] },
        { id: 'b', next: 'ob', effects: [{ set: ['bj_tutorial', 'quick'] }, { rel: ['oliver', 1] }] },
        { id: 'c', next: 'oc1', effects: [{ set: ['bj_tutorial', 'variants'] }, { rel: ['oliver', 2] }] },
      ] },
      oa: L('oliver', 'oend'),
      ob: L('oliver', 'oend'),
      oc1: L('oliver', 'oc2'),
      oc2: L('oliver', 'oend'),
      oend: E('oliver'),
    },
  },
  m04_rules: {
    npc: 'oliver', quest: 'm04',
    nodes: {
      start: L('oliver', 'pick'),
      pick: { branch: [{ cond: { var: 'bj_tutorial', eq: 'full' }, next: 'f1' }], else: 'q1' },
      f1: L('oliver', 'f2'),
      f2: L('oliver', 'f3'),
      f3: L('oliver', 'f4'),
      f4: L('oliver', 'f5'),
      f5: L('oliver', 'pfull'),
      pfull: E('oliver'),
      q1: L('oliver', 'pquick'),
      pquick: E('oliver'),
    },
  },
  m04_outro: {
    npc: 'oliver', quest: 'm04',
    nodes: {
      start: L('oliver', 'o2'),
      o2: L('oliver', 'c1'),
      c1: { choices: [
        { id: 'a', next: 'oa', effects: [{ rel: ['oliver', 3] }] },
        { id: 'b', next: 'ob', effects: [{ rel: ['oliver', 1] }] },
      ] },
      oa: L('oliver', 'oend'),
      ob: L('oliver', 'oend'),
      oend: E('oliver'),
    },
  },

  // ================================================================== M05 · THE PERFECT SPIN
  m05_intro: {
    npc: 'lucas', quest: 'm05',
    nodes: { start: L('lucas', 'l2'), l2: L('lucas', 'l3'), l3: L('lucas', 'l4'), l4: E('lucas') },
  },
  m05_rules: {
    npc: 'lucas', quest: 'm05',
    nodes: {
      start: L('lucas', 'l2'),
      l2: L('lucas', 'l3'),
      l3: L('lucas', 'c1'),
      c1: { choices: [
        { id: 'a', next: 'la', effects: [{ set: ['roulette_taste', 'classic'] }, { rel: ['lucas', 3] }] },
        { id: 'b', next: 'lb', effects: [{ set: ['roulette_taste', 'modern'] }, { rel: ['lucas', 2] }] },
        { id: 'c', next: 'lc', effects: [{ set: ['roulette_taste', 'variants'] }, { rel: ['lucas', 2] }] },
      ] },
      la: L('lucas', 'lend'),
      lb: L('lucas', 'lend'),
      lc: L('lucas', 'lend'),
      lend: E('lucas'),
    },
  },
  m05_outro: {
    npc: 'lucas', quest: 'm05',
    nodes: {
      start: L('lucas', 'l2'),
      l2: L('lucas', 'c1'),
      c1: { choices: [
        { id: 'a', next: 'la', effects: [{ rel: ['lucas', 2] }] },
        { id: 'b', next: 'lb', effects: [{ rel: ['lucas', 3] }] },
      ] },
      la: L('lucas', 'lend'),
      lb: L('lucas', 'lend'),
      lend: E('lucas'),
    },
  },

  // ================================================================== S01 · A MACHINE'S HISTORY
  s01_offer: {
    npc: 'daniel', quest: 's01',
    nodes: {
      start: L('daniel', 'd2'),
      d2: L('daniel', 'c1'),
      c1: { choices: [
        { id: 'a', next: 'da', effects: [{ rel: ['daniel', 3] }, { start: 's01' }] },
        { id: 'b', next: 'db', effects: [{ start: 's01' }] },
      ] },
      da: E('daniel'),
      db: E('daniel'),
    },
  },
  s01_deliver: {
    npc: 'daniel', quest: 's01',
    nodes: { start: L('daniel', 'd2'), d2: L('daniel', 'd3'), d3: E('daniel') },
  },

  // ================================================================== S02 · A BETTER FIRST IMPRESSION
  s02_offer: {
    npc: 'isabella', quest: 's02',
    nodes: {
      start: L('isabella', 'i2'),
      i2: L('isabella', 'c1'),
      c1: { choices: [{ id: 'a', next: 'ia', effects: [{ start: 's02' }, { rel: ['isabella', 2] }] }, { id: 'b', next: 'ib' }] },
      ia: E('isabella'),
      ib: E('isabella'),
    },
  },
  s02_choose: {
    npc: 'isabella', quest: 's02',
    nodes: {
      start: L('isabella', 'c1'),
      c1: { choices: [
        { id: 'a', next: 'ia', effects: [{ set: ['reception_style', 'elegant'] }] },
        { id: 'b', next: 'ib', effects: [{ set: ['reception_style', 'modern'] }] },
        { id: 'c', next: 'ic', effects: [{ set: ['reception_style', 'classic'] }] },
      ] },
      ia: L('isabella', 'iend'),
      ib: L('isabella', 'iend'),
      ic: L('isabella', 'iend'),
      iend: E('isabella'),
    },
  },
  s02_confirm: {
    npc: 'isabella', quest: 's02',
    nodes: { start: L('isabella', 'i2'), i2: E('isabella') },
  },

  // ================================================================== X01 · THE CLASSIC MASTER
  x01_offer: {
    npc: 'daniel', quest: 'x01',
    nodes: {
      start: L('daniel', 'd2'),
      d2: L('daniel', 'c1'),
      c1: { choices: [{ id: 'a', next: 'da', effects: [{ start: 'x01' }] }, { id: 'b', next: 'db' }] },
      da: E('daniel'),
      db: E('daniel'),
    },
  },
  x01_done: {
    npc: 'daniel', quest: 'x01',
    nodes: { start: L('daniel', 'd2'), d2: E('daniel') },
  },

  // ================================================================== X05 · TWENTY-ONE CLUB
  x05_offer: {
    npc: 'oliver', quest: 'x05',
    nodes: {
      start: L('oliver', 'o2'),
      o2: L('oliver', 'c1'),
      c1: { choices: [{ id: 'a', next: 'oa', effects: [{ start: 'x05' }, { rel: ['oliver', 2] }] }, { id: 'b', next: 'ob' }] },
      oa: E('oliver'),
      ob: E('oliver'),
    },
  },
  x05_done: {
    npc: 'oliver', quest: 'x05',
    nodes: { start: L('oliver', 'o2'), o2: E('oliver') },
  },

  // ================================================================== X06 · THE PERFECT NUMBER
  x06_offer: {
    npc: 'lucas', quest: 'x06',
    nodes: {
      start: L('lucas', 'l2'),
      l2: L('lucas', 'c1'),
      c1: { choices: [{ id: 'a', next: 'la', effects: [{ start: 'x06' }, { rel: ['lucas', 2] }] }, { id: 'b', next: 'lb' }] },
      la: E('lucas'),
      lb: E('lucas'),
    },
  },
  x06_done: {
    npc: 'lucas', quest: 'x06',
    nodes: { start: L('lucas', 'l2'), l2: E('lucas') },
  },

  // ================================================================== CHARLA (repetible, cambia con el progreso)
  vic_tour: { npc: 'victoria', nodes: { start: E('victoria') } },
  vic_daniel: { npc: 'victoria', nodes: { start: E('victoria') } },
  vic_wait: { npc: 'victoria', nodes: { start: L('victoria', 'v2'), v2: E('victoria') } },
  vic_m03: { npc: 'victoria', nodes: { start: E('victoria') } },
  vic_cards: { npc: 'victoria', nodes: { start: E('victoria') } },
  vic_roulette: { npc: 'victoria', nodes: { start: E('victoria') } },
  vic_floor: { npc: 'victoria', nodes: { start: L('victoria', 'v2'), v2: E('victoria') } },
  vic_after: {
    npc: 'victoria',
    nodes: {
      start: { branch: [{ cond: { var: 'victoria_attitude', eq: 'distant' }, next: 'cold' }], else: 'warm' },
      warm: L('victoria', 'v2'),
      cold: L('victoria', 'v2'),
      v2: E('victoria'),
    },
  },
  dan_busy: { npc: 'daniel', nodes: { start: E('daniel') } },
  dan_m02: { npc: 'daniel', nodes: { start: E('daniel') } },
  dan_service: {
    npc: 'daniel',
    nodes: {
      start: L('daniel', 'c1'),
      c1: { choices: [{ id: 'a', next: 'shop' }, { id: 'b', next: 'bye' }] },
      shop: E('daniel', { effects: [{ shop: 'daniel' }] }),
      bye: E('daniel'),
    },
  },
  isa_hello: { npc: 'isabella', nodes: { start: L('isabella', 'i2'), i2: E('isabella') } },
  isa_m03: { npc: 'isabella', nodes: { start: E('isabella') } },
  isa_after: { npc: 'isabella', nodes: { start: E('isabella') } },
  eth_closed: { npc: 'ethan', nodes: { start: L('ethan', 'e2'), e2: E('ethan') } },
  eth_open: { npc: 'ethan', nodes: { start: E('ethan') } },
  oli_wait: { npc: 'oliver', nodes: { start: L('oliver', 'o2'), o2: E('oliver') } },
  oli_soon: { npc: 'oliver', nodes: { start: E('oliver') } },
  oli_m04: { npc: 'oliver', nodes: { start: E('oliver') } },
  oli_open: { npc: 'oliver', nodes: { start: L('oliver', 'o2'), o2: E('oliver') } },
  luc_wait: { npc: 'lucas', nodes: { start: L('lucas', 'l2'), l2: E('lucas') } },
  luc_soon: { npc: 'lucas', nodes: { start: E('lucas') } },
  luc_m05: { npc: 'lucas', nodes: { start: E('lucas') } },
  luc_open: { npc: 'lucas', nodes: { start: L('lucas', 'l2'), l2: E('lucas') } },
  sof_dirty: { npc: 'sofia', nodes: { start: L('sofia', 's2'), s2: E('sofia') } },
  sof_service: {
    npc: 'sofia',
    nodes: {
      start: L('sofia', 'c1'),
      c1: { choices: [{ id: 'a', next: 'shop' }, { id: 'b', next: 'bye' }] },
      shop: E('sofia', { effects: [{ shop: 'sofia' }] }),
      bye: E('sofia'),
    },
  },
};

const CARD_DIALOGUES = /^(m04_|m05_|x05_|x06_|vic_cards|vic_roulette|vic_floor|oli_m04|oli_open|luc_m05|luc_open)/;
export const DIALOGUES = Object.freeze(Object.fromEntries(Object.entries(ALL_DIALOGUES).filter(([id]) => FEATURES.cardsChapter || !CARD_DIALOGUES.test(id))));

/**
 * Charla repetible por personaje, por prioridad (la primera cuya condición se cumple).
 * Las misiones con objetivo «hablar» y las ofertas de misión tienen prioridad sobre esto.
 */
const ALL_SMALLTALK = {
  victoria: [
    { id: 'vic_tour', cond: { quest: 'm01', step: 'tour' } },
    { id: 'vic_daniel', cond: { quest: 'm02', state: 'active' } },
    { id: 'vic_m03', cond: { quest: 'm03', state: 'active' } },
    { id: 'vic_floor', cond: { quest: 'm05', state: 'completed' } },
    { id: 'vic_roulette', cond: { quest: 'm05', state: 'active' } },
    { id: 'vic_cards', cond: { quest: 'm04', state: 'active' } },
    { id: 'vic_after', cond: { quest: 'm03', state: 'completed' } },
    { id: 'vic_wait', cond: { quest: 'm02', state: 'completed' } },
  ],
  daniel: [
    { id: 'dan_m02', cond: { quest: 'm02', state: 'active' } },
    { id: 'dan_service', cond: { quest: 'm02', state: 'completed' } },
    { id: 'dan_busy' },
  ],
  isabella: [
    { id: 'isa_m03', cond: { quest: 'm03', state: 'active' } },
    { id: 'isa_after', cond: { quest: 'm03', state: 'completed' } },
    { id: 'isa_hello' },
  ],
  ethan: [{ id: 'eth_open', cond: { flag: 'reopened' } }, { id: 'eth_closed' }],
  oliver: [
    { id: 'oli_m04', cond: { quest: 'm04', state: 'active' } },
    { id: 'oli_open', cond: { flag: 'blackjack_open' } },
    { id: 'oli_soon', cond: { flag: 'reopened' } },
    { id: 'oli_wait' },
  ],
  lucas: [
    { id: 'luc_m05', cond: { quest: 'm05', state: 'active' } },
    { id: 'luc_open', cond: { flag: 'roulette_open' } },
    { id: 'luc_soon', cond: { flag: 'reopened' } },
    { id: 'luc_wait' },
  ],
  sofia: [{ id: 'sof_service', cond: { any: [{ flag: 'reopened' }, { quest: 'm03', state: 'active' }] } }, { id: 'sof_dirty' }],
};
export const SMALLTALK = Object.freeze(Object.fromEntries(Object.entries(ALL_SMALLTALK).map(([npc, list]) => [npc, list.filter((x) => DIALOGUES[x.id])])));

/** Lista plana de todas las líneas (para el documento de audio y las pruebas). */
export function allLines() {
  const out = [];
  for (const [id, d] of Object.entries(DIALOGUES)) {
    for (const [node, n] of Object.entries(d.nodes)) {
      if (n.say) out.push({ dialogue: id, node, speaker: n.say, key: `dlg.${id}.${node}`, voice: `${id}__${node}` });
      if (n.choices) for (const c of n.choices) out.push({ dialogue: id, node: `${node}.${c.id}`, speaker: 'player', key: `dlg.${id}.${node}.${c.id}`, voice: null, choice: true });
    }
  }
  return out;
}
