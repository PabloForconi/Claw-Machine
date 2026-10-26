# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

HTML game prototype: a claw machine full of capsule toys. All the code lives in `index.html` (inline CSS and JS, no dependencies, no build step). The only external resource is the Google Fonts font Kalam (bold, 700), with a cursive fallback, used for the whole UI, the same font as the sibling prototype `../Laberinto` (Maze Mouse). UI text is in Spanish (rioplatense: "Tocá", "querés").

To run it, open `index.html` in a browser; there is no server or build.

## How the game works

- The canvas uses a fixed logical size (`W`×`H`, 480×760) and `fit()` scales it to the window; all geometry constants (`BOX`, `CHUTE`, `RAIL_Y`) are in those units.
- `physics()` is a small fixed-step (`STEP`, 1/120 s) circle simulation: gravity, the glass walls, the floor (absent over the chute), the chute post, prize-to-prize collisions, and the claw head and fingers as kinematic circles (`colliders()`). A held prize has zero weight in `collide()` so it pushes the others.
- `update()` is the claw state machine: `idle` → `aim` (costs one coin, `AIM_TIME` seconds, auto-drops when it runs out) → `drop` → `close` → `lift` → `return` → `release` → `wait` → `idle`, or `over` when the coins run out.
- `pickGrab()` decides the grab when the claw closes; `claw.q` is the grip quality (1 = dead centre) and `slip()` uses it, with gold prizes slipping more often.
- A prize that falls through the chute counts in `win()`: 1 point, 5 for a gold (rare) one. When fewer than 8 prizes remain, 10 more fall from the top.
- The best score is kept in `localStorage` under `clawMachine.best` (wrapped in try/catch).
- Sounds are synthesised with WebAudio in `sfx()`; there are no audio files yet.

Controls: arrows or A/D to move, Space/Down/Enter/S to drop; on screen, the ◀ ¡BAJAR! ▶ buttons.
