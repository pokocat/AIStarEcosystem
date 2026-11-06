#!/usr/bin/env node
// One foreground preview process: Next plus a deterministic local upstream, on declared devq ports.
// Only for isolated acceptance. No real provider keys or production configuration are read here.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const output='/tmp/aistar-video-task-acceptance-20261106';
const media=path.join(output,'media');
const jobs=new Map();
let failVideos=0,delay=4000;
const json=(res,value,status=200)=>{res.writeHead(status,{'Content-Type':'application/json'});res.end(JSON.stringify(value));};
const body=async req=>{let raw='';for await(const part of req)raw+=part;return raw?JSON.parse(raw):{};};
const strings=messages=>(messages??[]).map(m=>typeof m.content==='string'?m.content:(m.content??[]).filter(p=>p.type==='text').map(p=>p.text).join('\n')).join('\n');
const split=seconds=>{const result=[];while(seconds>15){result.push(15);seconds-=15;}if(seconds)result.push(seconds);return result;};
function textResult(text){
  const overrides=path.join(output,'fixture-overrides.json');
  if(fs.existsSync(overrides)){const match=JSON.parse(fs.readFileSync(overrides,'utf8')).find(rule=>text.includes(rule.contains));if(match)return match.result;}
  // The exact test prompt is kept in a private local directory to debug fixture/schema mismatches.
  fs.mkdirSync(output,{recursive:true});fs.writeFileSync(path.join(output,'last-prompt.txt'),text,{mode:0o600});
  const durations=[...text.matchAll(/第\s*\d+\s*段[^\n]{0,15}?(\d+)\s*秒/g)].map(m=>Number(m[1]));
  const total=Number(text.match(/写一条\s*(\d+)\s*秒/)?.[1]??text.match(/视频总时长\s*(\d+)/)?.[1]??30);
  if(text.includes('referenceBindings')&&text.includes('approaches')&&text.includes('production')){
    const seconds=split(Number(text.match(/视频总时长\s*(\d+)/)?.[1]??24));
    const model=text.match(/视频模型必须使用\s*([^；\s]+)/)?.[1]??'dev-fake-llm';
    const ids=[...text.matchAll(/"id"\s*:\s*"([^"]+)"[^\n]{0,100}?"type"\s*:\s*"image"/g)].map(m=>m[1]);
    return {summary:'按参考片的节奏制作本地验收短片',recommendedApproachId:'rewrite',approaches:[{id:'rewrite',title:'重新演绎',summary:'保留节奏，使用新素材',rationale:'本地验收',preserve:['节奏'],change:['主体'],tradeoffs:[],requiredCapabilities:[]}],
      steps:[...seconds.map((n,i)=>({id:`v${i+1}`,operation:'video',title:`第 ${i+1} 段视频`,prompt:'LOCAL TEST 本地验收画面，平稳展示，不生成文字。',execution:'auto',dependsOn:[],settings:{operation:'video',model,video:{mode:ids.length?'universal_reference_video':'t2v',resolutionTier:'720p',optimizePrompt:false},durationSec:n,aspectRatio:'9:16',count:1,referenceBindings:ids.slice(0,1).map((id,j)=>({nodeId:id,role:'reference-image',order:j+1}))}})),...(seconds.length>1?[{id:'film',operation:'assemble',title:'合成视频',prompt:'按顺序合成',execution:'auto',dependsOn:seconds.map((_,i)=>`v${i+1}`),settings:{operation:'assemble',clipOrder:seconds.map((_,i)=>({stepId:`v${i+1}`})),audioStrategy:'generated'}}]:[])],questions:[]};
  }
  if(text.includes('segments')&&text.includes('shots')&&text.includes('assets')){
    const times=durations.length?durations:split(total);
    return {title:'本地验收短片',summary:'展示测试素材',style:'真人写实',assets:[],segments:times.map((n,i)=>({no:i+1,title:`第 ${i+1} 段`,summary:'本地验收',durationSec:n,shots:Array.from({length:n>=12?3:2},(_,j)=>({durationSec:n/(n>=12?3:2),size:'中景',camera:'固定机位',still:'测试画面，中央主体保持清楚',action:'平稳展示',dialogue:[]}))}))};
  }
  if(text.includes('targetRunId')&&text.includes('check')||text.includes('checkIds')){
    const known=['subject-consistency','scene-and-action','subject-replaced','old-subject-residue','character-consistency','product-facts','dialogue-and-subtitles','duration-and-order'];
    return {status:'pass',items:known.filter(id=>text.includes(id)).map(id=>({id,status:'pass',evidence:[{kind:'frame',observation:'本地验收画面可读取'}],reason:'测试素材',suggestion:''}))};
  }
  if(text.includes('observations')&&text.includes('visible'))return {look:'固定机位，干净背景',uncertainties:'仅用于本地流程验收',observations:[{visible:'中央测试主体清晰可见',frames:[1]}]};
  if(text.includes('creativePremise')||text.includes('recreationPrompt'))return {title:'本地参考片',creativePremise:'测试短片按固定节奏展示主体',visualGenes:['媒介与美术风格','色彩体系','光线体系','材质与后期','构图体系','摄影机体系'].map(dimension=>({dimension,observed:'测试主体居中',rule:'保持干净构图',frames:[1]})),skeleton:['镜头语言与时空关系','影像与声音','叙事与动作'].map(dimension=>({dimension,observed:'固定节奏',rule:'按顺序展示',frames:[1]})),techniques:['固定机位','稳定构图'].map(name=>({name,effect:'主体清楚',observed:'镜头稳定',rule:'保持稳定',frames:[1]})),motifs:['中央主体'],retain:['节奏与构图'],recreationPrompt:'使用新素材按原片节奏展示',uncertainties:['仅用于本地流程验收']};
  return {text:'本地验收：使用提供的素材，按所选时长平稳展示主体。',changes:[]};
}
const upstream=http.createServer(async(req,res)=>{
  try{
    const url=new URL(req.url,'http://127.0.0.1:18091');
    if(url.pathname==='/__control'&&req.method==='POST'){const cfg=await body(req);failVideos=cfg.failVideos??failVideos;delay=cfg.delay??delay;return json(res,{failVideos,delay});}
    if(url.pathname.endsWith('/chat/completions')){
      const input=await body(req),prompt=strings(input.messages),content=JSON.stringify(textResult(prompt));
      await new Promise(resolve=>setTimeout(resolve,800));
      return json(res,{id:`local-${Date.now()}`,object:'chat.completion',model:input.model,choices:[{index:0,message:{role:'assistant',content},finish_reason:'stop'}],usage:{prompt_tokens:100,completion_tokens:200,total_tokens:300}});
    }
    if(url.pathname.includes('/images/generations')){await body(req);return json(res,{data:[{b64_json:fs.readFileSync(path.join(media,'reference.png')).toString('base64')}]});}
    if(req.method==='POST'){
      const input=await body(req),id=`local-video-${Date.now()}`;
      const seconds=Number(input.duration??input.duration_sec??input.durationSeconds??input.seconds??15);
      jobs.set(id,{at:Date.now(),seconds,fail:failVideos>0});if(failVideos>0)failVideos--;
      return json(res,{id,task_id:id,status:'processing'});
    }
    const id=url.pathname.split('/').pop(),job=jobs.get(id);
    if(job){
      if(Date.now()-job.at<delay)return json(res,{id,status:'processing',task_status:'PROCESSING'});
      if(job.fail)return json(res,{id,status:'failed',task_status:'FAILED',error:{code:'LOCAL_TEST_FAILURE',message:'本地验收：模拟生成失败'}});
      const video=`http://127.0.0.1:13013/acceptance-media/video-${job.seconds}.mp4`;
      return json(res,{id,status:'succeeded',task_status:'SUCCESS',video_url:video,url:video,output:{url:video},data:{url:video},video_result:[{url:video}]});
    }
    json(res,{error:{message:'local fixture route not found'}},404);
  }catch(error){json(res,{error:{message:String(error)}},500);}
});
upstream.listen(18091,'127.0.0.1',()=>console.log('Local test upstream: 127.0.0.1:18091; no paid providers'));
const appDir=path.join(root,'apps/web-aiavatar');
const next=createRequire(path.join(appDir,'package.json'))('next');
const app=next({dev:true,dir:appDir,hostname:'127.0.0.1',port:13013});
await app.prepare();
const handle=app.getRequestHandler();
http.createServer((req,res)=>{
  const url=new URL(req.url,'http://127.0.0.1:13013');
  if(url.pathname.startsWith('/acceptance-media/')){
    const name=path.basename(url.pathname),file=path.join(media,name);
    if(!fs.existsSync(file)){res.writeHead(404);return res.end();}
    const stat=fs.statSync(file),range=req.headers.range;
    if(range){const [startRaw,endRaw]=range.replace('bytes=','').split('-'),start=Number(startRaw),end=endRaw?Number(endRaw):stat.size-1;res.writeHead(206,{'Content-Type':name.endsWith('.mp4')?'video/mp4':'image/png','Accept-Ranges':'bytes','Content-Range':`bytes ${start}-${end}/${stat.size}`,'Content-Length':end-start+1});return fs.createReadStream(file,{start,end}).pipe(res);}
    res.writeHead(200,{'Content-Type':name.endsWith('.mp4')?'video/mp4':'image/png','Content-Length':stat.size});return fs.createReadStream(file).pipe(res);
  }
  return handle(req,res);
}).listen(13013,'127.0.0.1',()=>console.log('Video task preview: http://127.0.0.1:13013'));
