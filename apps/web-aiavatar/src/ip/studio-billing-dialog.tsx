"use client";

import { useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { Alert, Button, Checkbox, ConfigProvider, Modal, Radio, Skeleton } from "antd";
import type { EnterpriseBillingSelection, EnterpriseContext, EnterpriseMemberBalance, EnterprisePolicy } from "@ai-star-eco/types/enterprise";
import { EnterpriseApi } from "@/canvas-bridge/enterprise-api";
import { ApiError } from "@ai-star-eco/api-client";
import { WalletApi } from "@/proto/api";
import { normalizeStudioError } from "./studio-errors";
import type { StudioBillingDetails } from "@/canvas-bridge/studio-billing";

import { knownStudioBilling, loadStudioBillingAccount, saveStudioBillingPreference, type StudioBillingAccount } from "@/canvas-bridge/studio-billing-preference";

type Details = StudioBillingDetails & { model?: string };
const n = (value: number) => value.toLocaleString("zh-CN");
const operationNames: Record<string, string> = { image: "图片生成", video: "视频生成", text: "文本生成", script: "剧本生成", storyboard: "分镜生成", assistant: "创作助手", speech: "配音生成", lipSync: "口型生成", "lip-sync": "口型生成", "asset-extract": "资产提取", assemble: "成片合成", template: "模板步骤生成", avatar: "数字人形象生成", look: "造型设计", derivative: "数字人素材生成", scene: "场景图生成", product: "商品图生成", compose: "合成图生成", "voice-clone": "声音克隆" };

export function StudioBillingDialog({ details, account, onConfirm, onCancel }: { details: Details; account?: StudioBillingAccount; onConfirm: (billing: EnterpriseBillingSelection) => void; onCancel: () => void }) {
  const [selection, setSelection] = useState<"personal" | "enterprise">("personal");
  const [remember, setRemember] = useState(false);
  const [preferenceError, setPreferenceError] = useState("");
  const [personal, setPersonal] = useState<number>();
  const [context, setContext] = useState<EnterpriseContext>();
  const [balance, setBalance] = useState<EnterpriseMemberBalance>();
  const [policy, setPolicy] = useState<EnterprisePolicy>();
  const [error, setError] = useState("");
  const [enterpriseDisabled, setEnterpriseDisabled] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const revision = useRef(0), confirmed = useRef(false);
  const load = async () => {
    const current = ++revision.current; setLoading(true); setError(""); setEnterpriseDisabled(false);
    try {
      const [wallet, contexts] = await Promise.all([WalletApi.balance(), (account ? Promise.resolve(account.context ? [account.context] : []) : EnterpriseApi.mine()).catch(caught => { if (caught instanceof ApiError && caught.status === 404) { if (current === revision.current) setEnterpriseDisabled(true); return []; } throw caught; })]);
      if (current !== revision.current) return;
      setPersonal(wallet.totalBalance); const mine = contexts[0]; setContext(mine); setBalance(undefined); setPolicy(undefined);
      if (mine) {
        const [assigned, setting] = await Promise.all([EnterpriseApi.myBalance(mine.enterprise.id), EnterpriseApi.policy(mine.enterprise.id)]);
        if (current !== revision.current) return;
        setBalance(assigned); setPolicy(setting);
      }
    } catch (caught) { if (current === revision.current) setError(normalizeStudioError(caught).message); }
    finally { if (current === revision.current) setLoading(false); }
  };
  useEffect(() => { void load(); return () => { revision.current++; }; }, []); // Dialog reads fresh funds at each explicit payment choice.
  const isText = details.textUsage || ["text", "script", "storyboard", "assistant", "asset-extract"].includes(details.operation || "");
  const expected = typeof details.expectedCost === "number" && Number.isFinite(details.expectedCost) ? details.expectedCost : undefined;
  const enterpriseUnavailable = enterpriseDisabled ? "企业功能暂未开放，可选择个人积分" : !context ? "你目前没有加入企业" : context.enterprise.status !== "active" ? "企业已关闭或正在关闭" : context.member.status !== "active" ? "企业成员已停用，仍可选择个人积分" : !details.modelQuote && details.model && policy && policy.allowedEndpointIds.length > 0 && !policy.allowedEndpointIds.includes(details.model) ? "此模型未获企业授权，可更换模型或选择个人积分" : !balance || !policy ? "企业余额或生成设置尚未加载" : undefined;
  const available = selection === "personal" ? personal : balance?.totalBalance;
  const insufficient = !details.modelQuote && available !== undefined && (expected !== undefined ? available < expected : available <= 0);
  const blocked = loading || saving || !!error || available === undefined || insufficient || selection === "enterprise" && !!enterpriseUnavailable;
  const confirm = async () => {
    if (blocked || confirmed.current) return;
    if (remember && account) {
      setSaving(true); setPreferenceError("");
      try { await saveStudioBillingPreference(account, selection); }
      catch (caught) { setPreferenceError(normalizeStudioError(caught).message); return; }
      finally { setSaving(false); }
    }
    confirmed.current = true; onConfirm(selection === "enterprise" && context ? { mode: "enterprise", enterpriseId: context.enterprise.id } : { mode: "personal" });
  };
  return <ConfigProvider theme={{ token: { colorPrimary: "#192229", fontFamily: "var(--ip-ui, sans-serif)", borderRadius: 8 } }}><Modal open title="确认本次付款账户" okText={details.modelQuote?"确认账户并核对报价":"确认账户并生成"} cancelText="取消生成" onCancel={onCancel} onOk={() => void confirm()} okButtonProps={{ disabled: blocked, loading: saving }} getContainer={false}>
    <div className="studio-billing-form">
      <p>{operationNames[details.operation || ""] || "IP Studio 生成"}{details.modelQuote ? " · 下一步确认应付积分。" : isText ? " · 按实际用量结算。" : expected === undefined ? "" : ` · 本次预计 ${n(expected)} 积分。`}</p>
      {loading ? <Skeleton active paragraph={{ rows: 4 }} /> : <Radio.Group value={selection} onChange={event => setSelection(event.target.value)} className="studio-billing-options" aria-label="本次付款账户"><Radio value="personal"><span><strong>个人积分</strong><small>可用 {personal === undefined ? "—" : n(personal)} 积分</small></span></Radio><Radio value="enterprise" disabled={!!enterpriseUnavailable}><span><strong>{context ? `${context.enterprise.name} · 企业积分` : "企业积分"}</strong><small>{enterpriseUnavailable || `本人可用 ${n(balance?.totalBalance || 0)} 积分 · 冻结 ${n(balance?.pendingBalance || 0)} 积分`}</small></span></Radio></Radio.Group>}
      {account?.context && <div className="studio-billing-default"><Checkbox checked={remember} onChange={event => { setRemember(event.target.checked); setPreferenceError(""); }}>设为默认，以后不再询问</Checkbox><p>所有生成均使用此账户付款。如需改为每次询问，请前往<a href="/studio#/settings">设置</a>。余额不足时不会自动切换账户。</p></div>}
      {preferenceError && <Alert type="error" showIcon title="默认账户保存失败" description={`${preferenceError} 可取消勾选，仅本次使用此账户。`} />}
      {context && <p>企业积分归企业所有，使用时受企业允许的模型及每人 {policy?.maxActiveJobs ?? "—"} 项进行中任务的限制。作品归个人所有。</p>}
      {insufficient && <Alert type="warning" showIcon title={`${selection === "enterprise" ? "企业" : "个人"}积分不足`} description="请充值或联系企业分配积分，也可选择其他付款账户。系统不会自动切换或混合扣款。" />}
      {error && <Alert type="error" showIcon title="无法核对付款账户" description={error} action={<Button size="small" onClick={() => void load()}>重新核对</Button>} />}
    </div>
  </Modal></ConfigProvider>;
}

/** Personal-only accounts skip the chooser; explicit defaults keep the same payer on insufficient funds. */
export async function chooseStudioBilling(details: Details): Promise<EnterpriseBillingSelection> {
  const account = await loadStudioBillingAccount();
  const known = knownStudioBilling(account);
  if (known) return known;
  return new Promise((resolve, reject) => {
    const host = document.createElement("div"); host.className = "ip-brand-surface studio-billing-host"; document.body.appendChild(host);
    const root = createRoot(host); const origin = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const finish = (billing?: EnterpriseBillingSelection) => {
      root.unmount(); host.remove();
      setTimeout(() => { if (origin?.isConnected) origin.focus(); }, 0);
      if (billing) resolve(billing); else reject(new ApiError({ code: "STUDIO_BILLING_CANCELLED", message: "本次生成已取消，未提交任务。" }, 400));
    };
    root.render(<StudioBillingDialog details={details} account={account} onConfirm={billing => finish(billing)} onCancel={() => finish()} />);
  });
}
