import { FEATURES } from '../config.js';
/**
 * MISIONES (datos). Textos en i18n:
 *   quest.<id>.title · quest.<id>.desc · quest.<id>.obj.<objetivo>
 *
 * Tipos: main (campaña) · side (secundaria) · mastery (desafío) · event.
 * Objetivos: talk {npc, dialogue} · visit {points} · interact {target} ·
 *            spin {count} · win {tier, count} · buy {upgrade} · wait {spins} · flag {flag} ·
 *            play {game, count, tag?, practice?}  (rondas de mesa: blackjack / ruleta)
 * `onDone` de un objetivo: acciones del director al completarlo (cinemáticas, mundo…).
 * `requires.spinsAfter`: separación entre misiones (tiempo para jugar y ganar MARKS).
 * Regla del diseño: TODAS se completan sin gastar ni arriesgar MARKS.
 */

const q = (def) => Object.freeze({ type: 'main', autoStart: false, requires: {}, rewards: {}, ...def });

const LIST = [
  // ------------------------------------------------------------------ CAMPAÑA
  q({
    id: 'm01', order: 1, giver: 'victoria', autoStart: true,
    objectives: [
      { id: 'meet', type: 'talk', npc: 'victoria', dialogue: 'm01_intro' },
      { id: 'tour', type: 'visit', points: ['classic', 'counter', 'cards', 'roulette'] },
      { id: 'report', type: 'talk', npc: 'victoria', dialogue: 'm01_report' },
    ],
    rewards: { marks: 100, prestige: 5, relations: { victoria: 10 }, flags: ['tour_done'] },
  }),
  q({
    id: 'm02', order: 2, giver: 'daniel', autoStart: true, requires: { quests: ['m01'] },
    objectives: [
      { id: 'meet', type: 'talk', npc: 'daniel', dialogue: 'm02_intro', onDone: { npcPost: ['daniel', 'classic'] } },
      { id: 'panel', type: 'interact', target: 'classic_panel', onDone: { dialogue: 'm02_panel', openPanel: true } },
      { id: 'tools', type: 'interact', target: 'toolbox', onDone: { item: ['toolbox', false] } },
      { id: 'mechanism', type: 'interact', target: 'classic_mechanism', onDone: { flags: ['classic_repaired'], boot: true, dialogue: 'm02_mechanism' } },
      { id: 'demo', type: 'spin', count: 1 },
      { id: 'report', type: 'talk', npc: 'daniel', dialogue: 'm02_outro' },
    ],
    rewards: { marks: 150, prestige: 5, relations: { daniel: 10 }, npcPost: ['daniel', 'bench'], item: ['toolbox', true] },
  }),
  q({
    id: 'm03', order: 3, giver: 'isabella', autoStart: true, requires: { quests: ['m02'], spinsAfter: { quest: 'm02', n: 12 } },
    objectives: [
      { id: 'meet', type: 'talk', npc: 'isabella', dialogue: 'm03_intro' },
      { id: 'clean', type: 'interact', target: 'cleaning_crew', onDone: { grant: 'clean-1' } },
      { id: 'lights', type: 'interact', target: 'breaker', onDone: { grant: 'lighting-1' } },
      { id: 'repair', type: 'talk', npc: 'daniel', dialogue: 'm03_repair', onDone: { repairHall: true } },
      { id: 'sign', type: 'interact', target: 'welcome_sign', onDone: { flags: ['entrance_open'] } },
      { id: 'classic', type: 'visit', points: ['classic'] },
      { id: 'report', type: 'talk', npc: 'isabella', dialogue: 'm03_outro' },
    ],
    rewards: { marks: 200, prestige: 10, relations: { isabella: 10 }, flags: ['reopened'], crowd: 1, event: 'grand_opening' },
  }),
  q({
    id: 'm04', order: 4, giver: 'oliver', autoStart: true, requires: { quests: ['m03'], spinsAfter: { quest: 'm03', n: 10 } },
    objectives: [
      { id: 'meet', type: 'talk', npc: 'oliver', dialogue: 'm04_intro' },
      { id: 'inspect', type: 'interact', target: 'royal_table', onDone: { dialogue: 'm04_rules' } },
      { id: 'rules', type: 'talk', npc: 'oliver', dialogue: 'm04_rules' },
      { id: 'practice', type: 'play', game: 'blackjack', count: 1 },
      { id: 'report', type: 'talk', npc: 'oliver', dialogue: 'm04_outro' },
    ],
    rewards: { marks: 200, prestige: 10, relations: { oliver: 10 }, flags: ['blackjack_open'], unlocks: ['royal_blackjack'] },
  }),
  q({
    id: 'm05', order: 5, giver: 'lucas', autoStart: true, requires: { quests: ['m04'], spinsAfter: { quest: 'm04', n: 10 } },
    objectives: [
      { id: 'meet', type: 'talk', npc: 'lucas', dialogue: 'm05_intro' },
      { id: 'inspect', type: 'interact', target: 'royal_wheel', onDone: { dialogue: 'm05_rules' } },
      { id: 'rules', type: 'talk', npc: 'lucas', dialogue: 'm05_rules' },
      { id: 'predict', type: 'play', game: 'roulette', count: 3 },
      { id: 'report', type: 'talk', npc: 'lucas', dialogue: 'm05_outro' },
    ],
    rewards: { marks: 200, prestige: 10, relations: { lucas: 10 }, flags: ['roulette_open'], unlocks: ['royal_roulette'] },
  }),
  q({ id: 'm06', order: 6, giver: 'victoria', comingSoon: true, requires: { quests: ['m05'] }, objectives: [] }),

  // ------------------------------------------------------------------ SECUNDARIAS
  q({
    id: 's01', type: 'side', order: 101, giver: 'daniel', offer: 's01_offer', requires: { quests: ['m02'] },
    objectives: [
      { id: 'search', type: 'interact', target: 'doc_box', onDone: { item: ['doc_box', false] } },
      { id: 'deliver', type: 'talk', npc: 'daniel', dialogue: 's01_deliver' },
    ],
    rewards: { marks: 150, relations: { daniel: 8 }, flags: ['classic_vintage'] },
  }),
  q({
    id: 's02', type: 'side', order: 102, giver: 'isabella', offer: 's02_offer', requires: { quests: ['m03'] },
    objectives: [
      { id: 'review', type: 'visit', points: ['reception'] },
      { id: 'choose', type: 'talk', npc: 'isabella', dialogue: 's02_choose' },
      { id: 'place', type: 'interact', target: 'reception_decor', onDone: { reception: true } },
      { id: 'confirm', type: 'talk', npc: 'isabella', dialogue: 's02_confirm' },
    ],
    rewards: { marks: 200, relations: { isabella: 8 } },
  }),

  // ------------------------------------------------------------------ DESAFÍOS
  q({
    id: 'x01', type: 'mastery', order: 201, giver: 'daniel', offer: 'x01_offer', requires: { quests: ['m02'], prestige: 25 },
    objectives: [
      { id: 'rounds', type: 'spin', count: 10 },
      { id: 'bonus', type: 'win', tier: 'small', count: 1 },
      { id: 'combo', type: 'win', tier: 'big', count: 1 },
      { id: 'report', type: 'talk', npc: 'daniel', dialogue: 'x01_done' },
    ],
    rewards: { marks: 200, prestige: 10, relations: { daniel: 6 }, flags: ['title_classic_master'] },
  }),
  q({
    id: 'x05', type: 'mastery', order: 205, giver: 'oliver', offer: 'x05_offer', requires: { quests: ['m04'] },
    objectives: [
      { id: 'rounds', type: 'play', game: 'blackjack', count: 5, practice: false },
      { id: 'twentyone', type: 'play', game: 'blackjack', tag: '21', practice: false },
      { id: 'royal', type: 'play', game: 'blackjack', tag: 'blackjack', practice: false },
      { id: 'report', type: 'talk', npc: 'oliver', dialogue: 'x05_done' },
    ],
    rewards: { marks: 250, prestige: 12, relations: { oliver: 6 }, flags: ['cards_royal'], unlocks: ['cards_royal'] },
  }),
  q({
    id: 'x06', type: 'mastery', order: 206, giver: 'lucas', offer: 'x06_offer', requires: { quests: ['m05'] },
    objectives: [
      { id: 'category', type: 'play', game: 'roulette', tag: 'category', practice: false },
      { id: 'rounds', type: 'play', game: 'roulette', count: 5, practice: false },
      { id: 'exact', type: 'play', game: 'roulette', tag: 'straight', practice: true },
      { id: 'report', type: 'talk', npc: 'lucas', dialogue: 'x06_done' },
    ],
    rewards: { marks: 250, prestige: 12, relations: { lucas: 6 }, flags: ['wheel_gold'], unlocks: ['wheel_gold'] },
  }),
];

// Capítulo de cartas desactivado: la misión 4 vuelve a ser «próximamente» y 5/6 + desafíos de mesa no existen.
const CARD_IDS = new Set(['m05', 'm06', 'x05', 'x06']);
const ACTIVE = FEATURES.cardsChapter
  ? LIST
  : LIST.filter((x) => !CARD_IDS.has(x.id)).map((x) => (x.id === 'm04' ? q({ id: 'm04', order: 4, giver: 'oliver', comingSoon: true, requires: { quests: ['m03'] }, objectives: [] }) : x));
export const QUESTS = Object.freeze(Object.fromEntries(ACTIVE.map((x) => [x.id, x])));
export const QUEST_IDS = Object.freeze(ACTIVE.map((x) => x.id));
/** Versión del contenido jugable (para el final THE END modular). */
export const CONTENT_VERSION = FEATURES.cardsChapter ? 2 : 1;
