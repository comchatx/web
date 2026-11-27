/** The door: the one page a person signs in or up on, served by the platform at this path to anyone without a session. */
export const DOOR_PATH = "/login";
/** The road from the sign-in card to the chat page, which an account without a computer meets (`src/web/road.ts`). */
export const ROAD_PATH = "/start";
/** What `/me` answered once of an invitation's link the person followed, handed on to the road with the move: it lets the link go as it answers. */
export type InvitationLink = "elsewhere" | "gone";
export const INVITATION_PARAM = "invitation";
/** The road's address from the chat page, with the payment session the provider sent the person back from and the link's answer, where there are. */
export const roadPath = (checkout?: string, link?: InvitationLink): string => {
  const asked = new URLSearchParams([...(checkout === undefined ? [] : [["checkout", checkout]]), ...(link === undefined ? [] : [[INVITATION_PARAM, link]])]);
  return asked.size === 0 ? ROAD_PATH : `${ROAD_PATH}?${asked.toString()}`;
};
export const invitationLinkOf = (value: string | null): InvitationLink | undefined => (value === "elsewhere" || value === "gone" ? value : undefined);
/** The road's query when 调整方案 in a person's 账单 opens its plans page. */
export const PLANS_FROM = "from=billing";
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

/**
 * A sign-in begun from another, for an organisation made under a work address: the door opens with the address in its field, and the code
 * right, on the road's page that names the organisation.
 */
export type DoorWork = { readonly work: string };
export const WORK_PARAM = "work";
/** Where the door sends a work sign-in once its code is right: the name page, under that sign-in. */
export const CREATE_PATH = `${ROAD_PATH}?create=work`;
export const doorWork = (search: string): string | undefined => {
  const named = new URLSearchParams(search).get(WORK_PARAM)?.trim();
  return named === undefined || named === "" ? undefined : named;
};

/** The road's address once an organisation is made, in its session: the seats paid for, and whether a work sign-in made it. */
export const createdPath = (seats: number, work: boolean): string => `${ROAD_PATH}?created=${seats}${work ? "&mail=work" : ""}`;
export const createdOf = (search: string): { readonly seats: number; readonly work: boolean } | undefined => {
  const asked = new URLSearchParams(search);
  const seats = Number(asked.get("created"));
  return asked.has("created") && Number.isSafeInteger(seats) && seats > 0 ? { seats, work: asked.get("mail") === "work" } : undefined;
};

/** The reason an address at the door names, or none: anything else in it is not a reason. */
export const doorReason = (search: string): DoorReason | undefined => {
  const named = new URLSearchParams(search).get(DOOR_KEY);
  return DOOR_REASONS.find((reason) => reason === named);
};
