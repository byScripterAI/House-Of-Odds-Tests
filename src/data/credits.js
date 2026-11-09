/**
 * Contenido de los créditos. Solo datos.
 * Bloques: logo | title | heading | name | text | note | big | small | gap
 * `color` (opcional) sobreescribe el color del bloque.
 */

const section = (heading, ...names) => [{ t: 'heading', v: heading }, ...names.map((v) => ({ t: 'name', v })), { t: 'gap' }];

export const MAIN_CREDITS = Object.freeze([
  { t: 'logo', v: 'HOUSE OF ODDS' },
  { t: 'title', v: 'GAME CREDITS' },
  { t: 'gap' }, { t: 'gap' },
  { t: 'heading', v: 'DEVELOPED BY' }, { t: 'big', v: 'VANTA INTERACTIVE', color: '#58e6ff' }, { t: 'gap' },
  ...section('GAME DIRECTOR', 'Hugo Gonzalez'),
  ...section('CREATIVE DIRECTOR', 'Hugo Gonzalez'),
  ...section('GAME DESIGN', 'Ethan Caldwell', 'Lucía Fernández'),
  ...section('PROGRAMMING', 'Lucas Whitmore', 'Marc Belmonte', 'Oliver Hayes'),
  ...section('3D ENVIRONMENT & ART', 'Gabriel Ashford', 'Núria Castañer'),
  ...section('UI/UX DESIGN', 'Clara Bennett', 'Marta Villanueva'),
  ...section('SOUND DESIGN', 'Sebastian Cole', 'Pablo Ferrer'),
  { t: 'heading', v: 'SPECIAL THANKS' },
  { t: 'note', v: 'Everyone who supported the project.' },
  { t: 'gap' }, { t: 'gap' },
  { t: 'small', v: '© 2026 VANTA INTERACTIVE. ALL RIGHTS RESERVED.' },
]);

export const FINAL_CREDITS = Object.freeze([
  { t: 'note', v: 'Every story has a beginning.' },
  { t: 'gap' },
  { t: 'note', v: 'Every empire has an end.' },
  { t: 'gap' }, { t: 'gap' },
  { t: 'big', v: 'YOU BUILT THE HOUSE.', color: '#ffd76a' },
  { t: 'gap' },
  { t: 'big', v: 'NOW, IT BELONGS TO YOU.', color: '#ff5a76' },
  { t: 'gap' }, { t: 'gap' }, { t: 'gap' },
  { t: 'logo', v: 'HOUSE OF ODDS' },
  { t: 'gap' },
  ...section('A GAME BY', 'VANTA INTERACTIVE'),
  ...section('GAME DIRECTION', 'Hugo Gonzalez'),
  ...section('CREATIVE DIRECTION', 'Hugo Gonzalez'),
  ...section('GAME DESIGN', 'Ethan Caldwell', 'Lucía Fernández'),
  ...section('PROGRAMMING', 'Lucas Whitmore', 'Marc Belmonte', 'Oliver Hayes'),
  ...section('3D ENVIRONMENT & ART', 'Gabriel Ashford', 'Nuria Salvatierra'),
  ...section('UI/UX DESIGN', 'Clara Bennett', 'Marta Villanueva'),
  ...section('SOUND DESIGN', 'Sebastian Cole', 'Pablo Ferrer'),
  { t: 'heading', v: 'SPECIAL THANKS' },
  { t: 'note', v: 'Everyone who supported the project.' },
  { t: 'gap' }, { t: 'gap' }, { t: 'gap' },
  { t: 'big', v: 'THANK YOU FOR PLAYING', color: '#ffd76a' },
  { t: 'gap' }, { t: 'gap' },
  { t: 'small', v: '© 2026 VANTA INTERACTIVE. ALL RIGHTS RESERVED.' },
]);
