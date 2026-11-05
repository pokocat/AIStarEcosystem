#!/usr/bin/env python3
"""No-write preflight by default; formal execution needs an independent approved frozen plan."""
import argparse,json,pathlib,os,subprocess,sys,stat
from policy import import_plan_guard,import_files_guard,require,Refused
ROOT=pathlib.Path(__file__).resolve().parents[3]
def preflight(plan,mode,snapshot,temporal,migrations):
 import_plan_guard(plan,mode);import_files_guard(plan,snapshot,temporal,migrations)
 return {'read_only':True,'mode':mode,'database':plan['database'],'source_frozen_required':mode=='production','file_bindings_verified':True}
def main():
 p=argparse.ArgumentParser();p.add_argument('--mode',choices=['drill','production'],required=True);p.add_argument('--permit',required=True);p.add_argument('--snapshot',required=True);p.add_argument('--receipt',required=True);p.add_argument('--execute',action='store_true');p.add_argument('--grant-only',action='store_true');a=p.parse_args()
 plan_path=pathlib.Path(a.permit).resolve();plan=json.loads(plan_path.read_text());snapshot=pathlib.Path(a.snapshot).resolve();receipt=pathlib.Path(a.receipt).resolve()
 # The check runs locally or on A and never connects to a database. The actual Java tool rechecks all gates.
 result=preflight(plan,a.mode,snapshot,(pathlib.Path('/opt/aistar-migration/preparation/temporal-plan.json') if a.execute else ROOT/'infra/migration/temporal-plan.json'),(pathlib.Path('/opt/aistar-migration/preparation/schema') if a.execute else ROOT/'apps/server/src/main/resources/db/postgresql'))
 if not a.execute:print(json.dumps(result,ensure_ascii=False));return
 require(os.geteuid()==0 and str(snapshot.parent)=='/opt/aistar-migration/preparation' and receipt.parent==snapshot.parent and plan_path.parent==snapshot.parent,'执行仅允许新A的受保护目录和root权限')
 identity=json.loads(pathlib.Path('/etc/aibuzz-deploy/node.json').read_text());require(identity.get('instance_id')=='i-bp1dkkgmjbcpa21a5yi0','导入只允许新A执行')
 require(receipt.is_file() if a.grant_only else not receipt.exists(),'授权重试必须有已完成凭证，导入不得覆盖已有凭证')
 for path in [snapshot,plan_path]:require(path.stat().st_uid==0 and stat.S_IMODE(path.stat().st_mode)==0o600,'导入文件必须root:600')
 command=['/opt/aibuzz-id/runtime/java17/bin/java','-Xms128m','-Xmx768m','-cp','/opt/aistar-migration/preparation:/opt/aistar-migration/preparation/runtime/lib/*','AistarSnapshotRestore',a.mode,str(snapshot),str(receipt),str(plan_path)]
 if not a.grant_only:subprocess.run(command,check=True)
 subprocess.run(command[:5]+['AistarApplicationGrant',a.mode,str(plan_path),str(receipt)],check=True)
 print('数据已导入并完成全字段和应用最小权限核对；凭证在受保护目录')
if __name__=='__main__':
 try:main()
 except Exception as e:print('导入中止：'+str(e),file=sys.stderr);sys.exit(1)
