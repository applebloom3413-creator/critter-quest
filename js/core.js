// core.js — the game loop, buttons, sounds, and the text box / menu helpers
// that every scene uses. Game scripts are async functions: `await say(...)`.
'use strict';

const W = 240, H = 160;
const screen = document.createElement('canvas');
screen.width = W; screen.height = H;
const ctx = screen.getContext('2d');
ctx.imageSmoothingEnabled = false;

// ---------------------------------------------------------------- input

const BUTTONS = ['up', 'down', 'left', 'right', 'a', 'b', 'start'];
const Input = {
  held: {}, pressed: {}, _raw: {}, _hits: {},
  // called once per frame: turn raw button state into held + just-pressed
  poll() {
    for (const b of BUTTONS) {
      this.pressed[b] = !!this._hits[b];   // went down since last frame (catches quick taps too)
      this.held[b] = !!this._raw[b];
      this._hits[b] = false;
    }
  },
  down(b) { if (!this._raw[b]) this._hits[b] = true; this._raw[b] = true; Sound.unlock(); },
  up(b) { this._raw[b] = false; },
  dir() {
    if (this.held.up) return 1;
    if (this.held.down) return 0;
    if (this.held.left) return 2;
    if (this.held.right) return 3;
    return -1;
  },
};

const KEYMAP = {
  ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right',
  KeyW: 'up', KeyS: 'down', KeyA: 'left', KeyD: 'right',
  KeyZ: 'a', KeyJ: 'a', Space: 'a',
  KeyX: 'b', KeyK: 'b', Backspace: 'b', Escape: 'b',
  Enter: 'start',
};
addEventListener('keydown', e => { const b = KEYMAP[e.code]; if (b) { Input.down(b); e.preventDefault(); } });
addEventListener('keyup', e => { const b = KEYMAP[e.code]; if (b) { Input.up(b); e.preventDefault(); } });

// ---------------------------------------------------------------- sound (tiny square-wave blips)

const Sound = {
  ac: null, on: true,
  unlock() {
    if (this.ac) { if (this.ac.state === 'suspended') this.ac.resume(); return; }
    try { this.ac = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { this.on = false; }
  },
  tone(freq, dur, type = 'square', vol = 0.06, slide = 0, delay = 0) {
    if (!this.on || !this.ac) return;
    const t = this.ac.currentTime + delay;
    const o = this.ac.createOscillator(), g = this.ac.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t);
    if (slide) o.frequency.linearRampToValueAtTime(freq + slide, t + dur);
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(this.ac.destination);
    o.start(t); o.stop(t + dur + 0.02);
  },
  blip() { this.tone(880, 0.05); },
  select() { this.tone(660, 0.05); this.tone(990, 0.07, 'square', 0.06, 0, 0.05); },
  bump() { this.tone(110, 0.08, 'square', 0.05); },
  hit(strong) { this.tone(strong ? 180 : 240, 0.18, 'sawtooth', 0.08, -150); },
  faint() { this.tone(500, 0.5, 'square', 0.06, -420); },
  heal() { [523, 659, 784, 1046].forEach((f, i) => this.tone(f, 0.12, 'triangle', 0.08, 0, i * 0.1)); },
  levelUp() { [523, 659, 784, 659, 784, 1046].forEach((f, i) => this.tone(f, 0.1, 'square', 0.05, 0, i * 0.08)); },
  caught() { [392, 523, 659, 784, 1046].forEach((f, i) => this.tone(f, 0.14, 'square', 0.05, 0, i * 0.12)); },
  wiggle() { this.tone(300, 0.06, 'square', 0.05, 80); },
  encounter() { [880, 660, 880, 660, 880].forEach((f, i) => this.tone(f, 0.07, 'square', 0.05, 0, i * 0.07)); },
};

// ---------------------------------------------------------------- frame-based async helpers

let frameWaiters = [];
const nextFrame = () => new Promise(r => frameWaiters.push(r));
async function wait(frames) { for (let i = 0; i < frames; i++) await nextFrame(); }
async function waitPress(...btns) {
  if (!btns.length) btns = ['a', 'b'];
  for (;;) {
    await nextFrame();
    for (const b of btns) if (Input.pressed[b]) return b;
  }
}

// ---------------------------------------------------------------- boxes

// GBA-style frame: dark rim, coloured border, filled middle, rounded corners
const FRAMES = {
  white: { rim: '#404858', border: '#78a0d8', inner: '#c8d8f0', fill: '#f8f8f8' },
  info:  { rim: '#404858', border: '#e8e0b8', inner: '#f8f0d0', fill: '#f8f8e8' },
  dark:  { rim: '#202830', border: '#c8a858', inner: '#806838', fill: '#304050' },
};
function drawFrame(x, y, w, h, style = 'white') {
  const f = FRAMES[style];
  ctx.fillStyle = f.rim; ctx.fillRect(x + 2, y, w - 4, h); ctx.fillRect(x, y + 2, w, h - 4); ctx.fillRect(x + 1, y + 1, w - 2, h - 2);
  ctx.fillStyle = f.border; ctx.fillRect(x + 2, y + 1, w - 4, h - 2); ctx.fillRect(x + 1, y + 2, w - 2, h - 4);
  ctx.fillStyle = f.inner; ctx.fillRect(x + 3, y + 3, w - 6, h - 6);
  ctx.fillStyle = f.fill; ctx.fillRect(x + 4, y + 4, w - 8, h - 8);
}

function drawCursor(x, y, color = '#505058') {
  ctx.fillStyle = color;
  for (let i = 0; i < 4; i++) ctx.fillRect(x + i, y + i, 1, 7 - i * 2);
}
function drawDownArrow(x, y) {
  ctx.fillStyle = '#e04848';
  for (let i = 0; i < 4; i++) ctx.fillRect(x + i, y + i, 7 - i * 2, 1);
}

// ---------------------------------------------------------------- text box (say)

// UI layers are drawn on top of whatever scene is running
const UI = { box: null, menus: [], extras: [], screen: null };

// show text in the box at the bottom, typing it out, waiting for A between pages
// opts.style: 'white' (overworld) or 'dark' (battle); opts.auto: frames to wait instead of A; opts.keep: leave the box up
async function say(text, opts = {}) {
  const style = opts.style || 'white';
  const maxW = opts.width || (style === 'dark' ? 216 : 212);
  const lines = wrapText(text, maxW);
  const box = { style, lines: [], typing: true, arrow: false, x: opts.x ?? 0, w: opts.w ?? W };
  UI.box = box;
  for (let page = 0; page < lines.length; page += 2) {
    const pageLines = lines.slice(page, page + 2);
    box.lines = pageLines.map(() => '');
    box.typing = true; box.arrow = false;
    let skip = false;
    for (let li = 0; li < pageLines.length; li++) {
      for (let ci = 0; ci < pageLines[li].length; ci++) {
        box.lines[li] = pageLines[li].slice(0, ci + 1);
        if (!skip) {
          await nextFrame();
          if (Input.pressed.a || Input.pressed.b || (Input.held.a && Input.held.b)) skip = true;
        }
      }
      box.lines[li] = pageLines[li];
    }
    box.typing = false;
    const last = page + 2 >= lines.length;
    if (opts.prompt && last) return;   // a question: leave it up and go straight to the YES/NO menu
    if (opts.auto !== undefined && last) {
      for (let i = 0; i < opts.auto; i++) { await nextFrame(); if (Input.pressed.a) break; }
      break;
    }
    box.arrow = true;
    await waitPress('a', 'b');
    Sound.blip();
    box.arrow = false;
  }
  if (!opts.keep) UI.box = null;
}

function drawTextBox(box) {
  if (box.style === 'dark') {
    drawFrame(box.x, 112, box.w, 48, 'dark');
    box.lines.forEach((l, i) => drawText(ctx, l, box.x + 10, 120 + i * 16, '#f8f8f8', '#686878'));
    if (box.arrow && Math.floor(G.frame / 16) % 2 === 0) drawDownArrow(box.x + box.w - 16, 146);
  } else {
    drawFrame(box.x + 2, 114, box.w - 4, 46, 'white');
    box.lines.forEach((l, i) => drawText(ctx, l, box.x + 12, 121 + i * 16));
    if (box.arrow && Math.floor(G.frame / 16) % 2 === 0) drawDownArrow(box.x + box.w - 18, 147);
  }
}

// ---------------------------------------------------------------- menus (choose)

// a vertical list in a box. Returns the chosen index, or -1 if B was pressed.
// opts: x, y, w, cols, cancel (allow B), start (initial index), style, onMove(i)
async function choose(options, opts = {}) {
  const cols = opts.cols || 1;
  const rows = Math.ceil(options.length / cols);
  const colW = opts.colW || Math.max(...options.map(o => textWidth(o))) + 22;
  const w = opts.w || colW * cols + 12;
  const h = opts.h || rows * 16 + 12;
  const menu = {
    options, cols, colW, x: opts.x ?? (W - w - 2), y: opts.y ?? (112 - h - 2), w, h,
    i: opts.start || 0, style: opts.style || 'white', noFrame: opts.noFrame,
  };
  UI.menus.push(menu);
  if (opts.onMove) opts.onMove(menu.i);
  let result;
  for (;;) {
    await nextFrame();
    const p = Input.pressed;
    let ni = menu.i;
    if (p.up) ni -= cols;
    if (p.down) ni += cols;
    if (cols > 1 && p.left && menu.i % cols > 0) ni -= 1;
    if (cols > 1 && p.right && menu.i % cols < cols - 1) ni += 1;
    if (ni !== menu.i && ni >= 0 && ni < options.length) { menu.i = ni; Sound.blip(); if (opts.onMove) opts.onMove(ni); }
    if (p.a) { Sound.select(); result = menu.i; break; }
    if (p.b && opts.cancel !== false) { Sound.blip(); result = -1; break; }
  }
  if (!opts.keep) UI.menus.splice(UI.menus.indexOf(menu), 1);
  else menu.done = true;
  return result;
}

function drawMenu(m) {
  if (!m.noFrame) drawFrame(m.x, m.y, m.w, m.h, m.style);
  m.options.forEach((o, i) => {
    const cx = m.x + 14 + (i % m.cols) * m.colW, cy = m.y + 8 + Math.floor(i / m.cols) * 16;
    drawText(ctx, o, cx, cy);
    if (i === m.i && !m.done) drawCursor(cx - 9, cy + 1);
  });
}

async function yesNo() {
  const r = await choose(['YES', 'NO'], { x: 186, y: 64, w: 52, cancel: true });
  return r === 0;
}

// ---------------------------------------------------------------- screen fades

const Fade = { amount: 0, color: '#000' };
async function fadeOut(frames = 16, color = '#000') {
  Fade.color = color;
  for (let i = 1; i <= frames; i++) { Fade.amount = i / frames; await nextFrame(); }
}
async function fadeIn(frames = 16) {
  for (let i = frames - 1; i >= 0; i--) { Fade.amount = i / frames; await nextFrame(); }
}

// ---------------------------------------------------------------- saving

const SAVE_KEY = 'critter-quest-save-v1';
function saveGame() {
  try {
    const s = G.state;
    s.pos = { map: World.map.id, x: World.player.x, y: World.player.y, dir: World.player.dir };
    localStorage.setItem(SAVE_KEY, JSON.stringify(s));
    return true;
  } catch (e) { return false; }
}
function loadSave() {
  try { const raw = localStorage.getItem(SAVE_KEY); return raw ? JSON.parse(raw) : null; } catch (e) { return null; }
}

// ---------------------------------------------------------------- helpers

const rand = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
function pickWeighted(table) {
  let total = table.reduce((s, [, w]) => s + w, 0), r = Math.random() * total;
  for (const [v, w] of table) { if ((r -= w) < 0) return v; }
  return table[table.length - 1][0];
}
