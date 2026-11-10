"use client";

// 存储用量：数字资产与 IP Studio 生成、上传的文件合并成一个口径（/api/v1/ip-studio/storage）。

import { useEffect, useState } from "react";
import { AudioLines, Image as ImageIcon, MoreHorizontal, ShieldCheck, Upload, UserRound, Video } from "lucide-react";
import type { StudioStorageCategory, StudioStorageUsage } from "@ai-star-eco/types";
import { AccountApi } from "@/ip/api";
import { WalletApi } from "@/proto/api";
import { formatMb } from "./account-overview";
import { IconBox, LoadState } from "./account-ui";

const META: Record<StudioStorageCategory["key"], { color: string; tone: string; icon: typeof ImageIcon; sub: string }> = {
  image: { color: "#4650cf", tone: "is-image", icon: ImageIcon, sub: "AI 图片、画布、导演台" },
  video: { color: "#8b6cf0", tone: "is-video", icon: Video, sub: "AI 视频、画布、导演台、导出的成片" },
  "digital-human": { color: "#17202a", tone: "is-person", icon: UserRound, sub: "人物、场景、产品" },
  upload: { color: "#e0a64a", tone: "is-text", icon: Upload, sub: "画布附件、资产库上传" },
  audio: { color: "#1f9a7e", tone: "is-audio", icon: AudioLines, sub: "配音、声音样本" },
  license: { color: "#c5cad1", tone: "is-person", icon: ShieldCheck, sub: "刷脸核验和授权用的照片、视频" },
  other: { color: "#a3abb4", tone: "is-person", icon: MoreHorizontal, sub: "其他文件" },
};

export function AccountStorage() {
  const [usage, setUsage] = useState<StudioStorageUsage>();
  const [error, setError] = useState("");
  const [reload, setReload] = useState(0);
  // 后台配了存储空间套餐才给购买入口，否则会员页上找不到可买的东西。
  const [canBuy, setCanBuy] = useState(false);
  const [enforced, setEnforced] = useState(false);
  useEffect(() => {
    let live = true;
    WalletApi.packages().then(list => { if (live) setCanBuy(list.some(p => ((p as { grantStorageMb?: number | null }).grantStorageMb ?? 0) > 0)); }).catch(() => {});
    AccountApi.trashPolicy().then(p => { if (live) setEnforced(p.storageEnforced); }).catch(() => {});
    return () => { live = false; };
  }, []);
  useEffect(() => {
    let live = true;
    setError("");
    AccountApi.storageUsage().then(v => { if (live) setUsage(v); }).catch(() => { if (live) setError("存储用量加载失败，请稍后刷新重试。"); });
    return () => { live = false; };
  }, [reload]);

  const quota = Math.max(1, usage?.quotaMb ?? 1);
  const categories = [...(usage?.categories ?? [])].sort((a, b) => b.mb - a.mb);
  let acc = 0;
  const stops = categories.filter(c => c.mb > 0).map(c => {
    const from = acc; acc += c.mb / quota * 100;
    return `${META[c.key].color} ${from.toFixed(2)}% ${Math.min(100, acc).toFixed(2)}%`;
  });
  const ring = `conic-gradient(${[...stops, `#eef0f3 ${Math.min(100, acc).toFixed(2)}% 100%`].join(",")})`;
  const over = usage ? usage.usedMb > usage.quotaMb : false;

  return <LoadState loading={!usage && !error} error={error} onRetry={() => setReload(v => v + 1)}>
    {usage && <>
      <section className="account-card account-storage" aria-label="总用量">
        <div className="account-ring" role="img" aria-label={`已用 ${formatMb(usage.usedMb)}，共 ${formatMb(usage.quotaMb)}`} style={{ background: ring }}>
          <div><b>{formatMb(usage.usedMb)}</b><span className="account-muted">已用，共 {formatMb(usage.quotaMb)}</span></div>
        </div>
        <div style={{ flex: 1, minWidth: 260, display: "flex", flexDirection: "column", gap: 14 }}>
          <div>
            <div style={{ fontSize: 15, fontWeight: 500, color: over ? "var(--ip-error)" : undefined }}>{over ? `已超出 ${formatMb(usage.usedMb - usage.quotaMb)}` : `剩余 ${formatMb(usage.quotaMb - usage.usedMb)}`}</div>
            <p className="account-muted" style={{ marginTop: 2, fontSize: 12.5 }}>包含你生成和上传的文件。{enforced ? "超过上限后不能再上传文件。" : ""}</p>
          </div>
          <div className="account-quota">
            <div><span className="account-muted">基础空间</span><b>{formatMb(usage.baseQuotaMb)}</b></div>
            <div><span className="account-muted">已购扩容</span><b>{formatMb(usage.grantedMb)}</b></div>
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {canBuy && <a className="account-go" href="/studio#/membership">购买存储空间</a>}
            <a className="account-button" href="/studio#/trash">清理回收站</a>
          </div>
        </div>
      </section>

      <section className="account-section" aria-labelledby="account-storage-types">
        <div className="account-section-head"><h2 id="account-storage-types">按类型</h2></div>
        <div className="account-card account-list" style={{ overflow: "hidden" }}>
          {categories.map(c => {
            const m = META[c.key] ?? META.other; const Icon = m.icon;
            const pct = usage.usedMb > 0 ? Math.round(c.mb / usage.usedMb * 100) : 0;
            return <div key={c.key} className="account-storage-row" style={{ ["--fill" as string]: m.color }}>
              <IconBox tone={m.tone}><Icon /></IconBox>
              <span><span>{c.label}</span><small>{m.sub}</small></span>
              <div className="account-track" role="img" aria-label={`${pct}%`}><i style={{ width: `${pct}%` }} /></div>
              <span className="account-right" style={{ fontWeight: 500 }}>{formatMb(c.mb)}</span>
              <span className="account-right account-muted">{pct}%</span>
            </div>;
          })}
        </div>
      </section>
    </>}
  </LoadState>;
}
