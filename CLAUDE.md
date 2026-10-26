# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Browser 3D game prototype: a claw machine full of capsule toys. The user asked for it in 3D (an earlier 2D canvas version was replaced). All the code lives in `index.html` (inline CSS and an inline ES module, no build step). External resources: Three.js 0.170.0 from jsDelivr through an import map (`three` and `three/addons/`, only `RoundedBoxGeometry` is used from the addons), and the Google Fonts font Kalam (bold, 700) with a cursive fallback, the same UI font as the sibling prototype `../Laberinto` (Maze Mouse). UI text is in Spanish (rioplatense: "Tocá", "querés").

To run it, open `index.html` in a browser; it needs internet for Three.js and the font. `window.game` exposes the state, the claw, the prizes, `startRound` and `startDrop` for poking at it from the console.

## How the game works

- World units: the glass box is x ∈ [-2, 2], z ∈ [-1.5, 1.5] (z+ is towards the camera), floor at y = 0. The prize hole is the front-left corner (`HOLE`: x < -1.1 and z > 0.6), fenced by two clear walls (`WALLS`, axis-aligned boxes). The claw returns to `HOME`, the centre of the hole.
- The machine is built from plain boxes in the "Machine" section; the floor slab is two boxes forming an L so the hole stays open, and `holeIn` is a back-side box that shows the dark inside of the hole. Marquee and prize door labels are canvas textures, repainted once Kalam loads.
- `physics()` is a small fixed-step (`STEP`, 1/120 s) sphere simulation written by hand (no physics library): gravity, the glass walls, the floor (absent over the hole), the hole walls, prize-to-prize collisions, and the claw head and finger segments as kinematic spheres (`colliders()`). A held prize has zero weight in `collide()` so it pushes the others. Prizes are rotated from their horizontal speed so they look like they roll.
- A straight-down shadow-casting light (`top`) puts the claw's shadow right under it; that shadow is how the player judges depth, so keep it if the lighting changes.
- `update()` is the claw state machine: `idle` → `aim` (costs one coin, `AIM_TIME` seconds, moves in x and z, auto-drops when time runs out) → `drop` → `close` → `lift` → `return` → `release` → `wait` → `idle`, or `over` when the coins run out.
- The claw has three fingers (`FINGER_ANGLES`); `fingers()` gives each one's pivot, knee and tip from `claw.open`, and `syncClaw()` places the cylinder meshes between them.
- `pickGrab()` decides the grab when the claw closes; `claw.q` is the grip quality (1 = dead centre) and `slip()` uses it, with gold prizes slipping more often.
- A prize that falls below y = -0.75 counts in `win()`: 1 point, 5 for a gold (rare) one. When fewer than 10 prizes remain, 12 more fall from the top.
- `fit()` backs the camera off until the machine fits between the HUD and the controls and centres it there with `setViewOffset`; on wide screens (`body.wide`) the controls go to the bottom corners.
- The best score is kept in `localStorage` under `clawMachine.best` (wrapped in try/catch).
- Sounds are synthesised with WebAudio in `sfx()`; there are no audio files yet.

Controls: arrows or WASD to move (up/W moves the claw back, away from the camera), Space or Enter to drop; on screen, the d-pad and the ¡BAJAR! button.
