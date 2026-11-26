/**
 * The page's reads of `/sources`, and of the account at a turn's end: each answer is applied as it comes, and a read that fails leaves the
 * last answer. An apply that throws is reported and stops no later read.
 */
export class SourcesReads<T> {
  #latest: T | undefined;

  constructor(
    readonly read: () => Promise<T>,
    readonly apply: (value: T) => void,
    readonly report: (error: unknown) => void = (error) => console.error(error),
  ) {}

  /** The last answer applied, if any: what a refresh leaves for the page to read, since another read may answer after it. */
  get latest(): T | undefined { return this.#latest; }

  /** One read, settled once it is answered or failed. */
  async refresh(): Promise<void> {
    let value: T;
    try { value = await this.read(); } catch { return; }
    this.#latest = value;
    try { this.apply(value); } catch (error) { this.report(error); }
  }
}
