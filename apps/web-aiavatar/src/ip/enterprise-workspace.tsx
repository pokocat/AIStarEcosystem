"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Alert, Button, Checkbox, ConfigProvider, Empty, Input, InputNumber, Modal, Pagination, Skeleton, Table, Tag } from "antd";
import { ArrowDownLeft, ArrowUpRight, RefreshCw } from "lucide-react";
import type { EnterpriseContext, EnterpriseMemberBalance, EnterprisePointsPreview, EnterpriseRechargeOrder, EnterpriseWalletSummary } from "@ai-star-eco/types/enterprise";
import { EnterpriseApi } from "@/canvas-bridge/enterprise-api";
import { PlatformGateScreen, useRequireAuth } from "@/components/hub/auth";
import { StudioPage, StudioPageFilters } from "./studio-page";
import { normalizeStudioError } from "./studio-errors";
import { studioOverlayContainer } from "./studio-overlay";
import { EnterpriseManagement } from "./enterprise-management";
import { EnterpriseReports } from "./enterprise-reports";
import { WalletApi } from "@/proto/api";

type Direction = "allocate" | "reclaim";
type TransferDraft = { direction: Direction; items: { memberId: string; amount: number | null }[]; clientRequestId: string; preview: EnterprisePointsPreview };
const number = (value: number) => value.toLocaleString("zh-CN");
const roleName = { owner: "主账号", manager: "管理员", member: "成员" };
const statusName = { active: "正常", suspended: "已停用", removed: "已退出" };
const rechargeStatus = { pending: "待财务核准", paid: "已入账", rejected: "已拒绝", refunded: "已退款" };
const pageSize = 20;
const errorText = (error: unknown) => normalizeStudioError(error).message;
const requestId = () => crypto.randomUUID();

/** Financial forms inherit StudioPage and Ant Design controls; account and asset ownership stay separate. */
export function EnterpriseWorkspace() {
  if (process.env.NEXT_PUBLIC_ENTERPRISE_ENABLED !== "1") return <StudioPage title="企业管理" description="管理企业积分、成员分配与充值记录。" className="enterprise-workspace" actions={<Link className="ip-brand-secondary" href="/me">我的账号</Link>}><Alert type="info" showIcon title="企业管理尚未开放" description="请联系平台确认开通安排。"/></StudioPage>;
  return <EnterpriseWorkspaceEnabled/>;
}

function EnterpriseWorkspaceEnabled() {
  const authState = useRequireAuth();
  const [context, setContext] = useState<EnterpriseContext>();
  const [wallet, setWallet] = useState<EnterpriseWalletSummary>();
  const [personalBalance, setPersonalBalance] = useState<number>();
  const [ownBalance, setOwnBalance] = useState<EnterpriseMemberBalance>();
  const [members, setMembers] = useState<EnterpriseMemberBalance[]>([]);
  const [orders, setOrders] = useState<EnterpriseRechargeOrder[]>([]);
  const [page, setPage] = useState(0), [orderPage, setOrderPage] = useState(0);
  const [total, setTotal] = useState(0), [orderTotal, setOrderTotal] = useState(0);
  const [tab, setTab] = useState("members");
  const [selected, setSelected] = useState<string[]>([]);
  const [loading, setLoading] = useState(true), [busy, setBusy] = useState(false);
  const [error, setError] = useState(""), [actionError, setActionError] = useState("");
  const [success, setSuccess] = useState("");
  const [direction, setDirection] = useState<Direction>();
  const [amount, setAmount] = useState<number | null>(null), [reclaimAll, setReclaimAll] = useState(false);
  const [draft, setDraft] = useState<TransferDraft>();
  const [stale, setStale] = useState(false);
  const [rechargeOpen, setRechargeOpen] = useState(false), [note, setNote] = useState("");
  const [name, setName] = useState(""), [inviteToken, setInviteToken] = useState("");
  const mutationLock = useRef(false), loadVersion = useRef(0), alive = useRef(true);
  const rechargeKey = useRef<string | undefined>(undefined), createKey = useRef<string | undefined>(undefined);
  const permissions = context?.permissions || [];
  const canManage = permissions.includes("points.manage");
  const canBilling = permissions.includes("billing.read");
  const canRequest = permissions.includes("billing.request");
  const canReadTeam = canManage || canBilling;
  const canReadRecharges = canBilling || canRequest;
  const canTeam = permissions.includes("member.manage") || permissions.includes("member.invite");
  const tabs = [{ value: "members", label: canReadTeam ? "成员积分" : "我的企业积分", count: total }, ...(canTeam ? [{ value: "team", label: "成员与邀请" }] : []), ...(canReadRecharges ? [{ value: "recharges", label: canBilling ? "充值记录" : "我的充值申请", count: orderTotal }] : []), { value: "transfers", label: "划拨流水" }, { value: "usage", label: "消费流水" }, ...(context?.member.role === "owner" ? [{ value: "policy", label: "生成设置" }, { value: "audit", label: "操作记录" }] : []), { value: "lifecycle", label: "企业关系" }];

  useEffect(() => { if (context && !tabs.some(item => item.value === tab)) setTab("members"); }, [context, tab, tabs]);
  useEffect(() => { alive.current = true; return () => { alive.current = false; loadVersion.current++; }; }, []);
  const load = useCallback(async () => {
    const version = ++loadVersion.current;
    setLoading(true); setError("");
    try {
      const mine = await EnterpriseApi.mine();
      if (!alive.current || version !== loadVersion.current) return;
      const current = mine[0];
      const personal = await WalletApi.balance();
      if (!alive.current || version !== loadVersion.current) return;
      setPersonalBalance(personal.totalBalance);
      setContext(current);
      if (!current) { setWallet(undefined); setOwnBalance(undefined); setMembers([]); setOrders([]); return; }
      const id = current.enterprise.id;
      const [summary, balances, recharges, own] = await Promise.all([
        current.permissions.some(permission => permission === "points.manage" || permission === "billing.read") ? EnterpriseApi.wallet(id) : undefined,
        EnterpriseApi.memberBalances(id, page, pageSize),
        current.permissions.some(permission => permission === "billing.read" || permission === "billing.request") ? EnterpriseApi.recharges(id, orderPage, pageSize) : undefined,
        EnterpriseApi.myBalance(id),
      ]);
      if (!alive.current || version !== loadVersion.current) return;
      setWallet(summary); setOwnBalance(own); setMembers(balances.data); setTotal(balances.pagination.total);
      setOrders(recharges?.data || []); setOrderTotal(recharges?.pagination.total || 0);
    } catch (caught) {
      if (alive.current && version === loadVersion.current) {
        const normalized = normalizeStudioError(caught);
        setError(normalized.code === "NOT_FOUND" || /404/.test(normalized.message) ? "企业管理尚未开放。请联系平台确认开通安排。" : normalized.message);
        setWallet(undefined); setMembers([]); setOrders([]);
      }
    } finally { if (alive.current && version === loadVersion.current) setLoading(false); }
  }, [page, orderPage]);
  useEffect(() => { if (authState === "ok") void load(); }, [authState, load]);
  useEffect(() => {
    const refreshWhenVisible = () => { if (document.visibilityState === "visible" && authState === "ok" && !mutationLock.current) void load(); };
    window.addEventListener("focus", refreshWhenVisible);
    return () => window.removeEventListener("focus", refreshWhenVisible);
  }, [authState, load]);

  const mutate = async (action: () => Promise<void>) => {
    if (mutationLock.current) return;
    mutationLock.current = true; setBusy(true); setActionError(""); setSuccess("");
    try { await action(); }
    catch (caught) { setActionError(errorText(caught)); }
    finally { mutationLock.current = false; if (alive.current) setBusy(false); }
  };
  const openTransfer = (kind: Direction) => {
    setDirection(kind); setAmount(null); setReclaimAll(false); setDraft(undefined); setStale(false); setActionError("");
  };
  const previewTransfer = async () => {
    if (!context || !direction) return;
    const items = selected.map(memberId => ({ memberId, amount: direction === "reclaim" && reclaimAll ? null : amount }));
    await mutate(async () => {
      const preview = await EnterpriseApi.previewPoints(context.enterprise.id, direction, { items });
      setDraft({ direction, items, preview, clientRequestId: requestId() }); setStale(false);
    });
  };
  const submitTransfer = async () => {
    if (!context || !draft || stale) return;
    await mutate(async () => {
      try {
        await EnterpriseApi.transferPoints(context.enterprise.id, draft.direction, { clientRequestId: draft.clientRequestId, confirmationFingerprint: draft.preview.confirmationFingerprint, items: draft.items });
      } catch (caught) {
        if (normalizeStudioError(caught).code === "ENTERPRISE_POINTS_PREVIEW_STALE") setStale(true);
        throw caught;
      }
      setDirection(undefined); setDraft(undefined); setSelected([]);
      setSuccess(`${draft.direction === "allocate" ? "分配" : "回收"}完成，共 ${number(draft.preview.totalAmount)} 积分。`);
      await load();
    });
  };
  const requestRecharge = async () => {
    if (!context) return;
    await mutate(async () => {
      rechargeKey.current ||= requestId();
      await EnterpriseApi.requestRecharge(context.enterprise.id, { clientRequestId: rechargeKey.current, note: note.trim() });
      rechargeKey.current = undefined; setRechargeOpen(false); setNote(""); setTab("recharges");
      setSuccess("充值申请已提交，金额与积分由平台财务核准后入账。"); await load();
    });
  };
  const eligible = (member: EnterpriseMemberBalance) => member.status !== "removed" && (context?.member.role === "owner" || (member.role === "member" && member.userId !== context?.member.userId));
  const selectedMembers = members.filter(member => selected.includes(member.memberId));
  const myBalance = ownBalance;
  const closeTransfer = () => { if (!busy) { setDirection(undefined); setDraft(undefined); setActionError(""); } };

  if (authState === "no-platform") return <PlatformGateScreen />;
  return <ConfigProvider theme={{ token: { colorPrimary: "#192229", borderRadius: 8, fontFamily: "var(--ip-ui, sans-serif)" }, components: { Table: { rowSelectedBg: "#eeefef", rowSelectedHoverBg: "#e5e7e8" } } }}>
    <StudioPage title="企业管理" description={context ? `${context.enterprise.name} · ${roleName[context.member.role]}` : "管理企业积分、成员分配与充值记录。"} className="enterprise-workspace" actions={<><Link className="ip-brand-secondary" href="/me">我的账号</Link><Button icon={<RefreshCw size={15}/>} aria-label="刷新企业数据" loading={loading} disabled={busy || authState !== "ok"} onClick={() => void load()}>刷新</Button></>}>
      {success && <Alert type="success" showIcon title={success} closable onClose={() => setSuccess("")} />}
      {error ? <Alert type="error" showIcon title="暂时无法读取企业数据" description={error} action={<Button size="small" onClick={() => void load()}>重试</Button>} /> : loading || authState !== "ok" ? <Skeleton active paragraph={{ rows: 8 }} /> : !context ? <section className="enterprise-empty">
        <Empty description="你还没有加入企业" />
        <p>创建企业后，平台财务可向企业充值，再由主账号分配给成员。每个人仍需按现有规则开通数字资产产品。</p>
        <div className="enterprise-onboarding"><div><h2>创建企业</h2><label htmlFor="enterprise-name">企业名称</label><Input id="enterprise-name" value={name} maxLength={100} onChange={e => { setName(e.target.value); createKey.current = undefined; }} placeholder="输入企业名称" disabled={busy} /><Button type="primary" loading={busy} disabled={!name.trim()} onClick={() => void mutate(async () => { createKey.current ||= requestId(); await EnterpriseApi.create({ name: name.trim(), clientRequestId: createKey.current }); createKey.current = undefined; await load(); })}>创建企业</Button></div><div><h2>接受邀请</h2><label htmlFor="enterprise-token">邀请口令</label><Input.Password id="enterprise-token" value={inviteToken} onChange={e => setInviteToken(e.target.value)} placeholder="粘贴主账号提供的口令" disabled={busy} autoComplete="off" /><Button loading={busy} disabled={!inviteToken.trim()} onClick={() => void mutate(async () => { await EnterpriseApi.accept({ token: inviteToken.trim() }); setInviteToken(""); await load(); })}>加入企业</Button></div></div>
        {actionError && <Alert type="error" title={actionError} showIcon />}
      </section> : <>
        <section className="enterprise-own-balances" aria-label="我的两份积分"><div><span>我的个人积分</span><strong>{personalBalance === undefined ? "读取中" : number(personalBalance)}</strong><small>个人充值与消费，企业无权回收</small></div><div><span>我的企业积分</span><strong>{myBalance ? number(myBalance.totalBalance) : "暂未读取"}</strong><small>{context.member.status === "suspended" ? "已停用，仍可选择个人积分创作" : `由 ${context.enterprise.name} 分配，可由企业回收`}</small></div></section>
        {context.member.status === "suspended" && <Alert type="warning" showIcon title="企业积分使用已停用" description="你仍可查看本人记录，并选择个人积分继续创作。企业在途任务按原账户结算。" />}
        {wallet && <section className="enterprise-balances" aria-label="企业积分汇总">{[
          ["企业待分配积分", wallet.unallocated, "可分配给成员"], ["成员可用积分", wallet.allocated, "已分配，仍归企业"], ["冻结积分", wallet.pending, "在途任务占用，不可回收"], ["实际消耗", wallet.spent, "已结算的企业积分"],
        ].map(([label, value, help]) => <div key={label}><span>{label}</span><strong>{number(value as number)}</strong><small>{help}</small></div>)}</section>}
        {!wallet && myBalance && <section className="enterprise-balances" aria-label="我的企业积分"><div><span>我的可用企业积分</span><strong>{number(myBalance.totalBalance)}</strong><small>企业分配，可由企业回收</small></div><div><span>我的冻结积分</span><strong>{number(myBalance.pendingBalance)}</strong><small>在途任务占用，不可回收</small></div></section>}
        <StudioPageFilters label="企业管理分类" value={tab} onChange={setTab} items={tabs} />
        {["team", "policy", "lifecycle"].includes(tab) ? <EnterpriseManagement context={context} section={tab as "team" | "policy" | "lifecycle"} onChanged={load} /> : ["transfers", "usage", "audit"].includes(tab) ? <EnterpriseReports context={context} kind={tab as "transfers" | "usage" | "audit"} /> : tab === "members" ? <section aria-label="成员企业积分">
          <div className="enterprise-section-heading"><div><h2>{canManage ? "积分分配与回收" : canReadTeam ? "成员企业积分" : "企业积分"}</h2><p>企业积分与个人积分独立。回收仅处理可用余额，冻结积分保留原任务结算。</p></div>{canRequest && <Button onClick={() => { setRechargeOpen(true); setActionError(""); }}>申请充值</Button>}</div>
          {canManage && <div className="enterprise-batch-bar"><span aria-live="polite">{selected.length ? `已选择 ${selected.length} 人` : "勾选成员，可单人或批量操作"}</span><div><Button type="primary" icon={<ArrowUpRight size={15}/>} disabled={!selected.length || busy || selectedMembers.some(member => member.status !== "active")} onClick={() => openTransfer("allocate")}>分配积分</Button><Button icon={<ArrowDownLeft size={15}/>} disabled={!selected.length || busy} onClick={() => openTransfer("reclaim")}>回收积分</Button>{selected.length > 0 && <Button type="text" disabled={busy} onClick={() => setSelected([])}>清除选择</Button>}</div></div>}
          {canManage && selectedMembers.some(member => member.status !== "active") && <p className="enterprise-selection-hint">所选成员包含已停用成员，可回收积分；恢复后才能继续分配。</p>}
          <Table<EnterpriseMemberBalance> className="enterprise-member-table" rowKey="memberId" dataSource={members} pagination={false} scroll={{ x: 660 }} locale={{ emptyText: "暂无成员积分记录" }} rowSelection={canManage ? { selectedRowKeys: selected, onChange: keys => setSelected(keys.map(String)), getCheckboxProps: member => ({ disabled: !eligible(member), "aria-label": `选择${member.displayName}` }) } : undefined} columns={[
            { title: "成员", key: "member", render: (_, member) => <div className="enterprise-member-name"><strong>{member.displayName}</strong><small>{roleName[member.role]}</small></div> },
            { title: "状态", dataIndex: "status", render: (status: EnterpriseMemberBalance["status"]) => <Tag>{statusName[status]}</Tag> },
            { title: "可用企业积分", dataIndex: "totalBalance", align: "right", render: value => <span className="enterprise-number">{number(value)}</span> },
            { title: "冻结积分", dataIndex: "pendingBalance", align: "right", render: value => <span className="enterprise-number">{number(value)}</span> },
          ]} />
          <div className="enterprise-mobile-hint">可横向滑动查看完整积分信息。</div>
          <Pagination className="enterprise-pagination" current={page + 1} pageSize={pageSize} total={total} showSizeChanger={false} hideOnSinglePage disabled={busy} onChange={next => { setSelected([]); setPage(next - 1); }} />
        </section> : <section aria-label="企业充值记录">
          <div className="enterprise-section-heading"><div><h2>{canBilling ? "充值记录" : "我的充值申请"}</h2><p>{canBilling ? "申请提交后由平台财务登记收款与入账积分；退款保留原订单记录。" : "这里仅展示你发起的申请，核准后积分进入企业待分配余额。"}</p></div>{canRequest && <Button type="primary" onClick={() => { setRechargeOpen(true); setActionError(""); }}>申请充值</Button>}</div>
          <Table<EnterpriseRechargeOrder> rowKey="id" dataSource={orders} pagination={false} scroll={{ x: 760 }} locale={{ emptyText: "暂无充值申请，可先提交一笔充值申请" }} columns={[
            { title: "申请时间", dataIndex: "createdAt", render: value => new Date(value).toLocaleString("zh-CN") },
            { title: "入账积分", dataIndex: "credits", align: "right", render: (value, order) => order.status === "pending" ? "待核准" : order.status === "rejected" ? "未入账" : number(value) },
            { title: "实收金额", dataIndex: "priceCents", align: "right", render: (value, order) => order.status === "pending" ? "待核准" : order.status === "rejected" ? "未登记" : `¥${(value / 100).toFixed(2)}` },
            { title: "状态", dataIndex: "status", render: (value: EnterpriseRechargeOrder["status"]) => <Tag>{rechargeStatus[value]}</Tag> },
            { title: "已退积分", dataIndex: "refundedCredits", align: "right", render: value => number(value || 0) },
            { title: "备注", dataIndex: "note", render: value => value || "未填写" },
          ]} />
          <Pagination className="enterprise-pagination" current={orderPage + 1} pageSize={pageSize} total={orderTotal} showSizeChanger={false} hideOnSinglePage disabled={busy} onChange={next => setOrderPage(next - 1)} />
        </section>}
      </>}

      <Modal open={!!direction} title={`${direction === "allocate" ? "分配" : "回收"}企业积分`} getContainer={studioOverlayContainer} onCancel={closeTransfer} mask={{ closable: !busy }} closable={!busy} footer={draft ? <><Button disabled={busy} onClick={() => { setDraft(undefined); setStale(false); setActionError(""); }}>返回修改</Button>{stale ? <Button type="primary" loading={busy} onClick={() => void previewTransfer()}>重新预览</Button> : <Button type="primary" loading={busy} onClick={() => void submitTransfer()}>确认{direction === "allocate" ? "分配" : "回收"} {number(draft.preview.totalAmount)} 积分</Button>}</> : <><Button disabled={busy} onClick={closeTransfer}>取消</Button><Button type="primary" loading={busy} disabled={!(direction === "reclaim" && reclaimAll) && !(Number.isSafeInteger(amount) && (amount || 0) > 0)} onClick={() => void previewTransfer()}>预览本次操作</Button></>}>
        <div className="enterprise-transfer-form">{!draft ? <>
          <p>已选择 {selected.length} 人：{selectedMembers.map(member => member.displayName).join("、")}</p>
          <label htmlFor="enterprise-transfer-amount">每人{direction === "allocate" ? "分配" : "回收"}积分</label>
          <InputNumber id="enterprise-transfer-amount" value={amount} precision={0} min={1} max={2147483647} disabled={busy || reclaimAll} onChange={value => setAmount(value)} placeholder="输入正整数" style={{ width: "100%" }} />
          {direction === "reclaim" && <Checkbox checked={reclaimAll} disabled={busy} onChange={e => setReclaimAll(e.target.checked)}>回收所选成员全部可用企业积分</Checkbox>}
          <p>提交前会核对每人余额与本次总额。整批成功或整批失败，不会扣用个人积分。</p>
        </> : <>
          <p>本次共 {draft.preview.memberCount} 人，合计 <strong>{number(draft.preview.totalAmount)} 积分</strong>。</p>
          <p>企业待分配积分：{number(draft.preview.rootAvailableBefore)} → {number(draft.preview.rootAvailableAfter)}</p>
          <Table rowKey="memberId" size="small" pagination={false} dataSource={draft.preview.items} columns={[
            { title: "成员", key: "name", render: (_, item) => members.find(member => member.memberId === item.memberId)?.displayName || item.memberId },
            { title: "本次积分", dataIndex: "amount", align: "right", render: number },
            { title: "操作后可用", dataIndex: "availableAfter", align: "right", render: number },
          ]} />
          <p>{direction === "reclaim" ? "冻结积分不参与本次回收。" : "本次积分仍归企业，可在使用前回收。"}余额发生变化时，需重新预览确认。</p>
        </>}{actionError && <Alert type="error" showIcon title={actionError} />}</div>
      </Modal>
      <Modal open={rechargeOpen} title="申请企业充值" getContainer={studioOverlayContainer} onCancel={() => { if (!busy) setRechargeOpen(false); }} mask={{ closable: !busy }} closable={!busy} okText="提交申请" cancelText="取消" confirmLoading={busy} okButtonProps={{ disabled: !note.trim() }} onOk={() => void requestRecharge()}>
        <div className="enterprise-transfer-form"><p>申请提交至平台财务，核准后积分进入“企业待分配积分”。此操作不会直接增加积分。</p><label htmlFor="enterprise-recharge-note">充值说明</label><Input.TextArea id="enterprise-recharge-note" value={note} maxLength={500} showCount rows={4} disabled={busy} placeholder="填写联系人、预计充值金额或收款沟通信息" onChange={e => { setNote(e.target.value); rechargeKey.current = undefined; }} />{actionError && <Alert type="error" showIcon title={actionError} />}</div>
      </Modal>
    </StudioPage>
  </ConfigProvider>;
}
