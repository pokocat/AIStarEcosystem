"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Alert, Button, Pagination, Skeleton, Table, Tag } from "antd";
import type { EnterpriseAudit, EnterpriseContext, EnterprisePointsTransfer, EnterpriseUsage } from "@ai-star-eco/types/enterprise";
import { EnterpriseApi } from "@/canvas-bridge/enterprise-api";
import { normalizeStudioError } from "./studio-errors";

const number = (value: number) => value.toLocaleString("zh-CN");
const time = (value: string) => new Date(value).toLocaleString("zh-CN");
const usageStatus = (status: string) => ({ reserved: "排队中", dispatching: "生成或核对中", completed: "已结算", released: "已结算，余款已退回" }[status] || "等待核对");
const actorLabel = (row: { actorUserId: string; actorName?: string }, self: string) => row.actorUserId === self ? "我" : row.actorName || "企业成员";
const actionNames: Record<string, string> = { "enterprise.create": "创建企业", "member.add": "添加成员", "member.invite": "创建邀请", "invitation.accept": "接受邀请", "invitation.revoke": "撤销邀请", "member.update": "更新成员权限", "member.permissions": "更新成员权限", "member.accept": "接受邀请", "member.invite.revoke": "撤销邀请", "recharge.confirm": "财务确认入账", "recharge.reject": "财务拒绝充值", "recharge.refund": "财务登记退款", "member.suspend": "停用成员", "member.resume": "恢复成员", "member.remove": "移除成员", "member.leave": "成员退出", "enterprise.close": "关闭企业", "policy.update": "更新生成设置", "ownership.request": "发起主账号移交", "ownership.accept": "接受主账号移交", "points.allocate": "分配积分", "points.reclaim": "回收积分", "points.recovery": "归集旧任务退款", "lifecycle.suspend": "停用成员", "lifecycle.resume": "恢复成员", "lifecycle.remove": "移除成员", "lifecycle.leave": "成员退出", "lifecycle.close": "关闭企业", "recharge.request": "申请充值" };

/** Enterprise accounting records contain billing references only, never member canvas content. */
export function EnterpriseReports({ context, kind, refreshKey = 0 }: { context: EnterpriseContext; kind: "transfers" | "usage" | "audit"; refreshKey?: number }) {
  const [rows, setRows] = useState<(EnterprisePointsTransfer | EnterpriseUsage | EnterpriseAudit)[]>([]);
  const [rowKind, setRowKind] = useState(kind);
  const currentRows = rowKind === kind ? rows : [];
  const [page, setPage] = useState(0), [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true), [error, setError] = useState("");
  const revision = useRef(0);
  const load = useCallback(async () => {
    const current = ++revision.current; setLoading(true); setError("");
    try {
      const result = kind === "transfers" ? await EnterpriseApi.transfers(context.enterprise.id, page, 20) : kind === "usage" ? await EnterpriseApi.usage(context.enterprise.id, page, 20) : await EnterpriseApi.audit(context.enterprise.id, page, 20);
      if (current !== revision.current) return;
      setRows(result.data); setRowKind(kind); setTotal(result.pagination.total);
    } catch (caught) { if (current === revision.current) setError(normalizeStudioError(caught).message); }
    finally { if (current === revision.current) setLoading(false); }
  }, [context.enterprise.id, kind, page]);
  useEffect(() => { setPage(0); }, [kind]);
  useEffect(() => { void load(); return () => { revision.current++; }; }, [load, refreshKey]);
  return <section aria-label={kind === "transfers" ? "积分划拨流水" : kind === "usage" ? "企业消费流水" : "企业操作记录"}>
    <div className="enterprise-section-heading"><div><h2>{kind === "transfers" ? "积分划拨流水" : kind === "usage" ? "企业消费流水" : "企业操作记录"}</h2><p>{kind === "transfers" ? "分配与回收是企业内部等额划拨，不计作充值或消费。" : kind === "usage" ? context.permissions.includes("usage.read") ? "展示企业付款的进行中任务与实际消耗。冻结积分不计作消费，不包含个人付款或私有创作内容。" : "展示本人使用企业积分的任务与实际消耗。个人付费账单可在我的账号查看。" : "企业成员、权限和资金管理的操作记录。"}</p></div><Button loading={loading} onClick={() => void load()}>刷新记录</Button></div>
    {error ? <Alert type="error" showIcon title={error} action={<Button size="small" onClick={() => void load()}>重试</Button>} /> : loading || rowKind !== kind ? <Skeleton active paragraph={{ rows: 5 }} /> : kind === "transfers" ? <Table<EnterprisePointsTransfer> rowKey="id" dataSource={currentRows as EnterprisePointsTransfer[]} pagination={false} scroll={{ x: 800 }} locale={{ emptyText: "暂无划拨记录" }} columns={[{ title: "时间", dataIndex: "createdAt", render: time }, { title: "成员", key: "member", render: (_, row) => <span title={row.memberId}>{row.memberName || (row.memberId === context.member.id ? "我的企业账户" : "企业成员")}</span> }, { title: "方向", dataIndex: "direction", render: value => <Tag>{value === "allocate" ? "分配给成员" : "回收至企业"}</Tag> }, { title: "积分", dataIndex: "amount", align: "right", render: number }, { title: "记账结果", key: "ledgers", render: (_, row) => <span title={`划拨批次：${row.batchId}；出账：${row.outLedgerId}；入账：${row.inLedgerId}`}>划拨已完成</span> }]} /> : kind === "usage" ? <Table<EnterpriseUsage> rowKey="id" dataSource={currentRows as EnterpriseUsage[]} pagination={false} scroll={{ x: 680 }} locale={{ emptyText: "暂无企业付款任务" }} columns={[{ title: "发起时间", dataIndex: "createdAt", render: time }, { title: "操作者", key: "actor", render: (_, row) => <span title={row.actorUserId}>{actorLabel(row, context.member.userId)}</span> }, { title: "实际消耗积分", dataIndex: "cost", align: "right", render: number }, { title: "冻结积分", dataIndex: "pendingCredits", align: "right", render: value => number(value || 0) }, { title: "模型", dataIndex: "modelName", render: value => value || "历史模型" }, { title: "状态", dataIndex: "status", render: usageStatus }, { title: "任务类型", dataIndex: "referenceType", render: value => value === "material_video_job" ? "视频生成" : "Studio 生成" }, { title: "记账结果", key: "reference", render: (_, row) => <span title={`计费流水：${row.referenceId}`}>{usageStatus(row.status)}</span> }]} /> : <Table<EnterpriseAudit> rowKey="id" dataSource={currentRows as EnterpriseAudit[]} pagination={false} scroll={{ x: 680 }} locale={{ emptyText: "暂无操作记录" }} columns={[{ title: "时间", dataIndex: "createdAt", render: time }, { title: "操作", dataIndex: "action", render: value => actionNames[value] || "企业管理操作" }, { title: "操作者", key: "actor", render: (_, row) => <span title={row.actorUserId}>{actorLabel(row, context.member.userId)}</span> }, { title: "说明", key: "summary", render: (_, row) => row.action === "member.permissions" ? "已变更角色或附加授权" : row.action === "policy.update" ? "已变更允许模型或在途任务上限" : row.summary }]} />}
    <Pagination className="enterprise-pagination" current={page + 1} total={total} pageSize={20} hideOnSinglePage showSizeChanger={false} onChange={next => setPage(next - 1)} />
  </section>;
}
