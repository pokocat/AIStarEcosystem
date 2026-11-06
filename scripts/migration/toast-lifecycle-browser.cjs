// Real React provider lifecycle; synthetic messages and no external requests.
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict');
const {chromium}=require('playwright'),esbuild=require('esbuild');
const root=path.resolve(__dirname,'../..'),app=path.join(root,'apps/admin');
const out=process.env.TOAST_BROWSER_OUTPUT||path.join(root,'apps/server/target/toast-browser');fs.mkdirSync(out,{recursive:true});
const entry=path.join(out,'fixture.tsx');
fs.writeFileSync(entry,`
import React from 'react';import{createRoot}from'react-dom/client';
import{ToastProvider,useToast}from ${JSON.stringify(path.join(app,'src/components/feedback/Toaster.tsx'))};
const originalSet=window.setTimeout.bind(window),originalClear=window.clearTimeout.bind(window);const pending=new Set<number>();
(window as any).__toastTest={pending,fired:0};
window.setTimeout=((fn:any,ms:number,...args:any[])=>{let id=originalSet(()=>{if(ms===60001){pending.delete(id);(window as any).__toastTest.fired++;}fn(...args);},ms);if(ms===60001)pending.add(id);return id;}) as any;
window.clearTimeout=((id:number)=>{pending.delete(id);originalClear(id);}) as any;
function Producer(){const toast=useToast();(window as any).__toastApi=toast;return <button onClick={()=>toast.success({title:'合成保存提示',duration:60001})}>显示提示</button>}
function Fixture(){const[show,setShow]=React.useState(true);return <><h1>提示生命周期验收</h1><button onClick={()=>setShow(false)}>离开测试界面</button>{show&&<ToastProvider><Producer/></ToastProvider>}</>}
createRoot(document.getElementById('root')!).render(<Fixture/>);
`);
(async()=>{
 await esbuild.build({entryPoints:[entry],outfile:path.join(out,'fixture.js'),bundle:true,platform:'browser',format:'iife',jsx:'automatic',alias:{'@/lib/utils':path.join(app,'src/lib/utils.ts'),react:path.dirname(require.resolve('react/package.json',{paths:[app]})),'react-dom':path.dirname(require.resolve('react-dom/package.json',{paths:[app]}))},define:{'process.env.NODE_ENV':'"production"'},logLevel:'warning'});
 fs.writeFileSync(path.join(out,'index.html'),'<!doctype html><html lang="zh-CN"><meta charset="UTF-8"><title>合成提示验收</title><body><div id="root"></div><script src="/fixture.js"></script></body></html>');
 const server=http.createServer((req,res)=>{const name=req.url==='/fixture.js'?'fixture.js':'index.html';res.setHeader('Content-Type',name.endsWith('.js')?'text/javascript; charset=utf-8':'text/html; charset=utf-8');res.end(fs.readFileSync(path.join(out,name)))});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const base='http://127.0.0.1:'+server.address().port;let browser;
 try{
  const options={headless:true};if(process.platform==='darwin')options.executablePath='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';browser=await chromium.launch(options);const page=await browser.newPage();let external=0;
  await page.route('**/*',route=>route.request().url().startsWith(base+'/')?route.continue():(external++,route.abort()));
  await page.goto(base);await page.getByRole('button',{name:'显示提示',exact:true}).click();await page.getByRole('status').waitFor();assert.equal(await page.evaluate(()=>window.__toastTest.pending.size),1);
  await page.getByRole('button',{name:'离开测试界面',exact:true}).click();await page.getByRole('status').waitFor({state:'detached'});assert.equal(await page.evaluate(()=>window.__toastTest.pending.size),0);
  await page.evaluate(()=>window.__toastApi.success({title:'晚到的合成回调',duration:60001}));const state=await page.evaluate(()=>({pending:window.__toastTest.pending.size,fired:window.__toastTest.fired}));assert.equal(state.pending,0);assert.equal(state.fired,0);assert.equal(external,0);
  const proof={real_browser:true,real_provider:true,toast_visible_before_navigation:true,unmount_cancels_deadline:true,late_callback_ignored:true,external_requests:0,production_changed:false};fs.writeFileSync(path.join(out,'receipt.json'),JSON.stringify(proof,null,2));console.log(JSON.stringify(proof,null,2));
 }finally{if(browser)await browser.close();server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}
})().catch(e=>{console.error(e);process.exitCode=1});
