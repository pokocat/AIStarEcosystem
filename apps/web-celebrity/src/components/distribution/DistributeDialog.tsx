"use client";

// 把项目里的一个视频分发到一到多个社交平台。
//
// 流程：
//   1. 列出项目候选视频（radio 单选 — sau-service 一次只拉一个 video URL）
//   2. 标题/描述/标签（默认套用项目名）
//   3. 平台 + 对应账号（多选；每个平台从用户已绑定的 active 账号里选一条）
//   4. 提交 → POST /me/publish-jobs → 后端按 targets 拆成多条 queued PublishJob
//      → onCreated 回调；调用方一般会跳转到 /distribution 让用户去 ▶ 启动
//
// 注：本 dialog 只创建任务，不直接调 start —— 扣费在 start 时发生，让用户在
// /distribution 里看到费用预估再决定。

import * as React from "react";
import { X, Loader2, AlertCircle } from "lucide-react";
import { SocialAccountApi, PublishJobApi } from "@ai-star-eco/api-client";
import type { SocialAccount, SocialPlatform } from "@ai-star-eco/types/social-account";
import type { CelebrityProject, CelebrityProjectVideo } from "@ai-star-eco/types/celebrity-zone";
import { CTA_PRIMARY, CTA_SECONDARY } from "@/constants/celebrity-zone-ui";
import { cn } from "@ai-star-eco/ui/ui/utils";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@ai-star-eco/ui/ui/select";
import { SocialAccountIdentity } from "./SocialAccountIdentity";
import { SocialPlatformLogo } from "./SocialPlatformLogo";
import { socialAccountOptionLabel } from "./social-account-labels";

/** Radix Select 不允许 value=""，用 sentinel 表示"不分发到此平台"。 */
const NO_ACCOUNT = "__none";

const ENABLED_PLATFORMS: Array<{ id: SocialPlatform; label: string }> = [
  { id: "douyin", label: "抖音" },
  { id: "kuaishou", label: "快手" },
  { id: "xiaohongshu", label: "小红书" },
  { id: "shipinhao", label: "视频号" },
];

interface Props {
  open: boolean;
  onClose: () => void;
  project: CelebrityProject;
  videos: CelebrityProjectVideo[];
  /** 创建成功（哪怕 0 条；通常 >0）后被调用，参数是后端落库的任务数组。 */
  onCreated: (jobIds: string[]) => void;
}

export function DistributeDialog({ open, onClose, project, videos, onCreated }: Props) {
  // candidates: 只让用户分发已生成完成、有 videoUrl 的视频。
  const candidates = React.useMemo(
    () => videos.filter((v) => Boolean(v.videoUrl)),
    [videos],
  );

  const [videoId, setVideoId] = React.useState<string | null>(null);
  const [title, setTitle] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [tagsInput, setTagsInput] = React.useState("");
  const [accounts, setAccounts] = React.useState<SocialAccount[]>([]);
  const [loadingAccounts, setLoadingAccounts] = React.useState(false);
  const [selectedAccount, setSelectedAccount] = React.useState<Record<SocialPlatform, string>>(
    {} as Record<SocialPlatform, string>,
  );
  const [submitting, setSubmitting] = React.useState(false);
  const [errorMsg, setErrorMsg] = React.useState<string | null>(null);

  // 打开 modal 时拉账号列表 + 用项目名预填标题
  React.useEffect(() => {
    if (!open) return;
    setTitle(project.name);
    setDescription("");
    setTagsInput("");
    setSelectedAccount({} as Record<SocialPlatform, string>);
    setErrorMsg(null);
    setVideoId(candidates[0]?.id ?? null);

    let cancelled = false;
    setLoadingAccounts(true);
    SocialAccountApi.listSocialAccounts()
      .then((list) => {
        if (cancelled) return;
        // 只保留 active 状态的账号 — needs_reauth / revoked 不能用
        const usable = list.filter((a) => a.status === "active");
        setAccounts(usable);
      })
      .catch((err) => {
        if (cancelled) return;
        setErrorMsg(err instanceof Error ? err.message : "拉取已绑定账号失败");
      })
      .finally(() => {
        if (!cancelled) setLoadingAccounts(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, project.name, candidates]);

  const accountsByPlatform = React.useMemo(() => {
    const map: Partial<Record<SocialPlatform, SocialAccount[]>> = {};
    for (const a of accounts) {
      (map[a.platform] ||= []).push(a);
    }
    return map;
  }, [accounts]);

  const selectedVideo = videoId ? candidates.find((v) => v.id === videoId) ?? null : null;

  const tags = React.useMemo(
    () => tagsInput.split(/[,，\s]+/).map((t) => t.trim()).filter(Boolean).slice(0, 12),
    [tagsInput],
  );

  const targets = React.useMemo(
    () =>
      ENABLED_PLATFORMS.flatMap(({ id }) => {
        const accountId = selectedAccount[id];
        return accountId ? [{ platform: id, socialAccountId: accountId }] : [];
      }),
    [selectedAccount],
  );

  const canSubmit =
    !submitting && selectedVideo !== null && title.trim().length > 0 && targets.length > 0;

  const handleSubmit = async () => {
    if (!selectedVideo || targets.length === 0) return;
    setSubmitting(true);
    setErrorMsg(null);
    try {
      const jobs = await PublishJobApi.createPublishJobs({
        projectId: project.id,
        videoUrl: selectedVideo.videoUrl,
        title: title.trim(),
        description: description.trim(),
        tags,
        coverUrl: selectedVideo.thumb,
        targets,
      });
      onCreated(jobs.map((j) => j.id));
      onClose();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "创建分发任务失败");
    } finally {
      setSubmitting(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-900/40 px-4 py-8">
      <div className="flex max-h-full w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-zinc-200 px-5 py-3.5">
          <div>
            <h2 className="text-sm font-semibold text-zinc-800">分发到平台</h2>
            <p className="text-xs text-zinc-500">{project.name}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700"
            aria-label="关闭"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Body — scrolls if too long */}
        <div className="flex flex-1 flex-col gap-5 overflow-y-auto px-5 py-4">
          {/* 1. video selector */}
          <Section title="选择视频" sub={`${candidates.length} 条候选`}>
            {candidates.length === 0 ? (
              <EmptyHint>此项目暂无可分发的视频（需 videoUrl 已生成）</EmptyHint>
            ) : (
              <div className="grid max-h-44 grid-cols-3 gap-2 overflow-y-auto">
                {candidates.map((v) => (
                  <label
                    key={v.id}
                    className={cn(
                      "flex cursor-pointer flex-col rounded-lg border-2 p-1 transition",
                      videoId === v.id
                        ? "border-violet-500 bg-violet-50"
                        : "border-zinc-200 hover:border-zinc-300",
                    )}
                  >
                    <input
                      type="radio"
                      name="distribute-video"
                      className="sr-only"
                      checked={videoId === v.id}
                      onChange={() => setVideoId(v.id)}
                    />
                    <img
                      src={v.thumb}
                      alt={v.productName}
                      className="aspect-video w-full rounded object-cover"
                    />
                    <div className="mt-1 truncate px-1 text-[11px] text-zinc-600">
                      {v.productName}
                    </div>
                  </label>
                ))}
              </div>
            )}
          </Section>

          {/* 2. meta */}
          <Section title="标题与描述">
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="标题（必填）"
              maxLength={80}
              className={INPUT_CLS}
            />
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="描述（可选）"
              rows={2}
              maxLength={500}
              className={cn(INPUT_CLS, "resize-none")}
            />
            <input
              type="text"
              value={tagsInput}
              onChange={(e) => setTagsInput(e.target.value)}
              placeholder="标签，用逗号或空格分隔，最多 12 个"
              className={INPUT_CLS}
            />
            {tags.length > 0 ? (
              <div className="flex flex-wrap gap-1.5">
                {tags.map((t) => (
                  <span
                    key={t}
                    className="rounded-full bg-violet-50 px-2 py-0.5 text-[11px] text-violet-700"
                  >
                    #{t}
                  </span>
                ))}
              </div>
            ) : null}
          </Section>

          {/* 3. targets */}
          <Section title="选择平台与账号">
            {loadingAccounts ? (
              <div className="flex items-center gap-2 text-xs text-zinc-500">
                <Loader2 className="h-3.5 w-3.5 animate-spin" /> 加载已绑定账号…
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                {ENABLED_PLATFORMS.map(({ id, label }) => {
                  const platformAccounts = accountsByPlatform[id] ?? [];
                  const selected = selectedAccount[id] ?? "";
                  return (
                    <div
                      key={id}
                      className="flex items-center gap-3 rounded-md border border-zinc-200 px-3 py-2"
                    >
                      <span className="flex w-20 shrink-0 items-center gap-1.5 text-xs font-medium text-zinc-700">
                        <SocialPlatformLogo platform={id} size="xs" />
                        <span>{label}</span>
                      </span>
                      {platformAccounts.length === 0 ? (
                        <span className="text-[11px] text-zinc-400">未绑定 active 账号</span>
                      ) : (
                        <Select
                          value={selected || NO_ACCOUNT}
                          onValueChange={(v) =>
                            setSelectedAccount((prev) => ({
                              ...prev,
                              [id]: v === NO_ACCOUNT ? "" : v,
                            }))
                          }
                        >
                          <SelectTrigger className="h-8 flex-1 rounded-md border-zinc-200 bg-white text-xs text-zinc-700 focus:border-[var(--accent)] focus:ring-0">
                            <SelectValue placeholder="选择账号" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value={NO_ACCOUNT}>不分发到此平台</SelectItem>
                            {platformAccounts.map((a) => (
                              <SelectItem key={a.id} value={a.id} textValue={socialAccountOptionLabel(a)}>
                                <SocialAccountIdentity account={a} size="sm" className="w-full" />
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </Section>

          {errorMsg ? (
            <div className="flex items-start gap-2 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
              <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          ) : null}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between gap-2 border-t border-zinc-200 bg-zinc-50/60 px-5 py-3">
          <div className="text-[11px] text-zinc-500">
            将创建 {targets.length} 条任务；启动时按平台单价扣费。
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={onClose} className={CTA_SECONDARY}>
              取消
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={!canSubmit}
              className={cn(
                CTA_PRIMARY,
                !canSubmit && "cursor-not-allowed opacity-50",
              )}
            >
              {submitting ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" /> 创建中…
                </>
              ) : (
                "创建任务"
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

const INPUT_CLS =
  "w-full rounded-md border border-zinc-200 bg-white px-3 py-1.5 text-xs text-zinc-700 outline-none focus:border-violet-400";

function Section({
  title,
  sub,
  children,
}: {
  title: string;
  sub?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-baseline justify-between">
        <h3 className="text-xs font-medium text-zinc-700">{title}</h3>
        {sub ? <span className="text-[11px] text-zinc-400">{sub}</span> : null}
      </div>
      {children}
    </div>
  );
}

function EmptyHint({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-md border border-dashed border-zinc-200 bg-zinc-50 px-3 py-3 text-center text-xs text-zinc-500">
      {children}
    </div>
  );
}
