#!/usr/bin/env python3
"""Prepare one-shot sheet as a local personal template; quote only, no paid generation."""
import json,re,urllib.request
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2];OUT=ROOT/'.studio-e2e/templates/one-shot';OUT.mkdir(parents=True,exist_ok=True)
BASE='http://localhost:18080/api'
def call(method,path,body=None):
    req=urllib.request.Request(BASE+path,data=json.dumps(body,ensure_ascii=False).encode() if body is not None else None,method=method,headers={'X-App-Code':'aiavatar','Content-Type':'application/json'})
    with urllib.request.urlopen(req,timeout=60) as response:return json.load(response)['data']
def ledger():
    rows=[]
    for page in range(50):
        part=call('GET',f'/me/ledger?size=100&page={page}');rows+=part
        if len(part)<100:return rows
    raise AssertionError('Ledger audit limit exceeded')
state=json.loads((OUT/'checkpoint.json').read_text()) if (OUT/'checkpoint.json').exists() else {}
def save(): (OUT/'checkpoint.json').write_text(json.dumps(state,ensure_ascii=False,indent=2))
before=ledger();asset=next(a for a in call('GET','/v1/ip-studio/studio/ip-assets') if a['avatarId']=='DH-39773' and a.get('current') and not a.get('lookId'))
reference={k:asset[k] for k in ['ipId','avatarId','version','storageKey'] if asset.get(k) is not None}|{'role':'character'}
prompt=re.search(r'```text\n(.*?)\n```',(ROOT/'docs/prompts/ip-character-sheet.md').read_text(),re.S).group(1)
if 'source' not in state:
    state['source']=call('POST','/v1/ip-studio/projects',{'name':'一次出图 · 模板作者画布'});save()
    doc={'nodes':[{'id':'input','type':'image','title':'人物参考','position':{'x':60,'y':100},'width':300,'height':400,'metadata':{'storageKey':reference['storageKey']}},{'id':'sheet','type':'image','title':'人物设定图 · 一次出图','position':{'x':460,'y':100},'width':440,'height':440,'metadata':{'prompt':prompt}}],'connections':[{'id':'ref','fromNodeId':'input','toNodeId':'sheet'}],'viewport':{'x':0,'y':0,'k':1}}
    call('PUT',f"/v1/ip-studio/projects/{state['source']['id']}",{'doc':doc})
if 'version' not in state:
    recipe={'inputs':[{'id':'character','nodeId':'input','label':'人物参考','type':'character','required':True}],'steps':[{'id':'sheet','nodeId':'sheet','title':'人物设定图 · 一次出图','operation':'image','prompt':prompt,'references':['character'],'size':'1024x1024','outputRole':'sheet','requiresAdoption':True}]}
    state['version']=call('POST',f"/v1/ip-studio/projects/{state['source']['id']}/template-versions",{'name':'IP 人物设定图 · 一次出图','summary':'一次生成一张包含人物档案、三视图、表情、服装/面部细节、配饰和材质配色的设定图，采用后继续参考出单独镜头。','visibility':'personal','recipe':recipe});save()
use={'name':'小紫 · 一次出图设定图','versionId':state['version']['id'],'inputs':{'character':{'reference':reference}},'model':'studio-live-agnes-image'}
plan=call('POST','/v1/ip-studio/template-plan',use);assert plan['imageCount']==1 and len(plan['steps'])==1 and plan['totalCost']==8 and plan['steps'][0]['outputRole']=='sheet'
if 'instance' not in state:state['instance']=call('POST','/v1/ip-studio/template-instances',use);save()
execution=call('GET',f"/v1/ip-studio/projects/{state['instance']['project']['id']}/template-execution");assert len(execution['steps'])==1 and not execution['steps'][0].get('run')
assert ledger()==before
report={'templateId':state['version']['templateId'],'versionId':state['version']['id'],'projectId':state['instance']['project']['id'],'imageCount':1,'quotedCredits':8,'newGenerationRequests':0,'ledgerUnchanged':True,'actualImageQualityVerified':False}
(OUT/'report.json').write_text(json.dumps(report,ensure_ascii=False,indent=2));print(json.dumps(report,ensure_ascii=False,indent=2))
