#!/usr/bin/env python3
"""Optional multi-asset recipe acceptance: 8 initial images + 6 explicit repairs, max 112 credits; recover original requests. Not the default one-shot sheet workflow."""
import argparse,json,urllib.request,urllib.error,time,uuid,hashlib,shutil
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2];OUT=ROOT/'.studio-e2e/templates/execution';OUT.mkdir(parents=True,exist_ok=True)
BASE='http://localhost:18080/api';PROJECT='IPP-2b8eaa1c';PREFIX=f'/v1/ip-studio/projects/{PROJECT}'
def call(method,path,body=None):
 req=urllib.request.Request(BASE+path,data=json.dumps(body,ensure_ascii=False).encode() if body is not None else None,method=method,headers={'X-App-Code':'aiavatar','Content-Type':'application/json'})
 with urllib.request.urlopen(req,timeout=60) as r:return json.load(r).get('data')
def ledger():
 rows=[]
 for page in range(50):
  part=call('GET',f'/me/ledger?size=100&page={page}');rows+=part
  if len(part)<100:return rows
 raise AssertionError('too many ledger rows')
def save(): (OUT/'checkpoint.json').write_text(json.dumps(state,ensure_ascii=False,indent=2))
def rejected(path,body,code):
 try:call('POST',path,body)
 except urllib.error.HTTPError as e:
  result=json.load(e);assert result['error']['code']==code,result;return
 raise AssertionError('must reject before hold')
parser=argparse.ArgumentParser();parser.add_argument('--stage',choices=['main','assets','repair','package','audit'],required=True);args=parser.parse_args()
state=json.loads((OUT/'checkpoint.json').read_text()) if (OUT/'checkpoint.json').exists() else {'projectId':PROJECT,'requests':{}}
if 'ledgerBefore' not in state:state['ledgerBefore']=ledger();save()
plan=call('GET',PREFIX+'/template-execution');assert len(plan['steps'])==8
if args.stage=='main' and not state['requests']:
 rejected(PREFIX+'/template-steps/front/runs',{'clientRequestId':'before-main-'+uuid.uuid4().hex[:12],'maxCost':8},'STUDIO_TEMPLATE_DEPENDENCY_REQUIRED')
 rejected(PREFIX+'/template-steps/main/runs',{'clientRequestId':'price-check-'+uuid.uuid4().hex[:12],'maxCost':7},'STUDIO_PRICE_CHANGED')
 assert ledger()==state['ledgerBefore']
ids=['main'] if args.stage=='main' else [s['id'] for s in plan['steps'] if s['id']!='main'] if args.stage=='assets' else []
if args.stage=='assets': assert plan['steps'][0]['accepted'],'Main must be visually reviewed and explicitly accepted before other images'
for id in ids:
 step=next(s for s in call('GET',PREFIX+'/template-execution')['steps'] if s['id']==id)
 if id not in state['requests']:
  assert step['cost']==8 and not step.get('run'),step
  state['requests'][id]={'clientRequestId':'template-e2e-'+uuid.uuid4().hex[:24],'maxCost':8};save()
 body=state['requests'][id]
 # A re-run of this script uses the same accepted request, never a new retry key.
 run=call('POST',PREFIX+'/template-steps/'+id+'/runs',body);state.setdefault('runIds',{})[id]=run['id'];save()
 print(json.dumps({'step':id,'runId':run['id'],'status':run['status']},ensure_ascii=False),flush=True)
 deadline=time.time()+1200
 while run['status']=='running':
  if time.time()>deadline:raise RuntimeError('Original request still running; retain checkpoint and query only')
  time.sleep(8);run=call('GET','/v1/ip-studio/runs/'+run['id'])
 assert run['status']=='done',run
 key=run['output']['candidates'][0]['key'];source=ROOT/'.studio-e2e/storage'/key;dest=OUT/(id+source.suffix);shutil.copyfile(source,dest)
 state.setdefault('outputs',{})[id]={'runId':run['id'],'storageKey':key,'file':str(dest),'sha256':hashlib.sha256(dest.read_bytes()).hexdigest(),'cost':run['cost']};save()
 print(json.dumps({'step':id,'done':True,'cost':run['cost'],'file':str(dest)},ensure_ascii=False),flush=True)
if args.stage=='main':
 rejected(PREFIX+'/template-steps/front/runs',{'clientRequestId':'before-adoption-'+uuid.uuid4().hex[:12],'maxCost':8},'STUDIO_TEMPLATE_ADOPTION_REQUIRED')
 print('Main ready for visual review; downstream rejected until acceptance.',flush=True)
if args.stage=='repair':
 prompts={
 'side': 'One 3D toy character in an exact 90-degree LEFT PROFILE orthographic full-body view. Camera looks straight at the left side: only the left eye and side of the nose are visible, shoulders aligned, no three-quarter angle. Same lavender bob hair, lavender glasses, freckles, white hoodie and lavender shoes as the reference. Plain light-gray background, absolutely no text, letters, numbers, signatures, logos, or watermark.',
 'back': 'One 3D toy character in a strict 180-degree REAR full-body orthographic view. The camera sees the back of the lavender bob hair, white hoodie and lavender shoes. Both feet visible. Plain light-gray studio background. ABSOLUTELY NO writing anywhere, no text, letters, logo, watermark or signature, including the top corners. Preserve the exact reference outfit.',
 'happy': 'CLOSE-UP HEAD PORTRAIT of this exact lavender-haired toy character, joyful open-mouth smile. Frame from the top of the hair to the upper shoulders only. Face and hair fill 85 percent of the square frame. Preserve lavender glasses, freckles, toy material and hairstyle. No torso, legs or shoes in the frame. Plain gray background. No text, logos, signatures or watermark.',
 'curious': 'CLOSE-UP HEAD PORTRAIT of this exact lavender-haired toy character, visibly curious expression: raised eyebrows and a small questioning mouth. Frame from top of hair to upper shoulders only. Head fills 85 percent of the square frame. Preserve lavender glasses, freckles, bob hairstyle and toy material. No torso, legs or shoes. Plain gray background. No text, logos or watermark.',
 'face': 'EXTREME CLOSE-UP detail study of the reference character face and lavender bob hairstyle. Crop from top of hair to just below chin. Head fills almost the entire square image. Show lavender glasses frames, eyes, freckles, nose, subtle smile and hair strands clearly. This is a face detail asset, not a whole-body portrait. No body, arms, legs or shoes. No text, logo, watermark or signature.',
 'outfit': 'CLOSE-UP CLOTHING DETAIL of the exact WHITE HOODIE from the reference. Frame from base of neck to the hoodie hem: show hood opening, white drawstrings, cuffs, seams and front pouch pocket. The hoodie fills the image. Do not include the head, face, legs or shoes; they are outside this intentional garment detail crop. Same toy fabric material and white color. Gray studio background, no props or text, no logo, watermark or signature.'
 }
 state.setdefault('repairRequests',{})
 for id,prompt in prompts.items():
  current=next(s for s in call('GET',PREFIX+'/template-execution')['steps'] if s['id']==id)
  if id not in state['repairRequests']:
   assert current['run']['status']=='done' and current['cost']==8
   state['repairRequests'][id]={'clientRequestId':'template-repair-'+uuid.uuid4().hex[:24],'maxCost':8,'replaceRunId':current['run']['id'],'prompt':prompt};save()
  req=state['repairRequests'][id];run=call('POST',PREFIX+'/template-steps/'+id+'/runs',req);state.setdefault('repairRunIds',{})[id]=run['id'];save();print(json.dumps({'repair':id,'runId':run['id']},ensure_ascii=False),flush=True)
  deadline=time.time()+1200
  while run['status']=='running':
   if time.time()>deadline:raise RuntimeError('Retain original repair request; query only')
   time.sleep(8);run=call('GET','/v1/ip-studio/runs/'+run['id'])
  assert run['status']=='done',run
  key=run['output']['candidates'][0]['key'];source=ROOT/'.studio-e2e/storage'/key;dest=OUT/(id+'-repair'+source.suffix);shutil.copyfile(source,dest)
  state.setdefault('repairOutputs',{})[id]={'runId':run['id'],'storageKey':key,'file':str(dest),'sha256':hashlib.sha256(dest.read_bytes()).hexdigest(),'cost':run['cost']};save();print(json.dumps({'repair':id,'done':True,'file':str(dest)},ensure_ascii=False),flush=True)
if args.stage=='package':
 current=call('GET',PREFIX+'/template-execution');selected=[s for s in current['steps'] if s['accepted'] and s['status']=='done'];assert selected
 package=call('POST',PREFIX+'/template-packages',{'title':'小紫 · 人物形象资产包','description':'紫色头发、紫色眼镜、白色连帽衫与紫色鞋。通过检查的主形象、正面、背面、两组表情与服装细节。侧面角度和面部风格仍未通过，未收入本包。','stepIds':[s['id'] for s in selected]})
 assert package['imageCount']==len(selected) and package['complete']==(len(selected)==len(current['steps']))
 state['package']=package;save()
 for field,name in [('boardKey','asset-board.png'),('bundleKey','asset-package.zip')]:shutil.copyfile(ROOT/'.studio-e2e/storage'/package[field],OUT/name)
 print(json.dumps(package,ensure_ascii=False,indent=2),flush=True)
if args.stage=='audit':
 before=ledger()
 for id,body in state.get('repairRequests',{}).items():assert call('POST',PREFIX+'/template-steps/'+id+'/runs',body)['id']==state['repairRunIds'][id]
 for id,body in state['requests'].items():assert call('POST',PREFIX+'/template-steps/'+id+'/runs',body)['id']==state['runIds'][id]
 assert before==ledger(),'replay changed ledger'
 after=ledger();prior={r['id'] for r in state['ledgerBefore']};delta=[r for r in after if r['id'] not in prior];spends=[r for r in delta if r.get('type')=='spend']
 # Inspect actual ledger semantics rather than inferring from HTTP success.
 actual=sum(s['cost'] for s in state['outputs'].values())+sum(s['cost'] for s in state.get('repairOutputs',{}).values());assert actual<=112 and len(state['outputs'])<=8 and len(state.get('repairOutputs',{}))<=6
 assert len(spends)==len(state['requests'])+len(state.get('repairRequests',{})) and -sum(r['amount'] for r in spends)==actual
 assert {r['referenceId'] for r in spends}==set(state['runIds'].values())|set(state.get('repairRunIds',{}).values())
 report={'projectId':PROJECT,'sourceVersion':plan['version'],'outputs':state.get('outputs',{}),'repairOutputs':state.get('repairOutputs',{}),'newLedgerEntries':delta,'totalRunCost':actual,'replayedRequests':len(state['requests'])+len(state.get('repairRequests',{})),'replayLedgerUnchanged':True,'package':state.get('package')}
 (OUT/'report.json').write_text(json.dumps(report,ensure_ascii=False,indent=2));print(json.dumps({'cost':actual,'requests':len(state['requests'])+len(state.get('repairRequests',{})),'replayLedgerUnchanged':True},ensure_ascii=False),flush=True)
