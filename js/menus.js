// menus.js — the START menu, the TEAM screen, critter summaries, and the BAG.
'use strict';

// ---------------------------------------------------------------- START menu

async function startMenu() {
  Sound.blip();
  let start = 0;
  for (;;) {
    const opts = [];
    if (G.state.team.length) opts.push('TEAM');
    opts.push('BAG', 'SAVE', 'EXIT');
    const i = await choose(opts, { x: 166, y: 2, w: 72, start });
    if (i < 0 || opts[i] === 'EXIT') return;
    start = i;
    if (opts[i] === 'TEAM') await teamScreen('view');
    else if (opts[i] === 'BAG') await bagScreen('world');
    else if (opts[i] === 'SAVE') {
      await say('Would you like to save the game?', { keep: true, prompt: true });
      if (await yesNo()) {
        UI.box = null;
        if (saveGame()) { Sound.caught(); await say(`${G.state.name} saved the game!`); }
        else await say("Hmm, the game couldn't be saved on this device.");
      }
      UI.box = null;
    }
  }
}

// ---------------------------------------------------------------- shared bits

function miniIcon(species) {
  const key = 'mini_' + species;
  if (ART.ui[key]) return ART.ui[key];
  const cv = document.createElement('canvas');
  cv.width = 24; cv.height = 24;
  const c = cv.getContext('2d');
  c.imageSmoothingEnabled = false;
  c.drawImage(ART.critters[species].front, 0, 0, 24, 24);
  ART.ui[key] = cv;
  return cv;
}

function roundRect(x, y, w, h, fill, rim) {
  ctx.fillStyle = rim;
  ctx.fillRect(x + 1, y, w - 2, h); ctx.fillRect(x, y + 1, w, h - 2);
  ctx.fillStyle = fill;
  ctx.fillRect(x + 1, y + 1, w - 2, h - 2);
}

function drawStripes(c1, c2) {
  ctx.fillStyle = c1; ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = c2;
  for (let i = -H; i < W; i += 12) for (let y = 0; y < H; y++) ctx.fillRect(i + y, y, 5, 1);
}

// run a full-screen menu: saves and restores whatever was showing before
async function withScreen(draw, fn) {
  const prev = { screen: UI.screen, box: UI.box, menus: UI.menus, extras: UI.extras };
  UI.screen = draw; UI.box = null; UI.menus = []; UI.extras = [];
  try { return await fn(); }
  finally { Object.assign(UI, prev); }
}

// ---------------------------------------------------------------- TEAM screen
// mode: 'view' (from START), 'battle' (switch), 'forced' (your critter fainted), 'item' (pick a target)
// returns the chosen index, or -1

async function teamScreen(mode) {
  const team = G.state.team;
  const st = { sel: 0, swap: -1, msg: '' };
  const canCancel = mode !== 'forced';
  const count = team.length + (canCancel ? 1 : 0);
  const baseMsg = {
    view: 'Choose a CRITTER.', battle: 'Who should battle?', forced: 'Choose who goes next!', item: 'Use on which CRITTER?',
  }[mode];
  if (mode === 'forced' || mode === 'battle') st.sel = Math.max(0, team.findIndex(c => c.hp > 0 && c !== B.mine));

  const draw = () => {
    drawStripes('#3a6ea0', '#4278ac');
    team.forEach((c, i) => {
      const y = 3 + i * 22, on = st.sel === i, swapping = st.swap === i;
      const fainted = c.hp <= 0;
      const fill = swapping ? '#f8e070' : on ? '#f8b050' : fainted ? '#c87070' : '#5898d0';
      roundRect(4, y, 232, 20, fill, '#203048');
      const bob = on && Math.floor(G.frame / 12) % 2 ? -1 : 0;
      ctx.drawImage(miniIcon(c.species), 6, y - 3 + bob);
      drawText(ctx, critterName(c), 34, y + 6, '#f8f8f8', '#404858');
      drawText(ctx, 'Lv' + c.level, 102, y + 6, '#f8f8f8', '#404858');
      drawHpBar(150, y + 8, c.hp, c.maxHp);
      const t = `${c.hp}/${c.maxHp}`;
      drawText(ctx, t, 232 - textWidth(t), y + 6, '#f8f8f8', '#404858');
      if (B.mine === c && G.scene === 'battle') drawText(ctx, '★', 26, y + 5, '#f8f070', '#806020');
    });
    drawFrame(2, 136, canCancel ? 178 : 236, 24, 'white');
    drawText(ctx, st.msg || baseMsg, 12, 143);
    if (canCancel) {
      const on = st.sel === team.length;
      roundRect(184, 138, 52, 20, on ? '#f8b050' : '#5898d0', '#203048');
      drawText(ctx, 'CANCEL', 191, 143, '#f8f8f8', '#404858');
    }
  };

  const flash = async text => { st.msg = text; Sound.bump(); await waitPress('a', 'b'); st.msg = ''; };

  return withScreen(draw, async () => {
    for (;;) {
      await nextFrame();
      const p = Input.pressed;
      if (p.up) { st.sel = (st.sel + count - 1) % count; Sound.blip(); }
      if (p.down) { st.sel = (st.sel + 1) % count; Sound.blip(); }
      if (p.b && canCancel) { Sound.blip(); if (st.swap >= 0) { st.swap = -1; continue; } return -1; }
      if (!p.a) continue;
      Sound.select();
      if (st.sel === team.length) return -1;
      const c = team[st.sel];

      if (mode === 'item') return st.sel;

      if (st.swap >= 0) {
        // finish a swap started from the view menu
        const a = st.swap, b = st.sel;
        [team[a], team[b]] = [team[b], team[a]];
        st.swap = -1;
        continue;
      }

      if (mode === 'battle' || mode === 'forced') {
        const opts = ['SHIFT', 'SUMMARY'];
        if (canCancel) opts.push('CANCEL');
        const i = await choose(opts, { x: 160, y: 136 - (opts.length * 16 + 12), w: 78 });
        if (i === 0) {
          if (c.hp <= 0) { await flash(`${critterName(c)} has no energy left!`); continue; }
          if (c === B.mine) { await flash(`${critterName(c)} is already battling!`); continue; }
          return st.sel;
        }
        if (i === 1) st.sel = await summaryScreen(st.sel);
        continue;
      }

      // view mode
      const i = await choose(['SUMMARY', 'SWITCH', 'CANCEL'], { x: 160, y: 76, w: 78 });
      if (i === 0) st.sel = await summaryScreen(st.sel);
      else if (i === 1) { st.swap = st.sel; st.msg = 'Move to where?'; }
      if (st.swap < 0) st.msg = '';
      else st.msg = 'Move to where?';
    }
  });
}

// ---------------------------------------------------------------- critter summary

async function summaryScreen(idx) {
  const team = G.state.team;
  const st = { idx, page: 0 };
  const draw = () => {
    const c = team[st.idx], s = SPECIES[c.species];
    drawStripes('#e8dcc0', '#efe4cc');
    ctx.fillStyle = '#3a6ea0'; ctx.fillRect(0, 0, W, 18);
    drawText(ctx, st.page === 0 ? 'CRITTER INFO' : 'KNOWN MOVES', 8, 5, '#f8f8f8', '#203858');
    drawText(ctx, '< >', 218, 5, '#c8e0f8', '#203858');
    // left: portrait
    drawFrame(4, 22, 90, 134, 'info');
    ctx.fillStyle = '#d8ecc4'; ctx.fillRect(10, 30, 78, 56);
    ctx.drawImage(ART.critters[c.species].front, 25, 34 + (Math.floor(G.frame / 20) % 2));
    drawText(ctx, critterName(c), 12, 92);
    drawText(ctx, 'Lv' + c.level, 12, 108);
    drawTypeBadge(s.type, 12, 126);
    if (c.hp <= 0) drawText(ctx, 'FAINTED', 12, 142, '#e04848', '#f8c0c0');

    drawFrame(98, 22, 138, 134, 'white');
    if (st.page === 0) {
      const next = expForLevel(c.level + 1) - c.exp;
      const rows = [['HP', `${c.hp}/${c.maxHp}`], ['ATTACK', c.atk], ['DEFENSE', c.def], ['SPEED', c.spd], ['EXP NEXT', next]];
      rows.forEach(([k, v], i) => {
        drawText(ctx, k, 108, 30 + i * 13);
        const vs = String(v);
        drawText(ctx, vs, 226 - textWidth(vs), 30 + i * 13);
      });
      ctx.fillStyle = '#c8d0d8'; ctx.fillRect(106, 96, 122, 1);
      wrapText(s.blurb, 120).slice(0, 4).forEach((l, i) => drawText(ctx, l, 108, 101 + i * 13));
    } else {
      c.moves.forEach((m, i) => {
        const mv = MOVES[m.id], y = 30 + i * 31;
        drawText(ctx, mv.name, 108, y);
        drawTypeBadge(mv.type, 108, y + 14);
        const pp = `PP ${m.pp}/${mv.pp}`;
        drawText(ctx, pp, 226 - textWidth(pp), y + 14);
      });
    }
  };
  await withScreen(draw, async () => {
    for (;;) {
      await nextFrame();
      const p = Input.pressed;
      if (p.left || p.right) { st.page ^= 1; Sound.blip(); }
      if (p.up) { st.idx = (st.idx + team.length - 1) % team.length; Sound.blip(); }
      if (p.down) { st.idx = (st.idx + 1) % team.length; Sound.blip(); }
      if (p.a || p.b) { Sound.blip(); return; }
    }
  });
  return st.idx;
}

// ---------------------------------------------------------------- BAG
// mode 'world' or 'battle'. In battle, returns { item, target } for the battle to use (or null).

const ITEM_ORDER = ['CUBE', 'POTION', 'SUPER'];

async function bagScreen(mode) {
  const st = { sel: 0 };
  const list = () => ITEM_ORDER.filter(k => (G.state.bag[k] || 0) > 0);

  const draw = () => {
    drawStripes('#e0a860', '#e8b470');
    // a little backpack picture
    drawFrame(4, 4, 92, 104, 'info');
    ctx.drawImage(ART.ui.bag, 18, 18);
    drawText(ctx, 'ITEMS', 34, 90);
    drawFrame(98, 4, 140, 104, 'white');
    const items = list();
    const rows = [...items, 'CLOSE'];
    rows.forEach((k, i) => {
      const y = 12 + i * 16;
      drawText(ctx, k === 'CLOSE' ? 'CLOSE BAG' : ITEMS[k].name, 114, y);
      if (k !== 'CLOSE') { const n = 'x' + G.state.bag[k]; drawText(ctx, n, 230 - textWidth(n), y); }
      if (i === st.sel) drawCursor(105, y + 1);
    });
    drawFrame(2, 112, 236, 48, 'white');
    const k = rows[st.sel];
    const desc = k === 'CLOSE' ? 'Close the BAG and go back.' : ITEMS[k].desc;
    wrapText(desc, 216).slice(0, 2).forEach((l, i) => drawText(ctx, l, 12, 120 + i * 16));
  };

  return withScreen(draw, async () => {
    for (;;) {
      await nextFrame();
      const items = list(), count = items.length + 1;
      if (st.sel >= count) st.sel = count - 1;
      const p = Input.pressed;
      if (p.up) { st.sel = (st.sel + count - 1) % count; Sound.blip(); }
      if (p.down) { st.sel = (st.sel + 1) % count; Sound.blip(); }
      if (p.b) { Sound.blip(); return null; }
      if (!p.a) continue;
      Sound.select();
      if (st.sel === items.length) return null;
      const k = items[st.sel];
      const use = await choose(['USE', 'CANCEL'], { x: 168, y: 64, w: 70 });
      if (use !== 0) continue;
      if (k === 'CUBE') {
        if (mode === 'battle') return { item: 'CUBE' };
        await say('You can only throw that during a battle with a wild critter!');
        continue;
      }
      if (!G.state.team.length) { await say("You don't have any critters yet!"); continue; }
      const target = await teamScreen('item');
      if (target < 0) continue;
      const c = G.state.team[target];
      if (c.hp <= 0 || c.hp >= c.maxHp) { await say("It won't have any effect."); continue; }
      if (mode === 'battle') return { item: k, target };
      const before = c.hp;
      await useHeal(k, target, false);
      await say(`${critterName(c)} got back ${c.hp - before} HP!`);
    }
  });
}

// ---------------------------------------------------------------- naming the player
// A GBA-style letter grid. The name only ever lives in the save on this device.

const NAME_ROWS = ['ABCDEFGHI', 'JKLMNOPQR', 'STUVWXYZ-'];
const NAME_MAX = 7;

async function nameEntry() {
  const st = { name: '', r: 0, c: 0, msg: '' };
  const onOk = () => st.r === 3 && st.c >= 4;
  const draw = () => {
    drawStripes('#3a6ea0', '#4278ac');
    drawFrame(4, 4, 232, 50, 'white');
    ctx.drawImage(ART.people.player[0][0], 14, 8, 32, 42);
    drawText(ctx, st.msg || 'Your name?', 56, 11);
    for (let i = 0; i < NAME_MAX; i++) {
      const x = 58 + i * 10;
      const ch = st.name[i];
      if (ch) drawText(ctx, ch, x + Math.floor((5 - glyphWidth(ch)) / 2), 30);
      const blink = i === st.name.length && Math.floor(G.frame / 16) % 2 === 0;
      ctx.fillStyle = blink ? '#e04848' : '#a0a8b8';
      ctx.fillRect(x - 1, 41, 7, blink ? 2 : 1);
    }
    drawFrame(4, 58, 232, 98, 'white');
    NAME_ROWS.forEach((row, r) => [...row].forEach((ch, c) => {
      const x = 22 + c * 24, y = 68 + r * 18;
      drawText(ctx, ch, x, y);
      if (st.r === r && st.c === c) drawCursor(x - 9, y + 1);
    }));
    const y = 68 + 3 * 18;
    drawText(ctx, 'DEL', 22, y);
    drawText(ctx, 'OK', 22 + 6 * 24, y, '#3070c0', '#c0d8f0');
    if (st.r === 3) drawCursor(onOk() ? 22 + 6 * 24 - 9 : 13, y + 1);
    drawText(ctx, 'B: erase   START: finish', 22, 140, '#8890a0', '#e0e4ea');
  };

  return withScreen(draw, async () => {
    for (;;) {
      await nextFrame();
      const p = Input.pressed;
      if (p.up) { st.r = (st.r + 3) % 4; Sound.blip(); }
      if (p.down) { st.r = (st.r + 1) % 4; Sound.blip(); }
      if (p.left) { st.c = st.r === 3 ? (onOk() ? 0 : 6) : (st.c + 8) % 9; Sound.blip(); }
      if (p.right) { st.c = st.r === 3 ? (onOk() ? 0 : 6) : (st.c + 1) % 9; Sound.blip(); }
      if (p.start) { st.r = 3; st.c = 6; Sound.blip(); }
      if (p.b && st.name) { st.name = st.name.slice(0, -1); Sound.blip(); }
      if (!p.a) continue;
      if (st.r < 3) {
        if (st.name.length < NAME_MAX) { st.name += NAME_ROWS[st.r][st.c]; Sound.select(); }
        if (st.name.length >= NAME_MAX) { st.r = 3; st.c = 6; }
      } else if (!onOk()) {
        st.name = st.name.slice(0, -1); Sound.blip();
      } else if (!st.name.replace(/-/g, '')) {
        Sound.bump(); st.msg = 'Pick some letters first!';
      } else {
        Sound.select();
        return st.name;
      }
    }
  });
}

function buildMenuArt() {
  // the player's backpack, same yellow as the one on their back
  const p = new Pix(64, 64);
  const bag = '#f0c040', dk = '#c08a20', lt = '#f8e080', strap = '#a06030';
  p.rect(22, 4, 20, 5, strap).rect(22, 4, 4, 12, strap).rect(38, 4, 4, 12, strap);
  p.ellipse(32, 18, 20, 10, bag);
  p.rect(12, 18, 40, 38, bag);
  p.ellipse(32, 56, 20, 4, bag);
  p.ellipse(26, 20, 10, 5, lt, bag);
  p.poly([12, 18, 52, 18, 52, 30, 32, 36, 12, 30], dk);
  p.poly([13, 18, 51, 18, 51, 28, 32, 33, 13, 28], '#e0a830');
  p.rect(29, 30, 6, 6, strap).rect(30, 31, 4, 4, '#f8f0d0');
  p.rect(18, 40, 28, 14, dk).rect(19, 41, 26, 12, '#e0a830').rect(19, 41, 26, 2, lt);
  p.rect(12, 26, 2, 30, dk).rect(50, 26, 2, 30, dk);
  p.ellipse(32, 58, 18, 2.5, dk, bag);
  p.outline('#503010');
  ART.ui.bag = p.canvas();
}
