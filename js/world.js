// world.js — walking around: the map, the camera, people, signs, items,
// trainers who spot you, and wild critters jumping out of the tall grass.
'use strict';

const DIRS = [[0, 1], [0, -1], [-1, 0], [1, 0]]; // down, up, left, right
const OPPOSITE = [1, 0, 3, 2];

const World = {
  map: null,
  player: { x: 0, y: 0, dir: 0, moving: false, prog: 0, speed: 1, step: 0, look: 'player' },
  npcs: [],
  busy: false,        // a script is running, so the player can't walk
  turnDelay: 0,
  walkedLast: false,
  bumpCooldown: 0,
  banner: null,       // the map-name sign that slides in
  bubble: null,       // the "!" over a trainer
};

// ---------------------------------------------------------------- map queries

function tileAt(x, y) {
  const m = World.map;
  if (x < 0 || y < 0 || x >= m.w || y >= m.h) return 'T';
  return m.rows[y][x];
}
const SOLID_TILES = new Set(['T', '~', '#']);

function propAt(x, y) {
  for (const p of World.map.props) {
    if (p.kind === 'item' && G.state.flags[p.flag]) continue;
    const w = p.w || 1, h = p.h || 1;
    if (x >= p.x && x < p.x + w && y >= p.y && y < p.y + h) return p;
  }
  return null;
}
function npcAt(x, y) { return World.npcs.find(n => n.x === x && n.y === y) || null; }

function blocked(x, y) {
  if (SOLID_TILES.has(tileAt(x, y))) return true;
  if (propAt(x, y)) return true;
  if (npcAt(x, y)) return true;
  const p = World.player;
  if (p.x === x && p.y === y) return true;
  return false;
}

// ---------------------------------------------------------------- loading maps

function loadMap(id, x, y, dir) {
  const m = MAPS[id];
  World.map = m;
  World.npcs = m.npcs.map(n => ({ ...n, homeX: n.x, homeY: n.y, moving: false, prog: 0, speed: 1, step: 0, wanderT: rand(60, 200) }));
  Object.assign(World.player, { x, y, dir, moving: false, prog: 0 });
}

async function changeMap(id, x, y, dir) {
  World.busy = true;
  await fadeOut(10);
  loadMap(id, x, y, dir);
  saveGame();
  await fadeIn(10);
  showBanner(World.map.name);
  World.busy = false;
}

function showBanner(text) { World.banner = { text, t: 0 }; }

// ---------------------------------------------------------------- moving things (player + npcs)

function startMove(m, dir, speed) {
  const [dx, dy] = DIRS[dir];
  m.dir = dir;
  m.x += dx; m.y += dy;
  m.moving = true; m.prog = 0; m.speed = speed;
  m.step ^= 1;
}

// returns true on the frame a step finishes
function updateMover(m) {
  if (!m.moving) return false;
  m.prog += m.speed;
  if (m.prog >= 16) { m.moving = false; m.prog = 0; return true; }
  return false;
}

// where to draw a mover, in world pixels
function moverPixel(m) {
  let px = m.x * T, py = m.y * T;
  if (m.moving) {
    const [dx, dy] = DIRS[m.dir];
    px -= dx * (16 - m.prog); py -= dy * (16 - m.prog);
  }
  return { x: px, y: py };
}
function moverFrame(m) {
  if (!m.moving) return 0;
  return m.prog < 8 ? (m.step ? 1 : 2) : 0;
}

// walk an npc (or the player) one tile and wait for it to arrive
async function walk(m, dir, speed = 1) {
  startMove(m, dir, speed);
  while (m.moving) await nextFrame();
}

// ---------------------------------------------------------------- per-frame update

function updateWorld() {
  const p = World.player;
  if (World.banner) { World.banner.t++; if (World.banner.t > 150) World.banner = null; }
  if (World.bumpCooldown > 0) World.bumpCooldown--;

  // npcs wander a little when nothing's happening
  for (const n of World.npcs) {
    if (updateMover(n)) continue;
    if (!n.wander || n.moving || World.busy) continue;
    if (--n.wanderT > 0) continue;
    n.wanderT = rand(90, 240);
    const d = rand(0, 3);
    const [dx, dy] = DIRS[d];
    const tx = n.x + dx, ty = n.y + dy;
    n.dir = d;
    if (Math.abs(tx - n.homeX) <= 2 && Math.abs(ty - n.homeY) <= 2 && !blocked(tx, ty) && tileAt(tx, ty) !== '"') startMove(n, d, 1);
  }

  if (p.moving) {
    if (updateMover(p)) onStep();
    return;
  }
  if (World.busy) return;

  if (Input.pressed.start) { runScript(startMenu); return; }
  if (Input.pressed.a) { interact(); return; }

  const d = Input.dir();
  if (d < 0) { World.walkedLast = false; World.turnDelay = 0; return; }
  if (d !== p.dir && !World.walkedLast) {
    // a quick tap just turns you around, like in the real games
    p.dir = d;
    World.turnDelay = 6;
    return;
  }
  if (World.turnDelay > 0) { World.turnDelay--; return; }
  tryMove(d);
}

function tryMove(d) {
  const p = World.player;
  const [dx, dy] = DIRS[d];
  const tx = p.x + dx, ty = p.y + dy;
  p.dir = d;
  const m = World.map;
  // walking off the edge of the map onto the next one
  if (tx < 0 || ty < 0 || tx >= m.w || ty >= m.h) {
    const edge = ty < 0 ? 'north' : ty >= m.h ? 'south' : tx < 0 ? 'west' : 'east';
    const exit = m.exits && m.exits[edge];
    if (exit) {
      const to = MAPS[exit.to];
      const nx = edge === 'north' || edge === 'south' ? tx + exit.dx : (edge === 'west' ? to.w - 1 : 0);
      const ny = edge === 'north' ? to.h - 1 : edge === 'south' ? 0 : ty + exit.dx;
      runScript(() => changeMap(exit.to, nx, ny, d));
      return;
    }
  }
  if (blocked(tx, ty)) {
    if (World.bumpCooldown === 0) { Sound.bump(); World.bumpCooldown = 18; }
    World.walkedLast = false;
    return;
  }
  startMove(p, d, Input.held.b ? 2 : 1);
  World.walkedLast = true;
}

function onStep() {
  const p = World.player;
  G.state.steps = (G.state.steps || 0) + 1;
  const m = World.map;
  const trig = (m.triggers || []).find(t => t.x === p.x && t.y === p.y);
  if (trig) { runScript(SCRIPTS[trig.script]); return; }
  for (const n of World.npcs) {
    if (n.trainer && !G.state.flags[n.trainer.flag] && trainerSees(n)) { runScript(() => trainerSpots(n)); return; }
  }
  if (tileAt(p.x, p.y) === '"' && m.encounters && hasHealthyCritter() && Math.random() < 0.11) {
    runScript(wildEncounter);
    return;
  }
  // keep walking if the button's still held
  World.walkedLast = Input.dir() >= 0;
}

function hasHealthyCritter() { return G.state.team.some(c => c.hp > 0); }

// ---------------------------------------------------------------- scripts

async function runScript(fn) {
  if (World.busy) return;
  World.busy = true;
  try { await fn(); }
  catch (e) { console.error(e); }
  World.busy = false;
  World.walkedLast = false;
}

function facingTile() {
  const p = World.player;
  const [dx, dy] = DIRS[p.dir];
  return [p.x + dx, p.y + dy];
}

function interact() {
  const [fx, fy] = facingTile();
  const npc = npcAt(fx, fy);
  if (npc && !npc.moving) { runScript(() => talkTo(npc)); return; }
  const prop = propAt(fx, fy);
  if (prop) { runScript(() => useProp(prop)); return; }
  if (tileAt(fx, fy) === '~') runScript(() => say('The water is clear and cool. Something is splashing in there...'));
}

async function talkTo(npc) {
  npc.dir = OPPOSITE[World.player.dir];
  if (npc.trainer) {
    if (!G.state.flags[npc.trainer.flag]) { await trainerBattle(npc); return; }
    await say(npc.trainer.after);
    return;
  }
  if (npc.script) { await SCRIPTS[npc.script](npc); return; }
  await say(npc.text);
}

async function useProp(prop) {
  if (prop.kind === 'sign' || prop.kind === 'building') { await say(prop.text.replaceAll('{NAME}', G.state.name)); return; }
  if (prop.kind === 'item') {
    G.state.flags[prop.flag] = true;
    addItem(prop.item, prop.count);
    Sound.caught();
    const name = ITEMS[prop.item].name;
    await say(`${G.state.name} found ${prop.count > 1 ? prop.count + ' ' + name + 'S' : 'a ' + name}!`);
    await say(`${G.state.name} put it in the BAG.`);
  }
}

function addItem(id, n) { G.state.bag[id] = (G.state.bag[id] || 0) + n; }

// ---------------------------------------------------------------- trainers

function trainerSees(n) {
  const p = World.player;
  const [dx, dy] = DIRS[n.dir];
  for (let i = 1; i <= n.trainer.sight; i++) {
    const x = n.x + dx * i, y = n.y + dy * i;
    if (x === p.x && y === p.y) return true;
    if (SOLID_TILES.has(tileAt(x, y)) || propAt(x, y) || npcAt(x, y)) return false;
  }
  return false;
}

async function trainerSpots(n) {
  Sound.encounter();
  World.bubble = n;
  await wait(40);
  World.bubble = null;
  // walk up until standing next to the player
  const p = World.player;
  for (;;) {
    const [dx, dy] = DIRS[n.dir];
    if (n.x + dx === p.x && n.y + dy === p.y) break;
    await walk(n, n.dir);
  }
  p.dir = OPPOSITE[n.dir];
  await trainerBattle(n);
}

async function trainerBattle(n) {
  const t = n.trainer;
  if (!hasHealthyCritter()) { await say(t.intro.split('\n')[0]); await say("...Oh, your critters are all tired out. Go rest up first!"); return; }
  await say(t.intro);
  const team = t.team.map(([s, l]) => makeCritter(s, l));
  const result = await runBattle({ trainer: { name: t.name, look: n.look, team, lose: t.lose } });
  if (result === 'win') {
    G.state.flags[t.flag] = true;
    saveGame();
  } else if (result === 'lose') {
    await blackout();
  }
}

// ---------------------------------------------------------------- wild critters

async function wildEncounter() {
  const enc = World.map.encounters;
  const species = pickWeighted(enc.table);
  const level = rand(enc.levels[0], enc.levels[1]);
  const wild = makeCritter(species, level);
  G.state.seen[species] = true;
  const result = await runBattle({ wild });
  if (result === 'lose') await blackout();
  else saveGame();
}

async function blackout() {
  await say(`${G.state.name} is out of usable critters!`);
  await say(`${G.state.name} hurried home to MOM...`);
  await fadeOut(30);
  loadMap('mossvale', 4, 8, 2);
  G.state.team.forEach(healCritter);
  saveGame();
  await fadeIn(30);
  await say(`MOM: Oh, ${G.state.name}! Your critters look so tired.`);
  Sound.heal();
  await say("There! Good as new. Don't push yourself too hard, okay? ♥");
}

// ---------------------------------------------------------------- drawing

function grassVariant(x, y) {
  const h = ((x * 73856093) ^ (y * 19349663)) >>> 0;
  const v = h % 10;
  return v < 6 ? 0 : v < 8 ? 1 : v < 9 ? 2 : 3;
}

function edgeMask(x, y, ch) {
  const same = (xx, yy) => {
    const m = World.map;
    if (xx < 0 || yy < 0 || xx >= m.w || yy >= m.h) return true;
    return m.rows[yy][xx] === ch;
  };
  return (same(x, y - 1) ? 0 : 1) | (same(x + 1, y) ? 0 : 2) | (same(x, y + 1) ? 0 : 4) | (same(x - 1, y) ? 0 : 8);
}

function drawWorld() {
  const m = World.map, p = World.player, pp = moverPixel(p);
  const camX = Math.round(Math.max(0, Math.min(m.w * T - W, pp.x + 8 - W / 2)));
  const camY = Math.round(Math.max(0, Math.min(m.h * T - H, pp.y + 8 - H / 2)));
  const t0x = Math.floor(camX / T), t0y = Math.floor(camY / T);
  const anim = Math.floor(G.frame / 32) % 2;
  const tiles = ART.tiles;

  // ground
  for (let ty = t0y; ty <= t0y + 11; ty++)
    for (let tx = t0x; tx <= t0x + 15; tx++) {
      if (tx >= m.w || ty >= m.h) continue;
      const ch = m.rows[ty][tx];
      const sx = tx * T - camX, sy = ty * T - camY;
      let img;
      switch (ch) {
        case '"': img = tiles.tall; break;
        case '=': img = tiles.path[edgeMask(tx, ty, '=')]; break;
        case '~': img = tiles.water[anim][edgeMask(tx, ty, '~')]; break;
        case 'f': img = tiles.flower[anim]; break;
        case '#': img = tiles.fence; break;
        default: img = tiles.grass[grassVariant(tx, ty)];
      }
      ctx.drawImage(img, sx, sy);
    }

  // everything that stands up gets sorted by how far down the screen it is
  const sprites = [];
  for (let ty = t0y; ty <= t0y + 12; ty++)
    for (let tx = t0x - 1; tx <= t0x + 16; tx++) {
      if (tx < 0 || ty < 0 || tx >= m.w || ty >= m.h) continue;
      if (m.rows[ty][tx] === 'T') sprites.push({ y: ty * T + 16, img: tiles.tree, x: tx * T, dy: ty * T - 8 });
    }
  for (const pr of m.props) {
    if (pr.kind === 'item' && G.state.flags[pr.flag]) continue;
    if (pr.kind === 'building') {
      const img = ART.props[pr.art];
      sprites.push({ y: (pr.y + pr.h) * T, img, x: pr.x * T, dy: (pr.y + pr.h) * T - img.height });
    } else if (pr.kind === 'sign') {
      sprites.push({ y: pr.y * T + 16, img: ART.props.sign, x: pr.x * T, dy: pr.y * T });
    } else if (pr.kind === 'item') {
      const bob = Math.floor(G.frame / 20) % 2;
      sprites.push({ y: pr.y * T + 16, img: ART.props.cube, x: pr.x * T + 2, dy: pr.y * T + 2 + bob });
    }
  }
  const people = [...World.npcs, p];
  for (const n of people) {
    const np = moverPixel(n);
    const look = n === p ? 'player' : n.look;
    sprites.push({ y: np.y + 16, img: ART.people[look][n.dir][moverFrame(n)], x: np.x, dy: np.y - 5, mover: n });
  }
  sprites.sort((a, b) => a.y - b.y);
  for (const s of sprites) {
    if (s.x - camX < -64 || s.x - camX > W + 16) continue;
    ctx.drawImage(s.img, s.x - camX, s.dy - camY);
    // wading through tall grass
    if (s.mover && tileAt(s.mover.x, s.mover.y) === '"' && (!s.mover.moving || s.mover.prog > 6)) {
      ctx.drawImage(tiles.tallOver, s.mover.x * T - camX, s.mover.y * T - camY);
    }
  }

  if (World.bubble) {
    const bp = moverPixel(World.bubble);
    ctx.drawImage(ART.ui.bubble, bp.x + 3 - camX, bp.y - 19 - camY);
  }

  if (World.banner) {
    const b = World.banner;
    const slide = b.t < 12 ? b.t - 12 : b.t > 138 ? 138 - b.t : 0;
    const w = textWidth(b.text) + 24;
    drawFrame(2, 2 + slide * 2.5, w, 26, 'info');
    drawText(ctx, b.text, 14, 10 + slide * 2.5);
  }
}
