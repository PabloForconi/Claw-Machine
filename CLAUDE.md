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
- The machine is built from plain boxes in the "Machine" section; the floor slab is two boxes forming an L so the hole stays open, and `holeIn` is a back-side box that shows the dark inside of the hole. Marquee and prize door labels are canvas textures, repainted once Kalam loads.
- `update()` is the claw state machine: `idle` → `aim` (costs one coin, `AIM_TIME` seconds, moves in x and z, auto-drops when time runs out) → `drop` → `close` → `lift` → `return` → `settle` → `release` → `wait` → `idle`, or `over` when the coins run out.
- A straight-down shadow-casting light (`top`) puts the claw's shadow right under it; that shadow is how the player judges depth, so keep it if the lighting changes.

### Physics

`physics()` is a small rigid-body contact solver for the spheres, written by hand (no physics library), run every fixed step (`STEP`, 1/120 s). The user asked for better collisions and physics (October 2026); before it, it was plain position pushes without friction, and spheres sank up to 0.08 into each other under the claw.
- Each step: gravity, then `findContacts()` (with `MARGIN`, so resting contacts are found every step). `solveContacts()` runs `SOLVER_ITERS` passes of normal impulses (restitution `BOUNCE` only above `BOUNCE_MIN`, gaps allowed to close but not overshoot) and Coulomb friction (`MU`) at the contact point. Then the bodies move and spin, and `separate()` runs `POS_ITERS` passes that push apart what still overlaps, without adding velocity.
- Prizes have real mass (by volume, `setMass()`) and angular velocity (`wx, wy, wz`). Friction spins them, the mesh rotates from that, and `ROLL_DAMP` is rolling resistance, so they roll, stack and come to rest.
- Contact kinds (`MU` and `BOUNCE` keys): `prize`, `claw`, `floor` (absent over the hole), `glass` and `wall` (the hole walls).
- The claw head is a dynamic body (`HEAD_MASS`, no spin) and collides as a short upright cylinder. A sphere would squirt a capsule sideways out from under the claw when landing slightly off centre.
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
  - `SWING_DRAG` damps the swing relative to the carriage (not to the world, so the claw doesn't lag while moving). The sideways damping falls with the square of the cable length, down to a floor of 0.2 for air drag: it stands for friction up at the carriage, which brakes a short pendulum hard and a long one barely.
  - The user noticed the claw lost its sway as it went down while the damping was constant, and asked for that to be reviewed (October 2026). Now a sway from braking at the top (about 13°) carries on and dies out during the descent. Dropping while still moving makes the claw drift on as the carriage brakes, up to about 0.35 halfway down.
- The user found the first tuning too swingy and asked for a heavier feel (October 2026): `ACC` went 4 → 2.2, the head mass 1 → 2.5 with a stiffer cable, and the swing damping 0.6 → 2.5. With that, braking swings the head about 0.07 off the carriage and it settles in about 2 s. Keep it heavy if retuning.
- `claw.len` is the cable paid out, changed by the winch, whose speed (`claw.winch`) ramps up at `WINCH_ACC`.
- The drop is timed, not stopped by contact. The user asked for this because the claw used to close the moment a finger touched the top of a capsule, and bounced back up without really closing (October 2026).
  - It always lasts `DROP_TIME` (what paying out the whole cable takes) plus `DROP_REST`, then the claw closes.
  - Whatever the claw lands on, it rests there with its weight and sinks as it pushes prizes aside.
  - The winch never lets out more than `DROP_SLACK` of loose cable. With all the cable out, the claw slid 0.2–0.5 sideways off the round top of a capsule before closing.
  - Once landed (`claw.landed`, where it came down) the claw is held there sideways and only sinks.
  - The first slack plays the landing clank. Lifting first takes up the slack; stopping at the top (`L_MIN`) makes the head bounce.
- The claw is drawn tilted along the cable: `clawFrame()` gives the cable direction and two axes across it, and `clawPoint()` maps claw-frame offsets to the world (the fingers and the held prize use it).
- The whole claw collides with the hole's clear walls (`clawWallPush()`: the head, points sampled along every finger segment and a held prize, pushed out as one rigid body in `swingHead()`).
  - Landing on a wall's top edge rests the claw there.
  - Fingers stop closing if they would run into a wall (`wallBlocks()`).
  - The open claw is wider than the hole, so it can't drop into it.
  - The glass box walls still only clamp the head.

### Fingers and grabbing

The user reported the grab feeling odd several times (October 2026): a "magnet" pulling untouched capsules in, capsules hanging "hooked" off two fingers, capsules dropped right after being caught, and the claw "grabbing" with its fingers still wide open. The current model was arrived at by watching grabs frame by frame with `paused`/`closeUp` and measuring with `step`.
- The claw has four fingers (`FINGER_ANGLES`, at 45° to the axes); `fingers()` gives each one's pivot, knee and tip from `claw.open` (the motor) plus that finger's own `claw.flex[i]` (its give), capped at `FLEX_MAX_ANGLE`. `syncClaw()` places the cylinder meshes between them. Code that loops over fingers uses `FINGER_ANGLES.length`.
- Finger give (`flexFingers()`, every step while not carrying):
  - A finger pressing into a prize, the one under the claw included, swings up and out (`FLEX_GAIN` per unit of overlap, up to `FLEX_MAX`) until it rests on it instead of digging in.
  - It springs back at `FLEX_RETURN` only as far as it stays clear, and not while a prize slips out or the claw lets go.
  - So during the drop the fingers ride up over neighbours and the head reaches the capsule under it. When closing, the motor closes all the way (`open` → 0) and every finger ends up lying against whatever it met.
  - `FLEX_GAIN` 6 and `FLEX_MAX` 1.1 grab best. A faster or larger give left fingers splayed too wide to cradle, roughly halving catches, though fingers then dig into neighbours a bit less (up to about 0.07 now, rarely).
- `pickTarget()`, when closing starts, notes `claw.target`: the prize under the head (within 0.8 of its radius) whose top half the closed tips could reach.
- `grabTarget()`, when closing is done, catches it only if it is really cradled:
  - at least three fingers touch it (`fingersOn()`);
  - it is within 0.8 of its radius from the axis;
  - `cradleAngle()` finds a common finger angle at which the fingers rest on it with the tips under its middle.
  - A prize only pinched at the top isn't caught: the claw rises without it. Before this rule, such prizes were carried hanging off the tips and dropped on the jolt of the lift.
- Once caught, the prize rides in the claw (`claw.hold`: its offset in the claw frame and the cradle flex). `carry()` evens the fingers out to the cradle angle and slides the prize to the middle, sideways only, never up, at `HOLD_SETTLE`. That is what linked fingers would do, and it isn't a magnet, since only prizes already wrapped by three fingers get there. A finger still pressing on a neighbour while lifting off the pile gives way to it.
- `claw.q` is the grip quality (1 = dead centre). `slip()` uses it (rate `.015 + (1 - q) * .08` per second, gold prizes 1.6×).
  - A slip `detach()`es the prize, making it a loose body with the claw's velocity, and sets `claw.slipping` to it.
  - The fingers ease open (`loosen()`) until the tips clear it (`tipsClear()`).
  - There is no on-screen text for a slip: the user asked to remove the old "¡Uy!" pop and the claw's sudden half-open snap (October 2026).
- Releasing over the hole detaches the prize the same way; the `settle` state first waits (up to 1 s) for the swing to die down, since a released prize keeps the claw's velocity.
- Measured with 45 rounds aiming at capsules away from the walls: about 15–17 catches and 17 deliveries (some deliveries are capsules nudged into the hole). Every carried prize sat in all four fingers, 5–20% of its radius off the axis.

### Capsules

Capsule count and sizes are tuned to the claw. The user noticed small capsules escaping between the fingers and big ones hard to grab (October 2026). Measured by size, with three fingers, 26 capsules and radius 0.27–0.36:
- The capsules covered about 86% of the floor, a tight carpet where the open claw lands on neighbours and only pinches tops.
- Small ones sat too low to reach: 4 targets in 18 tries.
- Big ones squeezed out sideways: 10 of 12 grabs.
- Between two closed fingers of three there was a gap of about 0.44–0.6, enough for a 0.58-wide capsule.

Now there are four fingers (gap about 0.34–0.48) and radius `R_MIN`–`R_MAX` (0.29–0.32). `PRIZE_COUNT` is 22, after the user asked for more capsules; with 26 the floor is a tight carpet again. When fewer than `RESTOCK_BELOW` remain, enough fall from the top to get back to `PRIZE_COUNT`.

### Scoring and the rest

- A prize that falls below y = -0.75 counts in `win()`: 1 point, 5 for a gold (rare) one.
- `fit()` backs the camera off until the machine fits between the HUD and the controls and centres it there with `setViewOffset`; on wide screens (`body.wide`) the controls go to the bottom corners.
- The best score is kept in `localStorage` under `clawMachine.best` (wrapped in try/catch).
- Sounds are synthesised with WebAudio in `sfx()`; there are no audio files yet.

Controls: arrows or WASD to move (up/W moves the claw back, away from the camera), Space or Enter to drop; on screen, the d-pad and the ¡BAJAR! button.
