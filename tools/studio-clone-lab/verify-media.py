from pathlib import Path
import subprocess,json,hashlib
r=Path('/Users/donis/BuildBox/artifacts/studio-clone-lab-20261108');records=[]
files=sorted((r/'generation').glob('*/vendor.mp4'))+[r/'results'/x for x in ['9861-final.mp4','9862-final.mp4','9862-wan-final.mp4','9861-layer-final.mp4']]
for f in files:
 meta=json.loads(subprocess.run(['ffprobe','-v','error','-show_format','-show_streams','-of','json',str(f)],check=True,capture_output=True,text=True).stdout)
 check=subprocess.run(['ffmpeg','-nostdin','-v','error','-threads','1','-i',str(f),'-map','0:v:0','-f','null','-'],capture_output=True,text=True)
 if check.returncode or check.stderr.strip():raise RuntimeError(str(f)+' decode errors: '+check.stderr)
 v=next(s for s in meta['streams'] if s['codec_type']=='video')
 if f.name in ['9861-layer-final.mp4','9862-wan-final.mp4']:
  expected=14.966667 if f.name.startswith('9861') else 10.516667
  if abs(float(v.get('duration',meta['format']['duration']))-expected)>0.035:raise RuntimeError('Final video duration mismatch '+str(f))
  if (v['width'],v['height'])!=(720,1280):raise RuntimeError('Final canvas mismatch')
 records.append({'file':str(f.relative_to(r)),'sha256':hashlib.sha256(f.read_bytes()).hexdigest(),'duration':float(meta['format']['duration']),'width':v['width'],'height':v['height'],'fps':v['avg_frame_rate'],'frames':v.get('nb_frames'),'audioStreams':len([s for s in meta['streams'] if s['codec_type']=='audio']),'decode':'passed'})
(r/'results/media-verification.json').write_text(json.dumps(records,indent=2)+'\n');print(json.dumps({'videosDecoded':len(records),'decode':'passed','verificationFile':'results/media-verification.json'}))
b=json.loads((r/'budget-additional.json').read_text())
for task,entry in b['reservations'].items():
 spec=next(json.loads(p.read_text()) for p in (r/'specs').glob('9861-wan-motion-look*.json') if json.loads(p.read_text())['id']==task)
 status=json.loads((Path(spec['folder'])/'status.json').read_text())
 if status['status']!='succeeded':raise RuntimeError('Unfinished accepted task '+task)
 seconds=status['usage']['billableSeconds'];cost=seconds*40
 created=json.loads((Path(spec['folder'])/'create.json').read_text())
 entry.update({'state':'succeeded','jobId':created.get('jobId',created.get('id')),'confirmedBillableSeconds':seconds,'quotedCreditsPerSecond':40,'rateBasedCostCredits':cost,'walletDebitVerified':False})
 entry['credits']=max(entry['credits'],cost)
b['remainingUnreservedCredits']=b['authorizedAdditionalCredits']-sum(x['credits'] for x in b['reservations'].values())
b['rateBasedTotalCostCredits']=sum(x['rateBasedCostCredits'] for x in b['reservations'].values())
if b['remainingUnreservedCredits']<0:raise RuntimeError('Additional supplier-credit allowance exceeded')
(r/'budget-additional.json').write_text(json.dumps(b,indent=2)+'\n')
print(json.dumps({'additionalEstimatedCredits':b['rateBasedTotalCostCredits'],'remainingAdditionalBudget':b['remainingUnreservedCredits']}))
