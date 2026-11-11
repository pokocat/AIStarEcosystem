from pathlib import Path
import cv2,numpy as np,subprocess,json,sys
from PIL import Image,ImageDraw
cv2.setNumThreads(1)
r=Path('/Users/donis/BuildBox/artifacts/studio-clone-lab-20261108');w,h=720,1280;mode=sys.argv[1]
cache=r/'prepared/fan-layer';cache.mkdir(exist_ok=True);out=r/'results'
def read(c):
 ok,f=c.read();return cv2.resize(f,(w,h)) if ok else None
def fanmask(f,bg,strict=False):
 hsv=cv2.cvtColor(f,cv2.COLOR_BGR2HSV);b,g,red=cv2.split(f)
 delta=cv2.cvtColor(bg,cv2.COLOR_BGR2HSV)[:,:,2].astype(int)-hsv[:,:,2].astype(int)
 m=((hsv[:,:,2]<180)&(hsv[:,:,1]<120)&(delta>32)&(red.astype(int)>=g.astype(int)-3)&(g.astype(int)>=b.astype(int)-3)).astype('uint8')*255
 if strict:m[hsv[:,:,0]<11]=0
 m=cv2.morphologyEx(m,cv2.MORPH_CLOSE,np.ones((61,5),np.uint8));m=cv2.morphologyEx(m,cv2.MORPH_OPEN,np.ones((3,3),np.uint8))
 n,l,stats,cent=cv2.connectedComponentsWithStats(m);best=None;score=0
 for j in range(1,n):
  touch=np.count_nonzero(l[:int(h*.22),int(w*.1):int(w*.95)]==j)
  if touch>score:best=j;score=touch
 result=((l==best)*255).astype('uint8') if best else np.zeros((h,w),np.uint8)
 contours,_=cv2.findContours(result,cv2.RETR_EXTERNAL,cv2.CHAIN_APPROX_SIMPLE);cv2.drawContours(result,contours,-1,255,cv2.FILLED)
 return result
def alpha(m):return cv2.GaussianBlur(m,(3,3),.5).astype(np.float32)[:,:,None]/255
transitions=[6.1,8.1,9.8,11.8,13.7];starts=[0,5.,7.4,9.1,11.1,12.966667]
source=cache/'source-30.mp4';mattefile=cache/'source-fan-matte.mkv'
if mode=='cache':
 subprocess.run(['ffmpeg','-nostdin','-v','error','-y','-i',str(r/'prepared/9861-body.mp4'),'-vf','fps=30','-an','-c:v','libx264','-threads','2','-crf','18','-preset','fast',str(source)],check=True)
 cap=cv2.VideoCapture(str(source));samples=[]
 for t in np.arange(4.7,14.9,.31):
  cap.set(cv2.CAP_PROP_POS_MSEC,t*1000);f=read(cap)
  if f is not None:samples.append(f)
 cap.release();bg=np.median(np.stack(samples),axis=0).astype('uint8');np.save(cache/'background.npy',bg)
 cap=cv2.VideoCapture(str(source));p=subprocess.Popen(['ffmpeg','-nostdin','-v','error','-y','-f','rawvideo','-pix_fmt','gray','-s','720x1280','-r','30','-i','pipe:0','-c:v','ffv1','-threads','2',str(mattefile)],stdin=subprocess.PIPE)
 coverage=[np.zeros((h,w),np.uint8) for _ in transitions];i=0
 while True:
  f=read(cap)
  if f is None:break
  m=fanmask(f,bg,strict=True);p.stdin.write(m.tobytes())
  for j,c in enumerate(transitions):
   if c-.7<=i/30<=c+.6:coverage[j]=np.maximum(coverage[j],m)
  i+=1
 p.stdin.close();rc=p.wait();cap.release()
 if rc:raise RuntimeError(rc)
 cover=[{'center':c,'garmentRoiCoverage':float((m[int(h*.25):int(h*.94),int(w*.08):int(w*.92)]>127).mean())} for c,m in zip(transitions,coverage)]
 (cache/'coverage.json').write_text(json.dumps({'frames':i,'transitions':cover},indent=2)+'\n');print(json.dumps({'cacheFrames':i,'coverage':cover}));sys.exit()
bg=np.load(cache/'background.npy');count=2 if mode.startswith('two') else 6;end=7.4 if count==2 else 14.966667
caps=[];static=[];positions=[];last=[]
for look in range(1,count+1):
 cap=cv2.VideoCapture(str(r/f'generation/9861-wan-motion-look{look}-v1/vendor.mp4'));f=read(cap)
 if f is None:raise RuntimeError(f'Missing accepted look {look}')
 m=fanmask(f,bg);m[int(h*.82):]=0;caps.append(cap);static.append(alpha(m));positions.append(0);last.append(f)
def plate(j,frame):
 idx=max(0,frame-round(starts[j]*30))
 if idx!=positions[j]:
  if idx!=positions[j]+1:caps[j].set(cv2.CAP_PROP_POS_FRAMES,idx)
  f=read(caps[j])
  if f is not None:last[j]=f;positions[j]=idx
 return last[j]*(1-static[j])+bg*static[j]
intro=None
if mode.endswith('hybrid'):
 introfile=cache/'h3-opening-30.mp4'
 subprocess.run(['ffmpeg','-nostdin','-v','error','-y','-i',str(out/'9861-final.mp4'),'-t','1.6','-vf','fps=30','-an','-c:v','libx264','-threads','2','-preset','fast','-crf','18',str(introfile)],check=True)
 intro=cv2.VideoCapture(str(introfile))
cap=cv2.VideoCapture(str(source));mc=cv2.VideoCapture(str(mattefile));dest=out/(('9861-layer-two-look-hybrid.mp4' if count==2 else '9861-layer-final.mp4') if intro else ('9861-layer-two-look.mp4' if count==2 else '9861-layer-final-wan-only.mp4'))
p=subprocess.Popen(['ffmpeg','-nostdin','-v','error','-y','-f','rawvideo','-pix_fmt','bgr24','-s','720x1280','-r','30','-i','pipe:0','-i',str(r/'input/9861.mp4'),'-map','0:v','-map','1:a:0?','-c:v','libx264','-threads','2','-preset','fast','-crf','18','-pix_fmt','yuv420p','-c:a','aac','-b:a','128k','-t',str(end),'-movflags','+faststart',str(dest)],stdin=subprocess.PIPE)
active=0;reveal=np.zeros((h,w),np.uint8);i=0;debug=[]
while i<round(end*30):
 orig=read(cap);mf=read(mc)
 if orig is None or mf is None:raise RuntimeError('Source/matte ended early')
 m=mf[:,:,0];t=i/30
 while active<count-1 and t>transitions[active]+.6:active+=1;reveal=np.zeros((h,w),np.uint8)
 clean=plate(active,i)
 if active<count-1 and t>=transitions[active]-.7:
  reveal=np.maximum(reveal,m)
  # Extend the observed wipe boundary through the bottom background so uncovered floor pixels cannot retain the previous plate.
  swept=np.flatnonzero(reveal[int(h*.90)]>127)
  if len(swept):reveal[int(h*.94):,:int(swept[-1])+1]=255
  ra=alpha(reveal)
  clean=clean*(1-ra)+plate(active+1,i)*ra
 top=np.clip((h*.22-np.arange(h,dtype=np.float32))/(h*.12),0,1)[:,None,None]
 clean=clean*(1-top)+orig*top
 al=alpha(m);result=np.clip(clean*(1-al)+orig*al,0,255).astype('uint8')
 if intro is not None and t<1.6:
  hf=read(intro)
  if hf is None:raise RuntimeError('H3 opening ended early')
  blend=np.clip((t-1.3)/.3,0,1);result=np.clip(hf*(1-blend)+result*blend,0,255).astype('uint8')
 p.stdin.write(result.tobytes())
 times=[.3,.8,1.3,2.2,3.4,4.7,5.4,5.8,6.1,6.4,6.8,7.3] if count==2 else [.3,1.2,2.2,4.7,5.8,6.1,6.5,6.8,7.9,8.1,8.5,8.8,9.8,10.4,10.8,11.8,12.6,13.7,14.3,14.6]
 if any(abs(t-k)<.012 for k in times):debug.append((t,result.copy()))
 i+=1
p.stdin.close();rc=p.wait();cap.release();mc.release()
for c in caps:c.release()
if rc:raise RuntimeError(rc)
cols=4;board=Image.new('RGB',(cols*240,((len(debug)+cols-1)//cols)*450),'white');d=ImageDraw.Draw(board)
for j,(t,f) in enumerate(debug):
 im=Image.fromarray(cv2.cvtColor(f,cv2.COLOR_BGR2RGB));im.thumbnail((240,420));x=j%cols*240;y=j//cols*450;board.paste(im,(x,y+25));d.text((x+6,y+5),f'LAYER {t:.3f}s',fill='black')
board.save(dest.with_name(dest.stem+'-review.jpg'),quality=92)
dest.with_suffix('.json').write_text(json.dumps({'opening':'H3 generated opening 0-1.3s blended into Wan at 1.3-1.6s to avoid duplicate-character animation; not exact source motion in this short opening' if intro else 'Wan only: first-entry duplicate character failure retained for diagnosis','frames':i,'duration':end,'looks':count,'transitionCenters':transitions[:count-1],'transitionWindows':[[c-.7,c+.6] for c in transitions[:count-1]],'composition':'Target human and wardrobe animation from Wan motion_transfer; fixed reference fan patched with source temporal median, actual source fan composited with adaptive foreground matte; each wardrobe reveal accumulates pixels behind the passing fan; the swept boundary at90% height extends through the bottom6% background to avoid stale previous-plate pixels; source audio and clock retained. From1.6s onward source background/foreground in the top region is blended with a vertical feather from10% to22% height; H3 opening avoids copying the source person entering that area. Foreground fan matte reaches the frame boundary without artificial97% crop. This crop is specific to this source and is not a general safe matting rule. Prototype: matte seams, old wardrobe edge leakage and actor/pose consistency still require visual review.','bgCache':'prepared/fan-layer/background.npy','matteCache':'prepared/fan-layer/source-fan-matte.mkv'},indent=2)+'\n')
print(dest,'frames',i)
