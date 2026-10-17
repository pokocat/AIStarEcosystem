"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowLeft, ArrowUpRight, Check, Copy, Link2, RefreshCw, UserRound } from "lucide-react";
import { ApiError, idIssuer, InvitationApi, isIdMode } from "@ai-star-eco/api-client";
import type { InvitationAccount, InvitationOverview } from "@ai-star-eco/types/invitation";
import { useRequireAuth } from "@/components/hub/auth";
import { AccountWorkspace } from "@/shell/account-workspace";

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

function dateText(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "时间暂不可用";
  return new Intl.DateTimeFormat("zh-CN", { year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false }).format(date);
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
    : <UserRound size={21}/>}</span>;
}

/** Studio 展示账号关系与本人操作；所有数据和写入权限来自 ID。 */
export function InvitationWorkspace() {
  const enabled = isIdMode() && Boolean(idIssuer());
  // 邀请属于全局账号能力，读取不以某个产品开通为条件。
  const authState = useRequireAuth(enabled, false);
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
    if (enabled && authState === "ok") void load(0);
    return () => { requestVersion.current++; };
  }, [enabled, authState, load]);

  const generate = async () => {
    if (actionLock.current || !data?.canInvite) return;
    actionLock.current = true; setBusy("generate"); setActionError(""); setNotice("");
    try {
      const result = await InvitationApi.ensureInvitationCode();
      setData(current => current ? { ...current, inviteCode: result.inviteCode } : current);
      setNotice("邀请链接已生成，可以发给朋友了。");
    } catch (error) { setActionError(readableError(error)); }
    finally { actionLock.current = false; setBusy(null); }
  };

  const url = data?.inviteCode ? `${idIssuer()}/i/${encodeURIComponent(data.inviteCode)}` : "";
  const copy = async () => {
    if (!url || actionLock.current) return;
    actionLock.current = true; setBusy("copy"); setActionError(""); setNotice("");
    try {
      if (!navigator.clipboard?.writeText) throw new Error("无法自动复制");
      await navigator.clipboard.writeText(url);
      setNotice("邀请链接已复制，可以发给朋友了。");
    } catch {
      linkInput.current?.focus(); linkInput.current?.select();
      setActionError("无法自动复制，已选中链接，请手动复制。");
    } finally { actionLock.current = false; setBusy(null); }
  };

  return <div className="ip-brand-surface invitation-workspace"><AccountWorkspace activePage="invitations">
    <Link className="invitation-mobile-back" href="/me"><ArrowLeft size={16}/>返回我的账号</Link>
    <header className="account-overview-header invitation-heading"><div><h1>邀请朋友</h1><p>分享一个注册链接，在这里查看邀请记录。</p></div>
      {enabled && <button type="button" className="ip-brand-secondary" disabled={loading || Boolean(busy) || authState !== "ok"} onClick={() => void load(data?.page ?? 0)}><RefreshCw size={15} className={loading ? "ip-loading-icon" : undefined}/>刷新记录</button>}
    </header>
    {!enabled ? <section className="invitation-state"><h2>请使用统一账号登录</h2><p>邀请链接和记录随账号保存。当前登录方式尚不支持查看。</p><Link className="ip-brand-secondary" href="/me">返回我的账号</Link></section> : <>
      {loadError && <div className="invitation-feedback invitation-feedback-error" role="alert"><div><strong>{data ? "邀请记录刷新失败" : "暂时无法读取邀请记录"}</strong><p>{loadError}{data && " 当前仍显示上次读取的记录。"}</p></div><button type="button" className="ip-brand-secondary" disabled={loading} onClick={() => void load(data?.page ?? 0)}>重试</button></div>}
      {!data && !loadError && <p className="invitation-state" role="status">正在读取邀请记录…</p>}
      {data && <>
        <section className="invitation-link-section" aria-labelledby="invitation-link-heading">
          <div className="invitation-section-heading"><div><h2 id="invitation-link-heading">我的邀请链接</h2><p>朋友通过链接注册新账号后，会留下邀请记录。已有账号登录不新增记录。</p></div><Link2 size={22} aria-hidden="true"/></div>
          {data.canInvite ? url ? <>
            <label className="invitation-input-label" htmlFor="studio-invitation-link">邀请链接</label>
            <div className="invitation-link-controls"><input ref={linkInput} id="studio-invitation-link" type="text" readOnly value={url} spellCheck={false}/><button type="button" className="ip-brand-button" disabled={Boolean(busy)} onClick={() => void copy()}>{notice.startsWith("邀请链接已复制") ? <Check size={16}/> : <Copy size={16}/>}复制链接</button><a className="ip-brand-secondary" href={url} target="_blank" rel="noopener noreferrer">预览邀请页<ArrowUpRight size={15}/></a></div>
            <p className="invitation-field-hint">可选中链接手动复制。此链接用于统一账号注册，各应用的访问权限和权益分别管理。</p>
          </> : <div className="invitation-generate"><p>生成你的专属链接，发给想邀请的朋友。</p><button type="button" className="ip-brand-button" disabled={Boolean(busy)} onClick={() => void generate()}>{busy === "generate" ? "正在生成…" : "生成邀请链接"}</button></div>
          : <p className="invitation-field-hint">体验账号由多人共用。请使用自己的账号邀请朋友。</p>}
          {notice && <p className="invitation-feedback invitation-feedback-success" role="status">{notice}</p>}
          {actionError && <p className="invitation-feedback invitation-feedback-error" role="alert">{actionError}</p>}
        </section>
        <section className="invitation-parent-section" aria-labelledby="invitation-parent-heading"><h2 id="invitation-parent-heading">我的邀请人</h2>
          {data.inviter ? <div className="invitation-account-row"><Avatar key={data.inviter.avatarUrl} person={data.inviter}/><div><strong>{data.inviter.displayName}</strong><p>{data.invitedAt && <>邀请于 <time dateTime={data.invitedAt}>{dateText(data.invitedAt)}</time></>}</p></div></div> : <p className="invitation-field-hint">没有注册邀请记录。</p>}
        </section>
        <section className="invitation-records-section" aria-labelledby="invitation-records-heading" aria-busy={loading}>
          <div className="invitation-section-heading"><div><h2 id="invitation-records-heading">我邀请的账号</h2><p>这里记录直接邀请的注册账号，不代表各应用的开通或使用情况。</p></div><span className="invitation-record-count">共 {data.total} 条记录</span></div>
          {data.records.length ? <ul className="invitation-records">{data.records.map(record => <li className="invitation-account-row" key={record.id}><Avatar key={record.account.avatarUrl} person={record.account}/><div><strong>{record.account.displayName}</strong>{record.account.status === "merged" && <p>账号已合并，保留注册时的邀请记录</p>}{record.account.status === "suspended" && <p>账号已停用</p>}</div><time dateTime={record.createdAt}>{dateText(record.createdAt)}</time></li>)}</ul>
          : <p className="invitation-records-empty">{data.total === 0 ? url ? "还没有邀请记录。把邀请链接发给朋友，邀请他们注册。" : data.canInvite ? "还没有邀请记录。生成邀请链接后，就可以发给朋友。" : "暂无邀请记录。" : "这一页没有记录，请返回上一页。"}</p>}
          {(data.page > 0 || (data.page + 1) * data.pageSize < data.total) && <nav className="invitation-pagination" aria-label="邀请记录翻页"><button type="button" className="ip-brand-secondary" disabled={loading || Boolean(busy) || data.page === 0} onClick={() => void load(data.page - 1)}>上一页</button><span>第 {data.page + 1} 页</span><button type="button" className="ip-brand-secondary" disabled={loading || Boolean(busy) || (data.page + 1) * data.pageSize >= data.total} onClick={() => void load(data.page + 1)}>下一页</button></nav>}
        </section>
        <aside className="invitation-rules"><h2>关于邀请记录</h2><p>只记录注册时的邀请关系，已有账号不补绑。更换手机号或合并账号，不会改写原有记录。</p><p>分佣与奖励暂未开放。</p></aside>
      </>}
    </>}
  </AccountWorkspace></div>;
}
