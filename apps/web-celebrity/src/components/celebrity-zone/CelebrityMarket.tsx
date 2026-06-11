"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowDownAZ, Filter, Flame, Plus, ShieldCheck, Sparkles } from "lucide-react";
import { useAuth } from "@ai-star-eco/api-client";
import { CelebrityStarCard } from "./CelebrityStarCard";
import { StarFormDialog } from "./StarFormDialog";
import { CelebrityZoneApi } from "@/api";
import { canUseOperatorTools } from "@/lib/operator-role";
import { useConfirm } from "@/components/common/confirm-dialog";
import { CATEGORY_FILTERS, CTA_PRIMARY, CTA_SECONDARY } from "@/constants/celebrity-zone-ui";
import type {
  CelebrityCategory,
  CelebrityStar,
} from "@ai-star-eco/types/celebrity-zone";
import { cn } from "@ai-star-eco/ui/ui/utils";

interface Props {
  stars: CelebrityStar[];
  /** v0.55+：明星增删改后回调（父级重新拉 listStars 刷新）。 */
  onChanged?: () => void | Promise<void>;
}

type SortKey = "hot" | "price-asc" | "price-desc";
const SORT_LABEL: Record<SortKey, string> = {
  hot: "热度优先",
  "price-asc": "价格从低到高",
  "price-desc": "价格从高到低",
};

/** P1 主体：「我的授权明星」(顶部) + 类目筛选 + 排序 + 4 列明星网格（市场全量）。 */
export function CelebrityMarket({ stars, onChanged }: Props) {
  const [category, setCategory] = React.useState<"全部" | CelebrityCategory>("全部");
  const [sort, setSort] = React.useState<SortKey>("hot");

  // v0.55+：运营角色 (operatorRole) 内嵌管理明星（与 v0.31 商品库同款 canManage 模式）。
  const { user } = useAuth();
  const canManage = canUseOperatorTools(user?.operatorRole);
  const { confirm, ConfirmHost } = useConfirm();
  const [creating, setCreating] = React.useState(false);
  const [actionError, setActionError] = React.useState<string | null>(null);

  const handleDelete = React.useCallback(
    async (s: CelebrityStar) => {
      const ok = await confirm({
        title: `删除明星「${s.name}」？`,
        description:
          "删除后该明星不再出现在用户端市场，但历史已生成的视频与项目不受影响。该操作不可撤销。",
        confirmText: "删除",
        tone: "danger",
      });
      if (!ok) return;
      setActionError(null);
      try {
        await CelebrityZoneApi.deleteStar(s.id);
        await onChanged?.();
      } catch (err) {
        setActionError(err instanceof Error ? err.message : "删除失败");
      }
    },
    [confirm, onChanged],
  );

  // 透传给每个卡片的运营管理 props（非运营时为 undefined，卡片不渲染入口）。
  // v0.62：编辑入口下线（档案编辑移交 web-star /profile），仅保留删除。
  const cardManageProps = canManage
    ? { canManage: true, onDelete: handleDelete }
    : {};

  const authorizedStars = React.useMemo(
    () => stars.filter((s) => s.authorization.status === "authorized"),
    [stars],
  );

  // v0.37+：合并自 /cast —— 同一页面展示「已授权 / 审核中 / 已过期」三段，不再分两个菜单。
  const pendingStars = React.useMemo(
    () => stars.filter((s) => s.authorization.status === "pending"),
    [stars],
  );
  const expiredStars = React.useMemo(
    () => stars.filter((s) => s.authorization.status === "expired"),
    [stars],
  );

  const filtered = React.useMemo(() => {
    let s = stars;
    if (category !== "全部") {
      s = s.filter(
        (x) => x.category === category || x.subCategories?.includes(category),
      );
    }
    s = [...s];
    if (sort === "hot") {
      s.sort((a, b) => Number(b.isHot) - Number(a.isHot));
    } else {
      const parse = (p: string) => parseInt(p.replace(/[^\d]/g, ""), 10) || 0;
      s.sort((a, b) =>
        sort === "price-asc"
          ? parse(a.startingPrice) - parse(b.startingPrice)
          : parse(b.startingPrice) - parse(a.startingPrice),
      );
    }
    return s;
  }, [stars, category, sort]);

  return (
    <div className="flex flex-col gap-6">
      {actionError && (
        <div className="rounded-md border border-rose-300 bg-rose-50 px-3 py-2 text-xs text-rose-700">
          操作失败：{actionError}
        </div>
      )}

      {/* ─── 我的授权明星 ─── */}
      <section className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <ShieldCheck className="h-4 w-4 text-emerald-600" />
          <h2 className="text-base font-semibold text-zinc-800">我的授权明星</h2>
          <span className="rounded-md border border-emerald-400/30 bg-emerald-500/10 px-1.5 py-0.5 text-[10px] text-emerald-600">
            {authorizedStars.length} 位
          </span>
          <span className="ml-auto text-[11px] text-zinc-500">
            可直接进入生成工作台
          </span>
        </div>

        {authorizedStars.length === 0 ? (
          <AuthorizedEmpty />
        ) : (
          <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-4">
            {authorizedStars.map((s) => (
              <CelebrityStarCard key={s.id} star={s} {...cardManageProps} />
            ))}
          </div>
        )}
      </section>

      {/* ─── 审核中 / 已过期（合并自 /cast；条件展示，零结果不渲染） ─── */}
      {pendingStars.length > 0 && (
        <section className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <Sparkles className="h-4 w-4 text-amber-500" />
            <h2 className="text-base font-semibold text-zinc-800">审核中</h2>
            <span className="rounded-md border border-amber-300 bg-amber-50 px-1.5 py-0.5 text-[10px] text-amber-700">
              {pendingStars.length} 位
            </span>
          </div>
          <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-4">
            {pendingStars.map((s) => (
              <CelebrityStarCard key={s.id} star={s} {...cardManageProps} />
            ))}
          </div>
        </section>
      )}

      {expiredStars.length > 0 && (
        <section className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <Sparkles className="h-4 w-4 text-rose-500" />
            <h2 className="text-base font-semibold text-zinc-800">已过期</h2>
            <span className="rounded-md border border-rose-300 bg-rose-50 px-1.5 py-0.5 text-[10px] text-rose-700">
              {expiredStars.length} 位
            </span>
            <span className="ml-auto text-[11px] text-zinc-500">需重新授权后才能继续生成</span>
          </div>
          <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-4">
            {expiredStars.map((s) => (
              <CelebrityStarCard key={s.id} star={s} {...cardManageProps} />
            ))}
          </div>
        </section>
      )}

      {/* ─── 全部明星市场 ─── */}
      <section id="all-stars" className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center gap-2">
          <Sparkles className="h-4 w-4 text-violet-600" />
          <h2 className="text-base font-semibold text-zinc-800">全部明星</h2>
          <span className="rounded-md border border-violet-400/30 bg-violet-500/10 px-1.5 py-0.5 text-[10px] text-violet-600">
            {stars.length} 位
          </span>
          <div className="ml-auto flex items-center gap-3">
            <span className="text-[11px] text-zinc-500">
              浏览市场全量明星，按需申请授权
            </span>
            {canManage && (
              <button
                type="button"
                onClick={() => setCreating(true)}
                className="inline-flex items-center gap-1 rounded-md bg-violet-600 px-2.5 py-1.5 text-xs font-medium text-white transition hover:bg-violet-700"
              >
                <Plus className="h-3.5 w-3.5" /> 新增明星
              </button>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3 border-b border-zinc-200">
          <div className="flex flex-wrap gap-1">
            {CATEGORY_FILTERS.map((c) => (
              <button
                key={c}
                onClick={() => setCategory(c)}
                className={cn(
                  "relative px-4 py-2 text-sm font-medium transition",
                  category === c
                    ? "text-violet-600"
                    : "text-zinc-500 hover:text-zinc-800",
                )}
              >
                {c}
                {category === c && (
                  <span className="absolute bottom-0 left-0 right-0 h-[2px] rounded-t bg-gradient-to-r from-violet-500 to-violet-400" />
                )}
              </button>
            ))}
          </div>
          <div className="flex-1" />
          <div className="flex items-center gap-2">
            <Filter className="h-3.5 w-3.5 text-zinc-500" />
            <SortMenu sort={sort} onChange={setSort} />
          </div>
        </div>

        {filtered.length === 0 ? (
          <div className="rounded-xl border border-dashed border-zinc-200 px-6 py-16 text-center text-sm text-zinc-500">
            没有符合筛选条件的明星
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-4">
            {filtered.map((s) => (
              <CelebrityStarCard key={s.id} star={s} {...cardManageProps} />
            ))}
          </div>
        )}
      </section>

      {/* 运营：明星新增表单 + 删除确认（编辑已移交 web-star /profile） */}
      {canManage && creating && (
        <StarFormDialog
          onClose={() => setCreating(false)}
          onSaved={async () => {
            setCreating(false);
            await onChanged?.();
          }}
        />
      )}
      <ConfirmHost />
    </div>
  );
}

function AuthorizedEmpty() {
  return (
    <div className="overflow-hidden rounded-2xl border-2 border-dashed border-violet-500/25 bg-gradient-to-br from-violet-500/[0.05] via-violet-500/[0.04] to-pink-500/[0.04] p-6">
      <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:gap-5">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-violet-400/30 bg-violet-500/10">
          <ShieldCheck className="h-6 w-6 text-violet-600" />
        </div>
        <div className="flex-1">
          <h3 className="text-base font-semibold text-zinc-800">
            您还没有授权的明星
          </h3>
          <p className="mt-1 text-sm leading-relaxed text-zinc-600">
            授权后即可进入生成工作台，输入商品信息一键产出 AI 带货短视频。
            您可以在下方市场浏览所有明星形象，看中后申请商务合作或购买体验版套餐。
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <a href="#all-stars" className={CTA_SECONDARY}>
            浏览全部明星
          </a>
          <Link href="mailto:bd@aistareco.com" className={CTA_PRIMARY}>
            <Flame className="h-3.5 w-3.5" /> 联系商务签约
          </Link>
        </div>
      </div>
    </div>
  );
}

function SortMenu({
  sort,
  onChange,
}: {
  sort: SortKey;
  onChange: (next: SortKey) => void;
}) {
  const [open, setOpen] = React.useState(false);
  const ref = React.useRef<HTMLDivElement>(null);
  React.useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener("mousedown", handler);
    return () => window.removeEventListener("mousedown", handler);
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="inline-flex items-center gap-1 rounded-md border border-zinc-200 bg-white px-2.5 py-1.5 text-xs text-zinc-600 transition hover:border-zinc-300 hover:text-zinc-900"
      >
        {sort === "hot" ? (
          <Flame className="h-3 w-3" />
        ) : (
          <ArrowDownAZ className="h-3 w-3" />
        )}
        {SORT_LABEL[sort]}
      </button>
      {open && (
        <div className="absolute right-0 top-full z-10 mt-1 min-w-[160px] overflow-hidden rounded-md border border-zinc-200 bg-white shadow-[var(--shadow-lift)]">
          {(Object.keys(SORT_LABEL) as SortKey[]).map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => {
                onChange(k);
                setOpen(false);
              }}
              className={cn(
                "block w-full px-3 py-2 text-left text-xs transition hover:bg-zinc-100",
                sort === k ? "text-violet-600 font-medium" : "text-zinc-600",
              )}
            >
              {SORT_LABEL[k]}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
