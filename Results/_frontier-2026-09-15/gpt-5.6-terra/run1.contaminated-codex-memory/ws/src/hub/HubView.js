import { GAMES } from "./GameRegistry.js";

function makeElement(tagName, className, text) {
  const node = document.createElement(tagName);
  if (className) {
    node.className = className;
  }
  if (text !== undefined) {
    node.textContent = text;
  }
  return node;
}

function cabinetLabel(game) {
  return game.available ? "Ready to launch" : "Scheduled cabinet";
}

export class HubView {
  constructor({ onLaunch, onLocked } = {}) {
    this.onLaunch = typeof onLaunch === "function" ? onLaunch : () => {};
    this.onLocked = typeof onLocked === "function" ? onLocked : () => {};
    this.root = null;
    this.message = null;
    this.launchButtons = new Map();
    this.abortController = null;
  }

  mount(container) {
    if (!(container instanceof Element)) {
      throw new TypeError("HubView.mount requires a DOM container.");
    }
    this.dispose();

    this.abortController = new AbortController();
    const signal = this.abortController.signal;
    const root = makeElement("section", "arcade-hub");
    root.dataset.route = "hub";
    root.setAttribute("aria-labelledby", "arcade-title");

    const topLine = makeElement("div", "arcade-hub__topline");
    const brand = makeElement("div", "arcade-hub__brand");
    brand.append(
      makeElement("span", "arcade-hub__brand-mark"),
      makeElement("p", "arcade-hub__brand-name", "Retro-Futurism Arcade"),
    );
    const signalLine = makeElement("span", "signal-line signal-line--live", "Network synchronized");
    signalLine.setAttribute("aria-label", "Arcade network synchronized");
    topLine.append(brand, signalLine);

    const hero = makeElement("header", "arcade-hub__hero");
    const copy = makeElement("div", "arcade-hub__hero-copy");
    copy.append(
      makeElement("p", "eyebrow", "Orbital collection // season one"),
      makeElement("h1", null, "Select a cabinet"),
      makeElement(
        "p",
        null,
        "One signal is live. Enter the invasion theater; the rest of the collection remains on the launch calendar.",
      ),
    );
    copy.querySelector("h1")?.setAttribute("id", "arcade-title");

    const quickLaunch = makeElement("button", "neon-button neon-button--primary", "Launch Space Invaders");
    quickLaunch.type = "button";
    quickLaunch.dataset.gameId = "Space_Invaders";
    quickLaunch.setAttribute("aria-label", "Launch Space Invaders");
    quickLaunch.addEventListener("click", () => this.requestLaunch("Space_Invaders"), { signal });
    hero.append(copy, quickLaunch);

    const collectionLabel = makeElement("div", "arcade-hub__collection-label");
    collectionLabel.append(
      makeElement("span", null, "Cabinet grid"),
      makeElement("span", null, "01 live / 13 scheduled"),
    );

    const grid = makeElement("div", "cabinet-grid");
    grid.setAttribute("role", "list");
    grid.setAttribute("aria-label", "Arcade cabinet collection");
    for (const game of GAMES) {
      const button = this.createCabinet(game, signal);
      grid.append(button);
      if (game.available) {
        this.launchButtons.set(game.id, button);
      }
    }

    const footer = makeElement("footer", "arcade-hub__footer");
    this.message = makeElement("p", "arcade-hub__message", "Space Invaders signal is available.");
    this.message.setAttribute("aria-live", "polite");
    footer.append(
      this.message,
      makeElement("span", null, "Keyboard + gamepad ready // press Enter to fire"),
    );

    root.append(topLine, hero, collectionLabel, grid, footer);
    container.append(root);
    this.root = root;
    return this;
  }

  createCabinet(game, signal) {
    const button = makeElement(
      "button",
      `cabinet cabinet--${game.available ? "available" : "locked"}`,
    );
    button.type = "button";
    button.dataset.gameId = game.id;
    button.dataset.available = String(game.available);
    button.setAttribute("role", "listitem");
    button.setAttribute("aria-label", `${game.title}. ${cabinetLabel(game)}.`);
    button.setAttribute("aria-describedby", `cabinet-status-${game.cabinet}`);
    button.disabled = !game.available;

    const serial = makeElement("p", "cabinet__serial", `CABINET // ${game.cabinet}`);
    const screen = makeElement(
      "div",
      "cabinet__screen",
      game.available ? "Transmission live" : "Awaiting deployment",
    );
    screen.setAttribute("aria-hidden", "true");
    const title = makeElement("h2", "cabinet__title", game.title);
    const status = makeElement("p", "cabinet__status", game.available ? "Live now" : "Coming soon");
    status.id = `cabinet-status-${game.cabinet}`;
    button.append(serial, screen, title, status);

    button.addEventListener(
      "click",
      () => {
        if (game.available) {
          this.requestLaunch(game.id);
        } else {
          this.announce(`${game.title} is scheduled. Space Invaders is the only live cabinet.`);
          this.onLocked(game);
        }
      },
      { signal },
    );
    return button;
  }

  requestLaunch(id) {
    const game = GAMES.find((candidate) => candidate.id === id);
    if (!game || !game.available) {
      return;
    }
    this.setLoading(id, true);
    this.announce(`Opening ${game.title}…`);
    Promise.resolve(this.onLaunch(id)).catch((error) => {
      this.setLoading(id, false);
      this.announce(error instanceof Error ? error.message : `Unable to open ${game.title}.`);
    });
  }

  setLoading(id, loading) {
    const button = this.launchButtons.get(id);
    if (!button) {
      return;
    }
    button.disabled = loading;
    button.classList.toggle("is-loading", loading);
    button.setAttribute("aria-busy", String(loading));
    const status = button.querySelector(".cabinet__status");
    if (status) {
      status.textContent = loading ? "Calibrating" : "Live now";
    }
  }

  announce(message) {
    if (this.message) {
      this.message.textContent = message;
    }
  }

  dispose() {
    this.abortController?.abort();
    this.abortController = null;
    this.root?.remove();
    this.root = null;
    this.message = null;
    this.launchButtons.clear();
  }
}

export default HubView;
