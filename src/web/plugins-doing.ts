import { PACKAGE_REFUSALS, refusalOf, type PackageRefusal } from "./backend.js";
import { ASLEEP, Refused, UNENDED } from "./plugins-clicks.js";
import { nameIn, type Bundle, type Plugin } from "./catalogue.js";
import { href, installed, isOn, packageOn, type Held, type Item } from "./plugins-model.js";
import type { Language, StringKey } from "./strings.js";

export type Act = "install" | "remove" | "on" | "off" | "update";
/**
 * What a click is about: the record and the act, and every plugin it adds or takes away, so an install's failure midway can say which
 * are in, and a click that waits stands on its record while any of them still waits.
 * `partOf` names the plugin a click on a package was for, where the act sends clicks for other plugins than its record.
 */
export type About = { readonly item: Item; readonly act: Act; readonly parts?: readonly Plugin[]; readonly partOf?: (source: string) => Plugin | undefined };
/**
 * A click that did not go through: why, where the answer gave a reason, and how many times in a row it has now failed. `seen` is the
 * newest end the list had said when it was drawn, by the platform's own clock, which the browser's is never held against. `end` is the
 * list's end it was drawn from, where no click of this page's was waiting for it.
 */
export type Failed = { readonly act: Act; readonly reason: PackageRefusal | undefined; /** What cx's computer said of it: pi's own words where the refusal is pi's, else the computer's own, which are never drawn. */ readonly detail?: string; readonly tries: number; readonly parts: readonly Plugin[]; readonly seen: number; readonly end?: string };
/**
 * A click still out: what it does. `waits` is one the platform has written down and cx's computer has not ended: it is drawn as the
 * seller asked, which says it is written down and not that it is done; the page draws a removal or a switch so from the moment it is
 * written down, from the row's waiting list the write's answer carries, and every list read after it, carrying the same list, keeps it so.
 */
export type Busy = { readonly act: Act; readonly waits?: true };
/** What the list says of a record's click: one that still waits, or how the last one ended, by the key the list's end has. */
export type Waiting = { readonly item: Item; readonly act: Act };
export type Ended = { readonly item: Item; readonly act: Act; readonly ok: boolean; readonly reason: string | undefined; readonly detail?: string; readonly key: string; readonly at: number };
/**
 * An answer that is a fact about the plugin and not a failure of the click: it is one file, or it is no longer on cx's computer. A
 * second press would hear the same, so the page says it once and stops offering what it rules out.
 */
export const FACTS = ["single_file", "not_listed"] as const;
export type Fact = (typeof FACTS)[number];
const factOf = (reason: PackageRefusal | undefined): Fact | undefined => FACTS.find((one) => one === reason);

/**
 * The clicks the Plugins page has out and the ones that failed, by record: every surface that draws a record asks here, so a card on
 * Discover, a row on Yours and the record's own page say the same of one click. Nothing here says a click succeeded; the world read
 * again says that.
 */
export class Doing {
  readonly #busy = new Map<string, Busy>();
  readonly #failed = new Map<string, Failed>();
  readonly #facts = new Map<string, ReadonlyMap<Fact, Act>>();
  readonly #gone = new Map<string, Item>();
  /** The plugin each failed Update was for, by its record's address, so a list that no longer names its package takes the failure away. */
  readonly #updates = new Map<string, Plugin>();
  /** The list's failed ends already drawn in this tab, by their keys: leaving the page does not draw one again, a reload does. */
  readonly #said = new Set<string>();
  /** The records a click that waits was for, by the record it is drawn on: a bundle's click is its plugins' entries, and the list names only those. */
  readonly #parts = new Map<string, readonly string[]>();
  /** What each record's click being written does once the platform has written it down. */
  readonly #writing = new Map<string, () => void>();
  /** The newest click on each record: a click written down leaves its record's controls live, and an older one's end leaves a newer one's state as it is. */
  readonly #newestOn = new Map<string, object>();
  /** The newest end a list has said, by the platform's clock. */
  #newest = 0;
  /** Whether a list has been heard in this tab: the ends of the first stand on their records and are told no more. */
  #heardOnce = false;
  /** Draws again whatever shows a record's state. */
  changed: () => void = () => undefined;
  /** The plugins a bundle lists, as the page holds them: what a bundle's state is read from. */
  members: (bundle: Bundle) => readonly Plugin[] = () => [];

  /**
   * A click being written down on a record; one written down is not, since it is drawn as the seller asked. A bundle's state is its
   * members' (ruled 2026-11-06), its own click being written included: removing while a removal of it or of any member is out, written
   * down or not, else installing while an install is, so it reads as under way until cx's computer has ended every member's.
   */
  busy(item: Item): Busy | undefined {
    const busy = this.#busy.get(href.item(item));
    const own = busy !== undefined && busy.waits !== true ? busy : undefined;
    return "members" in item ? this.#through(item) ?? own : own;
  }
  /** An install or a removal of a record cx's computer has not ended, being written down or written: how a bundle's member stands in it. */
  pending(item: Item): Busy | undefined {
    if ("members" in item) return this.busy(item);
    const act = this.#busy.get(href.item(item))?.act;
    return act === "install" || act === "remove" ? { act } : undefined;
  }
  #through(bundle: Bundle): Busy | undefined {
    const acts = [bundle, ...this.members(bundle)].map((one) => this.#busy.get(href.item(one))?.act);
    return acts.includes("remove") ? { act: "remove" } : acts.includes("install") ? { act: "install" } : undefined;
  }
  /** An update cx's computer has not ended and the page reads for no longer: asked, as the seller asked it, until a list shows the new version. */
  updateAsked(item: Item): boolean { const busy = this.#busy.get(href.item(item)); return busy?.waits === true && busy.act === "update"; }
  /** A failure is drawn until its click is tried again; while that try runs, its line gives way to the running one. */
  failed(item: Item): Failed | undefined { return this.#busy.has(href.item(item)) ? undefined : this.#failed.get(href.item(item)); }
  /**
   * A failed Update stands only while its package is listed: once the list no longer names it there is nothing to update, and its
   * place offers Install instead.
   */
  listed(held: Held): void {
    for (const [key, plugin] of this.#updates) {
      if (this.#failed.get(key)?.act !== "update") this.#updates.delete(key);
      else if (!installed(held, plugin)) { this.#failed.delete(key); this.#updates.delete(key); }
    }
  }
  /** A failure that asked nothing of the seller was read on the page they have now left: it is drawn no longer. */
  forget(address: string): void { this.#failed.delete(address); }
  /** What the answers so far say this record is, while the page holds them. */
  facts(item: Item): ReadonlySet<Fact> { return new Set(this.#facts.get(href.item(item))?.keys()); }
  /** Whether one of them answered a turning off: the source the plugin sells was switched before cx's computer said it. */
  stopped(item: Item): boolean { return [...(this.#facts.get(href.item(item))?.values() ?? [])].includes("off"); }
  /**
   * Leaving the Plugins page leaves its failures and the answers it held: a seller who comes back reads the page as it is. A click
   * still out stays out; one that waits is put back by the next opening's list, where it still waits.
   */
  leave(): void {
    this.#failed.clear(); this.#facts.clear(); this.#gone.clear(); this.#parts.clear(); this.#updates.clear();
    for (const [key, busy] of this.#busy) if (busy.waits === true) this.#busy.delete(key);
  }
  /**
   * The record at an address whose plugin cx's computer said it no longer has. The list read after that answer no longer names a
   * plugin the person installed themselves, so nothing else can say its name on the page that says it is gone and how it comes back.
   */
  gone(address: string): Item | undefined { return this.#gone.get(address); }

  /**
   * Runs a click's work with its record drawn busy until the platform has written the click down, then as the seller asked, and answers
   * how it ended: `done`, `unsaid` where the work says it ended with no word of how, `asleep` where cx's computer sleeps and ends it at
   * its next start, or `waits` where it has not ended and is read for no longer; the last two leave the record drawn as asked. `wrote`
   * runs once the click is written down. A failure is kept for the record's own line and thrown on, so the caller draws nothing of its
   * own for it. A fact heard of another plugin than the record — a part the act also switched — is kept for that plugin and is no
   * failure of the record's.
   */
  async track(about: About, work: () => Promise<void | "unsaid">, wrote?: () => void): Promise<"done" | "asleep" | "waits" | "unsaid"> {
    const key = href.item(about.item);
    const mine = {};
    this.#newestOn.set(key, mine);
    this.#busy.set(key, { act: about.act });
    this.#parts.delete(key);
    this.#writing.set(key, () => { this.#busy.set(key, { act: about.act, waits: true }); this.#parts.set(key, (about.parts ?? []).map((plugin) => href.item(plugin))); this.changed(); wrote?.(); });
    this.changed();
    // An install answered, either way, is news newer than the answer that the plugin was gone.
    const forget = (): void => { if (about.act === "install") { this.#gone.delete(key); const left = new Map([...(this.#facts.get(key) ?? [])].filter(([one]) => one !== "not_listed")); if (left.size > 0) this.#facts.set(key, left); else this.#facts.delete(key); } };
    let waits = false;
    try {
      const how = await work();
      forget();
      this.#failed.delete(key);
      return how === "unsaid" ? "unsaid" : "done";
    } catch (error) {
      if (error instanceof Error && (error.message === UNENDED || error.message === ASLEEP)) { waits = true; return error.message === ASLEEP ? "asleep" : "waits"; }
      forget();
      const heard = error instanceof Refused ? error.clicks.map((click) => ({ ...click, part: about.partOf?.(click.source), reason: PACKAGE_REFUSALS.find((one) => one === click.reason) })) : [];
      const elsewhere = heard.filter((one) => one.part !== undefined && href.item(one.part) !== key && factOf(one.reason) !== undefined);
      for (const one of elsewhere) this.#refused(href.item(one.part!), { item: one.part!, act: one.op }, one.reason);
      if (heard.length > 0 && elsewhere.length === heard.length) { this.#failed.delete(key); return "done"; }
      const own = elsewhere.length > 0 ? heard.find((one) => !elsewhere.includes(one))! : heard[0];
      this.#refused(key, about, elsewhere.length > 0 ? own!.reason : refusalOf(error), undefined, own?.detail);
      throw error;
    } finally {
      // A newer click on the record holds what it is drawn as: this one's end leaves that as it is.
      if (this.#newestOn.get(key) === mine) {
        this.#newestOn.delete(key);
        this.#writing.delete(key);
        if (waits) { this.#busy.set(key, { act: about.act, waits: true }); this.#parts.set(key, (about.parts ?? []).map((plugin) => href.item(plugin))); } else this.#busy.delete(key);
      }
    }
  }

  /**
   * The platform has written a record's click down: from now it is drawn as the seller asked, and `track`'s `wrote` runs. Said once;
   * nothing where no click on the record is being written.
   */
  written(item: Item): void {
    const key = href.item(item);
    const wrote = this.#writing.get(key);
    this.#writing.delete(key);
    wrote?.();
  }

  /**
   * What a list that carries the platform's word of clicks says of the records: one that waits and is not under way here is drawn as
   * waiting, one drawn as waiting is not once neither it nor anything its click was for waits, and a failed end is drawn on its record,
   * once in this tab. A failure the list no longer keeps, or that an end done the list had not said when it was drawn replaced, is
   * drawn no longer. What it returns are the switches' failures it heard of first, to be told once: none at the page's first read, whose
   * old ends stand on their records, and no removal's, which a bundle's removal names on its own line.
   */
  heard(waiting: readonly Waiting[], ends: readonly Ended[]): readonly About[] {
    const first = !this.#heardOnce;
    this.#heardOnce = true;
    const out = new Set(waiting.map((one) => href.item(one.item)));
    for (const one of waiting) if (!this.#busy.has(href.item(one.item))) this.#busy.set(href.item(one.item), { act: one.act, waits: true });
    // A click this page still reads for is its own to end: the list does not take it away, nor say its end first.
    for (const [key, busy] of this.#busy) if (busy.waits === true && !this.#newestOn.has(key) && !out.has(key) && this.#parts.get(key)?.some((part) => out.has(part)) !== true) { this.#busy.delete(key); this.#parts.delete(key); }
    const kept = new Set(ends.map((one) => one.key));
    for (const [key, failed] of this.#failed) {
      if (failed.end !== undefined ? !kept.has(failed.end) : ends.some((one) => href.item(one.item) === key && one.ok && one.at > failed.seen)) this.#failed.delete(key);
    }
    this.#newest = Math.max(this.#newest, ...ends.map((one) => one.at));
    const told: About[] = [];
    for (const one of ends) {
      // A failed install or update is the queue's to say, on its row, until 重试 or 取消.
      if (one.ok || one.act === "install" || one.act === "update" || this.#said.has(one.key)) continue;
      this.#said.add(one.key);
      const key = href.item(one.item);
      if (this.#busy.has(key) || this.#failed.has(key) || this.#newestOn.has(key)) continue;
      const about = { item: one.item, act: one.act };
      this.#refused(key, about, PACKAGE_REFUSALS.find((reason) => reason === one.reason), one.key, one.detail);
      if (!first && one.act !== "remove" && this.#failed.has(key)) told.push(about);
    }
    return told;
  }

  #refused(key: string, about: About, reason: PackageRefusal | undefined, end?: string, detail?: string): void {
    const fact = factOf(reason);
    if (fact !== undefined) {
      // Not a failure to count or to try again: the page now knows this of the record.
      this.#facts.set(key, new Map([...(this.#facts.get(key) ?? []), [fact, about.act]]));
      if (fact === "not_listed") this.#gone.set(key, about.item);
      this.#failed.delete(key);
      return;
    }
    if (about.act === "update" && !("members" in about.item)) this.#updates.set(key, about.item);
    const before = this.#failed.get(key);
    const same = before?.act === about.act ? before : undefined;
    // A second try does only what the first left: the line still names every part the click was for.
    this.#failed.set(key, { act: about.act, reason, tries: (same?.tries ?? 0) + 1, ...(detail === undefined ? {} : { detail }), parts: [...new Set([...(same?.parts ?? []), ...(about.parts ?? [])])], seen: this.#newest, ...(end === undefined ? {} : { end }) });
  }
}

const WHY: Readonly<Record<PackageRefusal, StringKey | undefined>> = {
  pi_failed: "pl.why.failed", timed_out: "pl.why.long", not_listed: "pl.why.gone", single_file: "pl.why.fileOnly",
  box_unreachable: "pl.why.unreached", readme_too_large: undefined, waiting_full: "pl.why.full", sources_unavailable: "pl.why.source",
};
/** The reasons a second try can change: the rest say what to do instead, in their own sentence. */
const AGAIN: readonly (PackageRefusal | undefined)[] = [undefined, "pi_failed", "timed_out", "box_unreachable", "waiting_full", "sources_unavailable"];

type Say = (key: StringKey, values?: Readonly<Record<string, string | number>>) => string;

/**
 * A failure in a seller's words: what did not happen and why; for a plugin whose source the click already switched, the two things
 * that are now true, whether cx buys from it and what cx's computer could not finish; whether trying again can help; and, from the
 * second failure in a row, that it failed again and the one other step. What an install or an update cx's computer ran failed to do
 * is the queue's to say.
 */
export type FailureWords = { /** The turn-on left the plugin on: nothing failed for the seller, and the one sentence says so. */ readonly on: boolean; readonly both: boolean; readonly what: string; readonly why: string | undefined; readonly retry: boolean; readonly repeated: string | undefined };
/**
 * Whether a click on a record left the source it sells where the click asked: the platform switches a source before the click is
 * kept, so a click that failed or waits after it finds the source already so.
 */
function switched(held: Held, item: Item, act: Act): boolean {
  // An update leaves the source it sells as it was: the platform switches nothing for it.
  const gate = "members" in item || item.source === undefined || act === "update" ? undefined : held.sources.find((one) => one.name === item.source!.name);
  return gate !== undefined && gate.enabled === (act === "install" || act === "on");
}
/** A switched source in money's terms, the first thing a seller pressed for: cx no longer buys from it, or it is on. */
const firstFact = (say: Say, language: Language, item: Item, act: Act): string => say(act === "install" || act === "on" ? "pl.fail.sourceOn" : "pl.fail.sourceOff", { name: nameIn(item, language) });

/** A reason in words; one file that cannot be switched says the way back to buying where the press stopped it, and its limit elsewhere. */
const wayBack = (say: Say, language: Language, item: Item, why: StringKey, stopped: boolean): string => (why === "pl.why.fileOnly" && stopped ? say("pl.why.file", { name: nameIn(item, language) }) : say(why));

export function failureWords(say: Say, language: Language, _list: (names: readonly string[]) => string, held: Held, item: Item, failed: Failed): FailureWords {
  const why = failed.reason === undefined ? undefined : WHY[failed.reason];
  const wanted = failed.act === "install" || failed.act === "on";
  // Where the gate refused the switch nothing changed, and where the plugin already is what the click wanted nothing is unfinished.
  const undone = "members" in item ? false : failed.act === "install" ? !installed(held, item) : failed.act === "remove" ? installed(held, item) : packageOn(held, item) === !wanted;
  const both = failed.reason !== "sources_unavailable" && switched(held, item, failed.act) && undone;
  // A turn-on whose answer was a failure and which left the plugin on, its source and its package both, denies nothing the switch shows.
  if (failed.act === "on" && !("members" in item) && isOn(held, item)) return { on: true, both: false, what: say("pl.fail.stillOn", { name: nameIn(item, language) }), why: undefined, retry: false, repeated: undefined };
  return {
    on: false,
    both,
    // What is missing comes first; a source already switched is said before what the computer could not finish.
    what: both ? sentences([firstFact(say, language, item, failed.act), say(`pl.unfinished.${failed.act as Exclude<Act, "update">}`)])
      : say(`pl.fail.${failed.act}`, { name: nameIn(item, language) }),
    // That the computer could not finish is what the second sentence already says.
    why: why === undefined || (both && why === "pl.why.failed") ? undefined : wayBack(say, language, item, why, failed.act === "off" && switched(held, item, "off")),
    retry: AGAIN.includes(failed.reason),
    repeated: failed.tries > 1 ? say("pl.fail.again", { count: failed.tries }) : undefined,
  };
}

/**
 * What is said once, away from the record, of a click that failed: where its line says the source's state and what the computer could not
 * finish, those two sentences and the way to try again; else the words the click brought for it.
 */
export function failureToast(say: Say, language: Language, list: (names: readonly string[]) => string, held: Held, about: About | undefined, failed: Failed | undefined, plain: string): Told {
  if (about === undefined || failed === undefined) return { said: plain, asks: true };
  const words = failureWords(say, language, list, held, about.item, failed);
  // The way to try again is a sentence here, closed with the stop the sentence before it has.
  return words.on ? { said: words.what, asks: false } : { said: words.both ? sentences([words.what, `${say("pl.tryAgain")}${words.what.slice(-1)}`]) : plain, asks: true };
}

/** A toast's words, and whether they report a failure or name an act: "{name} is on." after a failed press asks nothing. */
export interface Told { readonly said: string; readonly asks: boolean }

/**
 * The facts the page heard of a record, each as one sentence: said once, in the page's own ink, with nothing to try. A plugin the person
 * installed themselves that is gone has no page left to stand under, so its line names it and says how it comes back; one the
 * catalogue offers is drawn as not installed with its Install, and its line says only that it is gone. Where they answered a
 * turning off of a plugin whose source it switched, the line opens with what the press was for: cx buys from it no longer.
 */
export function factWords(say: Say, language: Language, held: Held, item: Item, facts: ReadonlySet<Fact>, stopped = false): string {
  const bought = stopped && switched(held, item, "off");
  return sentences([bought ? firstFact(say, language, item, "off") : undefined, ...[...facts].map((fact) =>
    fact === "single_file" ? wayBack(say, language, item, "pl.why.fileOnly", bought) : !("members" in item) && item.own === true ? say("pl.gone", { name: nameIn(item, language) }) : say("pl.why.gone"))]);
}

/** What a record being written down is called for a screen reader: the act on the record, by name. */
export const doingName = (say: Say, language: Language, item: Item, busy: Busy): string => say(`pl.doing.${busy.act}Name`, { name: nameIn(item, language) });

/** What is said once a click written down has ended, where it did not fail: the act's own words when it is done, else nothing. */
export function endSaid(how: "done" | "asleep" | "waits" | "unsaid", told: string): string {
  return how === "done" ? told : "";
}
/** The acts whose control says a word while their click is out. */
export type Worded = Exclude<Act, "update">;
/** The click out on a record that its switch and its ⋮ say: an update is drawn where Update was pressed, so the switch still says on or off. */
export const switching = (busy: Busy | undefined): Worded | undefined => (busy === undefined || busy.act === "update" ? undefined : busy.act);

/** Sentences set a space apart, except after a stop or a comma that carries its own, as Chinese's do. */
export const sentences = (parts: readonly (string | undefined)[]): string => parts.filter((one): one is string => one !== undefined).join(" ").replace(/([。，]) /g, "$1");
