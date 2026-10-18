// scripts.js — what people say and do: MOM, PROF. ASPEN, and picking a starter.
'use strict';

const SCRIPTS = {
  async intro() {
    await wait(20);
    const n = G.state.name;
    await say(`MOM: Good morning, ${n}! Today's the BIG day!`);
    await say('PROF. ASPEN is waiting for you by the LAB, just down the path.');
    await say("He said he's got a surprise for you... ♥");
    await say('(Use the D-PAD to walk. Press A to talk and read signs. Hold B to run!)');
  },

  async mom() {
    const n = G.state.name;
    if (!G.state.flags.starter) {
      await say(`MOM: PROF. ASPEN is by the LAB, ${n}. Down the path and to the right!`);
      return;
    }
    await say(`MOM: ${n}! Come here, let me take care of your critters.`);
    await fadeOut(12, '#ffffff');
    G.state.team.forEach(healCritter);
    Sound.heal();
    await wait(30);
    await fadeIn(12);
    await say("There! They're all full of energy again. Come home anytime! ♥");
    saveGame();
  },

  async prof() {
    const n = G.state.name;
    if (!G.state.flags.starter) {
      await say(`PROF. ASPEN: Ah, ${n}! There you are!`);
      await say('This world is full of amazing creatures we call CRITTERS.');
      await say('Some people battle with them. Some people study them. And some become their best friends.');
      await say('I have three critters here who are looking for a partner. Come take a look!');
      const sp = await pickStarter();
      const c = makeCritter(sp, 5);
      G.state.team.push(c);
      G.state.flags.starter = true;
      G.state.seen[sp] = true; G.state.caught[sp] = true;
      Sound.caught();
      await say(`${n} received ${SPECIES[sp].name}!`);
      await say(`PROF. ASPEN: Ha ha! ${SPECIES[sp].name} likes you already!`);
      addItem('CUBE', 5); addItem('POTION', 3);
      Sound.select();
      await say(`${n} received 5 CAPTURE CUBES and 3 POTIONS!`);
      await say('Wild critters hide in the tall grass. Battle them to wear them out...');
      await say('...then throw a CAPTURE CUBE! The weaker a critter is, the easier it is to catch.');
      await say('If your critters get tired, your MOM can fix them right up.');
      await say('ROUTE 1 is north of town. Go on, adventure is waiting!');
      saveGame();
      return;
    }
    if (!G.state.bag.CUBE) {
      await say(`PROF. ASPEN: Out of CAPTURE CUBES, ${n}? Here, take these!`);
      addItem('CUBE', 5);
      Sound.select();
      await say(`${n} received 5 CAPTURE CUBES!`);
      return;
    }
    const seen = Object.keys(G.state.seen).length, caught = Object.keys(G.state.caught).length;
    const tips = [
      `You've seen ${seen} kinds of critters and caught ${caught}! There are ${Object.keys(SPECIES).length} kinds that I know of...`,
      'Type matchups matter! EARTH beats VOLT, VOLT beats SHADOW, and SHADOW beats EARTH.',
      'TIDE puts out EMBER, EMBER burns LEAF, and LEAF soaks up TIDE. Nature is neat!',
      'Weaken wild critters before you throw a CUBE. Low HP means an easier catch!',
      'Press START to check on your TEAM, use items from your BAG, or save your game.',
    ];
    await say('PROF. ASPEN: ' + tips[rand(0, tips.length - 1)]);
  },

  async needStarter() {
    if (G.state.flags.starter) return;
    Sound.encounter();
    await say(`PROF. ASPEN: Hey! Wait up, ${G.state.name}!`);
    await say("It's not safe to go into the tall grass without a critter of your own!");
    await say('Come see me in front of the LAB!');
    await walk(World.player, 0);
  },
};

// ---------------------------------------------------------------- choosing a starter

async function pickStarter() {
  const st = { i: 0 };
  const panel = () => {
    drawFrame(4, 4, 232, 106, 'white');
    STARTERS.forEach((sp, i) => {
      const cx = 44 + i * 76, on = st.i === i;
      ctx.fillStyle = on ? '#f8e8b0' : '#e8eef0';
      ctx.fillRect(cx - 32, 14, 64, 88);
      ctx.fillStyle = '#c8d8e0';
      ctx.fillRect(cx - 26, 60, 52, 8);
      const bob = on && Math.floor(G.frame / 10) % 2 ? -2 : 0;
      ctx.drawImage(ART.critters[sp].front, cx - 24, 14 + bob);
      const name = SPECIES[sp].name;
      drawText(ctx, name, cx - Math.floor(textWidth(name) / 2), 72);
      const type = SPECIES[sp].type;
      drawTypeBadge(type, cx - Math.floor((textWidth(type) + 8) / 2), 88);
      if (on) drawDownArrow(cx - 3, 6 + (Math.floor(G.frame / 16) % 2));
    });
  };
  UI.extras.push(panel);
  try {
    for (;;) {
      UI.box = { style: 'white', lines: wrapText(SPECIES[STARTERS[st.i]].blurb, 212).slice(0, 2), x: 0, w: W };
      await nextFrame();
      const p = Input.pressed;
      if (p.left) { st.i = (st.i + 2) % 3; Sound.blip(); }
      if (p.right) { st.i = (st.i + 1) % 3; Sound.blip(); }
      if (!p.a) continue;
      Sound.select();
      const sp = STARTERS[st.i];
      await say(`So you want ${SPECIES[sp].name}, the ${SPECIES[sp].type} critter?`, { keep: true, prompt: true });
      const yes = await yesNo();
      UI.box = null;
      if (yes) return sp;
    }
  } finally {
    UI.extras.splice(UI.extras.indexOf(panel), 1);
    UI.box = null;
  }
}
