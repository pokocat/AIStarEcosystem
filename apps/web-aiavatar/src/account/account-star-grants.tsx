"use client";

// 授权 · 明星形象授权（原「授权中心 · 授权给我的」，2026-11-10 并入账号区）。
// 真值在明星带货一侧：申请和审批在 AI 明星带货与明星工作台，这里只展示结果。数据：AssetApi.starGrants()。

import { useEffect, useState } from "react";
import Link from "next/link";
import { AssetApi } from "@/proto/api";
import type { StarGrant } from "@/proto/data";
import { LoadState } from "./account-ui";

const STATUS: Record<string, { label: string; tone: string }> = {
  authorized: { label: "生效中", tone: "is-ok" },
  pending: { label: "审批中", tone: "is-warn" },
  expired: { label: "已到期", tone: "is-error" },
};

export function AccountStarGrants() {
  const [grants, setGrants] = useState<StarGrant[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [reload, setReload] = useState(0);
  useEffect(() => {
    let live = true;
    setLoading(true); setError("");
    AssetApi.starGrants().then(list => { if (live) setGrants(list || []); })
      .catch(() => { if (live) setError("明星形象授权加载失败，请稍后刷新重试。"); })
      .finally(() => { if (live) setLoading(false); });
    return () => { live = false; };
  }, [reload]);

  return <>
    <p className="account-muted" style={{ marginBottom: 16 }}>申请和审批在 AI 明星带货中进行，这里只显示结果。</p>
    <LoadState loading={loading} error={error} onRetry={() => setReload(v => v + 1)}
      empty={!loading && !error && grants.length === 0 ? <><strong>还没有明星形象授权</strong><span>在 AI 明星带货中选择明星并申请授权，审批通过后会显示在这里。</span></> : undefined}>
      <div className="account-licenses">
        {grants.map(g => {
          const s = STATUS[g.status] ?? { label: "状态待确认", tone: "" };
          return <article key={g.id} className="account-card" aria-label={`${g.starName}的形象授权`}>
            <div className="account-license-head">
              <div><strong>{g.starName}</strong><span className="account-muted">明星形象</span></div>
              <span className={`account-tag ${s.tone}`}>{s.label}</span>
            </div>
            <dl className="account-kv">
              <dt>可用场景</dt><dd>{g.scenes.length ? g.scenes.join("、") : "以授权约定为准"}</dd>
              <dt>有效期至</dt><dd>{g.expireDate || (g.status === "pending" ? "审批通过后确定" : "—")}</dd>
            </dl>
            <div className="account-license-foot"><Link className="account-button" href={`/stars/${encodeURIComponent(g.id)}`}>查看详情</Link></div>
          </article>;
        })}
      </div>
    </LoadState>
  </>;
}
