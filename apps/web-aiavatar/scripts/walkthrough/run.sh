#!/usr/bin/env bash
# 用户视角自动走查（jsdom + esbuild，mock+live 五套 80+ 断言）
#   bash apps/web-aiavatar/scripts/walkthrough/run.sh
set -e
cd "$(dirname "$0")/../.."
npm ls jsdom >/dev/null 2>&1 || npm i -D jsdom esbuild --no-fund --no-audit --no-save
npx esbuild src/proto/app.tsx --bundle --format=esm --platform=browser --jsx=automatic \
  --outfile=scripts/walkthrough/dist/app.js --external:react --external:react-dom \
  --define:process.env.NEXT_PUBLIC_USE_MOCK='"1"'
npx esbuild src/proto/app.tsx --bundle --format=esm --platform=browser --jsx=automatic \
  --outfile=scripts/walkthrough/dist/app-live.js --external:react --external:react-dom \
  --define:process.env.NEXT_PUBLIC_USE_MOCK='"0"'
cd scripts/walkthrough
for f in walk.mjs walk2.mjs walk3.mjs walk4.mjs walk5.mjs; do
  echo "== $f =="
  node "$f" || exit 1
done
echo "走查全部通过 ✅"
