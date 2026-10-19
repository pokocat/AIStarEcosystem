#!/usr/bin/env python3
"""One original product material, reused IP, no supplier secrets or real brand claims."""
import json,time,urllib.request,uuid
from pathlib import Path
out=Path('.studio-e2e/m5');out.mkdir(parents=True,exist_ok=True);path=out/'checkpoint.json'
state=json.loads(path.read_text()) if path.exists() else {}
def save():path.write_text(json.dumps(state,ensure_ascii=False,indent=2))
def call(method,route,body=None):
 req=urllib.request.Request('http://localhost:18080/api'+route,data=None if body is None else json.dumps(body).encode(),method=method,headers={'Content-Type':'application/json','X-App-Code':'aiavatar'})
 with urllib.request.urlopen(req,timeout=65) as r:return json.load(r)['data']
baseline=json.load(open('.studio-e2e/real/checkpoint.json'));ref={**baseline['adoption'],'role':'character'}
if 'projectId' not in state:state['projectId']=call('POST','/v1/ip-studio/projects',{'name':'小紫 × 灵感杯 · 商品视频验收'})['id'];save()
p=state['projectId']
request=state.setdefault('productRequest',{'clientRequestId':str(uuid.uuid4()),'nodeId':'m5-product','operation':'image','prompt':'原创无品牌产品概念图：奶白色圆柱随行杯，浅紫杯盖，光滑简洁杯身，没有文字、没有标识、没有品牌。浅灰影棚背景，单一杯子，产品清晰、柔和自然光，商业产品摄影。仅为原创演示商品，不描绘任何真实品牌。','model':'studio-live-agnes-image','aspectRatio':'3:4','count':1,'maxCost':8});save()
if 'product' not in state:
 r=call('POST',f'/v1/ip-studio/projects/{p}/studio-runs',request);print(json.dumps({'runId':r['id'],'status':r['status'],'cost':r['cost']}),flush=True)
 while r['status']=='running':time.sleep(2);r=call('GET',f"/v1/ip-studio/runs/{r['id']}")
 state['product']=r;save();assert r['status']=='done',(r.get('errorCode'),r.get('errorMessage'))
 assert call('POST',f'/v1/ip-studio/projects/{p}/studio-runs',request)['id']==r['id']
project=call('GET',f'/v1/ip-studio/projects/{p}');doc=project['doc'];master=baseline['results']['master']['output']['candidates'][0];image=state['product']['output']['candidates'][0]
if not doc['nodes']:
 doc['nodes']=[{'id':'m5-ip','type':'image','title':'小紫 · 已采用 IP','position':{'x':80,'y':80},'width':280,'height':420,'metadata':{'status':'success','storageKey':ref['storageKey'],'content':master['url'],'studio':{'kind':'ip','adoption':baseline['adoption']}}},{'id':'m5-product','type':'image','title':'灵感随行杯 · 原创概念商品','position':{'x':450,'y':80},'width':280,'height':420,'metadata':{'status':'success','storageKey':image['key'],'content':image['url'],'prompt':request['prompt'],'studio':{'kind':'shot','assetRole':'product','runId':state['product']['id'],'request':request}}}];doc['viewport']={'x':80,'y':80,'k':.8};call('PUT',f'/v1/ip-studio/projects/{p}',{'doc':doc})
state['catalog']=call('GET','/v1/ip-studio/studio/asset-catalog');save();print(json.dumps({'projectId':p,'voiceEngineReady':state['catalog']['voiceEngineReady'],'cost':state['product']['cost']}),flush=True)
