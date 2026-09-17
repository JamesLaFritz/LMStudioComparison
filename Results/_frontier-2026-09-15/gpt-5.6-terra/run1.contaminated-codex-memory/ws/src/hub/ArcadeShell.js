import { getGameById, loadGame } from "./GameRegistry.js";
import { HubView } from "./HubView.js";

function createNode(tagName, className, text) {
  const node = document.createElement(tagName);
  if (className) {
    node.className = className;
  }
  if (text !== undefined) {
    node.textContent = text;
  }
  return node;
}

export class ArcadeShell {
  constructor(host) {
    if (!(host instanceof Element)) {
      throw new TypeError("ArcadeShell requires a DOM host element.");
    }
    this.host = host;
    this.root = null;
    this.hub = null;
    this.stage = null;
    this.activeGame = null;
    this.activeGameId = null;
    this.transition = 0;
    this.mounted = false;
    this.handleExitRequest = () => {
      void this.showHub();
    };
  }

  mount() {
    if (this.mounted) {
      return this;
    }
    this.mounted = true;
    this.host.replaceChildren();
    this.root = createNode("main", "arcade-shell");
    this.root.dataset.route = "hub";
    this.host.append(this.root);
    this.root.addEventListener("arcade:exit-game", this.handleExitRequest);
    this.renderHub();
    return this;
  }

  renderHub(message) {
    if (!this.root || !this.mounted) {
      return;
    }
    this.stage?.remove();
    this.stage = null;
    this.hub?.dispose();
    this.hub = new HubView({
      onLaunch: (id) => this.launchGame(id),
      onLocked: (game) => this.root?.dispatchEvent(
        new CustomEvent("arcade:locked-cabinet", { detail: { game } }),
      ),
    });
    this.hub.mount(this.root);
    if (message) {
      this.hub.announce(message);
    }
    this.root.dataset.route = "hub";
    this.activeGameId = null;
    this.dispatchRouteChange("hub");
  }

  async launchGame(id) {
    if (!this.mounted || this.activeGameId === id) {
      return this.activeGame;
    }
    const game = getGameById(id);
    if (!game?.available) {
      this.hub?.announce(game ? `${game.title} is scheduled.` : "Unknown cabinet.");
      return null;
    }

    const transition = ++this.transition;
    this.hub?.setLoading(id, true);
    let instance = null;
    try {
      const createGame = await loadGame(id);
      if (!this.mounted || transition !== this.transition) {
        return null;
      }

      const stage = createNode("section", "arcade-stage");
      stage.dataset.route = id;
      stage.setAttribute("aria-label", `${game.title} game stage`);
      const returnButton = createNode("button", "arcade-return neon-button", "Return to arcade");
      returnButton.type = "button";
      returnButton.setAttribute("aria-label", "Return to arcade cabinet selection");
      returnButton.addEventListener("click", this.handleExitRequest, { once: true });
      stage.append(returnButton);

      instance = await createGame({
        onExit: this.handleExitRequest,
        onReady: () => this.dispatchRouteChange(id, { ready: true }),
      });
      if (!instance || typeof instance.mount !== "function" || typeof instance.unmount !== "function") {
        throw new Error(`${game.title} returned an invalid game session.`);
      }
      if (!this.mounted || transition !== this.transition) {
        await instance.unmount();
        return null;
      }

      this.hub?.dispose();
      this.hub = null;
      this.root.append(stage);
      this.stage = stage;
      this.activeGame = instance;
      this.activeGameId = id;
      this.root.dataset.route = id;
      await instance.mount(stage);
      if (!this.mounted || transition !== this.transition) {
        await this.disposeActiveGame();
        return null;
      }
      this.dispatchRouteChange(id);
      return instance;
    } catch (error) {
      if (instance && typeof instance.unmount === "function") {
        await instance.unmount();
      }
      if (this.mounted && transition === this.transition) {
        this.renderHub(error instanceof Error ? error.message : `Unable to launch ${game.title}.`);
      }
      return null;
    }
  }

  async showHub() {
    if (!this.mounted) {
      return;
    }
    ++this.transition;
    await this.disposeActiveGame();
    if (this.mounted) {
      this.renderHub();
    }
  }

  async disposeActiveGame() {
    const active = this.activeGame;
    this.activeGame = null;
    this.activeGameId = null;
    if (active && typeof active.unmount === "function") {
      await active.unmount();
    }
    this.stage?.remove();
    this.stage = null;
  }

  dispatchRouteChange(route, detail = {}) {
    if (!this.root) {
      return;
    }
    this.root.dispatchEvent(
      new CustomEvent("arcade:routechange", {
        detail: { route, ...detail },
      }),
    );
  }

  async unmount() {
    if (!this.mounted) {
      return;
    }
    this.mounted = false;
    ++this.transition;
    this.root?.removeEventListener("arcade:exit-game", this.handleExitRequest);
    this.hub?.dispose();
    this.hub = null;
    await this.disposeActiveGame();
    this.root?.remove();
    this.root = null;
    this.host.replaceChildren();
  }

  dispose() {
    return this.unmount();
  }
}

export default ArcadeShell;
