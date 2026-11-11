from pathlib import Path
import json, subprocess, sys
from PIL import Image, ImageDraw

root=Path('/Users/donis/BuildBox/artifacts/studio-clone-lab-20261108')
name=sys.argv[1];end={'9861':14.966667,'9862':10.516667}[name]
vendor=root/'generation'/(name+'-continuous-v1')/'vendor.mp4'
out=root/'results';out.mkdir(exist_ok=True)
def run(args):subprocess.run(args,check=True)
def probe(file):
    r=subprocess.run(['ffprobe','-v','error','-show_format','-show_streams','-of','json',str(file)],capture_output=True,text=True,check=True)
    return json.loads(r.stdout)
meta=probe(vendor)
dest=out/(name+'-final.mp4')
if not dest.exists():
    run(['ffmpeg','-nostdin','-v','error','-y','-i',str(vendor),'-i',str(root/'input'/(name+'.mp4')),
     '-map','0:v:0','-map','1:a:0?',
     '-vf',f'scale=720:1280:force_original_aspect_ratio=increase,crop=720:1280,setsar=1,fps=60,tpad=stop_mode=clone:stop_duration=0.5,trim=duration={end},setpts=PTS-STARTPTS',
     '-af',f'atrim=start=0:end={end},asetpts=PTS-STARTPTS',
     '-c:v','libx264','-threads','2','-preset','fast','-crf','18','-c:a','aac','-b:a','128k','-t',str(end),'-movflags','+faststart',str(dest)])
times=([0.3,1.2,2.2,3.6,4.6,5.7,6.3,6.8,8.0,8.5,9.8,10.5,11.8,12.6,13.8,14.6] if name=='9861' else [0.2,1.2,2.5,3.4,4.2,4.9,5.3,5.43,5.7,6.3,7.2,8.2,9.2,10.4])
temp=out/(name+'-review-frames');temp.mkdir(exist_ok=True)
cols=4;rows=(len(times)+cols-1)//cols
board=Image.new('RGB',(cols*240,rows*454),(248,248,248));d=ImageDraw.Draw(board)
for i,t in enumerate(times):
    frame=temp/(str(i)+'.jpg')
    run(['ffmpeg','-nostdin','-v','error','-y','-ss',str(t),'-i',str(dest),'-frames:v','1','-vf','scale=240:-2','-threads','1',str(frame)])
    im=Image.open(frame).convert('RGB');im.thumbnail((240,420));x=i%cols*240;y=i//cols*454
    d.text((x+8,y+8),f'{name} NEW | {t:.3f}s',fill='black');board.paste(im,(x,y+30))
board.save(out/(name+'-review.jpg'),quality=92)
(out/(name+'-media-metadata.json')).write_text(json.dumps({'vendor':meta,'final':probe(dest),'postprocess':'Retain original vendor file. Only normalize canvas, remux original source audio, duplicate frames to CFR60 for exact source end boundary, trim/pad final settling tail. No optical interpolation, no internal-event retiming, no additional generated scene.','targetBodyEndSec':end},indent=2)+'\n')
print(name,'exported; internal action and transition quality still require review')
