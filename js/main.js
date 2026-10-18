// main.js — boots the game: title screen, the frame loop, and the phone controls.
'use strict';

const G = { scene: 'title', frame: 0, state: null, wipe: 0 };

function newState() {
  return { name: 'KID', team: [], box: [], bag: {}, flags: {}, seen: {}, caught: {}, steps: 0, pos: null };
}

// ---------------------------------------------------------------- title screen

// big chunky title text: coloured letters, a shadow, and a dark outline all round
const bigTextCache = new Map();
function drawBigText(str, x, y, color, shadow, scale = 2, outline = '#202040') {
  const key = [str, color, shadow, outline].join('|');
  let cv = bigTextCache.get(key);
  if (!cv) {
    const w = textWidth(str) + 4, h = FONT_H + 4;
    cv = document.createElement('canvas'); cv.width = w; cv.height = h;
    const c = cv.getContext('2d');
    for (const [dx, dy] of [[0, 1], [2, 1], [1, 0], [1, 2], [2, 2], [2, 3], [3, 2], [0, 0], [2, 0], [0, 2]]) drawText(c, str, dx, dy, outline, null);
    drawText(c, str, 1, 1, color, shadow);
    bigTextCache.set(key, cv);
  }
  ctx.drawImage(cv, x, y, cv.width * scale, cv.height * scale);
}

function drawTitle() {
  // sky
  ctx.fillStyle = '#78c0f0'; ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = '#90d0f8'; ctx.fillRect(0, 40, W, 30);
  ctx.fillStyle = '#a8dcf8'; ctx.fillRect(0, 62, W, 20);
  // clouds drift by
  const cx = (G.frame / 4) % (W + 60) - 60;
  ctx.fillStyle = '#ffffff';
  for (const [ox, oy] of [[0, 30], [130, 18], [70, 50]]) {
    const x = Math.round((cx + ox) % (W + 60)) - 30;
    ctx.fillRect(x, oy, 34, 6); ctx.fillRect(x + 6, oy - 4, 18, 4); ctx.fillRect(x + 4, oy + 6, 26, 2);
  }
  // hills + grass
  ctx.fillStyle = '#68b860';
  for (let x = 0; x < W; x += 2) ctx.fillRect(x, 96 + Math.round(Math.sin(x / 26) * 6), 2, 70);
  ctx.fillStyle = '#88d070'; ctx.fillRect(0, 112, W, 48);
  for (let x = 0; x < W; x += 16) ctx.drawImage(ART.tiles.tall, x, 128);
  for (let x = 0; x < W; x += 16) ctx.drawImage(ART.tiles.tall, x, 144);
  // logo
  drawBigText('CRITTER', 30, 6, '#f8d040', '#d07020', 3, '#3a2048');
  drawBigText('QUEST', 63, 40, '#f8f8f8', '#88b8e8', 3, '#203868');
  // the three starters
  STARTERS.forEach((sp, i) => {
    const bob = Math.floor((G.frame + i * 15) / 20) % 2;
    ctx.drawImage(ART.critters[sp].front, 30 + i * 66, 88 + bob);
  });
  if (!UI.menus.length && Math.floor(G.frame / 30) % 2 === 0) {
    drawFrame(78, 136, 84, 20, 'white');
    drawText(ctx, 'PRESS  A', 96, 141);
  }
}

async function titleScreen() {
  G.scene = 'title';
  await fadeIn(30);
  await waitPress('a', 'start');
  Sound.select();
  const save = loadSave();
  const opts = save ? ['CONTINUE', 'NEW GAME'] : ['NEW GAME'];
  for (;;) {
    const i = await choose(opts, { x: 74, y: 118, w: 92, cancel: false });
    if (opts[i] === 'CONTINUE') {
      G.state = Object.assign(newState(), save);
      await fadeOut(20);
      const p = G.state.pos || { map: 'mossvale', x: 5, y: 7, dir: 0 };
      loadMap(p.map, p.x, p.y, p.dir);
      G.scene = 'world';
      await fadeIn(20);
      showBanner(World.map.name);
      return;
    }
    if (save) {
      await say('Start a brand new game? Your old save will be erased!', { keep: true, prompt: true });
      const ok = await yesNo();
      UI.box = null;
      if (!ok) continue;
    }
    G.state = newState();
    G.state.name = await nameEntry();
    await fadeOut(20);
    loadMap('mossvale', 5, 7, 0);
    G.scene = 'world';
    await fadeIn(30);
    showBanner(World.map.name);
    World.busy = true;
    await SCRIPTS.intro();
    World.busy = false;
    saveGame();
    return;
  }
}

// ---------------------------------------------------------------- loop

function tick() {
  G.frame++;
  Input.poll();
  if (G.scene === 'world' && !UI.screen) updateWorld();
  const waiting = frameWaiters;
  frameWaiters = [];
  for (const r of waiting) r();
}

function render() {
  ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H);
  if (UI.screen) UI.screen();
  else if (G.scene === 'title') drawTitle();
  else if (G.scene === 'world') drawWorld();
  else if (G.scene === 'battle') drawBattle();
  if (UI.box) drawTextBox(UI.box);
  for (const f of UI.extras) f();
  for (const m of UI.menus) drawMenu(m);
  if (G.wipe > 0) {
    // black bars sweep in from both sides, like the GBA battle transition
    ctx.fillStyle = '#000';
    for (let r = 0; r < H / 8; r++) {
      const w = Math.ceil(G.wipe * W);
      if (r % 2) ctx.fillRect(W - w, r * 8, w, 8); else ctx.fillRect(0, r * 8, w, 8);
    }
  }
  if (Fade.amount > 0) {
    ctx.globalAlpha = Fade.amount; ctx.fillStyle = Fade.color; ctx.fillRect(0, 0, W, H); ctx.globalAlpha = 1;
  }
  dctx.imageSmoothingEnabled = false;
  dctx.drawImage(screen, 0, 0, display.width, display.height);
}

let last = 0, acc = 0;
const STEP = 1000 / 60;
function loop(ts) {
  if (!last) last = ts;
  acc += Math.min(100, ts - last);
  last = ts;
  let n = 0;
  while (acc >= STEP - 1 && n < 2) { tick(); acc -= STEP; n++; }
  if (acc < 0) acc = 0;
  render();
  requestAnimationFrame(loop);
}

// ---------------------------------------------------------------- display + controls

const display = document.getElementById('display');
const dctx = display.getContext('2d');

function fitDisplay() {
  const box = document.getElementById('screen-wrap').getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;
  const keyboard = matchMedia('(hover: hover) and (pointer: fine)').matches;
  const sideways = matchMedia('(orientation: landscape) and (max-height: 520px)').matches;
  // leave room for the buttons under the screen
  const reserve = keyboard ? 90 : sideways ? 30 : 300;
  const availH = Math.min(box.height || Infinity, innerHeight - reserve);
  // biggest whole-number scale that fits, in real device pixels, so pixels stay crisp.
  // (On low-res screens a whole number would leave the game tiny, so there we just fill the space.)
  const fit = Math.min(box.width * dpr / W, availH * dpr / H);
  const scale = fit >= 3 ? Math.floor(fit) : Math.max(1, fit);
  display.width = Math.round(W * scale); display.height = Math.round(H * scale);
  display.style.width = (display.width / dpr) + 'px';
  display.style.height = (display.height / dpr) + 'px';
}
addEventListener('resize', fitDisplay);
addEventListener('orientationchange', () => setTimeout(fitDisplay, 200));

function bindButton(el, btn) {
  const up = () => { Input.up(btn); el.classList.remove('on'); };
  el.addEventListener('pointerdown', e => {
    e.preventDefault();
    el.setPointerCapture(e.pointerId);
    Input.down(btn); el.classList.add('on');
  });
  el.addEventListener('pointerup', up);
  el.addEventListener('pointercancel', up);
  el.addEventListener('lostpointercapture', up);
}

function bindDpad(el) {
  let cur = null;
  const set = d => {
    if (d === cur) return;
    if (cur) Input.up(cur);
    cur = d;
    if (d) Input.down(d);
    el.dataset.dir = d || '';
  };
  const fromEvent = e => {
    const r = el.getBoundingClientRect();
    const x = e.clientX - (r.left + r.width / 2), y = e.clientY - (r.top + r.height / 2);
    if (Math.hypot(x, y) < r.width * 0.12) return cur; // dead zone in the middle
    return Math.abs(x) > Math.abs(y) ? (x < 0 ? 'left' : 'right') : (y < 0 ? 'up' : 'down');
  };
  el.addEventListener('pointerdown', e => { e.preventDefault(); el.setPointerCapture(e.pointerId); set(fromEvent(e)); });
  el.addEventListener('pointermove', e => { if (cur) set(fromEvent(e)); });
  const end = () => set(null);
  el.addEventListener('pointerup', end);
  el.addEventListener('pointercancel', end);
  el.addEventListener('lostpointercapture', end);
}

document.querySelectorAll('[data-btn]').forEach(el => bindButton(el, el.dataset.btn));
bindDpad(document.getElementById('dpad'));
// no pinch-zoom or double-tap-zoom while playing
document.addEventListener('gesturestart', e => e.preventDefault());
document.addEventListener('dblclick', e => e.preventDefault());

// ---------------------------------------------------------------- go!

buildArt();
buildBattleArt();
buildMenuArt();
fitDisplay();
Fade.amount = 1;
requestAnimationFrame(loop);
titleScreen();
