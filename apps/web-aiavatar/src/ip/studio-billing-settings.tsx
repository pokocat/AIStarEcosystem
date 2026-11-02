"use client";
import { SelectField } from "@ai-star-eco/ui/ui/select-field";

import { useEffect, useState } from "react";
import { loadStudioBillingAccount, saveStudioBillingPreference, type StudioBillingAccount } from "@/canvas-bridge/studio-billing-preference";

/** The member's default payer (saved on the membership), the same one the generation chooser reads. */
export function StudioBillingSettings() {
  const [account, setAccount] = useState<StudioBillingAccount>();
  const [mode, setMode] = useState("ask");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    let active = true;
    void loadStudioBillingAccount().then(value => {
      if (!active) return;
      setAccount(value);
      setMode(value.context?.billingDefault || "ask");
    }).catch(() => { if (active) setError("暂时无法读取付款设置，请刷新后重试。"); });
    return () => { active = false; };
  }, []);
  if (error && !account) return <p role="alert">{error}</p>;
  if (!account?.context) return null;
  return <section className="m-card" style={{ padding: 15, marginBottom: 18 }} aria-label="生成付款设置">
    <label htmlFor="studio-default-billing" style={{ display: "block", fontSize: 14.5, fontWeight: 600, marginBottom: 9 }}>生成付款账户</label>
    <SelectField id="studio-default-billing" value={mode} disabled={saving} style={{ width: "100%", padding: "10px 12px", border: "1px solid var(--line)", borderRadius: 8, color: "var(--ink)", background: "var(--surface)", font: "inherit" }} onChange={event => {
      const next = event.target.value, previous = mode;
      setMode(next); setError(""); setSaving(true);
      saveStudioBillingPreference(account, next === "ask" ? undefined : next === "enterprise" ? "enterprise" : "personal")
        .then(setAccount)
        .catch(caught => { setMode(previous); setError(caught instanceof Error && caught.message ? `${caught.message}，没有保存。` : "没有保存，请重试。"); })
        .finally(() => setSaving(false));
    }}>
      <option value="ask">每次询问</option>
      <option value="personal">默认使用个人积分</option>
      <option value="enterprise">默认使用{account.context.enterprise.name}的企业积分</option>
    </SelectField>
    <p style={{ margin: "9px 0 0", color: "var(--ink-3)", fontSize: 12 }}>改了就保存，出图、视频、数字人、配音等所有生成都按它付款，换电脑或手机也一样。余额不足时不会自动换账户；退出企业后会重新询问。</p>
    {error && <p role="alert">{error}</p>}
  </section>;
}
