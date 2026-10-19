"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowRight, ArrowUpRight } from "lucide-react";
import { InvitationApi, isIdMode, loginWithIdSms, OidcError } from "@ai-star-eco/api-client";

const scenes = [
  { key: "image", label: "创造形象", sub: "角色与画面", title: "让想象，拥有自己的样子。", description: "角色写真、造型与场景，延展属于你的视觉表达。", alt: "光影中的人物与场景，图片创作示意" },
  { key: "video", label: "创作影像", sub: "画面与情绪", title: "让角色，走进新的故事。", description: "从一张画面出发，延展为有情绪、有节奏的影像。", alt: "夕阳下，围着橘色围巾的女孩回望海岸，影像创作示意" },
  { key: "script", label: "讲述故事", sub: "剧本与分镜", title: "让一个想法，长成一个世界。", description: "故事设定、剧本与分镜，让灵感有处可去。", alt: "故事与剧本创作的视觉示意" },
];
const errors: Record<string, string> = {
  IDENTITY_IMPERSONATION_UNSUPPORTED: "请先退出运营查看，再注册或登录本人账号。",
  SMS_CODE_INVALID: "验证码不正确，请检查后重试。", SMS_CODE_EXPIRED: "验证码已过期，请重新获取。",
  SMS_CODE_LOCKED: "验证码尝试次数过多，请稍后重新获取。", SMS_RATE_LIMITED: "验证码发送过于频繁，请稍后再试。",
  PHONE_INVALID: "请输入正确的 11 位手机号。", INVITATION_INVALID: "这份邀请已失效，请重新读取后继续注册。",
  unauthorized_client: "短信注册暂时不可用，请稍后再试。",
};
function message(error: unknown) {
  if (error instanceof OidcError || error instanceof InvitationApi.InvitationPublicError) {
    return errors[error.code] ?? (error instanceof OidcError ? "账号服务暂时不可用，请稍后重试。" : error.message);
  }
  return "连接账号服务失败，请检查网络后重试。";
}

export function InvitationRegistration({ invitationCode }: { invitationCode: string }) {
  const [preview, setPreview] = useState<"loading" | "valid" | "invalid" | "error">("loading");
  const [inviter, setInviter] = useState("");
  const [revision, setRevision] = useState(0);
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [phoneError, setPhoneError] = useState(false);
  const [codeError, setCodeError] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState<"send" | "login" | null>(null);
  const [remaining, setRemaining] = useState(0);
  const [scene, setScene] = useState(1);
  const lock = useRef(false);
  const phoneRef = useRef<HTMLInputElement>(null);
  const codeRef = useRef<HTMLInputElement>(null);
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);

  useEffect(() => {
    const ctrl = new AbortController();
    setPreview("loading"); setError("");
    if (!isIdMode()) { setPreview("error"); return; }
    InvitationApi.getInvitationPreview(invitationCode, ctrl.signal).then(value => {
      if (!ctrl.signal.aborted) { setInviter(value.displayName); setPreview("valid"); }
    }, failure => {
      if (!ctrl.signal.aborted) setPreview(failure instanceof InvitationApi.InvitationPublicError && failure.code === "INVITATION_INVALID" ? "invalid" : "error");
    });
    return () => ctrl.abort();
  }, [invitationCode, revision]);
  useEffect(() => {
    if (!remaining) return;
    const timer = setTimeout(() => setRemaining(current => Math.max(0, current - 1)), 1000);
    return () => clearTimeout(timer);
  }, [remaining]);

  const validatePhone = () => {
    const valid = /^1[3-9]\d{9}$/.test(phone.trim());
    setPhoneError(!valid);
    if (!valid) { setError(errors.PHONE_INVALID); phoneRef.current?.focus(); }
    return valid;
  };
  const send = async () => {
    if (lock.current || remaining || !validatePhone()) return;
    lock.current = true; setBusy("send"); setError(""); setNotice("");
    try {
      await InvitationApi.sendInvitationSms(phone.trim());
      setRemaining(60); setNotice("验证码已发送，请查看手机短信。"); codeRef.current?.focus();
    } catch (failure) { setError(message(failure)); }
    finally { lock.current = false; setBusy(null); }
  };
  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (lock.current || !["valid", "invalid"].includes(preview) || !validatePhone()) return;
    if (!/^\d{6}$/.test(code.trim())) {
      setCodeError(true); setError("请输入 6 位短信验证码。"); codeRef.current?.focus(); return;
    }
    lock.current = true; setBusy("login"); setError(""); setNotice("");
    try {
      await loginWithIdSms(phone.trim(), code.trim(), preview === "valid" ? invitationCode : undefined);
      window.location.replace("/dashboard");
    } catch (failure) {
      setError(message(failure));
      if (failure instanceof OidcError && failure.code === "INVITATION_INVALID") setPreview("error");
      lock.current = false; setBusy(null);
    }
  };
  const selected = scenes[scene];
  const formVisible = preview === "valid" || preview === "invalid";

  return <div className="studio-invite">
    <header className="header"><a className="brand" href="/" aria-label="IP Studio · 声量引擎旗下"><img src="/brand/ip-studio-logo.png" width={42} height={42} alt=""/><span><strong>IP Studio</strong><small>声量引擎旗下</small></span></a><a className="quiet-link" href="#possibilities">认识 Studio <ArrowUpRight/></a></header>
    <main><section className="hero" aria-labelledby="hero-title"><div className="hero-copy">
      <h1 id="hero-title">让灵感成形<br/>让 IP 出圈<span className="period">。</span></h1>
      <p className="intro">创造你的角色、影像与故事。</p>
      <section className="invitation" aria-label="朋友的邀请">
        {preview === "valid" && <div className="inviter"><span className="avatar" aria-hidden="true">{Array.from(inviter)[0]}</span><p><strong>{inviter}</strong><span>邀请你加入 Studio</span></p></div>}
        {preview === "loading" && <p className="state-message" role="status">正在读取邀请…</p>}
        {preview === "invalid" && <p className="state-message" role="status">这份邀请已失效，你仍可直接注册 Studio。</p>}
        {preview === "error" && <><p className="state-message" role="alert">暂时无法读取邀请，请检查网络后重试。</p><button className="primary" type="button" onClick={() => setRevision(n => n + 1)}>重新读取邀请</button></>}
        {formVisible && <form onSubmit={submit} noValidate>
          <label className="field-label" htmlFor="invite-phone">手机号</label>
          <div className="phone-field"><span className="country-code">+86</span><input ref={phoneRef} id="invite-phone" name="phone" type="tel" inputMode="numeric" autoComplete="tel-national" placeholder="请输入手机号" maxLength={11} required disabled={busy !== null} value={phone} aria-invalid={phoneError || undefined} aria-describedby="invite-feedback" onChange={event => { setPhone(event.target.value); setCode(""); setPhoneError(false); setCodeError(false); setError(""); setNotice(""); }}/></div>
          <label className="field-label" htmlFor="invite-code">验证码</label>
          <div className="code-field"><input ref={codeRef} id="invite-code" name="code" type="text" inputMode="numeric" autoComplete="one-time-code" placeholder="请输入验证码" maxLength={6} required disabled={busy === "login"} value={code} aria-invalid={codeError || undefined} aria-describedby="invite-feedback" onChange={event => {setCode(event.target.value); setCodeError(false); setError("");}}/><button type="button" disabled={busy !== null || remaining > 0} onClick={() => void send()}>{busy === "send" ? "正在发送…" : remaining ? `${remaining} 秒后重试` : "获取验证码"}</button></div>
          <div id="invite-feedback">{error && <p className="form-error" role="alert">{error}</p>}{notice && <p className="form-status" role="status">{notice}</p>}</div>
          <button className="primary register-submit" type="submit" disabled={busy !== null}><span>{busy === "login" ? "正在进入 Studio…" : "注册并进入 Studio"}</span><ArrowRight/></button>
          <p className="registration-note">未注册自动注册，已有账号直接登录。</p>
        </form>}
      </section></div>
      <div className="showcase" aria-label="探索 Studio 创作方向"><div className="showcase-art" id="invite-showcase" role="tabpanel" aria-labelledby={`invite-tab-${selected.key}`}><img src={`/invitation/${selected.key}.webp`} width={1536} height={1024} alt={selected.alt} fetchPriority="high"/><span className="art-disclaimer">AI 创作示意</span></div><div className="showcase-caption"><h2>{selected.title}</h2><p>{selected.description}</p></div><div className="tabs" role="tablist" aria-label="创作方向">{scenes.map((item, index) => <button key={item.key} ref={el => { tabRefs.current[index] = el; }} id={`invite-tab-${item.key}`} type="button" role="tab" aria-selected={scene === index} aria-controls="invite-showcase" tabIndex={scene === index ? 0 : -1} onClick={() => setScene(index)} onKeyDown={event => {
        const next = event.key === "ArrowRight" ? (index + 1) % 3 : event.key === "ArrowLeft" ? (index + 2) % 3 : event.key === "Home" ? 0 : event.key === "End" ? 2 : -1;
        if (next >= 0) {event.preventDefault(); setScene(next); tabRefs.current[next]?.focus();}
      }}><img src={`/invitation/${item.key}.webp`} width={48} height={40} alt=""/><span>{item.label}<small>{item.sub}</small></span></button>)}</div></div>
    </section>
    <section className="possibilities" id="possibilities" aria-labelledby="possibilities-title"><div className="section-heading"><h2 id="possibilities-title">一个灵感，<br/>不止一种可能。</h2><p>让角色成为可延展的 IP，<br/>让每次创作都成为下一次的起点。</p></div><div className="capabilities"><article><h3>创造你的角色</h3><p>塑造形象、延展造型与场景，<br/>积累自己的角色与素材。</p></article><article><h3>让画面开口说话</h3><p>图片、视频、配音与口型，<br/>在同一处继续你的创作。</p></article><article><h3>把想法写成故事</h3><p>从故事设定、剧本到分镜，<br/>让角色拥有自己的世界。</p></article></div></section>
    <section className="questions" aria-label="关于这次邀请"><h2>关于这次邀请</h2><div><details><summary>注册后，会发生什么？<svg className="summary-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 12h12"/><path className="vertical" d="M12 6v12"/></svg></summary><p>验证手机号后直接进入 IP Studio。新账号会记录这次邀请；各项创作能力仍按账号开通情况和具体使用规则提供。</p></details><details><summary>已有账号可以登录吗？<svg className="summary-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 12h12"/><path className="vertical" d="M12 6v12"/></svg></summary><p>使用同一表单验证手机号即可登录，原有邀请关系保持不变。</p></details></div></section>
    </main><footer className="footer"><span>IP Studio <small>· 声量引擎旗下</small></span><p>让灵感成形，让 IP 出圈。</p></footer>
  </div>;
}
