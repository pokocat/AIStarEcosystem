#!/usr/bin/env python3
"""One-shot sheet -> sheet-referenced frame -> i2v, bounded 8+8+30 credits.

Checkpoints precede submission. Functional acceptance checks usable media and explicit
asset selection; aesthetics are optional. Terminal failures are never auto-retried.
Only the isolated local host is used.
"""
import argparse,hashlib,json,shutil,time,urllib.request,uuid
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2];OUT=ROOT/'.studio-e2e/templates/one-shot/real';OUT.mkdir(parents=True,exist_ok=True)
BASE='http://localhost:18080/api';PROJECT='IPP-9e4d7c28';PREFIX=f'/v1/ip-studio/projects/{PROJECT}'
parser=argparse.ArgumentParser();parser.add_argument('--project-id',default=PROJECT);parser.add_argument('--output-dir');parser.add_argument('--stage',choices=['sheet','frame','video','assemble','audit'],required=True);args=parser.parse_args()
PROJECT=args.project_id;PREFIX=f'/v1/ip-studio/projects/{PROJECT}'
if args.output_dir:OUT=ROOT/args.output_dir;OUT.mkdir(parents=True,exist_ok=True)
def call(method,path,body=None):
    req=urllib.request.Request(BASE+path,data=json.dumps(body,ensure_ascii=False).encode() if body is not None else None,method=method,headers={'X-App-Code':'aiavatar','Content-Type':'application/json'})
    with urllib.request.urlopen(req,timeout=65) as response:return json.load(response)['data']
def ledger():
    rows=[]
    for page in range(50):
        part=call('GET',f'/me/ledger?size=100&page={page}');rows+=part
        if len(part)<100:return rows
    raise AssertionError('Ledger audit limit exceeded')
file=OUT/'checkpoint.json';state=json.loads(file.read_text()) if file.exists() else {'projectId':PROJECT,'requests':{},'runIds':{},'results':{}}
def save():file.write_text(json.dumps(state,ensure_ascii=False,indent=2))
assert not call('GET','/v1/ip-studio/studio/capabilities')['mock']
if 'ledgerBefore' not in state:state['ledgerBefore']=ledger();save()
def run(name,route,request):
    if name not in state['requests']:state['requests'][name]={'route':route,'body':request};save()
    saved=state['requests'][name]
    if name in state['runIds']:result=call('GET','/v1/ip-studio/runs/'+state['runIds'][name])
    else:
        result=call('POST',saved['route'],saved['body']);state['runIds'][name]=result['id'];save()
    print(json.dumps({'stage':name,'runId':result['id'],'status':result['status'],'cost':result['cost']},ensure_ascii=False),flush=True)
    deadline=time.monotonic()+1500
    while result['status']=='running':
        if time.monotonic()>deadline:raise RuntimeError('Original run is still active; query the saved id, never submit a fresh key')
        time.sleep(8);result=call('GET','/v1/ip-studio/runs/'+result['id'])
    state['results'][name]=result;save();assert result['status']=='done',result.get('errorCode')
    assert not result['output'].get('mock',False)
    key=result['output']['candidates'][0]['key'] if name in ['sheet','frame'] else result['output']['storageKey']
    source=ROOT/'.studio-e2e/storage'/key;dest=OUT/(name+source.suffix);shutil.copyfile(source,dest)
    state.setdefault('media',{})[name]={'storageKey':key,'file':str(dest),'sha256':hashlib.sha256(dest.read_bytes()).hexdigest()};save()
    print(json.dumps({'stage':name,'done':True,'cost':result['cost'],'file':str(dest)},ensure_ascii=False),flush=True)
    return result
execution=call('GET',PREFIX+'/template-execution');assert len(execution['steps'])==1 and execution['steps'][0]['outputRole']=='sheet'
sheet=execution['steps'][0]
if args.stage=='sheet':
    if sheet.get('run') and 'sheet' not in state['requests']:raise RuntimeError('Another sheet run is already accepted; inspect that original run before proceeding')
    run('sheet',PREFIX+'/template-steps/sheet/runs',{'clientRequestId':'sheet-e2e-'+uuid.uuid4().hex[:24],'maxCost':8})
if args.stage=='frame':
    assert sheet['accepted'] and sheet['status']=='done' and sheet.get('adoption'),'Explicitly accept/archive the sheet in the browser first'
    reference={**sheet['adoption'],'role':'character'}
    state['sheetAdoption']=sheet['adoption'];save()
    run('frame',PREFIX+'/studio-runs',{'clientRequestId':'sheet-frame-'+uuid.uuid4().hex[:24],'nodeId':'sheet-frame','operation':'image','model':'studio-live-agnes-image','size':'768x1365','count':1,'maxCost':8,'references':[reference],'prompt':'以整张人物设定图为角色参考，只生成一张单独的竖屏镜头画面。保持同一个3D潮玩少女的浅紫齐肩短发、黑色椭圆玩偶眼睛、小圆脸、白色连帽卫衣、淡紫运动鞋和玩偶材质。黄昏的公园步道，柔和自然光，背景是虚化的绿色树木。人物正面站在画面中央，头到膝盖的中景，微笑看向镜头，一只手抬到肩膀旁准备打招呼。画面只出现一个角色。不要设定图的拼版、分区、多视角陈列、说明文字、边框、配色色块或水印。'})
if args.stage=='video':
    assert state.get('functionalAcceptance',{}).get('frame',False) or state.get('reviews',{}).get('frame',{}).get('accepted'),'Confirm that the actual frame loads and is selected before i2v'
    run('video',PREFIX+'/studio-runs',{'clientRequestId':'sheet-video-'+uuid.uuid4().hex[:24],'nodeId':'sheet-video','operation':'video','model':'studio-live-agnes-video','durationSec':5,'aspectRatio':'9:16','maxCost':30,'references':[{'storageKey':state['media']['frame']['storageKey'],'role':'frame','ipId':state['sheetAdoption']['ipId']}],'prompt':'固定镜头，保持首帧中的同一个3D潮玩少女、浅紫短发和白色卫衣。她看向镜头，微笑，轻轻挥动抬起的手打招呼，动作自然小幅连贯。黄昏公园的背景保持稳定，只有一个人物，没有镜头切换、没有拼版、没有文字或水印。'})
if args.stage=='assemble':
    assert state.get('functionalAcceptance',{}).get('video',False) or state.get('reviews',{}).get('video',{}).get('accepted'),'Confirm that the actual video plays and is selected before assembly'
    run('work',PREFIX+'/studio-runs',{'clientRequestId':'sheet-work-'+uuid.uuid4().hex[:24],'nodeId':'sheet-work','operation':'assemble','aspectRatio':'9:16','maxCost':0,'references':[{'storageKey':state['media']['video']['storageKey'],'role':'clip','ipId':state['sheetAdoption']['ipId']}],'prompt':'保持完整片段，竖屏归一合成，保留视频原音轨。'})
if args.stage=='audit':
    before=ledger()
    for name,saved in state['requests'].items():assert call('POST',saved['route'],saved['body'])['id']==state['runIds'][name]
    assert before==ledger(),'Replay changed the ledger'
    old={row['id'] for row in state['ledgerBefore']};delta=[row for row in before if row['id'] not in old];spends=[row for row in delta if row['type']=='spend'];cost=sum(r['cost'] for r in state['results'].values());assert cost<=46 and -sum(r['amount'] for r in spends)==cost
    metrics=call('GET','/v1/ip-studio/template-versions/'+execution['versionId']+'/metrics')
    report={'projectId':PROJECT,'templateVersionId':execution['versionId'],'oneShotSheetTaskCount':1,'requests':state['requests'],'runIds':state['runIds'],'media':state.get('media',{}),'reviews':state.get('reviews',{}),'functionalAcceptance':state.get('functionalAcceptance',{}),'newLedgerEntries':delta,'totalCost':cost,'replayLedgerUnchanged':True,'templateMetrics':metrics}
    (OUT/'report.json').write_text(json.dumps(report,ensure_ascii=False,indent=2));print(json.dumps({'cost':cost,'requests':len(state['requests']),'replayLedgerUnchanged':True},ensure_ascii=False),flush=True)
