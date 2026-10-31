# react-notion-avatar 1.1.12

Upstream: https://github.com/zonemeen/react-notion-avatar (MIT; see `LICENSE`).

`index.js` is the unmodified `notion-dist/index.mjs` from the published npm package;
`index.d.ts` and `LICENSE` are also copied verbatim. The runtime only imports React.
We vendor these files because the published dependency list also installs its demo
application, Create React App, and React 17. Studio uses its existing React 19.

Source: https://registry.npmjs.org/react-notion-avatar/-/react-notion-avatar-1.1.12.tgz

- npm tarball SHA-1: `8b3f461de4730023160c73ba8f7c5b039259c8c3`
- `index.js` SHA-256: `b2b2c050827a3a993499b3cd895cf897389fba2cb1fad160e65114ddc8261daa`

Keep the library unchanged. Account defaults, image fallback, and profile editing
belong in `src/shell/account-avatar*` and `src/proto/api.ts`.
