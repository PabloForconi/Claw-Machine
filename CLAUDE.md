# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Browser 3D game prototype: a claw machine full of capsule toys. The user asked for it in 3D (an earlier 2D canvas version was replaced). All the code lives in `index.html` (inline CSS and an inline ES module, no build step). External resources: Three.js 0.170.0 from jsDelivr through an import map (`three` and `three/addons/`, only `RoundedBoxGeometry` is used from the addons), and the Google Fonts font Kalam (bold, 700) with a cursive fallback, the same UI font as the sibling prototype `../Laberinto` (Maze Mouse). UI text is in Spanish (rioplatense: "Tocá", "querés").

To run it, open `index.html` in a browser; it needs internet for Three.js and the font.

### Testing from the console

`window.game` exposes the state, the claw, the prizes, `startRound`, `startDrop` and `segments`, plus a few test helpers:
- `step(n)` runs n simulation steps synchronously. Use it for tests: frame-driven tests crawl in the in-app browser pane, which often throttles animation frames to one every 0.3–1.7 s (the game itself takes about 25 ms per frame).
- `paused = true` stops the frame loop from advancing the simulation (it still draws), so you can step by hand.
- `draw()` draws right away.
- `closeUp(x, y, z, dist)` points the camera at a spot to inspect the claw; `fit()` puts the normal view back.

The pane only repaints while its tab is fronted (`tabs_select`); otherwise screenshots show a stale frame.

`game.claw` is replaced on `reset()` ("Jugar de nuevo"), so read it again after a reset.

## How the game works

- World units: the glass box is x ∈ [-2, 2], z ∈ [-1.5, 1.5] (z+ is towards the camera), floor at y = 0. The prize hole is the front-left corner (`HOLE`: x < -1.1 and z > 0.6), fenced by two clear walls (`WALLS`, axis-aligned boxes). The claw returns to `HOME`, the centre of the hole.
- The machine is built from plain boxes in the "Machine" section; the floor slab is two boxes forming an L so the hole stays open, and `holeIn` is a back-side box that shows the dark inside of the hole. The marquee and the scoreboard are canvas textures, repainted once Kalam loads.
- Screen layout (the user asked for more view of the game, October 2026):
  - There is no HTML HUD at the top. Coins, points, time and the idle hint are a scoreboard on the front of the machine's base (`board`, `boardTex`, where a "PREMIOS" door label used to be). `hud()` repaints it only when a value changes. Only the controls and the game-over card are HTML.
  - The marquee is a thin strip (`MARQUEE_H`).
  - The camera sits about 20° above level (`CAM_DIR`; it was 30°).
- `update()` is the claw state machine: `idle` → `aim` (costs one coin, `AIM_TIME` seconds, moves in x and z, auto-drops when time runs out) → `drop` → `close` → `lift` → `return` → `settle` → `release` → `wait` → `idle`, or `over` when the coins run out.
- A straight-down shadow-casting light (`top`) puts the claw's shadow right under it; that shadow is how the player judges depth, so keep it if the lighting changes.

### Physics

`physics()` is a small rigid-body contact solver for the spheres, written by hand (no physics library), run every fixed step (`STEP`, 1/120 s). The user asked for better collisions and physics (October 2026); before it, it was plain position pushes without friction, and spheres sank up to 0.08 into each other under the claw.
- Each step: gravity, then `findContacts()` (with `MARGIN`, so resting contacts are found every step). `solveContacts()` runs `SOLVER_ITERS` passes of normal impulses (restitution `BOUNCE` only above `BOUNCE_MIN`, gaps allowed to close but not overshoot) and Coulomb friction (`MU`) at the contact point. Then the bodies move and spin, and `separate()` runs `POS_ITERS` passes that push apart what still overlaps, without adding velocity.
- Prizes have real mass (by volume, `setMass()`) and angular velocity (`wx, wy, wz`). Friction spins them, the mesh rotates from that, and `ROLL_DAMP` is rolling resistance, so they roll, stack and come to rest.
- Contact kinds (`MU` and `BOUNCE` keys): `prize`, `claw`, `floor` (absent over the hole), `glass` and `wall` (the hole walls).
- The claw head is a dynamic body (`HEAD_MASS`, no spin) and collides as its body: an upright cylinder of radius `HUB_R` from `HUB_DOWN` below the head point to `HUB_UP` above it. An earlier spherical head squirted capsules sideways out from under the claw when it landed slightly off centre.
- The finger segments (`segments()`, radius `FINGER_R`) are part of the claw. Their contacts have `b` = the head, and `vb` is their own motion relative to the head (finite differences of `lastSegs`, stored relative to the head). In `relVel()` their velocity is the head's current velocity plus `vb`, so when a contact brakes the claw the fingers brake with it.
  - An earlier version used their absolute pre-contact velocity, which kept pushing and launched the claw upwards at up to 1.4 on landing.
  - Their reaction reaches the head only in small part (`CLAW_FEEDBACK` = 0.05). At 0.3 the claw stood on its open fingertips on the neighbours, about 0.5 too high to reach the capsule under it.
- Claw contacts don't bounce (`BOUNCE.claw` = 0). `imOf()` makes the head immovable while it closes, and a held prize immovable to the others (it rides in the claw).
- A held prize (`p.held`) is kinematic: no gravity, not integrated, skipped as the first body of a contact, and positioned by `carry()`.

### Claw motion

The user asked for physically based motion when the claw brakes, drops, etc.
- `claw.x`/`claw.z` are the carriage, driven by `driveCarriage()` towards a target velocity with limited acceleration (`ACC`), so it ramps up and brakes; on the way back it brakes in time to stop over the hole.
- `claw.head` is a point mass (`HEAD_MASS`, plus the held prize's) hanging from an elastic cable (`swingHead()`: spring `ROPE_K`, damping `ROPE_C`).
  - The cable only pulls, so it goes slack when the head lands. Gravity plus the cable make it a pendulum: it swings when the carriage starts or brakes.
  - `SWING_DRAG` damps the swing relative to the carriage (not to the world, so the claw doesn't lag while moving). The sideways damping falls with the square of the cable length, down to a floor of 0.1 for air drag (0.2 took two thirds of a swing out before landing): it stands for friction up at the carriage, which brakes a short pendulum hard and a long one barely.
  - The user noticed the claw lost its sway as it went down while the damping was constant, and asked for that to be reviewed (October 2026). Now a sway from braking at the top (about 13°) carries on and dies out during the descent. Dropping while still moving makes the claw drift on as the carriage brakes, up to about 0.35 halfway down.
- The user found the first tuning too swingy and asked for a heavier feel (October 2026): `ACC` went 4 → 2.2, the head mass 1 → 2.5 with a stiffer cable, and the swing damping 0.6 → 2.5. With that, braking swings the head about 0.07 off the carriage and it settles in about 2 s. Keep it heavy if retuning.
- `claw.len` is the cable paid out, changed by the winch, whose speed (`claw.winch`) ramps up at `WINCH_ACC`.
- The drop is timed, not stopped by contact. The user asked for this because the claw used to close the moment a finger touched the top of a capsule, and bounced back up without really closing (October 2026).
  - It always lasts `DROP_TIME` (what paying out the whole cable takes) plus `DROP_REST`, then the claw closes.
  - Whatever the claw lands on, it rests there with its weight and sinks as it pushes prizes aside.
  - Once landed (`claw.landed`, where it came down) the claw is held there sideways and only sinks. Before this, with loose cable, it slid 0.2–0.5 sideways off the round top of a capsule before closing.
  - Landing means the cable is slack and the claw touches something: `claw.touching`, set in `physics()` from any head or finger contact with a prize, and in `swingHead()` from a hole wall. Slack alone isn't enough. A swinging claw slackens its elastic cable for a moment at each end of the swing, and taking that for a landing pinned it in mid-air, so a shaken claw fell straight down. The user noticed this (October 2026). Requiring it to stop going down instead let it slide 0.17 off a capsule before the lock.
  - The winch keeps letting out up to `DROP_SLACK` of loose cable, which bows out above the resting claw.
  - The first slack plays the landing clank. When lifting, the winch reels the slack in before it pulls (about 0.2 s); stopping at the top (`L_MIN`) makes the head bounce.
- The visible cable is a simulated rope (`cable`, `cableStep()`). The user found the straight cylinder too rigid (October 2026).
  - It is a chain of `CABLE_NODES` Verlet point masses with gravity, pinned to the carriage and the hook on top of the claw's body (`HOOK_UP` above the head point), with links of `(claw.len - HOOK_UP) / CABLE_NODES` held at length (`CABLE_ITERS` passes).
  - When the claw is lower than the cable allows, the extra length curves out; a tiny `CABLE_NUDGE` picks the side, or a vertical slack rope would just fold onto itself.
  - It only draws: the claw hangs from the elastic cable model in `swingHead()`, and the rope follows it since both use `claw.len`.
  - Measured: nearly straight while the claw hangs from it (it carries the claw's weight), a bow of about 0.15 with 0.22 of slack while the claw rests on the pile.
- The claw is drawn tilted along the cable: `clawFrame()` gives the cable direction and two axes across it, and `clawPoint()` maps claw-frame offsets to the world (the fingers and the held prize use it).
- The whole claw collides with the hole's clear walls (`clawWallPush()`: the head, points sampled along every finger segment and a held prize, pushed out as one rigid body in `swingHead()`).
  - Landing on a wall's top edge rests the claw there.
  - The claw always closes fully. A finger that runs into a wall gives way against it like against a prize: `fingerPen()` includes `fingerWallPen()`, sampled along the finger. Earlier, the whole claw stopped closing as soon as a finger would touch a wall, and rose open; the user asked for it to close anyway (October 2026).
  - The open claw is wider than the hole, so it can't drop into it.
  - The glass box walls still only clamp the head.

### Fingers and grabbing

The user reported the grab feeling odd several times (October 2026): a "magnet" pulling untouched capsules in, capsules hanging "hooked" off two fingers, capsules dropped right after being caught, and the claw "grabbing" with its fingers still wide open. The current model was arrived at by watching grabs frame by frame with `paused`/`closeUp` and measuring with `step`.
- The claw's shape is deliberately simple, in the game's chrome. The user went through several reference designs (photos of real claws, then flat cartoon and icon designs) and finally asked for something simpler, with the mechanism above the fingers back to a little box like at the start (October 2026). Don't add detail back unless asked.
  - The body is a small plain box (`bodyBox`, no rounding: the user asked for sharp edges, and the carriage is a plain box too) standing along the cable, `HUB_R` out to its sides, from `HUB_DOWN` below the head point to `HUB_UP` above it. It collides as a cylinder that size. The cable hooks onto its top (`HOOK_UP`); `HEAD0` keeps it just under the carriage at the top.
  - The fingers hinge at the box's bottom edge (`PIVOT_R` out, `PIVOT_DOWN` down). `FINGER_SHAPE` is the closed profile, (out, down) from the hinge, in three straight parts, as the user asked: out and down to a first knee, a longer middle part nearly straight down, then the shortest part, the tip, hooked in under the claw.
  - Each finger is one flat piece (`FINGER_GEO`): `fingerOutline()` offsets the centre line by half of `FINGER_W` with mitred corners at the knees and a square-cut end, and it is extruded `FINGER_T` thick. It is built once in the finger's own plane and only moved to the hinge and turned each frame in `syncClaw()`. Earlier, per-part plates overlapping at the knees and cone points at the tips looked messy; the user asked for clean geometric shapes. `FINGER_R` (the collision radius) is about half the width. The user asked for thinner fingers after seeing them at 0.13 wide; they are 0.08 now (October 2026).
  - Closed, the fingers leave room for a capsule, which settles onto the tips.
  - `OPEN_ANGLE` (0.5 rad) is how far the motor swings the fingers out. The wider the open claw, the more neighbours it lands on and the fewer catches; with the second knee far out, 0.65 gave 14 deliveries in 45 rounds and 0.5 gave 18.
  - `HEAD_MIN_Y` comes from `FINGER_REACH`, the deepest finger point open or closed.
  - The material is `CHROME`, not too metallic: there is no environment map, so a high metalness renders almost black.
- The claw has three fingers (`FINGER_ANGLES`, one at the back). It had four for a while, against capsules slipping out between two fingers; the user asked for three again once a caught prize rode in the claw (October 2026).
  - `fingers()` gives each finger's points along `FINGER_SHAPE` (`pts`; `p` is the hinge, `t` the tip). They are rotated by `claw.open` (the motor) plus that finger's own `claw.flex[i]` (its give), capped at `FLEX_MAX_ANGLE`.
  - `fingerRods()` gives the straight stretches, used for collisions and drawing.
  - Code that loops over fingers uses `FINGER_ANGLES.length`.
- Finger give (`flexFingers()`, every step while not carrying):
  - A finger pressing into a prize, the one under the claw included, swings up and out (`FLEX_GAIN` per unit of overlap, up to `FLEX_MAX`) until it rests on it instead of digging in.
  - It springs back at `FLEX_RETURN` only as far as it stays clear, and not while a prize slips out or the claw lets go.
  - So during the drop the fingers ride up over neighbours and the head reaches the capsule under it. When closing, the motor closes all the way (`open` → 0) and every finger ends up lying against whatever it met.
  - `FLEX_GAIN` 6 and `FLEX_MAX` 1.1 grab best. A faster or larger give left fingers splayed too wide to cradle, roughly halving catches, though fingers then dig into neighbours a bit less (up to about 0.07 now, rarely).
- `pickTarget()`, when closing starts, notes `claw.target`: the prize under the head (within 0.8 of its radius) whose top half the closed tips could reach.
- `grabTarget()`, when closing is done, catches it only if it is really held, judged by `cradle()` with all fingers at one angle and the prize centred. The prize must also be within 0.8 of its radius from the axis. There are two ways to be held:
  - The closed fingers would press into it: they rest on it a little open (the cradle angle), which holds it only if the tips end up under its middle. All fingers but one must touch it (`fingersOn()`).
  - It fits loose inside the closed fingers: it settles down onto the inward-bent tips, unless it would drop right through. `cradle()` lowers it in small steps to find where it first touches. A single deep probe misread short tips: past them the capsule touches nothing. All fingers but one must have closed round it. One left splayed on a neighbour closes in as the claw lifts off the pile; two would leave too wide a gap.
  - A prize only pinched at the top isn't caught: the claw rises without it. Before this rule, such prizes were carried hanging off the tips and dropped on the jolt of the lift.
- Once caught, the prize rides in the claw (`claw.hold`: its offset in the claw frame, the height it settles to and the cradle flex). `carry()` evens the fingers out and slides the prize to the middle sideways and down onto the fingers, never up, at `HOLD_SETTLE`. That is what linked fingers and gravity would do, and it isn't a magnet, since only prizes already enclosed get there. A finger still pressing on a neighbour while lifting off the pile gives way to it.
- `claw.q` is the grip quality (1 = dead centre). `slip()` uses it (rate `.015 + (1 - q) * .08` per second, gold prizes 1.6×).
  - A slip `detach()`es the prize, making it a loose body with the claw's velocity, and sets `claw.slipping` to it.
  - The fingers ease open (`loosen()`) until the tips clear it (`tipsClear()`).
  - There is no on-screen text for a slip: the user asked to remove the old "¡Uy!" pop and the claw's sudden half-open snap (October 2026).
- Releasing over the hole detaches the prize the same way; the `settle` state first waits (up to 1 s) for the swing to die down, since a released prize keeps the claw's velocity.
- Measured with 45 rounds aiming at capsules away from the walls:
  - four straight-segment fingers: about 15–17 catches and 17 deliveries;
  - three: 23 and 23;
  - three curved fingers: 25 catches, 23 of them delivered;
  - the cartoon-style claw with curved fingers: 21 catches, all delivered;
  - two-part angular fingers: 29 catches, 28 delivered;
  - three-part fingers with a short tip: 19 catches, 18 delivered;
  - the simple box body with flat fingers: 22 catches, 20 delivered;
  - one-piece wider fingers with a longer middle part: 19 catches, 18 delivered;
  - the same, thinner (current): 23 catches, 22 delivered.
  - Fingers dig into the carried prize at most about 0.01 and into neighbours about 0.04.

### Capsules

Capsule count and sizes are tuned to the claw. The user noticed small capsules escaping between the fingers and big ones hard to grab (October 2026). Measured by size, with three fingers, 26 capsules and radius 0.27–0.36:
- The capsules covered about 86% of the floor, a tight carpet where the open claw lands on neighbours and only pinches tops.
- Small ones sat too low to reach: 4 targets in 18 tries.
- Big ones squeezed out sideways: 10 of 12 grabs.
- Between two closed fingers of three there was a gap of about 0.44–0.6, enough for a 0.58-wide capsule.

Now the radius is `R_MIN`–`R_MAX` (0.29–0.32). `PRIZE_COUNT` is 22, after the user asked for more capsules; with 26 the floor is a tight carpet again. When fewer than `RESTOCK_BELOW` remain, enough fall from the top to get back to `PRIZE_COUNT`.

### Scoring and the rest

- A prize that falls below y = -0.75 counts in `win()`: 1 point, 5 for a gold (rare) one.
- `fit()` frames the machine by projecting the cabinet's corners (`FIT_CORNERS`). It searches for the camera distance at which they just fit between the top of the screen and the controls, then centres them there with `setViewOffset`. This works for any camera angle and screen shape. On wide screens (`body.wide`) the controls go to the bottom corners and take no height. A fixed half-height guess stopped fitting when the camera was lowered, since the near base looks bigger.
- The best score is kept in `localStorage` under `clawMachine.best` (wrapped in try/catch).
- Sounds are synthesised with WebAudio in `sfx()`; there are no audio files yet.

Controls: arrows or WASD to move (up/W moves the claw back, away from the camera), Space or Enter to drop; on screen, the d-pad and the ¡BAJAR! button.
