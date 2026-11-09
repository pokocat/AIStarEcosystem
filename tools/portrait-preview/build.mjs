import { build } from 'esbuild';
import { resolve } from 'node:path';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { gzipSync } from 'node:zlib';
import { execFileSync } from 'node:child_process';
const root=resolve(import.meta.dirname,'../..'), fixture=resolve(import.meta.dirname), output=resolve(fixture,'output');
await mkdir(output,{recursive:true});
const result=await build({entryPoints:[resolve(fixture,'entry.tsx')],bundle:true,format:'iife',write:false,minify:true,jsx:'automatic',target:'es2022',define:{'process.env.NODE_ENV':'"production"'},plugins:[{name:'isolated-preview',setup(build){
  build.onResolve({filter:/studio-errors$/},()=>({path:resolve(fixture,'errors.ts')}));
  build.onResolve({filter:/api\/video-portrait-library$/},()=>({path:resolve(fixture,'api.ts')}));
  build.onResolve({filter:/^@\/lib\/datetime$/},()=>({path:resolve(root,'packages/api-client/src/format.ts')}));
}}],nodePaths:[resolve(root,'apps/web-aiavatar/node_modules')],outdir:output});
let script=result.outputFiles.find(file=>file.path.endsWith('.js')).text;
for(const [token,name] of [['PORTRAIT_ONE_DATA','PA-02-1.jpg'],['PORTRAIT_TWO_DATA','PA-01-1.jpg'],['PORTRAIT_THREE_DATA','PA-03-1.jpg']]) {
  const thumbnail=resolve(output,name);
  // Inline small copies of existing public sample assets, so the chat CSP needs no external image host.
  execFileSync('/usr/bin/sips',['-Z','160',resolve(root,'apps/web-aiavatar/public/plaza',name),'--out',thumbnail],{stdio:'ignore'});
  script=script.replaceAll(token,'data:image/jpeg;base64,'+(await readFile(thumbnail)).toString('base64'));
}
const css=result.outputFiles.filter(file=>file.path.endsWith('.css')).map(file=>file.text).join('\n');
// The chat iframe has an opaque origin. Bundle dependencies locally so the preview
// works without third-party module loading; gzip keeps the inline artifact small.
const packed=gzipSync(script,{level:9}).toString('base64');
const fragment='<meta charset="utf-8"><div id="portrait-framework-root" aria-label="Ant Design 人像核验设计"></div>\n<style>'+css+'</style>\n<script>(async()=>{const bytes=Uint8Array.from(atob('+JSON.stringify(packed)+'),c=>c.charCodeAt(0));const source=await new Response(new Blob([bytes]).stream().pipeThrough(new DecompressionStream("gzip"))).text();const script=document.createElement("script");script.textContent=source;document.body.appendChild(script);})()</script>\n';
await writeFile(resolve(output,'portrait-framework.html'),fragment);
console.log(JSON.stringify({path:resolve(output,'portrait-framework.html'),bytes:Buffer.byteLength(fragment)}));
