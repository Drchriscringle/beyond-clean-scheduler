# Killie Formation Roulette

A random formation generator for Kilmarnock — every way to split ten outfield
players into a back, middle and front line, from `0-0-10` to `10-0-0`.

Open `index.html` in a browser. No build step, no dependencies.

## What it does

- **66 shapes.** Every `defenders-midfielders-forwards` combination that adds up
  to ten, plus the keeper.
- **Chaos dial.** *Sensible* (shapes a scout would recognise), *Adventurous*
  (2–6 at the back, 1–5 up top), or *Anything goes* (all 66).
- **Pitch view.** Positions are derived from each band — a four becomes
  `RB CB CB LB`, a six becomes `RWB RB CB CB LB LWB`, and so on.
- **Rugby Park risk index.** 1–10, weighted by how exposed the back line is,
  how many bodies are past the halfway line, and whether there is a midfield
  at all.
- **Copy team sheet.** Puts the shape and its positions on the clipboard.

Press <kbd>space</kbd> to spin again.
