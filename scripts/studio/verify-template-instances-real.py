#!/usr/bin/env python3
"""Free local API acceptance. Uses owned existing IP assets; never starts generation or deployment."""
import json, urllib.request, urllib.error
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2]
OUT=ROOT/'.studio-e2e/templates';OUT.mkdir(parents=True,exist_ok=True)
BASE='http://localhost:18080/api'
def call(method,path,body=None):
    request=urllib.request.Request(BASE+path,data=json.dumps(body,ensure_ascii=False).encode() if body is not None else None,method=method,headers={'X-App-Code':'aiavatar','Content-Type':'application/json'})
    with urllib.request.urlopen(request,timeout=60) as response:return json.load(response).get('data')
def rejected(method,path,body,code=None):
    try:call(method,path,body)
    except urllib.error.HTTPError as e:
        result=json.load(e)['error'];assert e.code in (400,403,404,409),result
        if code:assert result['code']==code,result
        return result['code']
    raise AssertionError('Expected rejection')
def ledger():
    rows=[]
    for page in range(50):
        part=call('GET',f'/me/ledger?size=100&page={page}');rows+=part
        if len(part)<100:return rows
    raise AssertionError('Ledger exceeded audit limit')
def checkpoint(state):
    (OUT/'checkpoint.json').write_text(json.dumps(state,ensure_ascii=False,indent=2))
state=json.loads((OUT/'checkpoint.json').read_text()) if (OUT/'checkpoint.json').exists() else {}
before=ledger()
assets=call('GET','/v1/ip-studio/studio/ip-assets')
first=next(a for a in assets if a['avatarId']=='DH-39773' and a.get('current'))
second=next(a for a in assets if a['avatarId']!=first['avatarId'] and a.get('ipId')!=first.get('ipId') and a.get('current') and not a.get('lookId'))
def reference(asset):return {k:asset[k] for k in ['ipId','avatarId','version','storageKey','lookId'] if asset.get(k) is not None}|{'role':'character'}
labels=[('main','主形象','main','参考人物全身主形象，风格：{{style}}。保留人物身份、服装、发型与关键配饰。干净背景，不添加文字。'),('front','正视图','front','严格保持主形象，正面全身视角，不添加文字。'),('side','侧视图','side','严格保持主形象，侧面全身视角，不添加文字。'),('back','背视图','back','严格保持主形象，背面全身视角，服装发型配饰一致，不添加文字。'),('happy','开心表情','expression','保持主形象，开心表情的面部特写，不添加文字。'),('curious','好奇表情','expression','保持主形象，好奇表情的面部特写，不添加文字。'),('face','面部与发型细节','detail','保持主形象，清楚展示面部和发型细节，不添加文字。'),('outfit','服装细节','detail','保持主形象，清楚展示已有服装细节，不发明道具，不添加文字。')]
if 'sourceProjectId' not in state:
    source=call('POST','/v1/ip-studio/projects',{'name':'人物资产包 · 模板作者验收'})
    state['sourceProjectId']=source['id'];checkpoint(state)
    nodes=[{'id':'author-input','type':'image','title':'本人参考图','position':{'x':60,'y':100},'width':300,'height':390,'metadata':{'storageKey':first['storageKey'],'studio':{'kind':'character','adoption':reference(first),'runId':'must-not-publish'}}},{'id':'author-style','type':'text','title':'风格','position':{'x':60,'y':560},'width':300,'height':160,'metadata':{'content':'作者私有说明不进入模板'}}]
    steps=[];edges=[]
    for index,(id,label,role,prompt) in enumerate(labels):
        nodeId='author-'+id
        nodes.append({'id':nodeId,'type':'image','title':label,'position':{'x':430 if index==0 else 850+(index-1)%3*370,'y':100 if index==0 else 100+(index-1)//3*490},'width':300,'height':390,'metadata':{'prompt':prompt,'studio':{'kind':'character' if index==0 else 'shot'}}})
        parent='author-input' if index==0 else 'author-main'
        edges.append({'id':'edge-'+id,'fromNodeId':parent,'toNodeId':nodeId})
        steps.append({'id':id,'nodeId':nodeId,'title':label,'operation':'image','prompt':prompt,'references':['character' if index==0 else 'main'],'size':'768x1024' if role not in ['expression','detail'] else '1024x1024','outputRole':role,'requiresAdoption':index==0})
    doc={'nodes':nodes,'connections':edges,'viewport':{'x':0,'y':0,'k':0.65}}
    call('PUT','/v1/ip-studio/projects/'+source['id'],{'doc':doc,'baseDocVersion':source['docVersion']})
    state['recipe']={'inputs':[{'id':'character','nodeId':'author-input','label':'IP 或参考图','type':'character','required':True},{'id':'style','nodeId':'author-style','label':'人物风格','type':'option','required':True,'options':['清爽 3D 潮玩','动漫插画'],'defaultValue':'清爽 3D 潮玩'}],'steps':steps};checkpoint(state)
if 'v1' not in state:
    state['v1']=call('POST',f"/v1/ip-studio/projects/{state['sourceProjectId']}/template-versions",{'name':'人物形象设定与资产包','summary':'主形象、三视图、两表情、两细节。先准备独立画布，逐步生成并采用。','visibility':'personal','recipe':state['recipe']});checkpoint(state)
v1=state['v1'];call('PUT',f"/v1/ip-studio/templates/{v1['templateId']}/availability",{'enabled':True});published=json.dumps(v1,ensure_ascii=False)
for private in [first['storageKey'],first['avatarId'],'must-not-publish','作者私有说明']:assert private not in published
assert len(v1['doc']['nodes'])==10
model='studio-live-agnes-image'
def use(version,asset,name):return {'name':name,'versionId':version['id'],'inputs':{'character':{'reference':reference(asset)},'style':{'text':'清爽 3D 潮玩'}},'model':model}
if 'firstInstance' not in state:
    q=call('POST','/v1/ip-studio/template-plan',use(v1,first,'小紫 · 人物资产包'))
    assert q['imageCount']==8 and q['totalCost']==64 and q['steps'][0]['status']=='ready' and all(s['status']=='waiting_adoption' for s in q['steps'][1:])
    state['firstInstance']=call('POST','/v1/ip-studio/template-instances',use(v1,first,'小紫 · 人物资产包'));checkpoint(state)
if 'secondInstance' not in state:
    state['secondInstance']=call('POST','/v1/ip-studio/template-instances',use(v1,second,'另一 IP · 人物资产包'));checkpoint(state)
one=state['firstInstance'];two=state['secondInstance'];ids1={n['id'] for n in one['project']['doc']['nodes']};ids2={n['id'] for n in two['project']['doc']['nodes']}
assert ids1.isdisjoint(ids2)
assert first['storageKey'] in json.dumps(one['project']['doc']) and second['storageKey'] not in json.dumps(one['project']['doc'])
assert second['storageKey'] in json.dumps(two['project']['doc']) and first['storageKey'] not in json.dumps(two['project']['doc'])
assert not one['project']['runs'] and not two['project']['runs']
if 'v2' not in state:
    state['v2']=call('POST',f"/v1/ip-studio/projects/{state['sourceProjectId']}/template-versions",{'templateId':v1['templateId'],'name':'人物形象设定与资产包','summary':'第二版发布，原画布仍锁定第一版。','visibility':'personal','recipe':state['recipe']});checkpoint(state)
v2=state['v2'];assert v2['version']==2
old=call('GET',f"/v1/ip-studio/projects/{one['project']['id']}/template-instance");assert old['source']['id']==v1['id']
assert old['plan']==one['plan'];assert rejected('POST','/v1/ip-studio/template-instances',use(v1,first,'过期版本'),'STUDIO_TEMPLATE_VERSION_CHANGED')
if 'latestInstance' not in state:
    state['latestInstance']=call('POST','/v1/ip-studio/template-instances',use(v2,first,'小紫 · 人物资产包 v2'));checkpoint(state)
call('PUT',f"/v1/ip-studio/templates/{v1['templateId']}/availability",{'enabled':False})
assert rejected('POST','/v1/ip-studio/template-instances',use(v2,first,'停用检查'),'STUDIO_TEMPLATE_NOT_FOUND')
assert call('GET',f"/v1/ip-studio/projects/{one['project']['id']}/template-instance")['source']['id']==v1['id']
call('PUT',f"/v1/ip-studio/templates/{v1['templateId']}/availability",{'enabled':True})
bad=use(v2,first,'外人素材');bad['inputs']['character']['reference']['storageKey']='ipstudio_source/another-user/private.png'
assert rejected('POST','/v1/ip-studio/template-plan',bad,'IP_ASSET_KEY_INVALID')
assert rejected('POST',f"/v1/ip-studio/projects/{state['sourceProjectId']}/publish-as-demo",{'demoId':v1['templateId'],'kind':'template','name':'不能覆盖'}) in ['SUPER_ADMIN_ONLY','STUDIO_TEMPLATE_VERSIONED']
after=ledger();assert before==after,'Free template acceptance changed the ledger'
report={'templateId':v1['templateId'],'versions':[v1['id'],v2['id']],'projects':[one['project']['id'],two['project']['id'],state['latestInstance']['project']['id']],'distinctAvatarIds':[first['avatarId'],second['avatarId']],'independentNodeIds':True,'noPrivateAuthorMedia':True,'oldProjectStillV1':True,'newProjectV2':True,'downlistBlockedNewUse':True,'oldPlanRestored':True,'imageCount':8,'quotedCredits':64,'newGenerationRequests':0,'ledgerUnchanged':True,'assetPackageGenerated':False}
(OUT/'report.json').write_text(json.dumps(report,ensure_ascii=False,indent=2));print(json.dumps(report,ensure_ascii=False,indent=2))
