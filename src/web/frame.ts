/**
 * `run` once per frame however often it is asked for: the first ask in a frame requests the frame, and the rest wait for it. `request`
 * is the page's `requestAnimationFrame`.
 */
export function perFrame(request: (then: () => void) => unknown, run: () => void): () => void {
  let asked = false;
  return () => {
    if (asked) return;
    asked = true;
    request(() => { asked = false; run(); });
  };
}
