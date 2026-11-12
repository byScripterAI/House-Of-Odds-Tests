"""
Contornos de Cinzel (negrita) aplanados en polilíneas para los rótulos de neón 3D del juego.
Uso:  python scripts/fonts/neon-font.py assets/fonts/cinzel-latin-700-normal.woff2 assets/fonts/cinzel-neon.json
Salida: { em, asc, desc, glyphs: { "A": { a: avance, c: [[x0,y0,x1,y1,…], …] } } } en unidades de em (1 = tamaño).
"""
import json
import sys

from fontTools.pens.basePen import BasePen
from fontTools.ttLib import TTFont


class FlatPen(BasePen):
    def __init__(self, glyphset, em, step=0.02):
        super().__init__(glyphset)
        self.em = em
        self.step = step
        self.contours = []
        self.cur = None

    def _p(self, pt):
        return (pt[0] / self.em, pt[1] / self.em)

    def _moveTo(self, pt):
        self.cur = [self._p(pt)]

    def _lineTo(self, pt):
        self.cur.append(self._p(pt))

    def _seg_steps(self, pts):
        length = sum(((pts[i + 1][0] - pts[i][0]) ** 2 + (pts[i + 1][1] - pts[i][1]) ** 2) ** 0.5 for i in range(len(pts) - 1))
        return max(2, min(16, int(length / self.em / self.step)))

    def _qCurveToOne(self, p1, p2):
        p0 = self._getCurrentPoint()
        n = self._seg_steps([p0, p1, p2])
        for i in range(1, n + 1):
            t = i / n
            x = (1 - t) ** 2 * p0[0] + 2 * (1 - t) * t * p1[0] + t * t * p2[0]
            y = (1 - t) ** 2 * p0[1] + 2 * (1 - t) * t * p1[1] + t * t * p2[1]
            self.cur.append(self._p((x, y)))

    def _curveToOne(self, p1, p2, p3):
        p0 = self._getCurrentPoint()
        n = self._seg_steps([p0, p1, p2, p3])
        for i in range(1, n + 1):
            t = i / n
            mt = 1 - t
            x = mt ** 3 * p0[0] + 3 * mt * mt * t * p1[0] + 3 * mt * t * t * p2[0] + t ** 3 * p3[0]
            y = mt ** 3 * p0[1] + 3 * mt * mt * t * p1[1] + 3 * mt * t * t * p2[1] + t ** 3 * p3[1]
            self.cur.append(self._p((x, y)))

    def _closePath(self):
        if self.cur and len(self.cur) > 2:
            if self.cur[0] == self.cur[-1]:
                self.cur.pop()
            self.contours.append(self.cur)
        self.cur = None

    _endPath = _closePath


src, out = sys.argv[1], sys.argv[2]
f = TTFont(src)
# Cinzel trae contornos SOLAPADOS (remates y astas por separado): se unen para que las letras no se pisen
from fontTools.ttLib.removeOverlaps import removeOverlaps  # noqa: E402
removeOverlaps(f)
em = f['head'].unitsPerEm
cmap = f.getBestCmap()
gs = f.getGlyphSet()
hmtx = f['hmtx']
chars = [chr(c) for c in range(0x20, 0x7f)] + [chr(c) for c in range(0xa0, 0x180)] + list('–—‘’“”…·•€')
glyphs = {}
for ch in chars:
    name = cmap.get(ord(ch))
    if not name:
        continue
    pen = FlatPen(gs, em)
    gs[name].draw(pen)
    glyphs[ch] = {'a': round(hmtx[name][0] / em, 4), 'c': [[round(v, 3) for p in c for v in p] for c in pen.contours]}
os2 = f['OS/2']
data = {'em': 1, 'asc': round(os2.sTypoAscender / em, 4), 'desc': round(os2.sTypoDescender / em, 4), 'cap': round(getattr(os2, 'sCapHeight', 700) / em, 4), 'glyphs': glyphs}
with open(out, 'w') as fh:
    json.dump(data, fh, separators=(',', ':'), ensure_ascii=False)
print('glyphs', len(glyphs), 'bytes', len(json.dumps(data, separators=(',', ':'))))
