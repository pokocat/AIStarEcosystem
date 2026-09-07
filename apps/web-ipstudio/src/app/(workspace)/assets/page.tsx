"use client";

// ─────────────────────────────────────────────────────────────────────────────
// 数字资产 —— 工作台里的资产库（只读）。
//
// 存在的理由：画布「发布」之后，形象就登记进数字资产了，但在这之前工作台只能给一条
// 跳去 aiavatar 的外链 —— 那是移动端 H5，桌面上打开尺寸和导航都不对，而且人一走
// 就断了「造形象 → 登记资产 → 对外发布」这条链。现在同一套接口在工作台自己渲染。
//
// **只读**：这里不做生成、不做编辑、不扣任何积分。要改形象回画布，要生成短动作去 dap。
// ─────────────────────────────────────────────────────────────────────────────

import * as React from "react";
import Link from "next/link";
import {
  AlertCircle, ExternalLink, IdCard, ImageOff, Layers, Loader2, RefreshCw, Sparkles, Video,
} from "lucide-react";
import { isProductNotEnrolledError } from "@ai-star-eco/api-client";
import { AssetsApi } from "@/api";
import type {
  AssetSummary, CardSummary, DapAvatar, DapDerivative, DapLook,
} from "@/lib/asset-types";
import { AIAVATAR_URL, cardPublicHref } from "@/lib/external";
import { MockBadge } from "@/components/common/mock-badge";
import { StatusPill } from "@/components/common/status-pill";

/**
 * 形象没有定妆图时的占位 —— 不要拿空 img 撑一个破图框。
 *
 * `compact` 用于列表里 44px 宽的小图：那点宽度塞不下说明文字，
 * 硬塞只会挤成两三行还被裁掉，只留图标。
 */
function Placeholder({ label, ratio = "3 / 4", compact }: { label: string; ratio?: string; compact?: boolean }) {
  return (
    <div
      className="w-full grid place-items-center gap-1.5"
      style={{ aspectRatio: ratio, background: "var(--surface-2)", color: "var(--ink-4)" }}
      title={compact ? label : undefined}
    >
      <ImageOff className={compact ? "w-4 h-4" : "w-5 h-5"} />
      {!compact && (
        <span className="text-[11px] px-2 text-center leading-tight" style={{ color: "var(--ink-3)" }}>{label}</span>
      )}
    </div>
  );
}

function Thumb({
  url, alt, label, ratio, compact,
}: { url?: string | null; alt: string; label: string; ratio?: string; compact?: boolean }) {
  if (!url) return <Placeholder label={label} ratio={ratio} compact={compact} />;
  // eslint-disable-next-line @next/next/no-img-element -- 资产图是签名 CDN 地址，尺寸不定，不走 next/image 优化
  return <img src={url} alt={alt} className="w-full object-cover" style={{ aspectRatio: ratio ?? "3 / 4" }} />;
}

const PATH_LABEL: Record<string, string> = { ai: "AI 原创", real: "真人复刻" };

/** 衍生物类型 → 人话。服务端枚举不该出现在界面上（§8）。 */
const KIND_LABEL: Record<string, string> = {
  video: "短动作视频", expr: "表情", scene: "场景图", ward: "换装", pose: "姿势", voice: "声音",
};

export default function AssetsPage() {
  const [summary, setSummary] = React.useState<AssetSummary | null>(null);
  const [avatars, setAvatars] = React.useState<DapAvatar[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [notEnrolled, setNotEnrolled] = React.useState(false);
  const [selected, setSelected] = React.useState<string | null>(null);

  const load = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // 概览是锦上添花，形象列表才是主体 —— 概览挂了不该让整页空着。
      const [list, sum] = await Promise.all([
        AssetsApi.listAvatars(),
        AssetsApi.summary().catch(() => null),
      ]);
      setAvatars(list);
      setSummary(sum);
      setSelected((cur) => cur ?? list[0]?.id ?? null);
    } catch (e) {
      if (isProductNotEnrolledError(e)) setNotEnrolled(true);
      else setError(e instanceof Error ? e.message : "资产读不出来");
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => { void load(); }, [load]);

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
      {/* 页头 */}
      <div className="shrink-0 px-6 pt-6 pb-4 flex items-end gap-4 flex-wrap">
        <div className="min-w-0">
          <h1 className="asset-name text-[24px] mb-1">数字资产</h1>
          <p className="text-[13.5px]" style={{ color: "var(--ink-2)" }}>
            画布发布出来的形象都登记在这儿。这一页只读 —— 改形象回项目，出短动作去数字资产平台。
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
        </div>
      </div>

      {/* 六类概览 */}
      {summary && (
        <div className="shrink-0 px-6 pb-4">
          <div className="ledger-card px-4 py-3 flex items-center gap-1 flex-wrap">
            {summary.types.map((t, i) => (
              <React.Fragment key={t.key}>
                {i > 0 && <span className="w-px h-7 mx-1 shrink-0" style={{ background: "var(--line)" }} />}
                <span className="px-2.5 py-1 min-w-0">
                  <span className="block text-[15px] font-bold tabular leading-none" style={{ color: t.count ? "var(--ink)" : "var(--ink-4)" }}>
                    {t.count}
                  </span>
                  <span className="block reg mt-1 truncate">{t.prefix} · {t.label}</span>
                </span>
              </React.Fragment>
            ))}
            <span className="ml-auto text-[12px] pl-3 shrink-0" style={{ color: "var(--ink-3)" }}>
              共占用 {summary.totalSizeLabel}
            </span>
          </div>
        </div>
      )}

      {/* 主体：左形象列表 / 右详情 */}
      <div className="flex-1 min-h-0 px-6 pb-6">
        {loading && !avatars.length ? (
          <div className="ledger-card h-full grid place-items-center">
            <span className="inline-flex items-center gap-2 text-[13.5px]" style={{ color: "var(--ink-2)" }}>
              <Loader2 className="w-4 h-4 animate-spin" /> 资产加载中
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
        ) : !avatars.length ? (
          <div className="ledger-card h-full grid place-items-center px-6 text-center">
            <div className="max-w-sm">
              <Sparkles className="w-7 h-7 mx-auto mb-3" style={{ color: "var(--ink-4)" }} />
              <div className="asset-name text-[17px] mb-2">还没有登记的形象</div>
              <p className="text-[13.5px] leading-[1.75] mb-4" style={{ color: "var(--ink-2)" }}>
                在项目里跑完一套形象、点「发布」，形象就会登记到这里，随后才能拿去做名片。
              </p>
              <Link
                href="/projects"
                className="inline-flex h-9 px-4 rounded-[9px] text-[13.5px] font-semibold items-center"
                style={{ background: "var(--primary)", color: "var(--on-primary)" }}
              >
                去项目
              </Link>
            </div>
          </div>
        ) : (
          // 窄屏上下堆叠：两栏并排低于约 900px 会把右侧详情挤塌（人名竖排、标签裁成「AI …」）。
          // 只有桌面宽度才用左右两栏。
          <div className="h-full min-h-0 grid gap-4 grid-rows-[auto_minmax(0,1fr)] lg:grid-rows-1 lg:grid-cols-[minmax(240px,300px)_minmax(0,1fr)]">
            <div className="ledger-card min-h-0 max-h-[176px] lg:max-h-none overflow-y-auto scrollbar-thin p-2">
              {avatars.map((a) => {
                const on = a.id === selected;
                return (
                  <button
                    key={a.id}
                    onClick={() => setSelected(a.id)}
                    className="w-full text-left rounded-[11px] p-2 flex gap-2.5 items-center transition"
                    style={{ background: on ? "var(--primary-tint)" : "transparent" }}
                  >
                    <span className="w-11 shrink-0 rounded-[8px] overflow-hidden" style={{ border: "1px solid var(--line-2)" }}>
                      <Thumb url={a.imageUrl} alt={a.name} label="还没有定妆图" compact />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block asset-name text-[15px] truncate" style={{ color: "var(--ink)" }}>{a.name}</span>
                      <span className="block reg truncate mt-0.5">{a.id}</span>
                    </span>
                    {a.mock && (
                      <span className="reg shrink-0 px-1.5 py-0.5 rounded" style={{ background: "var(--warn-soft)", color: "var(--warn)" }}>样例</span>
                    )}
                  </button>
                );
              })}
            </div>

            <div className="ledger-card min-h-0 overflow-y-auto scrollbar-thin">
              {selected ? <AvatarDetail key={selected} avatar={avatars.find((a) => a.id === selected)!} /> : null}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── 形象详情 ─────────────────────────────────────────────────────────────────

function AvatarDetail({ avatar }: { avatar: DapAvatar }) {
  const [looks, setLooks] = React.useState<DapLook[] | null>(null);
  const [derivs, setDerivs] = React.useState<DapDerivative[] | null>(null);
  const [cards, setCards] = React.useState<CardSummary[] | null>(null);
  const [failed, setFailed] = React.useState(false);

  React.useEffect(() => {
    let alive = true;
    setFailed(false);
    void Promise.all([
      AssetsApi.looks(avatar.id),
      AssetsApi.derivatives(avatar.id).catch(() => [] as DapDerivative[]),
      AssetsApi.cardsByAvatar(avatar.id).catch(() => [] as CardSummary[]),
    ])
      .then(([l, d, c]) => { if (alive) { setLooks(l); setDerivs(d); setCards(c); } })
      .catch(() => {
        if (!alive) return;
        // 失败也必须给三个 state 一个终值 —— 停在 null 的那一节会永远转骨架，
        // 用户看到的是「一直在加载」而不是「加载失败」。
        setFailed(true);
        setLooks([]); setDerivs([]); setCards([]);
      });
    return () => { alive = false; };
  }, [avatar.id]);

  return (
    <div className="p-5">
      <div className="flex gap-4 items-start mb-5 flex-wrap">
        <div className="w-[112px] shrink-0 rounded-[11px] overflow-hidden" style={{ border: "1px solid var(--line-2)" }}>
          <Thumb url={avatar.imageUrl} alt={avatar.name} label="还没有定妆图" />
        </div>
        <div className="min-w-0 flex-1 basis-[220px]">
          <div className="asset-name text-[21px] mb-1 truncate" title={avatar.name}>{avatar.name}</div>
          <div className="reg mb-2.5">{avatar.id} · V{avatar.versions}</div>
          <p className="text-[13.5px] leading-[1.7] mb-3" style={{ color: "var(--ink-2)", overflowWrap: "anywhere" }}>
            {avatar.tagline || avatar.archetype || "还没有写简介"}
          </p>
          <div className="flex flex-wrap gap-1.5">
            {PATH_LABEL[avatar.path] && <Tag>{PATH_LABEL[avatar.path]}</Tag>}
            {avatar.archetype && <Tag>{avatar.archetype}</Tag>}
            <Tag>更新于 {avatar.updated}</Tag>
          </div>
        </div>
        <a
          href={`${AIAVATAR_URL}/assets/${encodeURIComponent(avatar.id)}`}
          target="_blank"
          rel="noreferrer"
          className="shrink-0 h-8 px-3 rounded-[9px] text-[13px] font-semibold inline-flex items-center gap-1.5 transition hover:opacity-80"
          style={{ background: "var(--surface-2)", color: "var(--ink-2)" }}
          title="去数字资产平台：改设定、生成表情与短动作视频"
        >
          去编辑 <ExternalLink className="w-3.5 h-3.5" />
        </a>
      </div>

      {failed && (
        <div className="mb-4 px-3 py-2.5 rounded-[11px] text-[13px]" style={{ background: "var(--err-soft)", color: "var(--err)" }}>
          这个形象的造型读不出来，稍后再试。
        </div>
      )}

      {/* 名片 —— 这个形象的对外发布面 */}
      <Section icon={IdCard} title="名片" count={cards?.length}>
        {cards === null ? <Skeleton /> : cards.length === 0 ? (
          <Empty>
            这个形象还没做成名片。名片是形象的对外发布面 —— 递一条链接出去，对方不用注册就能看。
          </Empty>
        ) : (
          <div className="flex flex-col gap-2">
            {cards.map((c) => (
              <div key={c.id} className="flex items-center gap-3 px-3 py-2.5 rounded-[11px]" style={{ background: "var(--surface-2)" }}>
                <span className="min-w-0 flex-1">
                  <span className="block text-[13.5px] font-semibold truncate" title={c.publicUrl}>{c.publicUrl}</span>
                  <span className="block reg mt-0.5">{c.regNo}</span>
                </span>
                <StatusPill published={c.status === "published"} />
                {c.status === "published" && (
                  <a
                    href={cardPublicHref(c.publicUrl)}
                    target="_blank"
                    rel="noreferrer"
                    className="shrink-0 text-[13px] font-semibold inline-flex items-center gap-1"
                    style={{ color: "var(--primary-700)" }}
                  >
                    打开 <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                )}
              </div>
            ))}
          </div>
        )}
      </Section>

      {/* 造型 */}
      <Section icon={Layers} title="造型" count={looks?.length}>
        {looks === null ? <Skeleton /> : looks.length === 0 ? (
          <Empty>还没有造型。在项目里跑形象卡，发布后就会登记到这里。</Empty>
        ) : (
          <div className="grid gap-2.5" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(116px, 1fr))" }}>
            {looks.map((l) => (
              <div key={l.id} className="rounded-[11px] overflow-hidden" style={{ border: "1px solid var(--line-2)" }}>
                <Thumb url={l.imageUrl} alt={l.label} label="待出图" />
                <div className="px-2 py-1.5" style={{ background: "var(--surface)" }}>
                  <div className="text-[12.5px] font-semibold truncate" title={l.label}>{l.label}</div>
                  <div className="reg truncate mt-0.5">{l.id}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </Section>

      {/* 短动作 / 其他衍生物 */}
      <Section icon={Video} title="短动作与衍生" count={derivs?.length}>
        {derivs === null ? <Skeleton /> : derivs.length === 0 ? (
          <Empty>
            还没有短动作视频。短动作要有形象才能跑 —— 发布之后到数字资产平台里生成，画布里排不了。
          </Empty>
        ) : (
          <div className="grid gap-2.5" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(116px, 1fr))" }}>
            {derivs.map((d) => (
              <div key={d.id} className="rounded-[11px] overflow-hidden" style={{ border: "1px solid var(--line-2)" }}>
                <Thumb url={d.thumbUrl} alt={d.label || KIND_LABEL[d.kind] || "衍生物"} label="待出图" ratio="1 / 1" />
                <div className="px-2 py-1.5" style={{ background: "var(--surface)" }}>
                  <div className="text-[12.5px] font-semibold truncate" title={d.label || KIND_LABEL[d.kind] || undefined}>{d.label || KIND_LABEL[d.kind] || "衍生物"}</div>
                  <div className="text-[11px] truncate mt-0.5" style={{ color: "var(--ink-3)" }} title={d.spec || d.id}>
                    {d.spec || d.id}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </Section>
    </div>
  );
}

// ── 小件 ─────────────────────────────────────────────────────────────────────

function Tag({ children }: { children: React.ReactNode }) {
  return (
    <span
      className="px-2 py-0.5 rounded-full text-[12px] max-w-full truncate"
      style={{ background: "var(--surface-2)", color: "var(--ink-2)" }}
    >
      {children}
    </span>
  );
}

function Section({
  icon: Icon, title, count, children,
}: {
  icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>;
  title: string;
  count?: number;
  children: React.ReactNode;
}) {
  return (
    <section className="mb-5 last:mb-0">
      <div className="flex items-center gap-2 mb-2.5">
        <Icon className="w-4 h-4" style={{ color: "var(--ink-3)" }} />
        <span className="text-[14px] font-bold">{title}</span>
        {count !== undefined && <span className="reg">{count}</span>}
      </div>
      {children}
    </section>
  );
}

function Skeleton() {
  return (
    <div className="h-16 rounded-[11px] grid place-items-center" style={{ background: "var(--surface-2)" }}>
      <Loader2 className="w-4 h-4 animate-spin" style={{ color: "var(--ink-4)" }} />
    </div>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="px-3 py-3 rounded-[11px] text-[13px] leading-[1.7]"
      style={{ background: "var(--surface-2)", color: "var(--ink-2)" }}
    >
      {children}
    </div>
  );
}
