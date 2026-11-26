/** An address as written where it is an https one, by the URL's own reading of its scheme, whatever its case; none for any other. */
export const httpsAddress = (value: unknown): string | undefined => {
  if (typeof value !== "string") return undefined;
  try { return new URL(value).protocol === "https:" ? value : undefined; } catch { return undefined; }
};
