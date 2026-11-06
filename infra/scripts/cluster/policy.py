"""Pure guards used before any remote write, plus explicit approved-window import plans."""
import datetime,hashlib,json,pathlib,re,urllib.parse
class Refused(RuntimeError):pass
RDS='pgm-bp1gp4819mbs30z3.pg.rds.aliyuncs.com'
TAIR='r-bp182e1w8fk05cnbvr.redis.rds.aliyuncs.com'
LEGACY={'47.98.162.120','8.136.36.175'}
PENDING_WORK=('ip_run', 'material_video_job', 'aep_publish_jobs', 'clip_render_job', 'clip_shot_job', 'music_gen_job', 'video_studio_prompt_optimization', 'ai_generation_queue', 'ip_dialogue_message', 'ip_plan_execution')
def require(ok,message):
 if not ok:raise Refused(message)
def sha256(path):
 digest=hashlib.sha256()
 with pathlib.Path(path).open('rb') as source:
  for block in iter(lambda:source.read(1024*1024),b''):digest.update(block)
 return digest.hexdigest()
def utc(value):
 value=value.replace('Z','+00:00');result=datetime.datetime.fromisoformat(value)
 require(result.utcoffset()==datetime.timedelta(0),'必须使用UTC时间');return result
def pending_work_guard(pending):
 require(isinstance(pending,dict) and set(PENDING_WORK).issubset(pending),'缺少完整在途工作证明（含连续制作计划）')
 require(all(type(v) is int and v==0 for v in pending.values()),'仍存在在途或未知受理工作')
def config_guard(config,mode,environ):
 require(mode in ('stage','production'),'只允许明确的演练或正式模式')
 for key in ('DEPLOY_HOST','ECS_HOST','REMOTE_ROOT','PUBLIC_BASE'):
  require(not environ.get(key),'拒绝旧单机覆盖参数：'+key)
 require(set(config['nodes'])=={'a','b'} and config['drain_seconds']>=180,'双机及180秒排空配置不完整')
 require({x['instance_id'] for x in config['nodes'].values()}=={'i-bp1dkkgmjbcpa21a5yi0','i-bp1as9b78f1fjmzlnvct'},'ECS身份不匹配')
 require({k:v['host'] for k,v in config['nodes'].items()}=={'a':'101.37.189.227','b':'121.199.172.157'},'必须使用已验收新A/B固定IP；旧机和自定义目标不可发布')
 require(config['modes']['stage']['database']!='aistar_prod' and config['modes']['stage']['group']!=config['modes']['production']['group'],'正式与演练资源必须隔离')
def environment_guard(env,mode,expected):
 u=urllib.parse.urlsplit(env.get('DB_URL','')[5:]);query=urllib.parse.parse_qs(u.query)
 require(u.scheme=='postgresql' and u.hostname==RDS and u.path=='/'+expected['database'] and env.get('DB_USERNAME')==expected['role'],'数据库端点、库或运行角色不匹配')
 require(query.get('sslmode')==['verify-full'],'数据库必须严格校验TLS')
 require(query.get('currentSchema',['public'])==[expected['schema']],'数据库schema不匹配')
 redis=urllib.parse.urlsplit(env.get('AEP_SMS_TAIR_URL',''))
 require(redis.scheme=='rediss' and redis.hostname==TAIR and redis.path=='/'+str(expected['redis_db']),'Tair身份或逻辑库不匹配')
 require(env.get('SPRING_PROFILES_ACTIVE')=='postgres' and env.get('AEP_BACKGROUND_ENABLED')=='false','API后台必须关闭，后台由独立单活单元运行')
 require(env.get('SERVER_ADDRESS')=='127.0.0.1' and env.get('SERVER_PORT')==str(expected['port']),'必须使用固定回环地址和端口')
 require(len(env.get('AEP_DEPLOYMENT_TOKEN',''))>=32,'缺少强部署令牌')
 require(env.get('AEP_SMS_CODE_STORE','tair')=='tair','必须使用共享验证码状态')
 for key in ('AEP_SEED_DEV_DATA_ENABLED','AEP_PAYMENT_SHADOW_ENABLED','AEP_CLIP_FORCE_MOCK'):
  require(env.get(key,'false').lower()!='true','不能启用生产种子或模拟支付/生成：'+key)
 if mode=='stage':require(expected['redis_db']==14 and 'rehearsal' in expected['schema'],'演练资源身份不匹配')
def artifact_guard(manifest):
 require(manifest.get('format')=='aistar-cluster-artifact-v1','发布清单格式不匹配')
 require(re.fullmatch('[0-9a-f]{40}',manifest.get('sha','')) is not None,'提交SHA无效')
 require(re.fullmatch('[0-9a-f]{64}',manifest.get('jar_sha256','')) is not None,'JAR摘要无效')
 require(manifest.get('tests_passed') is True,'完整测试未验收，不允许发布')
 require(re.fullmatch('sha256:[0-9a-f]{64}',manifest.get('image_configuration_id','')) is not None,'镜像必须固定配置摘要')
 require(re.fullmatch('[0-9a-f]{64}',manifest.get('archive_sha256','')) is not None,'镜像归档摘要缺失')
 require(manifest.get('source_tree') and manifest.get('migrations'),'必须绑定后端源码树和迁移字节')
def import_plan_guard(plan,mode,now=None,freeze_start=False):
 now=now or datetime.datetime.now(datetime.timezone.utc)
 require(mode in ('production','drill'),'不支持的导入模式')
 require(plan.get('format')=='aistar-import-permit-v1' and plan.get('rds_host')==RDS,'导入计划身份不符')
 require(plan.get('database')==('aistar_prod' if mode=='production' else 'aistar_cutover_drill'),'导入目标越界')
 require(plan.get('role')==('aistar_migrator' if mode=='production' else 'aistar_rehearsal'),'导入角色越界')
 require(plan.get('table_count')==192 and plan.get('flyway_version')=='77','结构契约未经核对')
 if mode=='drill':require(plan.get('purpose')=='aistar-cutover-drill','必须明确隔离演练用途');return
 require(plan.get('production_authorized') is True,'未单独确认正式维护窗口')
 start,end=utc(plan['window_start_utc']),utc(plan['window_end_utc'])
 require(start<=now<end and datetime.timedelta(0)<end-start<=datetime.timedelta(hours=2),'不在确认窗口内')
 if freeze_start:require(end-now>=datetime.timedelta(minutes=15),'窗口剩余不足15分钟，不开始停写')
 else:
  require(plan.get('source_unit')=='aistareco-server' and plan.get('source_pid_after_freeze')==0,'旧AIStar服务尚未停写')
  require(all(plan.get(x) is True for x in ('write_gate_closed','source_background_stopped','sau_idle','sms_lock_quarantine_complete')),'停写/后台/发布/短信锁定保护未完成')
  pending_work_guard(plan.get('pending_work'))
  frozen=utc(plan['source_freeze_utc']);require(start<=frozen<=now and now-frozen<datetime.timedelta(minutes=30),'冻结快照已过期或不属本次窗口')
def import_files_guard(plan,snapshot,temporal,migrations):
 for key,path in [('snapshot_sha256',snapshot),('temporal_plan_sha256',temporal)]:require(plan.get(key)==sha256(path),'计划与文件不一致：'+key)
 actual=[{'name':p.name,'sha256':sha256(p)} for p in sorted(pathlib.Path(migrations).glob('V*__*.sql'))]
 require(plan.get('migrations')==actual,'迁移集合或字节发生变化')

def contract_guard(env,contract):
 actual={k:hashlib.sha256(v.encode()).hexdigest() for k,v in env.items()}
 require(contract.get('format')=='aistar-runtime-contract-v1' and contract.get('environment_value_hashes')==actual,'运行配置与已核对的加密/身份/支付/OSS配置契约不一致')

def alb_guard(group,expected,drain):
 require(group.get('StickySessionConfig',{}).get('StickySessionEnabled') is False,'主备滚动必须关闭粘滞会话')
 d=group.get('ConnectionDrainConfig',{});require(d.get('ConnectionDrainEnabled') is True and d.get('ConnectionDrainTimeout',0)>=drain,'ALB必须开启至少180秒连接排空')
 h=group.get('HealthCheckConfig',{});require(h.get('HealthCheckEnabled') is True and h.get('HealthCheckPath')=='/internal/ready' and h.get('HealthCheckHost')==expected['host'] and h.get('HealthCheckProtocol')=='HTTP','ALB健康检查必须指向正确Host和真实就绪接口')
