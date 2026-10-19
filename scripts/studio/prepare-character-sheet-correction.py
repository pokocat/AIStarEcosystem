#!/usr/bin/env python3
"""Publish a corrected local personal sheet version and prepare a new, free instance.

Keep the failed v1 instance and request intact. This script never generates media.
"""
import json,re,urllib.request
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2];OUT=ROOT/'.studio-e2e/templates/one-shot/corrected';OUT.mkdir(parents=True,exist_ok=True)
BASE='http://localhost:18080/api';FILE=OUT/'prepare.json'
def call(method,path,body=None):
    req=urllib.request.Request(BASE+path,method=method,data=json.dumps(body,ensure_ascii=False).encode() if body is not None else None,headers={'Content-Type':'application/json','X-App-Code':'aiavatar'})
    with urllib.request.urlopen(req,timeout=65) as response:return json.load(response)['data']
state=json.loads(FILE.read_text()) if FILE.exists() else {}
def save():FILE.write_text(json.dumps(state,ensure_ascii=False,indent=2))
before=call('GET','/me/ledger?size=1000&page=0')
old=json.loads((ROOT/'.studio-e2e/templates/one-shot/checkpoint.json').read_text());sourceId=old['source']['id']
prompt=re.search(r'```text\n(.*?)\n```',(ROOT/'docs/prompts/ip-character-sheet.md').read_text(),re.S).group(1)
if 'version' not in state:
    source=call('GET','/v1/ip-studio/projects/'+sourceId);doc=source['doc']
    next(n for n in doc['nodes'] if n['id']=='sheet')['metadata']['prompt']=prompt
    call('PUT','/v1/ip-studio/projects/'+sourceId,{'doc':doc})
    recipe={**old['version']['recipe'],'steps':[{**old['version']['recipe']['steps'][0],'prompt':prompt}]}
    state['version']=call('POST',f'/v1/ip-studio/projects/{sourceId}/template-versions',{'templateId':old['version']['templateId'],'name':old['version']['name'],'summary':old['version']['summary'],'visibility':'personal','recipe':recipe});save()
asset=next(a for a in call('GET','/v1/ip-studio/studio/ip-assets') if a['avatarId']=='DH-39773' and a['current'])
reference={k:asset[k] for k in ['ipId','avatarId','version','storageKey']}|{'role':'character'}
use={'name':'小紫 · 一次出图设定图 · 修正验收','versionId':state['version']['id'],'inputs':{'character':{'reference':reference}},'model':'studio-live-agnes-image'}
state['plan']=call('POST','/v1/ip-studio/template-plan',use);assert state['plan']['imageCount']==1 and state['plan']['totalCost']==8
if 'instance' not in state:state['instance']=call('POST','/v1/ip-studio/template-instances',use);save()
assert before==call('GET','/me/ledger?size=1000&page=0')
print(json.dumps({'projectId':state['instance']['project']['id'],'versionId':state['version']['id'],'version':state['version']['version'],'imageCount':1,'cost':8,'ledgerUnchanged':True}))
