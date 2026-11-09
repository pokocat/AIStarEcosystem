// Isolated browser acceptance: actual Next UI, deterministic local API responses; never contacts production.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
const root=process.cwd(), port=Number(process.env.PORT||3321), appDir=path.join(root,'apps/web-aiavatar');
const next=createRequire(path.join(appDir,'package.json'))('next');
const app=next({dev:true,dir:appDir,hostname:'127.0.0.1',port,webpack:true});
const catalog=JSON.parse(fs.readFileSync(path.join(root,'apps/server/src/main/resources/ipstudio/scenes.json')));
const projects=new Map(), events=[];
const now='2026-11-09T06:00:00Z';
const blank=()=>({nodes:[],connections:[],viewport:{x:0,y:0,k:1}});
const input=()=>({...blank(),sceneInputs:{images:['ui/product.webp']},nodes:[{id:'product',type:'image',title:'商品图1',position:{x:0,y:0},width:300,height:350,metadata:{storageKey:'ui/product.webp',content:'/studio/scene-covers/white-background.webp'}}],sceneVideoState:{text:'保留商品外观，采用自然光与近景镜头，突出使用场景。',edit:{prompt:'一、剧情概述\n以轻松自然的口播介绍商品。\n\n二、素材与职责\n图1为商品外观参考。保留白色机身和镜头细节，采用自然光下的桌面场景。\n\n三、镜头脚本\n'+('先展示使用场景，再给商品特写，最后回到人物口播。\n').repeat(28)},language:'中文',duration:5,ratio:'9:16',tier:'768p',optimize:false,options:{}}});
function task(state){const id='PEX-ui-'+state,pid='IPP-ui-'+state,done=state==='done',failed=state==='failed';const doc=input();projects.set(pid,{id:pid,name:'口播带货 · '+state,sceneId:'ecom-talking',doc,docVersion:1,createdAt:now,updatedAt:now});return {id,projectId:pid,sceneId:'ecom-talking',kind:'direct',title:'口播带货 · '+({running:'生成中',done:'已完成',failed:'生成失败'}[state]),createdAt:now,input:doc,execution:{id,projectId:pid,status:done?'done':failed?'needs_user':'running',stage:'production',steps:[{id:'video',title:'生成视频',operation:'video',stage:'production',status:done?'done':failed?'failed':'submitted',runIds:[id+'-video'],attempt:1,dependsOn:[],...(failed?{errorCode:'STUDIO_VIDEO_FAILED',reason:'视频生成失败，未生成的视频不扣积分。请重新生成。'}:{})}],budgets:[{stage:'production',approvedCap:30,autoFixCap:0,spent:done?30:0,inFlight:state==='running'?30:0,remaining:done?0:30}],updatedAt:now}};}
const tasks=new Map();
const textRuns=new Map();
const scriptBody='一、剧情概述\n给喜欢记录日常的人推荐这款小相机，语气自然，像朋友分享。\n\n二、镜头脚本\n第1镜（0—3秒）：人物看向镜头。\n旁白：「出门想拍照，又嫌设备太占地方？」\n\n第2镜（3—10秒）：图1的小相机拿到镜头前，展示白色机身和彩色条纹。\n旁白：「看看这款小相机，拿着挺方便。」\n\n第3镜（10—15秒）：人物将相机放回桌面。\n旁白：「喜欢的话，可以点开商品看看。」';
const chatInput=input(); delete chatInput.sceneVideoState;
chatInput.nodes.push({id:'script-1',type:'text',title:'视频脚本',position:{x:520,y:120},width:480,height:360,metadata:{content:scriptBody,status:'success',studio:{kind:'text',sceneDirector:{ask:'写一段15秒口播，语气自然一些。',revision:false,duration:15,ratio:'9:16',language:'中文',at:now,videoModel:'ui-test-model',refs:['ui/product.webp']}}}});
projects.set('IPP-chat',{id:'IPP-chat',name:'口播带货 · 编导对话验收',sceneId:'ecom-talking',doc:structuredClone(chatInput),docVersion:1,createdAt:now,updatedAt:now});
projects.set('IPP-chat-mobile',{id:'IPP-chat-mobile',name:'口播带货 · 手机验收',sceneId:'ecom-talking',doc:structuredClone(chatInput),docVersion:1,createdAt:now,updatedAt:now});
const model={endpointId:'ui-test-model',name:'界面验收模型',isDefault:true,selectableById:true,supportsPromptOptimization:false,batchCounts:[1],contract:{minSeconds:5,maxSeconds:15,promptMaxChars:8000,seedMax:100,tiers:[{tier:'768p',canvases:[{aspectRatio:'9:16',width:432,height:768}]}],modes:[{mode:'universal_reference_video',references:{image:{mediaType:'image',maxCount:9,maxBytes:100e6,formats:[]},video:{mediaType:'video',maxCount:1,maxBytes:100e6,formats:[],maxDurationSec:60},audio:{mediaType:'audio',maxCount:3,maxBytes:100e6,formats:[]},maxTotal:12,minVisual:1,maxImagesWithVideo:8,maxAudioTotalSec:15}}]},pricing:{perSecond:{universal_reference_video:{'768p':2}},freeRefImages:9,extraRefImagePerSecond:0,promptOptimizationPerCall:0}};
const me={id:'ui-acceptance-user',uid:'ui-acceptance-user',nickname:'界面验收账号',displayName:'界面验收账号',role:'USER',platforms:['aiavatar'],enrollments:[{product:'aiavatar',status:'active'}],phoneVerified:true};
const json=(res,data,extra={})=>{res.writeHead(200,{'Content-Type':'application/json'});res.end(JSON.stringify({success:true,data,...extra}));};
const body=async(req)=>{let text='';for await(const c of req)text+=c;return JSON.parse(text||'{}');};
await app.prepare();const handle=app.getRequestHandler();
http.createServer(async(req,res)=>{try{const url=new URL(req.url,'http://localhost:'+port),p=url.pathname;
if(p==='/__ui-start'){res.writeHead(200,{'Content-Type':'text/html; charset=utf-8'});res.end('<script>localStorage.setItem("aiavatar_token","ui-only-local-token");localStorage.setItem("aistareco.auth.token","ui-only-local-token");location.replace("/video?scene=ecom-talking&draft=IPP-chat")</script>');return;}
if(p==='/__ui-evidence')return json(res,{events,projects:[...projects.values()],tasks:[...tasks.values()]});
if(p.startsWith('/__ui-media/')){const file='/Users/donis/BuildBox/artifacts/studio-depth-smoke/reference.mp4';res.writeHead(200,{'Content-Type':'video/mp4','Content-Length':fs.statSync(file).size});return fs.createReadStream(file).pipe(res);}
if(!p.startsWith('/api/'))return handle(req,res);
const route=p.slice(4);events.push({method:req.method,route});
if(route==='/me')return json(res,me);
if(route.includes('wallet')||route.endsWith('/balance'))return json(res,{available:1613,balance:1613,frozen:0});
if(route.endsWith('/scenes'))return json(res,catalog);
if(route.endsWith('/video-models'))return json(res,[model]);
if(route.endsWith('/capabilities'))return json(res,{mock:true,operations:['video','text','image','assemble'],imageCost:8,textCost:1,videoCost:30,textModels:[{endpointId:'ui-test-text',name:'界面验收文字',isDefault:true,supportsVision:true,tokenPricing:{maxCost:2}}]});
if(route.endsWith('/video-task-price'))return json(res,{estimated:10,cap:10,segments:[5],boards:0});
if(route.endsWith('/asset-catalog'))return json(res,{products:[],performers:[],voices:[]});
if(route.endsWith('/voice-profiles'))return json(res,{items:[],voices:[],profiles:[]});
if(route.endsWith('/models'))return json(res,{image:[],video:[]});
if(route.endsWith('/assets/sign')){const b=await body(req);return json(res,Object.fromEntries((b.keys??[]).map(k=>[k,k.includes('product')?'/studio/scene-covers/white-background.webp':'/__ui-media/source.mp4'])));}
if(route.endsWith('/video-tasks'))return json(res,{items:[...tasks.values()],page:0,hasMore:false});
if(route.includes('/video-tasks/'))return json(res,tasks.get(route.split('/').pop()));
if(route.endsWith('/studio-runs')&&req.method==='POST'){
 const b=await body(req), id='IPR-chat-'+textRuns.size, request={...b};
 events.push({method:'SUBMIT',operation:b.operation,revision:b.scene?.revision,nodeId:b.nodeId});
 const rewritten=scriptBody.replace('出门想拍照，又嫌设备太占地方？','相机带了，走到门口又想放回去？').replace('看看这款小相机，拿着挺方便。','白色机身，配上这道彩色条纹，外观很有辨识度。');
 textRuns.set(id,{id,status:'done',kind:'studio-text',inputs:request,cost:1,output:{textRevision:{summary:'已按修改意见调整，保留原素材与时长。',content:rewritten},text:rewritten},started:Date.now()});
 return json(res,{id,status:'running',kind:'studio-text',inputs:request,output:{}});
}
if(route.includes('/runs/')){const run=textRuns.get(route.split('/').pop());if(run)return json(res,Date.now()-run.started>500?run:{...run,status:'running',output:{}});}
if(route.includes('/runs/')){const id=route.split('/').pop(),done=id.includes('-done-'),failed=id.includes('-failed-');return json(res,{id,status:done?'done':failed?'failed':'running',kind:'studio-video',cost:done?30:0,output:done?{videoCandidates:[{status:'done',storageKey:'ui/result.mp4',jobId:'ui-job'}]}:{},errorCode:failed?'STUDIO_VIDEO_FAILED':undefined});}
if(route.includes('/videos/'))return json(res,{id:'ui-job',status:'succeeded',thumbnail_url:'/studio/scene-covers/white-background.webp',video_url:'/__ui-media/source.mp4'});
if(route.endsWith('/projects')){if(req.method==='POST'){const b=await body(req),id='IPP-ui-new-'+projects.size,project={id,name:b.name,sceneId:b.sceneId,doc:blank(),docVersion:1,createdAt:now,updatedAt:now};projects.set(id,project);return json(res,project);}return json(res,[...projects.values()]);}
if(/\/projects\/[^/]+$/.test(route)){const id=route.split('/').pop(),project=projects.get(id);if(req.method==='PUT'){const b=await body(req);Object.assign(project,b,{docVersion:(project.docVersion??1)+1});}return json(res,project);}
if(route.endsWith('/billing-selection'))return json(res,{found:false});
if(route.includes('/portrait'))return json(res,{items:[],libraries:[]});
if(route.endsWith('/price'))return json(res,{estimatedCredits:10,credits:10});
return json(res,[],{pagination:{page:0,size:24,total:0,hasNext:false}});
}catch(error){console.error(error);res.writeHead(500,{'Content-Type':'application/json'});res.end(JSON.stringify({success:false,error:{code:'UI_FIXTURE_ERROR',message:String(error)}}));}}).listen(port,'127.0.0.1',()=>console.log('UI-only Next preview http://127.0.0.1:'+port));
