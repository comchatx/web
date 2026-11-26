/** A key event as `ignoreHeld` reads it. */
type Key = { readonly key: string; readonly repeat: boolean; preventDefault(): void };

/**
 * A native button that takes the focus while a key is held — a card opened by that key — presses nothing for the key's repeats: a held
 * key acts once, across what it opens.
 */
export function ignoreHeld(button: EventTarget): void {
  button.addEventListener("keydown", (event) => {
    const key = event as unknown as Key;
    if (key.repeat && (key.key === "Enter" || key.key === " ")) key.preventDefault();
  });
}

/**
 * The second press of a double-click: a pointer's click counts its presses, and a key's or a script's counts none. The interval is the
 * system's double-click time, which the browser counts by, so a press is a second one exactly when the person's other double-clicks
 * would be; the page keeps no interval of its own. A second press within it does nothing, so a double-click cannot do one thing and
 * then the other — send and then stop — while Enter and Escape, which count no presses, are never held back.
 */
export const twice = (event: Event): boolean => (event as MouseEvent).detail > 1;
