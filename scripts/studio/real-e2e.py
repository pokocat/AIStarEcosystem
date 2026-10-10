#!/usr/bin/env python3
"""Resumable real-provider acceptance against an isolated local Studio backend.

No credentials are accepted or printed. Model endpoints must already be configured
through the local admin API. A checkpoint preserves request IDs across interruptions.
"""
import argparse
import copy
import json
import time
import urllib.error
import urllib.request
import uuid
from pathlib import Path

parser=argparse.ArgumentParser()
parser.add_argument('--base',default='http://localhost:18080')
parser.add_argument('--stage',choices=['image','script','storyboard','video','assemble','geometry'],default='script')
parser.add_argument('--out',default='.studio-e2e/real')
parser.add_argument('--retry-failed',action='store_true',help='Start a new request only for a confirmed failed run, preserving its history')
args=parser.parse_args()
assert args.base.startswith(('http://localhost:','http://127.0.0.1:')), 'Only an isolated local backend is supported'
out=Path(args.out);out.mkdir(parents=True,exist_ok=True)
checkpoint=out/'checkpoint.json'
state=json.loads(checkpoint.read_text()) if checkpoint.exists() else {'requests':{},'results':{}}
if args.retry_failed:
    for name,result in list(state['results'].items()):
        if result['status']=='failed':
            state.setdefault('failedHistory',[]).append(result)
            del state['results'][name]
            state['requests'].pop(name,None)
def save():checkpoint.write_text(json.dumps(state,ensure_ascii=False,indent=2))
def call(method,path,body=None,expected=200):
    request=urllib.request.Request(args.base+'/api'+path,data=None if body is None else json.dumps(body).encode(),
                                  method=method,headers={'Content-Type':'application/json','X-App-Code':'aiavatar'})
    try:
        with urllib.request.urlopen(request,timeout=60) as response:status,value=response.status,json.load(response)
    except urllib.error.HTTPError as error:status,value=error.code,json.load(error)
    if status!=expected:raise RuntimeError((path,status,value.get('error',{})))
    return value.get('data')
cap=call('GET','/v1/ip-studio/studio/capabilities')
assert not cap['mock'], 'Fixture mode is still enabled'
state['capabilities']=cap
if 'projectId' not in state:
    state['projectId']=call('POST','/v1/ip-studio/projects',{'name':'Agnes · Studio 真实验收'})['id'];save()
project=state['projectId']
def run(name,operation,prompt,refs=None,**options):
    if name in state['results']:return state['results'][name]
    request=state['requests'].get(name)
    if request is None:
        request={'clientRequestId':str(uuid.uuid4()),'nodeId':'live-'+name,'operation':operation,'prompt':prompt,
                 'references':refs or [],'aspectRatio':'9:16',**options}
        state['requests'][name]=request;save()
    accepted=call('POST',f'/v1/ip-studio/projects/{project}/studio-runs',request)
    state.setdefault('runIds',{})[name]=accepted['id'];save()
    repeated=call('POST',f'/v1/ip-studio/projects/{project}/studio-runs',request)
    assert accepted['id']==repeated['id'], 'Retry created another paid run'
    print(json.dumps({'stage':name,'runId':accepted['id'],'status':accepted['status'],'quotedCost':accepted['cost']},ensure_ascii=False),flush=True)
    deadline=time.monotonic()+1900
    previous=None
    while time.monotonic()<deadline:
        result=call('GET',f"/v1/ip-studio/runs/{accepted['id']}")
        progress=(result['status'],result.get('stage'),result['pct'])
        if progress!=previous:
            print(json.dumps({'stage':name,'status':progress[0],'step':progress[1],'pct':progress[2]},ensure_ascii=False),flush=True);previous=progress
        if result['status']!='running':
            state['results'][name]=result;save()
            assert result['status']=='done', (name,result.get('errorCode'),result.get('errorMessage'))
            assert not result['output'].get('mock',False)
            return result
        time.sleep(3)
    raise RuntimeError('Original run remains pending; resume with the same checkpoint, do not submit another task')

image=run('master','image','原创中国3D潮玩少女，小圆脸，浅紫色齐肩短发，白色连帽卫衣，淡紫运动鞋，完整全身，纯白背景，柔和摄影棚光。只出现一个人物，不要文字。',
          model='studio-live-agnes-image',count=1,size='768x1365')
key=image['output']['candidates'][0]['key']
if 'adoption' not in state:
    state['adoption']=call('POST',f'/v1/ip-studio/projects/{project}/adopt',{'nodeId':'live-master','storageKey':key,'name':'小紫 · Agnes 验收','description':'原创3D潮玩少女，浅紫短发和白色卫衣。'});save()
ref=dict(state['adoption'],role='character')
if args.stage!='image':
    script=run('script','script','用选定的小紫制作一条15秒城市灵感短片，恰好3个镜头，每镜5秒。保持浅紫短发、白色卫衣同一人物。大纲和正文完整，镜头有明确动作，只用一个人物。',[ref])
    if args.stage in ['storyboard','video','assemble']:
        edited=copy.deepcopy(script['output']['script'])
        edited['episodes'][0]['content']+='\n最后一镜，小紫面向镜头挥手微笑。'
        edited.pop('shots',None)
        board=run('storyboard','storyboard','按当前已编辑正文拆成恰好3镜，每镜5秒：\n'+json.dumps(edited,ensure_ascii=False),[ref])
        if args.stage in ['video','assemble']:
            clips=[]
            for index,shot in enumerate(board['output']['shots'][:3]):
                frame=run('frame'+str(index),'image',shot['description']+'。严格保持参考小紫的脸、浅紫短发、白色卫衣。',[ref],model='studio-live-agnes-image',count=1,size='768x1365')
                video=run('video'+str(index),'video',shot['description']+'。自然连贯的轻微动作，固定镜头，保持同一人物。',
                          [{'storageKey':frame['output']['candidates'][0]['key'],'role':'frame','ipId':ref['ipId']}],
                          model='studio-live-agnes-video',durationSec=5)
                clips.append({'storageKey':video['output']['storageKey'],'role':'clip','ipId':ref['ipId']})
            if args.stage=='assemble':run('work','assemble','按三镜顺序合成，保留片段音轨。',clips)
if args.stage=='geometry':
    run('geometry','video','小紫面向镜头轻轻挥手，白色卫衣和浅紫短发保持不变。固定镜头，自然的轻微动作。',
        [{'storageKey':state['results']['frame2']['output']['candidates'][0]['key'],'role':'frame','ipId':ref['ipId']}],
        model='studio-live-agnes-video',durationSec=5)
print(json.dumps({'projectId':project,'completedStages':list(state['results']),'totalRecordedCost':sum(r['cost'] for r in state['results'].values())},ensure_ascii=False),flush=True)
