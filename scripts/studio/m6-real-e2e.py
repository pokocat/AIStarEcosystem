#!/usr/bin/env python3
"""Bounded, resumable two-episode acceptance; provider credentials remain in the server."""
import argparse,copy,json,time,urllib.request,urllib.error,uuid
from pathlib import Path
args=argparse.ArgumentParser();args.add_argument('--frames',action='store_true');args.add_argument('--retry-failed',action='store_true');args.add_argument('--text-model',default='studio-live-agnes-text');options=args.parse_args()
out=Path('.studio-e2e/m6');out.mkdir(parents=True,exist_ok=True);path=out/'checkpoint.json'
state=json.loads(path.read_text()) if path.exists() else {'requests':{},'results':{}}
if options.retry_failed:
 for name,result in list(state['results'].items()):
  if result['status']=='failed':
   state.setdefault('failedHistory',[]).append(result);state['results'].pop(name);state['requests'].pop(name,None)
def save():path.write_text(json.dumps(state,ensure_ascii=False,indent=2))
def call(method,route,body=None,expected=200):
 req=urllib.request.Request('http://localhost:18080/api'+route,data=None if body is None else json.dumps(body).encode(),method=method,headers={'Content-Type':'application/json','X-App-Code':'aiavatar'})
 try:
  with urllib.request.urlopen(req,timeout=65) as r:status,value=r.status,json.load(r)
 except urllib.error.HTTPError as e:status,value=e.code,json.load(e)
 if status!=expected:raise RuntimeError((route,status,value.get('error',{})))
 return value.get('data')
cap=call('GET','/v1/ip-studio/studio/capabilities');assert not cap['mock'];state['capabilities']=cap
baseline=json.load(open('.studio-e2e/real/checkpoint.json'));ref={**baseline['adoption'],'role':'character'}
if 'projectId' not in state:state['projectId']=call('POST','/v1/ip-studio/projects',{'name':'小紫的两集短剧 · Agnes 验收'})['id'];save()
project=state['projectId']
def run(name,operation,prompt,**kwargs):
 if name in state['results']:return state['results'][name]
 request=state['requests'].setdefault(name,{'clientRequestId':str(uuid.uuid4()),'nodeId':'m6-'+name,'operation':operation,'prompt':prompt,'references':[ref],**kwargs});save()
 current=call('POST',f'/v1/ip-studio/projects/{project}/studio-runs',request)
 print(json.dumps({'name':name,'runId':current['id'],'status':current['status'],'cost':current['cost']},ensure_ascii=False),flush=True)
 deadline=time.monotonic()+1800
 while current['status']=='running' and time.monotonic()<deadline:
  time.sleep(2);current=call('GET',f"/v1/ip-studio/runs/{current['id']}")
 state['results'][name]=current;save()
 assert current['status']=='done',(name,current.get('errorCode'),current.get('errorMessage'))
 assert not current['output'].get('mock',False)
 assert call('POST',f'/v1/ip-studio/projects/{project}/studio-runs',request)['id']==current['id']
 return current
settings={'genre':'都市治愈','audience':'年轻创作者','era':'现代城市','core':'发现微小灵感','style':'原创3D潮玩','episodeCount':2,'episodeDurationSec':5}
script=run('script','script','小紫的两集超短治愈故事。第1集：城市街角，看到一束阳光，小紫抬头微笑。第2集：同一街角，小紫想通了创意，面向镜头挥手。每集恰好1个镜头，每镜5秒，只有小紫一人，浅紫短发、白色卫衣；大纲、人物与分集正文完整。每镜必须标注 episodeNo，镜头ID全剧唯一。',settings=settings,model=options.text_model,maxCost=2)
scriptData=script['output']['script'];assert len(scriptData['episodes'])==2
edited=copy.deepcopy(scriptData);edited.pop('shots',None)
board=run('board','storyboard','按当前编辑正文，拆成2集、每集恰好1镜，每镜5秒：\n'+json.dumps(edited,ensure_ascii=False),settings=settings,model=options.text_model,maxCost=2)
assert {s['episodeNo'] for s in board['output']['shots']}=={1,2}
# Put real authored context into this project so the assistant must resolve the selected ids on the server.
def node(id,type,title,metadata,x,y,w=360,h=320):return {'id':id,'type':type,'title':title,'position':{'x':x,'y':y},'width':w,'height':h,'metadata':metadata}
def metadata(result,kind):return {'status':'success','studio':{'kind':kind,'runId':result['id'],'request':state['requests'][kind if kind in state['requests'] else 'board'],'references':[ref],'settings':settings,'script':result['output']['script']},'content':result['output']['text']}
p=call('GET',f'/v1/ip-studio/projects/{project}')
if not p['doc']['nodes']:
 master=baseline['results']['master']['output']['candidates'][0];nodes=[node('m6-ip','image','小紫 · 已采用主形象',{'status':'success','storageKey':ref['storageKey'],'content':master['url'],'studio':{'kind':'ip','adoption':baseline['adoption']}},80,60,260,380),node('m6-script','text','两集短剧正文',metadata(script,'script'),440,60),node('m6-board','text','两集分镜',metadata(board,'script'),900,60)]
 nodes[2]['metadata']['studio']['runId']=board['id'];nodes[2]['metadata']['studio']['request']=state['requests']['board']
 call('PUT',f'/v1/ip-studio/projects/{project}',{'doc':{'nodes':nodes,'connections':[{'id':'c1','fromNodeId':'m6-ip','toNodeId':'m6-script'},{'id':'c2','fromNodeId':'m6-script','toNodeId':'m6-board'}],'viewport':{'x':0,'y':40,'k':0.45}}})
for mode in ['general','original','adapt','director']:
 result=run('assistant-'+mode,'assistant','讨论这两集的节奏，保留小紫浅紫短发和白色卫衣。先给建议，不生成视频。',mode=mode,contextNodeIds=['m6-script','m6-board'],history=[{'role':'user','content':'希望是一部极短的城市治愈短剧'}],model=options.text_model,maxCost=2)
 assert result['output'].get('plan') and len(result['inputs']['appliedCanvasContext'])==2
p=call('GET',f'/v1/ip-studio/projects/{project}');doc=p['doc']
for mode in ['general','original','adapt','director']:
 name='assistant-'+mode;result=state['results'][name];id='m6-'+name
 if not any(n['id']==id for n in doc['nodes']):
  doc['nodes'].append(node(id,'text','创作对话 · '+mode,{'status':'success','content':result['output']['text'],'studio':{'kind':'assistant','runId':result['id'],'request':state['requests'][name],'conversation':{'mode':mode,'turns':[{'role':'user','content':state['requests'][name]['prompt']},{'role':'assistant','content':result['output']['text']}],'plan':result['output']['plan']}}},440,500+['general','original','adapt','director'].index(mode)*350,460,300))
call('PUT',f'/v1/ip-studio/projects/{project}',{'doc':doc})
if options.frames:
 shots=board['output']['shots'];p=call('GET',f'/v1/ip-studio/projects/{project}');doc=p['doc'];nodes=doc['nodes']
 for i,shot in enumerate(shots):
  result=run('frame'+str(i),'image',shot['description']+'。严格保持所选参考图的同一小紫形象，浅紫短发、白色卫衣，原创3D潮玩。',model='studio-live-agnes-image',aspectRatio='9:16',count=1,maxCost=8)
  candidate=result['output']['candidates'][0]
  if not any(n['id']=='m6-frame'+str(i) for n in nodes):
   nodes.append(node('m6-frame'+str(i),'image',shot['title'],{'status':'success','storageKey':candidate['key'],'content':candidate['url'],'prompt':shot['description'],'studio':{'kind':'shot','shot':shot,'episodeNo':shot['episodeNo'],'order':i,'parentNodeId':'m6-board','references':[ref],'runId':result['id'],'request':state['requests']['frame'+str(i)]}},1400+i*390,60,300,390));doc['connections'].append({'id':'shot'+str(i),'fromNodeId':'m6-board','toNodeId':'m6-frame'+str(i)})
 call('PUT',f'/v1/ip-studio/projects/{project}',{'doc':doc})
print(json.dumps({'projectId':project,'completed':list(state['results']),'cost':sum(r['cost'] for r in state['results'].values())},ensure_ascii=False),flush=True)
