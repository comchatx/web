import { describe, expect, it } from "vitest";
import { lineTone, takesMessages } from "./box-state.js";

describe("whether the composer takes a message", () => {
  it("takes one from a computer set up with the balance above the floor, and none while it is being set up or the balance is below the floor", () => {
    const above = { available: 50, open_floor: 10, can_open: true }, below = { available: 5, open_floor: 10, can_open: false };
    expect([takesMessages("provisioned", above), takesMessages("provisioned", undefined), takesMessages("provisioned", below), takesMessages("pending", above)]).toEqual([true, true, false, false]);
  });
});

describe("the status line's colour", () => {
  it("is brick for what the person may have to act on, and quiet for a message that waits behind a step and for a line that says nothing", () => {
    for (const said of ["status.conflict", "status.unsent", "cx.failed"] as const) expect(lineTone(said), said).toBe("status held");
    expect(lineTone(undefined)).toBe("status");
  });
});
