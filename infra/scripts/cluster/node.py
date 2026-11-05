#!/usr/bin/env python3
"""Root-only, fixed-node release operations. No legacy hosts or database import operations."""
import argparse,hashlib,json,os,pathlib,re,subprocess,sys,time,urllib.request,zipfile,shutil,tarfile
from policy import environment_guard,artifact_guard,require
ROOT=pathlib.Path('/opt/aistar-cluster')
PYTHON='/opt/aibuzz-id/runtime/python311/bin/python3'
def run(args,**kw):
 p=subprocess.run(args,stdout=subprocess.PIPE,stderr=subprocess.PIPE,text=True,**kw)
 require(p.returncode==0,'节点操作失败，详细诊断仅保存在节点日志');return p.stdout

def sha(path):return hashlib.sha256(path.read_bytes()).hexdigest()
def configuration(mode):
 require(os.geteuid()==0,'必须由root执行')
 config=json.loads((ROOT/'control/config.json').read_text());identity=json.loads(pathlib.Path('/etc/aibuzz-deploy/node.json').read_text())
 require(identity.get('cluster_id')==config['physical_cluster_id'] and identity.get('instance_id') in [x['instance_id'] for x in config['nodes'].values()],'实际节点身份不符')
 expected=config['modes'][mode]
 if mode=='production':
  marker=ROOT/'production-activated.json';require(marker.is_file(),'AIStar生产尚未迁移；拒绝滚动或激活')
  active=json.loads(marker.read_text());require(re.fullmatch('[A-Za-z0-9_-]+[.]json',active.get('receipt','')) is not None,'正式凭证必须是受保护目录内的普通文件名');receipt=pathlib.Path('/opt/aistar-migration/preparation')/active['receipt']
  require(sha(receipt)==active['receipt_sha256'],'正式导入凭证变化')
  proof=json.loads(receipt.read_text());require(proof.get('production') is True and proof.get('database')=='aistar_prod' and proof.get('source_frozen') is True and proof.get('verified_tables')==192 and all(x.get('matched') for x in proof['tables'].values()),'正式导入未完成')
 return config,expected

def environment(mode,expected):
 path=pathlib.Path(expected['environment']);require(path.stat().st_uid==0 and path.stat().st_mode&0o777==0o600,'环境必须root:600')
 env=json.loads(path.read_text());environment_guard(env,mode,expected)
 if mode=='production':
  require(env.get('AEP_CDN_DRIVER','oss')=='oss','双机持久文件必须使用OSS')
  require(env.get('AEP_CDN_SIGNED_URL_STRATEGY','oss')=='oss','必须启用OSS签名')
 return env

def ops(expected,env,quiesce=False):
 req=urllib.request.Request('http://127.0.0.1:'+str(expected['port'])+'/internal/deployment',data=b'' if quiesce else None,headers={'X-Aistar-Deployment-Token':env['AEP_DEPLOYMENT_TOKEN']})
 with urllib.request.urlopen(req,timeout=15) as r:return json.load(r)

def prepare(config,expected,mode,release):
 require(re.fullmatch('[a-f0-9]{16}',release) is not None,'不可变发布标识错误')
 dest=ROOT/'releases'/release;require(dest.is_dir(),'发布包缺失')
 manifest=json.loads((dest/'manifest.json').read_text());artifact_guard(manifest)
 require(sha(dest/'app.jar')==manifest['jar_sha256'],'发布JAR变化')
 require(run(['podman','image','inspect',manifest['image_configuration_id'],'--format','{{.Id}}']).strip().removeprefix('sha256:')==manifest['image_configuration_id'].removeprefix('sha256:'),'镜像配置摘要变化')
 env=environment(mode,expected)
 # Extract only the exact pinned JAR; staged JVM sees the same classes/dependencies as production.
 extracted=dest/'app';tools=dest/'tools'
 if not extracted.exists():
  extracted.mkdir(mode=0o755)
 with zipfile.ZipFile(dest/'app.jar') as jar:
   for entry in jar.infolist():
    if entry.filename.startswith(('BOOT-INF/classes/','BOOT-INF/lib/')) and not entry.is_dir():
     p=extracted/entry.filename;data=jar.read(entry);require(not p.is_symlink(),'解包文件不能是符号链接');p.parent.mkdir(mode=0o755,parents=True,exist_ok=True)
     if p.exists():require(p.read_bytes()==data,'解包运行代码与固定JAR不一致')
     else:p.write_bytes(data);p.chmod(0o444)
 require((tools/'IsolatedApiBootstrap.class').is_file(),'缺少演练出站屏障')
 state=ROOT/'state'/mode;state.mkdir(mode=0o700,parents=True,exist_ok=True)
 (state/'api-run').mkdir(exist_ok=True)
 if not (state/'rds-ca.pem').exists():
  for name in ['rds-ca.pem','java-truststore']:shutil.copyfile('/opt/aistar-migration/preparation/'+name,state/name)
 for p in [state,*state.iterdir()]:os.chown(p,10001,10001);p.chmod(0o700 if p.is_dir() else 0o400)
 # Atomic root-private env file, never printed or placed in a release archive.
 require(all('\n' not in k+v and '\r' not in k+v for k,v in env.items()),'环境不能包含换行')
 (ROOT/'control'/('env-'+mode)).write_text(''.join(k+'='+v+'\n' for k,v in env.items()));(ROOT/'control'/('env-'+mode)).chmod(0o600)
 return dest,manifest,env

def start(config,expected,mode,release):
 dest,manifest,env=prepare(config,expected,mode,release);unit=expected['unit']
 require(run(['systemctl','show',unit,'-p','MainPID','--value']).strip() in ('','0'),'替换前必须完成排空并停止')
 args=['/usr/bin/podman','run','--rm','--name',unit,'--label','aistar.release='+release,'--label','aistar.mode='+mode,'--network','host','--read-only','--tmpfs','/tmp:rw,size=128m','--memory','1600m','--cpus','1','--pids-limit','256','--user','10001:10001','--env-file',str(ROOT/'control'/('env-'+mode)),'--volume',str(ROOT/'state'/mode)+':/opt/aistar-migration/preparation:rw','--volume',str(dest)+':/app/release:ro']
 if mode=='production':
  work=ROOT/'work';require(work.is_dir(),'缺少已核对持久目录');args+=['--volume',str(work)+':/app/work:rw']
 args+=['--entrypoint','java',manifest['image_configuration_id'],'-Duser.timezone=Asia/Shanghai','-Djavax.net.ssl.trustStore=/opt/aistar-migration/preparation/java-truststore','-Djavax.net.ssl.trustStorePassword=changeit','-Xms128m','-Xmx1024m']
 if mode=='stage':args+=['-Djava.security.manager=allow','--add-opens=java.base/java.lang=ALL-UNNAMED','-cp','/app/release/tools:/app/release/app/BOOT-INF/classes:/app/release/app/BOOT-INF/lib/*','IsolatedApiBootstrap']
 else:args+=['-jar','/app/release/app.jar']
 pathlib.Path('/var/log/aistar').mkdir(mode=0o755,exist_ok=True)
 unitfile='[Unit]\nDescription=AIStar '+mode+' immutable API\nAfter=network-online.target\n[Service]\nType=simple\nRestart=on-failure\nRestartSec=5\nTimeoutStopSec=240\nKillMode=control-group\nStandardOutput=append:/var/log/aistar/'+mode+'.log\nStandardError=inherit\nExecStart='+ ' '.join(args)+'\n[Install]\nWantedBy=multi-user.target\n'
 require(all(' ' not in x and '\n' not in x for x in args),'systemd参数不能包含空白')
 path=pathlib.Path('/etc/systemd/system')/(unit+'.service');path.write_text(unitfile);run(['systemctl','daemon-reload']);run(['systemctl','start',unit])
 deadline=time.monotonic()+150
 while time.monotonic()<deadline:
  try:
   with urllib.request.urlopen('http://127.0.0.1:'+str(expected['port'])+'/internal/ready',timeout=4) as r:
    if r.status==200 and json.load(r).get('ready'):break
  except Exception:pass
  time.sleep(2)
 else:raise RuntimeError('新节点未就绪；保留当前ALB主节点')
 info=inspect(expected,env);require(info['release']==release and not info['quiescing'],'实际运行包或状态不符');return info

def inspect(expected,env):
 unit=expected['unit'];pid=run(['systemctl','show',unit,'-p','MainPID','--value']).strip();require(pid not in ('','0'),'服务未运行')
 container=json.loads(run(['podman','inspect',unit]))[0]
 actual=dict(x.split('=',1) for x in container['Config']['Env'] if '=' in x)
 environment_guard(actual,'stage' if expected['database']=='aistar_schema_rehearsal' else 'production',expected)
 require(actual['AEP_DEPLOYMENT_TOKEN']==env['AEP_DEPLOYMENT_TOKEN'],'部署令牌漂移')
 release=container['Config']['Labels']['aistar.release'];manifest=json.loads((ROOT/'releases'/release/'manifest.json').read_text())
 require(container['Image'].removeprefix('sha256:')==manifest['image_configuration_id'].removeprefix('sha256:'),'运行镜像与清单不符')
 return {'release':release,'sha':manifest['sha'],'image':manifest['image_configuration_id'],'pid':int(pid),**ops(expected,env)}

def main():
 p=argparse.ArgumentParser();p.add_argument('--mode',choices=['stage','production'],required=True);p.add_argument('--action',choices=['prepare','start','inspect','drain-stop'],required=True);p.add_argument('--release');a=p.parse_args();os.umask(0o077)
 config,expected=configuration(a.mode);env=environment(a.mode,expected)
 if a.action=='prepare':prepare(config,expected,a.mode,a.release);result={'prepared':True}
 elif a.action=='start':result=start(config,expected,a.mode,a.release)
 elif a.action=='inspect':result=inspect(expected,env)
 else:
  ops(expected,env,True);deadline=time.monotonic()+config['drain_timeout_seconds'];began=time.monotonic();good=0
  while time.monotonic()<deadline:
   status=ops(expected,env);good=good+1 if status.get('drained') is True else 0
   if time.monotonic()-began>=config['drain_seconds'] and good>=3:break
   time.sleep(2)
  else:raise RuntimeError('排空超时，禁止停止进程')
  run(['systemctl','stop',expected['unit']]);result={'stopped_after_drain':True,'drain_seconds':round(time.monotonic()-began,2),'last_status':status}
 print(json.dumps(result))
if __name__=='__main__':
 try:main()
 except Exception as e:print(str(e),file=sys.stderr);sys.exit(1)
