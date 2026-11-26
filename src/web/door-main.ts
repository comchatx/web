import { openDoor, type DoorWindow } from "./door.js";

const door = openDoor(window as DoorWindow);
// The vendor's tags are deferred classic scripts after this module in the head, so they run after it; the window's load follows them all.
addEventListener("load", () => void door.mount(), { once: true });
