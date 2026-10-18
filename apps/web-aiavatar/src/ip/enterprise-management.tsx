"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Alert, Button, Checkbox, Empty, Input, InputNumber, Modal, Pagination, Select, Skeleton, Table, Tag } from "antd";
import type { EnterpriseCapabilities, EnterpriseContext, EnterpriseInvitation, EnterpriseMember, EnterpriseOwnershipTransfer, EnterprisePolicy, EnterpriseLifecyclePreview, EnterpriseLifecycleAction } from "@ai-star-eco/types/enterprise";
import { EnterpriseApi } from "@/canvas-bridge/enterprise-api";
import { fetchModels } from "@/canvas-bridge/api";
import { studioCapabilities, studioSpeechCatalog, studioLipSyncCatalog } from "@/canvas-bridge/studio-api";
import { normalizeStudioError } from "./studio-errors";
import { studioOverlayContainer } from "./studio-overlay";
import { enterpriseInvitationLink } from "./enterprise-invitation-link";

const roleNames = { owner: "主账号", manager: "管理员", member: "成员" };
const stateNames = { active: "正常", suspended: "已停用", removed: "已退出" };
const invitationStates = { pending: "有效，可多人加入", revoked: "已撤销", expired: "已过期" };
const actionNames = { suspend: "停用成员", resume: "恢复成员", remove: "移除成员", leave: "退出企业", close: "关闭企业" };
const n = (value: number) => value.toLocaleString("zh-CN");
const time = (value: string) => new Date(value).toLocaleString("zh-CN");
const errorText = (error: unknown) => normalizeStudioError(error).message;
const emptyCapabilities: EnterpriseCapabilities = { pointsManage: false, billingRead: false, rechargeRequest: false };

type Props = { context: EnterpriseContext; section: "team" | "policy" | "lifecycle"; onChanged: () => Promise<void> };

/** Management uses current server permissions and versioned edits; member assets never enter this view. */
export function EnterpriseManagement({ context, section, onChanged }: Props) {
  const id = context.enterprise.id;
  const owner = context.member.role === "owner";
  const canInvite = context.permissions.includes("member.invite");
  const canManage = context.permissions.includes("member.manage");
  const canPolicy = context.permissions.includes("policy.manage");
  const [members, setMembers] = useState<EnterpriseMember[]>([]);
  const [invitations, setInvitations] = useState<EnterpriseInvitation[]>([]);
  const [transfers, setTransfers] = useState<EnterpriseOwnershipTransfer[]>([]);
  const [page, setPage] = useState(0), [total, setTotal] = useState(0);
  const [invitationPage, setInvitationPage] = useState(0), [invitationTotal, setInvitationTotal] = useState(0);
  const [policy, setPolicy] = useState<EnterprisePolicy>();
  const [modelOptions, setModelOptions] = useState<{ value: string; label: string }[]>([]);
  const [allowed, setAllowed] = useState<string[]>([]), [maxActive, setMaxActive] = useState<number | null>(null);
  const [loading, setLoading] = useState(true), [busy, setBusy] = useState(false);
  const [error, setError] = useState(""), [success, setSuccess] = useState("");
  const [token, setToken] = useState("");
  const [inviteDays, setInviteDays] = useState<90 | 365>(90);
  const [inviteExpires, setInviteExpires] = useState("");
  const [edit, setEdit] = useState<EnterpriseMember>();
  const [role, setRole] = useState<"manager" | "member">("member");
  const [capabilities, setCapabilities] = useState<EnterpriseCapabilities>(emptyCapabilities);
  const [ownershipTarget, setOwnershipTarget] = useState<EnterpriseMember>();
  const [lifecycle, setLifecycle] = useState<{ action: EnterpriseLifecycleAction; member?: EnterpriseMember; preview: EnterpriseLifecyclePreview; clientRequestId: string }>();
  const mutation = useRef(false), revision = useRef(0);
  const invitationKey = useRef<string | undefined>(undefined);
  const ownershipKey = useRef<{ memberId: string; key: string } | undefined>(undefined);
  const load = useCallback(async () => {
    const current = ++revision.current; setLoading(true); setError("");
    try {
      if (section === "policy") {
        const [setting, models, capability, speech, lipSync] = await Promise.all([EnterpriseApi.policy(id), fetchModels(), studioCapabilities(), studioSpeechCatalog(), studioLipSyncCatalog()]);
        if (current !== revision.current) return;
        const options = [...models.image.map(m => ({ value: m.endpointId, label: `图片 · ${m.name}` })), ...models.video.map(m => ({ value: m.endpointId, label: `视频 · ${m.name}` })), ...(capability.textModels || []).map(m => ({ value: m.endpointId, label: `文本 · ${m.name}` }))];
        // Catalogs own their human labels. No provider key or endpoint ID is presented as a model name.
        for (const catalog of [speech, lipSync]) {
          const entries = (catalog as unknown as { models?: { endpointId: string; name: string }[] }).models || [];
          options.push(...entries.map(m => ({ value: m.endpointId, label: `音视频 · ${m.name}` })));
        }
        setModelOptions([...new Map(options.map(option => [option.value, option])).values()]);
        setPolicy(setting); setAllowed(setting.allowedEndpointIds); setMaxActive(setting.maxActiveJobs);
      } else {
        const [memberResult, invitationResult, ownershipResult] = await Promise.all([
          canManage || owner ? EnterpriseApi.members(id, page, 20) : undefined,
          canInvite ? EnterpriseApi.invitations(id, invitationPage, 10) : undefined,
          EnterpriseApi.ownershipTransfers(id, 0, 50),
        ]);
        if (current !== revision.current) return;
        setMembers(memberResult?.data || []); setTotal(memberResult?.pagination.total || 0);
        setInvitations(invitationResult?.data || []); setInvitationTotal(invitationResult?.pagination.total || 0);
        setTransfers(ownershipResult.data);
      }
    } catch (caught) { if (current === revision.current) setError(errorText(caught)); }
    finally { if (current === revision.current) setLoading(false); }
  }, [id, section, page, invitationPage, canManage, canInvite, owner]);
  useEffect(() => { void load(); return () => { revision.current++; }; }, [load]);
  const mutate = async (operation: () => Promise<void>) => {
    if (mutation.current) return; mutation.current = true; setBusy(true); setError(""); setSuccess("");
    try { await operation(); } catch (caught) { setError(errorText(caught)); }
    finally { mutation.current = false; setBusy(false); }
  };
  const openLifecycle = (action: EnterpriseLifecycleAction, member?: EnterpriseMember) => void mutate(async () => {
    const preview = await EnterpriseApi.previewLifecycle(id, { action, ...(member ? { memberId: member.id } : {}) });
    setLifecycle({ action, member, preview, clientRequestId: crypto.randomUUID() });
  });
  const canEdit = (member: EnterpriseMember) => member.status !== "removed" && member.role !== "owner" && member.id !== context.member.id && (owner || member.role === "member");
  const refresh = async (message: string) => { setSuccess(message); await load(); await onChanged(); };
  const incomingTransfers = transfers.filter(transfer => transfer.status === "pending" && transfer.toUserId === context.member.userId && new Date(transfer.expiresAt).getTime() > Date.now());

  return <section className="enterprise-management" aria-label={section === "policy" ? "企业生成设置" : section === "lifecycle" ? "企业关系管理" : "成员与邀请"}>
    {error && <Alert showIcon type="error" title={error} action={!busy ? <Button size="small" onClick={() => void load()}>重新读取</Button> : undefined} />}
    {success && <Alert showIcon type="success" title={success} closable onClose={() => setSuccess("")} />}
    {incomingTransfers.map(transfer => <Alert key={transfer.id} type="warning" showIcon title="有一项主账号移交等待你接受" description={`接受后你将负责企业成员、资金分配和设置。有效至 ${time(transfer.expiresAt)}。`} action={<Button loading={busy} onClick={() => void mutate(async () => { await EnterpriseApi.acceptOwnership(id, transfer.id); await refresh("已接受主账号移交。"); })}>接受主账号移交</Button>} />)}
    {loading ? <Skeleton active paragraph={{ rows: 6 }} /> : section === "policy" ? <div className="enterprise-policy-form">
      <div className="enterprise-section-heading"><div><h2>企业生成设置</h2><p>仅约束使用企业积分的 Studio 任务。个人积分仍按个人规则使用。</p></div></div>
      <label htmlFor="enterprise-policy-models">允许使用的模型</label>
      <Select id="enterprise-policy-models" aria-label="允许使用的模型" mode="multiple" value={allowed} options={[...modelOptions, ...allowed.filter(value => !modelOptions.some(model => model.value === value)).map(value => ({ value, label: "已下线模型（可移除）" }))]} onChange={setAllowed} disabled={!canPolicy || busy} optionFilterProp="label" placeholder="选择允许的模型" />
      <p>未选择模型时，所有企业积分生成均不可提交。已排队或受理的原任务保留原计费记录。</p>
      <label htmlFor="enterprise-policy-max">每位成员最多在途任务数</label>
      <InputNumber<number> id="enterprise-policy-max" value={maxActive} min={1} max={100} precision={0} disabled={!canPolicy || busy} onChange={setMaxActive} />
      <p>在途包括排队、运行，以及厂商已受理但结果待核对的任务。</p>
      {canPolicy && <Button type="primary" loading={busy} disabled={!policy || !maxActive} onClick={() => void mutate(async () => { if (!policy || !maxActive) return; const updated = await EnterpriseApi.updatePolicy(id, { allowedEndpointIds: allowed, maxActiveJobs: maxActive, version: policy.version }); setPolicy(updated); setSuccess("企业生成设置已保存。"); })}>保存生成设置</Button>}
    </div> : section === "lifecycle" ? <div className="enterprise-lifecycle">
      <h2>企业关系</h2><p>企业积分由企业管理。退出后，你的个人账号、个人积分、画布和作品仍保留；企业积分不会转入个人账户。</p>
      {owner ? <><p>主账号须先将管理责任移交给另一位正常成员，才能退出。关闭企业前需要处理完在途任务、充值申请与剩余积分。</p><Button danger disabled={busy} onClick={() => openLifecycle("close")}>核对关闭企业条件</Button></> : <Button danger disabled={busy} onClick={() => openLifecycle("leave")}>核对并退出企业</Button>}
      {transfers.length > 0 && <><h3>主账号移交记录</h3><Table rowKey="id" pagination={false} dataSource={transfers} scroll={{ x: 520 }} columns={[{ title: "接收人", key: "recipient", render: (_, transfer) => members.find(member => member.userId === transfer.toUserId)?.displayName || (transfer.toUserId === context.member.userId ? "我" : "企业成员") }, { title: "状态", key: "state", render: (_, transfer) => <Tag>{transfer.status === "accepted" ? "已接受" : new Date(transfer.expiresAt).getTime() <= Date.now() ? "已过期" : "待接受"}</Tag> }, { title: "有效期", dataIndex: "expiresAt", render: time }]} /></>}
    </div> : <>
      <div className="enterprise-section-heading"><div><h2>成员与权限</h2><p>管理员只管理普通成员。积分授权不会开放成员的个人钱包、素材或画布。</p></div>{canInvite && <div className="enterprise-invite-actions"><Select aria-label="邀请链接有效期" value={inviteDays} disabled={busy} onChange={value => { setInviteDays(value); invitationKey.current = undefined; }} options={[{ value: 90, label: "90 天有效" }, { value: 365, label: "1 年有效" }]}/><Button type="primary" loading={busy} onClick={() => void mutate(async () => { invitationKey.current ||= crypto.randomUUID(); const result = await EnterpriseApi.invite(id, { clientRequestId: invitationKey.current, validDays: inviteDays }); invitationKey.current = undefined; if (result.token) { setToken(result.token); setInviteExpires(result.invitation.expiresAt); } setSuccess(result.token ? "分享链接已创建，有效期内可供多人加入。" : "邀请已创建；链接仅首次返回，如未保存可重新创建。"); await load(); })}>创建分享链接</Button></div>}</div>
      {canManage || owner ? <><Table rowKey="id" dataSource={members} pagination={false} scroll={{ x: 860 }} locale={{ emptyText: "暂无成员" }} columns={[
        { title: "成员", dataIndex: "displayName" }, { title: "角色", dataIndex: "role", render: (value: EnterpriseMember["role"]) => roleNames[value] }, { title: "状态", dataIndex: "status", render: (value: EnterpriseMember["status"]) => <Tag>{stateNames[value]}</Tag> },
        { title: "附加授权", key: "grants", render: (_, member) => [member.capabilities.pointsManage && "积分管理", member.capabilities.billingRead && "企业账单", member.capabilities.rechargeRequest && "申请充值"].filter(Boolean).join("、") || "无" },
        { title: "操作", key: "actions", render: (_, member) => <div className="enterprise-row-actions">{canEdit(member) && <>{owner && <Button size="small" disabled={busy} onClick={() => { setEdit(member); setRole(member.role === "manager" ? "manager" : "member"); setCapabilities({ ...member.capabilities }); setError(""); }}>角色与授权</Button>}<Button size="small" disabled={busy} onClick={() => openLifecycle(member.status === "suspended" ? "resume" : "suspend", member)}>{member.status === "suspended" ? "恢复" : "停用"}</Button><Button size="small" danger disabled={busy} onClick={() => openLifecycle("remove", member)}>移除</Button></>}{owner && member.id !== context.member.id && member.status === "active" && <Button size="small" disabled={busy} onClick={() => { setOwnershipTarget(member); setError(""); }}>移交主账号</Button>}</div> },
      ]} /><Pagination className="enterprise-pagination" current={page + 1} total={total} pageSize={20} showSizeChanger={false} hideOnSinglePage onChange={value => setPage(value - 1)} /></> : <Empty description="成员只能查看本人企业积分" />}
      {canInvite && <div className="enterprise-invitations"><h3>邀请记录</h3><p>接受邀请后仍需按原有规则开通数字资产产品；加入企业不会自动开通。</p><Table rowKey="id" dataSource={invitations} pagination={false} scroll={{ x: 520 }} locale={{ emptyText: "尚未创建邀请" }} columns={[{ title: "有效至", dataIndex: "expiresAt", render: time }, { title: "状态", key: "status", render: (_, invitation) => <Tag>{invitation.status === "pending" && new Date(invitation.expiresAt).getTime() <= Date.now() ? "已过期" : invitationStates[invitation.status]}</Tag> }, { title: "操作", key: "actions", render: (_, invitation) => invitation.status === "pending" && new Date(invitation.expiresAt).getTime() > Date.now() ? <Button size="small" danger disabled={busy} onClick={() => void mutate(async () => { await EnterpriseApi.revoke(id, invitation.id); await refresh("邀请已撤销。"); })}>撤销邀请</Button> : "无需操作" }]} /><Pagination className="enterprise-pagination" current={invitationPage + 1} pageSize={10} total={invitationTotal} hideOnSinglePage showSizeChanger={false} onChange={value => setInvitationPage(value - 1)} /></div>}
    </>}
    <Modal open={!!token} title="分享企业邀请" getContainer={studioOverlayContainer} onCancel={() => setToken("")} footer={<Button type="primary" onClick={() => setToken("")}>完成</Button>}><div className="enterprise-transfer-form"><p>将链接发给同事或企业群，大家验证手机号后可直接加入「{context.enterprise.name}」。同一链接可供多人使用。</p><p>有效至 {inviteExpires ? time(inviteExpires) : "所选有效期"}，可随时在邀请记录中撤销。</p><Input.TextArea aria-label="企业邀请链接" value={token ? enterpriseInvitationLink(window.location.origin, token) : ""} readOnly autoSize={{ minRows: 3, maxRows: 5 }} /><Button type="primary" onClick={() => void navigator.clipboard.writeText(enterpriseInvitationLink(window.location.origin, token)).then(() => setSuccess("企业邀请链接已复制，可分享给同事。"), () => setError("无法自动复制，请选中链接手动复制。"))}>复制邀请链接</Button><p>链接只在本次创建后显示，请复制保存。加入不会自动开通产品或发放积分。</p></div></Modal>
    <Modal open={!!edit} title={`角色与授权 · ${edit?.displayName || ""}`} getContainer={studioOverlayContainer} onCancel={() => { if (!busy) setEdit(undefined); }} confirmLoading={busy} okText="保存角色与授权" cancelText="取消" onOk={() => void mutate(async () => { if (!edit) return; await EnterpriseApi.updateMember(id, edit.id, { role, capabilities, version: edit.version }); setEdit(undefined); await refresh("成员角色与授权已更新。"); })}><div className="enterprise-transfer-form"><label htmlFor="enterprise-member-role">角色</label><Select id="enterprise-member-role" value={role} onChange={value => { setRole(value); if (value === "member") setCapabilities(current => ({ ...current, pointsManage: false, billingRead: false })); }} options={[{ value: "member", label: "成员" }, { value: "manager", label: "管理员" }]} /><Checkbox checked={capabilities.pointsManage} disabled={role !== "manager" || busy} onChange={event => setCapabilities(current => ({ ...current, pointsManage: event.target.checked }))}>可分配和回收普通成员积分</Checkbox><Checkbox checked={capabilities.billingRead} disabled={role !== "manager" || busy} onChange={event => setCapabilities(current => ({ ...current, billingRead: event.target.checked }))}>可查看企业账单与消费汇总</Checkbox><Checkbox checked={capabilities.rechargeRequest} disabled={busy} onChange={event => setCapabilities(current => ({ ...current, rechargeRequest: event.target.checked }))}>可申请企业充值</Checkbox>{error && <Alert type="error" title={error} />}</div></Modal>
    <Modal open={!!ownershipTarget} title="移交主账号" getContainer={studioOverlayContainer} onCancel={() => { if (!busy) setOwnershipTarget(undefined); }} confirmLoading={busy} okText="发起移交，等待对方接受" cancelText="取消" onOk={() => void mutate(async () => { if (!ownershipTarget) return; if (ownershipKey.current?.memberId !== ownershipTarget.id) ownershipKey.current = { memberId: ownershipTarget.id, key: crypto.randomUUID() }; await EnterpriseApi.requestOwnership(id, { targetMemberId: ownershipTarget.id, clientRequestId: ownershipKey.current.key }); ownershipKey.current = undefined; setOwnershipTarget(undefined); await refresh("移交请求已发出。对方接受前，你仍是企业主账号。"); })}><div className="enterprise-transfer-form"><p>将企业管理责任移交给 <strong>{ownershipTarget?.displayName}</strong>。对方需要登录并接受，接受后立即生效。充值订单和企业资金仍归本企业。</p>{error && <Alert type="error" title={error} />}</div></Modal>
    <Modal open={!!lifecycle} title={lifecycle ? actionNames[lifecycle.action] : "企业关系"} getContainer={studioOverlayContainer} onCancel={() => { if (!busy) setLifecycle(undefined); }} confirmLoading={busy} okButtonProps={{ danger: lifecycle?.action !== "resume", disabled: !lifecycle?.preview.canProceed }} okText={`确认${lifecycle ? actionNames[lifecycle.action] : "操作"}`} cancelText="取消" onOk={() => void mutate(async () => { if (!lifecycle) return; await EnterpriseApi.lifecycle(id, { action: lifecycle.action, ...(lifecycle.member ? { memberId: lifecycle.member.id } : {}), clientRequestId: lifecycle.clientRequestId, confirmationFingerprint: lifecycle.preview.confirmationFingerprint }); setLifecycle(undefined); await refresh("企业关系已更新，余额与任务仍按原账户结算。"); })}>{lifecycle && <div className="enterprise-transfer-form"><p>{lifecycle.member?.displayName || context.enterprise.name}</p><dl className="enterprise-consequences"><dt>{lifecycle.action === "resume" ? "当前可用企业积分" : lifecycle.action === "close" ? "剩余可用企业积分" : "将回收可用企业积分"}</dt><dd>{n(lifecycle.preview.availableCredits)}</dd><dt>在途冻结积分</dt><dd>{n(lifecycle.preview.pendingCredits)}</dd><dt>在途任务</dt><dd>{n(lifecycle.preview.activeJobs)} 项</dd><dt>{lifecycle.action === "resume" ? "尚未受理任务" : "未受理，提交后取消"}</dt><dd>{n(lifecycle.preview.cancellableJobs)} 项</dd><dt>已受理，继续原任务结算</dt><dd>{n(lifecycle.preview.acceptedJobs)} 项</dd></dl><p>{lifecycle.action === "resume" ? "恢复后可接收分配并使用企业积分。此前退回并归集的积分不会自动重新分配。" : "已受理任务继续结算，失败释放的积分归原企业；个人积分、画布与作品保留。"}</p>{lifecycle.preview.blockers.map(blocker => <Alert key={blocker} type="warning" showIcon title={blocker} />)}{error && <Alert type="error" title={error} />}</div>}</Modal>
  </section>;
}
