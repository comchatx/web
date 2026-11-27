import type { Members, Organization, Seats, SeatsState, Spaces, WaitingInvitation } from "./backend.js";
import type { MoneyWorld } from "./canned-money.js";
import { addDays, localDay } from "./settings-words.js";

/** The preview's organisations, the third with a long name; past three, numbered shops, so a long list can be seen scrolling. */
const ORGANIZATION_NAMES = ["Example Trading", "Example Home", "Example Cross-Border E-Commerce (Shenzhen) Co., Ltd."];
export const cannedSpaces = (count: number, active: string | null): Spaces => ({
  active,
  organizations: Array.from({ length: count }, (_, n) => ({ id: `org_preview_${n + 1}`, name: ORGANIZATION_NAMES[n] ?? `Example Shop ${n + 1}` })),
});

/** The money each seats state reads in the preview: seats held as a membership is, a cancelled one, a failed charge, none. */
export const SEATS_MONEY: Readonly<Record<SeatsState, MoneyWorld>> = { seats: "member", cut_pending: "member", cancelling: "member-cancelled", retrying: "free-failed", none: "free" };

/**
 * The organisation in use as `/me` names it in the preview (`?seats=`, with `?role=member` for a member): two seats, both in use, or three
 * cut to two at the renewal; the days the sheet's sentences name, read from the preview's clock.
 */
export function cannedOrganization(spaces: Spaces, state: SeatsState, role: "admin" | "member", now: number): Organization | undefined {
  const active = spaces.organizations.find((one) => one.id === spaces.active);
  if (active === undefined) return undefined;
  const today = localDay(now);
  const seats: Seats = state === "none" ? { least: 2, most: 150, inUse: 2, state }
    : state === "cut_pending" ? { least: 2, most: 150, inUse: 2, state, thisPeriod: 3, nextPeriod: { seats: 2, from: addDays(today, 30) }, on: addDays(today, 30) }
    : { least: 2, most: 150, inUse: 2, state, thisPeriod: 2, ...(state === "cancelling" ? { on: addDays(today, 29) } : state === "retrying" ? { on: addDays(today, 4) } : {}) };
  return { id: active.id, role, name: active.name, seats };
}

/** The members page's worlds in the preview (`?members=`): one invitation waiting, two, none, or thirty, which page past twenty. */
export const MEMBERS_WORLDS = ["waiting", "full", "none", "many"] as const;
export type MembersWorld = (typeof MEMBERS_WORLDS)[number];
const DAY_MS = 86_400_000;
/** An invitation lasts twenty-one days, as the platform makes each. */
export const INVITATION_MS = 21 * DAY_MS;
/**
 * The organisation's members and its invitations not yet answered, in a world: the preview's person its admin, one member, and the
 * invitations the world names, each sent by the admin; the seats held are the members, the invitations and the ones left over.
 */
export function cannedMembers(world: MembersWorld, admin: { readonly name?: string; readonly email?: string }, now: number): { readonly members: Members; readonly seats: number } {
  const invited = (email: string, sent: number, role: "admin" | "member" = "member"): WaitingInvitation =>
    ({ id: `orginv_${email.split("@")[0]}`, email, role, ...(admin.name === undefined ? {} : { inviter: admin.name }), expires: now - sent * DAY_MS + INVITATION_MS, url: `https://accounts.example.com/v1/tickets/accept?ticket=${email.split("@")[0]}` });
  const invitations = world === "waiting" ? [invited("zhao@trading.example", 2)]
    : world === "full" ? [invited("zhao@trading.example", 2), invited("chen@trading.example", 1, "admin")]
    : world === "many" ? Array.from({ length: 30 }, (_, n) => invited(`buyer${n + 1}@trading.example`, n % 20))
    : [];
  const members = { members: [{ ...admin, role: "admin" as const }, { name: "Li Na", email: "li@trading.example", role: "member" as const }], invitations };
  return { members, seats: world === "full" ? 4 : world === "many" ? 32 : 4 };
}
