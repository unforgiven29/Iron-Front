import { mountDebugPage } from "./app/DebugPage.js";
import { mountGameScreen } from "./app/GameScreen.js";
import "./styles.css";

const root = document.querySelector<HTMLDivElement>("#app");
if (!root) throw new Error("Application root element #app was not found.");

// "/" is the game; "#debug" is the developer tools page. Switching routes reloads cleanly.
if (window.location.hash === "#debug") mountDebugPage(root);
else mountGameScreen(root);
window.addEventListener("hashchange", () => window.location.reload());
