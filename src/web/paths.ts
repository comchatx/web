/** The box's tenant root: a path the session prints under it names the same file as the path without it. */
const TENANT_ROOT = "/tenant/";

export type TextPiece = { readonly text: string; readonly path?: string };

// A path in prose: at least one directory, a name with an extension, ASCII path characters only. A name in other scripts is not
// recognised here, since nothing separates it from the sentence around it; alone inside inline code it is (`codePath`).
const IN_PROSE = /(?<![\w/.:@+-])((?:\/tenant\/|~\/|\.{1,2}\/)?(?:[A-Za-z0-9_@+-][A-Za-z0-9_.@+-]*\/)+[A-Za-z0-9_@+-][A-Za-z0-9_.@+-]*\.[A-Za-z0-9]{1,8})(?![\w/-])/g;
const ALONE = /^(?:\/tenant\/|\.\/)?(?:[^\s/\\:*?"<>|]+\/)*[^\s/\\:*?"<>|]+\.[A-Za-z0-9]{1,8}$/u;

/** The path as the tenant tree knows it — relative, no `.` or `..` — or nothing when it can name no file of the tree. */
export function treePath(printed: string): string | undefined {
  let path = printed.startsWith(TENANT_ROOT) ? printed.slice(TENANT_ROOT.length) : printed;
  while (path.startsWith("./")) path = path.slice(2);
  if (path === "" || path.startsWith("/") || path.startsWith("~")) return undefined;
  const segments = path.split("/");
  return segments.some((segment) => segment === "" || segment === "." || segment === "..") ? undefined : segments.join("/");
}

/** A run of prose cut into plain pieces and the file paths found in it. */
export function findPaths(prose: string): readonly TextPiece[] {
  const pieces: TextPiece[] = [];
  let from = 0;
  for (const match of prose.matchAll(IN_PROSE)) {
    const path = treePath(match[1]!);
    if (path === undefined) continue;
    if (match.index > from) pieces.push({ text: prose.slice(from, match.index) });
    pieces.push({ text: match[1]!, path });
    from = match.index + match[1]!.length;
  }
  if (from < prose.length) pieces.push({ text: prose.slice(from) });
  return pieces;
}

/** The whole of an inline code span read as one file path: there a bare file name counts, in any script. */
export function codePath(code: string): string | undefined {
  const printed = code.trim();
  return ALONE.test(printed) && !printed.includes("://") ? treePath(printed) : undefined;
}
