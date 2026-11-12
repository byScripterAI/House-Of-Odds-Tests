/**
 * Quién vende qué (datos puros). Cada personaje con servicio abre el panel
 * filtrado a su oficio, como en la vida real:
 *  - Daniel Reed (técnico): obras, luz, limpieza, ampliaciones e instalaciones + mejoras de máquina.
 *  - Sofia Martínez (diseño): decoración.
 *  - Mostrador: directorio de servicios, objetivos y colección (no vende).
 */
export const VENDORS = Object.freeze({
  daniel: Object.freeze({ tabs: Object.freeze(['works', 'machine']), title: 'shop.title.daniel' }),
  sofia: Object.freeze({ tabs: Object.freeze(['decor']), title: 'shop.title.sofia' }),
  counter: Object.freeze({ tabs: Object.freeze(['services', 'objectives', 'collection']), title: 'shop.title.counter' }),
});

/** ¿Qué mejoras aparecen en cada pestaña de proveedor? */
export const TAB_FILTERS = Object.freeze({
  works: (u) => u.branch === 'casino' && u.group !== 'decor',
  machine: (u) => u.branch === 'machine',
  decor: (u) => u.group === 'decor',
});

/** Proveedor de una mejora (para avisos «tienes algo que comprar» sobre el personaje adecuado). */
export function vendorOf(upgrade) {
  if (TAB_FILTERS.decor(upgrade)) return 'sofia';
  return 'daniel';
}
