#!/usr/bin/env python3
"""Future-window only: freeze just the old AIStar unit after independent drain evidence."""
import argparse,datetime,hashlib,json,os,pathlib,re,stat,subprocess,time,urllib.parse
ROOT=pathlib.Path('/opt/aistar-source-migration')
def check_window(plan,now):
 if plan.get('production_authorized') is not True:raise RuntimeError('没有单独确认的AIStar生产窗口')
 start,end=plan.get('window_start_epoch',0),plan.get('window_end_epoch',0)
 if not start<=now<end or end-start>7200 or end-now<900:raise RuntimeError('不在窗口内或不足15分钟，不执行停写')
def main():
 parser=argparse.ArgumentParser();parser.add_argument('--permit',required=True);parser.add_argument('--run',required=True);a=parser.parse_args();os.umask(0o077)
 if os.geteuid()!=0 or not re.fullmatch('[A-Za-z0-9_-]{1,80}',a.run):raise RuntimeError('必须使用root和唯一迁移标识')
 p=pathlib.Path(a.permit);st=p.stat()
 if st.st_uid!=0 or stat.S_IMODE(st.st_mode)!=0o600:raise RuntimeError('窗口及排空证明必须root:600')
 plan=json.loads(p.read_text());check_window(plan,time.time())
 if plan.get('source_unit')!='aistareco-server' or not all(plan.get(k) is True for k in ['write_gate_closed','sau_idle','sms_lock_quarantine_complete']):raise RuntimeError('源入口、SAU或旧短信状态保护缺失')
 if not plan.get('pending_work') or any(type(v) is not int or v!=0 for v in plan['pending_work'].values()) or time.time()-plan.get('drain_checked_epoch',0)>60:raise RuntimeError('在途工作未清零或排空证明过期')
 if subprocess.check_output(['systemctl','show','aistareco-sau-service','-p','MainPID','--value'],universal_newlines=True).strip()!='0':raise RuntimeError('源发布服务仍可能写入')
 pid=subprocess.check_output(['systemctl','show','aistareco-server','-p','MainPID','--value'],universal_newlines=True).strip()
 if pid=='0':raise RuntimeError('已停写，不能盲目重放；先核对现有冻结上下文')
 env={}
 for item in pathlib.Path('/proc/'+pid+'/environ').read_bytes().split(bytes([0])):
  k,sep,v=item.partition(b'=')
  if sep:env[k.decode()]=v.decode()
 argv=[x.decode() for x in pathlib.Path('/proc/'+pid+'/cmdline').read_bytes().split(bytes([0])) if x];artifact=pathlib.Path(argv[argv.index('-jar')+1]);digest=hashlib.sha256(artifact.read_bytes()).hexdigest()
 if digest!=plan['source_artifact_sha256']:raise RuntimeError('源包已变化，未停写')
 java=pathlib.Path('/proc/'+pid+'/exe').resolve();props=subprocess.check_output([str(java.parent/'jcmd'),pid,'VM.system_properties'],universal_newlines=True)
 if 'user.timezone=Asia/Shanghai' not in props.splitlines():raise RuntimeError('源业务时区变化')
 url=urllib.parse.urlsplit(env.get('DB_URL',env.get('SPRING_DATASOURCE_URL',''))[5:])
 if url.scheme!='mysql' or url.path!='/aistareco' or urllib.parse.parse_qs(url.query).get('serverTimezone')!=['Asia/Shanghai']:raise RuntimeError('源库身份/时区变化')
 checkenv=dict(os.environ);checkenv['MYSQL_PWD']=env.get('DB_PASSWORD',env.get('SPRING_DATASOURCE_PASSWORD',''))
 query="SELECT table_name,column_name,column_type,is_nullable,coalesce(column_default,'<NULL>'),extra FROM information_schema.columns WHERE table_schema=database() AND table_name<>'flyway_schema_history' ORDER BY table_name,ordinal_position"
 checked=subprocess.run(['mysql','--protocol=TCP','-h',url.hostname,'-P',str(url.port or 3306),'-u',env.get('DB_USERNAME',env.get('SPRING_DATASOURCE_USERNAME','')),'--batch','--raw','--skip-column-names','aistareco','-e',query],env=checkenv,stdout=subprocess.PIPE,stderr=subprocess.PIPE,universal_newlines=True)
 if checked.returncode or hashlib.sha256(checked.stdout.encode()).hexdigest()!=plan['source_schema_sha256']:raise RuntimeError('源结构变化，未停写')
 critical={k:v for k,v in env.items() if any(x in k for x in ['AES','JWT','ENCRYPT','AEP_ID_','WECHAT','PAYMENT'])}
 if hashlib.sha256(json.dumps(critical,sort_keys=True,separators=(',',':')).encode()).hexdigest()!=plan.get('source_critical_environment_sha256'):raise RuntimeError('源加密/身份/支付配置变化，未停写')
 connection={k:v for k,v in env.items() if k in ['DB_URL','DB_USERNAME','DB_PASSWORD','SPRING_DATASOURCE_URL','SPRING_DATASOURCE_USERNAME','SPRING_DATASOURCE_PASSWORD','SPRING_PROFILES_ACTIVE','GIT_SHA','RELEASE_ID']}
 folder=ROOT/a.run;folder.mkdir(mode=0o700,parents=True,exist_ok=False);context={**plan,'source_unit':{'name':'aistareco-server','MainPID':'0'},'connection':connection,'source_argv':argv,'source_jvm_timezone':'Asia/Shanghai','source_frozen':False,'previous_pid':pid}
 target=folder/'frozen-context.json';target.write_text(json.dumps(context));os.chmod(str(target),0o600);check_window(plan,time.time())
 subprocess.run(['systemctl','disable','--now','aistareco-server'],check=True)
 if subprocess.check_output(['systemctl','show','aistareco-server','-p','MainPID','--value'],universal_newlines=True).strip()!='0':raise RuntimeError('源服务未停止')
 context.update(source_frozen=True,source_background_stopped=True,frozen_epoch=time.time(),source_freeze_utc=datetime.datetime.now(datetime.timezone.utc).isoformat());target.write_text(json.dumps(context));print('仅旧AIStar unit已停写；冻结上下文在root私有目录，共享数据库/Redis/其他服务未停')
if __name__=='__main__':main()
