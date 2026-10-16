import { build } from 'esbuild';
import { fileURLToPath } from 'node:url';
import { readFile, copyFile } from 'node:fs/promises';
const root=fileURLToPath(new URL('../../',import.meta.url));
// Only decodeMediaFrames and visualBoundaries are included. Their dependency graph uses Node builtins.
// The unused CLI grid/transcript branches are omitted; no fake or replacement implementations are supplied.
const result=await build({write:!process.argv.includes('--check'),entryPoints:[root+'tools/hypit-media/entry.ts'],outfile:root+'apps/server/src/main/resources/hypit-media/cli.mjs',bundle:true,platform:'node',target:'node22',format:'esm',treeShaking:true,
  banner:{js:'/* Hypit media adapter. Upstream dc2b7a8f31b1ef1443a79ca448548d69e3ceb6a0; see tools/hypit-media/vendor/LICENSE and UPSTREAM.json. */'},
  plugins:[{name:'unused-cli-dependencies',setup(build){build.onResolve({filter:/^(sharp|@hypit\/speech-evidence)$/},args=>({path:args.path,external:true,sideEffects:false}));}}]});

if(process.argv.includes('--check')) { const expected=await readFile(root+'apps/server/src/main/resources/hypit-media/cli.mjs','utf8');if(result.outputFiles[0].text!==expected)throw new Error('Bundled Hypit adapter is stale; run pnpm hypit:media:build'); }

for(const name of ['LICENSE','UPSTREAM.json']) {
  const source=root+'tools/hypit-media/vendor/'+name,target=root+'apps/server/src/main/resources/hypit-media/'+name;
  if(process.argv.includes('--check')) {if(await readFile(source,'utf8')!==await readFile(target,'utf8'))throw new Error('Stale Hypit attribution: '+name);}
  else await copyFile(source,target);
}
