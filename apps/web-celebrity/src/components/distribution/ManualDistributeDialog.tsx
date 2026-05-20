"use client";

// 手动分发对话框。
//
// 区别于 DistributeDialog（必须从某个项目里选视频）：这里直接粘贴视频 URL
// + 平台账号即可派单，对应 sau 原生 CLI 用法（`python upload.py --file ... `
// --title ... --account ...）。
//
// 字段对齐 sau 的 DouYinVideo / TencentVideo 共通构造参数：
//   - videoUrl  ← file_path（sau worker 拉到 /dev/shm 后传给 upstream）
//   - title     ← title
//   - desc      ← description
//   - tags      ← tags（解析自 tagsInput）
//   - coverUrl  ← thumbnail_path / thumbnail_landscape_path
//   - scheduledAt ← publish_date（不填 = 立即发布）
//
// 平台特定字段：
//   - 抖音 productLink + productTitle —— 商品挂载（蓝V/橱窗带货），本 slice 已接
//   - 视频号 category / shortTitle / isDraft —— 后续 slice
// 商品挂载 section 只在 douyin target 被选中时显示；非带货视频留空即可。

import * as React from "react";
import { X, Loader2, AlertCircle, Link2, ShoppingBag } from "lucide-react";
import { SocialAccountApi, PublishJobApi } from "@ai-star-eco/api-client";
import type { SocialAccount, SocialPlatform } from "@ai-star-eco/types/social-account";
import { CTA_PRIMARY, CTA_SECONDARY } from "@/constants/celebrity-zone-ui";
import { cn } from "@ai-star-eco/ui/ui/utils";

// projectId 用 "manual" 哨兵 — server 不做项目存在性校验，所以这字符串
// 仅作"这条任务没有项目归属"的标识。列任务时按 userId 过滤即可拿到。
const MANUAL_PROJECT_SENTINEL = "manual";

const ENABLED_PLATFORMS: Array<{ id: SocialPlatform; label: string }> = [
  { id: "douyin", label: "抖音" },
  { id: "kuaishou", label: "快手" },
  { id: "xiaohongshu", label: "小红书" },
  { id: "shipinhao", label: "视频号" },
];

interface Props {
  open: boolean;
  onClose: () => void;
  onCreated: (jobIds: string[]) => void;
}

export function ManualDistributeDialog({ open, onClose, onCreated }: Props) {
  const [videoUrl, setVideoUrl] = React.useState("");
  const [coverUrl, setCoverUrl] = React.useState("");
  const [title, setTitle] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [tagsInput, setTagsInput] = React.useState("");
  const [productLink, setProductLink] = React.useState("");
  const [productTitle, setProductTitle] = React.useState("");
  const [scheduledLocal, setScheduledLocal] = React.useState("");
  const [accounts, setAccounts] = React.useState<SocialAccount[]>([]);
  const [loadingAccounts, setLoadingAccounts] = React.useState(false);
  const [selectedAccount, setSelectedAccount] = React.useState<Record<SocialPlatform, string>>(
    {} as Record<SocialPlatform, string>,
  );
  const [submitting, setSubmitting] = React.useState(false);
  const [errorMsg, setErrorMsg] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!open) return;
    setVideoUrl("");
    setCoverUrl("");
    setTitle("");
    setDescription("");
    setTagsInput("");
    setProductLink("");
    setProductTitle("");
    setScheduledLocal("");
    setSelectedAccount({} as Record<SocialPlatform, string>);
    setErrorMsg(null);

    let cancelled = false;
    setLoadingAccounts(true);
    SocialAccountApi.listSocialAccounts()
      .then((list) => {
        if (cancelled) return;
        setAccounts(list.filter((a) => a.status === "active"));
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
  }, [open]);

  const accountsByPlatform = React.useMemo(() => {
    const map: Partial<Record<SocialPlatform, SocialAccount[]>> = {};
    for (const a of accounts) {
      (map[a.platform] ||= []).push(a);
    }
    return map;
  }, [accounts]);

  const tags = React.useMemo(
    () => tagsInput.split(/[,，\s]+/).map((t) => t.trim()).filter(Boolean).slice(0, 12),
    [tagsInput],
  );

  // datetime-local 是浏览器本地时区无 offset 的字符串；显式转 UTC ISO 给后端。
  const scheduledAtIso = React.useMemo(() => {
    if (!scheduledLocal) return undefined;
    const d = new Date(scheduledLocal);
    return Number.isNaN(d.valueOf()) ? undefined : d.toISOString();
  }, [scheduledLocal]);

  const targets = React.useMemo(
    () =>
      ENABLED_PLATFORMS.flatMap(({ id }) => {
        const accountId = selectedAccount[id];
        return accountId
          ? [{ platform: id, socialAccountId: accountId, scheduledAt: scheduledAtIso }]
          : [];
      }),
    [selectedAccount, scheduledAtIso],
  );

  // 商品挂载仅对抖音 target 生效；其它平台展示该 section 是误导，隐起来。
  const douyinSelected = Boolean(selectedAccount.douyin);

  const videoUrlValid = /^https?:\/\//i.test(videoUrl.trim());
  const canSubmit =
    !submitting && videoUrlValid && title.trim().length > 0 && targets.length > 0;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    setErrorMsg(null);
    try {
      const jobs = await PublishJobApi.createPublishJobs({
        projectId: MANUAL_PROJECT_SENTINEL,
        videoUrl: videoUrl.trim(),
        title: title.trim(),
        description: description.trim(),
        tags,
        coverUrl: coverUrl.trim() || undefined,
        // 商品挂载仅在选了抖音 target 时有意义；其它平台填了也忽略，
        // 但我们仍然透传给后端 — 后端落库 + 列任务时能回显。
        productLink: productLink.trim() || undefined,
        productTitle: productTitle.trim() || undefined,
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
            <h2 className="text-sm font-semibold text-zinc-800">手动分发</h2>
            <p className="text-xs text-zinc-500">
              不依赖项目 / 混剪库，直接粘视频 URL + 选账号一键派单
            </p>
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

        {/* Body */}
        <div className="flex flex-1 flex-col gap-5 overflow-y-auto px-5 py-4">
          {/* 1. 视频源 */}
          <Section title="视频源" sub="sau worker 会拉到 /dev/shm 后上传">
            <div className="flex items-start gap-2">
              <Link2 className="mt-2 h-3.5 w-3.5 shrink-0 text-zinc-400" />
              <input
                type="url"
                value={videoUrl}
                onChange={(e) => setVideoUrl(e.target.value)}
                placeholder="视频文件 URL（https://... .mp4）"
                className={INPUT_CLS}
              />
            </div>
            {videoUrl && !videoUrlValid ? (
              <p className="text-[11px] text-rose-600">URL 必须以 http:// 或 https:// 开头</p>
            ) : null}
            <input
              type="url"
              value={coverUrl}
              onChange={(e) => setCoverUrl(e.target.value)}
              placeholder="封面图 URL（可选）"
              className={INPUT_CLS}
            />
          </Section>

          {/* 2. 元数据 */}
          <Section title="标题与描述">
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="标题（必填，建议 ≤ 30 字）"
              maxLength={80}
              className={INPUT_CLS}
            />
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="描述 / 正文（可选）"
              rows={3}
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

          {/* 3. 定时（可选） */}
          <Section title="发布时间">
            <div className="flex items-center gap-2">
              <label className="flex items-center gap-2 text-xs text-zinc-600">
                <input
                  type="radio"
                  name="schedule-mode"
                  checked={!scheduledLocal}
                  onChange={() => setScheduledLocal("")}
                />
                立即发布
              </label>
              <label className="flex items-center gap-2 text-xs text-zinc-600">
                <input
                  type="radio"
                  name="schedule-mode"
                  checked={!!scheduledLocal}
                  onChange={() => {
                    // 默认填 30 分钟后
                    const d = new Date(Date.now() + 30 * 60 * 1000);
                    setScheduledLocal(toDatetimeLocal(d));
                  }}
                />
                定时发布
              </label>
            </div>
            {scheduledLocal ? (
              <input
                type="datetime-local"
                value={scheduledLocal}
                min={toDatetimeLocal(new Date())}
                onChange={(e) => setScheduledLocal(e.target.value)}
                className={INPUT_CLS}
              />
            ) : null}
          </Section>

          {/* 4. 目标平台 + 账号 */}
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
                      <span className="w-14 text-xs font-medium text-zinc-700">{label}</span>
                      {platformAccounts.length === 0 ? (
                        <span className="text-[11px] text-zinc-400">未绑定 active 账号</span>
                      ) : (
                        <select
                          value={selected}
                          onChange={(e) =>
                            setSelectedAccount((prev) => ({
                              ...prev,
                              [id]: e.target.value,
                            }))
                          }
                          className="flex-1 rounded-md border border-zinc-200 bg-white px-2 py-1 text-xs text-zinc-700"
                        >
                          <option value="">不分发到此平台</option>
                          {platformAccounts.map((a) => (
                            <option key={a.id} value={a.id}>
                              {a.displayName || a.accountName}
                            </option>
                          ))}
                        </select>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </Section>

          {/* 5. 商品挂载（仅抖音） */}
          {douyinSelected ? (
            <Section
              title="抖音商品挂载"
              sub="蓝V / 橱窗带货；视频画面下方挂「立即购买」卡片"
            >
              <div className="flex items-start gap-2">
                <ShoppingBag className="mt-2 h-3.5 w-3.5 shrink-0 text-zinc-400" />
                <input
                  type="url"
                  value={productLink}
                  onChange={(e) => setProductLink(e.target.value)}
                  placeholder="商品链接（抖店商品详情页 URL）"
                  className={INPUT_CLS}
                />
              </div>
              <input
                type="text"
                value={productTitle}
                onChange={(e) => setProductTitle(e.target.value)}
                placeholder="商品名称（挂件上展示的文案）"
                maxLength={50}
                className={INPUT_CLS}
              />
              <p className="text-[11px] text-zinc-400">
                两项都填才会触发挂件；非带货视频留空即可。
              </p>
            </Section>
          ) : null}

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
              className={cn(CTA_PRIMARY, !canSubmit && "cursor-not-allowed opacity-50")}
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

/** datetime-local 输入框需要 `YYYY-MM-DDTHH:mm` 格式（无时区）。 */
function toDatetimeLocal(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return (
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` +
    `T${pad(d.getHours())}:${pad(d.getMinutes())}`
  );
}
