import { DOOR_LANGUAGES, LANGUAGE_KEY, type DoorLanguage } from "./door-words.js";
import { liveBackend, ROAD_SKIPPED } from "./live-ports.js";
import { openRoad } from "./road.js";
import { INVITATION_PARAM, invitationLinkOf } from "../shared/door.js";
import { createdOf, PLANS_FROM } from "../shared/door.js";
import { preferredLanguage } from "./strings.js";

// The language the person chose last, as the door and the pages keep it, else the browser's.
const kept = ((): string | null => { try { return localStorage.getItem(LANGUAGE_KEY); } catch { return null; } })();
const language: DoorLanguage = DOOR_LANGUAGES.find((one) => one === preferredLanguage(kept, navigator.languages)) ?? "zh";
document.documentElement.lang = language === "zh" ? "zh-CN" : "en";
const figure = document.querySelector<HTMLTemplateElement>("#road-cx")!;
// The payment provider's way back, carried here from the chat page's address: read once, and taken off the address.
const address = new URL(location.href);
const checkout = address.searchParams.get("checkout") ?? "";
const link = invitationLinkOf(address.searchParams.get(INVITATION_PARAM));
// 调整方案 in 账单 opens the plans page here; its way back and its 订阅 are 账单's, on the chat page.
const fromBilling = address.search === `?${PLANS_FROM}`;
// The door's work sign-in names its organisation here; an organisation just made greets its admin with the step that invites.
const create = address.searchParams.get("create") === "work";
const created = createdOf(address.search);
if (address.search !== "") history.replaceState(null, "", address.pathname);
await openRoad(document.querySelector<HTMLElement>("#road")!, {
  backend: liveBackend(), language, year: new Date().getFullYear(),
  go: (path) => location.assign(path),
  skip: () => { try { sessionStorage.setItem(ROAD_SKIPPED, "1"); } catch { /* the chat page sends the person back to the road */ } },
  cx: () => figure.content.firstElementChild!.cloneNode(true),
  storage: ((): Storage | undefined => { try { return sessionStorage; } catch { return undefined; } })(),
  ...(checkout === "" ? {} : { checkout }),
  ...(link === undefined ? {} : { link }),
  ...(fromBilling ? { billing: "/#/settings/billing" } : {}),
  ...(create ? { create: true as const } : {}),
  ...(created === undefined ? {} : { created }),
});
