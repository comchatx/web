/**
 * A board's cards as a waterfall (`parts/board-page.md` §1; round 8, "The width"): a list laid out as a grid of columns at least 20rem wide
 * (`app.css`), each card given, in the board's own order, to the column that is shortest so far, so a card several screens long holds one
 * column and the rest stand beside it. The cards stay in the board's order in the page, so the keyboard and a screen reader go through
 * them as the board has them. A list with one column, or one card, or not drawn, is laid out as it stands.
 */
export function fall(list: HTMLElement): void {
  // Every card goes back to the grid's own flow before the columns are counted: a card still placed in a column the list no longer has
  // would keep that column open, the rest of the width its, and the count would place a card there again at every narrower width.
  for (const card of list.children) { (card as HTMLElement).style.gridColumn = ""; (card as HTMLElement).style.gridRow = ""; }
  const look = getComputedStyle(list);
  const cards = [...list.children].filter((card): card is HTMLElement => card instanceof HTMLElement && !card.hidden);
  const columns = look.display === "grid" && list.getClientRects().length > 0 ? look.gridTemplateColumns.split(" ").filter((one) => one !== "").length : 1;
  if (columns < 2 || cards.length < 2) { list.classList.remove("fall"); return; }
  list.classList.add("fall");
  const gap = parseFloat(look.columnGap) || 0;
  const tall = cards.map((card) => card.getBoundingClientRect().height);
  const ends = new Array<number>(columns).fill(0);
  cards.forEach((card, at) => {
    const column = ends.indexOf(Math.min(...ends));
    const span = Math.max(1, Math.ceil(tall[at]! + gap));
    card.style.gridColumn = String(column + 1);
    card.style.gridRow = `${ends[column]! + 1} / span ${span}`;
    ends[column]! += span;
  });
}
