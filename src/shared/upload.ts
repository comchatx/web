import { OBJECT_DELIVERY_BYTES } from "./delivery-bytes.js";
import { isDomainName, RESERVED_SEGMENT } from "./file-names.js";

/**
 * The session command a page sends to put a file at the top of the seller's files, `{ type, op, … }`. The box's steward answers it
 * itself and never passes it to pi:
 * - `begin {name, bytes}` answers `{upload}`;
 * - `piece {upload, at, data}`, `data` base64, answers `{received}`, also on a refusal;
 * - `end {upload}` answers `{name}`, the name the file took;
 * - `abort {upload}` drops a file not yet whole;
 * - `remove {name}` deletes a file this box wrote while it reads as the box left it.
 */
export const UPLOAD_VERB = "cx_upload";

/** One figure for the largest file that enters the tree in one go: the gate's delivered object is held to it as well. */
export const UPLOAD_MAX_BYTES = OBJECT_DELIVERY_BYTES;

/** A piece's bytes before base64: its command stays under the platform's 900,000-byte bound on `POST /command`. */
export const UPLOAD_PIECE_BYTES = 512 * 1024;

/** A name's bytes at most, the common file system's own limit. */
export const FILE_NAME_MAX_BYTES = 255;

/** Why a name cannot be one file at the top of the seller's files; none when it can. */
export function fileNameProblem(name: string): string | undefined {
  if (name === "" || name === "." || name === "..") return "a file needs a name";
  if (name.includes("/")) return "a file's name holds no slash";
  if (name.includes("\0")) return "a file's name holds no NUL";
  if (new TextEncoder().encode(name).byteLength > FILE_NAME_MAX_BYTES) return "the name is too long";
  // The tree's sync stores no other name, so a file under one would be lost at the next cold open.
  if (!isDomainName(name)) return "a file's name holds no control character";
  if (name === RESERVED_SEGMENT) return "the name is the box's own";
  return undefined;
}

/**
 * The `k`th name a file takes when its own is already there, as the seller's own computer names a second copy: `cost-sheet (2).xlsx`.
 * The name splits at its last dot, unless the dot begins it.
 */
export function nthName(name: string, k: number): string {
  if (k < 2) return name;
  const dot = name.lastIndexOf(".");
  const [base, ext] = dot > 0 ? [name.slice(0, dot), name.slice(dot)] : [name, ""];
  return `${base} (${k})${ext}`;
}
