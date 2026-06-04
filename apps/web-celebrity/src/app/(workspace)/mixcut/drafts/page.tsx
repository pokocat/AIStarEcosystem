"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Sparkles,
  Bookmark,
  Pencil,
  Trash2,
  Loader2,
  Package,
  AlertTriangle,
  ArrowUpRight,
  Layers,
} from "lucide-react";
import { Card, CardContent } from "@/components/mixcut-zone/ui/card";
import { Button } from "@/components/mixcut-zone/ui/button";
import { Badge } from "@/components/mixcut-zone/ui/badge";
import { MixcutApi, ApiError } from "@/api";
import type { MixcutDraft } from "@/components/mixcut-zone/types";
import { PROFILE_LABELS } from "@/constants/mixcut-ui";
import { relativeTime } from "@/components/mixcut-zone/lib/utils";
import { useConfirm } from "@/components/common/confirm-dialog";

/**
 * v0.48+: 草稿箱 / 我的实例。
 *
 * 「模版 → 实例 → 生成任务」中间层的列表入口：列出用户保存的实例，可继续编辑 / 直接生成 / 删除。
 * 继续编辑 → /mixcut/create/{template_id}?draft_id={id}（恢复填充态）。
 */
export default function MixcutDraftsPage() {
  const router = useRouter();
  const { confirm, ConfirmHost } = useConfirm();
  const [drafts, setDrafts] = useState<MixcutDraft[] | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [errorById, setErrorById] = useState<Record<string, string>>({});

  const load = () => {
    MixcutApi.listDrafts()
      .then(setDrafts)
      .catch(() => setDrafts([]));
  };

  useEffect(() => {
    load();
  }, []);

  const handleGenerate = async (d: MixcutDraft) => {
    setBusyId(d.id);
    setErrorById((prev) => ({ ...prev, [d.id]: "" }));
    try {
      const job = await MixcutApi.generateFromDraft(d.id);
      router.push(`/mixcut/jobs/${job.id}`);
    } catch (e) {
      let msg = "生成失败，请稍后再试";
      if (e instanceof ApiError && e.code === "MISSING_ASSETS") {
        msg = "有素材已被删除，无法直接生成。请点「继续编辑」补上素材后再试。";
      } else if (e instanceof ApiError) {
        msg = e.message;
      } else if (e instanceof Error) {
        msg = e.message;
      }
      setErrorById((prev) => ({ ...prev, [d.id]: msg }));
      setBusyId(null);
    }
  };

  const handleDelete = async (d: MixcutDraft) => {
    const ok = await confirm({
      title: "删除这份草稿？",
      description: (
        <p>
          删除后无法恢复：<b>{d.name}</b>。已经生成的视频不受影响。
        </p>
      ),
      confirmText: "删除",
      cancelText: "保留",
      tone: "danger",
    });
    if (!ok) return;
    setBusyId(d.id);
    try {
      await MixcutApi.deleteDraft(d.id);
      setDrafts((prev) => (prev ? prev.filter((x) => x.id !== d.id) : prev));
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="px-6 lg:px-8 py-6 space-y-6 max-w-[1600px] mx-auto">
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
            <Bookmark className="size-5 text-violet-500" />
            草稿箱
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            填了一半的配置存这里。同一份配置可以继续编辑、反复生成；生成的视频会记得当时用的实例。
          </p>
        </div>
        <Button variant="gradient" className="h-10 rounded-2xl px-4" asChild>
          <Link href="/mixcut/templates">
            <Sparkles className="size-4" /> 去模板库
          </Link>
        </Button>
      </div>

      {drafts === null ? (
        <div className="py-16 text-center text-sm text-muted-foreground">加载中…</div>
      ) : drafts.length === 0 ? (
        <Card>
          <CardContent className="py-14 text-center">
            <div className="mx-auto mb-3 grid size-12 place-items-center rounded-full bg-secondary text-muted-foreground">
              <Bookmark className="size-5" />
            </div>
            <div className="text-sm font-medium">还没有草稿</div>
            <p className="mt-1 text-xs text-muted-foreground">
              在模板里填好素材后点「保存草稿」，就能在这里继续编辑、反复生成。
            </p>
            <Button variant="outline" size="sm" className="mt-4" asChild>
              <Link href="/mixcut/templates">挑一个模板开始</Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {drafts.map((d) => {
            const filledCount = Object.keys(d.slot_bindings ?? {}).length;
            const busy = busyId === d.id;
            const err = errorById[d.id];
            return (
              <Card key={d.id} className="overflow-hidden">
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-start gap-3">
                    <div className="w-12 aspect-[9/16] rounded-md bg-gradient-to-br from-slate-700 to-slate-900 shrink-0 grid place-items-center overflow-hidden">
                      {d.template_thumbnail ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={d.template_thumbnail} alt="" className="h-full w-full object-cover" />
                      ) : (
                        <Layers className="size-4 text-white/40" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="font-medium text-sm truncate">{d.name}</div>
                      <div className="text-xs text-muted-foreground truncate mt-0.5">
                        模板：{d.template_name ?? d.template_id}
                      </div>
                      <div className="mt-1.5 flex items-center gap-1.5 flex-wrap">
                        <Badge variant="muted" className="text-[10px]">
                          {PROFILE_LABELS[d.perturbation_profile]}
                        </Badge>
                        <Badge variant="muted" className="text-[10px]">
                          {d.output_variants} 条
                        </Badge>
                        {filledCount > 0 && (
                          <span className="text-[10px] text-muted-foreground">已填 {filledCount} 项</span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 text-[11px] text-muted-foreground flex-wrap">
                    <span>更新于 {relativeTime(d.updated_at)}</span>
                    {d.generated_job_count > 0 && (
                      <>
                        <span className="text-muted-foreground/40">·</span>
                        <span className="inline-flex items-center gap-1">
                          <ArrowUpRight className="size-3" />
                          生成过 {d.generated_job_count} 次
                        </span>
                      </>
                    )}
                    {d.product_id && (
                      <>
                        <span className="text-muted-foreground/40">·</span>
                        <span className="inline-flex items-center gap-1">
                          <Package className="size-3" />
                          关联商品
                        </span>
                      </>
                    )}
                  </div>

                  {err && (
                    <div className="flex items-start gap-1.5 rounded-md border border-rose-500/30 bg-rose-500/5 px-2.5 py-1.5 text-[11px] text-rose-700">
                      <AlertTriangle className="size-3.5 shrink-0 mt-0.5" />
                      <span>{err}</span>
                    </div>
                  )}

                  <div className="flex items-center gap-2 pt-1">
                    <Button variant="outline" size="sm" className="flex-1" asChild>
                      <Link href={`/mixcut/create/${d.template_id}?draft_id=${encodeURIComponent(d.id)}`}>
                        <Pencil className="size-3.5" /> 继续编辑
                      </Link>
                    </Button>
                    <Button
                      variant="gradient"
                      size="sm"
                      className="flex-1"
                      disabled={busy}
                      onClick={() => handleGenerate(d)}
                    >
                      {busy ? <Loader2 className="size-3.5 animate-spin" /> : <Sparkles className="size-3.5" />}
                      直接生成
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-8 text-muted-foreground hover:text-rose-600"
                      disabled={busy}
                      onClick={() => handleDelete(d)}
                      title="删除草稿"
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
      <ConfirmHost />
    </div>
  );
}
