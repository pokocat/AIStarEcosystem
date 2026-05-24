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
  light: "轻度（高保真，差异小）",
  moderate: "中度（推荐，平衡）",
  aggressive: "重度（更易过审 / 不易判重）",
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
        setGenericError(e instanceof Error ? e.message : "重跑失败，请稍后再试");
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
              <AlertTriangle className="size-5" /> 无法重跑：素材已删除
            </DialogTitle>
            <DialogDescription>
              这个任务用到的 {missing.length} 个素材已被删除，重跑会取不到文件。
              你可以重新上传同名素材后再试，或用同一模板从头做一份。
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-60 overflow-y-auto space-y-1.5 rounded-md border border-border bg-secondary/30 p-3">
            {missingFormatted.map((m) => (
              <div key={`${m.slot_id}-${m.asset_id}`} className="text-xs font-mono leading-snug">
                <span className="text-muted-foreground">槽位</span>{" "}
                <span className="text-foreground">{m.slot_id}</span>
                <span className="text-muted-foreground"> · {m.kindLabel} · </span>
                <span className="text-foreground/70">{m.asset_id}</span>
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
              去素材库重传
            </Button>
            <Button
              onClick={() => {
                onOpenChange(false);
                router.push(`/mixcut/create/${encodeURIComponent(job.template_id)}`);
              }}
            >
              用模板从头做
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
            <RefreshCw className="size-5" /> 重新跑这个任务
          </DialogTitle>
          <DialogDescription>
            用原任务的素材和配置 fork 一份新任务。可调生成条数和差异度；其它（素材绑定、场景、贴图池）保持原样。
          </DialogDescription>
        </DialogHeader>

        {/* 原任务摘要 chip */}
        <div className="flex flex-wrap gap-1.5 text-[11px]">
          <span className="rounded-full bg-secondary px-2 py-0.5 text-secondary-foreground">
            模板 · {job.template_name ?? job.template_id}
          </span>
          <span className="rounded-full bg-secondary px-2 py-0.5 text-secondary-foreground">
            原 {job.output_variants} 条 · {PROFILE_LABEL[job.perturbation_profile]}
          </span>
        </div>

        <div className="space-y-4 pt-2">
          <div>
            <Label className="text-xs text-muted-foreground">生成几条（1 - 10）</Label>
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
            <Label className="text-xs text-muted-foreground">差异度</Label>
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
            {submitting ? "提交中…" : `开始重跑（${variants} 条）`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
