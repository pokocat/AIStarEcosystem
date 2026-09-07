"use client";

// ─────────────────────────────────────────────────────────────────────────────
// 名片 —— 这条链的最后一段：造形象 → 登记资产 → **对外发布**。
//
// 工作台这一页是**展示**：看有哪些名片、哪些已经发出去了、链接是什么、用的哪个形象。
// 建卡与编辑在 aiavatar 上（那边是名片的主场，也是访客真正看到的样子），
// 这里给一条直达外链，不在工作台里再造一套表单。
// ─────────────────────────────────────────────────────────────────────────────

import * as React from "react";
import Link from "next/link";
import { AlertCircle, ExternalLink, IdCard, Loader2, RefreshCw } from "lucide-react";
import { isProductNotEnrolledError } from "@ai-star-eco/api-client";
import { AssetsApi } from "@/api";
import type { CardSummary, DapAvatar } from "@/lib/asset-types";
import { AIAVATAR_URL, cardPublicHref } from "@/lib/external";
import { useToast } from "@/components/common/toast";
import { MockBadge } from "@/components/common/mock-badge";
import { StatusPill } from "@/components/common/status-pill";

export default function CardsPage() {
  const { toast } = useToast();
  const [cards, setCards] = React.useState<CardSummary[]>([]);
  const [avatars, setAvatars] = React.useState<DapAvatar[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [notEnrolled, setNotEnrolled] = React.useState(false);

  const load = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // 形象只是用来把 avatarId 显示成人看得懂的名字，读不到就退化成显示编号。
      const [list, avs] = await Promise.all([
        AssetsApi.myCards(),
        AssetsApi.listAvatars().catch(() => [] as DapAvatar[]),
      ]);
      setCards(list);
      setAvatars(avs);
    } catch (e) {
      if (isProductNotEnrolledError(e)) setNotEnrolled(true);
      else setError(e instanceof Error ? e.message : "名片读不出来");
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => { void load(); }, [load]);

  const copy = async (c: CardSummary) => {
    try {
      await navigator.clipboard.writeText(cardPublicHref(c.publicUrl));
      toast("链接已复制", "ok");
    } catch {
      toast("复制没成功，手动从新窗口地址栏复制", "warn");
    }
  };

  const avatarName = (id: string | null) =>
    (id ? avatars.find((a) => a.id === id)?.name : null) ?? id ?? "未绑定形象";

  if (notEnrolled) {
    return (
      <div className="p-8 max-w-lg">
        <div className="ledger-card p-6">
          <div className="asset-name text-[18px] mb-2">还没开通数字资产平台</div>
          <p className="text-[14px] leading-[1.75]" style={{ color: "var(--ink-2)" }}>
            AI IP 工作台与数字资产平台共用一份开通。刷新页面会引导你完成开通。
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full min-h-0 flex flex-col">
      <div className="shrink-0 px-6 pt-6 pb-4 flex items-end gap-4 flex-wrap">
        <div className="min-w-0">
          <h1 className="asset-name text-[24px] mb-1">名片</h1>
          <p className="text-[13.5px]" style={{ color: "var(--ink-2)" }}>
            形象的对外发布面。递一条链接出去，对方不用注册就能看；取消发布后链接立刻打不开。
          </p>
        </div>
        <div className="ml-auto flex items-center gap-2 shrink-0">
          <MockBadge />
          <button
            onClick={() => void load()}
            className="h-8 px-3 rounded-[9px] text-[13px] font-semibold inline-flex items-center gap-1.5 transition hover:opacity-80"
            style={{ background: "var(--surface)", border: "1px solid var(--line-2)", color: "var(--ink-2)" }}
          >
            <RefreshCw className="w-3.5 h-3.5" /> 刷新
          </button>
          <a
            href={`${AIAVATAR_URL}/cards`}
            target="_blank"
            rel="noreferrer"
            className="h-8 px-3 rounded-[9px] text-[13px] font-semibold inline-flex items-center gap-1.5 transition hover:opacity-90"
            style={{ background: "var(--primary)", color: "var(--on-primary)" }}
            title="名片的建卡与编辑在数字资产平台上"
          >
            管理名片 <ExternalLink className="w-3.5 h-3.5" />
          </a>
        </div>
      </div>

      <div className="flex-1 min-h-0 px-6 pb-6">
        {loading && !cards.length ? (
          <div className="ledger-card h-full grid place-items-center">
            <span className="inline-flex items-center gap-2 text-[13.5px]" style={{ color: "var(--ink-2)" }}>
              <Loader2 className="w-4 h-4 animate-spin" /> 名片加载中
            </span>
          </div>
        ) : error ? (
          <div className="ledger-card h-full grid place-items-center px-6 text-center">
            <div>
              <AlertCircle className="w-6 h-6 mx-auto mb-2" style={{ color: "var(--err)" }} />
              <div className="text-[14px] mb-3" style={{ color: "var(--ink-2)" }}>{error}</div>
              <button
                onClick={() => void load()}
                className="h-9 px-4 rounded-[9px] text-[13.5px] font-semibold"
                style={{ background: "var(--primary)", color: "var(--on-primary)" }}
              >
                重试
              </button>
            </div>
          </div>
        ) : !cards.length ? (
          <div className="ledger-card h-full grid place-items-center px-6 text-center">
            <div className="max-w-md">
              <IdCard className="w-7 h-7 mx-auto mb-3" style={{ color: "var(--ink-4)" }} />
              <div className="asset-name text-[17px] mb-2">还没有名片</div>
              <p className="text-[13.5px] leading-[1.75] mb-4" style={{ color: "var(--ink-2)" }}>
                名片要先有一个形象。在项目里跑完一套形象、点「发布」登记成数字资产，
                再到数字资产平台上建一张名片 —— 之后见客户扫码就能打开。
              </p>
              <div className="flex gap-2 justify-center flex-wrap">
                <Link
                  href="/assets"
                  className="inline-flex h-9 px-4 rounded-[9px] text-[13.5px] font-semibold items-center"
                  style={{ background: "var(--surface-2)", color: "var(--ink)" }}
                >
                  看我的形象
                </Link>
                <a
                  href={`${AIAVATAR_URL}/cards`}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex h-9 px-4 rounded-[9px] text-[13.5px] font-semibold items-center gap-1.5"
                  style={{ background: "var(--primary)", color: "var(--on-primary)" }}
                >
                  去建一张 <ExternalLink className="w-3.5 h-3.5" />
                </a>
              </div>
            </div>
          </div>
        ) : (
          <div className="grid gap-3 content-start" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))" }}>
            {cards.map((c) => (
              <div key={c.id} className="ledger-card p-4 flex flex-col gap-3">
                <div className="flex items-start gap-2">
                  <span className="min-w-0 flex-1">
                    <span className="block asset-name text-[16px] truncate" title={avatarName(c.avatarId)}>
                      {avatarName(c.avatarId)}
                    </span>
                    <span className="block reg mt-1 truncate">{c.regNo}</span>
                  </span>
                  <StatusPill published={c.status === "published"} />
                </div>

                <div
                  className="px-2.5 py-2 rounded-[9px] text-[12.5px] truncate"
                  style={{ background: "var(--surface-2)", color: "var(--ink-2)", fontFamily: "var(--font-mono)" }}
                  title={cardPublicHref(c.publicUrl)}
                >
                  {c.publicUrl}
                </div>

                <div className="flex gap-2 mt-auto">
                  <button
                    onClick={() => void copy(c)}
                    disabled={c.status !== "published"}
                    className="flex-1 min-w-0 h-8 rounded-[9px] text-[13px] font-semibold transition hover:opacity-80 disabled:cursor-not-allowed"
                    style={c.status === "published"
                      ? { background: "var(--surface-2)", color: "var(--ink)" }
                      : { background: "var(--surface-2)", color: "var(--ink-4)" }}
                    title={c.status === "published" ? undefined : "还没发布，复制出去也打不开"}
                  >
                    复制链接
                  </button>
                  {/* 草稿没有「打开」—— 公开页对未发布的名片一律 404，本人也一样，
                      给个按钮点下去只会得到一个「找不到」页面。 */}
                  {c.status === "published" ? (
                    <a
                      href={cardPublicHref(c.publicUrl)}
                      target="_blank"
                      rel="noreferrer"
                      className="flex-1 min-w-0 h-8 rounded-[9px] text-[13px] font-semibold inline-flex items-center justify-center gap-1.5 transition hover:opacity-90"
                      style={{ background: "var(--primary)", color: "var(--on-primary)" }}
                    >
                      打开 <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  ) : (
                    <a
                      href={`${AIAVATAR_URL}/cards`}
                      target="_blank"
                      rel="noreferrer"
                      className="flex-1 min-w-0 h-8 rounded-[9px] text-[13px] font-semibold inline-flex items-center justify-center gap-1.5 transition hover:opacity-80"
                      style={{ background: "var(--surface-2)", color: "var(--ink-2)" }}
                      title="草稿还没发布，链接打不开；去发布它"
                    >
                      去发布 <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
