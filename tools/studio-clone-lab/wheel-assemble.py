from pathlib import Path
import subprocess, json

r=Path('/Users/donis/BuildBox/artifacts/studio-clone-lab-20261108')
out=r/'results';out.mkdir(exist_ok=True)
day=r/'generation/9862-wan-day-v1/vendor.mp4'
night=r/'generation/9862-wan-night-v1/vendor.mp4'
dest=out/'9862-wan-final.mp4'
graph='[0:v]fps=60,scale=720:1280,setsar=1,trim=duration=5.433333,setpts=PTS-STARTPTS,settb=1/60[d];[1:v]fps=60,scale=720:1280,setsar=1,trim=start=0.1:duration=5.166667,setpts=PTS-STARTPTS,settb=1/60[n];[d][n]xfade=transition=fade:duration=0.083333:offset=5.35,trim=duration=10.516667[v]'
args=['ffmpeg','-nostdin','-v','error','-y','-i',str(day),'-i',str(night),'-i',str(r/'input/9862.mp4'),'-filter_complex_threads','1','-filter_complex',graph,'-map','[v]','-map','2:a:0?','-af','atrim=start=0:end=10.516667,asetpts=PTS-STARTPTS','-c:v','libx264','-threads','2','-preset','fast','-crf','18','-c:a','aac','-b:a','128k','-t','10.516667','-movflags','+faststart',str(dest)]
subprocess.run(args,check=True)
meta=subprocess.run(['ffprobe','-v','error','-show_format','-show_streams','-of','json',str(dest)],capture_output=True,text=True,check=True)
(out/'9862-wan-postprocess.json').write_text(json.dumps({'sourceDayWindow':[0,5.55],'sourceNightWindow':[5.25,10.516667],'finalDissolveWindow':[5.35,5.433333],'postprocess':'Source-driven replacement clips aligned on original clock. Local 83ms crossfade; original audio retained; original source-platform marks retained to avoid inpainting artifacts; no new model request. CFR60 duplicates native30 frames for source end boundary, no optical interpolation.','metadata':json.loads(meta.stdout)},indent=2)+'\n')
print(dest)
