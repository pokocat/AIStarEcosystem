#!/usr/bin/env python3
"""Package a CI-verified backend and build its image natively on the new ECS B."""
import argparse,base64,hashlib,json,os,pathlib,shlex,subprocess
from policy import artifact_guard,config_guard,require
from archive_transfer import copy_archive
ROOT=pathlib.Path(__file__).resolve().parents[3]
BASE='docker.io/aibuzz/aistar-pg-preparation:b195acfddf46-node-native-v1'
BASE_CONFIG='eccc6ce2970b9e68f07e73050e8820ecbcbc9450e3317a662c47b9d48a11b386'
def file_sha(path):
 h=hashlib.sha256()
 with path.open('rb') as src:
  for block in iter(lambda:src.read(1024*1024),b''):h.update(block)
 return h.hexdigest()
def main():
 p=argparse.ArgumentParser();p.add_argument('--verified-backend',required=True);p.add_argument('--output',required=True);a=p.parse_args();os.umask(0o077)
 source=pathlib.Path(a.verified_backend).resolve();out=pathlib.Path(a.output).resolve();out.mkdir(mode=0o700,parents=True,exist_ok=False)
 config=json.loads((ROOT/'infra/cluster/production.json').read_text());config_guard(config,'stage',os.environ)
 proof=json.loads((source/'verified-backend.json').read_text());jar=source/'ai-star-eco-server-1.0.0.jar';digest=file_sha(jar);require(digest==proof['jar_sha256'] and proof['tests_passed'] is True,'CI JAR或验收凭证不匹配')
 tree=subprocess.check_output(['git','rev-parse','HEAD:apps/server'],cwd=ROOT,text=True).strip();require(tree==proof['source_tree'],'当前后端源码树与CI验收包不一致')
 run=json.loads(subprocess.check_output(['gh','run','view','--repo','pokocat/AIStarEcosystem',str(proof['ci_run']),'--json','headSha,jobs'],text=True));require(run['headSha']==proof['sha'] and any(x['name']=='backend' and x['conclusion']=='success' for x in run['jobs']),'对应最终SHA后端及PG实库门禁未成功')
 buildroot='/opt/aistar-cluster/image-build/'+digest[:16];key=config['ssh_key']
 def command(n,cmd,timeout=120):
  r=subprocess.run(['ssh','-i',key,'-o','BatchMode=yes','root@'+config['nodes'][n]['host'],cmd],capture_output=True,text=True,timeout=timeout)
  if r.returncode:(out/'last-cloud-command-private.log').write_text(r.stdout+r.stderr)
  require(r.returncode==0,'原生镜像操作失败；请看私有操作日志');return r.stdout
 for n in ['a','b']:
  identity=json.loads(command(n,'cat /etc/aibuzz-deploy/node.json'));require(identity['instance_id']==config['nodes'][n]['instance_id'] and identity['cluster_id']==config['physical_cluster_id'],'ECS身份不符')
 command('b','install -d -m 700 '+buildroot)
 subprocess.run(['scp','-q','-i',key,'-o','BatchMode=yes',str(jar),'root@'+config['nodes']['b']['host']+':'+buildroot+'/app.jar'],check=True,timeout=240)
 code="""import pathlib,json,subprocess,hashlib,os,tarfile
root=pathlib.Path(BUILDROOT);os.umask(0o077)
assert hashlib.sha256((root/'app.jar').read_bytes()).hexdigest()==DIGEST
base=json.loads(subprocess.check_output(['podman','image','inspect',BASE],universal_newlines=True))[0];assert base['Id'].removeprefix('sha256:')==BASECONFIG
archive=root/'image.tar';image=None
if archive.is_file():
 try:
  found=json.loads(subprocess.check_output(['podman','image','inspect',TAG],text=True,stderr=subprocess.PIPE))[0]
  with tarfile.open(archive) as tar:
   index=json.load(tar.extractfile('index.json'));blob=index['manifests'][0]['digest'].replace(':','/');stored=json.load(tar.extractfile('blobs/'+blob))
  if stored['config']['digest'].removeprefix('sha256:')==found['Id'].removeprefix('sha256:') and found['Config'].get('Labels',{}).get('aistar.sha')==SHA:image=found
 except (KeyError,ValueError,tarfile.TarError,subprocess.CalledProcessError):pass
if image is None:
 (root/'Containerfile').write_text('FROM '+BASE+'\\nCOPY --chown=10001:10001 app.jar /app/app.jar\\nLABEL aistar.sha='+SHA+'\\n')
 with (root/'build-private.log').open('w') as log:p=subprocess.run(['podman','build','--pull=never','--format','oci','--memory','1536m','--cpu-period','100000','--cpu-quota','100000','-t',TAG,str(root)],stdout=log,stderr=log)
 assert p.returncode==0
 image=json.loads(subprocess.check_output(['podman','image','inspect',TAG],text=True))[0]
 subprocess.run(['podman','save','--format','oci-archive','-o',str(archive),TAG],check=True,stdout=subprocess.PIPE,stderr=subprocess.PIPE)
assert image['Config']['User']=='10001:10001' and image['RootFS']['Layers'][:len(base['RootFS']['Layers'])]==base['RootFS']['Layers']
h=hashlib.sha256()
with archive.open('rb') as src:
 for chunk in iter(lambda:src.read(1024*1024),b''):h.update(chunk)
metadata={'image_configuration_id':'sha256:'+image['Id'].removeprefix('sha256:'),'archive_sha256':h.hexdigest(),'image':TAG,'base_configuration_id':BASECONFIG,'path':str(archive),'bytes':archive.stat().st_size}
(root/'image-metadata.json').write_text(json.dumps(metadata));(root/'image-metadata.json').chmod(0o600)
print(json.dumps(metadata))
"""
 for k,v in {'BUILDROOT':buildroot,'DIGEST':digest,'BASECONFIG':BASE_CONFIG,'BASE':BASE,'SHA':proof['sha'],'TAG':'localhost/aistar-cluster:'+proof['sha'][:12]}.items():code=code.replace(k,repr(v))
 metadata=json.loads(command('b',shlex.join([config['operation_python'],'-s','-c',code]),timeout=300))
 # SSH streams the private archive via this machine, with no public object storage or forwarded private key.
 command('a','install -d -m 700 '+buildroot)
 transfer=copy_archive(config,metadata,command,progress=lambda state:(out/'archive-transfer-progress.json').write_text(json.dumps(state)))
 (out/'archive-transfer-verification.json').write_text(json.dumps(transfer,indent=2))
 code="import pathlib,hashlib,subprocess,json;p=pathlib.Path("+repr(metadata['path'])+");assert hashlib.sha256(p.read_bytes()).hexdigest()=="+repr(metadata['archive_sha256'])+";subprocess.run(['podman','load','-i',str(p)],check=True,stdout=subprocess.PIPE,stderr=subprocess.PIPE);i=json.loads(subprocess.check_output(['podman','image','inspect',"+repr(metadata['image_configuration_id'])+"],universal_newlines=True))[0];assert i['Id'].removeprefix('sha256:')=="+repr(metadata['image_configuration_id'].removeprefix('sha256:'))
 command('a',shlex.join([config['operation_python'],'-s','-c',code]),timeout=300)
 migrations=[{'name':x.name,'sha256':hashlib.sha256(x.read_bytes()).hexdigest()} for x in sorted((ROOT/'apps/server/src/main/resources/db/postgresql').glob('V*__*.sql'))]
 manifest={'format':'aistar-cluster-artifact-v1',**proof,**metadata,'migrations':migrations};artifact_guard(manifest);release=digest[:16]
 # Compression runs on the new ECS B, never concurrently with another local build.
 # The workstation only transfers immutable CI input and completed cloud archives.
 tools=source/'migration-tools'
 if not tools.is_dir():tools=source
 classes={}
 for x in sorted(tools.rglob('*.class')):
  encoded=base64.b64encode(x.read_bytes()).decode()
  require(x.name not in classes or classes[x.name]==encoded,'重复工具类冲突');classes[x.name]=encoded
 require(classes,'CI编译工具缺失')
 request=out/'cloud-packaging.json';request.write_text(json.dumps({'manifest':manifest,'classes':classes}));request.chmod(0o600)
 subprocess.run(['scp','-q','-i',key,'-o','BatchMode=yes',str(request),'root@'+config['nodes']['b']['host']+':'+buildroot+'/cloud-packaging.json'],check=True,timeout=60)
 code="""import pathlib,json,tarfile,base64,io,hashlib,os,re,shutil
os.umask(0o077);os.nice(19);root=pathlib.Path(BUILDROOT);request=root/'cloud-packaging.json'
assert hashlib.sha256(request.read_bytes()).hexdigest()==REQUESTSHA
payload=json.loads(request.read_text());manifest=payload['manifest'];jar=root/'app.jar'
h=hashlib.sha256()
with jar.open('rb') as src:
 for block in iter(lambda:src.read(1024*1024),b''):h.update(block)
assert h.hexdigest()==manifest['jar_sha256']
archive=root/'baseline.tar.gz'
with tarfile.open(archive,'w:gz') as tar:
 tar.add(jar,arcname='app.jar');raw=json.dumps(manifest,indent=2).encode();info=tarfile.TarInfo('manifest.json');info.size=len(raw);info.mode=0o444;tar.addfile(info,io.BytesIO(raw))
 for name,encoded in sorted(payload['classes'].items()):
  assert re.fullmatch('[A-Za-z0-9_$]+[.]class',name);raw=base64.b64decode(encoded,validate=True);info=tarfile.TarInfo('tools/'+name);info.size=len(raw);info.mode=0o444;tar.addfile(info,io.BytesIO(raw))
shutil.copyfile(archive,root/'candidate.tar.gz');proof={}
for name in ['baseline','candidate']:
 p=root/(name+'.tar.gz');p.chmod(0o600);h=hashlib.sha256()
 with p.open('rb') as src:
  for block in iter(lambda:src.read(1024*1024),b''):h.update(block)
 assert p.stat().st_size>1000000;proof[name]={'bytes':p.stat().st_size,'sha256':h.hexdigest()}
print(json.dumps(proof))
""".replace('BUILDROOT',repr(buildroot)).replace('REQUESTSHA',repr(file_sha(request)))
 packages=json.loads(command('b',shlex.join([config['operation_python'],'-s','-c',code]),timeout=240))
 for name in ['baseline','candidate']:
  target=out/(name+'.tar.gz');subprocess.run(['scp','-q','-i',key,'-o','BatchMode=yes','root@'+config['nodes']['b']['host']+':'+buildroot+'/'+name+'.tar.gz',str(target)],check=True,timeout=180)
  require(file_sha(target)==packages[name]['sha256'] and target.stat().st_size==packages[name]['bytes'],'云端打包结果传输不一致')
 (out/'cloud-packaging-verification.json').write_text(json.dumps({'built_on':'ecs-b','local_compression':False,'packages':packages},indent=2))
 (out/'manifest.json').write_text(json.dumps(manifest,indent=2));print(json.dumps({'release':release,'sha':proof['sha'],'jar_sha256':digest,**metadata},indent=2))
if __name__=='__main__':main()
