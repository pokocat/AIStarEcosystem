#!/usr/bin/env python3
"""ALB dual-active rolling release; no database import, DNS changes, or legacy-host fallback."""
import argparse,datetime,hashlib,json,os,pathlib,re,select,shlex,subprocess,sys,time,tarfile
from policy import Refused,config_guard,artifact_guard,alb_guard,require
ROOT=pathlib.Path(__file__).resolve().parents[3]
DUAL_ACTIVE={'a':50,'b':50}
SINGLE_NODE={'a':{'a':100,'b':0},'b':{'a':0,'b':100}}
class Cluster:
 def __init__(self,config,mode):self.config=config;self.mode=mode;self.expected=config['modes'][mode];self.events=[]
 def record(self,event,**kw):self.events.append({'utc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'event':event,**kw});print(event,flush=True)
 def check_lease(self):
  lock=getattr(self,'release_lock',None)
  require(lock is None or lock.poll() is None,'发布锁连接已断开，保留当前承流节点，停止继续变更')
 def ssh(self,node,command,timeout=2100,stdin=None):
  self.check_lease()
  p=subprocess.run(['ssh','-i',self.config['ssh_key'],'-o','BatchMode=yes','-o','ConnectTimeout=8','-o','ConnectionAttempts=2','root@'+self.config['nodes'][node]['host'],command],input=stdin,text=True,stdout=subprocess.PIPE,stderr=subprocess.PIPE,timeout=timeout)
  if p.returncode:
   logs=pathlib.Path.home()/'.local/state/aistar-deploy';logs.mkdir(mode=0o700,parents=True,exist_ok=True);logs.chmod(0o700);diagnostic=logs/'last-ssh-error-private.log';diagnostic.write_text(p.stdout+p.stderr);diagnostic.chmod(0o600)
  require(p.returncode==0,'节点操作失败：'+node+'；未继续切流。请读取节点私有日志');return p.stdout
 def action(self,node,action,release=None):
  cmd=[self.config['operation_python'],'-s',self.config['root']+'/control/node.py','--mode',self.mode,'--action',action]
  if release:cmd+=['--release',release]
  result=json.loads(self.ssh(node,shlex.join(cmd)));self.record(action,node=node,**({k:result[k] for k in ['release','sha','drain_seconds','drain_scope'] if k in result}));return result
 def alb(self,action,args):
  self.check_lease()
  p=subprocess.run(['aliyun','alb',action,'--RegionId',self.config['region'],'--endpoint','alb.'+self.config['region']+'.aliyuncs.com','--force',*args],capture_output=True,text=True,timeout=60)
  if p.returncode:
   logs=pathlib.Path.home()/'.local/state/aistar-deploy'
   logs.mkdir(mode=0o700,parents=True,exist_ok=True);logs.chmod(0o700)
   diagnostic=logs/'last-alb-error-private.log'
   diagnostic.write_text(re.sub(r'https?://[^\s"<>]+','[redacted URL]',p.stderr));diagnostic.chmod(0o600)
  require(p.returncode==0,'ALB操作失败；停止发布')
  return json.loads(p.stdout)
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
 def request_vip(self,ip,path,headers):
  # Use the ECS network for the actual public TLS request. The laptop only
  # orchestrates the probe, so local VPN routing cannot change the ALB path.
  remote="""import http.client,json,socket,ssl,sys
p=json.load(sys.stdin)
ctx=ssl.create_default_context()
connection=http.client.HTTPSConnection(p['host'],timeout=12,context=ctx)
try:
 connection.sock=ctx.wrap_socket(socket.create_connection((p['ip'],443),timeout=12),server_hostname=p['host'])
 connection.request('GET',p['path'],headers=p['headers'])
 response=connection.getresponse()
 print(json.dumps([response.status,json.loads(response.read()),response.getheader('X-Aistar-Node')]))
finally:
 connection.close()
"""
  command=shlex.join([self.config['operation_python'],'-s','-c',remote])
  request={'host':self.expected['host'],'ip':ip,'path':path,'headers':headers}
  return json.loads(self.ssh('a',command,timeout=45,stdin=json.dumps(request)))
 def probe(self,node=None,authenticated=True,check_readiness=True):
  # Each VIP is contacted directly with the expected SNI and protected headers.
  path=pathlib.Path(self.probe_file)
  require(path.stat().st_mode&0o777==0o600,'探针配置必须0600')
  secret=json.loads(path.read_text())
  require(secret['host']==self.expected['host'],'探针Host与模式不匹配')
  if authenticated:require(secret.get('token') and secret.get('subject_id'),'缺少跨节点鉴权验收token和目标身份')
  require(authenticated or check_readiness,'缺少有效的ALB探测类型')
  accepted={node} if node else set(self.config['nodes'])
  headers={secret['header']:secret['key']}
  observed_by_vip={}
  for ip in self.config['verify_ips']:
   if check_readiness:
    status,data,observed=self.request_vip(ip,'/internal/ready',headers)
    require(observed in accepted,'ALB实际服务节点与目标不一致，禁止停止在用节点')
    require(status==200 and data.get('ready') is True,'ALB严格TLS就绪验收失败')
   if authenticated:
    auth_headers={**headers,'Authorization':'Bearer '+secret['token']}
    status,data,observed=self.request_vip(ip,'/api/admin/auth/me',auth_headers)
    require(observed in accepted,'鉴权请求未由目标节点承接')
    require(status==200 and data.get('data',{}).get('id')==secret['subject_id'],'ALB跨机鉴权身份验收失败')
   observed_by_vip[ip]={observed}
  if node:self.record('alb_ready',node=node)
  return observed_by_vip
 def probe_dual(self,authenticated=True):
  seen={ip:set() for ip in self.config['verify_ips']}
  expected_nodes=set(self.config['nodes'])
  if authenticated:self.probe(authenticated=False)
  # One measured request per VIP each round. Paired readiness/auth requests
  # can repeatedly sample the same auth backend under round-robin routing.
  for attempt in range(12):
   sample=self.probe(authenticated=authenticated,check_readiness=not authenticated)
   for ip,nodes in sample.items():seen[ip].update(nodes)
   if all(nodes==expected_nodes for nodes in seen.values()):
    self.record('alb_dual_active',authenticated=authenticated,observed={ip:sorted(nodes) for ip,nodes in seen.items()},samples_per_vip=attempt+1)
    return
  raise RuntimeError('双活验收失败：两个ALB VIP均须观测到双机响应')
 def probe_standby(self,node):
  path=pathlib.Path(self.probe_file)
  require(path.stat().st_mode&0o777==0o600,'探针配置必须0600')
  secret=json.loads(path.read_text())
  require(secret['host']==self.expected['host'] and secret.get('token') and secret.get('subject_id'),
          '缺少备用节点鉴权证据')
  remote="""import http.client,json,sys
p=json.load(sys.stdin)
connection=http.client.HTTPConnection('127.0.0.1',p['port'],timeout=12)
try:
 connection.request('GET','/api/admin/auth/me',headers={'Authorization':'Bearer '+p['token']})
 response=connection.getresponse()
 print(json.dumps(response.status==200 and json.loads(response.read()).get('data',{}).get('id')==p['subject_id']))
finally:
 connection.close()
"""
  command=shlex.join([self.config['operation_python'],'-s','-c',remote])
  request={k:secret[k] for k in ('token','subject_id')}
  require(json.loads(self.ssh(node,command,timeout=35,stdin=json.dumps({**request,'port':self.expected['port']}))) is True,
          '备用节点鉴权验收失败，保留原节点承流')
  self.record('standby_auth_ready',node=node)
 def select_serving(self,node):
  state=self.action(node,'inspect')
  require(not state['quiescing'],'待承流节点仍在排空')
  self.weights(SINGLE_NODE[node])
  if self.mode=='production':
   for attempt in range(8):
    try:
     self.probe(node)
     break
    except Refused:
     if attempt==7:raise
     time.sleep(2)
  else:
   time.sleep(16)
   self.probe(node)
  state=self.action(node,'inspect')
  require(not state['quiescing'],'承接流量的节点已在排空')
 def install(self,bundle,release,nodes):
  # Only our new cluster namespace. Never extract arbitrary archive entries.
  digest=hashlib.sha256(bundle.read_bytes()).hexdigest();remote=self.config['root']
  with tarfile.open(bundle) as t:
   for x in t.getmembers():require(x.isfile() and not x.name.startswith('/') and '..' not in pathlib.PurePosixPath(x.name).parts,'发布包只能包含常规相对文件')
  for n in nodes:
   self.ssh(n,'install -d -m 700 '+remote+'/control '+remote+'/incoming '+remote+'/releases')
   for local,dest in [(bundle,remote+'/incoming/'+release+'.tar.gz'),(ROOT/'infra/cluster/production.json',remote+'/control/config.json'),(pathlib.Path(__file__).with_name('node.py'),remote+'/control/node.py'),(pathlib.Path(__file__).with_name('policy.py'),remote+'/control/policy.py')]:
    if local==bundle:
     existing=self.ssh(n,'sha256sum '+shlex.quote(dest)+' 2>/dev/null || true').split()
     if existing and existing[0]==digest:continue
    p=subprocess.run(['scp','-q','-i',self.config['ssh_key'],'-o','BatchMode=yes','-o','ConnectTimeout=8','-o','ConnectionAttempts=2',str(local),'root@'+self.config['nodes'][n]['host']+':'+dest],capture_output=True,text=True,timeout=180);require(p.returncode==0,'私有SSH传输失败')
   code="import pathlib,hashlib,tarfile,os;os.umask(0o022);p=pathlib.Path("+repr(remote+'/incoming/'+release+'.tar.gz')+");assert hashlib.sha256(p.read_bytes()).hexdigest()=="+repr(digest)+";d=pathlib.Path("+repr(remote+'/releases/'+release)+");t=tarfile.open(p);members=t.getmembers();assert all(x.isfile() and not x.name.startswith('/') and '..' not in pathlib.PurePosixPath(x.name).parts for x in members);existing=d.exists();assert not existing or all((d/x.name).is_file() and hashlib.sha256((d/x.name).read_bytes()).digest()==hashlib.sha256(t.extractfile(x).read()).digest() for x in members),'不可变发布内容变化';d.mkdir(mode=0o755,exist_ok=True);t.extractall(d) if not existing else None;[(x.chmod(0o755 if x.is_dir() else 0o444)) for x in [d,*d.rglob('*')]]"
   self.ssh(n,shlex.join([self.config['operation_python'],'-s','-c',code]));self.action(n,'prepare',release)
 def rolling(self,release):
  rows=self.members()
  initial={node:int(row['Weight']) for node,row in rows.items()}
  require(initial in (DUAL_ACTIVE,*SINGLE_NODE.values()),'初始权重异常，禁止自动发布')
  before={node:self.action(node,'inspect') for node in self.config['nodes']}
  require(not any(state['quiescing'] for state in before.values()),'存在排空中的节点，禁止自动发布')
  for node in self.config['nodes']:self.action(node,'prepare',release)
  serving='b' if initial==SINGLE_NODE['b'] else 'a'
  first='a' if serving=='b' else 'b'
  if initial==DUAL_ACTIVE:self.probe_dual()
  try:
   self.select_serving(serving)
   self.action(first,'drain-stop')
   self.action(first,'start',release)
   self.select_serving(first)
   second=serving
   serving=first
   self.action(second,'drain-stop')
   self.action(second,'start',release)
   final={node:self.action(node,'inspect') for node in self.config['nodes']}
   require(all(x['release']==release and not x['quiescing'] for x in final.values()),'双机发布或排空状态不一致')
   self.weights(DUAL_ACTIVE)
   time.sleep(16)
   self.probe_dual()
   self.record('rolling_complete')
   return final
  except Exception:
   self.check_lease()
   current=self.action(serving,'inspect')
   require(not current['quiescing'],'没有可自动恢复权重的已知健康节点，保留现场')
   self.select_serving(serving)
   self.record('failure_preserved_serving_node',node=serving)
   raise

 def production_roles(self):
  initial={node:int(row['Weight']) for node,row in self.members().items()}
  require(initial in (DUAL_ACTIVE,*SINGLE_NODE.values()),'初始权重异常，禁止自动发布')
  active='b' if initial==SINGLE_NODE['b'] else 'a'
  standby='a' if active=='b' else 'b'
  return initial,active,standby

 def publish_to_standby(self,bundle,release):
  initial,active,standby=self.production_roles()
  previous=self.action(active,'inspect')
  require(not previous['quiescing'],'承流节点仍在排空，禁止自动发布')
  before=self.action(standby,'inspect')
  if initial==DUAL_ACTIVE:
   require(not before['quiescing'],'备用节点仍在承流且正在排空，禁止自动发布')
   self.probe_dual()
   self.select_serving(active)
  else:
   self.probe(active)
  if previous['release']==release:
   self.record('standby_release_already_live',active=active,standby=standby)
   return {active:previous,standby:before}

  if before['release']!=release or before['quiescing']:
   require({node:int(row['Weight']) for node,row in self.members().items()}==SINGLE_NODE[active],
           '备用节点仍在承流，禁止更新')
   self.install(bundle,release,[standby])
   self.action(standby,'drain-stop')
   self.action(standby,'start',release)
  candidate=self.action(standby,'inspect')
  require(candidate['release']==release and not candidate['quiescing'],'备用节点版本或运行状态不符')
  self.probe_standby(standby)
  try:
   self.select_serving(standby)
  except Exception:
   self.check_lease()
   self.select_serving(active)
   self.record('failure_preserved_serving_node',node=active)
   raise
  self.record('standby_cutover_complete',active=standby,standby=active,weights=SINGLE_NODE[standby])
  return {standby:candidate,active:previous}


def release_lease(lock):
 try:
  lock.stdin.close()
 except BrokenPipeError:
  pass
 try:
  lock.wait(timeout=15)
 except subprocess.TimeoutExpired:
  # Only terminate the SSH process this release started. Its remote flock is
  # released by disconnecting; a later release must still acquire its own lock.
  lock.terminate()
  try:
   lock.wait(timeout=5)
  except subprocess.TimeoutExpired:
   lock.kill()
   lock.wait(timeout=5)

def main():
 p=argparse.ArgumentParser();p.add_argument('--stage',action='store_true');p.add_argument('--bundle');p.add_argument('--release');p.add_argument('--probe-file');p.add_argument('--receipt');p.add_argument('--plan',action='store_true');p.add_argument('--prepare-only',action='store_true');p.add_argument('--bootstrap-stage',action='store_true');a=p.parse_args();os.umask(0o077)
 config=json.loads((ROOT/'infra/cluster/production.json').read_text());mode='stage' if a.stage else 'production';config_guard(config,mode,os.environ)
 if a.plan:
  flow=('verify active at 100 -> drain and update standby at 0 -> verify and switch standby to 100 -> retain previous active at 0'
        if mode=='production' else 'prepare both -> drain and update each peer -> verify both at 50/50')
  print(json.dumps({'mode':mode,'nodes':config['nodes'],'flow':flow,'production_activation_required':True,'database_and_dns_changed':False},ensure_ascii=False,indent=2));return
 require(a.release and a.bundle and a.receipt,'需要已验收不可变发布包、release和凭证路径');require(not pathlib.Path(a.receipt).exists(),'拒绝覆盖验收凭证')
 require(a.release.isalnum() and len(a.release)==16,'release标识错误')
 if a.bootstrap_stage:require(mode=='stage','初始化仅允许隔离演练')
 cluster=Cluster(config,mode);cluster.probe_file=a.probe_file
 # An upload-only run has no cutover preflight, so check production activation here.
 if mode=='production' and a.prepare_only:
  for n in config['nodes']:cluster.action(n,'inspect')
 # Cluster-wide lock is held by a live SSH flock process, released when this process exits.
 lockcmd=shlex.join(['flock','-n','/run/lock/aistar-cluster-release.lock','sh','-c','printf locked; cat >/dev/null'])
 lock=subprocess.Popen(['ssh','-i',config['ssh_key'],'-o','BatchMode=yes','-o','ConnectTimeout=8','-o','ConnectionAttempts=2',
     '-o','ServerAliveInterval=10','-o','ServerAliveCountMax=3','root@'+config['nodes']['a']['host'],lockcmd],
     stdin=subprocess.PIPE,stdout=subprocess.PIPE,stderr=subprocess.PIPE)
 try:
  ready=select.select([lock.stdout],[],[],23)[0]
  require(ready and os.read(lock.stdout.fileno(),6)==b'locked','无法取得发布锁，保持现有流量')
  cluster.release_lock=lock
  cluster.check_lease()
  bundle=pathlib.Path(a.bundle).resolve()
  if mode=='stage' or a.prepare_only:
   nodes=config['nodes'] if mode=='stage' else [cluster.production_roles()[2]]
   cluster.install(bundle,a.release,nodes)
  if a.prepare_only:result={'prepared':True}
  elif a.bootstrap_stage:
   result={n:cluster.action(n,'start',a.release) for n in ['a','b']};cluster.weights(DUAL_ACTIVE);time.sleep(16);cluster.probe_dual(authenticated=False);cluster.record('bootstrap_complete')
  else:
   require(a.probe_file,'缺少受保护TLS探针配置')
   result=cluster.publish_to_standby(bundle,a.release) if mode=='production' else cluster.rolling(a.release)
  receipt={'completed_utc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'mode':mode,'events':cluster.events,'result':result,'database_changed':False,'dns_changed':False};pathlib.Path(a.receipt).write_text(json.dumps(receipt,indent=2))
 finally:release_lease(lock)
if __name__=='__main__':
 try:main()
 except Exception as e:print('发布中止：'+str(e),file=sys.stderr);sys.exit(1)
