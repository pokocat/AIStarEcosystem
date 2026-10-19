"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import * as api from "@/api/enterprise-recharges";
import type { Enterprise, EnterpriseMemberBalance, EnterprisePointsTransfer, EnterpriseUsage, EnterpriseWalletSummary } from "@/types/enterprise";
const n = (value: number) => value.toLocaleString("zh-CN");
const time = (value: string) => new Date(value).toLocaleString("zh-CN");
const usageStatus = (status: string) => ({ reserved: "排队中", dispatching: "生成或核对中", completed: "已结算", released: "已结算，余款已退回" }[status] || "等待核对");

/** Finance reads enterprise money and settlement references, with no member private assets. */
export function EnterpriseFinancialReport() {
  const [search, setSearch] = React.useState("");
  const [enterprises, setEnterprises] = React.useState<Enterprise[]>([]);
  const [selected, setSelected] = React.useState<string>("");
  const [enterprisePage, setEnterprisePage] = React.useState(0), [enterpriseHasNext, setEnterpriseHasNext] = React.useState(false);
  const [kind, setKind] = React.useState<"members" | "transfers" | "usage">("members");
  const [summary, setSummary] = React.useState<EnterpriseWalletSummary>();
  const [rows, setRows] = React.useState<(EnterpriseMemberBalance | EnterprisePointsTransfer | EnterpriseUsage)[]>([]);
  const [rowKind, setRowKind] = React.useState(kind);
  // A tab change renders before its effect starts; never interpret the previous tab's rows as this tab's DTO.
  const currentRows = rowKind === kind ? rows : [];
  const [page, setPage] = React.useState(0), [total, setTotal] = React.useState(0), [hasNext, setHasNext] = React.useState(false);
  const [loading, setLoading] = React.useState(false), [searching, setSearching] = React.useState(false), [error, setError] = React.useState("");
  const version = React.useRef(0), searchVersion = React.useRef(0);
  const find = React.useCallback(async () => {
    const current = ++searchVersion.current; setSearching(true); setError("");
    try {
      const response = await api.enterprises(search.trim(), enterprisePage);
      if (current !== searchVersion.current) return;
      setEnterprises(response.data); setEnterpriseHasNext(response.pagination.hasNext);
    } catch (caught) { if (current === searchVersion.current) setError(caught instanceof Error ? caught.message : "企业查询失败，请重试。"); }
    finally { if (current === searchVersion.current) setSearching(false); }
  }, [search, enterprisePage]);
  React.useEffect(() => { void find(); }, [enterprisePage]); // Search text is submitted explicitly.
  const load = React.useCallback(async () => {
    if (!selected) return;
    const current = ++version.current; setLoading(true); setError("");
    try {
      const [wallet, response] = await Promise.all([api.enterpriseSummary(selected), kind === "members" ? api.enterpriseMembers(selected, page) : kind === "transfers" ? api.enterpriseTransfers(selected, page) : api.enterpriseUsage(selected, page)]);
      if (current !== version.current) return;
      setSummary(wallet); setRows(response.data); setRowKind(kind); setTotal(response.pagination.total); setHasNext(response.pagination.hasNext);
    } catch (caught) { if (current === version.current) setError(caught instanceof Error ? caught.message : "企业报表读取失败，请重试。"); }
    finally { if (current === version.current) setLoading(false); }
  }, [selected, kind, page]);
  React.useEffect(() => { void load(); return () => { version.current++; }; }, [load]);
  return <Card>
    <CardHeader><CardTitle className="text-base">企业资金与消费核对</CardTitle><p className="text-sm text-muted-foreground">企业内部划拨不计作充值收入。汇总包含待分配、成员可用和在途冻结，最终消费单独列示。</p></CardHeader>
    <CardContent className="space-y-5">
      <form className="flex flex-wrap gap-2" onSubmit={event => { event.preventDefault(); if (enterprisePage) setEnterprisePage(0); else void find(); }}><Input className="max-w-sm" aria-label="企业名称或编号" placeholder="搜索企业名称或编号" value={search} onChange={event => setSearch(event.target.value)} /><Button type="submit" disabled={searching}>{searching ? "正在查询…" : "查询企业"}</Button></form>
      <div className="flex flex-wrap items-center gap-2">{enterprises.map(enterprise => <Button key={enterprise.id} className="max-w-full truncate" title={enterprise.name} size="sm" variant={enterprise.id === selected ? "default" : "outline"} onClick={() => { setSelected(enterprise.id); setSummary(undefined); setRows([]); setPage(0); }}>{enterprise.name}</Button>)}{!enterprises.length && !searching && <p className="text-sm text-muted-foreground">未找到企业，请调整名称或编号。</p>}<Button size="sm" variant="ghost" disabled={!enterprisePage || searching} onClick={() => setEnterprisePage(value => value - 1)}>前一页企业</Button><Button size="sm" variant="ghost" disabled={!enterpriseHasNext || searching} onClick={() => setEnterprisePage(value => value + 1)}>后一页企业</Button></div>
      {error && <p role="alert" className="text-sm text-destructive">{error}<Button size="sm" variant="ghost" onClick={() => void (selected ? load() : find())}>重试</Button></p>}
      {selected && <>
        {summary && <dl className="grid grid-cols-2 gap-x-6 gap-y-4 border-y py-4 sm:grid-cols-5">{[["待分配积分", summary.unallocated], ["成员可用积分", summary.allocated], ["冻结积分", summary.pending], ["在账总积分", summary.unallocated + summary.allocated + summary.pending], ["累计实际消耗", summary.spent]].map(([label, value]) => <div key={label}><dt className="text-xs text-muted-foreground">{label}</dt><dd className="mt-1 text-lg font-semibold tabular-nums">{n(value as number)}</dd></div>)}</dl>}
        <div className="flex flex-wrap gap-2">{([['members','成员余额'],['transfers','划拨流水'],['usage','消费与在途']] as const).map(([value,label]) => <Button key={value} size="sm" variant={kind === value ? "default" : "outline"} onClick={() => { setKind(value); setPage(0); }}>{label}</Button>)}<Button size="sm" variant="ghost" disabled={loading} onClick={() => void load()}>刷新核对数据</Button></div>
        {loading || rowKind !== kind ? <p role="status" className="py-4 text-sm text-muted-foreground">正在读取企业资金记录…</p> : !currentRows.length ? <p className="py-4 text-sm text-muted-foreground">当前没有{kind === "members" ? "成员余额" : kind === "transfers" ? "划拨流水" : "企业付款任务"}记录。</p> : kind === "members" ? <Table><TableHeader><TableRow><TableHead>成员</TableHead><TableHead>企业角色 / 状态</TableHead><TableHead className="text-right">可用积分</TableHead><TableHead className="text-right">冻结积分</TableHead></TableRow></TableHeader><TableBody>{(currentRows as EnterpriseMemberBalance[]).map(row => <TableRow key={row.memberId}><TableCell>{row.displayName}</TableCell><TableCell>{{owner:"主账号",manager:"管理员",member:"成员"}[row.role]} / {{active:"正常",suspended:"已停用",removed:"已退出"}[row.status]}</TableCell><TableCell className="text-right tabular-nums">{n(row.totalBalance)}</TableCell><TableCell className="text-right tabular-nums">{n(row.pendingBalance)}</TableCell></TableRow>)}</TableBody></Table> : kind === "transfers" ? <Table><TableHeader><TableRow><TableHead>时间</TableHead><TableHead>成员</TableHead><TableHead>方向 / 批次</TableHead><TableHead className="text-right">积分</TableHead><TableHead>对应出账 / 入账</TableHead></TableRow></TableHeader><TableBody>{(currentRows as EnterprisePointsTransfer[]).map(row => <TableRow key={row.id}><TableCell className="text-xs">{time(row.createdAt)}</TableCell><TableCell>{row.memberName || "成员"}</TableCell><TableCell>{row.direction === "allocate" ? "分配至成员" : "回收至企业"}<div className="text-xs text-muted-foreground">{row.batchId}</div></TableCell><TableCell className="text-right tabular-nums">{n(row.amount)}</TableCell><TableCell className="text-xs text-muted-foreground">{row.outLedgerId}<br/>{row.inLedgerId}</TableCell></TableRow>)}</TableBody></Table> : <Table><TableHeader><TableRow><TableHead>发起时间</TableHead><TableHead>实际操作者</TableHead><TableHead>模型 / 状态</TableHead><TableHead className="text-right">实际消耗</TableHead><TableHead className="text-right">冻结积分</TableHead><TableHead>原计费引用</TableHead></TableRow></TableHeader><TableBody>{(currentRows as EnterpriseUsage[]).map(row => <TableRow key={row.id}><TableCell className="text-xs">{time(row.createdAt)}</TableCell><TableCell title={row.actorUserId}>{row.actorName || "企业成员"}</TableCell><TableCell>{row.modelName || "历史模型"}<div className="text-xs text-muted-foreground">{usageStatus(row.status)}</div></TableCell><TableCell className="text-right tabular-nums">{n(row.cost)}</TableCell><TableCell className="text-right tabular-nums">{n(row.pendingCredits || 0)}</TableCell><TableCell className="text-xs text-muted-foreground">{row.referenceType} · {row.referenceId}</TableCell></TableRow>)}</TableBody></Table>}
        <div className="flex items-center justify-end gap-3 text-sm"><span className="text-muted-foreground">第 {page + 1} 页 · 共 {total} 条</span><Button size="sm" variant="outline" disabled={loading || !page} onClick={() => setPage(value => value - 1)}>上一页</Button><Button size="sm" variant="outline" disabled={loading || !hasNext} onClick={() => setPage(value => value + 1)}>下一页</Button></div>
      </>}
    </CardContent>
  </Card>;
}
