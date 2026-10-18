// pixel.js — a tiny pixel painter.
// Shapes go onto a low-res grid, then get outlined and shaded, so every tile,
// person and critter shares the same chunky GBA look.
'use strict';

function hexToRgb(h) {
  h = h.replace('#', '');
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}
function rgbToHex(r, g, b) {
  return '#' + [r, g, b].map(v => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('');
}
// f < 0 darkens (shadows lean a little blue/purple), f > 0 lightens (highlights lean warm)
function shade(h, f) {
  const [r, g, b] = hexToRgb(h);
  if (f < 0) {
    const k = 1 + f;
    return rgbToHex(r * k, g * k, b * k + (1 - k) * 30);
  }
  return rgbToHex(r + (255 - r) * f, g + (255 - g) * f, b + (255 - b) * f * 0.85);
}

class Pix {
  constructor(w, h) {
    this.w = w; this.h = h;
    this.d = new Array(w * h).fill(null);
  }
  get(x, y) {
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return null;
    return this.d[y * this.w + x];
  }
  // `on` limits painting to pixels that already hold a colour:
  //   true = any filled pixel, a string = that colour, an array = any of those colours
  _ok(x, y, on) {
    if (on === undefined) return true;
    const cur = this.get(x, y);
    if (on === true) return cur !== null;
    if (Array.isArray(on)) return on.includes(cur);
    return cur === on;
  }
  set(x, y, c, on) {
    x = Math.floor(x); y = Math.floor(y);
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return this;
    if (!this._ok(x, y, on)) return this;
    this.d[y * this.w + x] = c;
    return this;
  }
  rect(x, y, w, h, c, on) {
    for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) this.set(i, j, c, on);
    return this;
  }
  ellipse(cx, cy, rx, ry, c, on) {
    for (let y = Math.floor(cy - ry) - 1; y <= Math.ceil(cy + ry); y++)
      for (let x = Math.floor(cx - rx) - 1; x <= Math.ceil(cx + rx); x++) {
        const dx = (x + 0.5 - cx) / rx, dy = (y + 0.5 - cy) / ry;
        if (dx * dx + dy * dy <= 1) this.set(x, y, c, on);
      }
    return this;
  }
  // pts is a flat list: [x0, y0, x1, y1, ...]
  poly(pts, c, on) {
    let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
    for (let i = 0; i < pts.length; i += 2) {
      x0 = Math.min(x0, pts[i]); x1 = Math.max(x1, pts[i]);
      y0 = Math.min(y0, pts[i + 1]); y1 = Math.max(y1, pts[i + 1]);
    }
    const n = pts.length / 2;
    for (let y = Math.floor(y0); y <= Math.ceil(y1); y++)
      for (let x = Math.floor(x0); x <= Math.ceil(x1); x++) {
        const px = x + 0.5, py = y + 0.5;
        let inside = false;
        for (let i = 0, j = n - 1; i < n; j = i++) {
          const xi = pts[i * 2], yi = pts[i * 2 + 1], xj = pts[j * 2], yj = pts[j * 2 + 1];
          if ((yi > py) !== (yj > py) && px < (xj - xi) * (py - yi) / (yj - yi) + xi) inside = !inside;
        }
        if (inside) this.set(x, y, c, on);
      }
    return this;
  }
  line(x0, y0, x1, y1, c, on) {
    x0 = Math.round(x0); y0 = Math.round(y0); x1 = Math.round(x1); y1 = Math.round(y1);
    const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0);
    const sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
    let err = dx + dy;
    for (;;) {
      this.set(x0, y0, c, on);
      if (x0 === x1 && y0 === y1) break;
      const e2 = 2 * err;
      if (e2 >= dy) { err += dy; x0 += sx; }
      if (e2 <= dx) { err += dx; y0 += sy; }
    }
    return this;
  }
  // copy the left half onto the right half (for symmetric critters)
  mirror() {
    for (let y = 0; y < this.h; y++)
      for (let x = 0; x < Math.floor(this.w / 2); x++)
        this.d[y * this.w + (this.w - 1 - x)] = this.d[y * this.w + x];
    return this;
  }
  flipX() {
    const p = new Pix(this.w, this.h);
    for (let y = 0; y < this.h; y++)
      for (let x = 0; x < this.w; x++) p.d[y * this.w + x] = this.d[y * this.w + (this.w - 1 - x)];
    return p;
  }
  // draw a dark rim around everything; with no colour, each rim pixel is a deep
  // shade of the colour it borders (the GBA "coloured outline" look)
  outline(c, diagonal = false) {
    const add = [];
    const nb = diagonal
      ? [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, -1], [1, -1], [-1, 1]]
      : [[1, 0], [-1, 0], [0, 1], [0, -1]];
    for (let y = 0; y < this.h; y++)
      for (let x = 0; x < this.w; x++) {
        if (this.get(x, y) !== null) continue;
        for (const [dx, dy] of nb) {
          const n = this.get(x + dx, y + dy);
          if (n !== null) { add.push([x, y, c || shade(n, -0.62)]); break; }
        }
      }
    for (const [x, y, col] of add) this.set(x, y, col);
    return this;
  }
  // replace every pixel of one colour with another
  swap(from, to) {
    for (let i = 0; i < this.d.length; i++) if (this.d[i] === from) this.d[i] = to;
    return this;
  }
  paste(p, ox, oy) {
    for (let y = 0; y < p.h; y++)
      for (let x = 0; x < p.w; x++) {
        const c = p.d[y * p.w + x];
        if (c !== null) this.set(ox + x, oy + y, c);
      }
    return this;
  }
  canvas() {
    const cv = document.createElement('canvas');
    cv.width = this.w; cv.height = this.h;
    const ctx = cv.getContext('2d');
    const img = ctx.createImageData(this.w, this.h);
    for (let i = 0; i < this.d.length; i++) {
      const c = this.d[i];
      if (c === null) continue;
      const [r, g, b] = hexToRgb(c);
      img.data[i * 4] = r; img.data[i * 4 + 1] = g; img.data[i * 4 + 2] = b; img.data[i * 4 + 3] = 255;
    }
    ctx.putImageData(img, 0, 0);
    return cv;
  }
}

// draw a grid of characters with a palette: rows = ['..ab', ...], pal = {a: '#fff', ...}
function pixFromRows(rows, pal) {
  const p = new Pix(rows[0].length, rows.length);
  rows.forEach((row, y) => [...row].forEach((ch, x) => { if (pal[ch]) p.set(x, y, pal[ch]); }));
  return p;
}

// a small seeded random, so textured tiles look the same every time
function seeded(seed) {
  let s = seed >>> 0;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
}
