import { describe, expect, it } from "vitest";
import { BoardDoor, type DoorState } from "./board-door.js";

const closed: DoorState = { open: false, shown: undefined, beside: true, empty: true, keyboard: false };
const showing = (board: string, more: Partial<DoorState> = {}): DoorState => ({ ...closed, open: true, shown: board, ...more });

describe("the door a page asks through", () => {
  it("opens beside the chat at once, once for one name, and does nothing for the board already shown", () => {
    const door = new BoardDoor();
    expect(door.ask("待办", "6", closed)).toBe("open");
    expect(door.ask("待办", "6", closed)).toBe("none");
    expect(door.ask("待办", "7", showing("待办"))).toBe("none");
    // Beside the chat the words in the message box do not hold it.
    expect(door.ask("补货", "a", { ...closed, empty: false })).toBe("open");
  });

  it("waits over the chat until the message box holds no words, and a seller who opens or shuts the column first lets it go", () => {
    const door = new BoardDoor();
    expect(door.ask("待办", "6", { ...closed, beside: false, empty: false })).toBe("wait");
    expect([door.waiting, door.typed({ open: false, beside: false, empty: false })]).toEqual(["待办", undefined]);
    expect(door.typed({ open: false, beside: false, empty: true })).toBe("待办");
    expect(door.waiting).toBeUndefined();
    // Over the chat with an empty box it opens at once, as a sheet.
    expect(door.ask("补货", "1", { ...closed, beside: false })).toBe("open");
    for (const seller of [(one: BoardDoor) => one.opened("其他"), (one: BoardDoor) => one.closed()]) {
      const other = new BoardDoor();
      other.ask("待办", "6", { ...closed, beside: false, empty: false });
      seller(other);
      expect([other.waiting, other.typed({ open: false, beside: true, empty: true })]).toEqual([undefined, undefined]);
    }
  });

  it("goes to the asking board with another shown, but not while the keyboard is in the column or the board shown is an ask's unpressed", () => {
    const door = new BoardDoor();
    expect(door.ask("补货", "1", showing("Notes"))).toBe("go");
    expect(door.ask("Helpers", "1", showing("Notes", { keyboard: true }))).toBe("refused");
    // 补货 was shown by an ask and not pressed: a second page cannot take the column from it.
    expect(door.ask("Helpers", "2", showing("补货"))).toBe("refused");
    door.pressed("补货");
    expect(door.ask("Helpers", "3", showing("补货"))).toBe("go");
  });

  it("shuts a board's door when the seller closes the column it opened, or leaves the board it showed, with no press on it, until they open it", () => {
    const door = new BoardDoor();
    door.ask("补货", "1", closed);
    door.closed();
    expect([door.shut("补货"), door.ask("补货", "2", closed)]).toEqual([true, "refused"]);
    door.chose("补货");
    expect([door.shut("补货"), door.ask("补货", "3", closed)]).toEqual([false, "open"]);
    // Left for another board with no press: shut; a press first, and leaving it shuts nothing.
    door.chose("Notes");
    expect(door.shut("补货")).toBe(true);
    door.opened("补货");
    expect(door.ask("补货", "4", closed)).toBe("open");
    door.pressed("补货");
    door.closed();
    expect(door.shut("补货")).toBe(false);
    // A waiting opening for a board whose door is shut opens nothing.
    door.ask("Helpers", "1", closed);
    door.closed();
    door.chose("Notes");
    const waits = new BoardDoor();
    waits.ask("Helpers", "1", closed);
    waits.closed();
    expect(waits.ask("Helpers", "2", { ...closed, beside: false, empty: false })).toBe("refused");
  });
});
