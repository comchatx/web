/** A file the board lists: its path from the board (its tab, then the file's path in it), its path in the tenant tree, and when it was written. */
export type BoardName = { readonly path: string; readonly tree: string; readonly modified: number };

// What cx may print before a file's path in the tenant tree.
const LEADING = /^(?:\/tenant\/|\.\/)/;
// A path in the tenant tree that lies in the board: it names a file only as itself, never as a path from the board that reads the same.
const IN_BOARD = /^board\//;

/**
 * The files the board lists, by every way cx writes one in inline code: its path in the tenant tree, the same under `/tenant/`, its path
 * from the board, its name, and its name without the extension as a title. A path in the tree is looked up first and matches only itself;
 * two files of one name are the newer; a path goes before a name, and a name before a title. Each is named by its path in the tree, the one
 * address every opener of a file uses.
 */
export class FileNames {
  readonly #paths = new Map<string, string>();
  readonly #trees = new Set<string>();
  readonly #names = new Map<string, string>();
  readonly #titles = new Map<string, string>();
  readonly #places = new Map<string, string>();

  constructor(files: readonly BoardName[]) {
    for (const file of [...files].sort((one, other) => one.modified - other.modified)) {
      const name = file.path.slice(file.path.lastIndexOf("/") + 1);
      const dot = name.lastIndexOf(".");
      this.#trees.add(file.tree);
      this.#places.set(file.tree, file.path);
      this.#paths.set(file.path, file.tree);
      this.#names.set(name, file.tree);
      if (dot > 0) this.#titles.set(name.slice(0, dot), file.tree);
    }
  }

  /** The file a span of inline code names as a whole, by its path, its name or its title. */
  whole(printed: string): string | undefined {
    const words = printed.trim();
    const lead = LEADING.exec(words);
    if (lead !== null) return this.#tree(words.slice(lead[0].length));
    return this.#path(words) ?? this.#names.get(words) ?? this.#titles.get(words);
  }

  /** The place in the tree of the file the board lists at exactly this path from the board. */
  tree(path: string): string | undefined { return this.#paths.get(path); }

  /** A listed file's path from the board, by its path in the tree. */
  place(tree: string): string | undefined { return this.#places.get(tree); }

  #tree(words: string): string | undefined { return this.#trees.has(words) ? words : undefined; }

  #path(words: string): string | undefined { return IN_BOARD.test(words) ? this.#tree(words) : this.#paths.get(words); }
}
