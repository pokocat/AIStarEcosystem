from pathlib import Path
import subprocess,json,time
r=Path('/Users/donis/BuildBox/artifacts/studio-clone-lab-20261108');node='/Users/donis/BuildBox/tools/node/bin/node';last={}
def call(args):return subprocess.run([node,'scripts/provider.mjs']+args,cwd=r,capture_output=True,text=True)
for cycle in range(50):
 active=0
 for look in [3,4,5,6]:
  folder=r/f'generation/9861-wan-motion-look{look}-v1'
  if not (folder/'create.json').exists():continue
  if (folder/'vendor.mp4').exists():continue
  p=call(['video-poll',str(folder)])
  if p.returncode:
   (folder/'poll-error.txt').write_text(p.stderr);print(json.dumps({'look':look,'poll':'temporary error; existing task retained'}),flush=True);active+=1;continue
  s=json.loads((folder/'status.json').read_text());state=s.get('status');stage=s.get('stage')
  if state in ['failed','canceled','cancelled']:raise RuntimeError(f'Accepted look {look} ended {state}; no paid retry')
  if state!='succeeded':active+=1
  if last.get(look)!=(state,stage):print(json.dumps({'look':look,'status':state,'stage':stage,'elapsedSeconds':s.get('elapsedSeconds')}),flush=True);last[look]=(state,stage)
 if all((r/f'generation/9861-wan-motion-look{look}-v1/vendor.mp4').exists() for look in [3,4,5,6]):print('BATCH_COMPLETE_ALL_DOWNLOADED',flush=True);break
 for look in [5,6]:
  folder=r/f'generation/9861-wan-motion-look{look}-v1'
  if active>=2:break
  if (folder/'create.json').exists():continue
  p=call(['video-submit',f'specs/9861-wan-motion-look{look}.json'])
  if p.returncode:
   folder.mkdir(exist_ok=True,parents=True);(folder/'submit-error.txt').write_text(p.stderr);print(json.dumps({'look':look,'submit':'capacity rejection; same frozen idempotency key retained'}),flush=True);break
  c=json.loads((folder/'create.json').read_text());print(json.dumps({'look':look,'accepted':c.get('jobId',c.get('id'))}),flush=True);active+=1
 time.sleep(30)
else:raise TimeoutError('Accepted jobs retained; batch needs continued polling, not resubmission')
