import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
const root=process.cwd();
const config=JSON.parse(fs.readFileSync(path.join(root,'private/channels-encrypted.json'),'utf8'));
let key=Buffer.from(fs.readFileSync(path.join(root,'private/transport-key'),'utf8').trim());
if(key.length!==32)key=crypto.createHash('sha256').update(key).digest();
function endpoint(id){let e=config.find(x=>x.id===id);if(!e)throw Error('Endpoint not configured');let b=Buffer.from(e.encryptedKey,'base64'),d=crypto.createDecipheriv('aes-256-gcm',key,b.subarray(0,12));d.setAuthTag(b.subarray(-16));return {...e,apiKey:Buffer.concat([d.update(b.subarray(12,-16)),d.final()]).toString()};}
function save(file,data){fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,JSON.stringify(data,null,2)+'\n',{mode:0o600});}
async function request(e,route,init={}){let h={Authorization:'Bearer '+e.apiKey,...init.headers};let r=await fetch(e.baseUrl.replace(/\/$/,'')+route,{...init,headers:h,signal:AbortSignal.timeout(650000)});let text=await r.text();let data;try{data=JSON.parse(text);}catch{data={text:text.slice(0,500)};}if(!r.ok)throw Error('HTTP '+r.status+' '+JSON.stringify(data).slice(0,600));return data;}
function dataUrl(file){let ext=path.extname(file).toLowerCase(),mime=ext==='.png'?'image/png':'image/jpeg';return 'data:'+mime+';base64,'+fs.readFileSync(file).toString('base64');}
const [command,arg]=process.argv.slice(2);
if(['image','video-submit'].includes(command)&&fs.existsSync(path.join(root,'PAID_WORK_DISABLED')))throw Error('Paid requests disabled by user budget instruction; polling and downloads remain allowed');
function reserveBudget(spec){
 const file=path.join(root,'budget-additional.json'),lock=path.join(root,'private/budget-reservation.lock');
 if(!fs.existsSync(file))throw Error('No explicit additional credit budget');
 let fd;try{fd=fs.openSync(lock,'wx',0o600);}catch{throw Error('Budget reservation busy; retry before submission');}
 try{let b=JSON.parse(fs.readFileSync(file,'utf8'));if(!b.reservations[spec.id]){let estimate=Number(spec.estimatedSupplierCredits);if(!Number.isFinite(estimate)||estimate<=0)throw Error('Missing conservative supplier-credit estimate');let reserved=Object.values(b.reservations).reduce((sum,x)=>sum+x.credits,0);if(reserved+estimate>b.authorizedAdditionalCredits)throw Error('Additional supplier credit budget exceeded');b.reservations[spec.id]={credits:estimate,state:'reserved-before-submit',at:new Date().toISOString()};b.remainingUnreservedCredits=b.authorizedAdditionalCredits-Object.values(b.reservations).reduce((sum,x)=>sum+x.credits,0);fs.writeFileSync(file,JSON.stringify(b,null,2)+'\n',{mode:0o600});}}finally{fs.closeSync(fd);fs.unlinkSync(lock);}
}
if(command==='discover'){
 let e=endpoint('ai-jusuan-minimax-h3');
 for(let route of ['/services','/services/minimax-h3']){
  try{let d=await request(e,route);save(path.join(root,'analysis',route.includes('minimax')?'h3-capability.json':'available-services.json'),d);console.log(route,JSON.stringify(d).slice(0,12000));}catch(err){console.log(route,String(err));}
 }
}else if(command==='image'){
 if(fs.existsSync(path.join(root,'budget-additional.json')))throw Error('Additional allowance is supplier credits; reuse existing images rather than incurring separate image fees');
 let spec=JSON.parse(fs.readFileSync(arg,'utf8')),e=endpoint('ai-abadd123-a06'),dest=path.resolve(spec.output),receipt=dest+'.receipt.json';
 if(fs.existsSync(dest)){console.log('Reusing',dest);process.exit(0);}
 if(fs.existsSync(receipt))throw Error('Existing receipt without image: inspect and recover before a new call');
 let body={model:'gpt-image-2',prompt:spec.prompt,images:spec.references.map(dataUrl),n:1,size:'768x1360',response_format:'b64_json'};
 save(dest+'.request.json',{...body,images:spec.references});
 let r=await request(e,'/images/generations',{method:'POST',headers:{'Content-Type':'application/json','Idempotency-Key':spec.id},body:JSON.stringify(body)});
 let raw=r.data?.[0]?.b64_json;if(!raw){save(receipt,r);throw Error('Image response has no base64 output; raw result preserved');}
 fs.mkdirSync(path.dirname(dest),{recursive:true});fs.writeFileSync(dest,Buffer.from(raw,'base64'));let copy=structuredClone(r);for(let x of copy.data||[])delete x.b64_json;save(receipt,copy);console.log('Image ready',dest,fs.statSync(dest).size);
}else if(command==='video-submit'){
 let spec=JSON.parse(fs.readFileSync(arg,'utf8')),e=endpoint('ai-jusuan-minimax-h3'),folder=path.resolve(spec.folder);if(spec.model)e.model=spec.model;fs.mkdirSync(folder,{recursive:true});
 if(fs.existsSync(folder+'/create.json')){console.log('Existing job',JSON.stringify(JSON.parse(fs.readFileSync(folder+'/create.json','utf8'))));process.exit(0);}
 reserveBudget(spec);
 let refs=[];
 for(let [i,input] of spec.references.entries()){
  let receipt=folder+'/upload-'+i+'.json',r;
  if(fs.existsSync(receipt))r=JSON.parse(fs.readFileSync(receipt,'utf8'));else{
   let form=new FormData();form.set(input.type,new Blob([fs.readFileSync(input.path)],{type:input.type==='video'?'video/mp4':'image/png'}),path.basename(input.path));
   r=await request(e,'/assets/input?model='+encodeURIComponent(e.model),{method:'POST',body:form});save(receipt,r);
  }
  let id=r.asset?.assetId||r.assetId||r.data?.asset?.assetId;if(!id)throw Error('Upload response missing asset id');
  refs.push({role:input.type==='video'?'reference_video':'reference_image',mediaType:input.type,assetId:id});
 }
 let body={model:e.model,generationMode:'universal_reference_video',prompt:spec.prompt,optimizePrompt:false,resolutionTier:'768p',orientation:'portrait',aspectRatio:'9:16',outputSizeCode:'768P_9_16',seconds:spec.seconds,referenceInputs:refs};
 // Use the published service canvas identifier rather than assuming the spelling above.
 delete body.outputSizeCode;
 if(spec.model==='wan2-2-animate-14b'){body={model:spec.model,characterMode:spec.characterMode||'character_replace',resolutionTier:'720p',speedMultiplier:1,input_image_asset_id:refs.find(x=>x.mediaType==='image').assetId,input_video_asset_id:refs.find(x=>x.mediaType==='video').assetId};}
 if(spec.seed!==undefined)body.seed=spec.seed;
 if(fs.existsSync(folder+'/request.json')){let frozen=JSON.parse(fs.readFileSync(folder+'/request.json','utf8'));if(JSON.stringify(frozen)!==JSON.stringify(body))throw Error('Frozen request differs: refusing to reuse idempotency key');}
 save(folder+'/request.json',body);
 let r=await request(e,'/media/generations',{method:'POST',headers:{'Content-Type':'application/json','Idempotency-Key':spec.id},body:JSON.stringify(body)});save(folder+'/create.json',r);console.log('Video accepted',JSON.stringify(r));
}else if(command==='video-poll'){
 let folder=path.resolve(arg),e=endpoint('ai-jusuan-minimax-h3'),created=JSON.parse(fs.readFileSync(folder+'/create.json','utf8')),id=created.jobId||created.id;if(created.model)e.model=created.model;
 let r=await request(e,'/jobs/'+encodeURIComponent(id)+'?model='+encodeURIComponent(e.model));save(folder+'/status.json',r);console.log(JSON.stringify({jobId:id,status:r.status,stage:r.stage,elapsedSeconds:r.elapsedSeconds,usage:r.usage,error:r.errorCode||r.errorMessage,assets:(r.assets||r.outputs||[]).map(x=>({assetId:x.assetId,byteSize:x.byteSize,sha256:x.sha256}))}));
 if(r.status==='succeeded'){
  let assets=r.assets||r.outputs||r.result?.assets||[];if(!Array.isArray(assets))assets=[];
  let a=assets.find(x=>x.mediaType==='video'||x.type==='video'||x.mimeType?.startsWith('video/'))||assets[0];
  let aid=a?.assetId||a?.id;
  if(aid&&!fs.existsSync(folder+'/vendor.mp4')){let rr=await fetch(e.baseUrl.replace(/\/$/,'')+'/assets/'+encodeURIComponent(aid)+'/content?model='+encodeURIComponent(e.model),{headers:{Authorization:'Bearer '+e.apiKey},signal:AbortSignal.timeout(120000)});if(!rr.ok)throw Error('Asset download HTTP '+rr.status);fs.writeFileSync(folder+'/vendor.mp4',Buffer.from(await rr.arrayBuffer()));console.log('Downloaded',folder+'/vendor.mp4');}
 }
}else throw Error('Unknown command');
