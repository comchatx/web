import { describe, expect, it } from "vitest";
import { codePath, findPaths, treePath } from "./paths.js";

const found = (prose: string): readonly (string | undefined)[] => findPaths(prose).filter((piece) => piece.path !== undefined).map((piece) => piece.path);

describe("treePath", () => {
  it("reads a path under the box's tenant root and a relative one as the same file", () => {
    expect(treePath("/tenant/reports/august.md")).toBe("reports/august.md");
    expect(treePath("./reports/august.md")).toBe("reports/august.md");
    expect(treePath("reports/august.md")).toBe("reports/august.md");
  });
  it("names no file outside the tree", () => {
    for (const printed of ["/etc/passwd", "~/notes.md", "../up.md", "reports/../../up.md", "/tenant/../etc/passwd", "reports//a.md", ""]) expect(treePath(printed), printed).toBeUndefined();
  });
});

describe("findPaths", () => {
  it("finds a path inside a sentence and keeps every other character", () => {
    const pieces = findPaths("The report is at reports/august-revenue.md. Open it.");
    expect(pieces.map((piece) => piece.text).join("")).toBe("The report is at reports/august-revenue.md. Open it.");
    expect(found("The report is at reports/august-revenue.md. Open it.")).toEqual(["reports/august-revenue.md"]);
  });
  it("finds a path against Chinese text with no space between", () => {
    expect(found("报告已写入reports/august-revenue.md，请查看。")).toEqual(["reports/august-revenue.md"]);
  });
  it("finds the box's absolute form and several paths", () => {
    expect(found("Wrote /tenant/out/a.csv and ./out/b.tar.gz")).toEqual(["out/a.csv", "out/b.tar.gz"]);
  });
  it("leaves alone a web address, a bare name, a ratio, a path out of the tree, and a version", () => {
    for (const prose of ["see https://example.com/docs/page.html", "open sales.csv", "up 3/4 this week", "read /etc/ssl/cert.pem", "and/or", "node v22.1/lts"]) expect(found(prose), prose).toEqual([]);
  });
});

describe("codePath", () => {
  it("takes a bare file name, in any script, when it is the whole span", () => {
    expect(codePath("sales.csv")).toBe("sales.csv");
    expect(codePath(" 报告/八月.md ")).toBe("报告/八月.md");
    expect(codePath("/tenant/reports/a.md")).toBe("reports/a.md");
  });
  it("takes nothing that is a command, an address or a path out of the tree", () => {
    for (const code of ["cat sales.csv", "https://example.com/a.md", "../a.md", "/etc/hosts.conf", "npm", "a.b.c/"]) expect(codePath(code), code).toBeUndefined();
  });
});
