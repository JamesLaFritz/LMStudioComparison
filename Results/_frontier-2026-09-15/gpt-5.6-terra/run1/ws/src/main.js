import './styles.css';
import { SpaceInvadersGame } from '@space/Game.js';

const mount = document.querySelector('#app');
const game = new SpaceInvadersGame(mount);
game.start();

if (import.meta.hot) {
  import.meta.hot.dispose(() => game.dispose());
}
