from pathlib import Path
import subprocess,json
r=Path('/Users/donis/BuildBox/artifacts/studio-clone-lab-20261108')
for look,start,end,cost in [(3,7.4,10.4,120),(4,9.1,12.4,160),(5,11.1,14.3,160),(6,12.966667,14.966667,80)]:
 dest=r/f'prepared/wan/9861-look{look}-source.mp4'
 subprocess.run(['ffmpeg','-nostdin','-v','error','-y','-i',str(r/'prepared/9861-body.mp4'),'-vf',f'fps=30,trim=start={start}:end={end},setpts=PTS-STARTPTS','-an','-c:v','libx264','-threads','2','-preset','fast','-crf','18','-pix_fmt','yuv420p','-movflags','+faststart',str(dest)],check=True)
 s={'id':f'clone-lab-9861-wan-motion-look{look}-v1','folder':str(r/f'generation/9861-wan-motion-look{look}-v1'),'model':'wan2-2-animate-14b','characterMode':'motion_transfer','estimatedSupplierCredits':cost,'seed':477533541,'references':[{'type':'image','path':str(r/f'keyframes/9861-look{look}{"-v2" if look==6 else ""}.png')},{'type':'video','path':str(dest)}]}
 (r/f'specs/9861-wan-motion-look{look}.json').write_text(json.dumps(s,indent=2)+'\n')
 print('Prepared only; NOT submitted',look,start,end,cost)
