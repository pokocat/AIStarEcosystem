"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowUpRight, Flame, Pencil, RefreshCcw, Trash2 } from "lucide-react";
import { useAuth } from "@ai-star-eco/api-client";
import type { CelebrityStar } from "@ai-star-eco/types/celebrity-zone";
import {
  AUTH_STATUS_META,
  CATEGORY_BADGE_CLASS,
  ENGINE_META,
} from "@/constants/celebrity-zone-ui";
import { CelebrityAuthBanner } from "./CelebrityAuthBanner";
import { CelebrityPricingTierCard } from "./CelebrityPricingTierCard";
import { CelebrityHeroCta } from "./CelebrityHeroCta";
import { CelebrityVideoPlayer } from "./CelebrityVideoPlayer";
import { StarFormDialog } from "./StarFormDialog";
import { CelebrityZoneApi } from "@/api";
import { canUseOperatorTools } from "@/lib/operator-role";
import { useConfirm } from "@/components/common/confirm-dialog";
import { useProducerShell } from "@/lib/celebrity-shell-context";
import { cn } from "@ai-star-eco/ui/ui/utils";

interface Props {
  star: CelebrityStar;
  /** v0.55+：明星被运营编辑后回调（父级重新拉 getStar 刷新）。 */
  onChanged?: () => void | Promise<void>;
}

const CHEAPEST_CREDIT_PRICE = Math.min(
  ...Object.values(ENGINE_META).map((m) => m.creditPrice),
);

/** P2 明星详情：左资料 + 右示例/套餐；已授权且积分够时顶部显示醒目 CTA。 */
export function CelebrityStarDetail({ star, onChanged }: Props) {
  const router = useRouter();
  const { user } = useAuth();
  const canManage = canUseOperatorTools(user?.operatorRole);
  const { confirm, ConfirmHost } = useConfirm();
  const [editing, setEditing] = React.useState(false);
  const [actionError, setActionError] = React.useState<string | null>(null);

  const handleDelete = async () => {
    const ok = await confirm({
      title: `删除明星「${star.name}」？`,
      description:
        "删除后该明星不再出现在用户端市场，但历史已生成的视频与项目不受影响。该操作不可撤销。",
      confirmText: "删除",
      tone: "danger",
    });
    if (!ok) return;
    setActionError(null);
    try {
      await CelebrityZoneApi.deleteStar(star.id);
      router.push("/market");
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "删除失败");
    }
  };

  const { wallet } = useProducerShell();
  const auth = AUTH_STATUS_META[star.authorization.status];
  const isAuthorized = star.authorization.status === "authorized";
  const generateHref = `/star/${star.id}/generate`;
  const walletBalance = wallet?.totalBalance ?? 0;

  const currentTier = isAuthorized
    ? star.pricing.find((t) => t.name === star.pricingTier)
    : undefined;

  return (
    <div className="flex flex-col gap-5">
      {/* 顶部：返回 + 标题 */}
      <div className="flex items-center gap-3">
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-1 rounded-full border border-zinc-200 bg-white px-3 py-1.5 text-xs text-zinc-600 transition hover:border-zinc-300 hover:text-zinc-900"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> 返回
        </Link>
        <h1 className="text-lg font-semibold text-zinc-800">
          {star.name} · 明星详情
        </h1>
        {star.isHot && (
          <span className="inline-flex items-center gap-1 rounded-md border border-pink-400/40 bg-pink-500/15 px-1.5 py-0.5 text-[11px] font-medium text-pink-600">
            <Flame className="h-3 w-3" /> 热门
          </span>
        )}
        {canManage && (
          <div className="ml-auto flex items-center gap-2">
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="inline-flex items-center gap-1 rounded-md border border-violet-400/40 bg-violet-500/10 px-2.5 py-1.5 text-xs text-violet-600 transition hover:border-violet-500 hover:bg-violet-500/20"
            >
              <Pencil className="h-3.5 w-3.5" /> 编辑明星
            </button>
            <button
              type="button"
              onClick={() => void handleDelete()}
              className="inline-flex items-center gap-1 rounded-md border border-rose-300 bg-rose-50 px-2.5 py-1.5 text-xs text-rose-600 transition hover:border-rose-400 hover:bg-rose-100"
            >
              <Trash2 className="h-3.5 w-3.5" /> 删除
            </button>
          </div>
        )}
      </div>

      {actionError && (
        <div className="rounded-md border border-rose-300 bg-rose-50 px-3 py-2 text-xs text-rose-700">
          操作失败：{actionError}
        </div>
      )}

      {/* 授权横幅（unauthorized / pending / expired 时） */}
      <CelebrityAuthBanner star={star} />

      {/* 已授权 → 醒目 Hero CTA（积分不足切到充值态） */}
      {isAuthorized && (
        <CelebrityHeroCta
          star={star}
          walletBalance={walletBalance}
          requiredCredits={CHEAPEST_CREDIT_PRICE}
          generateHref={generateHref}
        />
      )}

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
        {/* 左：资料 */}
        <div className="flex flex-col gap-4">
          {/* 个人信息 */}
          <div className="flex flex-col items-center gap-3 overflow-hidden rounded-2xl border border-zinc-200 bg-white p-4 shadow-[var(--shadow-soft)]">
            <div className="relative w-full">
              {star.cover ? (
                <img
                  src={star.cover}
                  alt={star.name}
                  loading="lazy"
                  className="aspect-[3/4] w-full rounded-xl object-cover"
                />
              ) : (
                <div
                  aria-label={star.name}
                  className="flex aspect-[3/4] w-full items-center justify-center rounded-xl bg-gradient-to-br from-zinc-200 to-zinc-300 text-5xl font-semibold text-zinc-500"
                >
                  {star.name.charAt(0)}
                </div>
              )}
              <span
                className={cn(
                  "absolute right-2 top-2 inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold tracking-wide text-white shadow-[var(--shadow-lift)] ring-1 ring-white/40",
                  star.authorization.status === "authorized" && "bg-emerald-500",
                  star.authorization.status === "pending" && "bg-amber-500",
                  star.authorization.status === "expired" && "bg-pink-500",
                  star.authorization.status === "unauthorized" && "bg-zinc-700",
                )}
              >
                {auth.label}
              </span>
            </div>
            <div className="text-center">
              <div className="text-lg font-semibold text-zinc-900">
                {star.name}
              </div>
              <div className="mt-2 flex flex-wrap justify-center gap-1.5">
                <span
                  className={cn(
                    "rounded-md border px-2 py-0.5 text-[11px]",
                    CATEGORY_BADGE_CLASS[star.category],
                  )}
                >
                  {star.category}
                </span>
                {star.subCategories?.map((sc) => (
                  <span
                    key={sc}
                    className={cn(
                      "rounded-md border px-2 py-0.5 text-[11px]",
                      CATEGORY_BADGE_CLASS[sc],
                    )}
                  >
                    {sc}
                  </span>
                ))}
              </div>
              <p className="mt-3 text-xs leading-relaxed text-zinc-600">
                {star.description}
              </p>
            </div>
          </div>

          {/* 授权信息 */}
          <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-[var(--shadow-soft)]">
            <div className="mb-3 text-sm font-medium text-zinc-700">授权信息</div>
            <dl className="space-y-2 text-xs">
              <Row k="状态" v={<span className={authToneClass(auth.tone)}>{auth.label}</span>} />
              {star.authorization.scenes.length > 0 && (
                <Row k="场景" v={star.authorization.scenes.join(" · ")} />
              )}
              {star.authorization.expireDate && (
                <Row k="有效期" v={star.authorization.expireDate} />
              )}
              <Row
                k="可用风格"
                v={`${star.authorization.availableStyles} 种`}
              />
              {star.pricingTier && (
                <Row
                  k="您的套餐"
                  v={`${star.pricingTier} · ${star.quotaUsed ?? 0}/${
                    star.quotaTotal ?? 0
                  } 条`}
                />
              )}
            </dl>
          </div>

          {/* 效果数据 */}
          <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-[var(--shadow-soft)]">
            <div className="mb-3 text-sm font-medium text-zinc-700">效果数据</div>
            <div className="grid grid-cols-2 gap-3">
              <Metric label="已生成" value={star.stats.totalGenerated.toString()} accent="text-violet-600" />
              <Metric label="总播放" value={star.stats.totalPlays} accent="text-violet-600" />
              <Metric label="转化率" value={star.stats.conversionRate} accent="text-emerald-600" />
              <Metric label="GMV" value={star.stats.gmv} accent="text-pink-600" />
            </div>
          </div>
        </div>

        {/* 右：示例 + 套餐 */}
        <div className="flex flex-col gap-4">
          {/* 示例视频（真实可播放） */}
          <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-[var(--shadow-soft)]">
            <div className="mb-3 flex items-center justify-between">
              <span className="text-sm font-medium text-zinc-700">示例视频</span>
              <span className="text-[11px] text-zinc-500">
                {star.sampleVideos.length} 个样片 · 点击播放
              </span>
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {star.sampleVideos.slice(0, 8).map((sv) => (
                <div key={sv.id} className="flex flex-col gap-1.5">
                  <CelebrityVideoPlayer
                    src={sv.videoUrl}
                    poster={sv.thumb}
                    aspect="9/16"
                  />
                  <div className="px-0.5">
                    <div className="text-[11px] font-medium text-zinc-700">
                      {sv.label}
                    </div>
                    <div className="text-[10px] text-zinc-500">{sv.category}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* 套餐：按授权态分支 */}
          {isAuthorized && currentTier ? (
            <CurrentTierBlock star={star} />
          ) : (
            <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-[var(--shadow-soft)]">
              <div className="mb-3 flex items-center justify-between">
                <span className="text-sm font-medium text-zinc-700">授权套餐</span>
                {!isAuthorized && (
                  <span className="text-[11px] text-zinc-500">
                    授权通过后方可开通
                  </span>
                )}
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                {star.pricing.map((tier) => (
                  <CelebrityPricingTierCard
                    key={tier.id}
                    tier={tier}
                    authorized={isAuthorized}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 运营：明星编辑表单 + 删除确认 */}
      {canManage && editing && (
        <StarFormDialog
          star={star}
          onClose={() => setEditing(false)}
          onSaved={async () => {
            setEditing(false);
            await onChanged?.();
          }}
        />
      )}
      <ConfirmHost />
    </div>
  );
}

function CurrentTierBlock({ star }: { star: CelebrityStar }) {
  const tier = star.pricing.find((t) => t.name === star.pricingTier);
  if (!tier) return null;
  const used = star.quotaUsed ?? 0;
  const total = star.quotaTotal ?? 0;
  const pct = total > 0 ? Math.min(100, (used / total) * 100) : 0;
  return (
    <div className="rounded-2xl border border-violet-400/40 bg-gradient-to-br from-violet-500/[0.10] to-violet-500/[0.04] p-5 shadow-[var(--shadow-lift)]">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-zinc-700">您的套餐</span>
          <span className="rounded-md border border-emerald-400/40 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-600">
            ✓ 当前
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href={`/star/${star.id}/apply`}
            className="inline-flex items-center gap-1 rounded-md border border-violet-400/40 bg-violet-500/10 px-2.5 py-1 text-[11px] text-violet-600 transition hover:border-violet-500 hover:bg-violet-500/20"
          >
            <ArrowUpRight className="h-3 w-3" /> 升级套餐
          </Link>
          <Link
            href={`/star/${star.id}/apply`}
            className="inline-flex items-center gap-1 rounded-md border border-zinc-200 bg-white px-2.5 py-1 text-[11px] text-zinc-600 transition hover:border-zinc-300 hover:text-zinc-900"
          >
            <RefreshCcw className="h-3 w-3" /> 续费
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
        <div>
          <div className="text-2xl font-bold text-violet-600 tabular-nums">{tier.price}</div>
          <ul className="mt-2 flex flex-col gap-1 text-[11px] text-zinc-600">
            {tier.features.map((f) => (
              <li key={f}>• {f}</li>
            ))}
          </ul>
        </div>
        <div className="rounded-xl border border-zinc-200 bg-white p-3">
          <div className="flex items-center justify-between text-[11px]">
            <span className="text-zinc-500">本月用量</span>
            <span className="tabular-nums text-zinc-800">{used}/{total} 条</span>
          </div>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-zinc-100">
            <div
              className="h-full rounded-full bg-gradient-to-r from-violet-500 to-violet-400"
              style={{ width: `${pct}%` }}
            />
          </div>
          <div className="mt-2 text-[10px] text-zinc-500">
            提示：套餐余量耗尽后可继续按积分扣费生成。
          </div>
        </div>
      </div>
    </div>
  );
}

function Row({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="text-zinc-500">{k}</dt>
      <dd className="text-zinc-700 text-right">{v}</dd>
    </div>
  );
}

function Metric({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-lg border border-zinc-200 bg-zinc-50 py-3">
      <span className={cn("text-xl font-bold tabular-nums", accent)}>{value}</span>
      <span className="mt-1 text-[11px] text-zinc-500">{label}</span>
    </div>
  );
}

function authToneClass(tone: "success" | "warning" | "danger" | "muted") {
  switch (tone) {
    case "success":
      return "text-emerald-600";
    case "warning":
      return "text-amber-600";
    case "danger":
      return "text-pink-600";
    default:
      return "text-zinc-500";
  }
}
