"use client";

// 真人授权素材：本人刷脸核验过的授权、待授权的真人、补充协议、凭证下载与续签。
// 逻辑沿用原 proto MLicenses(realOnly)：LicenseApi / RealAuthApi / AvatarApi；补素材与授权的流程仍在原创建向导里（#/create/real/<人物>）。

import { useEffect, useState } from "react";
import { AlertTriangle, ChevronDown, ChevronUp, Plus } from "lucide-react";
import { AvatarApi, LicenseApi, RealAuthApi } from "@/proto/api";
import { MaterialSection } from "@/proto/material-status";
import { reportStudioError } from "@/ip/studio-errors";
import { IconBox, LoadState } from "./account-ui";

type License = {
  id: string; char?: string; subject: string; status: "active" | "expired" | "pending"; scope?: string; period?: string;
  platforms?: string[]; verifyMethod?: string; evidenceStatus?: string; agreementVersion?: string; photos?: number;
};
type Agreement = { version: string; title: string; summary: string; scope: string; periodMonths: number; processors: string[] };

const STATUS: Record<License["status"], { label: string; tone: string }> = {
  active: { label: "生效中", tone: "is-ok" },
  pending: { label: "待补确认", tone: "is-warn" },
  expired: { label: "已过期", tone: "is-error" },
};
const FILTERS: { key: "all" | License["status"]; label: string }[] = [
  { key: "all", label: "全部" }, { key: "active", label: "生效中" }, { key: "pending", label: "待补确认" }, { key: "expired", label: "已过期" },
];

const captureHref = (avatarId?: string) => avatarId ? `/studio#/create/real/${encodeURIComponent(avatarId)}` : "/studio?start=real";

export function AccountRealMaterials() {
  const [licenses, setLicenses] = useState<License[]>([]);
  const [avatars, setAvatars] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState<(typeof FILTERS)[number]["key"]>("all");
  const [busy, setBusy] = useState("");
  const [open, setOpen] = useState("");
  const [supplementId, setSupplementId] = useState("");
  const [agreement, setAgreement] = useState<Agreement>();
  const [accepted, setAccepted] = useState(false);
  const [reload, setReload] = useState(0);

  useEffect(() => {
    let live = true;
    setLoading(true); setError("");
    Promise.all([LicenseApi.list(), AvatarApi.list("mine").catch(() => [])]).then(([l, a]) => {
      if (!live) return;
      setLicenses((l || []).filter((x: License) => x.char && x.verifyMethod === "liveness"));
      setAvatars(a || []);
    }).catch(() => { if (live) setError("授权记录加载失败，请稍后刷新重试。"); }).finally(() => { if (live) setLoading(false); });
    return () => { live = false; };
  }, [reload]);

  const activeIds = new Set(licenses.filter(l => l.status === "active").map(l => l.id));
  const needAuth = avatars.filter(a => a.path === "real" && !(a.license && activeIds.has(a.license)));
  const shown = licenses.filter(l => filter === "all" || l.status === filter);
  const count = (k: License["status"]) => licenses.filter(l => l.status === k).length;

  const act = async (id: string, action: string, run: () => Promise<unknown>) => {
    setBusy(id);
    try { await run(); } catch (e) { reportStudioError(e, { action }); } finally { setBusy(""); }
  };
  const download = (l: License) => act(l.id, "下载凭证", async () => {
    const r = await LicenseApi.certificate(l.id);
    if (r.certificateUrl) window.open(r.certificateUrl, "_blank", "noopener"); else throw new Error("凭证生成中，请稍后再试。");
  });
  const renew = (l: License) => act(l.id, "续签", async () => { await LicenseApi.renew(l.id); setReload(v => v + 1); });
  const openSupplement = async (l: License) => {
    if (supplementId === l.id) { setSupplementId(""); setAccepted(false); return; }
    setSupplementId(l.id); setAccepted(false);
    if (!agreement) await act(l.id, "加载授权说明", async () => setAgreement(await RealAuthApi.agreement() as Agreement));
  };
  const supplement = (l: License) => act(l.id, "补充协议", async () => {
    if (!agreement) return;
    try {
      await LicenseApi.supplement(l.id, agreement.version);
      setSupplementId(""); setAccepted(false); setReload(v => v + 1);
    } catch (e: any) {
      if (e?.code === "DAP_LIVENESS_REAUTH_REQUIRED" && l.char) { window.location.href = captureHref(l.char); return; }
      throw e;
    }
  });

  return <>
    <div className="account-filters">
      <div className="account-seg" role="group" aria-label="按状态筛选">
        {FILTERS.map(f => <button key={f.key} type="button" aria-pressed={filter === f.key} onClick={() => setFilter(f.key)}>{f.label}<small>{f.key === "all" ? licenses.length : count(f.key)}</small></button>)}
      </div>
      <a className="account-go" href={captureHref()}><Plus size={15} strokeWidth={1.8} aria-hidden="true" />添加真人</a>
    </div>
    <p className="account-muted" style={{ marginBottom: 16 }}>每条素材单独审核，通过后可在生成视频时选用。同一个人补充素材不用重新刷脸。</p>

    {needAuth.length > 0 && <section className="account-notice" aria-label="待授权">
      <IconBox tone="is-text"><AlertTriangle /></IconBox>
      <span><strong style={{ fontWeight: 500 }}>{needAuth.length} 个真人待授权</strong><br /><span className="account-muted">{needAuth.map(a => `「${a.name}」`).join("")}还没有生效的授权，暂时不能用于生成视频。</span></span>
      {needAuth.slice(0, 3).map(a => <a key={a.id} className="account-button" href={captureHref(a.id)}>为{a.name}授权</a>)}
    </section>}

    <LoadState loading={loading} error={error} onRetry={() => setReload(v => v + 1)}
      empty={!loading && !error && shown.length === 0 ? <><strong>{licenses.length ? "没有符合条件的授权" : "还没有真人素材"}</strong>{!licenses.length && <span>上传图片或视频，完成刷脸核验与逐条审核后，可在生成视频时选用。</span>}</> : undefined}>
      <div className="account-licenses">
        {shown.map(l => {
          const s = STATUS[l.status] ?? STATUS.pending;
          const verified = l.evidenceStatus === "verified";
          return <article key={l.id} className="account-card" aria-label={`${l.subject}的授权`}>
            <div className="account-license-head">
              <div><strong>{l.subject}</strong><span className="account-code">{l.id.startsWith("LIC-") ? l.id : `LIC-${l.id}`}</span></div>
              {verified && <span className="account-tag is-ai">已刷脸核验</span>}
              <span className={`account-tag ${s.tone}`}>{s.label}</span>
            </div>
            <dl className="account-kv">
              {l.scope && <><dt>授权范围</dt><dd>{l.scope}</dd></>}
              {l.period && <><dt>授权期限</dt><dd>{l.period}</dd></>}
              {!!l.platforms?.length && <><dt>使用平台</dt><dd>{l.platforms.join(" · ")}</dd></>}
              <dt>协议版本</dt><dd>{l.agreementVersion || "历史版本"}</dd>
              <dt>绑定素材</dt><dd>{l.photos ?? 0} 份（加密存档）</dd>
            </dl>
            {supplementId === l.id && <div className="account-agreement">
              {!agreement ? <span className="account-muted">正在加载授权说明…</span> : <>
                <strong style={{ fontWeight: 500 }}>{agreement.title}</strong>
                <p className="account-muted" style={{ marginTop: 4 }}>{agreement.summary}</p>
                <dl className="account-kv" style={{ padding: "8px 0 0" }}>
                  <dt>授权范围</dt><dd>{agreement.scope}</dd><dt>有效期限</dt><dd>{agreement.periodMonths} 个月</dd><dt>处理方</dt><dd>{agreement.processors.join(" · ")}</dd>
                </dl>
                <label><input type="checkbox" checked={accepted} onChange={e => setAccepted(e.target.checked)} /><span>我已阅读并同意按以上范围处理和使用本人的真人素材。</span></label>
              </>}
            </div>}
            {open === l.id && <div style={{ padding: "0 20px 16px" }}>
              <MaterialSection refType="subject" refId={l.char} mode="readonly" title="素材审核状态" style={{ boxShadow: "none", background: "#f7f8fa" }} />
            </div>}
            <div className="account-license-foot">
              {l.status === "active" && <a className="account-button is-ink" href={captureHref(l.char)}>补充素材</a>}
              {l.status === "active" && <button type="button" className="account-button" disabled={busy === l.id} onClick={() => void download(l)}>下载凭证</button>}
              {l.status === "expired" && <button type="button" className="account-button is-ink" disabled={busy === l.id} onClick={() => void renew(l)}>续签</button>}
              {l.status === "pending" && (supplementId === l.id
                ? <><button type="button" className="account-button is-ink" disabled={!agreement || !accepted || busy === l.id} onClick={() => void supplement(l)}>确认并补充协议</button>
                    {!accepted && agreement && <span className="account-muted">请先勾选同意授权说明</span>}
                    <button type="button" className="account-button" onClick={() => void openSupplement(l)}>收起</button></>
                : <button type="button" className="account-button is-ink" onClick={() => void openSupplement(l)}>补充协议</button>)}
              <button type="button" className="account-button" style={{ marginLeft: "auto" }} aria-expanded={open === l.id} onClick={() => setOpen(open === l.id ? "" : l.id)}>
                授权素材{open === l.id ? <ChevronUp size={14} aria-hidden="true" /> : <ChevronDown size={14} aria-hidden="true" />}
              </button>
            </div>
          </article>;
        })}
      </div>
    </LoadState>
  </>;
}
