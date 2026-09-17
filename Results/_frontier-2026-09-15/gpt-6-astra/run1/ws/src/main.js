import { Game } from "./Space_Invaders/Game.js";
import "./shared/ui/glass.css";
import "./Space_Invaders/game.css";
let game = new Game({ mount: document.querySelector("#app") });
try {
  game.initialize();
} catch (error) {
  console.error(error);
  game.dispose();
  const node =
    document.querySelector("#startup-status") ||
    document.body.appendChild(document.createElement("div"));
  node.id = "startup-status";
  node.textContent = `Unable to start: ${error.message}. Reload to retry.`;
}
if (import.meta.hot) {
  import.meta.hot.accept();
  import.meta.hot.dispose(() => {
    game.dispose();
    game = null;
  });
}
