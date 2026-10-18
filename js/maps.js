// maps.js — the world. Each map is a grid of characters:
//   .  grass        "  tall grass (wild critters!)    =  path
//   T  tree         ~  water                          #  fence
//   f  flowers
// Buildings, signs, items and people sit on top as "props" and "npcs".
'use strict';

const MAPS = {
  mossvale: {
    name: 'MOSSVALE TOWN',
    rows: [
      'TTTTTTTTTT==TTTTTTTTTT',
      'TTTTTTTTTT==TTTTTTTTTT',
      'TT.f......==......f.TT',
      'TT........==........TT',
      'TT........==........TT',
      'TT........==........TT',
      'TT........==........TT',
      'TT.f.=....==...=..f.TT',
      'TT...===========....TT',
      'TT........==........TT',
      'TT........==......f.TT',
      'TT.~~~~...==........TT',
      'TT.~~~~...==........TT',
      'TT.~~~~...==........TT',
      'TT........==........TT',
      'TT..f.....======....TT',
      'TT.#####............TT',
      'TT..................TT',
      'TTTTTTTTTTTTTTTTTTTTTT',
      'TTTTTTTTTTTTTTTTTTTTTT',
    ],
    exits: { north: { to: 'route1', dx: 0 } },
    props: [
      { kind: 'building', art: 'house', x: 4, y: 3, w: 4, h: 4, door: [5, 6], text: "It's {NAME}'s house! MOM is out in the yard today." },
      { kind: 'building', art: 'houseBlue', x: 14, y: 3, w: 4, h: 4, door: [15, 6], text: "The door is locked. A note says: \"Gone critter-watching!\"" },
      { kind: 'building', art: 'lab', x: 13, y: 11, w: 6, h: 4, door: [15, 14], text: "PROF. ASPEN's CRITTER LAB. The door's shut... the PROF must be outside." },
      { kind: 'sign', x: 9, y: 2, text: 'ROUTE 1 is just ahead!\nTall grass means wild critters. Be brave!' },
      { kind: 'sign', x: 7, y: 7, text: "{NAME}'s HOUSE" },
      { kind: 'sign', x: 12, y: 9, text: 'MOSSVALE TOWN\nWhere every big adventure starts small.' },
    ],
    npcs: [
      { id: 'mom', look: 'mom', x: 3, y: 8, dir: 3, script: 'mom' },
      { id: 'prof', look: 'prof', x: 17, y: 15, dir: 2, script: 'prof' },
      { id: 'girl', look: 'girl', x: 17, y: 9, dir: 0, wander: true,
        text: "Critters that live deeper in the tall grass are stronger.\nBut so are you, probably!" },
      { id: 'kid', look: 'kid', x: 8, y: 12, dir: 2, wander: true,
        text: 'I saw a COALBY near ROUTE 1 once! It was on FIRE!\n...in a good way!' },
    ],
    triggers: [
      { x: 10, y: 1, script: 'needStarter' },
      { x: 11, y: 1, script: 'needStarter' },
    ],
  },

  route1: {
    name: 'ROUTE 1',
    rows: [
      'TTTTTTTTTTTTTTTTTTTTTT',
      'TTTTTTTTTTTTTTTTTTTTTT',
      'TTT.f.....==.....f.TTT',
      'TT""""....==....""""TT',
      'TT""""....==....""""TT',
      'TT""""....==....""""TT',
      'TT........==........TT',
      'TT...=======........TT',
      'TT...==.............TT',
      'TT...==...""""""....TT',
      'TT...==...""""""....TT',
      'TT...==...""""""..f.TT',
      'TT...==.............TT',
      'TT...============...TT',
      'TT..............==..TT',
      'TT""""""........==..TT',
      'TT""""""...~~~..==..TT',
      'TT""""""...~~~..==..TT',
      'TT""""""........==..TT',
      'TT..........======..TT',
      'TT..........==......TT',
      'TT..........==""""""TT',
      'TT..........==""""""TT',
      'TT..........==""""""TT',
      'TT..f.....====......TT',
      'TT........==........TT',
      'TT.""""...==........TT',
      'TT.""""...==....f...TT',
      'TT........==........TT',
      'TTTTTTTTTT==TTTTTTTTTT',
    ],
    exits: { south: { to: 'mossvale', dx: 0 } },
    encounters: {
      levels: [2, 5],
      table: [['nibbly', 34], ['gustling', 26], ['budlet', 20], ['bloblet', 12], ['coalby', 8]],
    },
    props: [
      { kind: 'sign', x: 12, y: 28, text: 'ROUTE 1\nSouth: MOSSVALE TOWN' },
      { kind: 'sign', x: 13, y: 2, text: 'ROUTE 2 - UNDER CONSTRUCTION\nCome back soon!' },
      { kind: 'item', x: 3, y: 6, item: 'CUBE', count: 2, flag: 'item_r1_cube1' },
      { kind: 'item', x: 18, y: 2, item: 'SUPER', count: 1, flag: 'item_r1_super' },
      { kind: 'item', x: 19, y: 25, item: 'POTION', count: 2, flag: 'item_r1_potion' },
    ],
    npcs: [
      { id: 'builder', look: 'hiker', x: 11, y: 2, dir: 0,
        text: "Whoa there! ROUTE 2 isn't finished yet.\nFolks say a HUGE critter lives up ahead... Better train up first!" },
      { id: 'jay', look: 'kid', x: 19, y: 13, dir: 2, trainer: {
          name: 'YOUNGSTER JAY', sight: 4, flag: 'beat_jay',
          team: [['nibbly', 4], ['budlet', 5]],
          intro: "Hey! You've got a critter too?\nLet's battle! Mine are super tough!",
          lose: 'Aww man... you won fair and square!',
          after: "I'm gonna train SO hard. Next time I'll win for sure!",
        } },
    ],
  },
};

// sanity check so a typo in a map row shows up right away
for (const [id, m] of Object.entries(MAPS)) {
  m.id = id;
  m.w = m.rows[0].length; m.h = m.rows.length;
  m.rows.forEach((r, i) => { if (r.length !== m.w) console.error(`map ${id} row ${i} is ${r.length} wide, expected ${m.w}`); });
}
