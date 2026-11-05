import pathlib,os,subprocess,urllib.parse,json,datetime,re,hashlib,argparse,stat,time
parser=argparse.ArgumentParser();parser.add_argument('--frozen-context',required=True);args=parser.parse_args()

def run(a,env=None):
 p=subprocess.run(a,env=env,stdout=subprocess.PIPE,stderr=subprocess.PIPE,universal_newlines=True)
 if p.returncode:raise RuntimeError('只读查询失败；敏感诊断不输出')
 return p.stdout.rstrip('\r\n')
context_path=pathlib.Path(args.frozen_context);st=context_path.stat();assert st.st_uid==0 and stat.S_IMODE(st.st_mode)==0o600
context=json.loads(context_path.read_text());assert context['source_frozen'] is True
pid=run(['systemctl','show','aistareco-server','-p','MainPID','--value']);assert pid=='0','Source process still active'
now=time.time();assert context['window_start_epoch']<=now<context['window_end_epoch'] and 0<=now-context['frozen_epoch']<1800
u=context['source_unit'];env=context['connection']
url=env.get('DB_URL',env.get('SPRING_DATASOURCE_URL',''));assert url.startswith('jdbc:mysql:')
a=urllib.parse.urlsplit(url[5:]);db=a.path.lstrip('/');assert db=='aistareco'
e=dict(os.environ);e['MYSQL_PWD']=env.get('DB_PASSWORD',env.get('SPRING_DATASOURCE_PASSWORD',''))
base=['mysql','--protocol=TCP','-h',a.hostname,'-P',str(a.port or 3306),'-u',env.get('DB_USERNAME',env.get('SPRING_DATASOURCE_USERNAME','')),'--batch','--raw','--skip-column-names','--default-character-set=utf8mb4',db]
def query(sql):return run(base+['-e',sql],e)
def records(sql):return [json.loads(l) for l in query(sql).splitlines() if l]

import gzip,tempfile,hashlib,sys
assert db=='aistareco'
cmdline=[x.encode() for x in context['source_argv']];jvm_tz=[context['source_jvm_timezone']]
assert jvm_tz==['Asia/Shanghai'],'Source JVM timezone changed; audit before export'
assert urllib.parse.parse_qs(a.query).get('serverTimezone')==['Asia/Shanghai'],'Source JDBC timezone changed'
tables={}
for line in query('select table_name,column_name,column_type from information_schema.columns where table_schema=database() order by table_name,ordinal_position').splitlines():
 t,c,typ=line.split('\t');assert re.fullmatch('[a-z0-9_]+',t) and re.fullmatch('[a-z0-9_]+',c)
 if t=='flyway_schema_history':continue
 tables.setdefault(t,[]).append({'name':c,'type':typ})
assert len(tables)==192,'Source table count changed; inspect new migrations first'
argv=[x.decode() for x in cmdline if x]
artifact=pathlib.Path(argv[argv.index('-jar')+1]);source_artifact_sha256=hashlib.sha256(artifact.read_bytes()).hexdigest()
source_schema=query("SELECT table_name,column_name,column_type,is_nullable,coalesce(column_default,'<NULL>'),extra FROM information_schema.columns WHERE table_schema=database() AND table_name<>'flyway_schema_history' ORDER BY table_name,ordinal_position")+'\n'
source_schema_sha256=hashlib.sha256(source_schema.encode()).hexdigest()
assert source_artifact_sha256==context['source_artifact_sha256'] and source_schema_sha256==context['source_schema_sha256'],'Source artifact/schema changed after freeze'
metadata={'type':'snapshot_metadata','database':db,'source_frozen':True,'source_freeze_utc':context['source_freeze_utc'],'purpose':'production_frozen_snapshot','captured_utc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'source_unit':u,'source_release':{k:env[k] for k in ['GIT_SHA','RELEASE_ID','SPRING_PROFILES_ACTIVE'] if k in env},'source_jvm_timezone':jvm_tz[0],'source_jdbc_timezone':'Asia/Shanghai','temporal_interpretation':'per-column Hibernate MySQL binding contract; not assumed from JVM timezone','table_count':len(tables),'source_artifact_sha256':source_artifact_sha256,'source_schema_sha256':source_schema_sha256}
q=["SELECT CONVERT(0x"+json.dumps(metadata,separators=(',',':')).encode().hex()+" USING utf8mb4);","SET SESSION time_zone='+00:00';","SET SESSION TRANSACTION ISOLATION LEVEL REPEATABLE READ;","START TRANSACTION WITH CONSISTENT SNAPSHOT, READ ONLY;"]
for t,cols in sorted(tables.items()):
 q.append("SELECT CONVERT(0x"+json.dumps({'type':'table','name':t,'columns':cols},separators=(',',':')).encode().hex()+" USING utf8mb4);")
 q.append("SELECT JSON_OBJECT('type','count','name','"+t+"','rows',COUNT(*)) FROM `"+t+'`;')
 fields=[]
 for c in cols:
  value='CAST(`'+c['name']+'` AS BINARY)'
  if c['type'].startswith('bit('):value='CAST(`'+c['name']+'`+0 AS CHAR)'
  fields.append('IF(`'+c['name']+'` IS NULL,NULL,HEX('+value+'))')
 q.append("SELECT JSON_OBJECT('type','row','name','"+t+"','values',JSON_ARRAY("+','.join(fields)+')) FROM `'+t+'`;')
q+=['COMMIT;']
with tempfile.TemporaryFile() as inp,tempfile.TemporaryFile() as err:
 inp.write(('\n'.join(q)+'\n').encode());inp.seek(0)
 proc=subprocess.Popen(base,env=e,stdin=inp,stdout=subprocess.PIPE,stderr=err)
 with gzip.GzipFile(fileobj=sys.stdout.buffer,mode='wb',compresslevel=1) as gz:
  while True:
   chunk=proc.stdout.read(1024*1024)
   if not chunk:break
   gz.write(chunk)
  if proc.wait()!=0:raise RuntimeError('Snapshot read failed; no valid completion record')
  after_schema=query("SELECT table_name,column_name,column_type,is_nullable,coalesce(column_default,'<NULL>'),extra FROM information_schema.columns WHERE table_schema=database() AND table_name<>'flyway_schema_history' ORDER BY table_name,ordinal_position")+'\n'
  assert hashlib.sha256(after_schema.encode()).hexdigest()==source_schema_sha256,'Source schema drifted during export'
  assert hashlib.sha256(artifact.read_bytes()).hexdigest()==source_artifact_sha256,'Source artifact drifted during export'
  assert run(['systemctl','show','aistareco-server','-p','MainPID','--value'])=='0','Source restarted during frozen export'
  assert time.time()<context['window_end_epoch'],'Window expired during frozen export'
  gz.write(b'{"type":"complete"}\n')
