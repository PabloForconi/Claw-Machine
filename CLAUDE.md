# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Browser 3D game prototype: a claw machine full of capsule toys. The user asked for it in 3D (an earlier 2D canvas version was replaced). All the code lives in `index.html` (inline CSS and an inline ES module, no build step). External resources: Three.js 0.170.0 from jsDelivr through an import map (`three` only, no addons), and the Google Fonts font Kalam (bold, 700) with a cursive fallback, the same UI font as the sibling prototype `../Laberinto` (Maze Mouse). UI text is in Spanish (rioplatense: "Tocá", "querés").

To run it, open `index.html` in a browser; it needs internet for Three.js and the font. It is published with GitHub Pages from `main` (the repo is public, like `../Laberinto`): https://pabloforconi.github.io/Claw-Machine/. Every push to `main` redeploys it in about a minute.

### Testing from the console

`window.game` exposes the state, the claw, the prizes, `startRound`, `startDrop` and `segments`, plus a few test helpers:
- `step(n)` runs n simulation steps synchronously. Use it for tests: frame-driven tests crawl in the in-app browser pane, which often throttles animation frames to one every 0.3–1.7 s (the game itself takes about 25 ms per frame).
- `paused = true` stops the frame loop from advancing the simulation (it still draws), so you can step by hand.
- `draw()` draws right away.
- `closeUp(x, y, z, dist)` points the camera at a spot to inspect the claw; `fit()` puts the normal view back.

The pane only repaints while its tab is fronted (`tabs_select`); otherwise screenshots show a stale frame.

`game.claw` is replaced on `reset()` (and so by `game.startLevel(i)`), so read it again after a reset. `game.level` and `game.got` show the level being played and what was won towards it, `game.collection` is the gallery's (editable, to test seasons), and `game.startDaily()` starts the daily challenge. In the in-app browser's `data:` preview `localStorage` is disabled, so cleared levels and the gallery are only kept until the page reloads (and editing `index.html` reloads it). With 66 capsules a round is about 900 steps (1.5 s of work), so keep test batches to about 8 rounds per browser tool call, or the call times out ("Internal error").

## How the game works

- World units: the glass box is x ∈ [-2, 2], z ∈ [-1.5, 1.5] (z+ is towards the camera), floor at y = 0. The prize hole is the front-left corner (`HOLE`: x < -1.1 and z > 0.6), fenced by two clear walls (`WALLS`, axis-aligned boxes). The claw returns to `HOME`, the centre of the hole.
- The machine is built from plain boxes in the "Machine" section, all with sharp edges, and the marquee lights are little square boxes. The user asked for fewer polygons to match the claw's flat, simple look (October 2026); the base, pillars and roof used to be rounded and the lights were spheres. The capsules keep their round shape, and the shadows are unchanged. the floor slab is two boxes forming an L so the hole stays open, and `holeIn` is a back-side box that shows the dark inside of the hole. The marquee and the scoreboard are canvas textures, repainted once Kalam loads.
- Screen layout (the user asked for more view of the game, October 2026):
  - There is no HTML HUD at the top. Coins, the level and its goal, time and the idle hint are a scoreboard on the front of the machine's base (`board`, `boardTex`, where a "PREMIOS" door label used to be). `hud()` repaints it only when a value changes. Only the controls and the game-over card are HTML.
  - The marquee is a thin strip (`MARQUEE_H`).
  - The camera sits about 20° above level (`CAM_DIR`; it was 30°).
- `update()` is the claw state machine: `idle` → `aim` (costs one coin, `AIM_TIME` seconds, moves in x and z, auto-drops when time runs out) → `drop` → `close` → `lift` → `return` → `settle` → `release` → `wait` → `idle`, or `over` when the coins run out.
  - `FREE_PLAY` (off since the levels, which each give their coins; the user had it on for a while to test, October 2026): rounds cost nothing, the board shows ∞, the hint drops "(1 ficha)", and a level is never lost.
  - The user asked to start the next round sooner (October 2026). `wait` lasts `WAIT_TIME` (0.3 s; it was 1.2), and `settle` lets go at once when the claw is empty. A released prize can now score just after the next round becomes available, while it is still falling.
- A straight-down shadow-casting light (`top`) puts the claw's shadow right under it; that shadow is how the player judges depth, so keep it if the lighting changes.

### Physics

`physics()` is a small rigid-body contact solver for the spheres, written by hand (no physics library), run every fixed step (`STEP`, 1/120 s). The user asked for better collisions and physics (October 2026); before it, it was plain position pushes without friction, and spheres sank up to 0.08 into each other under the claw.
- Each step: gravity, then `findContacts()` (with `MARGIN`, so resting contacts are found every step; prize pairs come from the `prizeGrid()` neighbour grid). `solveContacts()` runs `SOLVER_ITERS` passes of normal impulses (restitution `BOUNCE` only above `BOUNCE_MIN`, gaps allowed to close but not overshoot) and Coulomb friction (`MU`) at the contact point. Then the bodies move and spin, and `separate()` runs `POS_ITERS` passes that push apart what still overlaps, without adding velocity.
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
  - The first slack plays the landing clank. When lifting, the winch reels the slack in before it pulls (about 0.4 s); meanwhile the claw stays resting where it closed (`swingHead()` freezes it while `len > dist`). Left free, it sank into the pile by up to 0.3, a dip the user noticed (October 2026). Stopping at the top (`L_MIN`) makes the head bounce.
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
  - `OPEN_ANGLE` (0.4 rad) is how far the motor swings the fingers out. The wider the open claw, the more neighbours it lands on and the fewer catches.
    - With the second knee far out, 0.65 gave 14 deliveries in 45 rounds and 0.5 gave 18.
    - The user asked for it to open a little less (October 2026), so it went 0.5 → 0.4. Over the same seeded piles and aims, 0.4 delivered 15 of 32 rounds and 0.5 delivered 8, so the game got easier.
    - For a fair comparison, seed `Math.random` (e.g. mulberry32) and reset with `game.startLevel(game.level)` before each batch: the pile and the aims then repeat exactly.
  - `HEAD_MIN_Y` comes from `FINGER_REACH`, the deepest finger point open or closed.
  - The material is `CHROME`, not too metallic: there is no environment map, so a high metalness renders almost black.
- The claw has three fingers (`FINGER_ANGLES`, one at the back). It had four for a while, against capsules slipping out between two fingers; the user asked for three again once a caught prize rode in the claw (October 2026).
  - `fingers()` gives each finger's points along `FINGER_SHAPE` (`pts`; `p` is the hinge, `t` the tip). They are rotated by `claw.open` (the motor) plus that finger's own `claw.flex[i]` (its give), capped at `FLEX_MAX_ANGLE`.
  - `fingerRods()` gives the straight stretches, used for collisions and drawing.
  - Code that loops over fingers uses `FINGER_ANGLES.length`.
- Finger give (`flexFingers()`, every step while not carrying):
  - A finger pressing into a prize, the one under the claw included, swings up and out (`FLEX_GAIN` per unit of overlap, up to `FLEX_MAX`) until it rests on it instead of digging in.
  - It springs back at `FLEX_RETURN` only as far as it stays clear, and not while a prize slips out or the claw lets go.
  - A finger is never pushed open faster than `FLEX_RATE`. While the claw comes down, the fingers are linked: each follows at least `FLEX_LINK` of the most-opened one.
    - The user saw a single finger flick open out of nowhere during the drop (October 2026). Hitting a capsule at drop speed, one finger used to give way about 0.4 rad in a tenth of a second while the others stayed put.
    - Now nothing snaps and no finger sits more than 0.3 rad wider than both others. Catches may be a little lower (about 31% vs 44% in small samples with a looser link).
  - So during the drop the fingers ride up over neighbours and the head reaches the capsule under it. When closing, the motor closes all the way (`open` → 0) and every finger ends up lying against whatever it met.
  - It closes hard, as the user asked (October 2026: the steady 2.2/s close felt soft and unreal). The motor speeds up at `CLOSE_ACC` to `CLOSE_SPEED`, so closing takes about 0.32 s instead of 0.45. The sweeping fingers shove the capsule under them about 0.05–0.25, as before, and it clacks shut (`sfx('clack')`).
  - The share of targets held stayed within noise: 5 of 15 targets, against 5 of 12 with the old close.
  - From landing until letting go (`gripFirm()`: drop once landed, close, lift, return, settle), the motor is strong. It used to start firm only at closing. While the landed claw settled into the pile, the fingers kept giving way and swung open steadily for a second, from about 0.5 to 1.5 rad, before closing; the user noticed it opening further before closing (October 2026). Now they stay about where they touched, and catches went up (9 of 16 delivered in a sample). A finger only gives way once it digs `CLOSE_GIVE` into something, so it shoves loose prizes aside instead. It springs back against prizes up to that same give, twice as fast. Once fully closed, the motor keeps squeezing for `CLOSE_HOLD` before lifting.
    - At first the firm grip only applied while closing. As the claw began to lift, the soft give came back and the fingers swung open again by up to 0.5 rad, which the user saw as the claw reopening at the bottom (October 2026).
    - Without this, a claw buried in a deep pile gave way to every capsule around it and finished "closed" with its fingers wider than when open (mean flex 1.06). The user saw it as the claw not closing (October 2026).
    - Now the fingers end at about 0.14 flex, and dig at most about 0.045 into a jammed capsule.
  - `FLEX_GAIN` 6 and `FLEX_MAX` 1.1 grab best. A faster or larger give left fingers splayed too wide to cradle, roughly halving catches, though fingers then dig into neighbours a bit less (up to about 0.07 now, rarely).
- `pickTarget()`, when closing starts, notes `claw.target`: the prize under the head (within 0.8 of its radius) whose top half the closed tips could reach.
- `grabTarget()`, when closing is done, catches it only if it is really held, judged by `cradle()` with all fingers at one angle and the prize centred. The prize must also be within 0.8 of its radius from the axis. There are two ways to be held:
  - The closed fingers would press into it: they rest on it a little open (the cradle angle), which holds it only if the tips end up under its middle. All fingers but one must touch it (`fingersOn()`).
  - It fits loose inside the closed fingers: it settles down onto the inward-bent tips, unless it would drop right through. `cradle()` lowers it in small steps to find where it first touches. A single deep probe misread short tips: past them the capsule touches nothing. All fingers but one must have closed round it. One left splayed on a neighbour closes in as the claw lifts off the pile; two would leave too wide a gap.
  - A prize only pinched at the top isn't caught: the claw rises without it. Before this rule, such prizes were carried hanging off the tips and dropped on the jolt of the lift.
- Once caught, the prize rides in the claw (`claw.hold`: its offset in the claw frame, where it started, the height it rests at (`cradle()`'s) and the cradle flex). It never moves up in the claw, so it isn't a magnet. `carry()` keeps it where it lay on the pile while the claw finishes closing and reels in its slack. Then, as the claw rises, the fingers come up under it and lift it once it is at its rest height.
  - On the way the fingers push it in towards the middle, only in proportion to how far they have risen, and never faster than `CENTER_SPEED`.
    - Tied to the rise alone, a capsule with little or no drop onto the fingers was snapped to the middle at up to 30 m/s. Its neighbours took that speed and flew nearly to the roof (the user saw it, October 2026).
    - Once lifted, its place in the claw is kept (`hold.ox`/`oz`), no longer measured from where it is in the world. Measured, it fell behind a claw moving sideways by a step's worth each step, until it hung 0.6 off to the side and dropped on the way back.
    - Now, over 24 rounds, 10 of 11 catches were delivered and no neighbour went faster than about 2.5 upwards.
  - Its velocity is its actual motion, so it is zero until it is lifted.
  - Earlier, `carry()` slid it down and to the middle at a steady rate from the moment it was caught. The user saw it as the capsule arranging itself inside the claw, not natural (October 2026).
  - Now it moves at most about 6 mm before the claw starts rising.
- Once lifted it isn't glued to the claw: `wobble()` moves it a little inside it (`claw.hold.wb`), driven by gravity minus the claw's own acceleration. The user found the carry too smooth (October 2026).
  - It rests on the fingers through a stiff spring (`WOBBLE.floorK`), so the cable taking the load makes it hop about 2–2.5 cm and bounce. The stop at the top makes it hop about 3 cm, up to the box (`WOBBLE.up`).
  - Sideways it rocks about 2 cm when the claw starts or brakes, and rolls back to the middle as in a bowl (`WOBBLE.k`, `WOBBLE.c`), within `WOBBLE.side`.
  - At rest it sinks about 2 mm into the fingers.
- The claw stays shut from closing until it lets go (a slip or the release), as the user asked (October 2026). No finger opens in `lift`, `return` or `settle`, with or without a prize: not under the prize's weight, nor against a neighbour as it lifts off the pile. Neighbours are pushed aside instead. `carry()` only lets a splayed finger close in to the cradle angle, at `HOLD_SETTLE`, and `flexFingers()` skips the give in those states.
  - A neighbour squeezed between a rigid finger and the caught prize (both immovable to it) was shot out of the wedge at up to 8. `physics()` caps how fast such a squeezed prize moves relative to the claw (`SQUEEZE_MAX`). With the cap, the fastest neighbour during the lift is about 1–2.5, against about 0.5–1.5 when the fingers gave way.
  - Before this, the fingers gave way by up to `CLOSE_GIVE` against neighbours while carrying. For a while there was also a `sag()`: the prize's weight pushed the closed fingers open about 0.17 rad so it sank onto the tips. That answered the user seeing the capsule "stuck to the top of the claw", but they then asked for the claw to stay closed.
  - With the fingers shut, a capsule about as wide as the closed claw rests where it first touches them, about 0.1 under the box.
  - Deliveries: 11 of 40 rounds, against 14 of 40 for the version just before. That is within noise; batches of 10 ranged from 1 to 7.
- `claw.q` is the grip quality (1 = dead centre). When a catch is made, `grabTarget()` settles whether it will be lost (`claw.lose`).
  - The chance is `LOSE_BASE + (1 - q) * LOSE_OFF`: about 4.5% dead centre, up to about 28% at the edge, with gold prizes 1.6×. It is about what the old per-second slips added up to over a carry, half each way.
    - With the levels the user asked to keep both kinds of loss at a more realistic rate (October 2026), so `LOSE_PATTERN` is `null`.
    - For testing it can be a pattern again, e.g. `['early', 'top', null]`: one lost on the way, one shaken loose at the top, one carried home. The user had it that way for a while. Only catches move it on (`caught`, reset by `reset()`); a round where the claw comes up empty is a normal round.
  - The claw never opens while it rises. A slip used to be able to start at any moment, mid-rise included, which the user found odd.
  - In both, the claw goes back to the hole as usual, without stopping, and the prize just falls with the claw's speed wherever that leaves it. The user wanted physics to do its job (October 2026); it often lands in the hole anyway. `slip()` runs both: `c.letGo` is the opening rate while a lost catch opens the claw, and `c.reshut` the closing that follows.
  - `'early'`: a moment after the claw sets off back, it opens at `LOSE_EARLY_RATE` (about 0.16 s, quicker than letting go over the hole).
    - The moment is once it has covered `LOSE_EARLY_AT` (40%) of the trip (`c.tripFrom`, the distance when the trip began): on a 2.5 trip, after about 1 m and 1 s.
    - It stays open; it arrives open, so `settle` goes straight to the open hold and it shuts over the hole.
    - The user turned down two earlier moments (October 2026). First it opened about 1.1 from the hole, just before arriving. Then it opened 0.35 s after setting off, and they said it let go before the claw had really moved.
    - With the claw's full speed the prize often flies on into the hole: in 3 tries out of 3 it did.
  - `'top'`: the winch overruns its stop (the lift reels towards 0 instead of `L_MIN`) and slams the claw's box into the carriage at the lift speed, about 1.8. A normal lift peaks about 0.02 under the stop and never touches it.
    - The blow is in `swingHead()`: the head bounces back down at `TOP_BOUNCE` of its speed, and `hitTop()` ends the lift, lets the cable back out to `L_MIN`, and knocks the fingers open at `TOP_KICK` times the impact speed, with a clank and a clunk.
    - It opens less than normal, only until the tips are `TOP_GAP` clear of the loose prize all round (`tipsWide()`, measured from the prize, wherever it is). The user asked for just enough for the ball to drop (October 2026). Measured: 0.63–0.74 of a full opening, reached in about 0.05 s.
    - It doesn't shut again until the prize is out below the tips (`c.dropping`); falling through the claw takes about 0.35 s. If the prize is still between the fingers `TOP_SHUT_IN` after the blow and not falling (caught on a tip), the claw opens further at `TOP_EASE` to let it down. That never happened in the tests.
    - The prize is detached at the blow with the speed it was rising at. Nothing places it after that: it rises about 5 cm until it knocks the box, which is coming back down, while the claw recoils about 9 cm on its cable. Then it falls out between the open fingers. After `TOP_SHUT_IN` the motor shuts the claw again on the way (`restClose()`).
  - Earlier tries, which the user turned down:
    - The claw opened at its highest point on its stretched cable (`c.topHit`), with no real blow and the prize held until the tips cleared it. The user didn't feel the hit shake it loose and asked for the box to hit the metal above and the prize to hop by physics (October 2026).
    - The claw stopped at the top to open and shut before heading back.
    - It let go early where a prize keeping the claw's speed would land short of the hole, which meant right as it set off.
    - The prize kept only part of the claw's speed, to drop short.
  - A slip sets `claw.slipping` to the prize. The fingers ease open (`loosen()`), and the prize stays in the claw until the tips clear it (`tipsClear()`). Only then does `detach()` make it a loose body with the claw's velocity, so it drops straight out.
  - It used to come loose as soon as the fingers started opening, lie on them, and get flung as they swung out and up. The user saw prizes "thrown" into the hole (October 2026).
  - There is no on-screen text for a slip: the user asked to remove the old "¡Uy!" pop and the claw's sudden half-open snap (October 2026).
- Releasing over the hole lets go the same way, once the tips clear the prize; the `settle` state first waits (up to 1 s) for the swing to die down, since a released prize keeps the claw's velocity.
- The claw is closed at the top and opens on the way down (`OPEN_RATE`, in `drop`); it is fully open well before it lands. After letting go it shuts again (`restClose()`, in `wait`, `idle` and `aim`).
- Letting go is mechanical: the motor speeds up (`RELEASE_ACC`) to `RELEASE_SPEED` and opens in about 0.35 s. The fingers hit their stop with a clunk, and `JOLT` kicks the head up on its cable, about 3 cm.
  - The claw then stays open `OPEN_HOLD` (0.5 s) and shuts like the grab: it speeds up to `CLOSE_SPEED` in about 0.3 s and stops with a clack and a smaller jolt. A short motor whine (`sfx('motor')`) starts each move. The next round can start during the hold; a drop opens the claw again.
  - Before, it hung open at the top and let go and closed at a steady, soft rate.
- History: both behaviours first came together with solid cabinet sides for the claw, a shorter carriage travel and a bigger glass box (commits c87a7e8–a82fa8e). The user found that version odd overall and asked to go back to 7553b71 (commit 16f124b). Then they asked for just these two behaviours again, on the original travel (`LIMIT` 1.7 x 1.2) with the claw free to poke into the back wall as before (October 2026). With them, 6 of 26 rounds delivered, the same as before.
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

Each capsule (`mkPrize()`) is two solid halves of one colour, gold for the rare ones, with a dark band where they meet. The user asked to drop the clear top half and the little toy inside it (October 2026). Now the radius is `R_MIN`–`R_MAX` (0.29–0.32). `PRIZE_COUNT` is 15 for now, as the user asked (October 2026), and `RESTOCK_BELOW` is 8. Before that it was 66, after the user asked for three times the 22 there were, and the notes below on the heap are from then.
- They no longer fit in one layer and heap up like in a real machine: about 1.1 high on average, up to about 1.8, over the hole walls' 1.1. `spawn()` drops them in layers of a dozen. A reset settles them for `SETTLE_STEPS` (about 0.7 s of work), and now and then one tips into the hole while settling.
- `findContacts()` uses a grid (`prizeGrid()`, cells of `CELL`) so each prize is only checked against its neighbours. A physics step takes about 1.7 ms with 66.
- With the heap, about 30% of rounds aiming at capsules deliver one (8 catches in 24 rounds).
- Earlier, with a single layer, 22 was the compromise and 26 made the floor a tight carpet where only tops could be pinched. When fewer than `RESTOCK_BELOW` remain, enough fall from the top to get back to `PRIZE_COUNT`.

### Scoring and the rest

- A prize that falls below y = -0.75 counts in `win()`, towards the level's goal and the gallery, with a jingle. It still adds points (1, 5 for a gold one, `score`), but they are no longer shown anywhere. The board's PUNTOS gave way to the goal, and the best score (`clawMachine.best`) was dropped with the game-over card. The floating "+1" / "+5 ¡Dorada!" text over the hole was removed at the user's request (October 2026).
  - Before that, the user reported a brief odd flash, "like text or numbers", on the inner hole wall just before the "+1". It wasn't reproduced and they said to look at it later.
- `fit()` frames the machine by projecting the cabinet's corners (`FIT_CORNERS`). It searches for the camera distance at which they just fit between the top of the screen and the controls, then centres them there with `setViewOffset`. This works for any camera angle and screen shape. On wide screens (`body.wide`) the controls go to the bottom corners and take no height. A fixed half-height guess stopped fitting when the camera was lowered, since the near base looks bigger.
- Levels: the user asked for goals of rising difficulty, each unlocking the next (October 2026), with limited coins per level and a levels screen. Then they asked for harder levels that stay fun, and approved a list of ideas to build in order of priority. The list stays a single run of 20 levels for now; the user said to split it into worlds later if it works.
  - `LEVELS` gives each level a goal (a list of `{ key, n }`: so many of a kind; `'any'` is any colour) and its coins. `cookLevel()` turns names into keys and fills in the star thresholds.
  - Twists a level can have:
    - `order`: only the next part of the goal counts (`goalNow()`); prizes out of order don't count.
    - `size`: its capsules' radius range. Small ones (0.25–0.27) slip between the fingers, big ones (0.34–0.36) squeeze out.
    - `traps`: bombs and skulls in the pile. `bonus`: +2 capsules, only in the first pile, or every restock would bring a new one.
    - `stands`: pedestals from `STANDS` (one, two or three apart, or `stairs`, three steps rising to the right), boxes at the back half of the floor (`STAND_Z`). `onTop` lists the kind set on each top (null for none), placed still.
      - The user asked for these as a recurring twist (October 2026). They replaced a clear wall across the middle, which the user didn't like.
    - `bury`: that kind lies in the back right corner (`BURY_AT`) under a heap, in a pile of `pile` (48).
    - `giant`: the boss, a big gold capsule (`SPECIAL.giant`, radius 0.36) that slips 3× more (`slip`).
      - At first it was 0.42, to be pushed into a hole with its walls taken away. Bigger than the closed claw, it rode up wedged in the fingers and overlapped them and the box; the user found the claw looked broken.
      - The user also disliked the hole without walls, and asked for the claw itself to stay as it was.
      - At 0.36 the claw holds it like any capsule when it comes down within about 0.15 of its middle. Further off, it doesn't lift it.
    - `tip`: a card at the start explaining what is new (`card()`).
  - The curve, as discussed with the user:
    - Each new thing first comes in an easy level with its tip.
    - A boss every five levels: the giant (5, and 20 with a pedestal), the gold on the pedestal (10), the buried gold (15). Pedestals come back as two (12), stairs (16) and three (18).
    - An easier level after each hard one.
  - The colours kept in one place (`lv.kept`: those `onTop` and `bury`) never appear elsewhere (`mkPrize()` rerolls them), and they aren't restocked.
  - Nothing falls in on its own when a level starts.
    - While a reset settles the pile, the hole has a floor (`findContacts()` with `withClaw` off). Whatever ends up over the hole is taken away before the level shows.
    - The placed prizes start still.
    - Checked on all 20 levels: no prize fell in during 5 s without playing, and the pedestal prizes stayed on top. The user had seen capsules drop in by themselves as a level started (October 2026).
  - `SPECIAL` holds the non-colour kinds; none of them go to the gallery. Each is a capsule with its sign printed round it (`shellMat()` draws a canvas texture per half).
    - The bomb (💣 on a red disc, dark shell) takes a coin and ends the streak.
    - The skull (💀) loses the level after `CLEAR_DELAY` (`lostTo`). The user asked for both kinds of trap.
    - The +2 capsule gives two coins.
    - A plain text "-1" sign wasn't readable on the capsule.
  - Stars: 1 to 3 for the coins left (`starsFor()`, thresholds `lv.stars`, by default a fifth and two fifths of the coins). The best per level is in `localStorage` (`clawMachine.stars`).
  - Streaks: `endRound()` judges a round when the next one starts, or before a level is lost, so a prize still dropping in counts.
    - A round whose prize counted for the goal (`roundGood`) adds to `streak`. `STREAK_N` (2) in a row win a coin.
    - The board's coins flash green for a coin won and red for a bomb (`flashCoins()`). While a streak is one short, the idle hint says so.
  - `startLevel(i, data)` resets for level `i` (or -1 with the daily challenge's data): coins, `got`, the streak, the pedestals (`setSolids()`, which fills `WALLS` with the hole walls plus the pedestal boxes), and `CELL` sized for the biggest capsule.
  - The pile: `needed(initial)` lists what the pile is short of. That is each kind the level still needs with `PILE_SPARE` (2) to spare, or 1 when the goal has more than three kinds, plus its traps. `spawn()` makes those first, avoiding the hole and the obstacles. In `wait` it restocks when the pile is low or short of something.
  - The end of a level: clearing it (`levelMet()` in `win()`) or the skull sets `endT`. After `CLEAR_DELAY`, `levelCard()` comes up. No round can start meanwhile.
    - Cleared: the stars, the coins left, what 3 stars needs, a new gallery season if one opened, "Siguiente nivel" and "Niveles". The stars and `levelsDone` are saved here.
    - Out of coins: `wait` waits for the pile to settle (at most `LOSE_WAIT`), then "¡Sin fichas!" with what was missing. The skull gives "¡La calavera!". Both have "Reintentar".
  - Safety caps added for the first, bigger giant, which rode up wedged in the closed fingers without being held: the jolt at the top shot it out at up to 27. They only matter in extreme cases.
    - Anything the claw pushes leaves it at most `CLAW_PUSH_MAX` (3) faster than the head.
    - Nothing moves faster than `MAX_SPEED` (9).
  - The board shows FICHAS, NIVEL n (or DESAFÍO DEL DÍA) with the goal and TIEMPO.
    - The goal is a capsule per kind and "won/needed", shrunk to fit; a kind asked for once is just its capsule, ticked once won.
    - An ordered goal has › between parts and the parts still to come dimmed.
  - The levels screen (`#levels`, the star `#lvlBtn`, top left) starts with the daily challenge. Then each level shows its goal, coins, twists as tags (`levelTags()`, JEFE for the bosses) and its status: its stars, ▶ open, or 🔒 locked.
    - The header totals the stars.
    - Picking one starts it; the one being played just goes back to it unless it is over.
    - "Volver a la máquina" or Escape goes back, and back to the level's card if it had ended. The game is paused and not drawn meanwhile (`screenOpen()`).
  - The daily challenge (`genDaily(day)`, `startDaily()`): a level made from the date with a seeded random (`mulberry32`), so it is the same all day.
    - It has two or three colours (sometimes a gold one) and one or two twists. The first pile is seeded too (`rnd` stands in for `Math.random` in the pile code).
    - The user wanted it to play alone, without comparing with anyone. `clawMachine.daily` keeps today's best stars and the run of days cleared in a row (`dailyDone()`).
  - Tested with a bot that aims at the highest prize of the right kind, dead centre or up to 0.15 off. It clears nearly everything with stars to spare, since real players are far less exact, so the coins need tuning by playing.
    - The pedestal and buried golds took 1–2 tries.
    - The 0.36 giant was held at the first try with aim up to 0.15 off. So level 5 has 7 coins, and the giant slips 3×.
    - The heap over the buried one is 2–4 capsules deep.
- The gallery is a second screen the user asked for (October 2026), with a shelf per season (`SEASONS`: Clásicas, Rayadas, Lunares).
  - The user asked for collections where finishing one unlocks a new season. One of each of the six kinds finishes a season (`seasonDone()`) and opens the next (`seasonsOpen()`).
    - Its capsules then turn up in the machine (`pickDesign()`): about half of the random ones, mostly the newest.
    - The card says so and the gallery button gets a dot (`.new`).
  - The kinds (`KINDS`) are the five `COLORS` plus gold, with Spanish names. Each prize carries its `kind` (its hex colour, or `'gold'`) and its `design`. Goals count the colour whatever the design.
  - `win()` adds a colour to `collection` (`clawMachine.collection`): plain ones under their kind, the others as `design:kind` (`colKey()`). It survives levels and new games.
  - `#galBtn` (top left, after the levels star) opens `#gallery`.
    - Each season is a 3-column shelf of slots with a CSS-drawn capsule (`.cap`, `.cap.stripes`, `.cap.dots`), the count and the name.
    - Kinds not won yet are dark silhouettes. A locked season shows ? and what opens it.
  - The seasons are a carousel (`#shelf`, horizontal scroll snap), as the user asked (October 2026). Each one fills the whole width.
    - The next one used to peek in at the side (86% wide), but on a computer the user saw it as the gallery being cut off.
    - Swipe, or the arrows and dots under it (`#galNav`, `showSeason()`).
    - With a mouse it is dragged like a swipe (`shelfDrag`, scroll snap off meanwhile). On release it goes to the next or previous season if it moved over 40 px, otherwise back.
    - It opens on the newest open season. `seasonIdx` is the one shown, read back from the scroll position once a swipe stops.
    - `#shelf` must stay `position: relative`, since the slides' `offsetLeft` is measured from it.
  - The gallery and the levels screen each have a button to the other (`#galToLvl`, `#lvlToGal`), as the user asked.
  - "Volver a la máquina" (`#galBack`) or Escape goes back, and back to the level's card if it had ended. While it is open the game is paused, not drawn, and the keys don't play.
- Sounds are synthesised with WebAudio in `sfx()`; there are no audio files yet.

Controls: arrows or WASD to move (up/W moves the claw back, away from the camera), Space or Enter to drop. On screen there is the pad and the ¡BAJAR! button.
- The pad (`#pad`, `stick`) is a joystick like the one in `../Laberinto`; it replaced a four-button d-pad, as the user asked (October 2026).
  - Its base rests in the pad area, jumps to where the finger lands, and the knob follows the finger up to `STICK_R`.
  - The direction steers the claw, and how far it is pushed sets the speed (dead zone `STICK_DEAD`).
  - Touching it while idle starts the round.
- The gear (`#gear`, top right) opens a settings panel (`#opts`) that pauses the game while open.
  - Its one option, "Pad a la derecha", swaps the pad and the button for right-handed players (`body.swap`, `row-reverse`).
  - The choice is kept in `localStorage` under `clawMachine.padRight`. In the in-app browser's `data:` preview storage is disabled, so it isn't remembered there.
