"use client";

// 底部居中的深色提示条：一句提示 + 上一步 / 下一步（照小云雀每一步做完时浮着的那条）。
// 固定在画布内容区底部中间；≤720 贴在底部页签上面、左右留 12px。页面内容要给它让出高度（用 .cv-page 就行）。
import * as React from "react";
import Link from "next/link";
import { ArrowLeft, ArrowRight, Gem } from "lucide-react";

export interface NextBarAction {
  label: React.ReactNode;
  /** 给了 href 就是链接；否则用 onClick。 */
  href?: string;
  onClick?: () => void;
  disabled?: boolean;
  /** 禁用时就地写一行原因（手机上没有 hover，别只放 title）。 */
  disabledReason?: string;
  /** 这一步要花的积分（按钮上带钻石和数字）；不花钱不传。 */
  cost?: number;
  /** 在途（如正在提交）：按钮变灰、点了不算。 */
  busy?: boolean;
}

export interface CanvasNextBarProps {
  /** 一句提示（「角色和场景会用在所有集里，调整好再继续」）。 */
  hint: React.ReactNode;
  prev?: NextBarAction;
  next?: NextBarAction;
}

function ActionButton({ a, kind }: { a: NextBarAction; kind: "prev" | "next" }) {
  const content = (
    <>
      {kind === "prev" && <ArrowLeft size={14} />}
      <span className="cv-ellipsis">{a.label}</span>
      {a.cost != null && (
        <span className="cv-next-cost">
          <Gem size={12} />
          <span className="num">{a.cost}</span>
        </span>
      )}
      {kind === "next" && <ArrowRight size={14} />}
    </>
  );
  const cls = `cv-next-btn cv-next-${kind}`;
  if (a.href && !a.disabled && !a.busy) {
    return (
      <Link href={a.href} className={cls} onClick={a.onClick}>
        {content}
      </Link>
    );
  }
  return (
    <button
      type="button"
      className={cls}
      disabled={a.disabled}
      aria-busy={a.busy || undefined}
      onClick={() => {
        if (!a.busy) a.onClick?.();
      }}
    >
      {content}
    </button>
  );
}

export function CanvasNextBar({ hint, prev, next }: CanvasNextBarProps) {
  const reason = next?.disabled ? next.disabledReason : undefined;
  return (
    <div className="cv-next-wrap">
      <div className="cv-next" role="region" aria-label="下一步">
        <div className="cv-next-copy">
          <span className="cv-next-hint">{hint}</span>
          {reason && <span className="cv-next-reason">{reason}</span>}
        </div>
        <div className="cv-next-actions">
          {prev && <ActionButton a={prev} kind="prev" />}
          {next && <ActionButton a={next} kind="next" />}
        </div>
      </div>
    </div>
  );
}
