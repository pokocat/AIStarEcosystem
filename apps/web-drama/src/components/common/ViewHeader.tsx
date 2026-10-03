"use client";

import * as React from "react";

interface Props {
  /** 标题上方的一行小字。可以不传：它和侧栏 / 面包屑重复时（「积分钱包 / 积分钱包」）宁可不要，
   *  要写就写一句这一页是干什么的。 */
  eyebrow?: string;
  title: React.ReactNode;
  meta?: React.ReactNode;
  action?: React.ReactNode;
}

/**
 * 工作台页面头部：eyebrow + 大标题 + 元信息 + 右侧操作槽。
 * 标题里若需要 italic + serif + 金色渐变，由调用方包 <span class="text-gradient-gold"> 自行控制。
 *
 * v0.197：允许换行（样式在 styles/app.css 的 .view-header）—— 标题块 flex:1 1 260px + min-width:0，
 * 操作区放不下就另起一行；≤560 时操作区独占一行、标题降到 28px。
 * 之前是一行不换，375 宽下右侧按钮把标题挤成一列竖字、按钮被推出屏幕。
 */
export function ViewHeader({ eyebrow, title, meta, action }: Props) {
  return (
    <div className="view-header" style={{ marginBottom: 4 }}>
      <div className="view-header-main">
        {eyebrow && <div className="eyebrow">{eyebrow}</div>}
        <h1
          style={{
            fontSize: 36,
            fontWeight: 700,
            letterSpacing: "var(--tracking-tight)",
            fontFamily: "var(--font-display)",
            margin: eyebrow ? "10px 0 8px" : "0 0 8px",
            lineHeight: 1.12,
            overflowWrap: "anywhere",
          }}
        >
          {title}
        </h1>
        {meta && <div style={{ fontSize: 13.5, color: "var(--fg-2)" }}>{meta}</div>}
      </div>
      {action && <div className="view-header-action">{action}</div>}
    </div>
  );
}

interface SectionHeaderProps {
  eyebrow?: string;
  title: React.ReactNode;
  right?: React.ReactNode;
}

export function SectionHeader({ eyebrow, title, right }: SectionHeaderProps) {
  return (
    <div className="section-header" style={{ marginBottom: 18 }}>
      <div>
        {eyebrow && <div className="eyebrow">{eyebrow}</div>}
        <div
          style={{
            fontSize: 17,
            fontWeight: 600,
            fontFamily: "var(--font-display)",
            marginTop: eyebrow ? 6 : 0,
          }}
        >
          {title}
        </div>
      </div>
      {right}
    </div>
  );
}
