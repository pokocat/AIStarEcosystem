#!/usr/bin/env python3
"""Package a CI-verified backend and build its image natively on the new ECS B."""
import argparse,hashlib,io,json,os,pathlib,shlex,subprocess,tarfile
from policy import artifact_guard,config_guard,require
ROOT=pathlib.Path(__file__).resolve().parents[3]
BASE='docker.io/aibuzz/aistar-pg-preparation:b195acfddf46-node-native-v1'
BASE_CONFIG='eccc6ce2970b9e68f07e73050e8820ecbcbc9450e3317a662c47b9d48a11b386'
def main():
 p=argparse.ArgumentParser();p.add_argument('--verified-backend',required=True);p.add_argument('--output',required=True);a=p.parse_args();os.umask(0o077)
 source=pathlib.Path(a.verified_backend).resolve();out=pathlib.Path(a.output).resolve();out.mkdir(mode=0o700,parents=True,exist_ok=False)
 config=json.loads((ROOT/'infra/cluster/production.json').read_text());config_guard(config,'stage',os.environ)
 proof=json.loads((source/'verified-backend.json').read_text());jar=source/'ai-star-eco-server-1.0.0.jar';digest=hashlib.sha256(jar.read_bytes()).hexdigest();require(digest==proof['jar_sha256'] and proof['tests_passed'] is True,'CI JAR或验收凭证不匹配')
 tree=subprocess.check_output(['git','rev-parse','HEAD:apps/server'],cwd=ROOT,text=True).strip();require(tree==proof['source_tree'],'当前后端源码树与CI验收包不一致')
 run=json.loads(subprocess.check_output(['gh','run','view','--repo','pokocat/AIStarEcosystem',str(proof['ci_run']),'--json','headSha,jobs'],text=True));require(run['headSha']==proof['sha'] and any(x['name']=='backend' and x['conclusion']=='success' for x in run['jobs']),'对应最终SHA后端及PG实库门禁未成功')
 buildroot='/opt/aistar-cluster/image-build/'+digest[:16];key=config['ssh_key']
 def command(n,cmd,timeout=120):
  r=subprocess.run(['ssh','-i',key,'-o','BatchMode=yes','root@'+config['nodes'][n]['host'],cmd],capture_output=True,text=True,timeout=timeout);require(r.returncode==0,'原生镜像操作失败；请看节点私有日志');return r.stdout
 for n in ['a','b']:
  identity=json.loads(command(n,'cat /etc/aibuzz-deploy/node.json'));require(identity['instance_id']==config['nodes'][n]['instance_id'] and identity['cluster_id']==config['physical_cluster_id'],'ECS身份不符')
 command('b','install -d -m 700 '+buildroot)
 subprocess.run(['scp','-q','-i',key,'-o','BatchMode=yes',str(jar),'root@'+config['nodes']['b']['host']+':'+buildroot+'/app.jar'],check=True,timeout=240)
 code="""import pathlib,json,subprocess,hashlib,os
root=pathlib.Path(BUILDROOT);os.umask(0o077)
assert hashlib.sha256((root/'app.jar').read_bytes()).hexdigest()==DIGEST
base=json.loads(subprocess.check_output(['podman','image','inspect',BASE],universal_newlines=True))[0];assert base['Id'].removeprefix('sha256:')==BASECONFIG
(root/'Containerfile').write_text('FROM '+BASE+'\\nCOPY --chown=10001:10001 app.jar /app/app.jar\\nLABEL aistar.sha='+SHA+'\\n')
with (root/'build-private.log').open('w') as log:p=subprocess.run(['podman','build','--pull=never','--format','oci','--memory','1536m','--cpu-period','100000','--cpu-quota','100000','-t',TAG,str(root)],stdout=log,stderr=log)
assert p.returncode==0
image=json.loads(subprocess.check_output(['podman','image','inspect',TAG],universal_newlines=True))[0];assert image['Config']['User']=='10001:10001';assert image['RootFS']['Layers'][:len(base['RootFS']['Layers'])]==base['RootFS']['Layers']
archive=root/'image.tar';subprocess.run(['podman','save','--format','oci-archive','-o',str(archive),TAG],check=True,stdout=subprocess.PIPE,stderr=subprocess.PIPE)
print(json.dumps({'image_configuration_id':'sha256:'+image['Id'].removeprefix('sha256:'),'archive_sha256':hashlib.sha256(archive.read_bytes()).hexdigest(),'image':TAG,'base_configuration_id':BASECONFIG,'path':str(archive),'bytes':archive.stat().st_size}))
"""
 for k,v in {'BUILDROOT':buildroot,'DIGEST':digest,'BASECONFIG':BASE_CONFIG,'BASE':BASE,'SHA':proof['sha'],'TAG':'localhost/aistar-cluster:'+proof['sha'][:12]}.items():code=code.replace(k,repr(v))
 metadata=json.loads(command('b',shlex.join([config['operation_python'],'-s','-c',code]),timeout=300))
 # SSH streams the private archive via this machine, with no public object storage or forwarded private key.
 command('a','install -d -m 700 '+buildroot)
 first=subprocess.Popen(['ssh','-i',key,'-o','BatchMode=yes','root@'+config['nodes']['b']['host'],'cat '+metadata['path']],stdout=subprocess.PIPE,stderr=subprocess.PIPE)
 second=subprocess.run(['ssh','-i',key,'-o','BatchMode=yes','root@'+config['nodes']['a']['host'],'umask 077; cat > '+metadata['path']],stdin=first.stdout,stdout=subprocess.PIPE,stderr=subprocess.PIPE,timeout=300);first.stdout.close();require(first.wait(timeout=30)==0 and second.returncode==0,'镜像私有流传输失败')
 code="import pathlib,hashlib,subprocess,json;p=pathlib.Path("+repr(metadata['path'])+");assert hashlib.sha256(p.read_bytes()).hexdigest()=="+repr(metadata['archive_sha256'])+";subprocess.run(['podman','load','-i',str(p)],check=True,stdout=subprocess.PIPE,stderr=subprocess.PIPE);i=json.loads(subprocess.check_output(['podman','image','inspect',"+repr(metadata['image_configuration_id'])+"],universal_newlines=True))[0];assert i['Id'].removeprefix('sha256:')=="+repr(metadata['image_configuration_id'].removeprefix('sha256:'))
 command('a',shlex.join([config['operation_python'],'-s','-c',code]),timeout=300)
 migrations=[{'name':x.name,'sha256':hashlib.sha256(x.read_bytes()).hexdigest()} for x in sorted((ROOT/'apps/server/src/main/resources/db/postgresql').glob('V*__*.sql'))]
 manifest={'format':'aistar-cluster-artifact-v1',**proof,**metadata,'migrations':migrations};artifact_guard(manifest);release=digest[:16]
 # Two names permit a real restart/rolling rehearsal using one immutable verified artifact.
 for name in ['baseline','candidate']:
  bundle=out/(name+'.tar.gz')
  with tarfile.open(bundle,'w:gz') as t:
   t.add(jar,arcname='app.jar');raw=json.dumps(manifest,indent=2).encode();info=tarfile.TarInfo('manifest.json');info.size=len(raw);info.mode=0o444;t.addfile(info,io.BytesIO(raw))
   tools=source/'migration-tools'
   # Actions upload may flatten a common parent directory. Only compiled class files are accepted.
   if not tools.is_dir():tools=source
   for x in sorted(tools.rglob('*.class')):t.add(x,arcname='tools/'+x.name)
  require(bundle.stat().st_size>1000000,'发布包异常')
 (out/'manifest.json').write_text(json.dumps(manifest,indent=2));print(json.dumps({'release':release,'sha':proof['sha'],'jar_sha256':digest,**metadata},indent=2))
if __name__=='__main__':main()
