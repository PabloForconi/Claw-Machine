# Claw Machine

**Jugar:** https://pabloforconi.github.io/Claw-Machine/

Prototipo de juego 3D para el navegador: una máquina de garra llena de cápsulas. Todo está en `index.html`, sin build; usa Three.js desde CDN, así que se abre directo en el navegador (con internet).

## Cómo se juega

- Se juega por niveles (20): cada uno pide atrapar ciertas cápsulas (por ejemplo, 3 rosas) con una cantidad de fichas. Cada intento cuesta una ficha; si se terminan antes de cumplir, reintentás. Superar un nivel desbloquea el siguiente y da de 1 a 3 estrellas según las fichas que te sobran.
- Cada nivel puede traer algo nuevo, que se explica al empezar: bombas (💣, te sacan una ficha), calaveras (💀, perdés el nivel), cápsulas +2 (dos fichas más), objetivos en orden, cápsulas chicas o grandes, pedestales (uno, dos, tres o en escalera), una dorada enterrada y, cada cinco niveles, un jefe.
- Si sacás premios dos rondas seguidas, ganás una ficha.
- El desafío del día es un nivel distinto cada día, igual todo el día; cuenta cuántos días seguidos lo superaste.
- Mové la garra con el pad (o las flechas / WASD): izquierda-derecha y adelante-atrás; cuanto más lo empujás, más rápido va. Bajala con **¡BAJAR!** (o Espacio). Tenés 15 segundos por intento.
- Arriba a la izquierda: la ★ abre los niveles y el desafío del día, y la cápsula abre la galería, con una temporada de cápsulas por página (deslizá para ver las demás). Juntando una de cada en una temporada se abre la siguiente, y sus cápsulas empiezan a aparecer en la máquina.
- En ⚙ (arriba a la derecha) podés poner el pad a la derecha y el botón a la izquierda.
- Guiate por la sombra de la garra para saber dónde va a caer.
- Si la garra agarra la cápsula bien centrada es más difícil que se le resbale. Las doradas se resbalan más.
- El tablero de la máquina muestra las fichas, el nivel con su objetivo y el tiempo.
