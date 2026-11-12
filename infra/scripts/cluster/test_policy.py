import copy,datetime,importlib.util,json,pathlib,sys,unittest
sys.path.insert(0,str(pathlib.Path(__file__).parent))
from policy import *
class PolicyTests(unittest.TestCase):
 def setUp(self):self.cfg=json.loads((pathlib.Path(__file__).resolve().parents[2]/'cluster/production.json').read_text());self.expected=self.cfg['modes']['stage'];self.env={'DB_URL':'jdbc:postgresql://'+RDS+':5432/aistar_schema_rehearsal?sslmode=verify-full&currentSchema=aistar_api_rehearsal','DB_USERNAME':'aistar_runtime','AEP_SMS_TAIR_URL':'rediss://'+TAIR+':6379/14','SPRING_PROFILES_ACTIVE':'postgres','AEP_BACKGROUND_ENABLED':'false','SERVER_ADDRESS':'127.0.0.1','SERVER_PORT':'18084','AEP_DEPLOYMENT_TOKEN':'x'*48}
 def test_exact_stage(self):config_guard(self.cfg,'stage',{});environment_guard(self.env,'stage',self.expected)
 def test_legacy_overrides_refused(self):
  for k in ['DEPLOY_HOST','ECS_HOST','REMOTE_ROOT','PUBLIC_BASE']:
   with self.subTest(k=k),self.assertRaises(Refused):config_guard(self.cfg,'production',{k:'old'})
 def test_wrong_resources_refused(self):
  for k,v in [('DB_URL',self.env['DB_URL'].replace('aistar_schema_rehearsal','aistar_prod')),('DB_URL',self.env['DB_URL'].replace('verify-full','require')),('DB_USERNAME','aistar_app'),('AEP_SMS_TAIR_URL',self.env['AEP_SMS_TAIR_URL'].replace('/14','/15')),('AEP_BACKGROUND_ENABLED','true'),('SERVER_ADDRESS','0.0.0.0'),('SERVER_PORT','8080'),('AEP_DEPLOYMENT_TOKEN','short')]:
   with self.subTest(k=k,v=v),self.assertRaises(Refused):environment_guard({**self.env,k:v},'stage',self.expected)
 def test_crypto_contract_drift_refused(self):
  c={'format':'aistar-runtime-contract-v1','environment_value_hashes':{k:hashlib.sha256(v.encode()).hexdigest() for k,v in self.env.items()}}
  contract_guard(self.env,c)
  with self.assertRaises(Refused):contract_guard({**self.env,'AEP_SECRET_KEY':'drift'},c)
 def test_alb_sticky_and_drain_misconfiguration_refused(self):
  good={'StickySessionConfig':{'StickySessionEnabled':False},'ConnectionDrainConfig':{'ConnectionDrainEnabled':True,'ConnectionDrainTimeout':180},'HealthCheckConfig':{'HealthCheckEnabled':True,'HealthCheckPath':'/internal/ready','HealthCheckHost':self.expected['host'],'HealthCheckProtocol':'HTTP'}}
  alb_guard(good,self.expected,180)
  for section,key,value in [('StickySessionConfig','StickySessionEnabled',True),('ConnectionDrainConfig','ConnectionDrainEnabled',False),('ConnectionDrainConfig','ConnectionDrainTimeout',10),('HealthCheckConfig','HealthCheckHost','wrong'),('HealthCheckConfig','HealthCheckPath','/')]:
   bad=copy.deepcopy(good);bad[section][key]=value
   with self.subTest(section=section,key=key),self.assertRaises(Refused):alb_guard(bad,self.expected,180)
 def test_unaccepted_artifact_refused(self):
  with self.assertRaises(Refused):artifact_guard({'format':'aistar-cluster-artifact-v1','sha':'a'*40,'jar_sha256':'a'*64,'tests_passed':False})
 def test_production_window_is_not_inferred(self):
  p={'format':'aistar-import-permit-v1','rds_host':RDS,'database':'aistar_prod','role':'aistar_migrator','table_count':195,'flyway_version':'79','production_authorized':False}
  with self.assertRaises(Refused):import_plan_guard(p,'production')
 def test_drill_cannot_use_production(self):
  p={'format':'aistar-import-permit-v1','rds_host':RDS,'database':'aistar_prod','role':'aistar_rehearsal','table_count':195,'flyway_version':'79','purpose':'aistar-cutover-drill'}
  with self.assertRaises(Refused):import_plan_guard(p,'drill')
 def test_previous_schema_contract_is_refused(self):
  p={'format':'aistar-import-permit-v1','rds_host':RDS,'database':'aistar_cutover_drill','role':'aistar_rehearsal','table_count':195,'flyway_version':'79','purpose':'aistar-cutover-drill'}
  import_plan_guard(p,'drill')
  for key,value in [('table_count',192),('flyway_version','77'),('flyway_version','78')]:
   with self.subTest(key=key),self.assertRaises(Refused):import_plan_guard({**p,key:value},'drill')
class SourceFreezeTests(unittest.TestCase):
 def test_pending_proof_cannot_omit_between_step_plans(self):
  pending={name:0 for name in PENDING_WORK};pending_work_guard(pending)
  for mutate in [lambda p:p.pop('ip_plan_execution'),lambda p:p.update(ip_plan_execution=1),lambda p:p.update(ip_run=False),lambda p:p.pop('video_asset_person'),lambda p:p.update(video_asset_portrait=1)]:
   candidate=dict(pending);mutate(candidate)
   with self.assertRaises(Refused):pending_work_guard(candidate)
 def test_source_freeze_requires_complete_fresh_proof(self):
  path=pathlib.Path(__file__).resolve().parents[2]/'migration/freeze_source.py';spec=importlib.util.spec_from_file_location('source_freeze',path);module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module)
  self.assertEqual(set(PENDING_WORK),set(module.PENDING_WORK));plan={'pending_work':{name:0 for name in PENDING_WORK},'drain_checked_epoch':1000};module.check_pending(plan,1001)
  for when in [1061,997]:
   with self.assertRaises(RuntimeError):module.check_pending(plan,when)
  plan['pending_work'].pop('ip_plan_execution')
  with self.assertRaises(RuntimeError):module.check_pending(plan,1001)

class ContainerRetirementTests(unittest.TestCase):
 def exercise(self,row,port_open=False):
  import node,tempfile
  from unittest.mock import patch
  manifest={'format':'aistar-cluster-artifact-v1','sha':'a'*40,'jar_sha256':'b'*64,'tests_passed':True,'image_configuration_id':'sha256:'+'c'*64,'archive_sha256':'d'*64,'source_tree':'tree','migrations':[{'name':'V74__schema.sql','sha256':'e'*64}]};calls=[]
  with tempfile.TemporaryDirectory() as directory:
   root=pathlib.Path(directory);release=root/'releases'/('1'*16);release.mkdir(parents=True);(root/'control').mkdir();(release/'manifest.json').write_text(json.dumps(manifest))
   def invoke(args):
    if args[:2]==['podman','ps']:return json.dumps([row])
    calls.append(args);return ''
   with patch.object(node,'ROOT',root),patch.object(node,'run',invoke),patch.object(node.socket,'socket') as sock:
    sock.return_value.__enter__.return_value.connect_ex.return_value=0 if port_open else 111
    try:node.retire_exited_owned_container({'unit':'owned','port':18084},'stage')
    except Refused:return False,calls
   return True,calls
 def row(self):return {'Names':['owned'],'Id':'f'*64,'Pid':0,'Exited':True,'ImageID':'c'*64,'Labels':{'aistar.mode':'stage','aistar.release':'1'*16,'aistar.sha':'a'*40}}
 def test_live_container_never_removed(self):
  row=self.row();row.update(Pid=123,Exited=False);success,calls=self.exercise(row);self.assertFalse(success);self.assertEqual([],calls)
 def test_unknown_container_never_removed(self):
  row=self.row();row['Labels']['aistar.mode']='other';success,calls=self.exercise(row);self.assertFalse(success);self.assertEqual([],calls)
 def test_listening_port_prevents_retirement(self):
  success,calls=self.exercise(self.row(),True);self.assertFalse(success);self.assertEqual([],calls)
 def test_only_verified_exited_container_is_retired(self):
  success,calls=self.exercise(self.row());self.assertTrue(success);self.assertEqual([['podman','rm','--force','f'*64]],calls)

class ApiTemporaryStorageTests(unittest.TestCase):
 def test_api_modes_use_separate_private_disk_directories(self):
  import node,tempfile
  from unittest.mock import patch
  with tempfile.TemporaryDirectory() as directory:
   root=pathlib.Path(directory);(root/'state').mkdir()
   with patch.object(node,'ROOT',root),patch.object(node.os,'chown') as chown:
    for mode in ('production','stage'):
     path=root/'state'/(mode+'-api-tmp')
     self.assertEqual(node.api_temp_volume(mode),str(path)+':/tmp:rw')
     chown.assert_called_with(path,10001,10001)
     self.assertEqual(path.stat().st_mode&0o777,0o700)

class ApiDrainTests(unittest.TestCase):
 def test_shared_jobs_do_not_block_a_drained_api_node(self):
  import node
  status={'quiescing':True,'in_flight':0,'executor_active':0,'executor_queued':0,'scheduled_active':0,
          'pending_work':{'material_video_job':7,'ip_plan_execution':2},'drained':False}
  self.assertTrue(node.api_locally_drained(status))
  for key,value in [('quiescing',False),('in_flight',1),('executor_active',1),('executor_queued',1),
                    ('scheduled_active',1),('in_flight',False),('executor_active',None)]:
   with self.subTest(key=key,value=value):
    self.assertFalse(node.api_locally_drained({**status,key:value}))
 def test_production_waits_for_three_empty_socket_samples_instead_of_a_fixed_delay(self):
  import node
  from unittest.mock import patch
  status={'quiescing':True,'in_flight':0,'executor_active':0,'executor_queued':0,'scheduled_active':0,
          'pending_work':{'material_video_job':7},'drained':False}
  with patch.object(node,'inspect'),patch.object(node,'ops',return_value=status), \
       patch.object(node.time,'monotonic',return_value=0),patch.object(node.time,'sleep'), \
       patch.object(node,'run',side_effect=['open socket','','','','']) as run:
   result=node.drain_stop({'drain_timeout_seconds':1800,'drain_seconds':180},
                         {'port':8080,'unit':'aistar-api'},'production',{})
  self.assertEqual(result['drain_scope'],'api-node')
  self.assertEqual(run.call_count,5)
  run.assert_called_with(['systemctl','stop','aistar-api'])

class RollingReleaseTests(unittest.TestCase):
 def cluster(self,initial):
  import release
  cluster=object.__new__(release.Cluster)
  cluster.config={'nodes':{'a':{},'b':{}}}
  cluster.mode='production'
  cluster.events=[]
  cluster.calls=[]
  cluster.current_weights=dict(initial)
  cluster.releases={'a':'previous','b':'previous'}
  cluster.quiescing={'a':False,'b':False}
  cluster.members=lambda:{node:{'Weight':weight} for node,weight in cluster.current_weights.items()}
  def action(node,operation,revision=None):
   cluster.calls.append((operation,node))
   if operation=='drain-stop':
    self.assertEqual(cluster.current_weights[node],0)
    self.assertEqual(sum(cluster.current_weights.values()),100)
   elif operation=='start':
    cluster.releases[node]=revision
    cluster.quiescing[node]=False
   return {'quiescing':cluster.quiescing[node],'release':cluster.releases[node]}
  def weights(values):
   cluster.current_weights=dict(values)
   cluster.calls.append(('weights',dict(values)))
  def probe(node):
   self.assertEqual(cluster.current_weights[node],100)
   cluster.calls.append(('probe',node))
  cluster.action=action
  cluster.weights=weights
  cluster.probe=probe
  cluster.probe_dual=lambda:cluster.calls.append(('dual',dict(cluster.current_weights)))
  cluster.probe_standby=lambda n:cluster.calls.append(('standby probe',n))
  cluster.install=lambda b,r,nodes:cluster.calls.append(('install',tuple(nodes)))
  cluster.record=lambda *args,**kwargs:None
  return cluster
 def test_dual_active_roll_drains_only_weight_zero_and_restores_dual(self):
  from unittest.mock import patch
  cluster=self.cluster({'a':50,'b':50})
  with patch('release.time.sleep'):
   result=cluster.rolling('candidate')
  self.assertEqual({k:v['release'] for k,v in result.items()},{'a':'candidate','b':'candidate'})
  traffic=[x for x in cluster.calls if x[0] in ('dual','weights','probe','drain-stop','start')]
  self.assertEqual(traffic,[
   ('dual',{'a':50,'b':50}),('weights',{'a':100,'b':0}),('probe','a'),('drain-stop','b'),('start','b'),
   ('weights',{'a':0,'b':100}),('probe','b'),('drain-stop','a'),('start','a'),
   ('weights',{'a':50,'b':50}),('dual',{'a':50,'b':50})])
 def test_degraded_b_first_roll_preserves_serving_b(self):
  from unittest.mock import patch
  cluster=self.cluster({'a':0,'b':100})
  with patch('release.time.sleep'):
   cluster.rolling('candidate')
  self.assertEqual([x for x in cluster.calls if x[0]=='drain-stop'],[('drain-stop','a'),('drain-stop','b')])
  self.assertEqual(cluster.current_weights,{'a':50,'b':50})
 def test_publish_drained_standby_keeps_previous_version_ready(self):
  from unittest.mock import patch
  cluster=self.cluster({'a':100,'b':0})
  cluster.quiescing['b']=True
  with patch('release.time.sleep'):
   result=cluster.publish_to_standby('bundle','candidate')
  self.assertEqual([x for x in cluster.calls if x[0]=='install'],[('install',('b',))])
  self.assertEqual([x for x in cluster.calls if x[0]=='drain-stop'],[('drain-stop','b')])
  self.assertLess(cluster.calls.index(('standby probe','b')),cluster.calls.index(('weights',{'a':0,'b':100})))
  self.assertEqual(result['a']['release'],'previous')
  self.assertEqual(result['b']['release'],'candidate')
  self.assertEqual(cluster.current_weights,{'a':0,'b':100})
 def test_failed_cutover_retains_previous_active(self):
  from unittest.mock import patch
  cluster=self.cluster({'a':0,'b':100})
  probe=cluster.probe
  def fail_a(node):
   if node=='a':raise RuntimeError('candidate VIP probe failed')
   return probe(node)
  cluster.probe=fail_a
  with patch('release.time.sleep'),self.assertRaisesRegex(RuntimeError,'candidate VIP probe failed'):
   cluster.publish_to_standby('bundle','candidate')
  self.assertEqual(cluster.current_weights,{'a':0,'b':100})
  self.assertNotIn(('drain-stop','b'),cluster.calls)
 def test_cutover_waits_only_until_vips_converge(self):
  from unittest.mock import patch
  cluster=self.cluster({'a':100,'b':0})
  probe=cluster.probe
  attempts=0
  def eventual_probe(node):
   nonlocal attempts
   if node=='b':
    attempts+=1
    if attempts==1:
     raise Refused('VIP still serves A')
   return probe(node)
  cluster.probe=eventual_probe
  with patch('release.time.sleep') as sleep:
   cluster.publish_to_standby('bundle','candidate')
  sleep.assert_called_once_with(2)
  self.assertEqual(cluster.current_weights,{'a':0,'b':100})
 def test_repeating_current_release_does_not_switch_again(self):
  cluster=self.cluster({'a':0,'b':100})
  cluster.releases['b']='candidate'
  cluster.publish_to_standby('bundle','candidate')
  self.assertEqual(cluster.current_weights,{'a':0,'b':100})
  self.assertFalse(any(action in ('install','weights','start') for action,_ in cluster.calls))
 def test_runtime_refresh_recreates_only_the_standby_with_the_same_artifact(self):
  cluster=self.cluster({'a':100,'b':0})
  cluster.releases={'a':'candidate','b':'candidate'}
  cluster.publish_to_standby('bundle','candidate',refresh_runtime=True)
  self.assertEqual([x for x in cluster.calls if x[0]=='install'],[('install',('b',))])
  self.assertEqual([x for x in cluster.calls if x[0] in ('drain-stop','start')],
                   [('drain-stop','b'),('start','b')])
  self.assertLess(cluster.calls.index(('standby probe','b')),cluster.calls.index(('weights',{'a':0,'b':100})))
  self.assertEqual(cluster.current_weights,{'a':0,'b':100})
 def test_runtime_refresh_rejects_a_different_artifact(self):
  cluster=self.cluster({'a':100,'b':0})
  with self.assertRaisesRegex(Refused,'仅可用当前承流制品'):
   cluster.publish_to_standby('bundle','candidate',refresh_runtime=True)
  self.assertEqual(cluster.calls,[('inspect','a')])
 def test_runtime_probe_checks_readiness_and_admin_access_on_each_vip(self):
  import release
  from unittest.mock import Mock,call
  cluster=release.Cluster({'nodes':{'a':{},'b':{}},'verify_ips':['first','second'],
                           'modes':{'production':{}}},'production')
  cluster.runtime_probe=True
  cluster.request_vip=Mock(side_effect=[(200,{'ready':True},'b'),(401,{'error':{'code':'UNAUTHORIZED'}},'b')]*2)
  self.assertEqual(cluster.probe('b'),{'first':{'b'},'second':{'b'}})
  self.assertEqual(cluster.request_vip.call_args_list,
                   [call(ip,path,{}) for ip in ('first','second') for path in ('/internal/ready','/api/admin/auth/me')])
 def test_runtime_probe_refuses_wrong_node_or_admin_route_without_access_control(self):
  import release
  from unittest.mock import Mock
  cluster=release.Cluster({'nodes':{'a':{},'b':{}},'verify_ips':['first'],
                           'modes':{'production':{}}},'production')
  cluster.runtime_probe=True
  for admin_response in ((401,{'error':{'code':'UNAUTHORIZED'}},'a'),(200,{'success':True},'b')):
   with self.subTest(admin_response=admin_response),self.assertRaises(Refused):
    cluster.request_vip=Mock(side_effect=[(200,{'ready':True},'b'),admin_response])
    cluster.probe('b')
 def test_quiescing_node_with_live_weight_refuses_to_roll(self):
  cluster=self.cluster({'a':50,'b':50})
  cluster.quiescing['b']=True
  with self.assertRaisesRegex(Refused,'备用节点仍在承流且正在排空'):
   cluster.publish_to_standby('bundle','candidate')
  self.assertEqual(cluster.calls,[('inspect','a'),('inspect','b')])
 def test_first_update_failure_restores_original_serving_a(self):
  self.check_failure('b','start','a')
 def test_second_update_failure_preserves_verified_b(self):
  self.check_failure('a','start','b')
 def test_second_drain_failure_preserves_verified_b(self):
  self.check_failure('a','drain-stop','b')
 def check_failure(self,node,operation,survivor):
  from unittest.mock import patch
  cluster=self.cluster({'a':50,'b':50})
  action=cluster.action
  def failing(n,a,r=None):
   if (n,a)==(node,operation):raise RuntimeError('synthetic failure')
   return action(n,a,r)
  cluster.action=failing
  with patch('release.time.sleep'),self.assertRaisesRegex(RuntimeError,'synthetic failure'):
   cluster.rolling('candidate')
  self.assertEqual(cluster.current_weights,{n:100 if n==survivor else 0 for n in ('a','b')})
  if node=='b':self.assertNotIn(('drain-stop','a'),cluster.calls)
 def test_dual_probe_requires_both_nodes_on_each_vip(self):
  import release
  cluster=object.__new__(release.Cluster)
  cluster.config={'verify_ips':['first','second'],'nodes':{'a':{},'b':{}}}
  cluster.probe=lambda authenticated=True,check_readiness=True:{'first':{'a','b'},'second':{'a'}}
  with self.assertRaisesRegex(RuntimeError,'双活验收失败'):cluster.probe_dual()
class FrontendCutoverTests(unittest.TestCase):
 def test_routes_can_arrive_before_health_and_both_are_recorded(self):
  import frontend
  from types import SimpleNamespace
  from unittest.mock import Mock, patch
  def health(statuses):
   return {'RuleHealthStatus':[{'ServerGroupInfos':[
    {'ServerGroupId':'front','HealthCheckEnabled':'on','NonNormalServers':statuses}
   ]}]}
  cluster=SimpleNamespace(config={'nodes':{'a':{'instance_id':'id-a'}}},
   expected={'group':'front'},record=Mock(),alb=Mock(side_effect=[
    health([{'ServerId':'id-a','Status':'Initial'}]),
    health([{'ServerId':'id-b','Status':'Unused'}]),
   ]))
  probe=Mock(return_value=[('vip-1','front','/video',200,'a'),('vip-2','front','/video',200,'a')])
  with patch('frontend.time.sleep') as sleep:
   frontend.verify_frontend_serving(cluster,'listener','a',{'web':'new'},probe)
  sleep.assert_called_once_with(2)
  self.assertEqual(probe.call_count,2)
  cluster.record.assert_any_call('front cutover observation',node='a',
   routes={'count':2,'other_nodes':[]},health={'ready':False,'statuses':['Initial']})
  cluster.record.assert_called_with('front single node verified',node='a',builds={'web':'new'},routes=2)
class ReleaseLeaseTests(unittest.TestCase):
 def test_disconnected_lease_refuses_cluster_mutations(self):
  import release
  from unittest.mock import Mock
  cluster=object.__new__(release.Cluster)
  cluster.release_lock=Mock()
  cluster.release_lock.poll.return_value=255
  with self.assertRaisesRegex(Refused,'发布锁连接已断开'):cluster.check_lease()
 def test_unresponsive_own_ssh_is_terminated_to_release_flock(self):
  import release
  from unittest.mock import Mock
  lock=Mock()
  lock.wait.side_effect=[release.subprocess.TimeoutExpired('ssh',15),0]
  release.release_lease(lock)
  lock.stdin.close.assert_called_once_with()
  lock.terminate.assert_called_once_with()
  lock.kill.assert_not_called()
if __name__=='__main__':unittest.main()
