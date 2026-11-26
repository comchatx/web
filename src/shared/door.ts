/** The door: the one page a person signs in or up on, served by the platform at this path to anyone without a session. */
export const DOOR_PATH = "/login";
/** The road from the sign-in card to the chat page, which an account without a computer meets (`src/web/road.ts`). */
export const ROAD_PATH = "/start";
/** The door's address names its language under this key, `en` for English and anything else for Chinese, as the site's links name it. */
export const LANGUAGE_PARAM = "lang";
/** The door's page in each language, as the platform holds them: Chinese at the door's path, English under a key no address's path can be. */
export const DOOR_PAGES = Object.freeze({ zh: DOOR_PATH, en: `${DOOR_PATH}?${LANGUAGE_PARAM}=en` } as const);
/** The door's address names why the person is back under this key, the prototype's own, and the door says it once. */
export const DOOR_KEY = "door";
/** Why a person is back at the door: a sign-out of this browser, a sign-out of every device, or a session that ran out. */
export const DOOR_REASONS = Object.freeze(["signed-out", "signed-out-all", "expired", "deleted"] as const);
export type DoorReason = (typeof DOOR_REASONS)[number];
/** The meta tag in the door's head that holds its response's nonce, which the door hands the vendor for the styles it writes at runtime. */
export const STYLE_NONCE_META = "cmx-style-nonce";

/** The reason an address at the door names, or none: anything else in it is not a reason. */
export const doorReason = (search: string): DoorReason | undefined => {
  const named = new URLSearchParams(search).get(DOOR_KEY);
  return DOOR_REASONS.find((reason) => reason === named);
};
