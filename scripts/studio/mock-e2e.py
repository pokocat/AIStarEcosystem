#!/usr/bin/env python3
"""HTTP + real ffmpeg acceptance against an isolated local fixture-enabled server."""
import argparse
import json
import subprocess
import time
import urllib.error
import urllib.request
import uuid
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

parser = argparse.ArgumentParser()
parser.add_argument('--base', default='http://localhost:18080')
parser.add_argument('--out', default='.studio-e2e')
args = parser.parse_args()
assert args.base.startswith(('http://localhost:', 'http://127.0.0.1:')), 'This verifier only writes to a local test server'
out = Path(args.out)
out.mkdir(parents=True, exist_ok=True)

def call(method, path, body=None, expected=200):
    request = urllib.request.Request(args.base + '/api' + path,
        data=None if body is None else json.dumps(body).encode(), method=method,
        headers={'Content-Type': 'application/json', 'X-App-Code': 'aiavatar'})
    try:
        with urllib.request.urlopen(request, timeout=30) as response:
            status, value = response.status, json.load(response)
    except urllib.error.HTTPError as error:
        status, value = error.code, json.load(error)
    assert status == expected, (path, status, value)
    return value.get('data') if expected == 200 else value

capabilities = call('GET', '/v1/ip-studio/studio/capabilities')
assert capabilities['mock'] and capabilities['imageCost'] == capabilities['textCost'] == 0
project = call('POST', '/v1/ip-studio/projects', {'name': 'Studio HTTP 验收 ' + uuid.uuid4().hex[:6]})
project_id = project['id']
path = f'/v1/ip-studio/projects/{project_id}/studio-runs'
accepted = []

def run(operation, node_id, prompt, references=None, aspect_ratio='9:16'):
    request = {'clientRequestId': str(uuid.uuid4()), 'nodeId': node_id, 'operation': operation,
               'prompt': prompt, 'references': references or [], 'aspectRatio': aspect_ratio, 'durationSec': 8}
    first = call('POST', path, request)
    with ThreadPoolExecutor(max_workers=4) as pool:
        repeated = list(pool.map(lambda _:call('POST',path,request),range(4)))
    assert all(first['id'] == item['id'] for item in repeated), 'Concurrent retry submitted another model task'
    changed = dict(request, prompt=prompt+' changed')
    assert call('POST', path, changed, 409)['error']['code'] == 'STUDIO_REQUEST_CHANGED'
    deadline = time.monotonic()+90
    while time.monotonic() < deadline:
        result = call('GET', f"/v1/ip-studio/runs/{first['id']}")
        if result['status'] != 'running':
            assert result['status'] == 'done', result
            assert result['cost'] == 0 and result['output']['mock'], result
            accepted.append(result)
            return result
        time.sleep(.25)
    raise AssertionError('Task never reached a terminal state: '+first['id'])

image = run('image', 'master', '潮玩女孩主形象')
key = image['output']['candidates'][0]['key']
assert image['output']['candidates'][0]['url']
adopt_request = {'nodeId': 'master', 'storageKey': key, 'name': '潮玩女孩 · HTTP 验收'}
adoption = call('POST', f'/v1/ip-studio/projects/{project_id}/adopt', adopt_request)
assert call('POST', f'/v1/ip-studio/projects/{project_id}/adopt', adopt_request) == adoption
ip = call('GET', '/v1/assets/ips/'+adoption['ipId'])
assert any(a['id'] == adoption['avatarId'] for a in ip['characters']), 'Adoption did not attach the character to the IP'
reference = dict(adoption, role='character')
script = run('script', 'script', '给选中的潮玩女孩写一个三镜短片', [reference])
assert len(script['output']['script']['shots']) == 3
storyboard = run('storyboard', 'storyboard', script['output']['text'], [reference])
assert len(storyboard['output']['shots']) == 3
videos = [run('video', 'video-'+str(index), shot['description'], [{'storageKey': key, 'role': 'frame','ipId':adoption['ipId']}])
          for index, shot in enumerate(script['output']['shots'])]
result = run('assemble', 'work', '按顺序合成三镜', [{'storageKey': v['output']['storageKey'], 'role': 'clip','ipId':adoption['ipId']} for v in videos])
usages=call('GET',f"/v1/assets/usages?assetType=ip&assetId={adoption['ipId']}")
assert any(u['usedByType']=='studio-project' and u['usedById']==project_id for u in usages), 'Completed work did not flow back to source IP'
asset = urllib.request.Request(args.base+'/api/v1/ip-studio/assets/content?key='+result['output']['storageKey'], headers={'X-App-Code':'aiavatar'})
video_path = out/'assembled.mp4'
with urllib.request.urlopen(asset, timeout=30) as response:
    video_path.write_bytes(response.read())
probe=json.loads(subprocess.check_output(['ffprobe','-v','error','-show_format','-show_streams','-of','json',str(video_path)]))
duration=float(probe['format']['duration'])
assert 23.5 <= duration <= 25, duration
assert any(s.get('codec_type')=='video' for s in probe['streams'])
assert any(s.get('codec_type')=='audio' for s in probe['streams'])
# Changing the output canvas must work even when all input clips share a portrait size.
ratio_results = {}
for ratio, dimensions in [('16:9', (1280,720)), ('1:1', (720,720))]:
    converted=run('assemble','work-'+ratio.replace(':','-'),'按所选画幅合成',
                  [{'storageKey':v['output']['storageKey'],'role':'clip'} for v in videos],ratio)
    ratio_file=out/('assembled-'+ratio.replace(':','-')+'.mp4')
    request=urllib.request.Request(args.base+'/api/v1/ip-studio/assets/content?key='+converted['output']['storageKey'],headers={'X-App-Code':'aiavatar'})
    with urllib.request.urlopen(request,timeout=30) as response:
        ratio_file.write_bytes(response.read())
    actual=json.loads(subprocess.check_output(['ffprobe','-v','error','-show_format','-show_streams','-of','json',str(ratio_file)]))
    video_stream=next(s for s in actual['streams'] if s.get('codec_type')=='video')
    assert (video_stream['width'],video_stream['height'])==dimensions,actual
    assert video_stream['codec_name']=='h264' and any(s.get('codec_type')=='audio' for s in actual['streams'])
    assert 23.5<=float(actual['format']['duration'])<=25,actual
    ratio_results[ratio]={'width':video_stream['width'],'height':video_stream['height'],'durationSec':float(actual['format']['duration']),'hasAudio':True}
# Persist and reload the same task/asset references. URLs must be derived on read.
doc={'nodes':[{'id':'master','type':'image','title':'主形象','position':{'x':100,'y':120},'width':300,'height':400,
               'metadata':{'storageKey':key,'content':'https://expired.invalid/image','studio':{'kind':'ip','adoption':adoption}}}],
     'connections':[],'viewport':{'x':0,'y':0,'k':1}}
saved=call('PUT',f'/v1/ip-studio/projects/{project_id}',{'doc':doc,'baseDocVersion':project['docVersion']})
reloaded=call('GET',f'/v1/ip-studio/projects/{project_id}')
assert reloaded['doc']['nodes'][0]['metadata']['storageKey']==key
assert 'expired.invalid' not in reloaded['doc']['nodes'][0]['metadata']['content']
assert reloaded['doc']['nodes'][0]['metadata']['studio']['adoption']==adoption
assert call('GET',f"/v1/ip-studio/runs/{result['id']}")['output']['storageKey']==result['output']['storageKey']
bad_reference={'clientRequestId':str(uuid.uuid4()),'nodeId':'bad','operation':'image','prompt':'test',
               'references':[{'storageKey':'ipstudio_gen/another-user/not-owned.jpg','role':'character'}]}
assert call('POST',path,bad_reference,400)['error']['code']
# Updating a main image preserves explicit old version references and independent looks.
image2=run('image','master2','潮玩女孩新造型')
key2=image2['output']['candidates'][0]['key']
main_request=dict(adopt_request,nodeId='master2',storageKey=key2,ipId=adoption['ipId'],avatarId=adoption['avatarId'],intent='main')
updated=call('POST',f'/v1/ip-studio/projects/{project_id}/adopt',main_request)
assert updated['version']==adoption['version']+1
assert call('POST',f'/v1/ip-studio/projects/{project_id}/adopt',main_request)==updated
look=call('POST',f'/v1/ip-studio/projects/{project_id}/adopt',dict(main_request,nodeId='look',intent='look'))
assert look['lookId'] and look['version']==updated['version']
assets=call('GET','/v1/ip-studio/studio/ip-assets')
assert any(a['avatarId']==adoption['avatarId'] and a['storageKey']==key and a['version']==adoption['version'] for a in assets)
assert any(a.get('lookId')==look['lookId'] for a in assets)
second=call('POST','/v1/ip-studio/projects',{'name':'同一 IP 第二个作品'})
reuse={'clientRequestId':str(uuid.uuid4()),'nodeId':'reuse','operation':'script','prompt':'使用旧版本人物创作第二个作品','references':[reference]}
reuse_run=call('POST',f"/v1/ip-studio/projects/{second['id']}/studio-runs",reuse)
assert reuse_run['inputs']['references'][0]['storageKey']==key
assert reuse_run['inputs']['references'][0]['version']==adoption['version']
wrong=dict(reuse,clientRequestId=str(uuid.uuid4()),references=[dict(reference,storageKey=key2)])
assert call('POST',f"/v1/ip-studio/projects/{second['id']}/studio-runs",wrong,400)['error']['code']=='STUDIO_IP_VERSION_MISMATCH'
look_request=dict(reuse,clientRequestId=str(uuid.uuid4()),references=[dict(look,role='character')])
assert call('POST',f"/v1/ip-studio/projects/{second['id']}/studio-runs",look_request)['id']
assert call('POST',f'/v1/ip-studio/projects/{project_id}/generate',{'nodeId':'guard','prompt':'test'},503)['error']['code']=='STUDIO_FIXTURE_NATIVE_DISABLED'
# Legacy canvas publication is still readable and can attach its original character to an IP.
legacy=call('POST','/v1/ip-studio/projects',{'name':'旧发布路径兼容验收'})
legacy_doc={'nodes':[{'id':'legacy-master','type':'image','title':'旧主形象','position':{'x':100,'y':100},'width':300,'height':400,'metadata':{'storageKey':key,'prompt':'旧人物设定'}}],'connections':[],'viewport':{'x':0,'y':0,'k':1}}
call('PUT',f"/v1/ip-studio/projects/{legacy['id']}",{'doc':legacy_doc,'baseDocVersion':legacy['docVersion']})
published=call('POST',f"/v1/ip-studio/projects/{legacy['id']}/publish",{'masterNodeId':'legacy-master','lookNodeIds':[],'avatarName':'旧发布人物'})
unlinked=next(a for a in call('GET','/v1/ip-studio/studio/ip-assets') if a['avatarId']==published['avatarId'])
assert not unlinked.get('ipId')
attached=call('POST',f"/v1/ip-studio/projects/{legacy['id']}/adopt",{'nodeId':'legacy-master','storageKey':key,'avatarId':published['avatarId'],'name':'旧人物加入 IP'})
assert attached['avatarId']==published['avatarId'] and attached['ipId']
assert call('GET',f"/v1/ip-studio/projects/{legacy['id']}")['publishedAvatarId']==published['avatarId']
report={'projectId':project_id,'ipId':adoption['ipId'],'avatarId':adoption['avatarId'],
        'operations':[r['kind'] for r in accepted], 'runIds':[r['id'] for r in accepted],
        'durationSec':duration,'videoCodec':next(s['codec_name'] for s in probe['streams'] if s['codec_type']=='video'),
        'secondProjectId':second['id'],'checks':['concurrent idempotent submit','changed request rejected','IP adoption and membership','script and storyboard',
                  'real assembly','audio and video streams','save/reload','derived URLs','foreign asset rejected','IP work return','main update idempotency','old version reuse','version mismatch rejected','look reuse','native fixture guard'],
        'legacyProjectId':legacy['id'],'legacyAvatarId':published['avatarId'],
        'fixtureMode':True,'totalCost':sum(r['cost'] for r in accepted),'outputRatios':ratio_results}
report['checks'].append('legacy publication attaches original character')
report['checks'].append('uniform portrait inputs honor selected landscape and square output')
(out/'http-e2e-report.json').write_text(json.dumps(report,ensure_ascii=False,indent=2))
print(json.dumps(report,ensure_ascii=False,indent=2))
