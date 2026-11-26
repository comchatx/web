/** The browser's storage as the board keeps what it holds for the account: a key read, written or removed, and the keys there are. */
export type DraftStorage = {
  readonly keys: () => readonly string[];
  readonly read: (key: string) => string | null;
  readonly write: (key: string, value: string) => void;
  readonly remove: (key: string) => void;
};
