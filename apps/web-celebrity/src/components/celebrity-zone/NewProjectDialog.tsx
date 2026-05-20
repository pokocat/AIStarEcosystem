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
import { CTA_PRIMARY, CTA_SECONDARY } from "@/constants/celebrity-zone-ui";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@ai-star-eco/ui/ui/select";

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
      <DialogContent className="max-w-md border-zinc-200 bg-white text-zinc-900 shadow-[var(--shadow-pop)]">
        <DialogHeader>
          <DialogTitle className="text-base font-semibold">新建项目</DialogTitle>
          <DialogDescription className="text-xs text-zinc-500">
            将多条带货视频归入同一个项目，便于统一分发和数据追踪。
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4 py-2">
          <div>
            <label className="mb-1.5 block text-xs font-medium text-zinc-600">
              项目名称
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="例如：618大促 · 美妆专场"
              className="w-full rounded-md border border-zinc-200 bg-zinc-100 px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 outline-none focus:border-violet-500 focus:bg-white"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-medium text-zinc-600">
              关联明星
            </label>
            {/* authorizedStars 为空时禁用并显示占位文案；非空时正常用 starId 作 value。
                Radix Select 不允许 value=""，所以空态用 disabled trigger 表达。 */}
            <Select
              value={starId || undefined}
              onValueChange={setStarId}
              disabled={authorizedStars.length === 0}
            >
              <SelectTrigger className="h-9 w-full rounded-md border-zinc-200 bg-zinc-100 text-sm text-zinc-900 focus:border-violet-500 focus:bg-white focus:ring-0 disabled:cursor-not-allowed disabled:opacity-60">
                <SelectValue
                  placeholder={
                    authorizedStars.length === 0
                      ? "暂无可选明星（需先获得授权）"
                      : "选择明星"
                  }
                />
              </SelectTrigger>
              <SelectContent>
                {authorizedStars.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.name} · {s.category}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="mt-1.5 text-[11px] text-zinc-500">
              仅显示「已授权」的明星；如需新增明星，请先在市场页申请商务合作。
            </p>
          </div>
        </div>

        <DialogFooter>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className={CTA_SECONDARY}
          >
            取消
          </button>
          <button
            type="button"
            disabled={!canSubmit}
            onClick={handleSubmit}
            className={CTA_PRIMARY}
          >
            {submitting ? "创建中…" : "创建项目"}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
