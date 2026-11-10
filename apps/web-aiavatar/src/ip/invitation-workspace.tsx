"use client";

// 邀请朋友（2026-11-10 起不再单独成页）：电脑版在总览上放一张卡片，邀请记录在抽屉里看（/me/invitations 打开总览并展开抽屉）；
// 手机版 /me/invitations 是一整页，卡片和记录上下排。数据和写入权限都来自账号中心（ID）。

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowUpRight, Check, Copy, RefreshCw, UserRound } from "lucide-react";
import { ApiError, idIssuer, InvitationApi, isIdMode } from "@ai-star-eco/api-client";
import type { InvitationAccount, InvitationOverview } from "@ai-star-eco/types/invitation";
import { useRequireAuth } from "@/components/hub/auth";
import { formatDateTime } from "@/lib/datetime";

function readableError(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.code === "IDENTITY_IMPERSONATION_UNSUPPORTED") return "当前为运营查看状态，请返回本人账号后管理邀请。";
    if (error.code === "DEMO_ACCOUNT_READONLY") return "体验账号不能生成邀请链接，请使用自己的账号。";
    if (error.status === 401) return "登录状态已失效，请重新登录。";
    if (error.status === 403) return "当前账号无法执行这项操作。";
    if (error.code === "AUTH_REFRESH_UNAVAILABLE") return "暂时无法确认登录状态，请稍后重试。";
  }
  return "暂时无法连接账号服务，请稍后重试。";
}

function Avatar({ person }: { person: InvitationAccount }) {
  const [failed, setFailed] = useState(false);
  let url = "";
  try {
    const parsed = person.avatarUrl ? new URL(person.avatarUrl, idIssuer()) : null;
    if (parsed && ["https:", "http:"].includes(parsed.protocol)) url = parsed.href;
  } catch { /* 无可用头像时使用统一账号图标。 */ }
  return <span className="invitation-account-avatar" aria-hidden="true">{url && !failed
    ? <img src={url} alt="" referrerPolicy="no-referrer" onError={() => setFailed(true)} />
    : <UserRound size={18}/>}</span>;
}

export const invitationsEnabled = () => isIdMode() && Boolean(idIssuer());

/** 邀请数据与操作。{@code ready} 为 false 时不请求（未登录或旧登录方式）。 */
export function useInvitations(ready: boolean) {
  const enabled = invitationsEnabled();
  const [data, setData] = useState<InvitationOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [actionError, setActionError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState<"generate" | "copy" | null>(null);
  const requestVersion = useRef(0);
  const linkInput = useRef<HTMLInputElement>(null);
  const actionLock = useRef(false);

  const load = useCallback(async (page: number) => {
    const version = ++requestVersion.current;
    setLoading(true); setLoadError("");
    try {
      const next = await InvitationApi.getMyInvitations(page);
      if (version === requestVersion.current) setData(next);
    } catch (error) {
      if (version === requestVersion.current) setLoadError(readableError(error));
    } finally { if (version === requestVersion.current) setLoading(false); }
  }, []);

  useEffect(() => {
    if (enabled && ready) void load(0);
    return () => { requestVersion.current++; };
  }, [enabled, ready, load]);

  const generate = async () => {
    if (actionLock.current || !data?.canInvite) return;
    actionLock.current = true; setBusy("generate"); setActionError(""); setNotice("");
    try {
      const result = await InvitationApi.ensureInvitationCode();
      setData(current => current ? { ...current, inviteCode: result.inviteCode } : current);
      setNotice("邀请链接已生成。");
    } catch (error) { setActionError(readableError(error)); }
    finally { actionLock.current = false; setBusy(null); }
  };

  const url = data?.inviteCode ? `${typeof window === "undefined" ? "" : window.location.origin}/invite/${encodeURIComponent(data.inviteCode)}` : "";
  const copy = async () => {
    if (!url || actionLock.current) return;
    actionLock.current = true; setBusy("copy"); setActionError(""); setNotice("");
    try {
      if (!navigator.clipboard?.writeText) throw new Error("无法自动复制");
      await navigator.clipboard.writeText(url);
      setNotice("邀请链接已复制。");
    } catch {
      linkInput.current?.focus(); linkInput.current?.select();
      setActionError("无法自动复制，已选中链接，请手动复制。");
    } finally { actionLock.current = false; setBusy(null); }
  };

  return { enabled, data, loading, loadError, actionError, notice, busy, url, linkInput, load, generate, copy };
}
export type Invitations = ReturnType<typeof useInvitations>;

function LoadError({ inv }: { inv: Invitations }) {
  if (!inv.loadError) return null;
  return <div className="invitation-feedback invitation-feedback-error" role="alert"><div><strong>{inv.data ? "邀请记录刷新失败" : "邀请记录加载失败"}</strong><p>{inv.loadError}{inv.data && " 当前显示的是上次加载的记录。"}</p></div>
    <button type="button" className="account-button" disabled={inv.loading} onClick={() => void inv.load(inv.data?.page ?? 0)}>重试</button></div>;
}

/** 邀请链接：生成、复制、预览。总览卡片和手机整页共用。 */
export function InvitationLink({ inv }: { inv: Invitations }) {
  const { data, url, busy, notice, actionError } = inv;
  if (!data) return null;
  return <div className="invitation-link">
    {data.canInvite ? url ? <>
      <label className="invitation-input-label" htmlFor="studio-invitation-link">邀请链接</label>
      <div className="invitation-link-controls">
        <input ref={inv.linkInput} id="studio-invitation-link" type="text" readOnly value={url} spellCheck={false}/>
        <button type="button" className="account-go" disabled={Boolean(busy)} onClick={() => void inv.copy()}>{notice.startsWith("邀请链接已复制") ? <Check size={15}/> : <Copy size={15}/>}复制链接</button>
        <a className="account-button" href={url} target="_blank" rel="noopener noreferrer">预览邀请页<ArrowUpRight size={14}/></a>
      </div>
    </> : <div className="invitation-generate"><span className="account-muted">生成你的专属链接，发给想邀请的朋友。</span>
      <button type="button" className="account-go" disabled={Boolean(busy)} onClick={() => void inv.generate()}>{busy === "generate" ? "正在生成…" : "生成邀请链接"}</button></div>
    : <p className="account-muted">体验账号由多人共用。请使用自己的账号邀请朋友。</p>}
    {notice && <p className="invitation-feedback invitation-feedback-success" role="status">{notice}</p>}
    {actionError && <p className="invitation-feedback invitation-feedback-error" role="alert">{actionError}</p>}
  </div>;
}

/** 我的邀请人 + 我邀请的账号（分页）。抽屉和手机整页共用。 */
export function InvitationRecords({ inv }: { inv: Invitations }) {
  const { data, loading, busy } = inv;
  return <>
    <LoadError inv={inv} />
    {!data && !inv.loadError && <p className="account-state" role="status">正在加载邀请记录…</p>}
    {data && <>
      <div className="invitation-inviter">
        <span className="account-muted">我的邀请人</span>
        {data.inviter ? <div className="invitation-account-row"><Avatar key={data.inviter.avatarUrl} person={data.inviter}/><div><strong>{data.inviter.displayName}</strong>{data.invitedAt && <p>邀请于 <time dateTime={data.invitedAt}>{formatDateTime(data.invitedAt)}</time></p>}</div></div>
          : <span>暂无邀请人</span>}
      </div>
      <section aria-labelledby="invitation-records-heading" aria-busy={loading}>
        <div className="invitation-records-head"><h3 id="invitation-records-heading">我邀请的账号</h3><span className="account-muted">共 {data.total} 条记录</span>
          <button type="button" className="account-button" disabled={loading || Boolean(busy)} onClick={() => void inv.load(data.page)}><RefreshCw size={14} className={loading ? "ip-loading-icon" : undefined}/>刷新记录</button></div>
        <p className="account-muted" style={{ marginBottom: 6, fontSize: 12 }}>只记录由你直接邀请注册的账号。邀请不产生分佣或奖励。</p>
        {data.records.length ? <ul className="invitation-records">{data.records.map(record => <li className="invitation-account-row" key={record.id}>
          <Avatar key={record.account.avatarUrl} person={record.account}/>
          <div><strong>{record.account.displayName}</strong>{record.account.status === "merged" && <p>账号已合并，保留注册时的邀请记录</p>}{record.account.status === "suspended" && <p>账号已停用</p>}</div>
          <time dateTime={record.createdAt}>{formatDateTime(record.createdAt)}</time></li>)}</ul>
          : <p className="account-state">{data.total === 0 ? "暂无邀请记录。" : "此页暂无记录。"}</p>}
        {(data.page > 0 || (data.page + 1) * data.pageSize < data.total) && <nav className="account-pager" aria-label="邀请记录翻页">
          <button type="button" className="account-button" disabled={loading || Boolean(busy) || data.page === 0} onClick={() => void inv.load(data.page - 1)}>上一页</button>
          <span>第 {data.page + 1} 页</span>
          <button type="button" className="account-button" disabled={loading || Boolean(busy) || (data.page + 1) * data.pageSize >= data.total} onClick={() => void inv.load(data.page + 1)}>下一页</button></nav>}
      </section>
    </>}
  </>;
}

/** 旧登录方式：邀请依赖账号中心，明确说明用不了，不请求、不造数据。 */
export function InvitationUnavailable() {
  return <section className="account-state"><h2 style={{ fontSize: 15, fontWeight: 500 }}>请使用统一账号登录</h2><span>邀请链接和记录随账号保存，当前登录方式暂不支持。</span><Link className="account-button" href="/me">返回我的账号</Link></section>;
}

/** 手机版 /me/invitations：链接和记录同一页。 */
export function InvitationWorkspace() {
  const enabled = invitationsEnabled();
  // 邀请属于全局账号能力，读取不以某个产品开通为条件。
  const authState = useRequireAuth(enabled, false);
  const inv = useInvitations(authState === "ok");
  if (!enabled) return <InvitationUnavailable />;
  return <div className="invitation-workspace">
    <section className="account-card invitation-card"><h2 className="invitation-card-title">我的邀请链接</h2><p className="account-muted">朋友通过链接注册后，会出现在下面的邀请记录里。</p>{inv.data ? <InvitationLink inv={inv} /> : null}</section>
    <InvitationRecords inv={inv} />
  </div>;
}
