"use client";
import * as React from "react";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { readGenerationAlerts, type GenerationAlerts } from "@/api/generation-alerts";
import { formatDateTimeCN } from "@/lib/utils";

/** Read-only supplier incident history. Viewing or refreshing never re-submits or changes credits. */
export function GenerationSubmissionAlerts() {
  const [data,setData]=React.useState<GenerationAlerts>();
  const [busy,setBusy]=React.useState(false),[error,setError]=React.useState("");
  const lock=React.useRef(false);
  const read=React.useCallback(async(page:number)=>{
    if(lock.current)return;
    lock.current=true;setBusy(true);setError("");
    try{setData(await readGenerationAlerts(page));}
    catch(error){setError(error instanceof Error?error.message:"无法加载生成异常，请重试");}
    finally{lock.current=false;setBusy(false);}
  },[]);
  React.useEffect(()=>{void read(0);},[read]);
  return <Card className={data?.total?"border-amber-300":""}>
    <CardHeader>
      <div className="flex flex-wrap items-center justify-between gap-2"><CardTitle className="flex items-center gap-2 text-base"><AlertTriangle className="h-4 w-4"/>生成异常告警{data?` · ${data.total} 条`:""}</CardTitle><Button variant="outline" size="sm" disabled={busy} onClick={()=>void read(data?.page||0)}>{busy?"正在刷新…":"刷新告警"}</Button></div>
      <CardDescription>生成服务未返回有效任务信息。系统按失败结束、退回未完成部分的冻结积分，用户可以重新生成；这里保留异常记录，供追查供应商是否实际受理。刷新只读取记录。</CardDescription>
    </CardHeader>
    <CardContent className="space-y-3">
      {error&&<p role="alert" className="text-sm text-destructive">{error}</p>}
      {!data&&busy&&<p role="status" className="text-sm text-muted-foreground">正在加载异常记录…</p>}
      {data?.total===0&&<p className="text-sm text-muted-foreground">暂无此类生成异常</p>}
      {data?.items.map(item=><details key={`${item.taskType}:${item.taskId}`} className="rounded-md border p-3 text-sm">
        <summary className="cursor-pointer break-words"><span className="font-medium">{item.taskType==="material-video"?"视频":item.taskType==="ip-image"?"图片":"配音 / 口型"}</span> · {item.status==="failed"?"已按失败处理":"正在结束任务"} · {item.taskId}<span className="ml-2 text-muted-foreground">{formatDateTimeCN(item.createdAt)}</span></summary>
        <dl className="mt-3 grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-2 break-all"><dt>模型端点</dt><dd>{item.endpointId}</dd><dt>错误码</dt><dd>{item.errorCode}</dd><dt>追查号</dt><dd>{item.logId||"未记录，可按任务号查请求日志"}</dd><dt>错误原因</dt><dd className="whitespace-pre-wrap">{item.errorMessage||"生成服务未返回有效任务信息"}</dd></dl>
        <p className="mt-3 text-muted-foreground">原始响应在请求日志中；有追查号时，超管可在「错误日志」查看详细信息。这些记录不会自动重新提交或补扣用户积分。</p>
      </details>)}
      {data&&data.total>20&&<div className="flex items-center gap-3"><Button variant="outline" size="sm" disabled={busy||data.page===0} onClick={()=>void read(data.page-1)}>上一页</Button><span className="text-sm">第 {data.page+1} 页</span><Button variant="outline" size="sm" disabled={busy||!data.hasMore} onClick={()=>void read(data.page+1)}>下一页</Button></div>}
    </CardContent>
  </Card>;
}
