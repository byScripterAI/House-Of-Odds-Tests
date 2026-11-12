/**
 * Contenido de los créditos. Solo datos.
 * Bloques: logo | title | heading | name | note | big | small | gap
 *  - `k`: clave de traducción (títulos y frases); `v`: texto literal (nombres propios, marcas).
 *  - `color` (opcional) sobreescribe el color del bloque.
 */

const section = (headingKey, ...names) => [{ t: 'heading', k: headingKey }, ...names.map((v) => ({ t: 'name', v })), { t: 'gap' }];

export const MAIN_CREDITS = Object.freeze([
  { t: 'logo', v: 'HOUSE OF ODDS' },
  { t: 'title', k: 'credits.title' },
  { t: 'gap' }, { t: 'gap' },
  { t: 'heading', k: 'credits.developedBy' }, { t: 'big', v: 'VANTA INTERACTIVE', color: '#58e6ff' }, { t: 'gap' },
  ...section('credits.gameDirector', 'Hugo Gonzalez'),
  ...section('credits.creativeDirector', 'Hugo Gonzalez'),
  ...section('credits.gameDesign', 'Ethan Caldwell', 'Lucía Fernández'),
  ...section('credits.programming', 'Lucas Whitmore', 'Marc Belmonte', 'Oliver Hayes'),
  ...section('credits.art', 'Gabriel Ashford', 'Núria Castañer'),
  ...section('credits.uiux', 'Clara Bennett', 'Marta Villanueva'),
  ...section('credits.sound', 'Sebastian Cole', 'Pablo Ferrer'),
  { t: 'heading', k: 'credits.thirdParty' },
  { t: 'name', v: 'Microsoft Rocketbox Avatar Library · MIT' },
  { t: 'small', v: 'Khronos glTF Sample Assets — Eric Chadwick · Rico Cilliers · CC BY 4.0 / CC0' },
  { t: 'small', v: 'Poly Haven — CC0' },
  { t: 'small', v: 'Three.js · MIT — Cinzel · Cormorant Garamond · Jost · SIL OFL 1.1' },
  { t: 'gap' },
  { t: 'heading', k: 'credits.thanks' },
  { t: 'note', k: 'credits.thanksText' },
  { t: 'gap' }, { t: 'gap' },
  { t: 'small', k: 'credits.rights' },
]);

export const FINAL_CREDITS = Object.freeze([
  { t: 'note', k: 'credits.final.1' },
  { t: 'gap' },
  { t: 'note', k: 'credits.final.2' },
  { t: 'gap' }, { t: 'gap' },
  { t: 'big', k: 'credits.final.3', color: '#ffd76a' },
  { t: 'gap' },
  { t: 'big', k: 'credits.final.4', color: '#ff5a76' },
  { t: 'gap' }, { t: 'gap' }, { t: 'gap' },
  { t: 'logo', v: 'HOUSE OF ODDS' },
  { t: 'gap' },
  ...section('credits.aGameBy', 'VANTA INTERACTIVE'),
  ...section('credits.gameDirection', 'Hugo Gonzalez'),
  ...section('credits.creativeDirection', 'Hugo Gonzalez'),
  ...section('credits.gameDesign', 'Ethan Caldwell', 'Lucía Fernández'),
  ...section('credits.programming', 'Lucas Whitmore', 'Marc Belmonte', 'Oliver Hayes'),
  ...section('credits.art', 'Gabriel Ashford', 'Nuria Salvatierra'),
  ...section('credits.uiux', 'Clara Bennett', 'Marta Villanueva'),
  ...section('credits.sound', 'Sebastian Cole', 'Pablo Ferrer'),
  { t: 'heading', k: 'credits.thirdParty' },
  { t: 'name', v: 'Microsoft Rocketbox Avatar Library · MIT' },
  { t: 'small', v: 'Khronos glTF Sample Assets — Eric Chadwick · Rico Cilliers · CC BY 4.0 / CC0' },
  { t: 'small', v: 'Poly Haven — CC0' },
  { t: 'small', v: 'Three.js · MIT — Cinzel · Cormorant Garamond · Jost · SIL OFL 1.1' },
  { t: 'gap' },
  { t: 'heading', k: 'credits.thanks' },
  { t: 'note', k: 'credits.thanksText' },
  { t: 'gap' }, { t: 'gap' }, { t: 'gap' },
  { t: 'big', k: 'credits.final.thanks', color: '#ffd76a' },
  { t: 'gap' }, { t: 'gap' },
  { t: 'small', k: 'credits.rights' },
]);
