import { App } from "./app.js";
import { h } from "./dom.js";
import { liveBackend, ROAD_SKIPPED } from "./live-ports.js";
import { ROAD_PATH } from "../shared/door.js";

const skipped = ((): boolean => { try { const kept = sessionStorage.getItem(ROAD_SKIPPED) !== null; sessionStorage.removeItem(ROAD_SKIPPED); return kept; } catch { return false; } })();
const root = h("div", { class: "app" });
document.body.append(root);
await new App(root, liveBackend(), { skipped, go: (checkout) => location.replace(checkout === undefined ? ROAD_PATH : `${ROAD_PATH}?checkout=${encodeURIComponent(checkout)}`) }).start();
