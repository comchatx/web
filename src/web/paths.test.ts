// @vitest-environment happy-dom
import { describe, expect, it } from "vitest";
import { renderMarkdown } from "./markdown.js";
import { FileNames, type BoardName } from "./paths.js";

// A file the board lists, as the steward lists it: its path from the board, and its path in the tree under the person's folder.
const listed = (path: string, modified: number, person = "user_2abc"): BoardName => ({ path, tree: `board/${person}/${path}`, modified });

// The board of walk 956: three files cx made in 文档/ and one it broke on purpose, beside a note of the seller's.
const board = new FileNames([
  listed("文档/亚马逊新品上架检查清单.docx", 1),
  listed("文档/商品利润表.xlsx", 2),
  listed("文档/关于推动工业互联网高质量发展的实施意见.pdf", 3),
  listed("文档/坏文件.pdf", 4),
  listed("笔记/notes.md", 5),
]);
// Every file named is opened by its path in the tree, the board's own folder: read back here by its path from the board.
const fromBoard = (path: string | undefined): string | undefined => {
  if (path === undefined) return undefined;
  const folder = /^board\/[^/]+\//.exec(path);
  expect(folder, path).not.toBeNull();
  return path.slice(folder![0].length);
};
// The files a run of cx's markdown draws as the file box, by the path in the tree each opens.
const boxed = (markdown: string, names = board): readonly string[] =>
  [...renderMarkdown(markdown, { names, box: (path) => Object.assign(document.createElement("button"), { value: path }) }).querySelectorAll("button")].map((box) => box.value);

describe("a file the board lists, named in prose", () => {
  it("stays words, by its name, its title, its path from the board or the whole path cx prints: cx names a file in inline code", () => {
    for (const prose of [
      "2. 坏文件.pdf：已建好。完整路径 /tenant/board/user_2abc/文档/商品利润表.xlsx 和 文档/亚马逊新品上架检查清单.docx。",
      "《亚马逊新品上架检查清单》",
      "亚马逊新品上架检查清单",
      "见「商品利润表」一页。",
      "Open \"notes\" now.",
      "已更新 notes.md",
    ]) expect(boxed(prose), prose).toEqual([]);
  });
  it("stays words in each prose case of the three reviews: a path in the tree, listed or not, quoted or not, under `/tenant/` or not", () => {
    const tree = "board/acct-1/Reports/weekly.md";
    const both = new FileNames([listed("Reports/weekly.md", 1700000000, "acct-1"), listed(tree, 1700000001, "acct-1")]);
    const nested = new FileNames([listed("board/acct-2/Reports/weekly.md", 1, "acct-1")]);
    const one = new FileNames([{ path: "Reports/周报.pdf", tree: "board/acct-1/Reports/周报.pdf", modified: 1 }]);
    for (const [names, printed] of [
      [both, tree], [nested, "board/acct-2/Reports/weekly.md"],
      [one, "board/acct-2/Reports/旧周报.pdf"], [one, "board/acct-1/Reports/周报.pdf备份"], [one, "board/acct-1/Reports/周报.pdf"],
      [one, "board/acct-1/Reports/周 报.pdf"], [one, "board/acct-1/Reports/周报(1).pdf"],
    ] as const) {
      for (const prose of [`See ${printed} now`, `See /tenant/${printed} now`, `请看“${printed}”。`, `请看“/tenant/${printed}”。`]) expect(boxed(prose, names), prose).toEqual([]);
    }
    expect(boxed("请看《周报》。", one)).toEqual([]);
  });
});

describe("a span of inline code that is one name", () => {
  it("is the file box of the file it names, and only that span", () => {
    expect(boxed("2. `坏文件.pdf`：已建好，见 `/tenant/board/user_2abc/文档/商品利润表.xlsx`；`cat 坏文件.pdf` 不是。")).toEqual(["board/user_2abc/文档/坏文件.pdf", "board/user_2abc/文档/商品利润表.xlsx"]);
  });
  it("names the newer of two files of one name in two folders", () => {
    const two = new FileNames([listed("旧/报告.docx", 9), listed("新/报告.docx", 10)]);
    expect(fromBoard(two.whole("报告.docx"))).toBe("新/报告.docx");
    expect(fromBoard(two.whole("旧/报告.docx"))).toBe("旧/报告.docx");
  });
  it("gives the tree's path of the board's file, so a box opens the file the board listed and not one of the tree at the same path from the board", () => {
    expect(new FileNames([listed("Reports/weekly.md", 1, "acct-1")]).whole("Reports/weekly.md")).toBe("board/acct-1/Reports/weekly.md");
  });
  it("names after the board's folder only a whole path the board lists", () => {
    const one = new FileNames([listed("Reports/weekly.md", 1, "acct-1")]);
    for (const unknown of ["/tenant/board/acct-1/weekly.md", "board/acct-1/weekly.md", "/tenant/board/acct-1/Other/weekly.md"]) expect(one.whole(unknown), unknown).toBeUndefined();
    expect(one.whole("/tenant/board/acct-1/Reports/weekly.md")).toBe("board/acct-1/Reports/weekly.md");
  });
  it("matches a path in the tree only to that listed path, before a path from the board that reads the same", () => {
    // A tab named `board` holding acct-1/Reports/weekly.md, written after the person's own Reports/weekly.md.
    const tree = "board/acct-1/Reports/weekly.md";
    const both = new FileNames([listed("Reports/weekly.md", 1700000000, "acct-1"), listed(tree, 1700000001, "acct-1")]);
    for (const printed of [tree, `/tenant/${tree}`]) expect(both.whole(printed), printed).toBe(tree);
  });
  it("leaves as words a path in the tree the board does not list, though a path from the board reads the same", () => {
    const nested = new FileNames([listed("board/acct-2/Reports/weekly.md", 1, "acct-1")]);
    for (const printed of ["board/acct-2/Reports/weekly.md", "/tenant/board/acct-2/Reports/weekly.md"]) expect(nested.whole(printed), printed).toBeUndefined();
  });
  it("reads a path in the tree whole: the listed file at that very path, or words", () => {
    const one = new FileNames([{ path: "Reports/周报.pdf", tree: "board/acct-1/Reports/周报.pdf", modified: 1 }]);
    for (const unlisted of ["board/acct-2/Reports/旧周报.pdf", "board/acct-1/Reports/周报.pdf备份"]) {
      for (const printed of [unlisted, `/tenant/${unlisted}`]) expect(one.whole(printed), printed).toBeUndefined();
    }
    for (const printed of ["board/acct-1/Reports/周报.pdf", "/tenant/board/acct-1/Reports/周报.pdf"]) expect(one.whole(printed), printed).toBe("board/acct-1/Reports/周报.pdf");
  });
  it("names a listed file as a whole, by its path, its name, its title or the whole path cx prints", () => {
    expect(["坏文件.pdf", " 文档/坏文件.pdf ", "坏文件", "/tenant/board/user_2abc/文档/坏文件.pdf", "board/user_2abc/文档/坏文件.pdf"].map((code) => fromBoard(board.whole(code)))).toEqual(Array(5).fill("文档/坏文件.pdf"));
  });
  it("names nothing the board does not list: the words of cx's own work stay words", () => {
    for (const code of ["cxBoard.save", "job.tree", "Kit.file", ".boards.json", "word.html", "cat 坏文件.pdf", "/tenant/其他/坏文件.pdf", "/tenant/board/own/文档/坏文件.pdf", "/tenant/文档/坏文件.pdf"]) expect(board.whole(code), code).toBeUndefined();
  });
});
