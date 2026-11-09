/**
 * Mejoras comprables con MARKS. Solo datos + `computeLoadout` (puro).
 * branch: 'casino' (instalaciones, sala, decoración) | 'machine' (THE CLASSIC)
 * requires: { prestige?: number, upgrades?: string[] }
 */

const make = (u) => Object.freeze({ requires: Object.freeze({}), effect: Object.freeze({}), ...u });

const LIST = [
  // ---- CASINO ----
  make({ id: 'lighting-1', branch: 'casino', group: 'lighting', name: 'Iluminación cálida I', desc: 'Focos más cálidos y apliques dorados.', cost: 60, effect: { lighting: 1 } }),
  make({ id: 'lighting-2', branch: 'casino', group: 'lighting', name: 'Iluminación cálida II', desc: 'Más intensidad y luces de ambiente carmesí.', cost: 180, requires: { prestige: 10, upgrades: ['lighting-1'] }, effect: { lighting: 2 } }),
  make({ id: 'lighting-3', branch: 'casino', group: 'lighting', name: 'Iluminación de gala', desc: 'Todo el casino en su máximo esplendor.', cost: 400, requires: { prestige: 30, upgrades: ['lighting-2'] }, effect: { lighting: 3 } }),
  make({ id: 'decor-carpet', branch: 'casino', group: 'decor', name: 'Alfombra carmesí', desc: 'Una alfombra de lujo ante la máquina.', cost: 90 }),
  make({ id: 'decor-statue', branch: 'casino', group: 'decor', name: 'Estatua dorada', desc: 'Una escultura que preside la sala.', cost: 120, requires: { prestige: 5 } }),
  make({ id: 'decor-chandelier', branch: 'casino', group: 'decor', name: 'Lámpara de araña', desc: 'Cristal y oro sobre el centro de la sala.', cost: 260, requires: { prestige: 20 } }),
  make({ id: 'expand-hall', branch: 'casino', group: 'expand', name: 'Ampliar sala: Ala norte', desc: 'Abre el paso a un nuevo salón.', cost: 300, requires: { prestige: 15 } }),
  make({ id: 'install-register', branch: 'casino', group: 'install', name: 'Caja registradora mejorada', desc: '+2 MARKS base por activación.', cost: 100, effect: { baseAdd: 2 } }),
  make({ id: 'install-vault', branch: 'casino', group: 'install', name: 'Cámara acorazada', desc: '+3 MARKS base por activación.', cost: 350, requires: { prestige: 25, upgrades: ['install-register'] }, effect: { baseAdd: 3 } }),
  // ---- MÁQUINA (THE CLASSIC) ----
  make({ id: 'mod-gilded-reels', branch: 'machine', group: 'mod', name: 'Rodillos dorados', desc: '+25 % a las puntuaciones adicionales.', cost: 80, effect: { bonusMult: 0.25, gilded: true } }),
  make({ id: 'mod-quick-reels', branch: 'machine', group: 'mod', name: 'Rodillos rápidos', desc: 'Giros más ágiles.', cost: 70, effect: { quick: true } }),
  make({ id: 'mod-flare', branch: 'machine', group: 'mod', name: 'Destellos de victoria', desc: 'Más luz y partículas al ganar.', cost: 120, effect: { flare: true } }),
  make({ id: 'mod-wild-star', branch: 'machine', group: 'symbol', name: 'Símbolo especial: Estrella', desc: 'Añade la Estrella, un comodín.', cost: 150, requires: { prestige: 10 }, effect: { star: true } }),
  make({ id: 'syn-royal', branch: 'machine', group: 'synergy', name: 'Sinergia real', desc: 'Corona + Diamante en el mismo giro: +12 extra.', cost: 200, requires: { upgrades: ['mod-wild-star'] }, effect: { royal: true } }),
  make({ id: 'mod-lucky-bell', branch: 'machine', group: 'mod', name: 'Campana de la suerte', desc: 'Otro +50 % a las puntuaciones adicionales.', cost: 240, requires: { prestige: 20, upgrades: ['mod-gilded-reels'] }, effect: { bonusMult: 0.5 } }),
];

export const UPGRADES = Object.freeze(Object.fromEntries(LIST.map((u) => [u.id, u])));

/** Resume lo que aportan las mejoras poseídas. */
export function computeLoadout(ownedIds) {
  const out = {
    baseAdd: 0, bonusMult: 1, star: false, royal: false, flare: false, quick: false,
    gilded: false, lighting: 0, carpet: false, statue: false, chandelier: false, expanded: false,
  };
  for (const id of ownedIds) {
    const u = Object.hasOwn(UPGRADES, id) ? UPGRADES[id] : null;
    if (!u) continue;
    const e = u.effect;
    out.baseAdd += e.baseAdd ?? 0;
    out.bonusMult += e.bonusMult ?? 0;
    out.star ||= !!e.star;
    out.royal ||= !!e.royal;
    out.flare ||= !!e.flare;
    out.quick ||= !!e.quick;
    out.gilded ||= !!e.gilded;
    out.lighting = Math.max(out.lighting, e.lighting ?? 0);
  }
  const has = (id) => ownedIds.includes(id);
  out.carpet = has('decor-carpet');
  out.statue = has('decor-statue');
  out.chandelier = has('decor-chandelier');
  out.expanded = has('expand-hall');
  return out;
}
