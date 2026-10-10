#!/usr/bin/env python3
"""Verify settled real runs, download bytes, and populate their isolated review canvas.

Does not create new generation requests. Replays only checkpointed request IDs.
"""
import hashlib
import json
import subprocess
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

base='http://localhost:18080/api'
out=Path('.studio-e2e/real')
state=json.loads((out/'checkpoint.json').read_text())
project=state['projectId']
def call(method,path,body=None,expected=200):
    req=urllib.request.Request(base+path,method=method,
        data=None if body is None else json.dumps(body).encode(),
        headers={'Content-Type':'application/json','X-App-Code':'aiavatar'})
    try:
        with urllib.request.urlopen(req,timeout=60) as r:status,value=r.status,json.load(r)
    except urllib.error.HTTPError as e:status,value=e.code,json.load(e)
    assert status==expected,(path,status,value.get('error'))
    return value.get('data') if status==200 else value

assert not call('GET','/v1/ip-studio/studio/capabilities')['mock']
def ledger():
    entries=[]
    for page in range(100):
        batch=call('GET',f'/me/ledger?size=100&page={page}')
        entries.extend(batch)
        if len(batch)<100:return entries
    raise AssertionError('Ledger pagination exceeded acceptance bound')

before=ledger()
for name,request in state['requests'].items():
    existing=call('POST',f'/v1/ip-studio/projects/{project}/studio-runs',request)
    assert existing['id']==state['runIds'][name]
    assert existing['status']=='done',name
    changed=dict(request,prompt=request['prompt']+' changed')
    assert call('POST',f'/v1/ip-studio/projects/{project}/studio-runs',changed,409)['error']['code']=='STUDIO_REQUEST_CHANGED'
after=ledger()
assert before==after,'Replaying terminal request changed the ledger'
references={r['output'].get('nativeVideoJobId',r['id']) for r in state['results'].values()}
spends=[e for e in after if e['type']=='spend' and e['referenceId'] in references]
cost=sum(r['cost'] for r in state['results'].values())
assert -sum(e['amount'] for e in spends)==cost
assert all(sum(e['referenceId']==s['referenceId'] for e in spends)==1 for s in spends)
wallet=call('GET','/me/wallet')
assert wallet['pendingBalance']==0
for failure in state.get('failedHistory',[]):
    assert not any(e['type']=='spend' and e['referenceId']==failure['id'] for e in after)
    assert any(e['type']=='unfreeze' and e['referenceId']==failure['id'] for e in after)

result=state['results']['work'];key=result['output']['storageKey']
req=urllib.request.Request(base+'/v1/ip-studio/assets/content?key='+urllib.parse.quote(key),headers={'X-App-Code':'aiavatar'})
with urllib.request.urlopen(req,timeout=60) as r:raw=r.read()
video=out/'agnes-three-shot.mp4';video.write_bytes(raw)
assert hashlib.sha256(raw).hexdigest()==hashlib.sha256((Path('.studio-e2e/cdn')/key).read_bytes()).hexdigest()
probe=json.loads(subprocess.check_output(['ffprobe','-v','error','-show_format','-show_streams','-of','json',str(video)]))
vs=next(s for s in probe['streams'] if s['codec_type']=='video')
assert (vs['width'],vs['height'])==(720,1280)
assert 15<=float(probe['format']['duration'])<=15.5
assert vs['codec_name']=='h264' and any(s['codec_type']=='audio' for s in probe['streams'])

nodes=[];connections=[]
def node(name,kind,x,y,studio_kind,title=None,shot=None):
    run=state['results'][name];output=run['output'];request=state['requests'][name]
    studio={'kind':studio_kind,'runId':run['id'],'request':request,'references':request['references']}
    md={'status':'success','prompt':request['prompt'],'studio':studio}
    if output.get('script'):studio['script']=output['script']
    if shot:studio['shot']=shot;studio['order']=len([n for n in nodes if n['metadata']['studio'].get('shot')])
    if output.get('candidates'):
        md['images']=[{'id':run['id'],'storageKey':i['key'],'content':i['url'],'mimeType':'image/png'} for i in output['candidates']]
        md['storageKey']=output['candidates'][0]['key'];md['primaryImageId']=run['id'];md['content']=output['candidates'][0]['url']
    if output.get('storageKey'):
        md.update(storageKey=output['storageKey'],content=output['url'],primaryVideoId=run['id'])
        md['videos']=[{'id':run['id'],'storageKey':output['storageKey'],'content':output['url'],'mimeType':'video/mp4','seconds':str(output['durationSec'])}]
        studio['includeInWork']=studio_kind!='work'
    if name=='master':studio['adoption']=state['adoption']
    n={'id':request['nodeId'],'type':kind,'title':title or name,'position':{'x':x,'y':y},'width':480 if kind=='text' else 300,'height':300 if kind=='text' else 390,'metadata':md}
    nodes.append(n);return n
master=node('master','image',100,120,'ip','小紫 · Agnes 主形象')
script=node('script','text',100,660,'script','城市灵感 · 原始剧本')
board=node('storyboard','text',680,660,'script','当前正文 · 三镜分镜')
connections += [{'id':'master-script','fromNodeId':master['id'],'toNodeId':script['id']},{'id':'script-board','fromNodeId':script['id'],'toNodeId':board['id']}]
for i,shot in enumerate(state['results']['storyboard']['output']['shots']):
    frame=node('frame'+str(i),'image',1260+i*390,120,'shot',shot['title'],shot)
    clip=node('video'+str(i),'video',1260+i*390,660,'shot',shot['title']+' · 视频')
    clip['metadata']['studio'].update(order=i,parentNodeId=frame['id'])
    frame['metadata']['studio']['parentNodeId']=board['id']
    connections += [{'id':'board-frame'+str(i),'fromNodeId':board['id'],'toNodeId':frame['id']},{'id':'frame-video'+str(i),'fromNodeId':frame['id'],'toNodeId':clip['id']}]
work=node('work','video',2480,380,'work','城市灵感 · 真实成片')
for i in range(3):connections.append({'id':'clip-work'+str(i),'fromNodeId':'live-video'+str(i),'toNodeId':work['id']})
current=call('GET',f'/v1/ip-studio/projects/{project}')
if not current['doc']['nodes']:
    call('PUT',f'/v1/ip-studio/projects/{project}',{'doc':{'nodes':nodes,'connections':connections,'viewport':{'x':50,'y':0,'k':.4}},'baseDocVersion':current['docVersion']})
usages=call('GET',f"/v1/assets/usages?assetType=ip&assetId={state['adoption']['ipId']}")
assert any(u['usedById']==project and u['usedByType']=='studio-project' for u in usages)
report={'projectId':project,'ipId':state['adoption']['ipId'],'runIds':state['runIds'],'cost':cost,'spendEntries':len(spends),'pending':0,'replayedWithoutNewCharges':True,'downloadSha256':hashlib.sha256(raw).hexdigest(),'width':vs['width'],'height':vs['height'],'durationSec':float(probe['format']['duration']),'hasAudio':True,'sourceIpUsageVerified':True}
(out/'report.json').write_text(json.dumps(report,ensure_ascii=False,indent=2))
print(json.dumps(report,ensure_ascii=False))
