import { Engine } from '../../shared/Engine';
import { SpaceInvadersScene } from './SpaceInvadersScene';
import { HUD } from './ui/HUD';

const hud = new HUD();
hud.init();

const engine = new Engine({
  width: window.innerWidth,
  height: window.innerHeight,
});

const scene = new SpaceInvadersScene(engine);
scene.init(hud);
engine.setGameLoop(scene.gameLoop.bind(scene));

// Handle resize
window.addEventListener('resize', () => {
  const w = window.innerWidth;
  const h = window.innerHeight;
  engine.resize(w, h);
});
