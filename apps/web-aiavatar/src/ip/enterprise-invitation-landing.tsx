"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowRight, Check, Building2, Image as ImageIcon, AudioLines, Film, ArrowUpRight, LoaderCircle } from "lucide-react";
import { AccountApi, ApiError, beginLogin, EnterpriseApi, getAuthToken, InvitationApi, isIdMode, loginWithIdSms, OidcError } from "@ai-star-eco/api-client";
import { isImpersonating } from "@ai-star-eco/api-client/impersonation-session";
import { EnrollmentGate } from "@ai-star-eco/landing/EnrollmentGate";
import type { EnterpriseInvitationPreview } from "@ai-star-eco/types/enterprise";
import { readEnterpriseInvitationToken } from "./enterprise-invitation-link";

const readableErrors: Record<string, string> = {
  ENTERPRISE_ALREADY_JOINED: "你已加入其他企业。请先前往企业管理退出原企业，再回来接受邀请。",
  ENTERPRISE_INVITATION_INVALID: "这份邀请已过期或已撤销，请联系企业管理员获取新链接。",
  ENTERPRISE_MEMBER_INACTIVE: "你的企业成员身份已停用，请联系企业管理员恢复。",
  ENTERPRISE_DISABLED: "企业功能暂未开放，请联系企业管理员。",
  SMS_CODE_INVALID: "验证码不正确，请检查后重试。", SMS_CODE_EXPIRED: "验证码已过期，请重新获取。",
  SMS_CODE_LOCKED: "验证码尝试次数过多，请重新获取。", SMS_RATE_LIMITED: "验证码发送过于频繁，请稍后再试。",
  unauthorized_client: "短信登录暂时不可用，请稍后再试。",
  IDENTITY_IMPERSONATION_UNSUPPORTED: "请退出运营查看，使用本人账号接受企业邀请。",
};
function failureMessage(error: unknown): string {
  if (error instanceof ApiError || error instanceof OidcError || error instanceof InvitationApi.InvitationPublicError) {
    return readableErrors[error.code] || "暂时无法完成操作，请稍后重试。";
  }
  return "连接暂时中断，请检查网络后重试。";
}
function expiry(value: string) { return new Intl.DateTimeFormat("zh-CN", { timeZone: "Asia/Shanghai", year: "numeric", month: "long", day: "numeric" }).format(new Date(value)); }

/** Enterprise membership is accepted by the product API, never by the identity referral service. */
export function EnterpriseInvitationLanding() {
  const [preview, setPreview] = useState<EnterpriseInvitationPreview>();
  const [token, setToken] = useState<string>();
  const [loading, setLoading] = useState(true), [loadError, setLoadError] = useState(""), [invalid, setInvalid] = useState(false);
  const [revision, setRevision] = useState(0), [sessionReady, setSessionReady] = useState(false), [authenticated, setAuthenticated] = useState(false);
  const [account, setAccount] = useState(""), [blocked, setBlocked] = useState(false), [otherEnterprise, setOtherEnterprise] = useState("");
  const [phone, setPhone] = useState(""), [code, setCode] = useState(""), [error, setError] = useState(""), [notice, setNotice] = useState("");
  const [busy, setBusy] = useState<"send" | "login" | "join" | null>(null), [remaining, setRemaining] = useState(0);
  const [enrollment, setEnrollment] = useState(false), [needsPhone, setNeedsPhone] = useState(false), [joined, setJoined] = useState(false);
  const [alreadyMember, setAlreadyMember] = useState(false);
  const mutation = useRef(false), alive = useRef(true), phoneRef = useRef<HTMLInputElement>(null), codeRef = useRef<HTMLInputElement>(null);

  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  useEffect(() => {
    const changed = () => setRevision(value => value + 1);
    window.addEventListener("hashchange", changed);
    return () => window.removeEventListener("hashchange", changed);
  }, []);
  useEffect(() => {
    const ctrl = new AbortController(); let active = true;
    if (process.env.NEXT_PUBLIC_ENTERPRISE_ENABLED !== "1") { setLoading(false); return; }
    const load = async () => {
      setLoading(true); setLoadError(""); setInvalid(false); setPreview(undefined); setSessionReady(false);
      const bearer = readEnterpriseInvitationToken(window.location.hash);
      if (!bearer) { setInvalid(true); setLoading(false); return; }
      setToken(bearer);
      try {
        const invitation = await EnterpriseApi.previewInvitation(bearer, ctrl.signal);
        if (!active) return;
        setPreview(invitation); setLoading(false);
        const impersonating = isImpersonating(); setBlocked(impersonating);
        if (!getAuthToken() || impersonating) { setAuthenticated(false); setSessionReady(true); return; }
        const me = await AccountApi.getMe();
        if (!active) return;
        setAuthenticated(true); setAccount(me.displayName || me.username || "当前账号");
        // This read may be denied by existing enrollment. The join action shows the original gate.
        try {
          const enterprises = await EnterpriseApi.mine();
          if (!active) return;
          const current = enterprises[0];
          setAlreadyMember(current?.enterprise.id === invitation.enterpriseId);
          setOtherEnterprise(current && current.enterprise.id !== invitation.enterpriseId ? current.enterprise.name : "");
          if (current?.enterprise.id === invitation.enterpriseId && current.member.status !== "active") setError(readableErrors.ENTERPRISE_MEMBER_INACTIVE);
        } catch (failure) {
          if (!(failure instanceof ApiError && failure.code === "PRODUCT_NOT_ENROLLED")) throw failure;
        }
        if (active) setSessionReady(true);
      } catch (failure) {
        if (!active) return;
        if (failure instanceof ApiError && ["ENTERPRISE_INVITATION_INVALID", "ENTERPRISE_INPUT_INVALID"].includes(failure.code)) setInvalid(true);
        else setLoadError("暂时无法读取邀请或账号状态，请重试。");
        setLoading(false);
      }
    };
    void load();
    return () => { active = false; ctrl.abort(); };
  }, [revision]);
  useEffect(() => {
    if (!remaining) return;
    const timer = setTimeout(() => setRemaining(value => Math.max(0, value - 1)), 1000);
    return () => clearTimeout(timer);
  }, [remaining]);

  const validatePhone = () => {
    if (/^1[3-9]\d{9}$/.test(phone.trim())) return true;
    setError("请输入正确的 11 位手机号。"); phoneRef.current?.focus(); return false;
  };
  const send = async () => {
    if (mutation.current || remaining || !validatePhone()) return;
    mutation.current = true; setBusy("send"); setError(""); setNotice("");
    try { await InvitationApi.sendInvitationSms(phone.trim()); if (alive.current) { setRemaining(60); setNotice("验证码已发送，请查看手机短信。"); codeRef.current?.focus(); } }
    catch (failure) { if (alive.current) setError(failureMessage(failure)); }
    finally { mutation.current = false; if (alive.current) setBusy(null); }
  };
  const accept = async () => {
    if (!token || blocked || isImpersonating()) throw new Error("本人账号才能接受邀请");
    setBusy("join");
    try {
      await EnterpriseApi.accept({ token });
      if (!alive.current) return;
      setEnrollment(false); setJoined(true);
      // Clear the bearer once membership is safely persisted; destination is fixed, never supplied by URL.
      window.history.replaceState(null, "", window.location.pathname);
      window.location.replace("/enterprise");
    } catch (failure) {
      if (!alive.current) return;
      if (failure instanceof ApiError && failure.code === "PRODUCT_NOT_ENROLLED") { setEnrollment(true); setError(""); }
      else if (failure instanceof ApiError && failure.code === "PHONE_VERIFICATION_REQUIRED") { setNeedsPhone(true); setAuthenticated(false); setError("请使用已验证的手机号登录后加入企业。"); }
      else if (failure instanceof ApiError && failure.code === "ENTERPRISE_INVITATION_INVALID") setInvalid(true);
      else setError(failureMessage(failure));
    }
  };
  const join = async () => {
    if (mutation.current || blocked) return;
    mutation.current = true; setError("");
    try { await accept(); }
    finally { mutation.current = false; if (alive.current) setBusy(null); }
  };
  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (mutation.current || !token || blocked || !validatePhone()) return;
    if (!/^\d{6}$/.test(code.trim())) { setError("请输入 6 位短信验证码。"); codeRef.current?.focus(); return; }
    mutation.current = true; setBusy("login"); setError(""); setNotice("");
    try {
      // Enterprise token is not an ID referral code; registration does not invent an inviter relationship.
      await loginWithIdSms(phone.trim(), code.trim());
      if (!alive.current) return;
      setAuthenticated(true); setNeedsPhone(false); setAccount("当前账号");
      await accept();
    } catch (failure) { if (alive.current) setError(failureMessage(failure)); }
    finally { mutation.current = false; if (alive.current) setBusy(null); }
  };
  const unavailable = process.env.NEXT_PUBLIC_ENTERPRISE_ENABLED !== "1";

  return <div className="enterprise-invite-page">
    <header className="ei-header"><a href="/" className="ei-brand" aria-label="IP Studio 首页"><img src="/brand/ip-studio-logo.png" alt="" width={38} height={38}/><span>IP Studio<small>声量引擎旗下</small></span></a><a href="/" className="ei-home">了解 Studio <ArrowUpRight size={16}/></a></header>
    <main className="ei-main">
      <section className="ei-introduction" aria-labelledby="ei-title">
        <h1 id="ei-title">让好想法，<br/>在这里成形。</h1>
        <p className="ei-intro">接受企业邀请，用分配给你的积分，<br/>继续属于自己的创作。</p>
        <div className="ei-editorial">
          <figure className="ei-art"><img src="/invitation/enterprise-film.webp" alt="现代企业总部内团队交流，前景摄影机正在拍摄企业宣传片，AI 创作示意" width={1536} height={1024}/><figcaption>AI 创作示意</figcaption></figure>
          <div className="ei-caption"><span>从一个想法，到一段影像。</span><span className="ei-media" aria-label="图片、视频与声音"><ImageIcon size={17}/><Film size={17}/><AudioLines size={17}/></span></div>
        </div>
      </section>
      <section className="ei-paper" aria-label="企业邀请">
        {unavailable ? <div className="ei-state"><Building2 size={30}/><h2>企业邀请暂未开放</h2><p>请联系企业管理员确认开放安排。</p><a href="/" className="ei-primary">返回 Studio <ArrowRight size={18}/></a></div>
        : loading ? <div className="ei-state" role="status"><LoaderCircle className="ei-spin" size={26}/><h2>正在读取企业邀请</h2><p>稍等片刻，马上就好。</p></div>
        : loadError ? <div className="ei-state"><h2>暂时无法读取邀请</h2><p role="alert">{loadError}</p><button className="ei-primary" onClick={() => setRevision(value => value + 1)}>重新读取 <ArrowRight size={18}/></button></div>
        : invalid ? <div className="ei-state"><Building2 size={30}/><h2>这份邀请已失效</h2><p>链接可能已过期或被撤销。请联系企业管理员获取新的邀请链接。</p><a href="/" className="ei-primary">返回 Studio <ArrowRight size={18}/></a></div>
        : preview && <>
          <div className="ei-company"><span className="ei-company-icon"><Building2 size={25}/></span><div><h2>{preview.enterpriseName}</h2><p>邀请你成为企业成员</p></div></div>
          <p className="ei-expiry">邀请有效至 {expiry(preview.expiresAt)}（北京时间）</p>
          <div className="ei-divider"/>
          {joined ? <div className="ei-state" role="status"><Check size={28}/><h3>已加入企业</h3><p>正在进入企业管理…</p><a href="/enterprise" className="ei-primary">进入企业 <ArrowRight size={18}/></a></div>
          : blocked ? <div className="ei-state"><h3>请使用本人账号加入</h3><p role="alert">{readableErrors.IDENTITY_IMPERSONATION_UNSUPPORTED}</p></div>
          : !sessionReady ? <p role="status" className="ei-session">正在确认账号…</p>
          : otherEnterprise ? <div className="ei-state"><h3>你已加入其他企业</h3><p>当前企业：<strong>{otherEnterprise}</strong>。每个账号同时只能属于一家企业，退出后可回来重新接受邀请。</p><a href="/enterprise" className="ei-primary">前往企业管理 <ArrowRight size={18}/></a></div>
          : enrollment ? <div className="ei-enrollment"><p>你已登录。开通数字资产产品后，将继续加入这家企业。</p><EnrollmentGate product="aiavatar" productLabel="数字资产产品" onActivated={join} theme={{ bg: "transparent", surface: "#ffffff", accent: "#192229", accentFg: "#ffffff" }}/></div>
          : authenticated && !needsPhone ? <div className="ei-account"><h3>{alreadyMember ? "你已是该企业成员" : "确认加入企业"}</h3><p>当前登录：<strong>{account}</strong></p>{alreadyMember ? <a className="ei-primary" href="/enterprise">进入企业管理 <ArrowRight size={18}/></a> : <button className="ei-primary" disabled={!!busy} onClick={() => void join()}>{busy ? "正在加入…" : "加入企业"}<ArrowRight size={18}/></button>}</div>
          : isIdMode() ? <form className="ei-form" onSubmit={submit} noValidate aria-label="注册登录并加入企业">
            <h3>验证手机号，加入企业</h3><p className="ei-form-hint">未注册将创建账号，已有账号直接登录。</p>
            <label htmlFor="ei-phone">手机号</label><div className="ei-field"><span className="ei-country">+86</span><input id="ei-phone" ref={phoneRef} type="tel" inputMode="numeric" autoComplete="tel-national" placeholder="请输入手机号" maxLength={11} value={phone} disabled={!!busy} aria-describedby="ei-feedback" onChange={event => { setPhone(event.target.value); setCode(""); setError(""); setNotice(""); }}/></div>
            <label htmlFor="ei-code">验证码</label><div className="ei-field"><input id="ei-code" ref={codeRef} type="text" inputMode="numeric" autoComplete="one-time-code" placeholder="请输入验证码" maxLength={6} value={code} disabled={!!busy} aria-describedby="ei-feedback" onChange={event => { setCode(event.target.value); setError(""); }}/><button type="button" disabled={!!busy || remaining > 0} onClick={() => void send()}>{remaining ? `${remaining} 秒后重试` : busy === "send" ? "正在发送…" : "获取验证码"}</button></div>
            <button className="ei-primary" disabled={!!busy} type="submit">{busy === "login" ? "正在验证…" : busy === "join" ? "正在加入…" : "注册 / 登录并加入企业"}<ArrowRight size={18}/></button>
          </form> : <div className="ei-state"><p>请先登录，再继续接受企业邀请。</p><button onClick={() => void beginLogin().catch(() => setError("暂时无法登录，请稍后重试。"))} className="ei-primary">登录并继续 <ArrowRight size={18}/></button></div>}
          <div id="ei-feedback" className="ei-feedback" aria-live="polite">{error && <p role="alert">{error}</p>}{notice && <p role="status">{notice}</p>}</div>
          <div className="ei-promises"><p><Check size={15}/>企业分配积分，你按需创作。</p><p><Check size={15}/>个人钱包与作品仍由你管理。</p></div>
          <p className="ei-footnote">加入企业不自动开通产品，也不自动获得积分。企业积分由管理员分配，可由企业回收。</p>
        </>}
      </section>
    </main>
    <footer className="ei-footer"><span>让灵感成形，让 IP 出圈。</span><span>企业邀请 · IP Studio</span></footer>
  </div>;
}
