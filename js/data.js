// data.js — types, moves, critters, and the maths that ties them together.
'use strict';

const TYPES = {
  NORMAL: { color: '#a8a090' },
  EMBER:  { color: '#f08030' },
  TIDE:   { color: '#5890f0' },
  LEAF:   { color: '#68c050' },
  VOLT:   { color: '#e8b820' },
  EARTH:  { color: '#c0a060' },
  WIND:   { color: '#88b8f0' },
  SHADOW: { color: '#7058a0' },
};

// attacker type -> { defender type: multiplier }   (anything missing is 1x)
// The starters make a triangle: EARTH beats VOLT, VOLT beats SHADOW, SHADOW beats EARTH.
const TYPE_CHART = {
  EMBER:  { LEAF: 2, TIDE: 0.5, EARTH: 0.5, EMBER: 0.5 },
  TIDE:   { EMBER: 2, EARTH: 2, LEAF: 0.5, TIDE: 0.5 },
  LEAF:   { TIDE: 2, EARTH: 2, EMBER: 0.5, WIND: 0.5, LEAF: 0.5 },
  VOLT:   { TIDE: 2, WIND: 2, SHADOW: 2, EARTH: 0.5, VOLT: 0.5, LEAF: 0.5 },
  EARTH:  { EMBER: 2, VOLT: 2, WIND: 0.5, LEAF: 0.5 },
  WIND:   { LEAF: 2, VOLT: 0.5, EARTH: 0.5 },
  SHADOW: { EARTH: 2, SHADOW: 0.5, VOLT: 0.5 },
  NORMAL: {},
};

function typeEffect(atkType, defType) {
  return (TYPE_CHART[atkType] || {})[defType] ?? 1;
}

// power 0 = a "status" move that changes stats instead of hitting
// stat: which stat it changes, by: how many stages, self: true if it boosts the user
const MOVES = {
  TACKLE:       { name: 'TACKLE',       type: 'NORMAL', power: 40, acc: 100, pp: 35 },
  SCRATCH:      { name: 'SCRATCH',      type: 'NORMAL', power: 40, acc: 100, pp: 35 },
  QUICK_JAB:    { name: 'QUICK JAB',    type: 'NORMAL', power: 40, acc: 100, pp: 30, priority: 1 },
  BODY_SLAM:    { name: 'BODY SLAM',    type: 'NORMAL', power: 75, acc: 90,  pp: 15 },
  ROAR:         { name: 'ROAR',         type: 'NORMAL', power: 0,  acc: 100, pp: 40, stat: 'atk', by: -1 },
  GLARE:        { name: 'GLARE',        type: 'NORMAL', power: 0,  acc: 100, pp: 30, stat: 'def', by: -1 },
  TOUGHEN:      { name: 'TOUGHEN',      type: 'NORMAL', power: 0,  acc: 100, pp: 30, stat: 'def', by: 1, self: true },
  PUMP_UP:      { name: 'PUMP UP',      type: 'NORMAL', power: 0,  acc: 100, pp: 20, stat: 'atk', by: 1, self: true },

  NIGHT_BITE:   { name: 'NIGHT BITE',   type: 'SHADOW', power: 55, acc: 100, pp: 25 },
  SHADOW_SWOOP: { name: 'SHADOW SWOOP', type: 'SHADOW', power: 70, acc: 95,  pp: 15 },
  GUST:         { name: 'GUST',         type: 'WIND',   power: 40, acc: 100, pp: 35 },
  WING_SLICE:   { name: 'WING SLICE',   type: 'WIND',   power: 55, acc: 100, pp: 25 },
  PEBBLE_TOSS:  { name: 'PEBBLE TOSS',  type: 'EARTH',  power: 40, acc: 100, pp: 30 },
  ROCK_SMASH:   { name: 'ROCK SMASH',   type: 'EARTH',  power: 65, acc: 95,  pp: 15 },
  SPARK:        { name: 'SPARK',        type: 'VOLT',   power: 40, acc: 100, pp: 30 },
  ZAP_FANG:     { name: 'ZAP FANG',     type: 'VOLT',   power: 55, acc: 100, pp: 25 },
  THUNDER_CLAW: { name: 'THUNDERCLAW',  type: 'VOLT',   power: 70, acc: 95,  pp: 15 },
  LEAFAGE:      { name: 'LEAFAGE',      type: 'LEAF',   power: 40, acc: 100, pp: 30 },
  VINE_LASH:    { name: 'VINE LASH',    type: 'LEAF',   power: 55, acc: 100, pp: 25 },
  SPLASH_SHOT:  { name: 'SPLASH SHOT',  type: 'TIDE',   power: 40, acc: 100, pp: 30 },
  WAVE_CRASH:   { name: 'WAVE CRASH',   type: 'TIDE',   power: 60, acc: 100, pp: 20 },
  EMBER:        { name: 'EMBER',        type: 'EMBER',  power: 40, acc: 100, pp: 25 },
  FLAME_ROLL:   { name: 'FLAME ROLL',   type: 'EMBER',  power: 60, acc: 100, pp: 20 },
};

// base stats + the moves each critter learns as it levels up.
// catchRate: 255 is easy, 45 is hard. exp: how much it's worth when beaten.
const SPECIES = {
  duskit: {
    name: 'DUSKIT', type: 'SHADOW', hp: 45, atk: 52, def: 40, spd: 70, catchRate: 45, exp: 64,
    blurb: 'Sleeps upside down all day. At night its yellow eyes are all you see.',
    learn: [[1, 'SCRATCH'], [1, 'GLARE'], [5, 'GUST'], [8, 'NIGHT_BITE'], [13, 'WING_SLICE'], [17, 'SHADOW_SWOOP']],
  },
  pebbear: {
    name: 'PEBBEAR', type: 'EARTH', hp: 60, atk: 55, def: 58, spd: 35, catchRate: 45, exp: 64,
    blurb: 'Carries a lucky pebble on its head. Its nub tail wiggles when it is happy.',
    learn: [[1, 'TACKLE'], [1, 'ROAR'], [5, 'PEBBLE_TOSS'], [8, 'TOUGHEN'], [13, 'BODY_SLAM'], [17, 'ROCK_SMASH']],
  },
  zaptor: {
    name: 'ZAPTOR', type: 'VOLT', hp: 50, atk: 60, def: 45, spd: 55, catchRate: 45, exp: 64,
    blurb: 'Its little arms crackle with static. It is very proud of its crest.',
    learn: [[1, 'SCRATCH'], [1, 'GLARE'], [5, 'SPARK'], [8, 'ZAP_FANG'], [13, 'PUMP_UP'], [17, 'THUNDER_CLAW']],
  },
  nibbly: {
    name: 'NIBBLY', type: 'NORMAL', hp: 40, atk: 42, def: 35, spd: 56, catchRate: 255, exp: 40,
    blurb: 'Chews on everything. Fences, signs, and sometimes your shoelaces.',
    learn: [[1, 'TACKLE'], [1, 'ROAR'], [4, 'QUICK_JAB'], [10, 'BODY_SLAM']],
  },
  gustling: {
    name: 'GUSTLING', type: 'WIND', hp: 40, atk: 45, def: 35, spd: 60, catchRate: 220, exp: 45,
    blurb: 'Rides the breeze from tree to tree. Its swirl crest points where the wind blows.',
    learn: [[1, 'GUST'], [1, 'GLARE'], [5, 'QUICK_JAB'], [9, 'WING_SLICE']],
  },
  budlet: {
    name: 'BUDLET', type: 'LEAF', hp: 45, atk: 45, def: 50, spd: 40, catchRate: 200, exp: 48,
    blurb: 'Buries itself in the dirt to nap. Only its leaves stick out.',
    learn: [[1, 'TACKLE'], [3, 'LEAFAGE'], [6, 'TOUGHEN'], [10, 'VINE_LASH']],
  },
  bloblet: {
    name: 'BLOBLET', type: 'TIDE', hp: 55, atk: 40, def: 45, spd: 40, catchRate: 190, exp: 50,
    blurb: 'Made of pond water and good vibes. Leaves a little puddle wherever it sits.',
    learn: [[1, 'TACKLE'], [3, 'SPLASH_SHOT'], [6, 'TOUGHEN'], [11, 'WAVE_CRASH']],
  },
  coalby: {
    name: 'COALBY', type: 'EMBER', hp: 48, atk: 54, def: 52, spd: 38, catchRate: 120, exp: 58,
    blurb: 'Curls into a burning ball when scared. Its cracks glow brighter when it is angry.',
    learn: [[1, 'SCRATCH'], [3, 'EMBER'], [6, 'ROAR'], [10, 'FLAME_ROLL']],
  },
};

const STARTERS = ['duskit', 'pebbear', 'zaptor'];

// ---------------------------------------------------------------- critter instances

function calcStats(c) {
  const s = SPECIES[c.species], L = c.level;
  c.maxHp = Math.floor(2 * s.hp * L / 100) + L + 10;
  c.atk = Math.floor(2 * s.atk * L / 100) + 5;
  c.def = Math.floor(2 * s.def * L / 100) + 5;
  c.spd = Math.floor(2 * s.spd * L / 100) + 5;
}

function expForLevel(L) { return L <= 1 ? 0 : Math.floor(L * L * L * 0.8); }

function makeCritter(species, level) {
  const c = { species, level, exp: expForLevel(level), moves: [], nickname: null };
  calcStats(c);
  c.hp = c.maxHp;
  for (const [lv, move] of SPECIES[species].learn) if (lv <= level) teach(c, move);
  return c;
}

// learn a move; with 4 already known, the oldest is forgotten. Returns the forgotten move.
function teach(c, moveId) {
  if (c.moves.some(m => m.id === moveId)) return null;
  let forgot = null;
  if (c.moves.length >= 4) forgot = c.moves.shift().id;
  c.moves.push({ id: moveId, pp: MOVES[moveId].pp });
  return forgot;
}

function critterName(c) { return c.nickname || SPECIES[c.species].name; }

function healCritter(c) {
  c.hp = c.maxHp;
  for (const m of c.moves) m.pp = MOVES[m.id].pp;
}

// ---------------------------------------------------------------- items

const ITEMS = {
  CUBE:   { name: 'CAPTURE CUBE', desc: 'A cube that catches wild critters. Throw it at weak ones!', battleOnly: true },
  POTION: { name: 'POTION',       desc: 'Heals a critter by 20 HP.', heal: 20 },
  SUPER:  { name: 'SUPER POTION', desc: 'Heals a critter by 50 HP.', heal: 50 },
};
