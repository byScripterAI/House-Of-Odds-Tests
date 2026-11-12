/**
 * Mejoras comprables con MARKS. Solo datos + `computeLoadout` (puro).
 * Los textos viven en i18n (`upgrade.<id>.name|desc`).
 * branch: 'casino' (instalaciones, sala, decoración) | 'machine' (THE CLASSIC)
 * requires: { prestige?: number, upgrades?: string[] }
 */

const make = (u) => Object.freeze({ requires: Object.freeze({}), effect: Object.freeze({}), ...u });

// Precios en coherencia con las recompensas de misión (M01 da 100, M02 150, M03 200…):
// nada importante cuesta menos que una misión. Las mejoras de multiplicador suben el PRESTIGE,
// no los pagos; las instalaciones de caja amplían la APUESTA MÁXIMA.
const LIST = [
  // ---- CASINO (Daniel Reed: obras, limpieza, luz, ampliaciones, instalaciones) ----
  make({ id: 'clean-1', branch: 'casino', group: 'clean', cost: 200, effect: { clean: 0.55 } }),
  make({ id: 'clean-2', branch: 'casino', group: 'clean', cost: 450, requires: { prestige: 40, upgrades: ['clean-1'] }, effect: { clean: 1 } }),
  make({ id: 'lighting-1', branch: 'casino', group: 'lighting', cost: 250, effect: { lighting: 1 } }),
  make({ id: 'lighting-2', branch: 'casino', group: 'lighting', cost: 600, requires: { prestige: 60, upgrades: ['lighting-1'] }, effect: { lighting: 2 } }),
  make({ id: 'lighting-3', branch: 'casino', group: 'lighting', cost: 1200, requires: { prestige: 150, upgrades: ['lighting-2'] }, effect: { lighting: 3 } }),
  make({ id: 'decor-vases', branch: 'casino', group: 'decor', cost: 150 }),
  make({ id: 'decor-carpet', branch: 'casino', group: 'decor', cost: 300 }),
  make({ id: 'decor-gallery', branch: 'casino', group: 'decor', cost: 380, requires: { prestige: 20 } }),
  make({ id: 'decor-lamps', branch: 'casino', group: 'decor', cost: 420, requires: { prestige: 35 } }),
  make({ id: 'decor-busts', branch: 'casino', group: 'decor', cost: 520, requires: { prestige: 40 } }),
  make({ id: 'decor-velvet', branch: 'casino', group: 'decor', cost: 650, requires: { prestige: 50 } }),
  make({ id: 'decor-statue', branch: 'casino', group: 'decor', cost: 450, requires: { prestige: 30 } }),
  make({ id: 'decor-chandelier', branch: 'casino', group: 'decor', cost: 900, requires: { prestige: 90 } }),
  make({ id: 'expand-hall', branch: 'casino', group: 'expand', cost: 1500, requires: { prestige: 120 } }),
  make({ id: 'install-register', branch: 'casino', group: 'install', cost: 350, requires: { prestige: 20 }, effect: { betMaxAdd: 150 } }),
  make({ id: 'install-vault', branch: 'casino', group: 'install', cost: 900, requires: { prestige: 100, upgrades: ['install-register'] }, effect: { betMaxAdd: 250 } }),
  // ---- MÁQUINA (THE CLASSIC) ----
  make({ id: 'mod-gilded-reels', branch: 'machine', group: 'mod', cost: 300, effect: { bonusMult: 0.25, gilded: true } }),
  make({ id: 'mod-quick-reels', branch: 'machine', group: 'mod', cost: 250, effect: { quick: true } }),
  make({ id: 'mod-flare', branch: 'machine', group: 'mod', cost: 350, effect: { flare: true } }),
  make({ id: 'mod-wild-star', branch: 'machine', group: 'symbol', cost: 600, requires: { prestige: 60 }, effect: { star: true } }),
  make({ id: 'syn-royal', branch: 'machine', group: 'synergy', cost: 800, requires: { upgrades: ['mod-wild-star'] }, effect: { royal: true } }),
  make({ id: 'mod-lucky-bell', branch: 'machine', group: 'mod', cost: 1000, requires: { prestige: 80, upgrades: ['mod-gilded-reels'] }, effect: { bonusMult: 0.5 } }),
];

export const UPGRADES = Object.freeze(Object.fromEntries(LIST.map((u) => [u.id, u])));

/** Resume lo que aportan las mejoras poseídas. */
export function computeLoadout(ownedIds) {
  const out = {
    betMaxAdd: 0, bonusMult: 1, star: false, royal: false, flare: false, quick: false,
    gilded: false, lighting: 0, clean: 0, carpet: false, statue: false, chandelier: false, expanded: false, decorSets: [],
  };
  for (const id of ownedIds) {
    const u = Object.hasOwn(UPGRADES, id) ? UPGRADES[id] : null;
    if (!u) continue;
    const e = u.effect;
    out.betMaxAdd += e.betMaxAdd ?? 0;
    out.bonusMult += e.bonusMult ?? 0;
    out.star ||= !!e.star;
    out.royal ||= !!e.royal;
    out.flare ||= !!e.flare;
    out.quick ||= !!e.quick;
    out.gilded ||= !!e.gilded;
    out.lighting = Math.max(out.lighting, e.lighting ?? 0);
    out.clean = Math.max(out.clean, e.clean ?? 0);
  }
  const has = (id) => ownedIds.includes(id);
  out.carpet = has('decor-carpet');
  out.statue = has('decor-statue');
  out.chandelier = has('decor-chandelier');
  out.expanded = has('expand-hall');
  out.decorSets = ownedIds.filter((id) => ['decor-vases', 'decor-gallery', 'decor-lamps', 'decor-busts', 'decor-velvet'].includes(id));
  return out;
}
