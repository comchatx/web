import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { afterEach, expect, it } from "vitest";
import { PlatformBackend } from "./platform-backend.js";

// A package's read by name as the runtime's fetch sends it to a listener on loopback: the path the listener receives, not the string
// the backend handed fetch, which the URL resolves first.

let server: Server | undefined;
afterEach(async () => { await new Promise((done) => (server === undefined ? done(undefined) : server.close(done))); server = undefined; });

async function listening() {
  const received: string[] = [];
  server = createServer((request, response) => {
    received.push(request.url ?? "");
    response.writeHead(404, { "content-type": "application/json" }).end(JSON.stringify({ error: "unknown_package" }));
  });
  await new Promise<void>((done) => server!.listen(0, "127.0.0.1", done));
  const { port } = server.address() as AddressInfo;
  const fetch = ((path: string, init?: RequestInit) => globalThis.fetch(`http://127.0.0.1:${port}${path}`, init)) as typeof globalThis.fetch;
  const backend = new PlatformBackend({ fetch, eventSource: () => { throw new Error("no stream here"); }, clientId: "tab-1", go: () => undefined, leaving: { set: () => undefined, take: () => false }, renewing: { set: () => undefined, take: () => undefined } });
  return { backend, received };
}

it("never sends a name with a `.` or `..` part, which the URL would fold out of the by-name route, and answers it as a name nobody has", async () => {
  const { backend, received } = await listening();
  for (const name of ["../x", "..", "../../account/money", "x/../y", "a/./b"]) await expect(backend.npmPackage(name), name).rejects.toThrow(/^unknown_package$/);
  expect(received).toEqual([]);
});

it("asks any other name on the by-name route, a scope's slash a slash and every other character encoded", async () => {
  const { backend, received } = await listening();
  for (const name of ["@a/b/c", "a b", "a%2Fb", "a//b"]) await expect(backend.npmPackage(name), name).rejects.toThrow(/^unknown_package$/);
  expect(received).toEqual(["/plugins/npm/%40a/b/c", "/plugins/npm/a%20b", "/plugins/npm/a%252Fb", "/plugins/npm/a//b"]);
});
