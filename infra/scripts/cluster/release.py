#!/usr/bin/env python3
"""ALB A100/B0 rolling release; no database import, DNS changes, or legacy-host fallback."""
import argparse,datetime,hashlib,http.client,json,os,pathlib,shlex,socket,ssl,subprocess,sys,time,tarfile,tempfile
from policy import config_guard,artifact_guard,alb_guard,require
ROOT=pathlib.Path(__file__).resolve().parents[3]
class Cluster:
 def __init__(self,config,mode):self.config=config;self.mode=mode;self.expected=config['modes'][mode];self.events=[]
 def record(self,event,**kw):self.events.append({'utc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'event':event,**kw});print(event,flush=True)
 def ssh(self,node,command,timeout=2100,stdin=None):
  p=subprocess.run(['ssh','-i',self.config['ssh_key'],'-o','BatchMode=yes','root@'+self.config['nodes'][node]['host'],command],input=stdin,text=True,stdout=subprocess.PIPE,stderr=subprocess.PIPE,timeout=timeout)
  if p.returncode:
   logs=pathlib.Path.home()/'.local/state/aistar-deploy';logs.mkdir(mode=0o700,parents=True,exist_ok=True);logs.chmod(0o700);diagnostic=logs/'last-ssh-error-private.log';diagnostic.write_text(p.stdout+p.stderr);diagnostic.chmod(0o600)
  require(p.returncode==0,'节点操作失败：'+node+'；未继续切流。请读取节点私有日志');return p.stdout
 def action(self,node,action,release=None):
  cmd=[self.config['operation_python'],'-s',self.config['root']+'/control/node.py','--mode',self.mode,'--action',action]
  if release:cmd+=['--release',release]
  result=json.loads(self.ssh(node,shlex.join(cmd)));self.record(action,node=node,**({k:result[k] for k in ['release','sha','drain_seconds'] if k in result}));return result
 def alb(self,action,args):
  p=subprocess.run(['aliyun','alb',action,'--RegionId',self.config['region'],'--force',*args],capture_output=True,text=True,timeout=60)
  require(p.returncode==0,'ALB操作失败；停止发布');return json.loads(p.stdout)
 def members(self):
  group=self.expected['group'];require(group and group!=self.config['modes']['stage' if self.mode=='production' else 'production']['group'],'正式与演练ALB组缺失或混用')
  groups=self.alb('ListServerGroups',['--ServerGroupIds.1',group])['ServerGroups'];require(len(groups)==1 and groups[0].get('AlbId',self.config['load_balancer_id'])==self.config['load_balancer_id'],'ALB身份不符')
  alb_guard(groups[0],self.expected,self.config['drain_seconds'])
  rows=self.alb('ListServerGroupServers',['--ServerGroupId',group])['Servers'];require(len(rows)==2 and {x['ServerId'] for x in rows}=={x['instance_id'] for x in self.config['nodes'].values()} and all(x['Port']==80 for x in rows),'ALB后端身份/端口不符')
  return {next(n for n,v in self.config['nodes'].items() if v['instance_id']==x['ServerId']):x for x in rows}
 def weights(self,w):
  self.members();args=['--ServerGroupId',self.expected['group']]
  for i,(name,node) in enumerate(self.config['nodes'].items(),1):args+=['--Servers.'+str(i)+'.ServerId',node['instance_id'],'--Servers.'+str(i)+'.ServerType','Ecs','--Servers.'+str(i)+'.Port','80','--Servers.'+str(i)+'.Weight',str(w[name])]
  self.alb('UpdateServerGroupServersAttribute',args)
  for _ in range(45):
   rows=self.members()
   if all(int(rows[n]['Weight'])==w[n] and rows[n]['Status']=='Available' for n in w):self.record('weights',weights=w);return
   time.sleep(1)
  raise RuntimeError('ALB权重未收敛')
 def probe(self,node=None,authenticated=True):
  # Strict TLS on both ALB VIPs, exact host and private probe header. Never trust HTTP 200 alone.
  path=pathlib.Path(self.probe_file);require(path.stat().st_mode&0o777==0o600,'探针配置必须0600');secret=json.loads(path.read_text());require(secret['host']==self.expected['host'],'探针Host与模式不匹配')
  if authenticated:require(secret.get('token') and secret.get('subject_id'),'缺少跨节点鉴权验收token和目标身份')
  for ip in self.config['verify_ips']:
   host=self.expected['host'];c=http.client.HTTPSConnection(host,timeout=12,context=ssl.create_default_context())
   c.sock=c._context.wrap_socket(socket.create_connection((ip,443),timeout=12),server_hostname=host)
   c.request('GET','/internal/ready',headers={secret['header']:secret['key']});r=c.getresponse();data=json.loads(r.read());observed=r.getheader('X-Aistar-Node');c.close();require(node is None or observed==node,'ALB实际服务节点与目标不一致，禁止停止旧主');require(r.status==200 and data.get('ready') is True,'ALB严格TLS就绪验收失败')
   if authenticated:
    c=http.client.HTTPSConnection(host,timeout=12,context=ssl.create_default_context());c.sock=c._context.wrap_socket(socket.create_connection((ip,443),timeout=12),server_hostname=host);c.request('GET','/api/admin/auth/me',headers={secret['header']:secret['key'],'Authorization':'Bearer '+secret['token']});r=c.getresponse();d=json.loads(r.read());observed=r.getheader('X-Aistar-Node');c.close();require(node is None or observed==node,'鉴权请求未由目标节点承接');require(r.status==200 and d.get('data',{}).get('id')==secret['subject_id'],'ALB跨机鉴权身份验收失败')
  if node:self.record('alb_ready',node=node)
 def install(self,bundle,release):
  # Only our new cluster namespace. Never extract arbitrary archive entries.
  digest=hashlib.sha256(bundle.read_bytes()).hexdigest();remote=self.config['root']
  with tarfile.open(bundle) as t:
   for x in t.getmembers():require(x.isfile() and not x.name.startswith('/') and '..' not in pathlib.PurePosixPath(x.name).parts,'发布包只能包含常规相对文件')
  for n in self.config['nodes']:
   self.ssh(n,'install -d -m 700 '+remote+'/control '+remote+'/incoming '+remote+'/releases')
   for local,dest in [(bundle,remote+'/incoming/'+release+'.tar.gz'),(ROOT/'infra/cluster/production.json',remote+'/control/config.json'),(pathlib.Path(__file__).with_name('node.py'),remote+'/control/node.py'),(pathlib.Path(__file__).with_name('policy.py'),remote+'/control/policy.py')]:
    if local==bundle:
     existing=self.ssh(n,'sha256sum '+shlex.quote(dest)+' 2>/dev/null || true').split()
     if existing and existing[0]==digest:continue
    p=subprocess.run(['scp','-q','-i',self.config['ssh_key'],'-o','BatchMode=yes',str(local),'root@'+self.config['nodes'][n]['host']+':'+dest],capture_output=True,text=True,timeout=180);require(p.returncode==0,'私有SSH传输失败')
   code="import pathlib,hashlib,tarfile,os;os.umask(0o022);p=pathlib.Path("+repr(remote+'/incoming/'+release+'.tar.gz')+");assert hashlib.sha256(p.read_bytes()).hexdigest()=="+repr(digest)+";d=pathlib.Path("+repr(remote+'/releases/'+release)+");t=tarfile.open(p);members=t.getmembers();assert all(x.isfile() and not x.name.startswith('/') and '..' not in pathlib.PurePosixPath(x.name).parts for x in members);existing=d.exists();assert not existing or all((d/x.name).is_file() and hashlib.sha256((d/x.name).read_bytes()).digest()==hashlib.sha256(t.extractfile(x).read()).digest() for x in members),'不可变发布内容变化';d.mkdir(mode=0o755,exist_ok=True);t.extractall(d) if not existing else None;[(x.chmod(0o755 if x.is_dir() else 0o444)) for x in [d,*d.rglob('*')]]"
   self.ssh(n,shlex.join([self.config['operation_python'],'-s','-c',code]));self.action(n,'prepare',release)
 def rolling(self,release):
  rows=self.members();require(int(rows['a']['Weight'])==100 and int(rows['b']['Weight'])==0,'必须从A100/B0开始；异常状态先核对，禁止盲目重试')
  primary=self.action('a','inspect');standby=self.action('b','inspect');require(not primary['quiescing'],'主节点已在排空')
  # Verify candidate on BOTH nodes before stopping anything.
  for n in ['a','b']:self.action(n,'prepare',release)
  old_primary_safe=True
  try:
   self.action('b','drain-stop');self.action('b','start',release)
   # Check real per-node process/config before moving the group. Private TLS acceptance then gates old-primary restart.
   self.weights({'a':0,'b':100});time.sleep(16)
   self.probe('b');self.action('b','inspect')
   old_primary_safe=False
   self.action('a','drain-stop');self.action('a','start',release)
   self.weights({'a':100,'b':0});time.sleep(16);self.probe('a')
   final={n:self.action(n,'inspect') for n in ['a','b']};require(all(x['release']==release for x in final.values()),'双机发布不一致');self.record('rolling_complete');return final
  except Exception:
   survivor='a' if old_primary_safe else 'b'
   current=self.action(survivor,'inspect');require(not current['quiescing'],'没有可自动恢复权重的已知健康节点，保留现场')
   self.weights({'a':100 if survivor=='a' else 0,'b':100 if survivor=='b' else 0});self.probe(survivor);self.record('failure_preserved_serving_node',node=survivor)
   raise


def main():
 p=argparse.ArgumentParser();p.add_argument('--stage',action='store_true');p.add_argument('--bundle');p.add_argument('--release');p.add_argument('--probe-file');p.add_argument('--receipt');p.add_argument('--plan',action='store_true');p.add_argument('--prepare-only',action='store_true');p.add_argument('--bootstrap-stage',action='store_true');a=p.parse_args();os.umask(0o077)
 config=json.loads((ROOT/'infra/cluster/production.json').read_text());mode='stage' if a.stage else 'production';config_guard(config,mode,os.environ)
 if a.plan:print(json.dumps({'mode':mode,'nodes':config['nodes'],'flow':'prepare B -> drain B -> start B -> B100 -> drain A >=180s -> start A -> A100/B0','production_activation_required':True,'database_and_dns_changed':False},ensure_ascii=False,indent=2));return
 require(a.release and a.bundle and a.receipt,'需要已验收不可变发布包、release和凭证路径');require(not pathlib.Path(a.receipt).exists(),'拒绝覆盖验收凭证')
 require(a.release.isalnum() and len(a.release)==16,'release标识错误')
 if a.bootstrap_stage:require(mode=='stage','初始化仅允许隔离演练')
 cluster=Cluster(config,mode);cluster.probe_file=a.probe_file
 # Fail before any mutation unless production has already been activated on BOTH nodes.
 if mode=='production':
  for n in config['nodes']:cluster.action(n,'inspect')
 # Cluster-wide lock is held by a live SSH flock process, released when this process exits.
 lockcmd=shlex.join(['flock','-n','/run/lock/aistar-cluster-release.lock','sh','-c','printf locked; cat >/dev/null'])
 lock=subprocess.Popen(['ssh','-i',config['ssh_key'],'-o','BatchMode=yes','root@'+config['nodes']['a']['host'],lockcmd],stdin=subprocess.PIPE,stdout=subprocess.PIPE,stderr=subprocess.PIPE)
 require(lock.stdout.read(6)==b'locked','已有发布运行，不接管')
 try:
  cluster.install(pathlib.Path(a.bundle).resolve(),a.release)
  if a.prepare_only:result={'prepared':True}
  elif a.bootstrap_stage:
   result={n:cluster.action(n,'start',a.release) for n in ['a','b']};cluster.weights({'a':100,'b':0});time.sleep(16);cluster.probe(authenticated=False);cluster.record('bootstrap_complete')
  else:require(a.probe_file,'缺少受保护TLS探针配置');result=cluster.rolling(a.release)
  receipt={'completed_utc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'mode':mode,'events':cluster.events,'result':result,'database_changed':False,'dns_changed':False};pathlib.Path(a.receipt).write_text(json.dumps(receipt,indent=2))
 finally:lock.stdin.close();lock.wait(timeout=15)
if __name__=='__main__':
 try:main()
 except Exception as e:print('发布中止：'+str(e),file=sys.stderr);sys.exit(1)
