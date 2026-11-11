"""Resume an owned private OCI archive only after matching the full existing prefix."""
import json,pathlib,re,shlex,subprocess
from policy import require

def copy_archive(config,metadata,command,progress=None):
 path=pathlib.PurePosixPath(metadata['path']);root=pathlib.PurePosixPath(config['root'])/'image-build'
 require(path.name=='image.tar' and path.parent.parent==root and re.fullmatch('[a-f0-9]{16}',path.parent.name),'镜像归档必须位于固定构建目录')
 require(re.fullmatch('[a-f0-9]{64}',metadata['archive_sha256']) and metadata['bytes']>0,'归档身份缺失')
 python=config['operation_python'];key=config['ssh_key']
 def remote(node,code):return command(node,shlex.join([python,'-s','-c',code]),timeout=180)
 def inspect(node,limit=None):
  code="""import pathlib,hashlib,json
p=pathlib.Path(PATH);assert not p.is_symlink();h=hashlib.sha256();size=p.stat().st_size if p.exists() else 0
if p.exists():
 assert p.is_file()
 with p.open('rb') as src:
  remaining=LIMIT
  while remaining is None or remaining>0:
   block=src.read(1024*1024 if remaining is None else min(1024*1024,remaining))
   if not block:break
   h.update(block)
   if remaining is not None:remaining-=len(block)
print(json.dumps({'bytes':size,'sha256':h.hexdigest()}))
""".replace('PATH',repr(str(path))).replace('LIMIT',repr(limit))
  # This operation is read-only; retry transport failures without replaying mutations.
  for attempt in range(3):
   try:return json.loads(remote(node,code))
   except (RuntimeError,AssertionError,subprocess.SubprocessError,ValueError):
    if attempt==2:raise
 source=inspect('b');require(source=={'bytes':metadata['bytes'],'sha256':metadata['archive_sha256']},'源归档不完整或发生变化')
 target=inspect('a');offset=target['bytes'];matched=offset<=source['bytes'] and target['sha256']==inspect('b',offset)['sha256']
 if not matched:
  remote('a',"import pathlib,time;p=pathlib.Path("+repr(str(path))+");assert not p.is_symlink();p.rename(p.with_name(p.name+'.rejected-'+str(time.time_ns())))")
  offset=0
 if progress:progress({'resumed_bytes':offset,'remaining_bytes':source['bytes']-offset,'prefix_matched':matched})
 if offset<source['bytes']:
  send="import pathlib,sys,shutil;p=pathlib.Path("+repr(str(path))+");f=p.open('rb');f.seek("+str(offset)+");shutil.copyfileobj(f,sys.stdout.buffer,1024*1024)"
  receive="import pathlib,sys,shutil,os;os.umask(0o077);p=pathlib.Path("+repr(str(path))+");assert not p.is_symlink();assert (p.stat().st_size if p.exists() else 0)=="+str(offset)+";f=p.open('ab' if "+str(offset)+" else 'wb');shutil.copyfileobj(sys.stdin.buffer,f,1024*1024);f.close();p.chmod(0o600)"
  def ssh(node,code):return ['ssh','-i',key,'-o','BatchMode=yes','root@'+config['nodes'][node]['host'],shlex.join([python,'-s','-c',code])]
  first=subprocess.Popen(ssh('b',send),stdout=subprocess.PIPE,stderr=subprocess.PIPE)
  try:
   second=subprocess.run(ssh('a',receive),stdin=first.stdout,stdout=subprocess.PIPE,stderr=subprocess.PIPE,timeout=900)
   first.stdout.close();require(first.wait(timeout=30)==0 and second.returncode==0,'镜像私有续传失败；保留已校验部分供下次复查')
  finally:
   if first.stdout and not first.stdout.closed:first.stdout.close()
   if first.poll() is None:
    first.terminate()
    try:first.wait(timeout=10)
    except subprocess.TimeoutExpired:first.kill();first.wait()
 final=inspect('a');require(final==source,'目标归档全量SHA不符；禁止加载镜像')
 return {'resumed_bytes':offset,'transferred_bytes':source['bytes']-offset,'prefix_matched':matched,'full_archive_sha256_verified':True,'transport':'private SSH stream; no object staging'}
