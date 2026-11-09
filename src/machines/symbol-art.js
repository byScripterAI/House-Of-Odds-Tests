/**
 * Dibujo vectorial de los símbolos sobre un contexto Canvas 2D.
 * Compartido por la máquina 3D (texturas de rodillo) y la interfaz (colección).
 */

const TAU = Math.PI * 2;

function glow(ctx, color, blur) {
  ctx.shadowColor = color;
  ctx.shadowBlur = blur;
}

function circle(ctx, x, y, r, fill) {
  ctx.beginPath();
  ctx.arc(x, y, r, 0, TAU);
  ctx.fillStyle = fill;
  ctx.fill();
}

function poly(ctx, points, fill, stroke = null, lw = 2) {
  ctx.beginPath();
  points.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
  if (stroke) {
    ctx.strokeStyle = stroke;
    ctx.lineWidth = lw;
    ctx.stroke();
  }
}

const painters = {
  cherry(ctx, r) {
    ctx.strokeStyle = '#3f7d2c';
    ctx.lineWidth = r * 0.08;
    ctx.beginPath();
    ctx.moveTo(-r * 0.4, r * 0.2);
    ctx.quadraticCurveTo(-r * 0.2, -r * 0.7, r * 0.15, -r * 0.8);
    ctx.moveTo(r * 0.4, r * 0.3);
    ctx.quadraticCurveTo(r * 0.3, -r * 0.5, r * 0.15, -r * 0.8);
    ctx.stroke();
    ctx.fillStyle = '#4c9a36';
    ctx.beginPath();
    ctx.ellipse(r * 0.38, -r * 0.8, r * 0.3, r * 0.13, -0.3, 0, TAU);
    ctx.fill();
    for (const [x, y] of [[-r * 0.4, r * 0.3], [r * 0.42, r * 0.38]]) {
      const g = ctx.createRadialGradient(x - r * 0.12, y - r * 0.15, r * 0.03, x, y, r * 0.42);
      g.addColorStop(0, '#ff7088');
      g.addColorStop(0.45, '#c42240');
      g.addColorStop(1, '#6d0e22');
      circle(ctx, x, y, r * 0.4, g);
    }
  },
  bell(ctx, r) {
    const g = ctx.createLinearGradient(-r * 0.6, 0, r * 0.6, 0);
    g.addColorStop(0, '#9a7418');
    g.addColorStop(0.35, '#f7e08a');
    g.addColorStop(0.7, '#d4af37');
    g.addColorStop(1, '#85620f');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(-r * 0.12, -r * 0.78);
    ctx.bezierCurveTo(-r * 0.55, -r * 0.6, -r * 0.5, r * 0.15, -r * 0.75, r * 0.5);
    ctx.lineTo(r * 0.75, r * 0.5);
    ctx.bezierCurveTo(r * 0.5, r * 0.15, r * 0.55, -r * 0.6, r * 0.12, -r * 0.78);
    ctx.closePath();
    ctx.fill();
    ctx.fillRect(-r * 0.8, r * 0.46, r * 1.6, r * 0.12);
    circle(ctx, 0, -r * 0.82, r * 0.1, '#f7e08a');
    circle(ctx, 0, r * 0.7, r * 0.14, '#85620f');
  },
  diamond(ctx, r) {
    const top = [[-r * 0.5, -r * 0.45], [r * 0.5, -r * 0.45], [r * 0.85, -r * 0.1], [-r * 0.85, -r * 0.1]];
    poly(ctx, top, '#a8efff', '#2f8ca3', 2);
    poly(ctx, [[-r * 0.85, -r * 0.1], [r * 0.85, -r * 0.1], [0, r * 0.85]], '#3bbbe0', '#2f8ca3', 2);
    poly(ctx, [[-r * 0.5, -r * 0.45], [0, -r * 0.1], [-r * 0.2, -r * 0.45]], '#e6fbff');
    poly(ctx, [[-r * 0.85, -r * 0.1], [0, -r * 0.1], [0, r * 0.85]], '#7fdaf2');
    poly(ctx, [[r * 0.5, -r * 0.45], [0, -r * 0.1], [r * 0.2, -r * 0.45]], '#6fd0ec');
  },
  crown(ctx, r) {
    const g = ctx.createLinearGradient(0, -r * 0.7, 0, r * 0.6);
    g.addColorStop(0, '#f7e08a');
    g.addColorStop(0.6, '#d4af37');
    g.addColorStop(1, '#8a6612');
    poly(ctx, [[-r * 0.8, r * 0.55], [-r * 0.85, -r * 0.45], [-r * 0.4, r * 0.0], [0, -r * 0.7], [r * 0.4, 0], [r * 0.85, -r * 0.45], [r * 0.8, r * 0.55]], g, '#6e4f0b', 2);
    ctx.fillStyle = '#6e4f0b';
    ctx.fillRect(-r * 0.8, r * 0.38, r * 1.6, r * 0.1);
    circle(ctx, -r * 0.85, -r * 0.5, r * 0.1, '#fff3b0');
    circle(ctx, 0, -r * 0.76, r * 0.1, '#fff3b0');
    circle(ctx, r * 0.85, -r * 0.5, r * 0.1, '#fff3b0');
    circle(ctx, 0, r * 0.1, r * 0.11, '#c42240');
    circle(ctx, -r * 0.45, r * 0.15, r * 0.08, '#3bbbe0');
    circle(ctx, r * 0.45, r * 0.15, r * 0.08, '#3bbbe0');
  },
  seven(ctx, r) {
    ctx.font = `700 ${r * 2.1}px Cinzel, Georgia, serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const g = ctx.createLinearGradient(0, -r, 0, r);
    g.addColorStop(0, '#ff5870');
    g.addColorStop(1, '#a1122c');
    ctx.lineWidth = r * 0.12;
    ctx.strokeStyle = '#d4af37';
    ctx.lineJoin = 'round';
    ctx.strokeText('7', 0, r * 0.08);
    ctx.fillStyle = g;
    ctx.fillText('7', 0, r * 0.08);
  },
  star(ctx, r) {
    const pts = [];
    for (let i = 0; i < 10; i++) {
      const a = -Math.PI / 2 + (i * Math.PI) / 5;
      const rad = i % 2 ? r * 0.38 : r * 0.9;
      pts.push([Math.cos(a) * rad, Math.sin(a) * rad]);
    }
    const g = ctx.createRadialGradient(0, 0, r * 0.1, 0, 0, r * 0.9);
    g.addColorStop(0, '#fffbe0');
    g.addColorStop(1, '#e8b923');
    poly(ctx, pts, g, '#8a6612', 2.5);
  },
};

/** Dibuja `id` centrado en (cx, cy) con "radio" r. */
export function drawSymbol(ctx, id, cx, cy, r) {
  const paint = painters[id];
  if (!paint) return;
  ctx.save();
  ctx.translate(cx, cy);
  glow(ctx, 'rgba(0,0,0,0.35)', r * 0.08);
  paint(ctx, r);
  ctx.restore();
}

/** Canvas autónomo con el símbolo sobre fondo marfil (para la interfaz). */
export function symbolCanvas(id, px = 72, locked = false) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = px;
  const ctx = canvas.getContext('2d');
  const bg = ctx.createRadialGradient(px / 2, px / 2, px * 0.1, px / 2, px / 2, px * 0.7);
  bg.addColorStop(0, '#f6ecd6');
  bg.addColorStop(1, '#cdbd9a');
  ctx.fillStyle = bg;
  ctx.beginPath();
  ctx.roundRect(0, 0, px, px, px * 0.16);
  ctx.fill();
  if (locked) {
    ctx.globalAlpha = 0.18;
    drawSymbol(ctx, id, px / 2, px / 2, px * 0.34);
    ctx.globalAlpha = 1;
    ctx.fillStyle = '#5a4b36';
    ctx.font = `700 ${px * 0.4}px Cinzel, serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('?', px / 2, px / 2);
  } else {
    drawSymbol(ctx, id, px / 2, px / 2, px * 0.36);
  }
  return canvas;
}
