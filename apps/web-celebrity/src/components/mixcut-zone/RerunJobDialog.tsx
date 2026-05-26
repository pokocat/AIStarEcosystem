"use client";

// ─────────────────────────────────────────────────────────────────────────────
// RerunJobDialog — v0.30+
// 「重跑任务」入口：基于原 job 的完整快照 fork 出新 job，仅允许覆盖 variants + profile。
// 错误态：409 MISSING_ASSETS → 切到错误视图列出已删素材 + 两个出口（去素材库 / 用模板从头做）。
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Loader2, RefreshCw } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@ai-star-eco/ui/ui/dialog";
import { RadioGroup, RadioGroupItem } from "@ai-star-eco/ui/ui/radio-group";
import { Button } from "@/components/mixcut-zone/ui/button";
import { Input } from "@/components/mixcut-zone/ui/input";
import { Label } from "@/components/mixcut-zone/ui/label";
import { MixcutApi, ApiError } from "@/api";
import type { MissingAssetItem, PerturbationProfile, RenderJob } from "@/components/mixcut-zone/types";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  job: RenderJob;
}

const PROFILE_LABEL: Record<PerturbationProfile, string> = {
  light: "细微变化（每条几乎一样）",
  moderate: "均衡变化（推荐）",
  aggressive: "明显变化（差异最大）",
};

const KIND_LABEL: Record<string, string> = {
  video: "视频",
  image: "图片",
  audio: "音频",
  sticker: "贴图",
};

export function RerunJobDialog({ open, onOpenChange, job }: Props) {
  const router = useRouter();
  const [variants, setVariants] = useState<number>(job.output_variants);
  const [profile, setProfile] = useState<PerturbationProfile>(job.perturbation_profile);
  const [submitting, setSubmitting] = useState(false);
  const [missing, setMissing] = useState<MissingAssetItem[] | null>(null);
  const [genericError, setGenericError] = useState<string | null>(null);

  // 每次打开 dialog 重置表单为原 job 的当前值；关闭时不立即清，避免淡出动画看到闪烁
  useEffect(() => {
    if (open) {
      setVariants(job.output_variants);
      setProfile(job.perturbation_profile);
      setMissing(null);
      setGenericError(null);
      setSubmitting(false);
    }
  }, [open, job.output_variants, job.perturbation_profile]);

  // 把 missing 列表里的 kind 友好化（"video" → "视频"）；保留 slot/asset id 让运维定位
  const missingFormatted = useMemo(() => {
    if (!missing) return [];
    return missing.map((m) => ({
      ...m,
      kindLabel: m.kind ? (KIND_LABEL[m.kind] ?? m.kind) : "素材",
    }));
  }, [missing]);

  const close = () => {
    if (submitting) return; // 防止提交中误关
    onOpenChange(false);
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    setGenericError(null);
    setMissing(null);
    try {
      const safeVariants = Math.max(1, Math.min(10, Math.floor(variants)));
      const newJob = await MixcutApi.rerunJob(job.id, {
        output_variants: safeVariants,
        perturbation_profile: profile,
      });
      // 成功 → 关 dialog + 跳到新任务详情页（前端轮询会接管）
      onOpenChange(false);
      router.push(`/mixcut/jobs/${encodeURIComponent(newJob.id)}`);
    } catch (e) {
      if (e instanceof ApiError && e.code === "MISSING_ASSETS") {
        const details = (e.details ?? {}) as { missing_assets?: MissingAssetItem[] };
        setMissing(details.missing_assets ?? []);
      } else if (e instanceof ApiError) {
        setGenericError(`${e.code}: ${e.message}`);
      } else {
        setGenericError(e instanceof Error ? e.message : "重新生成失败，请稍后再试");
      }
      setSubmitting(false);
    }
  };

  // ── 视图分支 1：缺素材错误态 ─────────────────────────────────────────────
  if (missing) {
    return (
      <Dialog open={open} onOpenChange={(v) => !submitting && onOpenChange(v)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-amber-600">
              <AlertTriangle className="size-5" /> 无法继续：素材已被删除
            </DialogTitle>
            <DialogDescription>
              这个任务用到的 {missing.length} 个素材已被删除，无法继续生成。
              可以重新上传素材后再试，或基于同一模板从头开始。
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-60 overflow-y-auto space-y-1.5 rounded-md border border-border bg-secondary/30 p-3">
            {missingFormatted.map((m) => (
              <div key={`${m.slot_id}-${m.asset_id}`} className="text-xs leading-snug">
                <span className="text-muted-foreground">位置「</span>
                <span className="text-foreground">{m.slot_id}</span>
                <span className="text-muted-foreground">」的{m.kindLabel}已删除</span>
              </div>
            ))}
          </div>
          <DialogFooter className="gap-2 sm:gap-2">
            <Button
              variant="outline"
              onClick={() => {
                onOpenChange(false);
                router.push(`/mixcut/library?tab=assets`);
              }}
            >
              去素材库上传
            </Button>
            <Button
              onClick={() => {
                onOpenChange(false);
                router.push(`/mixcut/create/${encodeURIComponent(job.template_id)}`);
              }}
            >
              从模板重新开始
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  // ── 视图分支 2：默认表单 ────────────────────────────────────────────────
  return (
    <Dialog open={open} onOpenChange={(v) => !submitting && onOpenChange(v)}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <RefreshCw className="size-5" /> 再生成一批
          </DialogTitle>
          <DialogDescription>
            用原来的素材和配置再生成一批视频。可以调整生成数量和差异程度；其它设置保持不变。
          </DialogDescription>
        </DialogHeader>

        {/* 原任务摘要 chip */}
        <div className="flex flex-wrap gap-1.5 text-[11px]">
          <span className="rounded-full bg-secondary px-2 py-0.5 text-secondary-foreground">
            模板 · {job.template_name ?? job.template_id}
          </span>
          <span className="rounded-full bg-secondary px-2 py-0.5 text-secondary-foreground">
            上次 {job.output_variants} 条 · {PROFILE_LABEL[job.perturbation_profile]}
          </span>
        </div>

        <div className="space-y-4 pt-2">
          <div>
            <Label className="text-xs text-muted-foreground">生成几条视频（1 - 10）</Label>
            <Input
              type="number"
              min={1}
              max={10}
              value={variants}
              onChange={(e) => setVariants(Math.max(1, Math.min(10, parseInt(e.target.value, 10) || 1)))}
              className="mt-1 h-9 text-sm"
              disabled={submitting}
            />
          </div>

          <div>
            <Label className="text-xs text-muted-foreground">每条视频的差异程度</Label>
            <RadioGroup
              value={profile}
              onValueChange={(v) => setProfile(v as PerturbationProfile)}
              className="mt-2 space-y-1.5"
              disabled={submitting}
            >
              {(Object.keys(PROFILE_LABEL) as PerturbationProfile[]).map((p) => (
                <label
                  key={p}
                  htmlFor={`rerun-profile-${p}`}
                  className="flex cursor-pointer items-center gap-2 rounded-md border border-border px-3 py-2 text-sm hover:bg-secondary/40 has-[:checked]:border-foreground"
                >
                  <RadioGroupItem id={`rerun-profile-${p}`} value={p} />
                  <span>{PROFILE_LABEL[p]}</span>
                </label>
              ))}
            </RadioGroup>
          </div>
        </div>

        {genericError && (
          <div className="rounded-md border border-red-500/40 bg-red-500/10 px-3 py-2 text-xs text-red-600">
            {genericError}
          </div>
        )}

        <DialogFooter className="gap-2 sm:gap-2">
          <Button variant="ghost" onClick={close} disabled={submitting}>
            取消
          </Button>
          <Button onClick={handleSubmit} disabled={submitting}>
            {submitting && <Loader2 className="size-4 animate-spin" />}
            {submitting ? "提交中…" : `开始生成 ${variants} 条`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
