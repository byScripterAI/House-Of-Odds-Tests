/**
 * NAVEGACIÓN de PNJ (puro: sin Three.js ni DOM; se prueba con node --test).
 *
 * Rejilla de ocupación sobre el plano XZ construida a partir de los mismos
 * colisionadores AABB que usa el jugador (inflados por el radio del PNJ).
 * A* con 8 vecinos (sin cortar esquinas) + suavizado por línea de visión.
 */

class MinHeap {
  constructor() {
    this.items = [];
  }

  get size() {
    return this.items.length;
  }

  push(node, priority) {
    const a = this.items;
    a.push([priority, node]);
    let i = a.length - 1;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (a[p][0] <= a[i][0]) break;
      [a[p], a[i]] = [a[i], a[p]];
      i = p;
    }
  }

  pop() {
    const a = this.items;
    const top = a[0];
    const last = a.pop();
    if (a.length) {
      a[0] = last;
      let i = 0;
      for (;;) {
        const l = i * 2 + 1;
        const r = l + 1;
        let m = i;
        if (l < a.length && a[l][0] < a[m][0]) m = l;
        if (r < a.length && a[r][0] < a[m][0]) m = r;
        if (m === i) break;
        [a[m], a[i]] = [a[i], a[m]];
        i = m;
      }
    }
    return top[1];
  }
}

export class NavGrid {
  /**
   * @param {{minX:number,maxX:number,minZ:number,maxZ:number}} bounds
   * @param {number} [cell] tamaño de celda en metros
   */
  constructor(bounds, cell = 0.4) {
    this.bounds = { ...bounds };
    this.cell = cell;
    this.w = Math.max(1, Math.ceil((bounds.maxX - bounds.minX) / cell));
    this.h = Math.max(1, Math.ceil((bounds.maxZ - bounds.minZ) / cell));
    this.blocked = new Uint8Array(this.w * this.h);
  }

  /** Marca como bloqueadas las celdas que tocan cada colisionador habilitado (inflado `inflate`). */
  block(colliders, inflate = 0.28) {
    this.blocked.fill(0);
    for (const c of colliders) {
      if (c.enabled === false) continue;
      const x0 = this.#cx(c.minX - inflate);
      const x1 = this.#cx(c.maxX + inflate);
      const z0 = this.#cz(c.minZ - inflate);
      const z1 = this.#cz(c.maxZ + inflate);
      for (let z = Math.max(0, z0); z <= Math.min(this.h - 1, z1); z++) {
        for (let x = Math.max(0, x0); x <= Math.min(this.w - 1, x1); x++) this.blocked[z * this.w + x] = 1;
      }
    }
    // borde del mapa
    for (let x = 0; x < this.w; x++) this.blocked[x] = this.blocked[(this.h - 1) * this.w + x] = 1;
    for (let z = 0; z < this.h; z++) this.blocked[z * this.w] = this.blocked[z * this.w + this.w - 1] = 1;
    return this;
  }

  #cx(x) {
    return Math.floor((x - this.bounds.minX) / this.cell);
  }

  #cz(z) {
    return Math.floor((z - this.bounds.minZ) / this.cell);
  }

  #center(ix, iz) {
    return { x: this.bounds.minX + (ix + 0.5) * this.cell, z: this.bounds.minZ + (iz + 0.5) * this.cell };
  }

  #free(ix, iz) {
    return ix >= 0 && iz >= 0 && ix < this.w && iz < this.h && !this.blocked[iz * this.w + ix];
  }

  isFree(x, z) {
    return this.#free(this.#cx(x), this.#cz(z));
  }

  /** Centro de la celda libre más cercana (búsqueda en anillos). */
  nearestFree(x, z, maxRing = 12) {
    const ix = this.#cx(x);
    const iz = this.#cz(z);
    if (this.#free(ix, iz)) return { x, z };
    for (let r = 1; r <= maxRing; r++) {
      let best = null;
      let bestD = Infinity;
      for (let dz = -r; dz <= r; dz++) {
        for (let dx = -r; dx <= r; dx++) {
          if (Math.max(Math.abs(dx), Math.abs(dz)) !== r || !this.#free(ix + dx, iz + dz)) continue;
          const c = this.#center(ix + dx, iz + dz);
          const d = (c.x - x) ** 2 + (c.z - z) ** 2;
          if (d < bestD) {
            bestD = d;
            best = c;
          }
        }
      }
      if (best) return best;
    }
    return null;
  }

  /** ¿Se puede ir en línea recta entre dos puntos sin pisar celdas bloqueadas? */
  lineOfSight(ax, az, bx, bz) {
    const dist = Math.hypot(bx - ax, bz - az);
    const steps = Math.max(1, Math.ceil(dist / (this.cell * 0.4)));
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      if (!this.isFree(ax + (bx - ax) * t, az + (bz - az) * t)) return false;
    }
    return true;
  }

  /**
   * Camino de A a B como lista de puntos (sin incluir A). null si no hay camino.
   * @param {number} [maxNodes] límite de expansión (protege el rendimiento)
   */
  findPath(ax, az, bx, bz, maxNodes = 12000) {
    const start = this.nearestFree(ax, az);
    const goal = this.nearestFree(bx, bz);
    if (!start || !goal) return null;
    const sx = this.#cx(start.x);
    const sz = this.#cz(start.z);
    const gx = this.#cx(goal.x);
    const gz = this.#cz(goal.z);
    const W = this.w;
    const N = W * this.h;
    const g = new Float32Array(N).fill(Infinity);
    const came = new Int32Array(N).fill(-1);
    const closed = new Uint8Array(N);
    const heap = new MinHeap();
    const s = sz * W + sx;
    const goalI = gz * W + gx;
    g[s] = 0;
    const hfun = (x, z) => {
      const dx = Math.abs(x - gx);
      const dz = Math.abs(z - gz);
      return dx + dz + (Math.SQRT2 - 2) * Math.min(dx, dz);
    };
    heap.push(s, hfun(sx, sz));
    let expanded = 0;
    while (heap.size) {
      const cur = heap.pop();
      if (closed[cur]) continue;
      if (cur === goalI) break;
      closed[cur] = 1;
      if (++expanded > maxNodes) return null;
      const cx = cur % W;
      const cz = (cur - cx) / W;
      for (let dz = -1; dz <= 1; dz++) {
        for (let dx = -1; dx <= 1; dx++) {
          if (!dx && !dz) continue;
          const nx = cx + dx;
          const nz = cz + dz;
          if (!this.#free(nx, nz)) continue;
          if (dx && dz && (!this.#free(cx + dx, cz) || !this.#free(cx, cz + dz))) continue; // no cortar esquinas
          const ni = nz * W + nx;
          if (closed[ni]) continue;
          const cost = g[cur] + (dx && dz ? Math.SQRT2 : 1);
          if (cost < g[ni]) {
            g[ni] = cost;
            came[ni] = cur;
            heap.push(ni, cost + hfun(nx, nz));
          }
        }
      }
    }
    if (came[goalI] === -1 && goalI !== s) return null;
    const cells = [];
    for (let i = goalI; i !== -1 && i !== s; i = came[i]) cells.push(i);
    cells.reverse();
    const pts = cells.map((i) => this.#center(i % W, Math.floor(i / W)));
    if (pts.length) pts[pts.length - 1] = { x: goal.x === bx && goal.z === bz ? bx : goal.x, z: goal.x === bx && goal.z === bz ? bz : goal.z };
    else pts.push({ x: goal.x, z: goal.z });
    // suavizado: salta puntos intermedios con línea de visión
    const out = [];
    let ox = ax;
    let oz = az;
    let i = 0;
    while (i < pts.length) {
      let j = pts.length - 1;
      while (j > i && !this.lineOfSight(ox, oz, pts[j].x, pts[j].z)) j--;
      out.push(pts[j]);
      ox = pts[j].x;
      oz = pts[j].z;
      i = j + 1;
    }
    return out;
  }
}
