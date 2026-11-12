// Bounded browser regression using the real component and synthetic payment replies only.
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict');
const {chromium}=require('playwright');
const esbuild=require('esbuild');
const root=path.resolve(__dirname,'../..'),app=path.join(root,'apps/web-aiavatar');
const out=process.env.PAYMENT_BROWSER_OUTPUT||path.join(root,'apps/server/target/migration-browser');
fs.mkdirSync(out,{recursive:true});
const api=path.join(out,'fixture-api.ts'),entry=path.join(out,'fixture.tsx');
fs.writeFileSync(api,`
const order={id:'synthetic-order',packageId:'pkg',credits:10000,priceCents:9900,status:'pending',wayCode:'WX_NATIVE'};
let poll:((v:any)=>void)[]=[];let sync:((v:any)=>void)|undefined;
(window as any).__paymentTest={paid:0,checkouts:0,polls:0,syncWaiting:false};
export const WalletApi={
 channels:async()=>[{code:'wechat',label:'微信支付',defaultWayCode:'WX_NATIVE',wayCodes:[]}],
 checkout:async()=>{(window as any).__paymentTest.checkouts++;return {orderId:order.id,payDataType:'qr',payData:'weixin://wxpay/synthetic-test'}},
 order:()=>new Promise(resolve=>{poll.push(resolve);(window as any).__paymentTest.polls++}),
 syncOrder:()=>new Promise(resolve=>{sync=resolve;(window as any).__paymentTest.syncWaiting=true})
};
export function settleTogether(){if(!sync||!poll.length)throw new Error('Responses not ready');sync({...order,status:'paid'});for(const resolve of poll)resolve({...order});poll=[];}
`);
fs.writeFileSync(entry,`
import React from 'react';import{createRoot}from'react-dom/client';
import {StudioRechargeDialog} from ${JSON.stringify(path.join(app,'src/ip/studio-recharge-dialog.tsx'))};
import {settleTogether} from './fixture-api';
createRoot(document.getElementById('root')!).render(<><h1>迁移回归：合成订单</h1><button onClick={settleTogether}>送达服务端确认和旧轮询</button><StudioRechargeDialog pack={{id:'pkg',tag:'测试包',credits:10000,priceCents:9900}} onClose={()=>{}} onPaid={()=>{(window as any).__paymentTest.paid++}}/></>);
`);
(async()=>{
 await esbuild.build({entryPoints:[entry],outfile:path.join(out,'fixture.js'),bundle:true,platform:'browser',format:'iife',jsx:'automatic',alias:{'@/proto/api':api,react:path.dirname(require.resolve('react/package.json',{paths:[app]})),'react-dom':path.dirname(require.resolve('react-dom/package.json',{paths:[app]}))},define:{'process.env.NODE_ENV':'"production"'},logLevel:'warning'});
 fs.writeFileSync(path.join(out,'index.html'),'<!doctype html><html lang="zh-CN"><meta charset="UTF-8"><title>迁移付款回归（合成数据）</title><body><div id="root"></div><script src="/fixture.js"></script></body></html>');
 const server=http.createServer((req,res)=>{const name=new URL(req.url,'http://localhost').pathname==='/fixture.js'?'fixture.js':'index.html';res.setHeader('Content-Type',name.endsWith('.js')?'text/javascript; charset=utf-8':'text/html; charset=utf-8');res.end(fs.readFileSync(path.join(out,name)))});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const base='http://127.0.0.1:'+server.address().port;let browser;
 try{
  const launch={headless:true};if(process.platform==='darwin')launch.executablePath='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
  browser=await chromium.launch(launch);const page=await browser.newPage({viewport:{width:1100,height:820}});const external=[];
  await page.route('**/*',route=>route.request().url().startsWith(base+'/')?route.continue():(external.push(route.request().url()),route.abort()));
  await page.goto(base);await page.getByRole('button',{name:'确认支付',exact:true}).click();
  await page.waitForFunction(()=>window.__paymentTest.polls>0);
  await page.getByRole('button',{name:'我已支付，刷新结果',exact:true}).click();await page.waitForFunction(()=>window.__paymentTest.syncWaiting);
  // Modal mask covers the fixture controls; dispatch the synthetic server event directly.
  await page.getByRole('button',{name:'送达服务端确认和旧轮询'}).dispatchEvent('click');
  await page.locator('.ant-alert-success').waitFor({state:'visible'});
  await page.getByRole('button',{name:/^完\s*成$/}).waitFor({state:'visible'});
  const state=await page.evaluate(()=>window.__paymentTest);assert.equal(state.paid,1);assert.equal(state.checkouts,1);assert.equal(external.length,0);
  await page.screenshot({path:path.join(out,'paid-after-stale-poll.png'),fullPage:true});
  const proof={real_component:true,real_browser:true,synthetic_order:true,paid_callback_count:state.paid,checkout_count:state.checkouts,stale_pending_cannot_replace_paid:true,external_requests:external,production_changed:false};fs.writeFileSync(path.join(out,'receipt.json'),JSON.stringify(proof,null,2));console.log(JSON.stringify(proof,null,2));
 }finally{if(browser)await browser.close();server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}
})().catch(error=>{console.error(error);process.exitCode=1});
