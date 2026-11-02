# Browser image decoder

The optional HEIC worker uses **libheif-js 1.23.5**, an Emscripten/WASM distribution of libheif with its codec dependencies.

- Project and corresponding source: https://github.com/catdad-experiments/libheif-js/tree/d8ec4bc3bc5bf8055975577bccbbc7e1d7313c2d
- Included libheif source: https://github.com/strukturag/libheif
- HEVC decoder libde265 source: https://github.com/strukturag/libde265
- libheif-js license: GNU LGPL version 3; the installed package includes LICENSE.
- The worker is an independent asset, loaded on demand and served by the application. It does not require users to retrieve code from a third-party CDN.

Preserve the dependency's notices and license when distributing its worker/WASM assets. Build inputs, dependency version and integrity are recorded in pnpm-lock.yaml. This project does not modify the decoder library.

The browser-visible license is included in each consuming app at `/licenses/libheif-js-LICENSE.txt`.
