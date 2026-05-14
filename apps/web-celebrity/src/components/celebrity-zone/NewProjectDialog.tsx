"use client";

import * as React from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@ai-star-eco/ui/ui/dialog";
import type { CelebrityProject, CelebrityStar } from "@ai-star-eco/types/celebrity-zone";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** 仅 authorized 状态的明星会出现在选择器里 */
  stars: CelebrityStar[];
  onCreated: (project: CelebrityProject) => void;
  /** 提交回调（默认走 mock api） */
  onSubmit: (payload: { name: string; starId: string }) => Promise<CelebrityProject>;
}

export function NewProjectDialog({ open, onOpenChange, stars, onCreated, onSubmit }: Props) {
  const authorizedStars = React.useMemo(
    () => stars.filter((s) => s.authorization.status === "authorized"),
    [stars],
  );
  const [name, setName] = React.useState("");
  const [starId, setStarId] = React.useState<string>(authorizedStars[0]?.id ?? "");
  const [submitting, setSubmitting] = React.useState(false);

  React.useEffect(() => {
    if (!open) {
      setName("");
      setStarId(authorizedStars[0]?.id ?? "");
      setSubmitting(false);
    }
  }, [open, authorizedStars]);

  const canSubmit = name.trim().length > 0 && !!starId && !submitting;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    try {
      const created = await onSubmit({ name: name.trim(), starId });
      onCreated(created);
      onOpenChange(false);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md border-zinc-200 bg-[#0f0f1a] text-zinc-900">
        <DialogHeader>
          <DialogTitle className="text-base font-semibold">新建项目</DialogTitle>
          <DialogDescription className="text-xs text-zinc-400">
            将多条带货视频归入同一个项目，便于统一分发和数据追踪。
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4 py-2">
          <div>
            <label className="mb-1.5 block text-xs font-medium text-zinc-500">
              项目名称
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="例如：618大促 · 美妆专场"
              className="w-full rounded-md border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-300 outline-none focus:border-violet-400/60 focus:bg-zinc-100"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-medium text-zinc-500">
              关联明星
            </label>
            <select
              value={starId}
              onChange={(e) => setStarId(e.target.value)}
              className="w-full rounded-md border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-900 outline-none focus:border-violet-400/60"
            >
              {authorizedStars.length === 0 && (
                <option value="" className="bg-[#0a0a14]">
                  暂无可选明星（需先获得授权）
                </option>
              )}
              {authorizedStars.map((s) => (
                <option key={s.id} value={s.id} className="bg-[#0a0a14]">
                  {s.name} · {s.category}
                </option>
              ))}
            </select>
            <p className="mt-1.5 text-[11px] text-zinc-400">
              仅显示「已授权」的明星；如需新增明星，请先在市场页申请商务合作。
            </p>
          </div>
        </div>

        <DialogFooter>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="rounded-md border border-zinc-200 px-4 py-2 text-sm text-zinc-500 hover:border-zinc-300 hover:text-zinc-900"
          >
            取消
          </button>
          <button
            type="button"
            disabled={!canSubmit}
            onClick={handleSubmit}
            className="rounded-md bg-gradient-to-r from-violet-500 to-violet-500 px-4 py-2 text-sm font-semibold text-zinc-900 transition disabled:cursor-not-allowed disabled:from-white/10 disabled:to-white/10 disabled:text-zinc-400"
          >
            {submitting ? "创建中…" : "创建项目"}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
