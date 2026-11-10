"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { Alert, Button, Modal, Skeleton } from "antd";
import { apiFetch, ModelBillingApi } from "@ai-star-eco/api-client";
import type { EnterpriseBillingSelection } from "@ai-star-eco/types/enterprise";
import type { ModelBillingQuote, ScopedCreditGrant } from "@ai-star-eco/types/model-billing";
import type { StudioCreditShortageChoice } from "@/canvas-bridge/studio-billing-cancel";
import { EnterpriseApi } from "@/canvas-bridge/enterprise-api";
import { knownStudioBilling, loadStudioBillingAccount } from "@/canvas-bridge/studio-billing-preference";
import { WalletApi } from "@/proto/api";
import { AntdTheme } from "@/shell/antd-theme";

/**
 * 页面能换成的模型。cost 是按换过去之后的设置算的标准价（不含折扣和赠款），算不出来就留空；
 * changes 是换过去会改掉或用不上的设置（「比例将改为 1:1」），页面才知道，有它就不自动重新发起；
 * quotePatch 是换过去这次请求和现在不同的字段（尺寸、视频设置），报价时带上；
 * extraCharge 是报价不含、实际还要另扣的（视频的提示词优化是另一笔文字任务），有它就不能说「无需支付积分」。
 */
export type StudioModelChoice = { endpointId: string; name: string; legacyEndpointIds?: string[] | null; cost?: number | null; changes?: string; quotePatch?: Record<string, unknown>; extraCharge?: string };

export type StudioCreditShortageInput = {
  /** 这次的付款账户；不知道（服务端拒绝时没带）就按默认账户算。 */
  billing?: EnterpriseBillingSelection | null;
  /** 服务端的报价，有它才说得准差多少。 */
  quote?: Pick<ModelBillingQuote, "walletCredits" | "scopedCredits" | "target">;
  /** 没有报价时服务端拒绝的原话。 */
  reason?: string;
  /** 给了才能在提示框里直接换模型。 */
  modelChoices?: StudioModelChoice[];
  /**
   * 按这个模型重新报价（只读）。「可全额抵扣」只能由它说：系列模型的赠款落在具体的接入点上（1K 有赠款不等于 4K 能用），
   * 前端看不出这次会走哪个接入点。没给（提交后才被拒绝的路径）就只列赠款和标准价，不下结论。
   */
  verifyChoice?: (endpointId: string, patch?: Record<string, unknown>) => Promise<ModelBillingQuote>;
  /** 这个入口不能直接换模型，但换了模型赠款能用（出图、出视频）：列出有赠款的模型，并说明去哪里换。写脚本这类任务别给，赠款的模型帮不上。 */
  grantHint?: string;
  /** 页面能接着生成（积分到账后显示「继续生成」）。 */
  canRetry?: boolean;
};

const n = (value: number) => value.toLocaleString("zh-CN");

const usableGrants = (grants: ScopedCreditGrant[], now: number) =>
  grants.filter(grant => grant.campaignActive && grant.available > 0 && Date.parse(grant.expiresAt) > now);

export type ShortageSuggestion = { endpointId: string; name: string; grant: number; cost?: number; covered: boolean; changes?: string; quotePatch?: Record<string, unknown>; extraCharge?: string;
  /** 服务端按实际规格报的价。 */
  quoted?: { scopedCredits: number; walletCredits: number } };

const MAX_SUGGESTIONS = 4;
/** 一次最多核对这么多个候选，模型列表再长也不会发出一大波报价。 */
const MAX_VERIFIED = 8;

/** 按标准价估计够不够。系列模型的赠款是各接入点的合计，折扣也没算进去，所以只是估计：能问服务端时不用它下结论。 */
const plausible = (row: ShortageSuggestion, balance: number) => (row.cost === undefined ? row.grant > 0 : row.grant + balance >= row.cost);

/** 除当前模型和没配价的模型以外的全部候选。标准价为 0 是价格没配好（免费只能靠赠款），服务端会拒绝，换过去只会报错。 */
export function shortageCandidates(choices: StudioModelChoice[], grants: ScopedCreditGrant[], current: string | undefined, now = Date.now()): ShortageSuggestion[] {
  const usable = usableGrants(grants, now);
  return choices.flatMap(choice => {
    const ids = new Set([choice.endpointId, ...(choice.legacyEndpointIds ?? [])]);
    if (current && ids.has(current)) return [];
    if (choice.cost != null && choice.cost <= 0) return [];
    const grant = usable.filter(row => row.targets.some(target => ids.has(target.endpointId))).reduce((sum, row) => sum + row.available, 0);
    const cost = choice.cost ?? undefined;
    return [{ endpointId: choice.endpointId, name: choice.name, grant, covered: cost !== undefined && grant >= cost,
      ...(cost === undefined ? {} : { cost }), ...(choice.changes ? { changes: choice.changes } : {}), ...(choice.quotePatch ? { quotePatch: choice.quotePatch } : {}), ...(choice.extraCharge ? { extraCharge: choice.extraCharge } : {}) }];
  }).sort((a, b) => Number(b.covered) - Number(a.covered) || b.grant - a.grant || (a.cost ?? 0) - (b.cost ?? 0));
}

/** 不能问服务端时（提交后才被拒绝的路径）按标准价估计。 */
export function shortageSuggestions(choices: StudioModelChoice[], grants: ScopedCreditGrant[], current: string | undefined, balance: number, now = Date.now()): ShortageSuggestion[] {
  return shortageCandidates(choices, grants, current, now).filter(row => plausible(row, balance)).slice(0, MAX_SUGGESTIONS);
}

/**
 * 能问服务端就让它说了算：付不起的不列，标准价看着不够但有折扣、其实付得起的也别漏（所以先核对、再截断）。
 * 规格会变的和报不出价（网络、规格不合）的问不准，按估计留着，不下结论。能全靠赠款的排最前。
 */
export async function verifyShortageSuggestions(rows: ShortageSuggestion[], verify: NonNullable<StudioCreditShortageInput["verifyChoice"]> | undefined, balance: number): Promise<ShortageSuggestion[]> {
  if (!verify) return rows.filter(row => plausible(row, balance)).slice(0, MAX_SUGGESTIONS);
  const checked = await Promise.all(rows.slice(0, MAX_VERIFIED).map(async row => {
    const guess = plausible(row, balance) ? row : undefined;
    if (row.changes) return guess;
    try {
      const quote = await verify(row.endpointId, row.quotePatch);
      return quote.canAfford ? { ...row, quoted: { scopedCredits: quote.scopedCredits, walletCredits: quote.walletCredits } } : undefined;
    } catch { return guess; }
  }));
  const free = (row: ShortageSuggestion) => (isFreeSuggestion(row) ? 1 : 0);
  return checked.filter((row): row is ShortageSuggestion => !!row).sort((a, b) => free(b) - free(a)).slice(0, MAX_SUGGESTIONS);
}

/** 服务端确认这次不用付积分，而且没有报价之外的费用。 */
export const isFreeSuggestion = (row: ShortageSuggestion | undefined) => !!row?.quoted && row.quoted.walletCredits === 0 && !row.extraCharge;

const suggestionDetail = (row: ShortageSuggestion) => {
  const extra = row.extraCharge ? `，${row.extraCharge}` : "";
  if (row.quoted) {
    const { scopedCredits, walletCredits } = row.quoted;
    if (walletCredits === 0) return row.extraCharge ? `模型赠款抵扣 ${n(scopedCredits)} 积分${extra}` : `模型赠款抵扣 ${n(scopedCredits)} 积分，无需支付积分`;
    return (scopedCredits > 0 ? `模型赠款抵扣 ${n(scopedCredits)} 积分，需付 ${n(walletCredits)} 积分` : `需付 ${n(walletCredits)} 积分`) + extra;
  }
  return [row.grant > 0 && `模型赠款 ${n(row.grant)} 积分`, row.cost !== undefined && `标准价格 ${n(row.cost)} 积分`].filter(Boolean).join(" · ") + extra;
};

/** 入口不能直接换模型时，只说清哪些模型还有赠款。下线的模型不列。 */
export function grantSummaries(grants: ScopedCreditGrant[], now = Date.now()) {
  const totals = new Map<string, number>();
  for (const grant of usableGrants(grants, now)) {
    const label = grant.targetLabels.filter(name => name !== "已下线模型").join("、");
    if (label) totals.set(label, (totals.get(label) ?? 0) + grant.available);
  }
  return [...totals].map(([label, available]) => ({ label, available })).slice(0, 4);
}

/** 服务端冻结失败的原话里带着两个数：「积分余额不足，本次操作需 X，当前可用 Y」。 */
function amountsIn(reason: string | undefined) {
  const match = reason?.match(/本次操作需 ([0-9]+)，当前可用 ([0-9]+)/);
  return match ? { required: Number(match[1]), available: Number(match[2]) } : undefined;
}

/**
 * 差多少。报价的 walletCredits 是要付的钱，写「需付」；服务端原话里的数可能是文字任务的冻结额，不是价格，只写「需要」。
 * opening 是打开时的余额：服务端没说要多少时，余额涨了（充过值）就让用户再试，真不够服务端会再拒绝，不会误扣。
 */
export function shortageSummary(input: Pick<StudioCreditShortageInput, "quote" | "reason">, balance: number | undefined, opening?: number, modelName?: string) {
  const told = amountsIn(input.reason);
  const required = input.quote?.walletCredits ?? told?.required;
  const available = balance ?? told?.available;
  if (required === undefined) {
    if (available === undefined) return { text: "当前付款账户的积分不足。", enough: false };
    if (opening !== undefined && available > opening) return { text: `当前可用 ${n(available)} 积分，可以重新生成。`, enough: true, updated: true };
    return { text: `当前可用 ${n(available)} 积分，不足以完成本次生成。`, enough: false };
  }
  const verb = input.quote ? "需付" : "需要";
  const lead = modelName ? `「${modelName}」本次` : "本次";
  if (available === undefined) return { text: `${lead}${verb} ${n(required)} 积分，当前付款账户的积分不足。`, enough: false };
  const scoped = input.quote?.scopedCredits ?? 0;
  const need = scoped > 0 ? `模型赠款抵扣 ${n(scoped)} 积分后，${lead}还${verb} ${n(required)} 积分` : `${lead}${verb} ${n(required)} 积分`;
  const enough = available >= required;
  return { text: `${need}，当前可用 ${n(available)} 积分${enough ? "" : `，还差 ${n(required - available)} 积分`}。`, enough };
}

export function StudioCreditShortageDialog({ input, onChoice }: { input: StudioCreditShortageInput; onChoice: (choice: StudioCreditShortageChoice) => void }) {
  const [billing, setBilling] = useState(input.billing ?? undefined);
  const [payerUnknown, setPayerUnknown] = useState(false);
  const [balance, setBalance] = useState<number>();
  const [suggestions, setSuggestions] = useState<ShortageSuggestion[]>([]);
  const [grants, setGrants] = useState<ScopedCreditGrant[]>([]);
  const [grantsFailed, setGrantsFailed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [rechargeOpened, setRechargeOpened] = useState(false);
  const alive = useRef(true), openingBalance = useRef<number | undefined>(undefined);
  /** 领月度赠送和记下领之前的余额只做一次：并发的两次加载各读各的，后读到的会把「领之前」写成领之后的数。 */
  const collecting = useRef<Promise<void> | undefined>(undefined);
  const running = useRef<Promise<void> | undefined>(undefined), rerun = useRef(false);
  const loadOnce = useCallback(async () => {
    let payer = input.billing ?? undefined, unknown = false;
    // 服务端拒绝时没带付款账户（导演台单次选账户就是这样）：设了默认才按默认说。
    // 在企业里又没设默认、或者账户读不出来时，不知道这次是谁付的：不读任何一边的余额，也不把人引去给错误的账户充值。
    if (!payer && process.env.NEXT_PUBLIC_ENTERPRISE_ENABLED === "1") {
      const account = await loadStudioBillingAccount().catch(() => undefined);
      payer = account && knownStudioBilling(account);
      unknown = !payer;
    }
    const enterpriseId = payer?.mode === "enterprise" ? payer.enterpriseId : undefined;
    if (!enterpriseId && !unknown) {
      // 本月赠送的积分访问账户时才发：文字任务提交时不发。先记下领之前的余额（领到的也算「余额涨了」，用户才能接着生成），再领。
      collecting.current ??= (async () => {
        openingBalance.current = await WalletApi.balance().then(value => value.totalBalance).catch(() => undefined);
        await apiFetch("/v1/account").catch(() => undefined);
      })();
      await collecting.current;
    }
    const [funds, rows] = unknown ? [undefined, []] : await Promise.all([
      (enterpriseId ? EnterpriseApi.myBalance(enterpriseId) : WalletApi.balance()).then(value => value.totalBalance).catch(() => undefined),
      ModelBillingApi.myGrants({ enterpriseId, size: 100 }).then(page => page.data).catch(() => undefined),
    ]);
    const endpoint = input.quote?.target.endpointId;
    const rowsToShow = input.modelChoices && !unknown ? await verifyShortageSuggestions(shortageCandidates(input.modelChoices, rows ?? [], endpoint), input.verifyChoice, funds ?? 0) : [];
    if (!alive.current) return;
    if (openingBalance.current === undefined) openingBalance.current = funds;
    setBilling(payer); setPayerUnknown(unknown); setBalance(funds); setGrantsFailed(!rows); if (rows) setGrants(rows); setSuggestions(rowsToShow); setLoading(false);
  }, [input]);
  /** focus 和 visibilitychange 常常一起来：在跑的不重复发，跑完再补一次拿最新的。 */
  const load = useCallback(() => {
    if (running.current) { rerun.current = true; return running.current; }
    running.current = (async () => {
      do { rerun.current = false; await loadOnce(); } while (rerun.current && alive.current);
    })().finally(() => { running.current = undefined; });
    return running.current;
  }, [loadOnce]);
  useEffect(() => {
    alive.current = true;
    void load();
    // 充值在新标签页完成，回到这里余额就更新。
    const refresh = () => { if (document.visibilityState !== "hidden") void load(); };
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", refresh);
    return () => { alive.current = false; window.removeEventListener("focus", refresh); document.removeEventListener("visibilitychange", refresh); };
  }, [load]);
  const refreshNow = async () => { setRefreshing(true); try { await load(); } finally { setRefreshing(false); } };

  const enterprise = billing?.mode === "enterprise";
  const current = input.quote?.target.endpointId;
  const modelName = current ? input.modelChoices?.find(choice => choice.endpointId === current || choice.legacyEndpointIds?.includes(current))?.name : undefined;
  const summary = shortageSummary(input, balance, openingBalance.current, modelName);
  const summaries = input.grantHint && !input.modelChoices ? grantSummaries(grants) : [];
  // 只有一个主操作：有模型能全靠赠款完成时就是它（用户明明有赠款，不该把最显眼的按钮给花钱的路径），否则是充值。
  const freeFirst = isFreeSuggestion(suggestions[0]);
  const close = () => onChoice({ kind: "close" });
  return <AntdTheme><Modal open title={summary.updated ? "余额已更新" : summary.enough ? "积分充足" : enterprise ? "企业积分不足" : "积分不足"} onCancel={close} getContainer={false} width={480} zIndex={1400}
    footer={<div className="studio-credit-actions">
      <Button onClick={close}>{summary.enough && !input.canRetry ? "返回" : "返回修改"}</Button>
      {!loading && (summary.enough
        ? input.canRetry && <Button type="primary" onClick={() => onChoice({ kind: "retry" })}>继续生成</Button>
        : <>
          {(enterprise || payerUnknown) && <Button href="/me/enterprise" target="_blank" rel="noopener" type={payerUnknown || freeFirst ? "default" : "primary"} onClick={() => setRechargeOpened(true)}>查看企业积分</Button>}
          {!enterprise && <Button type={freeFirst ? "default" : "primary"} href="/me/credits" target="_blank" rel="noopener" onClick={() => setRechargeOpened(true)}>充值</Button>}
        </>)}
    </div>}>
    <div className="studio-billing-form studio-credit-form">
      {loading ? <Skeleton active paragraph={{ rows: 3 }} /> : <>
        <p className="studio-credit-summary" aria-live="polite">{summary.text}{!summary.enough && "本次未扣积分。"}{enterprise && !summary.enough && "企业积分由管理员分配，请联系管理员。"}{payerUnknown && !summary.enough && "个人积分和企业积分分开计算，请查看这次选择的付款账户。"}</p>
        {summary.enough && !input.canRetry && <Alert type="success" showIcon title="请返回后重新生成。" />}
        {!summary.enough && !!suggestions.length && <section aria-label="可改用的模型">
          <h4>可改用的模型</h4>
          <ul className="studio-credit-models">
            {suggestions.map((row, index) => <li key={row.endpointId}>
              <span><strong title={row.name}>{row.name}</strong>
                <small>{suggestionDetail(row)}</small>
                {row.changes && <small className="is-change">{row.changes}</small>}</span>
              <Button size="small" type={freeFirst && index === 0 ? "primary" : "default"} aria-label={`改用${row.name}`} onClick={() => onChoice({ kind: "switch-model", endpointId: row.endpointId, name: row.name, ...(row.changes ? { changes: row.changes } : {}) })}>改用</Button>
            </li>)}
          </ul>
        </section>}
        {!summary.enough && !!summaries.length && <section aria-label="你的模型赠款">
          <h4>你的模型赠款</h4>
          <ul className="studio-credit-models">
            {summaries.map(row => <li key={row.label}><span><strong title={row.label}>{row.label}</strong></span><small>{n(row.available)} 积分</small></li>)}
          </ul>
          <p>{input.grantHint}</p>
        </section>}
        {/* 赠款读不到时不能静默：免费的路径消失，等于把人推去充值。 */}
        {!summary.enough && grantsFailed && (!!input.modelChoices || !!input.grantHint) && <p className="studio-credit-recheck">模型赠款加载失败。<Button type="link" size="small" loading={refreshing} onClick={() => void refreshNow()}>重新加载</Button></p>}
        {rechargeOpened && !summary.enough && <p className="studio-credit-recheck">{enterprise ? "积分分配后" : "充值完成后"}回到此页，余额会自动更新。<Button type="link" size="small" loading={refreshing} onClick={() => void refreshNow()}>刷新余额</Button></p>}
      </>}
    </div>
  </Modal></AntdTheme>;
}

let opening: Promise<StudioCreditShortageChoice> | undefined;

/** 同一时间只开一个：同一次拒绝可能从提交和错误出口各报一次。 */
export function askStudioCreditShortage(input: StudioCreditShortageInput): Promise<StudioCreditShortageChoice> {
  if (opening) return opening;
  opening = new Promise<StudioCreditShortageChoice>(resolve => {
    const host = document.createElement("div"); host.className = "ip-brand-surface studio-billing-host"; document.body.appendChild(host);
    const root = createRoot(host), origin = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const finish = (choice: StudioCreditShortageChoice) => {
      opening = undefined; root.unmount(); host.remove();
      setTimeout(() => { if (origin?.isConnected) origin.focus(); }, 0);
      resolve(choice);
    };
    root.render(<StudioCreditShortageDialog input={input} onChoice={finish} />);
  });
  return opening;
}
