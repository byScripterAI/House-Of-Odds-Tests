import { CHARACTER_MODELS } from './character-list.js';
/**
 * PERSONAJES (datos puros, sin Three.js).
 *
 * - NAMED: los 10 personajes del documento narrativo. Su aspecto sigue la
 *   descripción del documento; `post` es su puesto en el MAIN FLOOR (o null si
 *   todavía no han aparecido: Arthur, Emily y Henry llegan con la historia).
 * - Los nombres son nombres propios (no se traducen); el cargo sí (`npc.<id>.role`).
 * - `generateExtra(rng, kind)` crea figurantes variados y deterministas.
 */

const SKIN = [0xf1d3c0, 0xe8bfa0, 0xd9a882, 0xc68c64, 0xa86e4a, 0x8a5636, 0x6b3f26, 0x4e2c1a];
const HAIR = [0x1a1210, 0x2b1c14, 0x3d2a1c, 0x5a3a22, 0x7a5532, 0xa07848, 0xc8a46a, 0x8a8a88, 0xc9c6c0, 0x6e2a1a];
const EYES = [0x3a2414, 0x5a3a1e, 0x2e5a7a, 0x3e6a4a, 0x6a6a5a];

export const NAMED = Object.freeze({
  victoria: {
    id: 'victoria', name: 'Victoria Hawthorne', color: '#d4af37',
    appearance: { model: 'Business_Female_01',
      female: true, height: 1.72, build: 0.95, age: 42, skin: 0xe8c4aa, hairColor: 0x2b1810, hair: 'bun', eyes: 0x3a2414, lips: 0x9a2a3a, stern: true,
      outfit: { top: 0x121114, bottom: 0x121114, shoes: 0x0a0a0a, shirt: 0xd9d4ca, heels: true }, extras: ['watch'],
    },
    post: { x: 6.9, z: 7.7, yaw: -1.25, activity: 'idle', params: { handsBack: true } },
  },
  daniel: {
    id: 'daniel', name: 'Daniel Reed', color: '#5ab0ff',
    appearance: { model: 'Construction_Male_01',
      female: false, height: 1.8, build: 1.05, age: 34, skin: 0xe2b896, hairColor: 0x4a3020, hair: 'short', beard: 'stubble', eyes: 0x2e5a7a, smile: true,
      outfit: { top: 0x6e7278, bottom: 0x23262c, shoes: 0x2a1c12, sleeves: 'rolled', lapels: false, jacket: false }, extras: ['toolbelt'],
    },
    post: { x: 12.35, z: 0.8, yaw: Math.PI / 2, activity: 'work' },
  },
  isabella: {
    id: 'isabella', name: 'Isabella Moreno', color: '#e05a7a',
    appearance: { model: 'Business_Female_02',
      female: true, height: 1.66, build: 0.92, age: 29, skin: 0xe3b48e, hairColor: 0x8a5a32, hair: 'long', eyes: 0x5a3a1e, lips: 0xb03a4a, smile: true,
      outfit: { top: 0x6a1426, bottom: 0x6a1426, shoes: 0x1a0a0e, shirt: 0xf5ece4, dress: true, heels: true }, extras: ['badge'],
    },
    post: { x: 10.6, z: 10.2, yaw: Math.PI, activity: 'clerk' },
  },
  arthur: {
    id: 'arthur', name: 'Arthur Bennett', color: '#8fa8d8',
    appearance: { model: 'Business_Male_02',
      female: false, height: 1.78, build: 0.98, age: 67, skin: 0xe6c2a6, hairColor: 0xb8b6b0, hair: 'receding', eyes: 0x5a6a7a, stern: true,
      outfit: { top: 0x18213a, bottom: 0x18213a, shoes: 0x0e0a08, shirt: 0xd9d4ca, tie: 0x5a1020 }, extras: ['cane', 'pocketSquare'],
    },
    post: null,
  },
  sofia: {
    id: 'sofia', name: 'Sofia Martínez', color: '#ffb84a',
    appearance: { model: 'Business_Female_03',
      female: true, height: 1.68, build: 0.9, age: 31, skin: 0xd9a47c, hairColor: 0x120c0a, hair: 'ponytail', eyes: 0x3a2414, lips: 0xa8303e, smile: true,
      outfit: { top: 0xf2efe8, bottom: 0xb08a5e, shoes: 0x2a1a10, lapels: false, jacket: false }, extras: ['necklace', 'folder'],
    },
    post: { x: 11.4, z: -5.6, yaw: -2.2, activity: 'idle', params: { folder: true } },
  },
  ethan: {
    id: 'ethan', name: 'Ethan Parker', color: '#9aa4b0',
    appearance: { model: 'Security_Male_01',
      female: false, height: 1.88, build: 1.2, age: 38, skin: 0x8a5a3a, hairColor: 0x120c0a, hair: 'short', beard: 'stubble', eyes: 0x2a1a10, stern: true,
      outfit: { top: 0x0e0e10, bottom: 0x0e0e10, shoes: 0x060606, shirt: 0xe8e8ea, tie: 0x0e0e10 }, extras: ['earpiece', 'badge'],
    },
    post: { x: -2.45, z: 10.2, yaw: Math.PI - 0.4, activity: 'lean' },
  },
  oliver: {
    id: 'oliver', name: 'Oliver Grant', color: '#4ad6a0',
    appearance: { model: 'Business_Male_04',
      female: false, height: 1.79, build: 1.0, age: 45, skin: 0xeac8ae, hairColor: 0x3a3028, hair: 'slick', eyes: 0x3e6a4a,
      outfit: { top: 0x34363c, bottom: 0x34363c, shoes: 0x0e0a08, shirt: 0xd9d4ca, vest: 0x0e0e10, tie: 0x2a2a30 }, extras: [],
    },
    post: { x: 8.3, z: -5.5, yaw: -0.3, activity: 'idle', params: { handsBack: true } },
  },
  lucas: {
    id: 'lucas', name: 'Lucas Moretti', color: '#ff5a6a',
    appearance: { model: 'Business_Male_05',
      female: false, height: 1.76, build: 1.02, age: 40, skin: 0xd8a882, hairColor: 0x1a1210, hair: 'slick', beard: 'moustache', eyes: 0x3a2414, smile: true,
      outfit: { top: 0x5a1020, bottom: 0x5a1020, shoes: 0x0a0606, shirt: 0x0e0c0e, tie: null }, extras: ['pocketSquare'],
    },
    post: { x: -4.4, z: -2.6, yaw: 0.6, activity: 'idle' },
  },
  emily: {
    id: 'emily', name: 'Emily Carter', color: '#b06aff',
    appearance: { model: 'Female_Adult_03',
      female: true, height: 1.69, build: 0.9, age: 27, skin: 0xf0d0bc, hairColor: 0xa88050, hair: 'ponytail', eyes: 0x2e5a7a, lips: 0xc04a6a, smile: true,
      outfit: { top: 0x3a1a5a, bottom: 0x3a1a5a, shoes: 0x1a1a1a, dress: true, heels: true, lapels: false }, extras: ['glowBracelet', 'necklace'],
    },
    post: null,
  },
  henry: {
    id: 'henry', name: 'Henry Blackwood', color: '#c8a46a',
    appearance: { model: 'Business_Male_03',
      female: false, height: 1.74, build: 0.95, age: 58, skin: 0xe6c4a8, hairColor: 0x9a9894, hair: 'short', eyes: 0x5a3a1e,
      outfit: { top: 0x3a2618, bottom: 0x3a2618, shoes: 0x1a0e08, shirt: 0xeee8dc, tie: 0x6a4a20 }, extras: ['glasses', 'folder'],
    },
    post: null,
  },
});

export const NAMED_IDS = Object.freeze(Object.keys(NAMED));

/** Uniformes del personal (crupieres, cajero). */
export const STAFF_OUTFITS = Object.freeze({
  dealer: { top: 0xd9d4ca, bottom: 0x0e0e10, shoes: 0x060606, vest: 0x0e0e10, tie: 0x8a0f1e, lapels: false, jacket: false },
  cashier: { top: 0x5a1020, bottom: 0x121114, shoes: 0x060606, shirt: 0xd9d4ca, tie: 0x121114 },
});

const CUSTOMER_MODELS = CHARACTER_MODELS.customers;
const pick = (rng, list) => list[Math.floor(rng.next() * list.length) % list.length];

/**
 * Figurante determinista.
 * @param {{next: () => number}} rng
 * @param {'customer'|'dealer'|'cashier'} kind
 */
export function generateExtra(rng, kind = 'customer') {
  const female = rng.next() < 0.5;
  const age = kind === 'customer' ? 22 + Math.floor(rng.next() * 50) : 24 + Math.floor(rng.next() * 30);
  const greyed = age > 55 && rng.next() < 0.75;
  const hairColor = greyed ? pick(rng, [0x8a8a88, 0xc9c6c0, 0xa8a6a0]) : pick(rng, HAIR.slice(0, 7).concat([0x6e2a1a]));
  const hair = female
    ? pick(rng, ['long', 'bob', 'bun', 'ponytail', 'curly'])
    : pick(rng, age > 50 ? ['short', 'receding', 'bald', 'slick'] : ['short', 'slick', 'curly', 'short']);
  const formalTops = [0x121114, 0x1c2238, 0x2e3036, 0x3a2618, 0x4a1020, 0x1e3a2e];
  const casualTops = [0x8a2a2a, 0x2a4a7a, 0xd8d0c0, 0x4a6a3a, 0x7a5a8a, 0xc08a3a, 0x2a2a2a, 0xe8e4dc];
  const formal = rng.next() < 0.55;
  let outfit;
  if (kind === 'dealer') outfit = { ...STAFF_OUTFITS.dealer };
  else if (kind === 'cashier') outfit = { ...STAFF_OUTFITS.cashier };
  else if (female && rng.next() < 0.45) {
    const c = pick(rng, [0x5a0f22, 0x0e0e12, 0x1a3a5a, 0x2a5a4a, 0x6a2a6a, 0xb8a080]);
    outfit = { top: c, bottom: c, shoes: 0x0e0a0a, dress: true, heels: true, lapels: false };
  } else if (formal) {
    const c = pick(rng, formalTops);
    outfit = { top: c, bottom: rng.next() < 0.7 ? c : 0x1a1a1e, shoes: 0x0e0a08, shirt: pick(rng, [0xd9d4ca, 0xdfe6ee, 0xeee0e4]), tie: rng.next() < 0.6 ? pick(rng, [0x5a1020, 0x1a2a4a, 0x2a2a2a, 0x8a6a20]) : null };
  } else {
    outfit = { top: pick(rng, casualTops), bottom: pick(rng, [0x1e2a44, 0x2a2a2e, 0x4a3a2a, 0x6a6a6a, 0xa89878]), shoes: pick(rng, [0x1a1210, 0x3a2414, 0xd8d8d8]), lapels: false, jacket: false };
  }
  const extras = [];
  if (kind === 'dealer') extras.push('bowtie', 'badge');
  if (kind === 'cashier') extras.push('badge');
  if (kind === 'customer') {
    if (age > 45 && rng.next() < 0.35) extras.push('glasses');
    if (female && rng.next() < 0.4) extras.push('necklace');
    if (rng.next() < 0.25) extras.push('watch');
  }
  // modelo realista (Rocketbox): el personal lleva uniforme; los clientes, ropa variada
  const pool = kind === 'dealer' ? (female ? ['Business_Female_04'] : ['Business_Male_06'])
    : kind === 'cashier' ? ['Business_Male_01']
      : CUSTOMER_MODELS.filter((m) => /Female/.test(m) === female);
  return {
    model: pick(rng, pool),
    female,
    height: female ? 1.58 + rng.next() * 0.16 : 1.68 + rng.next() * 0.2,
    build: 0.88 + rng.next() * (female ? 0.18 : 0.34),
    age,
    skin: pick(rng, SKIN),
    hairColor,
    hair,
    beard: !female && rng.next() < 0.35 ? pick(rng, ['stubble', 'full', 'moustache', 'stubble']) : undefined,
    eyes: pick(rng, EYES),
    lips: female ? pick(rng, [0xa8303e, 0xc04a6a, 0x9a3a3a, 0xb06a6a]) : undefined,
    smile: rng.next() < 0.5,
    outfit,
    extras,
  };
}
