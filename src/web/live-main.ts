import { App } from "./app.js";
import { h } from "./dom.js";
import { liveBackend, ROAD_SKIPPED } from "./live-ports.js";
import { PLANS_FROM, ROAD_PATH, roadPath } from "../shared/door.js";

const skipped = ((): boolean => { try { const kept = sessionStorage.getItem(ROAD_SKIPPED) !== null; sessionStorage.removeItem(ROAD_SKIPPED); return kept; } catch { return false; } })();
const root = h("div", { class: "app" });
document.body.append(root);
await new App(root, liveBackend(), { skipped, go: (checkout, link) => location.replace(roadPath(checkout, link)), plans: () => location.assign(`${ROAD_PATH}?${PLANS_FROM}`) }).start();
