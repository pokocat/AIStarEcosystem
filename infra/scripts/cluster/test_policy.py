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
 def test_unaccepted_artifact_refused(self):
  with self.assertRaises(Refused):artifact_guard({'format':'aistar-cluster-artifact-v1','sha':'a'*40,'jar_sha256':'a'*64,'tests_passed':False})
 def test_production_window_is_not_inferred(self):
  p={'format':'aistar-import-permit-v1','rds_host':RDS,'database':'aistar_prod','role':'aistar_migrator','table_count':192,'flyway_version':'77','production_authorized':False}
  with self.assertRaises(Refused):import_plan_guard(p,'production')
 def test_drill_cannot_use_production(self):
  p={'format':'aistar-import-permit-v1','rds_host':RDS,'database':'aistar_prod','role':'aistar_rehearsal','table_count':192,'flyway_version':'77','purpose':'aistar-cutover-drill'}
  with self.assertRaises(Refused):import_plan_guard(p,'drill')
if __name__=='__main__':unittest.main()
