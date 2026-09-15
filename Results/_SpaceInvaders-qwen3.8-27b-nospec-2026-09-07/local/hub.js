// hub.js — Neon Arcade roster. Renders the glassmorphism game grid.
// Status is derived from the filesystem: a title is READY when its
// index.html exists, otherwise PLANNED.

const ROSTER = [
  { dir: "Pong",            name: "PONG",            stars: 1, accent: "#00f0ff", desc: "PBR paddles, dynamic light trails, trauma-based camera on every impact." },
  { dir: "Snake",           name: "SNAKE",           stars: 1, accent: "#57ffb0", desc: "Procedural body grid, glowing PBR food, instanced segments." },
  { dir: "Breakout",        name: "BREAKOUT",        stars: 2, accent: "#ffb300", desc: "Brick shattering physics, heavy hit-stop, shockwave rings." },
  { dir: "Tetris",          name: "TETRIS",          stars: 2, accent: "#c77dff", desc: "3D block rotations, line-clear particle bursts, ghost piece." },
  { dir: "Space_Invaders",  name: "SPACE INVADERS",  stars: 3, accent: "#ff2d78", desc: "Enemy formation scaling, neon projectile trails, march cadence." },
  { dir: "Pac-Man",         name: "PAC-MAN",         stars: 3, accent: "#ffe600", desc: "Maze pathfinding, dynamic light-source ghosts, bloom-driven glow." },
  { dir: "Asteroids",       name: "ASTEROIDS",       stars: 3, accent: "#9adcff", desc: "Procedural geometry displacement, rock fracturing, thruster trails." },
  { dir: "Frogger",         name: "FROGGER",         stars: 3, accent: "#39ff88", desc: "Procedural water shaders, traffic timing, log riding." },
  { dir: "Centipede",       name: "CENTIPEDE",       stars: 4, accent: "#ff7a00", desc: "Articulated 3D body-segment kinematics, mushroom field." },
  { dir: "Galaga",           name: "GALAGA",          stars: 4, accent: "#ff00e6", desc: "Bezier-curve dive patterns, volumetric tractor beams." },
  { dir: "Defender",        name: "DEFENDER",        stars: 5, accent: "#00ffc8", desc: "Endless side-scrolling 3D terrain generation, wrap-around arena." },
  { dir: "Donkey_Kong",     name: "DONKEY KONG",     stars: 5, accent: "#ff5533", desc: "Custom platforming physics, jump-curve derivatives, barrel AI." },
  { dir: "Paperboy",        name: "PAPERBOY",        stars: 5, accent: "#ffd23f", desc: "Suburban 3D world, projectile arc physics, isometric tracking." },
  { dir: "TMNT",            name: "TMNT",            stars: 6, accent: "#35d435", desc: "Multi-entity 3D combat, state machines, hit-stun, boss AI." },
];

const grid = document.getElementById("grid");

function starsHtml(n) {
  let out = "";
  for (let i = 1; i <= 6; i++) {
    out += i <= n ? "★" : `<span class="dim">★</span>`;
  }
  return out;
}

for (const g of ROSTER) {
  const a = document.createElement("a");
  a.className = "card";
  a.href = `/${g.dir}/index.html`;
  a.style.setProperty("--accent", g.accent);
  a.innerHTML = `
    <span class="status planned">PLANNED</span>
    <div class="num">${String(ROSTER.indexOf(g) + 1).padStart(2, "0")}</div>
    <div class="name">${g.name}</div>
    <div class="desc">${g.desc}</div>
    <div class="stars">${starsHtml(g.stars)}</div>
  `;
  grid.appendChild(a);
}

// Probe the filesystem (via the dev server) to flip PLANNED → READY.
// Vite falls back to the SPA index.html for missing paths, so a real game
// page is only confirmed when the response is a module script (text/javascript).
for (let i = 0; i < ROSTER.length; i++) {
  const g = ROSTER[i];
  fetch(`/${g.dir}/main.js`)
    .then((r) => {
      const isModule = (r.headers.get("content-type") || "").includes("javascript");
      if (r.ok && isModule) {
        const badge = grid.children[i].querySelector(".status");
        badge.textContent = "READY";
        badge.classList.remove("planned");
        badge.classList.add("ready");
      }
    })
    .catch(() => { /* not built yet — stays PLANNED */ });
}
