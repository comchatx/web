# ComChatX web

The page code of [ComChatX](https://www.comchatx.com) and its site, under the MIT license.

This repository is a copy. It is cut from ComChatX's private repository after each release train, and each sync is one commit. This copy is private commit `5118b863f967e77db0e360982af5526a7e5dbdc8`.

## What is here

- `src/web/`: the page code a seller's browser runs, with its tests. The three entries are `live-main.ts`, `door-main.ts` and `road-main.ts`.
- `src/shared/`: the files of the shared code that the page imports.
- `site/`: the site served at www.comchatx.com, as it is built.

The browser-side platform client is included. The server implementation and files that depend on excluded private files stay private. The copied files keep their original paths. Some comments point to design notes that are not public.

## Checks

```bash
npm ci
npx tsc --noEmit
npx vitest run
node src/web/theme.mjs --check
```

Node 24 (`.nvmrc`). No secret and no service is needed.

## Contributing

Issues and pull requests are welcome. A pull request is carried into the private repository with `git am`, so its commits keep their author. It appears here at the next sync, and the pull request is closed with a link to that sync's commit.
