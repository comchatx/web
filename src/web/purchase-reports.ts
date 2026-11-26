import { TurnEnds, type StreamState } from "./stream-model.js";

export type PurchaseNewsPorts = {
  /** The sources bar's one `/sources` read. */
  readonly sources: () => void;
  /** The account's one read, for its balance. */
  readonly account: () => void;
  /** The settings window stands: what it shows is not read again under the person until it closes. */
  readonly held?: () => boolean;
};

/**
 * The moments to read the sources and the account once: a turn's charge the box told this page as the turn ended, and the end of a turn
 * this page saw run, which a model's charge alone never reports. A charge read with what is stored — a reload, an earlier part, a resume —
 * was told before, and the account and the sources already say so. While the settings window stands, a moment is kept and read once as it
 * closes. pi's last model charge may settle just after its turn ends, so the read at the end can miss it until the next one.
 */
export class PurchaseNews {
  /** The live charges already read for, by the place each names; forgotten with the life they were in. */
  #read = new Set<number>();
  #epoch: string | undefined;
  readonly #ends = new TurnEnds();
  #owed = false;

  constructor(readonly ports: PurchaseNewsPorts) {}

  /** The stream, as often as the page draws it. */
  stream(stream: StreamState): void {
    if (stream.epoch !== this.#epoch) { this.#epoch = stream.epoch; this.#read = new Set(); }
    let arrived = this.#owed;
    for (const charge of stream.charges) {
      if (charge.live !== true || this.#read.has(charge.seq)) continue;
      this.#read.add(charge.seq);
      arrived = true;
    }
    if (this.#ends.seen(stream)) arrived = true;
    if (!arrived) return;
    this.#owed = this.ports.held?.() === true;
    if (this.#owed) return;
    this.ports.sources();
    this.ports.account();
  }
}
