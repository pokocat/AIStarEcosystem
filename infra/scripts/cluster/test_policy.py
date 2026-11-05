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
  p={'format':'aistar-import-permit-v1','rds_host':RDS,'database':'aistar_prod','role':'aistar_migrator','table_count':192,'flyway_version':'77','production_authorized':False}
  with self.assertRaises(Refused):import_plan_guard(p,'production')
 def test_drill_cannot_use_production(self):
  p={'format':'aistar-import-permit-v1','rds_host':RDS,'database':'aistar_prod','role':'aistar_rehearsal','table_count':192,'flyway_version':'77','purpose':'aistar-cutover-drill'}
  with self.assertRaises(Refused):import_plan_guard(p,'drill')
class SourceFreezeTests(unittest.TestCase):
 def test_pending_proof_cannot_omit_between_step_plans(self):
  pending={name:0 for name in PENDING_WORK};pending_work_guard(pending)
  for mutate in [lambda p:p.pop('ip_plan_execution'),lambda p:p.update(ip_plan_execution=1),lambda p:p.update(ip_run=False)]:
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

class RollingFailureTests(unittest.TestCase):
 def test_standby_start_failure_restores_primary(self):self.check_failure('b','start','a')
 def test_primary_start_failure_keeps_standby(self):self.check_failure('a','start','b')
 def test_primary_drain_failure_keeps_standby(self):self.check_failure('a','drain-stop','b')
 def check_failure(self,failed_node,failed_action,survivor):
  import release
  from unittest.mock import patch
  cluster=object.__new__(release.Cluster)
  cluster.events=[];calls=[];weights=[]
  cluster.members=lambda:{'a':{'Weight':100},'b':{'Weight':0}}
  def action(n,a,r=None):
   calls.append((n,a))
   if (n,a)==(failed_node,failed_action):raise RuntimeError('synthetic failure')
   return {'quiescing':False,'release':'candidate'}
  cluster.action=action;cluster.weights=lambda w:weights.append(w);cluster.probe=lambda n:None;cluster.record=lambda *a,**kw:None
  with patch('release.time.sleep'),self.assertRaises(RuntimeError):cluster.rolling('candidate')
  self.assertEqual(weights[-1],{'a':100 if survivor=='a' else 0,'b':100 if survivor=='b' else 0})
  if failed_node=='b':self.assertNotIn(('a','drain-stop'),calls)
if __name__=='__main__':unittest.main()
