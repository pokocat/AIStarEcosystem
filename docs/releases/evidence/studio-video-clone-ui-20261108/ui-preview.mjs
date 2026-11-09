// UI-only fixture preview. No real model, payment, credentials, or production API is used.
// The normal frontend is unmodified; these responses only exercise its visible states.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
const root=process.cwd(), port=Number(process.env.PORT||3313);
const appDir=path.join(root,'apps/web-aiavatar');
const next=createRequire(path.join(appDir,'package.json'))('next');
const app=next({dev:true,dir:appDir,hostname:'127.0.0.1',port});
const tasks=new Map(), started=new Map();
const now=()=>new Date().toISOString();
const limit=(mediaType,maxCount)=>({mediaType,maxCount,maxBytes:100e6,formats:[],minDurationSec:null,maxDurationSec:null});
const model={endpointId:'ui-test-model',name:'本地测试渠道',isDefault:true,selectableById:true,supportsPromptOptimization:false,batchCounts:[1],
  contract:{minSeconds:5,maxSeconds:15,promptMaxChars:4000,seedMax:100,
    tiers:[{tier:'768p',canvases:[{aspectRatio:'9:16',width:432,height:768},{aspectRatio:'16:9',width:768,height:432}]}],
    modes:[{mode:'universal_reference_video',needsFirstFrame:false,needsLastFrame:false,frameImage:null,
      references:{image:limit('image',9),video:{...limit('video',1),minDurationSec:2,maxDurationSec:60},audio:limit('audio',3),maxImagesWithVideo:8,maxTotal:12,minVisual:1,maxAudioTotalSec:15}}]},
  pricing:{perSecond:{universal_reference_video:{'768p':2}},freeRefImages:9,extraRefImagePerSecond:0,promptOptimizationPerCall:0}};
const node=(id,type,title,key)=>({id,type,title,position:{x:0,y:0},width:300,height:350,metadata:{storageKey:key,content:type==='video'?'/__ui-media/source.mp4':'/studio/scene-covers/white-background.webp'}});
const defaultInput=(kind)=>({nodes:[node('source','video','测试参考视频','ui/source.mp4'),node('product','image','商品参考图','ui/product.webp')],connections:[],viewport:{x:0,y:0,k:1},
  sceneInputs:{images:['ui/product.webp'],video:'ui/source.mp4'},sceneVideoState:{cloneMode:kind,text:'参考原片的动作和镜头，将商品换成我的精华液，背景改为自然光下的梳妆台。',language:'中文',duration:15,ratio:'9:16',tier:'768p',optimize:false,options:{}}});
function fixture(id,kind,phase='done',input=defaultInput(kind),projectId='IPP-0003mock') {
  const done=phase==='done', depth=kind==='depth',stamp=now();
  const steps=[];
  if(depth)steps.push({id:'depth',title:'提取动作与空间结构',operation:'video-control',stage:'production',dependsOn:[],status:phase==='depth'?'running':'done',runIds:[id+'-depth'],attempt:1,quotedCost:0,maxCost:0});
  steps.push({id:'video',title:'生成视频',operation:'video',stage:'production',dependsOn:depth?['depth']:[],status:done?'done':phase==='depth'?'pending':'running',runIds:phase==='depth'?[]:[id+'-video'],attempt:done?1:0,quotedCost:30,maxCost:30});
  return {id,kind,projectId,sceneId:'recreation',title:(depth?'深度复刻':kind==='replacement'?'元素替换':'分镜复刻')+' · 本地界面验收',createdAt:stamp,input,
    execution:{id,projectId,skillKey:'video-generation',skillVersion:1,stage:'production',status:done?'done':'running',steps,budgets:[{stage:'production',approvedCap:90,autoFixCap:60,spent:done?30:0,inFlight:done?0:30,remaining:done?60:90}],billing:{mode:'personal'},startedAt:stamp,updatedAt:stamp,finishedAt:done?stamp:undefined}};
}
tasks.set('PEX-ui-depth',fixture('PEX-ui-depth','depth','depth'));
tasks.set('PEX-ui-result',fixture('PEX-ui-result','replacement','done'));
function update(t){const time=started.get(t.id);if(!time)return t; const seconds=(Date.now()-time)/1000;const phase=seconds<8&&t.kind==='depth'?'depth':seconds<28?'video':'done';const value=fixture(t.id,t.kind,phase,t.input,t.projectId);value.createdAt=t.createdAt;value.execution.startedAt=t.createdAt;tasks.set(t.id,value);return value;}
const json=(res,data)=>{res.writeHead(200,{'Content-Type':'application/json'});res.end(JSON.stringify({success:true,data}));};
const read=async req=>{const chunks=[];for await(const c of req)chunks.push(c);const raw=Buffer.concat(chunks);return req.headers['content-type']?.includes('json')?JSON.parse(raw.toString()||'{}'):raw.toString();};
function run(id){
  const parent=[...tasks.values()].find(t=>id.startsWith(t.id+'-'));
  const control=id.endsWith('-depth'), t=parent?update(parent):undefined,step=t?.execution.steps.find(s=>s.operation===(control?'video-control':'video'));
  const done=step?.status==='done';
  return {id,projectId:t?.projectId,status:done?'done':'running',kind:control?'studio-video-control':'studio-video',cost:done&&!control?30:0,progress:done?100:35,stage:control?'video-control.depth':'video.generating',
    inputs:{canvasInputNodeIds:control?['source']:['product']},output:done?{storageKey:control?'ui/depth.mp4':'ui/result.mp4',durationSec:5,mock:true,...(!control?{videoCandidates:[{status:'done',storageKey:'ui/result.mp4',jobId:'ui-job'}]}:{})}:{mock:true}};
}
await app.prepare();const handle=app.getRequestHandler();
http.createServer(async(req,res)=>{
  try {
    const url=new URL(req.url,'http://localhost:'+port),p=url.pathname;
    if(p.startsWith('/__ui-media/')){
      const file='/Users/donis/BuildBox/artifacts/studio-depth-smoke/'+(p.endsWith('depth.mp4')?'depth.mp4':'reference.mp4');
      res.writeHead(200,{'Content-Type':'video/mp4','Content-Length':fs.statSync(file).size});fs.createReadStream(file).pipe(res);return;
    }
    if(!p.startsWith('/api/'))return handle(req,res);
    const route=p.slice(4);
    const overrides='/Users/donis/BuildBox/artifacts/studio-clone-ui-overrides.json';
    if(fs.existsSync(overrides)){const values=JSON.parse(fs.readFileSync(overrides,'utf8'));if(Object.hasOwn(values,route))return json(res,values[route]);}
    if(route.endsWith('/studio/video-models'))return json(res,[model]);
    if(route.endsWith('/studio/capabilities'))return json(res,{mock:true,operations:['video-control','video','recreation','text','image','assemble'],imageCost:8,textCost:1,videoCost:30,textModels:[{endpointId:'ui-test-text',name:'本地分析测试',isDefault:true,supportsVision:true,tokenPricing:{maxCost:2}}]});
    if(route.endsWith('/studio/video-task-price'))return json(res,{estimated:30,cap:90,segments:[15],boards:0});
    if(route.endsWith('/studio/asset-catalog'))return json(res,{products:[],performers:[],voices:[],voiceEngineReady:false,videoLipSyncReady:false});
    if(route.endsWith('/studio/ip-assets'))return json(res,[]);
    if(route.endsWith('/studio/voice-profiles'))return json(res,{items:[],voices:[],profiles:[]});
    if(route.endsWith('/models'))return json(res,{image:[],video:[]});
    if(route.endsWith('/assets/sign')){const body=await read(req);return json(res,Object.fromEntries((body.keys??[]).map(k=>[k,k.includes('product')?'/studio/scene-covers/white-background.webp':'/__ui-media/'+(k.includes('depth')?'depth.mp4':'source.mp4')])));}
    if(route.endsWith('/media-import')){const raw=await read(req),image=raw.includes('image/');return json(res,{key:image?'ui/product.webp':'ui/source.mp4',url:image?'/studio/scene-covers/white-background.webp':'/__ui-media/source.mp4',mediaType:image?'image':'video',mimeType:image?'image/webp':'video/mp4',bytes:700096,fileName:image?'商品参考图.webp':'测试参考视频.mp4',durationSec:2,width:720,height:1280});}
    if(route.endsWith('/library/folders'))return json(res,[]);
    if(route.endsWith('/library/folder'))return json(res,{folderId:''});
    if(route.endsWith('/library/materials')){
      const image=url.searchParams.get('kind')==='image';
      const item={id:image?'ui-product':'ui-source',kind:image?'image':'video',title:image?'商品参考图':'测试参考视频',source:'upload',createdAt:now(),
        data:image?{storageKey:'ui/product.webp',dataUrl:'/studio/scene-covers/white-background.webp'}:{storageKey:'ui/source.mp4',url:'/__ui-media/source.mp4',duration:2,durationSec:2},metadata:{}};
      res.writeHead(200,{'Content-Type':'application/json'});return res.end(JSON.stringify({success:true,data:[item],pagination:{page:0,size:24,total:1,totalPages:1,hasNext:false,hasPrevious:false}}));
    }
    if(route.endsWith('/library/sources'))return json(res,[]);
    if(route.endsWith('/library/objects')){res.writeHead(200,{'Content-Type':'application/json'});return res.end(JSON.stringify({success:true,data:[],pagination:{page:0,size:24,total:0,hasNext:false}}));}
    if(route.includes('/library/'))return json(res,[]);
    if(route.endsWith('/video-tasks')&&req.method==='POST'){
      const body=await read(req),id='PEX-ui-'+Date.now(),projectId=route.split('/projects/')[1]?.split('/')[0];
      const t=fixture(id,body.kind,body.kind==='depth'?'depth':'video',body.input,projectId);tasks.set(id,t);started.set(id,Date.now());return json(res,t);
    }
    if(route.endsWith('/video-tasks'))return json(res,{items:[...tasks.values()].map(update).reverse(),page:0,hasMore:false});
    if(route.includes('/video-tasks/'))return json(res,update(tasks.get(route.split('/').pop())));
    if(route.includes('/runs/'))return json(res,run(route.split('/').pop()));
    if(route.includes('/videos/'))return json(res,{id:'ui-job',status:'succeeded',thumbnail_url:'/studio/scene-covers/white-background.webp',video_url:'/__ui-media/source.mp4'});
    if(route.endsWith('/billing-selection'))return json(res,{found:false});
    if(route.endsWith('/sources'))return json(res,[]);
    return json(res,[]);
  }catch(error){res.writeHead(500,{'Content-Type':'application/json'});res.end(JSON.stringify({success:false,error:{code:'UI_FIXTURE_ERROR',message:String(error)}}));}
}).listen(port,'127.0.0.1',()=>console.log('UI FIXTURE ONLY — no model or billing calls — http://127.0.0.1:'+port));
