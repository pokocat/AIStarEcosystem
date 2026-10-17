"use client";

import { useEffect, useState } from "react";
import { loadStudioBillingAccount, readStudioBillingPreference, saveStudioBillingPreference, type StudioBillingAccount } from "@/canvas-bridge/studio-billing-preference";

/** The same account-scoped preference used by the generation chooser, inside existing settings. */
export function StudioBillingSettings() {
  const [account, setAccount] = useState<StudioBillingAccount>();
  const [mode, setMode] = useState("ask");
  const [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    void loadStudioBillingAccount().then(value => {
      if (!active) return;
      setAccount(value);
      setMode(readStudioBillingPreference(value)?.mode || "ask");
    }).catch(() => { if (active) setError("暂时无法读取付款设置，请刷新后重试。"); });
    return () => { active = false; };
  }, []);
  if (error && !account) return <p role="alert">{error}</p>;
  if (!account?.context) return null;
  return <section className="m-card" style={{ padding: 15, marginBottom: 18 }} aria-label="生成付款设置">
    <label htmlFor="studio-default-billing" style={{ display: "block", fontSize: 14.5, fontWeight: 600, marginBottom: 9 }}>生成付款账户</label>
    <select id="studio-default-billing" value={mode} style={{ width: "100%", padding: "10px 12px", border: "1px solid var(--line)", borderRadius: 8, color: "var(--ink)", background: "var(--surface)", font: "inherit" }} onChange={event => {
      const next = event.target.value;
      try {
        saveStudioBillingPreference(account, next === "ask" ? undefined : next === "enterprise" ? "enterprise" : "personal");
        setMode(next); setError("");
      } catch (caught) { setError(caught instanceof Error ? caught.message : "保存失败，请重试。"); }
    }}>
      <option value="ask">每次询问</option>
      <option value="personal">默认使用个人积分</option>
      <option value="enterprise">默认使用{account.context.enterprise.name}的企业积分</option>
    </select>
    <p style={{ margin: "9px 0 0", color: "var(--ink-3)", fontSize: 12 }}>自动保存到当前浏览器。余额不足时不会自动切换账户；退出企业后使用个人积分。</p>
    {error && <p role="alert">{error}</p>}
  </section>;
}
