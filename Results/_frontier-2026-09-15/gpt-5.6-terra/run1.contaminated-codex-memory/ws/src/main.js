import "./styles/app.css";
import "./styles/glass.css";
import "./styles/space-invaders.css";
import { ArcadeShell } from "./hub/ArcadeShell.js";

function renderBootFailure(host, error) {
  host.replaceChildren();

  const panel = document.createElement("section");
  panel.className = "boot-failure glass-panel";
  panel.setAttribute("role", "alert");

  const eyebrow = document.createElement("p");
  eyebrow.className = "eyebrow";
  eyebrow.textContent = "SYSTEM INTERRUPTION";

  const title = document.createElement("h1");
  title.textContent = "ARCADE OFFLINE";

  const detail = document.createElement("p");
  detail.className = "boot-failure__detail";
  detail.textContent = error instanceof Error ? error.message : "The arcade could not start.";

  const retry = document.createElement("button");
  retry.type = "button";
  retry.className = "neon-button neon-button--primary";
  retry.textContent = "REBOOT ARCADE";
  retry.addEventListener("click", () => window.location.reload());

  panel.append(eyebrow, title, detail, retry);
  host.append(panel);
}

function boot() {
  const host = document.getElementById("app");
  if (!host) {
    throw new Error("The #app mount node is missing.");
  }

  try {
    const shell = new ArcadeShell(host);
    shell.mount();
    window.__arcadeShell = shell;
    window.addEventListener("beforeunload", () => shell.unmount(), { once: true });
  } catch (error) {
    renderBootFailure(host, error);
    console.error("Retro-Futurism Arcade failed to boot.", error);
  }
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", boot, { once: true });
} else {
  boot();
}
