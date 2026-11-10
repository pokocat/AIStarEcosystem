"use client";

// 设置与安全（原「设置」与「账号与安全」合并）：生成付款账户、账号中心里的手机号 / 微信 / 密码 / 头像 / 注销、隐私说明、退出登录。
// 线上走统一账号中心登录，手机号、微信、密码和注销都在账号中心改；本产品不再提供自己的登录密码表单。

import { useEffect, useState } from "react";
import { CreditCard, ExternalLink, Lock, LogOut, ShieldCheck } from "lucide-react";
import { idIssuer } from "@ai-star-eco/api-client";
import { isImpersonating } from "@ai-star-eco/api-client/impersonation-session";
import { auth, ID_MODE, USE_MOCK, prepareIdentityProfileEdit, useIdentity } from "@/proto/api";
import { loadStudioBillingAccount, saveStudioBillingPreference, type StudioBillingAccount } from "@/canvas-bridge/studio-billing-preference";
import { reportStudioError } from "@/ip/studio-errors";
import { IconBox } from "./account-ui";

type Mode = "ask" | "personal" | "enterprise";

function BillingDefault() {
  const [account, setAccount] = useState<StudioBillingAccount>();
  const [mode, setMode] = useState<Mode>("ask");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    let live = true;
    loadStudioBillingAccount().then(value => {
      if (!live) return;
      setAccount(value);
      setMode((value.context?.billingDefault as Mode | undefined) || "ask");
    }).catch(() => { if (live) setError("付款设置加载失败，请稍后刷新重试。"); });
    return () => { live = false; };
  }, []);
  if (!account?.context) return error ? <p className="account-alert" role="alert">{error}</p> : null;
  const choose = (next: Mode) => {
    if (saving || next === mode) return;
    const previous = mode;
    setMode(next); setError(""); setSaving(true);
    saveStudioBillingPreference(account, next === "ask" ? undefined : next)
      .then(setAccount)
      .catch(caught => { setMode(previous); setError(caught instanceof Error && caught.message ? `${caught.message}，未保存。` : "保存失败，请重试。"); })
      .finally(() => setSaving(false));
  };
  const options: { key: Mode; title: string; sub: string }[] = [
    { key: "ask", title: "每次询问", sub: "生成前选择付款账户" },
    { key: "personal", title: "个人积分", sub: "默认使用个人积分" },
    { key: "enterprise", title: account.context.enterprise.name, sub: "默认使用企业积分" },
  ];
  return <section className="account-setting" aria-labelledby="account-pay">
    <div className="account-setting-label"><IconBox tone="is-image"><CreditCard /></IconBox><div><h2 id="account-pay">生成付款账户</h2><p>修改后自动保存。</p></div></div>
    <div>
      <div className="account-options" role="group" aria-label="生成付款账户">
        {options.map(o => <button key={o.key} type="button" className="account-option" aria-pressed={mode === o.key} disabled={saving} onClick={() => choose(o.key)}>
          <strong title={o.title}>{o.title}</strong><small>{o.sub}</small>
        </button>)}
      </div>
      <p className="account-muted" style={{ marginTop: 10 }}>余额不足时不会自动切换到其他账户。</p>
      {error && <p className="account-alert" role="alert" style={{ marginTop: 6 }}>{error}</p>}
    </div>
  </section>;
}

function AccountCenterLink({ path, label, danger, profile }: { path: string; label: string; danger?: boolean; profile?: boolean }) {
  return <a className={`account-button${danger ? " is-danger" : ""}`} href={`${idIssuer()}${path}`} target="_blank" rel="noopener noreferrer"
    onClick={profile ? () => prepareIdentityProfileEdit(error => reportStudioError(error, { background: true })) : undefined}>
    {label}<ExternalLink size={12} strokeWidth={1.8} aria-hidden="true" />
  </a>;
}

export function AccountSettings() {
  const identity = useIdentity();
  const accountCenter = ID_MODE && !USE_MOCK && Boolean(idIssuer()) && !isImpersonating() && !identity?.demo;
  return <>
    {process.env.NEXT_PUBLIC_ENTERPRISE_ENABLED === "1" && !USE_MOCK && <BillingDefault />}

    <section className="account-setting" aria-labelledby="account-security">
      <div className="account-setting-label"><IconBox tone="is-audio"><ShieldCheck /></IconBox><div><h2 id="account-security">账号与安全</h2><p>{accountCenter ? "在账号中心修改，返回此页后自动更新。" : "当前登录方式不支持在线修改账号信息。"}</p></div></div>
      {accountCenter ? <div className="account-card account-list" style={{ overflow: "hidden" }}>
        <div className="account-line"><strong>头像与昵称</strong><span>{identity?.displayName}</span><AccountCenterLink path="/account/profile" label="修改" profile /></div>
        <div className="account-line"><strong>手机号</strong><span>{identity?.phoneMasked || "未绑定"}</span><AccountCenterLink path="/account/manage/phone" label={identity?.phoneMasked ? "修改" : "绑定"} /></div>
        <div className="account-line"><strong>微信</strong><span>绑定、更换或解绑微信</span><AccountCenterLink path="/account/manage/wechat" label="管理" /></div>
        <div className="account-line"><strong>登录密码</strong><span>设置或修改密码。验证码登录始终可用。</span><AccountCenterLink path="/account/manage/password" label="管理" /></div>
        <div className="account-line"><strong style={{ color: "var(--ip-error)" }}>注销账号</strong><span>注销后所有产品均无法登录，且不可撤销</span><AccountCenterLink path="/account/manage/close" label="注销" danger /></div>
      </div> : <div className="account-card account-list" style={{ overflow: "hidden" }}>
        <div className="account-line"><strong>手机号</strong><span>{identity?.phoneMasked || "未绑定"}</span></div>
      </div>}
    </section>

    <section className="account-setting" aria-labelledby="account-privacy">
      <div className="account-setting-label"><IconBox tone="is-text"><Lock /></IconBox><div><h2 id="account-privacy">隐私与数据</h2></div></div>
      <p style={{ alignSelf: "center" }}>真人素材加密存档。需要删除账号数据时，请联系平台客服。</p>
    </section>

    {!USE_MOCK && <section className="account-setting" aria-labelledby="account-logout">
      <div className="account-setting-label"><IconBox tone="is-danger"><LogOut /></IconBox><div><h2 id="account-logout">退出登录</h2></div></div>
      <div><button type="button" className="account-button is-danger" onClick={() => { auth.logout(); if (!ID_MODE) window.location.replace("/login"); }}>退出登录</button></div>
    </section>}
  </>;
}
