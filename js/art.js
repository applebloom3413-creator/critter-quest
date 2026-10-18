// art.js — every picture in the game, drawn in code with the pixel painter.
// Tiles are 16x16. People are 16x20. Critters are 48x48 (front and back views).
'use strict';

const T = 16;

const PAL = {
  grass: '#8ad08a', grassDk: '#5aa86c', grassLt: '#b6e8a6',
  path: '#f0dc9c', pathDk: '#dcc480', pathEdge: '#c0a468',
  tall: '#52b45e', tallDk: '#2a7844', tallLt: '#8ada74',
  leaf: '#46a256', leafDk: '#2c7446', leafLt: '#76c866', leafHi: '#acE48a', trunk: '#80542e', treeLine: '#1c4232',
  water: '#5aa8f0', waterDk: '#3a82d0', waterLt: '#b0dcfa', shore: '#4c8a68',
  wood: '#c8925a', woodDk: '#8a5a30', woodLt: '#e4b882',
  red: '#e04848', yellow: '#f8d040', white: '#f8f8f8',
};

const ART = { tiles: {}, people: {}, critters: {}, props: {}, ui: {} };

// ---------------------------------------------------------------- ground tiles

function tuft(p, x, y) {
  p.set(x, y, PAL.grassDk).set(x + 1, y + 1, PAL.grassDk).set(x + 3, y, PAL.grassDk).set(x + 2, y + 1, PAL.grassDk);
  p.set(x, y - 1, PAL.grassLt).set(x + 3, y - 1, PAL.grassLt);
}

function grassTile(variant) {
  const p = new Pix(T, T).rect(0, 0, T, T, PAL.grass);
  const r = seeded(variant * 97 + 13);
  if (variant > 0) {
    const n = variant === 3 ? 2 : 1;
    for (let i = 0; i < n; i++) tuft(p, 2 + Math.floor(r() * 10), 3 + Math.floor(r() * 10));
  }
  return p;
}

// tall grass: two rows of chunky blade clumps. The second row is also drawn on
// top of the player, so they look like they're wading through it.
function grassClump(p, cx, cy) {
  p.poly([cx - 4.5, cy + 3, cx - 3, cy - 4, cx - 0.5, cy, cx + 2, cy - 5, cx + 4.5, cy + 3], PAL.tallLt);
  p.line(cx - 4, cy + 2, cx - 3, cy - 3, PAL.tallDk);
  p.line(cx - 1, cy, cx + 1, cy - 4, PAL.tallDk);
  p.line(cx - 4, cy + 3, cx + 4, cy + 3, PAL.tallDk);
  p.set(cx + 1, cy - 4, PAL.white);
}
function tallGrassTile(overlayOnly) {
  const p = new Pix(T, T);
  if (!overlayOnly) {
    p.rect(0, 0, T, T, PAL.tall);
    grassClump(p, 4, 5); grassClump(p, 12, 5);
  }
  grassClump(p, 0, 12); grassClump(p, 8, 12); grassClump(p, 16, 12);
  if (overlayOnly) for (let y = 0; y < 9; y++) for (let x = 0; x < T; x++) p.d[y * T + x] = null;
  return p;
}

// path / water tiles change their edges depending on what's next to them.
// mask bits: 1 = north is different, 2 = east, 4 = south, 8 = west
function pathTile(mask) {
  const p = new Pix(T, T).rect(0, 0, T, T, PAL.path);
  const r = seeded(mask * 31 + 7);
  for (let i = 0; i < 5; i++) p.set(1 + Math.floor(r() * 14), 1 + Math.floor(r() * 14), PAL.pathDk);
  const edge = PAL.pathEdge;
  if (mask & 1) { p.rect(0, 0, T, 1, PAL.grass); p.rect(0, 1, T, 1, edge); }
  if (mask & 4) { p.rect(0, 15, T, 1, PAL.grass); p.rect(0, 14, T, 1, edge); }
  if (mask & 8) { p.rect(0, 0, 1, T, PAL.grass); p.rect(1, 0, 1, T, edge); }
  if (mask & 2) { p.rect(15, 0, 1, T, PAL.grass); p.rect(14, 0, 1, T, edge); }
  // round the outside corners a little
  const corner = (x, y, ix, iy) => { p.set(x, y, PAL.grass); p.set(ix, y, PAL.grass); p.set(x, iy, PAL.grass); p.set(ix, iy, edge); };
  if ((mask & 9) === 9) corner(0, 0, 1, 1);
  if ((mask & 3) === 3) corner(15, 0, 14, 1);
  if ((mask & 12) === 12) corner(0, 15, 1, 14);
  if ((mask & 6) === 6) corner(15, 15, 14, 14);
  return p;
}

function waterTile(mask, frame) {
  const p = new Pix(T, T).rect(0, 0, T, T, PAL.water);
  const o = frame ? 3 : 0;
  // little wave glints
  p.rect((2 + o) % 14, 4, 3, 1, PAL.waterLt).rect((9 + o) % 14, 10, 3, 1, PAL.waterLt);
  p.rect((10 + o) % 14, 5, 2, 1, PAL.waterDk).rect((3 + o) % 14, 11, 2, 1, PAL.waterDk);
  const s = PAL.shore, f = PAL.waterLt;
  if (mask & 1) { p.rect(0, 0, T, 2, PAL.grass); p.rect(0, 2, T, 1, s); p.rect(0, 3, T, 1, f); }
  if (mask & 4) { p.rect(0, 14, T, 2, PAL.grass); p.rect(0, 13, T, 1, s); }
  if (mask & 8) { p.rect(0, 0, 2, T, PAL.grass); p.rect(2, 0, 1, T, s); p.rect(3, 0, 1, T, f); }
  if (mask & 2) { p.rect(14, 0, 2, T, PAL.grass); p.rect(13, 0, 1, T, s); }
  return p;
}

function flowerTile(frame) {
  const p = grassTile(0);
  const flower = (x, y, sway) => {
    x += sway;
    p.set(x, y + 3, PAL.grassDk).set(x - 1, y + 3, PAL.grassDk).set(x + 1, y + 2, PAL.grassDk);
    p.set(x - 1, y, PAL.red).set(x + 1, y, PAL.red).set(x, y - 1, PAL.red).set(x, y + 1, PAL.red);
    p.set(x - 1, y - 1, '#f08080').set(x, y, PAL.yellow);
    p.set(x + 1, y + 1, '#b02838').set(x - 1, y + 1, '#b02838').set(x + 1, y - 1, '#b02838');
  };
  flower(4, 4, frame ? 1 : 0);
  flower(11, 10, frame ? 0 : 1);
  return p;
}

function fenceTile() {
  const p = grassTile(0);
  const w = PAL.wood, d = PAL.woodDk, l = PAL.woodLt;
  p.rect(0, 5, T, 2, w).rect(0, 10, T, 2, w);
  p.rect(0, 7, T, 1, d).rect(0, 12, T, 1, d);
  p.rect(0, 5, T, 1, l).rect(0, 10, T, 1, l);
  for (const x of [2, 12]) {
    p.rect(x, 2, 3, 12, w).rect(x + 2, 2, 1, 12, d).rect(x, 2, 1, 12, l);
    p.rect(x, 1, 3, 1, d).rect(x, 14, 3, 1, d).set(x - 1, 14, PAL.grassDk);
  }
  return p;
}

// ---------------------------------------------------------------- trees

function treeSprite() {
  const p = new Pix(T, 24);
  p.rect(6, 17, 4, 6, PAL.trunk).rect(6, 17, 1, 6, shade(PAL.trunk, 0.25)).rect(9, 17, 1, 6, shade(PAL.trunk, -0.35));
  // three stacked tiers, like a round pine
  const tiers = [[8, 15, 7.5, 4.5], [8, 10.5, 6.8, 4.5], [8, 6, 5.5, 4.2]];
  for (const [cx, cy, rx, ry] of tiers) {
    p.ellipse(cx, cy, rx, ry, PAL.leafDk);
    p.ellipse(cx - 0.5, cy - 0.6, rx - 0.6, ry - 0.8, PAL.leaf);
    p.ellipse(cx - 2, cy - 1.6, rx * 0.5, ry * 0.45, PAL.leafLt);
  }
  p.set(4, 4, PAL.leafHi).set(3, 9, PAL.leafHi).set(2, 14, PAL.leafHi).set(5, 8, PAL.leafHi);
  p.outline(PAL.treeLine);
  return p;
}

// ---------------------------------------------------------------- buildings & props

function houseSprite(roof) {
  const W = 64, H = 64;
  const p = new Pix(W, H);
  const wall = '#f2ead6', wallDk = '#d2c6a8', glass = '#78b8f0';
  // walls
  p.rect(5, 30, 54, 32, wall).rect(5, 58, 54, 4, wallDk).rect(5, 30, 54, 2, wallDk);
  // roof
  p.poly([1, 32, 8, 3, 56, 3, 63, 32], roof);
  for (let y = 8; y < 32; y += 5) p.line(3, y, 61, y, shade(roof, -0.25));
  p.rect(8, 3, 48, 2, shade(roof, 0.3));
  p.rect(1, 31, 62, 2, shade(roof, -0.45));
  // chimney
  p.rect(44, 0, 6, 8, '#a87860').rect(44, 0, 6, 1, '#7a5040');
  // windows
  for (const wx of [36, 48]) {
    p.rect(wx - 1, 37, 12, 11, PAL.white).rect(wx, 38, 10, 9, glass);
    p.rect(wx + 4, 38, 1, 9, PAL.white).rect(wx, 42, 10, 1, PAL.white);
    p.set(wx + 1, 39, '#d8f0ff').set(wx + 2, 39, '#d8f0ff').set(wx + 1, 40, '#d8f0ff');
  }
  // door (sits in the second tile column, x 16..31)
  p.rect(18, 40, 12, 22, '#8a5a34').rect(19, 41, 10, 21, '#a86c3c');
  p.rect(19, 41, 10, 1, '#c88c58').set(26, 51, PAL.yellow).set(26, 52, '#a07820');
  p.rect(16, 62, 16, 2, '#b8b0a0');
  // flower box
  p.rect(6, 50, 10, 3, PAL.woodDk).set(8, 49, PAL.red).set(11, 49, '#f0a0d0').set(14, 49, PAL.red);
  p.outline('#3a2a28');
  return p;
}

function labSprite() {
  const W = 96, H = 64;
  const p = new Pix(W, H);
  const wall = '#e8eef0', wallDk = '#c0ccd0', roof = '#5a8a9a', glass = '#78b8f0';
  p.rect(3, 22, 90, 40, wall).rect(3, 58, 90, 4, wallDk);
  p.poly([0, 24, 6, 4, 90, 4, 96, 24], roof);
  p.rect(6, 4, 84, 2, shade(roof, 0.35));
  for (let y = 9; y < 24; y += 5) p.line(3, y, 93, y, shade(roof, -0.25));
  p.rect(0, 23, 96, 2, shade(roof, -0.45));
  // big windows
  for (const wx of [8, 22, 60, 74]) {
    p.rect(wx - 1, 30, 14, 14, PAL.white).rect(wx, 31, 12, 12, glass);
    p.rect(wx + 5, 31, 1, 12, PAL.white);
    p.line(wx + 1, 41, wx + 4, 32, '#d8f0ff');
  }
  // sign over the door
  p.rect(28, 26, 24, 9, '#3a5a68').rect(29, 27, 22, 7, '#f8f0c0');
  // glass double door (third tile column, x 32..47)
  p.rect(33, 40, 14, 22, '#5a8a9a').rect(34, 41, 5, 21, '#a8d8e8').rect(41, 41, 5, 21, '#a8d8e8');
  p.rect(30, 62, 20, 2, '#b8b0a0');
  // satellite dish, because science
  p.ellipse(84, 6, 5, 3, '#d0d8e0').rect(83, 6, 2, 4, '#8898a0');
  p.outline('#26343c');
  // little "LAB" letters drawn as pixels
  const L = ['#...###.###.', '#...#.#.#.#.', '#...###.##..', '#...#.#.#.#.', '###.#.#.###.'];
  L.forEach((row, y) => [...row].forEach((c, x) => { if (c === '#') p.set(34 + x, 28 + y, '#3a5a68'); }));
  return p;
}

function signSprite() {
  const p = new Pix(T, T);
  p.rect(7, 9, 2, 7, PAL.woodDk);
  p.rect(1, 2, 14, 9, PAL.wood).rect(1, 2, 14, 1, PAL.woodLt).rect(1, 10, 14, 1, PAL.woodDk);
  p.rect(3, 5, 10, 1, PAL.woodDk).rect(3, 7, 7, 1, PAL.woodDk);
  p.outline('#4a3020');
  return p;
}

function cubeSprite(size = 12) {
  // a Capture Cube: red lid, white base, glowing gold button
  const p = new Pix(size, size);
  const s = size / 12;
  p.poly([1 * s, 3.5 * s, 6 * s, 1 * s, 11 * s, 3.5 * s, 6 * s, 6 * s], '#ff7a6a');     // top face
  p.poly([1 * s, 3.5 * s, 6 * s, 6 * s, 6 * s, 11 * s, 1 * s, 8.5 * s], '#e04848');    // left face
  p.poly([6 * s, 6 * s, 11 * s, 3.5 * s, 11 * s, 8.5 * s, 6 * s, 11 * s], '#b02838');  // right face
  p.poly([1 * s, 6.5 * s, 6 * s, 9 * s, 6 * s, 11 * s, 1 * s, 8.5 * s], '#f0f0f0');     // white base, left
  p.poly([6 * s, 9 * s, 11 * s, 6.5 * s, 11 * s, 8.5 * s, 6 * s, 11 * s], '#c8c8d0');  // white base, right
  p.ellipse(6 * s, 3.5 * s, 1.4 * s, 0.9 * s, PAL.yellow);
  p.outline('#401820');
  return p;
}

function bubbleSprite() {
  // the "!" that pops over a trainer's head when they spot you
  const p = new Pix(10, 13);
  p.rect(1, 0, 8, 11, PAL.white).rect(0, 1, 10, 9, PAL.white).set(3, 11, PAL.white).set(3, 12, PAL.white).set(4, 11, PAL.white);
  p.rect(4, 2, 2, 5, '#e03030').rect(4, 8, 2, 1, '#e03030');
  p.outline('#303040');
  return p;
}

// ---------------------------------------------------------------- people

// dir: 0 down, 1 up, 2 left, 3 right. frame: 0 standing, 1 / 2 mid-step
function personSprite(look, dir, frame) {
  if (dir === 3) return personSprite(look, 2, frame).flipX();
  const p = new Pix(16, 21);
  const { skin, hair, hat, hatDk, shirt, pants, shoes, bag, coat, longHair } = look;
  const shirtDk = shade(shirt, -0.3);
  const eye = '#202030';
  const step = frame === 0 ? 0 : (frame === 1 ? 1 : -1);
  const bob = frame === 0 ? 0 : 1; // the head dips during a step

  if (dir === 0 || dir === 1) {
    // legs
    const lUp = step === 1 ? 1 : 0, rUp = step === -1 ? 1 : 0;
    p.rect(5, 16, 3, 3 - lUp, pants).rect(5, 19 - lUp, 3, 2, shoes);
    p.rect(8, 16, 3, 3 - rUp, pants).rect(8, 19 - rUp, 3, 2, shoes);
    // body + arms
    const body = coat || shirt;
    p.rect(4, 11, 8, coat ? 7 : 5, body);
    p.rect(3, 11 + (step === -1 ? 1 : 0), 1, 4, body).set(3, 15 + (step === -1 ? 1 : 0), skin);
    p.rect(12, 11 + (step === 1 ? 1 : 0), 1, 4, body).set(12, 15 + (step === 1 ? 1 : 0), skin);
    if (coat && dir === 0) p.rect(7, 12, 2, 6, shirt);
    if (dir === 1 && bag) p.rect(5, 11, 6, 5, bag).rect(5, 11, 6, 1, shade(bag, 0.3)).rect(6, 13, 4, 1, shade(bag, -0.3));
    if (dir === 0 && bag) p.rect(5, 11, 1, 4, shade(bag, -0.2)).rect(10, 11, 1, 4, shade(bag, -0.2));
    p.rect(4, 15, 8, 1, shirtDk);
    // head
    const hy = bob;
    if (longHair) p.rect(3, 6 + hy, 10, 8, hair);
    p.ellipse(8, 6.5 + hy, 5, 4.8, skin);
    if (hat) {
      p.ellipse(8, 4.5 + hy, 5.4, 3.8, hat);
      if (dir === 0) p.rect(3, 6 + hy, 10, 1, hatDk).set(7, 3 + hy, PAL.white).set(8, 3 + hy, PAL.white);
      else p.rect(4, 7 + hy, 8, 3, hair);
      p.rect(3, 7 + hy, 1, 3, hair).rect(12, 7 + hy, 1, 3, hair);
    } else {
      p.ellipse(8, 4.5 + hy, 5.3, 3.6, hair);
      if (dir === 0) p.rect(3, 5 + hy, 1, 4, hair).rect(12, 5 + hy, 1, 4, hair).rect(5, 4 + hy, 4, 2, hair);
      else p.rect(3, 4 + hy, 10, 7, hair);
    }
    if (dir === 0) p.rect(6, 8 + hy, 1, 2, eye).rect(9, 8 + hy, 1, 2, eye);
  } else {
    // side view, facing left
    const body = coat || shirt;
    if (step === 0) {
      p.rect(6, 16, 4, 3, pants).rect(5, 19, 5, 2, shoes);
    } else {
      p.rect(4, 16, 2, 3, pants).rect(3, 19, 3, 2, shoes);
      p.rect(9, 16, 2, 3, shade(pants, -0.2)).rect(9, 19, 3, 2, shade(shoes, -0.2));
      p.rect(6, 16, 3, 1, pants);
    }
    p.rect(5, 11, 6, coat ? 7 : 5, body);
    if (bag) p.rect(10, 11, 3, 5, bag).rect(10, 11, 3, 1, shade(bag, 0.3));
    const armX = step === 0 ? 7 : (step === 1 ? 5 : 9);
    p.rect(armX, 11, 2, 4, shirtDk).set(armX, 15, skin).set(armX + 1, 15, skin);
    const hy = bob;
    if (longHair) p.rect(8, 6 + hy, 5, 8, hair);
    p.ellipse(7.5, 6.5 + hy, 4.6, 4.8, skin);
    if (hat) {
      p.ellipse(8.5, 4.5 + hy, 4.8, 3.6, hat);
      p.rect(2, 6 + hy, 6, 1, hatDk);
      p.rect(10, 6 + hy, 3, 4, hair);
    } else {
      p.ellipse(8.5, 4.5 + hy, 5, 3.6, hair);
      p.rect(9, 4 + hy, 4, 6, hair);
    }
    p.rect(4, 8 + hy, 1, 2, eye);
  }
  p.outline('#2c2838');
  return p;
}

const LOOKS = {
  player: { skin: '#f8d0a8', hair: '#5a3a28', hat: '#2ab0a0', hatDk: '#147060', shirt: '#f07830', pants: '#344a80', shoes: '#d84040', bag: '#f0c040' },
  prof:   { skin: '#f0c8a0', hair: '#c8c8d0', shirt: '#88a8c8', coat: '#f4f4f8', pants: '#606878', shoes: '#504040' },
  mom:    { skin: '#f8d0a8', hair: '#7a3a2a', shirt: '#f088a8', pants: '#5a5a90', shoes: '#704050', longHair: true },
  kid:    { skin: '#e8b890', hair: '#2a2a2a', hat: '#e8c030', hatDk: '#a07820', shirt: '#58a858', pants: '#806040', shoes: '#404040' },
  hiker:  { skin: '#d8a070', hair: '#4a3020', hat: '#a06030', hatDk: '#704020', shirt: '#c05030', pants: '#5a6a40', shoes: '#3a2a20', bag: '#6a7a40' },
  girl:   { skin: '#f8d8b8', hair: '#e0a040', shirt: '#9070d0', pants: '#404080', shoes: '#c04080', longHair: true },
};

// ---------------------------------------------------------------- critters
// Each critter has a draw function (p, back) on a 48x48 grid. Front views face
// the player's critter (left); back views are what you see of your own critter.

const INK = '#1c1828';

function eyeShine(p, x, y) { p.set(x, y, '#ffffff'); }

const CRITTER_ART = {
  // 🦇 DUSKIT — the bat. Shadow type, sharp ears, sharper attitude.
  duskit(p, back) {
    const body = '#5b4a9e', bodyLt = '#8070c8', belly = '#b8a8ec';
    const wing = '#8a4cb4', wingLt = '#b880d8', bone = '#34245e', earIn = '#e078a8';
    const s = back ? 1.12 : 1;
    // wing (left half; mirrored later)
    const W = (x, y) => [24 - (24 - x) * s, y];
    p.poly([...W(19, 19), ...W(12, 12), ...W(2, 6), ...W(4, 14), ...W(1, 22), ...W(7, 20), ...W(5, 30), ...W(11, 25), ...W(13, 33), ...W(17, 27), ...W(20, 30)], wing);
    p.ellipse(...W(10, 15), 6, 4, wingLt, wing);
    for (const tip of [W(2, 6), W(1, 22), W(5, 30), W(13, 33)]) p.line(...W(18, 20), ...tip, bone);
    // ear
    p.poly([15, 21, 13, 3, 23, 15], body);
    if (!back) p.poly([16, 18, 14.5, 7, 20.5, 15.5], earIn);
    // body (head and body are one fuzzy ball)
    p.ellipse(24, 27, 10.5, 11, body);
    p.ellipse(19, 21, 4, 3, bodyLt, body);
    if (!back) {
      p.ellipse(24, 31.5, 6.5, 6, belly);
      p.rect(18, 23, 4, 2, '#ffe040').set(21, 24, '#201830').set(20, 24, '#201830');
      p.line(16, 21, 21, 23, bone);
      p.rect(21, 29, 3, 1, bone);
      p.set(22, 30, '#ffffff').set(22, 31, '#ffffff');
    } else {
      p.ellipse(24, 30, 5, 7, shade(body, -0.15), body);
    }
    p.set(20, 38, bone).set(21, 38, bone).set(20, 39, bone);
    p.mirror();
    p.ellipse(24, 35, 11, 4, shade(body, -0.28), body);
    p.outline();
  },

  // 🐻 PEBBEAR — chibi cream bear with a nub tail and a lucky pebble. Earth type.
  pebbear(p, back) {
    const cream = '#f2dfb8', creamLt = '#fff4dc', creamDk = '#d6b788', tan = '#c4966a';
    const nose = '#5a3a2a', stone = '#98a0aa', stoneLt = '#d0d4da', stoneDk = '#5e6670';
    p.ellipse(18, 43.5, 5.5, 3.5, cream);
    if (!back) p.ellipse(18, 44.5, 3, 1.5, tan);
    p.ellipse(24, 36, 12, 9.5, cream);
    p.ellipse(12.5, 35, 3.6, 5.2, cream);
    p.rect(10, 37, 5, 2, stone).rect(10, 37, 5, 1, stoneLt);
    p.ellipse(13, 11, 4.8, 4.8, cream);
    p.ellipse(13, 11.5, 2.6, 2.6, back ? creamDk : tan);
    p.ellipse(24, 21, 14, 11.5, cream);
    p.ellipse(18, 15, 5, 3, creamLt, cream);
    if (!back) {
      p.ellipse(24, 38.5, 7, 6, creamLt);
      p.poly([24, 9.5, 27.5, 13, 24, 16.5, 20.5, 13], stone);
      p.poly([24, 10.5, 22, 13, 24, 13], stoneLt);
      p.ellipse(24, 26.5, 5.5, 4, creamLt);
      p.ellipse(24, 24.5, 2.6, 1.7, nose);
      p.set(23, 24, '#8a6a5a');
      p.set(23, 27, nose).set(22, 28, nose).set(21, 28, nose);
      p.rect(17, 19, 3, 4, INK); eyeShine(p, 17, 19);
      p.line(15, 16, 20, 18, tan);
      p.set(15, 24, '#f0a0a0').set(16, 24, '#f0a0a0');
      p.ellipse(24, 31, 12, 2.5, creamDk, cream);
    } else {
      // a little row of pebbles down the back and the famous nub tail
      for (const y of [27, 32]) p.poly([24, y - 2.5, 26.5, y, 24, y + 2.5, 21.5, y], stone);
      p.set(23, 25, stoneLt).set(23, 30, stoneLt);
      p.ellipse(24, 41, 3.4, 2.8, creamLt);
      p.set(23, 40, '#ffffff');
    }
    p.ellipse(24, 44, 12, 3, creamDk, cream);
    p.mirror();
    if (back) p.poly([24, 25.5, 26.5, 28, 24, 30.5], stoneDk, stone);
    p.outline();
  },

  // 🦖 ZAPTOR — stubby blue raptor that crackles. Volt type.
  zaptor(p, back) {
    const blue = '#3f86e0', blueLt = '#80b8f6', blueDk = '#2a5aa8', belly = '#f4e8a8';
    const volt = '#ffd23c', claw = '#eeeef4';
    if (!back) {
      p.poly([30, 30, 40, 22, 47, 16, 45, 23, 38, 33, 32, 38], blue);
      p.poly([43, 18, 47, 13, 46, 21], volt);
      p.ellipse(34, 40, 5, 6, blueDk);
      p.ellipse(35, 45.5, 5, 2, blueDk);
      p.set(31, 46, claw).set(33, 46, claw);
      p.ellipse(28, 31, 10, 10, blue);
      p.ellipse(23.5, 34, 5.5, 7, belly);
      p.ellipse(24, 40, 5, 5.5, blue);
      p.ellipse(23, 45.5, 5.5, 2, blue);
      p.set(18, 46, claw).set(20, 46, claw).set(22, 46, claw);
      p.poly([21, 28, 16, 31, 14, 34, 18, 33, 23, 31], blue);
      p.set(13, 34, claw).set(14, 35, claw);
      // head
      p.poly([17, 10, 20, 1, 23, 10], volt);
      p.poly([22, 10, 28, 3, 27, 13], volt);
      p.poly([26, 13, 33, 9, 29, 17], volt);
      p.ellipse(19, 17, 9, 7.5, blue);
      p.ellipse(10, 20, 6.5, 4, blue);
      p.ellipse(13, 23.5, 6, 2.2, blueDk);
      p.ellipse(16, 24, 4, 2.5, belly);
      p.line(5, 21, 17, 22, '#7a2038');
      p.set(7, 22, PAL.white).set(10, 22, PAL.white).set(13, 22, PAL.white);
      p.set(5, 18, blueDk);
      p.rect(17, 14, 4, 3, volt).rect(19, 14, 1, 3, INK);
      p.line(14, 12, 21, 14, blueDk);
      p.ellipse(15, 13, 4, 2, blueLt, blue);
      // lightning stripes
      p.line(30, 24, 33, 27, volt).line(33, 27, 31, 29, volt).line(31, 29, 35, 32, volt);
      p.line(38, 26, 40, 28, volt).line(40, 28, 39, 30, volt);
      p.ellipse(30, 38, 10, 3.5, blueDk, blue);
    } else {
      // from behind, looking up-right at the enemy
      p.poly([18, 32, 8, 40, 1, 47, 6, 47, 14, 42, 22, 38], blue);
      p.poly([3, 44, 0, 47, 5, 47], volt);
      p.ellipse(18, 42, 5, 5, blueDk);
      p.ellipse(31, 42, 5, 5, blueDk);
      p.ellipse(24, 33, 11, 11, blue);
      p.ellipse(31, 16, 9, 7.5, blue);
      p.ellipse(38, 13, 5, 3.5, blue);
      p.poly([26, 10, 27, 1, 31, 9], volt);
      p.poly([22, 15, 19, 6, 27, 11], volt);
      p.poly([20, 22, 14, 18, 24, 18], volt);
      for (let i = 0; i < 4; i++) p.poly([18 + i * 3, 28 - i * 3, 15 + i * 3, 26 - i * 3, 19 + i * 3, 25 - i * 3], volt);
      p.line(26, 30, 29, 33, volt).line(29, 33, 27, 35, volt).line(27, 35, 31, 38, volt);
      p.ellipse(20, 26, 5, 4, blueLt, blue);
      p.ellipse(28, 41, 10, 3.5, blueDk, blue);
      p.set(40, 13, blueDk);
    }
    p.outline();
  },

  // 🐭 NIBBLY — round little mouse with big ears and a curly tail. Normal type.
  nibbly(p, back) {
    const fur = '#c8a078', furLt = '#ecd2ac', furDk = '#a07850', pink = '#f0a0b0';
    p.ellipse(18, 43, 4.5, 3, furDk);
    p.ellipse(24, 34, 11, 9.5, fur);
    p.ellipse(13.5, 13, 5.5, 6, fur);
    p.ellipse(13.5, 13.5, 3.2, 3.8, back ? furDk : pink);
    p.ellipse(24, 23, 10, 8.5, fur);
    p.ellipse(19, 18, 4, 2.5, furLt, fur);
    if (!back) {
      p.ellipse(24, 36.5, 6.5, 6, furLt);
      p.rect(18, 20, 2, 3, INK); eyeShine(p, 18, 20);
      p.set(23, 25, '#e06080').set(23, 26, INK);
      p.rect(23, 27, 1, 3, PAL.white);
      p.line(13, 25, 19, 26, furDk).line(13, 28, 19, 27, furDk);
    }
    p.ellipse(24, 41, 11, 3, furDk, fur);
    p.mirror();
    // curly tail sticks out on one side
    const tx = back ? 24 : 36;
    p.line(tx, 38, tx + 6, 36, pink).line(tx + 6, 36, tx + 8, 31, pink).line(tx + 8, 31, tx + 5, 29, pink).set(tx + 4, 30, pink);
    p.outline();
  },

  // 🐦 GUSTLING — puffy sky bird with a swirl crest. Wind type.
  gustling(p, back) {
    const sky = '#7cc4f0', skyDk = '#4a90d0', white = '#f4f8ff', beak = '#f0a030';
    p.poly([16, 26, 4, 22, 8, 30, 3, 33, 14, 36], skyDk);
    p.rect(19, 41, 2, 4, beak).rect(17, 44, 5, 1, beak);
    p.ellipse(24, 29, 11, 12, sky);
    p.ellipse(19, 21, 4, 3, shade(sky, 0.35), sky);
    if (!back) {
      p.ellipse(24, 33, 6.5, 7, white);
      p.rect(18, 24, 2, 3, INK); eyeShine(p, 18, 24);
      p.poly([22, 28, 24, 26, 24, 31], beak);
    } else {
      p.poly([20, 38, 24, 46, 24, 38], skyDk);
    }
    p.ellipse(24, 38, 11, 3, skyDk, sky);
    p.mirror();
    // swirl crest
    p.line(24, 18, 26, 12, skyDk).line(26, 12, 30, 10, skyDk).line(30, 10, 32, 12, skyDk).line(32, 12, 30, 14, skyDk).set(29, 13, skyDk);
    p.line(23, 18, 21, 13, skyDk);
    p.outline();
  },

  // 🌱 BUDLET — a leafy bulb that headbutts. Leaf type.
  budlet(p, back) {
    const g = '#6cc454', gDk = '#3a8a3a', gLt = '#a8e47c', leaf = '#42a848', leafDk = '#25703a';
    p.ellipse(18, 43, 4.5, 3, gDk);
    p.poly([24, 18, 14, 4, 8, 6, 12, 14, 18, 20], leaf);
    p.line(23, 18, 11, 7, leafDk);
    p.ellipse(24, 32, 12, 11, g);
    p.ellipse(19, 26, 4.5, 3, gLt, g);
    if (!back) {
      p.rect(17, 30, 3, 3, INK); eyeShine(p, 17, 30);
      p.line(16, 28, 20, 29, gDk);
      p.rect(21, 36, 3, 1, gDk);
      p.ellipse(24, 40, 9, 2.5, gDk, g);
    } else {
      p.line(24, 22, 24, 40, gDk);
    }
    p.mirror();
    // a little sprout curl on top
    p.line(24, 21, 26, 16, leafDk).line(26, 16, 30, 15, leafDk);
    p.poly([28, 15, 34, 10, 33, 16], gLt);
    p.outline();
  },

  // 💧 BLOBLET — a water slime with a droplet top. Tide type.
  bloblet(p, back) {
    const w = '#58b0f0', wDk = '#2e78c8', wLt = '#c0e8ff';
    p.poly([17, 27, 24, 6, 31, 27], w);
    p.ellipse(24, 34, 13.5, 10.5, w);
    p.rect(10, 41, 28, 3, w);
    p.ellipse(19, 24, 3, 6, wLt, w);
    p.set(24, 10, wLt).set(23, 13, wLt);
    if (!back) {
      p.rect(17, 31, 3, 5, INK); p.set(17, 31, '#ffffff').set(17, 32, '#ffffff');
      p.line(20, 39, 22, 40, INK).line(22, 40, 23, 40, INK);
    }
    p.ellipse(24, 42, 14, 2.5, wDk, w);
    p.mirror();
    p.outline();
  },

  // 🔥 COALBY — a charcoal pangolin with glowing ember cracks. Ember type.
  coalby(p, back) {
    const coal = '#4c4250', coalLt = '#7c6e84', coalDk = '#2c2634';
    const ember = '#ff7a2a', hot = '#ffd448', face = '#eaae7c', faceDk = '#c07850';
    // curled tail
    p.poly([34, 36, 42, 41, 47, 34, 46, 25, 41, 22, 39, 29, 37, 33], coal);
    p.line(41, 24, 46, 30, ember).line(40, 32, 45, 37, ember);
    // legs
    p.ellipse(18, 42, 3.8, 4.2, coalDk); p.ellipse(33, 42, 3.8, 4.2, coalDk);
    for (const x of [15, 17, 30, 32]) p.set(x, 46, '#f0e0d0');
    // armoured body
    p.ellipse(27, 32, 14, 11, coal);
    p.ellipse(24, 24.5, 8, 3.5, coalLt, coal);
    for (const [y, x0, x1] of [[26, 15, 39], [31, 14, 41], [36, 15, 40]]) {
      for (let x = x0; x < x1; x += 5) p.set(x, y, coalDk).set(x + 1, y + 1, coalDk).set(x + 2, y + 1, coalDk).set(x + 3, y, coalDk);
    }
    p.line(18, 28, 24, 26, ember).line(24, 26, 30, 29, ember).line(30, 29, 37, 27, ember);
    p.line(17, 34, 23, 33, ember).line(23, 33, 29, 35, ember).line(29, 35, 38, 33, ember);
    p.set(24, 26, hot).set(30, 29, hot).set(23, 33, hot);
    // little flames rising off the back
    p.poly([24, 22, 27, 13, 30, 22], ember); p.poly([26, 21, 27, 16, 28.5, 21], hot);
    p.poly([32, 23, 36, 16, 37, 24], ember); p.poly([34, 22, 35.5, 19, 36, 23], hot);
    p.ellipse(27, 41, 13, 2.5, coalDk, coal);
    // head
    p.ellipse(12, 33, 7, 5.5, face);
    p.poly([8, 30.5, 1, 35, 8, 37.5], face);
    p.ellipse(13, 29, 6, 2.8, coal, face);
    if (!back) {
      p.set(1, 35, INK).set(2, 35, INK);
      p.rect(10, 31, 3, 2, hot).set(11, 32, INK).set(11, 31, INK);
      p.line(9, 30, 14, 31, coalDk);
      p.line(3, 37, 9, 37, faceDk);
      p.set(15, 34, '#ff9a8a');
    }
    p.outline();
  },
};

// critters drawn side-on just turn around for their back view
const FLIP_BACK = new Set(['coalby']);

function critterSprite(id, back) {
  const p = new Pix(48, 48);
  CRITTER_ART[id](p, !!back);
  return back && FLIP_BACK.has(id) ? p.flipX() : p;
}

// ---------------------------------------------------------------- build everything once

function buildArt() {
  const t = ART.tiles;
  t.grass = [0, 1, 2, 3].map(v => grassTile(v).canvas());
  t.tall = tallGrassTile(false).canvas();
  t.tallOver = tallGrassTile(true).canvas();
  t.path = []; t.water = [[], []];
  for (let m = 0; m < 16; m++) {
    t.path[m] = pathTile(m).canvas();
    t.water[0][m] = waterTile(m, 0).canvas();
    t.water[1][m] = waterTile(m, 1).canvas();
  }
  t.flower = [flowerTile(0).canvas(), flowerTile(1).canvas()];
  t.fence = fenceTile().canvas();
  t.tree = treeSprite().canvas();

  ART.props.house = houseSprite('#d85048').canvas();
  ART.props.houseBlue = houseSprite('#4a78c8').canvas();
  ART.props.lab = labSprite().canvas();
  ART.props.sign = signSprite().canvas();
  ART.props.cube = cubeSprite(12).canvas();
  ART.props.cubeBig = cubeSprite(16).canvas();
  ART.ui.bubble = bubbleSprite().canvas();

  for (const [name, look] of Object.entries(LOOKS)) {
    ART.people[name] = [0, 1, 2, 3].map(d => [0, 1, 2].map(f => personSprite(look, d, f).canvas()));
  }
  for (const id of Object.keys(CRITTER_ART)) {
    ART.critters[id] = { front: critterSprite(id, false).canvas(), back: critterSprite(id, true).canvas() };
  }
}
