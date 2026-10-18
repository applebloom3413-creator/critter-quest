# Critter Quest

A little GBA-style critter-catching game made with love for a 9-year-old critter fan. It's plain HTML and JavaScript,
with no build step and no downloads. All the art (tiles, people, critters, even the font)
is drawn in code with a tiny pixel painter.

## Play it on this PC

```
node serve.js
```

Then open http://localhost:8642. Controls: arrow keys walk, **Z** = A, **X** = B (hold to run), **Enter** = START.

## Where things live

| File | What's in it |
| --- | --- |
| `js/art.js` | Every picture: tiles, buildings, people, and the critters (`CRITTER_ART`) |
| `js/data.js` | Types, the type chart, moves, critter stats + learnsets, items |
| `js/maps.js` | The maps (as text grids), signs, items, NPCs and trainers |
| `js/scripts.js` | MOM, PROF. ASPEN, and the starter pick |
| `js/battle.js` | Battles, damage, EXP, catching |
| `js/world.js` | Walking, talking, wild encounters, trainers spotting you |
| `js/menus.js` | START menu, TEAM, critter info, BAG |
| `js/core.js` | Game loop helpers, text boxes, menus, sounds, saving |

## Adding a new critter

1. Draw it: add a function to `CRITTER_ART` in `js/art.js` (48x48 grid; `back` = the view of your own critter).
2. Give it stats + moves: add an entry to `SPECIES` in `js/data.js`.
3. Put it in the wild: add it to a map's `encounters.table` in `js/maps.js`.

`art-preview.html` shows all the art at once, which is handy when drawing.
