// battle.js â€” turn-based battles: moves, types, HP bars, EXP, and catching.
'use strict';

const B = {};
const STAT_NAMES = { atk: 'ATTACK', def: 'DEFENSE' };
const ENEMY_POS = { x: 176, y: 58 };   // centre of the enemy's platform
const MY_POS = { x: 64, y: 112 };      // centre of your platform

const bsay = (text, auto) => say(text, { style: 'dark', auto, keep: true });
// show a battle line instantly without waiting (used while something animates)
const bshow = text => { UI.box = { style: 'dark', lines: wrapText(text, 216).slice(0, 2), x: 0, w: W }; };
const AUTO = 34; // frames a battle message waits before moving on by itself

// ---------------------------------------------------------------- set up + run

async function runBattle(opts) {
  Object.assign(B, {
    wild: opts.wild || null,
    trainer: opts.trainer || null,
    enemyTeam: opts.wild ? [opts.wild] : opts.trainer.team,
    enemyIdx: 0,
    stages: { mine: { atk: 0, def: 0 }, enemy: { atk: 0, def: 0 } },
    // what's on screen
    slide: 1, showEnemy: false, showMine: false, showEnemyBox: false, showMyBox: false,
    showTrainer: !!opts.trainer, showPlayer: true, trainerX: 0, playerX: 0,
    scale: { enemy: 1, mine: 1 }, white: { enemy: 0, mine: 0 }, sink: { enemy: 0, mine: 0 },
    off: { enemy: 0, mine: 0 }, blink: { enemy: 0, mine: 0 },
    hpShown: { enemy: 0, mine: 0 }, expShown: 0,
    effects: [], shake: 0, cube: null, lastMenu: 0,
  });
  B.enemy = B.enemyTeam[0];
  B.mine = G.state.team.find(c => c.hp > 0);
  B.hpShown.enemy = B.enemy.hp;
  B.hpShown.mine = B.mine.hp;
  B.expShown = expFrac(B.mine);
  G.state.seen[B.enemy.species] = true;

  await battleTransition();
  G.scene = 'battle';
  UI.box = { style: 'dark', lines: [], x: 0, w: W };
  // platforms slide in
  for (let i = 0; i <= 40; i++) { B.slide = 1 - easeOut(i / 40); await nextFrame(); }
  if (B.wild) {
    B.showEnemy = true;
    await popIn('enemy');
    B.showEnemyBox = true;
    await bsay(`A wild ${critterName(B.enemy)} appeared!`);
  } else {
    await bsay(`${B.trainer.name} wants to battle!`);
    for (let i = 0; i <= 16; i++) { B.trainerX = i * 5; await nextFrame(); }
    B.showTrainer = false;
    await sendOutEnemy();
  }
  // the player slides away and throws out their critter
  for (let i = 0; i <= 16; i++) { B.playerX = -i * 6; await nextFrame(); }
  B.showPlayer = false;
  await sendOutMine(`Go! ${critterName(B.mine)}!`);

  const result = await battleLoop();

  UI.box = null;
  await fadeOut(20);
  G.scene = 'world';
  G.wipe = 0;
  B.effects = [];
  await fadeIn(16);
  return result;
}

async function sendOutEnemy() {
  B.enemy = B.enemyTeam[B.enemyIdx];
  B.stages.enemy = { atk: 0, def: 0 };
  B.hpShown.enemy = B.enemy.hp;
  G.state.seen[B.enemy.species] = true;
  B.sink.enemy = 0;
  bshow(`${B.trainer.name} sent out ${critterName(B.enemy)}!`);
  await wait(10);
  B.showEnemy = true;
  await popIn('enemy');
  B.showEnemyBox = true;
  await wait(24);
}

async function sendOutMine(text) {
  B.stages.mine = { atk: 0, def: 0 };
  B.hpShown.mine = B.mine.hp;
  B.expShown = expFrac(B.mine);
  B.sink.mine = 0;
  bshow(text);
  await wait(10);
  B.showMine = true;
  await popIn('mine');
  B.showMyBox = true;
  await wait(20);
}

// a critter bursts out of its cube: white flash, then grows to full size
async function popIn(side) {
  Sound.tone(300, 0.15, 'square', 0.05, 500);
  B.white[side] = 1;
  for (let i = 0; i <= 12; i++) { B.scale[side] = 0.2 + 0.8 * (i / 12); await nextFrame(); }
  for (let i = 0; i <= 8; i++) { B.white[side] = 1 - i / 8; await nextFrame(); }
  B.white[side] = 0;
}

async function popOut(side) {
  B.white[side] = 1;
  for (let i = 12; i >= 0; i--) { B.scale[side] = i / 12; await nextFrame(); }
  B.white[side] = 0;
}

const easeOut = t => 1 - (1 - t) * (1 - t);

async function battleTransition() {
  Sound.encounter();
  for (let i = 0; i < 3; i++) {
    Fade.color = '#ffffff'; Fade.amount = 0.85; await wait(4);
    Fade.amount = 0; await wait(4);
  }
  for (let i = 0; i <= 24; i++) { G.wipe = i / 24; await nextFrame(); }
  await wait(6);
  G.wipe = 0;
}

// ---------------------------------------------------------------- the turn loop

async function battleLoop() {
  for (;;) {
    const action = await chooseAction();
    if (action.kind === 'run') {
      Sound.tone(500, 0.2, 'square', 0.05, 300);
      await bsay('Got away safely!');
      return 'run';
    }
    const enemyMove = pickEnemyMove();

    if (action.kind === 'move') {
      const mineFirst = moveOrder(action.move, enemyMove);
      const first = mineFirst ? 'mine' : 'enemy';
      const second = mineFirst ? 'enemy' : 'mine';
      const moves = { mine: action.move, enemy: enemyMove };
      await attack(first, moves[first]);
      const r1 = await checkFaints();
      if (r1 === 'win' || r1 === 'lose') return r1;
      if (r1 === 'fainted') continue;   // someone fainted, so the turn ends here
      await attack(second, moves[second]);
      const r2 = await checkFaints();
      if (r2 === 'win' || r2 === 'lose') return r2;
      continue;
    }

    // items, cubes and switching all happen before the enemy moves
    if (action.kind === 'cube') {
      if (await throwCube()) return 'caught';
    } else if (action.kind === 'heal') {
      await useHeal(action.item, action.target, true);
    } else if (action.kind === 'switch') {
      await switchTo(action.target);
    }
    await attack('enemy', enemyMove);
    const r = await checkFaints();
    if (r === 'win' || r === 'lose') return r;
  }
}

function moveOrder(myMove, enemyMove) {
  const mp = myMove.priority || 0, ep = enemyMove.priority || 0;
  if (mp !== ep) return mp > ep;
  if (B.mine.spd !== B.enemy.spd) return B.mine.spd > B.enemy.spd;
  return Math.random() < 0.5;
}

async function chooseAction() {
  for (;;) {
    UI.box.lines = ['What will', `${critterName(B.mine)} do?`];
    UI.box.arrow = false;
    const pick = await choose(['FIGHT', 'BAG', 'TEAM', 'RUN'], { cols: 2, x: 120, y: 112, w: 120, h: 48, colW: 54, cancel: false, start: B.lastMenu || 0 });
    B.lastMenu = pick;
    if (pick === 0) {
      const mv = await chooseMove();
      if (mv) return { kind: 'move', move: mv };
    } else if (pick === 1) {
      const r = await bagScreen('battle');
      if (!r) continue;
      if (r.item === 'CUBE') {
        if (B.trainer) {
          await bsay("You can't catch another trainer's critter! That's not cool.");
          continue;
        }
        return { kind: 'cube' };
      }
      return { kind: 'heal', item: r.item, target: r.target };
    } else if (pick === 2) {
      const idx = await teamScreen('battle');
      if (idx >= 0) return { kind: 'switch', target: idx };
    } else if (pick === 3) {
      if (B.trainer) { await bsay("No way! You can't run from a trainer battle!"); continue; }
      return { kind: 'run' };
    }
  }
}

async function chooseMove() {
  const c = B.mine;
  if (c.moves.every(m => m.pp <= 0)) {
    await bsay(`${critterName(c)} has no moves left!`);
    return { name: 'STRUGGLE', type: 'NORMAL', power: 35, acc: 100 };
  }
  const names = [0, 1, 2, 3].map(i => c.moves[i] ? MOVES[c.moves[i].id].name : '-');
  UI.box.lines = [];
  for (;;) {
    let cur = 0;
    const panel = () => {
      drawFrame(160, 112, 80, 48, 'white');
      const m = c.moves[cur];
      if (!m) return;
      const mv = MOVES[m.id];
      drawText(ctx, 'PP', 170, 121);
      const pp = `${m.pp}/${mv.pp}`;
      drawText(ctx, pp, 230 - textWidth(pp), 121, m.pp === 0 ? '#e04848' : TEXT_DARK);
      drawTypeBadge(mv.type, 170, 137);
    };
    UI.extras.push(panel);
    const i = await choose(names, { cols: 2, x: 0, y: 112, w: 160, h: 48, colW: 74, onMove: n => { cur = n; } });
    UI.extras.splice(UI.extras.indexOf(panel), 1);
    if (i < 0) return null;
    const m = c.moves[i];
    if (!m) continue;
    if (m.pp <= 0) { await bsay("There's no PP left for that move!"); UI.box.lines = []; continue; }
    m.pp--;
    return MOVES[m.id];
  }
}

function drawTypeBadge(type, x, y) {
  const w = textWidth(type) + 8;
  ctx.fillStyle = shade(TYPES[type].color, -0.4); ctx.fillRect(x, y - 1, w, 11);
  ctx.fillStyle = TYPES[type].color; ctx.fillRect(x + 1, y, w - 2, 9);
  drawText(ctx, type, x + 4, y, '#f8f8f8', shade(TYPES[type].color, -0.45));
  return w;
}

function pickEnemyMove() {
  const e = B.enemy, foe = B.mine;
  const usable = e.moves.filter(m => m.pp > 0);
  if (!usable.length) return { name: 'STRUGGLE', type: 'NORMAL', power: 35, acc: 100 };
  const table = usable.map(m => {
    const mv = MOVES[m.id];
    let w;
    if (mv.power === 0) {
      const stage = mv.self ? B.stages.enemy[mv.stat] : B.stages.mine[mv.stat];
      w = (mv.by > 0 ? stage >= 6 : stage <= -6) ? 0 : 1.2;
    } else {
      w = 2 * typeEffect(mv.type, SPECIES[foe.species].type) * (mv.type === SPECIES[e.species].type ? 1.3 : 1);
    }
    return [m, w];
  });
  if (table.every(([, w]) => w === 0)) table.forEach(t => { t[1] = 1; });
  const m = pickWeighted(table);
  m.pp--;
  return MOVES[m.id];
}

// ---------------------------------------------------------------- attacking

function sideName(side, c) {
  if (side === 'mine') return critterName(c);
  return (B.wild ? 'Wild ' : 'Foe ') + critterName(c);
}

const stageMult = s => s >= 0 ? (2 + s) / 2 : 2 / (2 - s);

async function attack(side, move) {
  const foeSide = side === 'mine' ? 'enemy' : 'mine';
  const user = side === 'mine' ? B.mine : B.enemy;
  const target = side === 'mine' ? B.enemy : B.mine;
  if (user.hp <= 0) return;
  await bsay(`${sideName(side, user)} used ${move.name}!`, 10);

  if (Math.random() * 100 >= move.acc) {
    await lunge(side);
    await bsay(`${sideName(side, user)}'s attack missed!`, AUTO);
    return;
  }

  if (move.power === 0) {
    const who = move.self ? side : foeSide;
    const whoC = move.self ? user : target;
    const st = B.stages[who];
    const before = st[move.stat];
    st[move.stat] = Math.max(-6, Math.min(6, before + move.by));
    if (st[move.stat] === before) {
      await bsay(`${sideName(who, whoC)}'s ${STAT_NAMES[move.stat]} won't go any ${move.by > 0 ? 'higher' : 'lower'}!`, AUTO);
      return;
    }
    await statAnim(who, move.by > 0);
    await bsay(`${sideName(who, whoC)}'s ${STAT_NAMES[move.stat]} ${move.by > 0 ? 'rose' : 'fell'}!`, AUTO);
    return;
  }

  // the damage formula from the GBA games, simplified a little
  const atkStat = user.atk * stageMult(B.stages[side].atk);
  const defStat = target.def * stageMult(B.stages[foeSide].def);
  const eff = typeEffect(move.type, SPECIES[target.species].type);
  const stab = move.type === SPECIES[user.species].type ? 1.5 : 1;
  const crit = Math.random() < 1 / 16;
  let dmg = Math.floor(Math.floor(Math.floor(2 * user.level / 5 + 2) * move.power * atkStat / defStat) / 50) + 2;
  dmg = Math.floor(dmg * stab * eff * (crit ? 1.5 : 1) * (0.85 + Math.random() * 0.15));
  dmg = Math.max(1, dmg);

  await lunge(side);
  await hitEffect(foeSide, move.type, eff > 1);
  target.hp = Math.max(0, target.hp - dmg);
  await drainHp(foeSide, target);
  if (crit) await bsay('A critical hit!', AUTO);
  if (eff > 1) await bsay("It's super effective!", AUTO);
  else if (eff < 1) await bsay("It's not very effective...", AUTO);
}

async function lunge(side) {
  const dir = side === 'mine' ? 1 : -1;
  for (const o of [3, 6, 8, 6, 3, 0]) { B.off[side] = o * dir; await nextFrame(); }
}

async function hitEffect(side, type, strong) {
  const c = side === 'enemy' ? ENEMY_POS : MY_POS;
  const color = TYPES[type].color;
  // a white impact flash in the middle, then sparks in the move's type colour
  for (let i = 0; i < 6; i++) {
    const a = Math.random() * Math.PI * 2;
    B.effects.push({ x: c.x - 1, y: c.y - 22, vx: Math.cos(a) * 3, vy: Math.sin(a) * 3, life: 7, color: '#ffffff', size: 3 });
  }
  for (let i = 0; i < 14; i++) {
    const a = Math.random() * Math.PI * 2, sp = 1 + Math.random() * 2.2;
    B.effects.push({ x: c.x, y: c.y - 22, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: 18 + rand(0, 8), color, size: rand(2, 4) });
  }
  Sound.hit(strong);
  if (strong) B.shake = 10;
  B.blink[side] = 16;
  await wait(18);
}

async function statAnim(side, up) {
  const c = side === 'enemy' ? ENEMY_POS : MY_POS;
  Sound.tone(up ? 400 : 700, 0.3, 'triangle', 0.07, up ? 400 : -400);
  for (let i = 0; i < 16; i++) {
    B.effects.push({ x: c.x - 18 + Math.random() * 36, y: c.y - (up ? 4 : 44) + Math.random() * 8, vx: 0, vy: up ? -1.4 : 1.4,
      life: 26, color: up ? '#f89848' : '#5878f0', size: 2, arrow: up ? -1 : 1, delay: rand(0, 10) });
  }
  await wait(34);
}

async function drainHp(side, c) {
  const from = B.hpShown[side], to = c.hp;
  const frames = Math.min(40, Math.max(10, Math.abs(from - to)));
  for (let i = 1; i <= frames; i++) { B.hpShown[side] = from + (to - from) * (i / frames); await nextFrame(); }
  B.hpShown[side] = to;
}

// returns 'win' / 'lose' if the battle is over, 'fainted' if a new critter
// came out (which ends the turn), or null if nothing happened
async function checkFaints() {
  let result = null;
  if (B.enemy.hp <= 0) {
    result = 'fainted';
    await faint('enemy');
    await gainExp(B.enemy);
    if (B.trainer && B.enemyTeam.some(c => c.hp > 0)) {
      B.enemyIdx = B.enemyTeam.findIndex(c => c.hp > 0);
      await sendOutEnemy();
    } else {
      if (B.trainer) await trainerDefeated();
      return 'win';
    }
  }
  if (B.mine.hp <= 0) {
    result = 'fainted';
    await faint('mine');
    if (!G.state.team.some(c => c.hp > 0)) return 'lose';
    UI.box.lines = [];
    const idx = await teamScreen('forced');
    await switchTo(idx, true);
  }
  return result;
}

async function faint(side) {
  const c = side === 'enemy' ? B.enemy : B.mine;
  Sound.faint();
  for (let i = 0; i <= 20; i++) { B.sink[side] = i / 20; await nextFrame(); }
  if (side === 'enemy') { B.showEnemy = false; B.showEnemyBox = false; }
  else { B.showMine = false; B.showMyBox = false; }
  await bsay(`${sideName(side, c)} fainted!`);
}

async function trainerDefeated() {
  B.showTrainer = true;
  for (let i = 16; i >= 0; i--) { B.trainerX = i * 5; await nextFrame(); }
  Sound.levelUp();
  await bsay(`${G.state.name} defeated ${B.trainer.name}!`);
  await bsay(B.trainer.lose);
}

async function switchTo(idx, forced) {
  if (!forced) {
    bshow(`${critterName(B.mine)}, come back!`);
    await wait(16);
    await popOut('mine');
    B.showMine = false; B.showMyBox = false;
  }
  B.mine = G.state.team[idx];
  await sendOutMine(`Go! ${critterName(B.mine)}!`);
}

// ---------------------------------------------------------------- EXP + levelling up

function expFrac(c) {
  const lo = expForLevel(c.level), hi = expForLevel(c.level + 1);
  return Math.max(0, Math.min(1, (c.exp - lo) / (hi - lo)));
}

async function gainExp(enemy) {
  const c = B.mine;
  if (c.hp <= 0) return;
  const amount = Math.max(1, Math.floor(SPECIES[enemy.species].exp * enemy.level / 7 * (B.trainer ? 1.5 : 1)));
  await bsay(`${critterName(c)} gained ${amount} EXP. Points!`, AUTO);
  c.exp += amount;
  for (;;) {
    const target = c.exp >= expForLevel(c.level + 1) ? 1 : expFrac(c);
    const from = B.expShown;
    Sound.tone(900, 0.25, 'triangle', 0.04, 300);
    for (let i = 1; i <= 24; i++) { B.expShown = from + (target - from) * (i / 24); await nextFrame(); }
    if (target < 1) break;
    // level up!
    c.level++;
    const oldMax = c.maxHp;
    calcStats(c);
    c.hp += c.maxHp - oldMax;
    B.hpShown.mine = c.hp;
    B.expShown = 0;
    Sound.levelUp();
    await bsay(`${critterName(c)} grew to Lv. ${c.level}!`);
    for (const [lv, moveId] of SPECIES[c.species].learn) {
      if (lv !== c.level) continue;
      const forgot = teach(c, moveId);
      if (forgot) await bsay(`${critterName(c)} forgot ${MOVES[forgot].name}...`, AUTO);
      Sound.levelUp();
      await bsay(`${critterName(c)} learned ${MOVES[moveId].name}!`);
    }
  }
}

// ---------------------------------------------------------------- items + catching

async function useHeal(itemId, idx, inBattle) {
  const c = G.state.team[idx];
  const item = ITEMS[itemId];
  G.state.bag[itemId]--;
  const before = c.hp;
  c.hp = Math.min(c.maxHp, c.hp + item.heal);
  Sound.heal();
  if (inBattle) {
    await bsay(`${G.state.name} used a ${item.name}!`, 10);
    if (c === B.mine) await drainHp('mine', c);
    await bsay(`${critterName(c)} got back ${c.hp - before} HP!`, AUTO);
  }
}

async function throwCube() {
  G.state.bag.CUBE--;
  bshow(`${G.state.name} threw a CAPTURE CUBE!`);
  // the cube flies in an arc from your side to the enemy
  const sx = 40, sy = 96, ex = ENEMY_POS.x, ey = ENEMY_POS.y - 26;
  for (let i = 0; i <= 26; i++) {
    const t = i / 26;
    B.cube = { x: sx + (ex - sx) * t, y: sy + (ey - sy) * t - Math.sin(t * Math.PI) * 50, tilt: 0 };
    await nextFrame();
  }
  // the critter gets sucked in
  await popOut('enemy');
  B.showEnemy = false;
  // drop to the ground with a little bounce
  for (const dy of [2, 5, 9, 14, 20, 24, 22, 21, 22, 24]) { B.cube.y = ey + dy; await nextFrame(); }

  const e = B.enemy;
  const a = Math.min(255, ((3 * e.maxHp - 2 * e.hp) * SPECIES[e.species].catchRate * 1.25) / (3 * e.maxHp));
  const b = 1048560 / Math.sqrt(Math.sqrt(16711680 / Math.max(1, a)));
  let passes = 0;
  for (let i = 0; i < 4; i++) { if (a >= 255 || Math.random() * 65536 < b) passes++; else break; }
  const caught = passes === 4;

  await wait(20);
  for (let s = 0; s < Math.min(3, passes); s++) {
    Sound.wiggle();
    for (const t of [-2, -3, -2, 0, 2, 3, 2, 0]) { B.cube.tilt = t; await wait(2); }
    await wait(24);
  }

  if (caught) {
    Sound.caught();
    for (let i = 0; i < 10; i++) B.effects.push({ x: B.cube.x, y: B.cube.y, vx: (Math.random() - 0.5) * 3, vy: -1 - Math.random() * 2, life: 30, color: '#f8d040', size: 2, star: true });
    B.showEnemyBox = false;
    await bsay(`Gotcha! ${critterName(e)} was caught!`);
    G.state.caught[e.species] = true;
    B.stages.enemy = { atk: 0, def: 0 };
    if (G.state.team.length < 6) G.state.team.push(e);
    else { G.state.box.push(e); await bsay(`Your team is full, so ${critterName(e)} was sent to the BOX.`); }
    B.cube = null;
    return true;
  }

  B.cube = null;
  B.showEnemy = true;
  await popIn('enemy');
  const lines = ['Oh no! The critter broke free!', 'Aww! It appeared to be caught!', 'Aargh! Almost had it!', 'Shoot! It was so close, too!'];
  await bsay(lines[Math.min(3, passes)]);
  return false;
}

// ---------------------------------------------------------------- drawing

const BG = {};
function buildBattleArt() {
  const plat = (w, h) => {
    const p = new Pix(w, h);
    p.ellipse(w / 2, h / 2, w / 2 - 1, h / 2 - 1, '#88c060');
    p.ellipse(w / 2, h / 2 - 1, w / 2 - 4, h / 2 - 3, '#a8d880');
    p.ellipse(w / 2 - 6, h / 2 - 2, w / 2 - 18, h / 2 - 6, '#c0e8a0');
    p.outline('#58904a');
    return p.canvas();
  };
  BG.enemyPlat = plat(112, 24);
  BG.myPlat = plat(132, 28);
  const whiteCache = new Map();
  BG.white = img => {
    if (whiteCache.has(img)) return whiteCache.get(img);
    const cv = document.createElement('canvas'); cv.width = img.width; cv.height = img.height;
    const c = cv.getContext('2d');
    c.drawImage(img, 0, 0); c.globalCompositeOperation = 'source-atop'; c.fillStyle = '#ffffff'; c.fillRect(0, 0, cv.width, cv.height);
    whiteCache.set(img, cv);
    return cv;
  };
}

function drawCritterSprite(img, side, cx, bottom) {
  const s = B.scale[side];
  const w = Math.round(48 * s), h = Math.round(48 * s);
  if (w <= 0) return;
  const x = Math.round(cx - w / 2 + B.off[side]);
  const sink = Math.round(B.sink[side] * 48);
  const y = Math.round(bottom - h + sink);
  if (B.blink[side] > 0 && Math.floor(B.blink[side] / 2) % 2 === 0) return;
  if (sink >= 48) return;
  // when fainting, the critter slides down out of view
  const visibleH = h - sink;
  ctx.drawImage(img, 0, 0, 48, 48 * (visibleH / h), x, y, w, visibleH);
  if (B.white[side] > 0) {
    ctx.globalAlpha = B.white[side];
    ctx.drawImage(BG.white(img), 0, 0, 48, 48 * (visibleH / h), x, y, w, visibleH);
    ctx.globalAlpha = 1;
  }
}

function hpColor(frac) { return frac > 0.5 ? ['#58d080', '#90f0b0'] : frac > 0.2 ? ['#f0c030', '#f8e078'] : ['#f05050', '#f89090']; }

function drawHpBar(x, y, hp, max) {
  const frac = Math.max(0, hp / max);
  drawText(ctx, 'HP', x - 15, y - 3, '#f09030', '#f8d8a0');
  ctx.fillStyle = '#404850'; ctx.fillRect(x - 1, y - 1, 52, 6);
  ctx.fillStyle = '#e8e8e0'; ctx.fillRect(x, y, 50, 4);
  const [c1, c2] = hpColor(frac);
  const w = Math.ceil(50 * frac);
  ctx.fillStyle = c1; ctx.fillRect(x, y, w, 4);
  ctx.fillStyle = c2; ctx.fillRect(x, y, w, 1);
}

function drawBattle() {
  const sx = B.shake > 0 ? (B.shake % 2 ? 2 : -2) : 0;
  if (B.shake > 0) B.shake--;
  ctx.save();
  ctx.translate(sx, 0);
  // sky, hills, field
  ctx.fillStyle = '#f4f8e4'; ctx.fillRect(-4, 0, W + 8, 112);
  ctx.fillStyle = '#d8eec4';
  for (let x = -4; x < W + 8; x += 2) ctx.fillRect(x, 44 + Math.round(Math.sin(x / 19) * 4 + Math.sin(x / 7) * 1.5), 2, 30);
  ctx.fillStyle = '#e6f4d4'; ctx.fillRect(-4, 58, W + 8, 54);
  ctx.fillStyle = '#d8ecc4';
  for (let y = 62; y < 112; y += 8) ctx.fillRect(-4, y, W + 8, 1);

  const slideE = Math.round(-B.slide * 240), slideM = Math.round(B.slide * 240);
  ctx.drawImage(BG.enemyPlat, ENEMY_POS.x - 56 + slideE, ENEMY_POS.y - 12);
  ctx.drawImage(BG.myPlat, MY_POS.x - 66 + slideM, MY_POS.y - 14);

  // trainers (drawn double size, like the big GBA trainer pictures)
  if (B.showTrainer && B.trainer) {
    const img = ART.people[B.trainer.look][0][0];
    ctx.drawImage(img, ENEMY_POS.x - 16 + slideE + B.trainerX, ENEMY_POS.y - 40, 32, 42);
  }
  if (B.showPlayer) {
    const img = ART.people.player[1][0];
    ctx.drawImage(img, MY_POS.x - 16 + slideM + B.playerX, MY_POS.y - 40, 32, 42);
  }

  if (B.showEnemy) drawCritterSprite(ART.critters[B.enemy.species].front, 'enemy', ENEMY_POS.x + slideE, ENEMY_POS.y + 4);
  if (B.showMine) drawCritterSprite(ART.critters[B.mine.species].back, 'mine', MY_POS.x, MY_POS.y + 2);
  for (const s of ['enemy', 'mine']) if (B.blink[s] > 0) B.blink[s]--;

  if (B.cube) {
    ctx.save();
    ctx.translate(Math.round(B.cube.x), Math.round(B.cube.y));
    ctx.drawImage(ART.props.cube, -6 + B.cube.tilt, -6);
    ctx.restore();
  }

  // particles
  B.effects = B.effects.filter(e => e.life > 0);
  for (const e of B.effects) {
    if (e.delay > 0) { e.delay--; continue; }
    e.x += e.vx; e.y += e.vy; e.life--;
    if (e.star) e.vy += 0.08;
    ctx.fillStyle = e.color;
    if (e.arrow) {
      const x = Math.round(e.x), y = Math.round(e.y);
      ctx.fillRect(x, y, 1, 5);
      ctx.fillRect(x - 1, y + (e.arrow < 0 ? 1 : 3), 3, 1);
      ctx.fillRect(x - 2, y + (e.arrow < 0 ? 2 : 2), 5, 1);
    } else {
      ctx.fillRect(Math.round(e.x), Math.round(e.y), e.size, e.size);
    }
  }
  ctx.restore();

  // enemy info box
  if (B.showEnemyBox) {
    const e = B.enemy;
    drawFrame(6, 8, 108, 32, 'info');
    drawText(ctx, critterName(e), 14, 13);
    const lv = 'Lv' + e.level;
    drawText(ctx, lv, 106 - textWidth(lv), 13);
    if (G.state.caught[e.species] && B.wild) ctx.drawImage(ART.props.cube, 14 + textWidth(critterName(e)) + 3, 12, 8, 8);
    drawHpBar(54, 28, B.hpShown.enemy, e.maxHp);
  }
  // your info box
  if (B.showMyBox) {
    const c = B.mine;
    drawFrame(126, 64, 112, 48, 'info');
    drawText(ctx, critterName(c), 134, 69);
    const lv = 'Lv' + c.level;
    drawText(ctx, lv, 230 - textWidth(lv), 69);
    drawHpBar(178, 84, B.hpShown.mine, c.maxHp);
    const hpTxt = `${Math.ceil(B.hpShown.mine)}/${c.maxHp}`;
    drawText(ctx, hpTxt, 229 - textWidth(hpTxt), 90);
    drawText(ctx, 'EXP', 134, 98, '#5878c8', '#c8d8f8');
    ctx.fillStyle = '#404850'; ctx.fillRect(155, 101, 76, 4);
    ctx.fillStyle = '#e8e8e0'; ctx.fillRect(156, 102, 74, 2);
    ctx.fillStyle = '#58a8f8'; ctx.fillRect(156, 102, Math.round(74 * B.expShown), 2);
  }
}
