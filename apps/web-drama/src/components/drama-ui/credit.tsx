"use client";

// 积分消耗公共组件 —— 全站统一：生成处不再裸露积分数字，改用钻石标记提示「有积分开销」，
// 真正的消耗数额放进点击后的确认弹窗里告知用户（后台计费）。
//
// - <CreditMark/>   钻石标记（不带数字），贴在「会消耗积分」的按钮 / 提示上。
// - <CreditButton/> 钻石标记 + 点击二次确认（弹窗里展示本次消耗）的按钮，确认后才执行 onConfirm。
//
// 设计约束见 AGENTS.md §8：禁止浏览器原生 confirm，统一走 dramaConfirm。
import * as React from "react";
import { Gem } from "lucide-react";
import { dramaConfirm } from "./confirm-dialog";
import { getDramaConfig } from "@/api/drama-config";

export interface CreditMarkProps {
  size?: number;
  /** gold = 金色钻石（浅底/提示用）；inherit = 跟随按钮文字色（深色填充按钮上用） */
  tone?: "gold" | "inherit";
  /** 可选附加文案，如 "积分"；默认只显示钻石图标 */
  label?: string;
  style?: React.CSSProperties;
  title?: string;
}

/** 钻石标记：提示「此操作会消耗积分」，不展示具体数字。 */
export function CreditMark({ size = 13, tone = "gold", label, style, title = "消耗积分" }: CreditMarkProps) {
  return (
    <span
      className="credit-mark"
      title={title}
      aria-label="消耗积分"
      style={{ color: tone === "inherit" ? "currentColor" : "var(--gem)", ...style }}
    >
      <Gem size={size} />
      {label != null && <span style={{ fontSize: 11, fontWeight: 700 }}>{label}</span>}
    </span>
  );
}

export interface CreditButtonProps
  extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "onClick"> {
  /** 本次操作的积分消耗，仅用于确认弹窗展示（真实计费在后台）。 */
  cost: number;
  /** 用户在弹窗里点「确认」后执行。 */
  onConfirm: () => void;
  /** 确认弹窗标题，默认「确认生成」 */
  confirmTitle?: React.ReactNode;
  /** 确认弹窗补充说明 */
  confirmBody?: React.ReactNode;
  /** 确认按钮文案，默认「确认生成」 */
  confirmLabel?: string;
  /** 是否在 children 末尾自动渲染钻石标记，默认 true */
  mark?: boolean;
  /** 钻石标记尺寸，默认 13 */
  markSize?: number;
}

/**
 * 会消耗积分的按钮：自带钻石标记 + 点击后弹确认（告知本次消耗），确认才执行。
 * 透传 className / style / disabled / title 等原生 button 属性。
 */
export function CreditButton({
  cost,
  onConfirm,
  confirmTitle = "确认生成",
  confirmBody,
  confirmLabel = "确认生成",
  mark = true,
  markSize = 13,
  children,
  disabled,
  ...rest
}: CreditButtonProps) {
  const handleClick = async (e: React.MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    if (disabled) return;
    // 小额免打扰（v0.66）：消耗低于阈值（admin「短剧专区」可配，默认 10）直接执行
    let threshold = 10;
    try {
      threshold = (await getDramaConfig()).confirmThreshold;
    } catch {
      /* 配置拉取失败用默认阈值 */
    }
    if (cost < threshold) {
      onConfirm();
      return;
    }
    const ok = await dramaConfirm({ cost, title: confirmTitle, body: confirmBody, confirmLabel });
    if (ok) onConfirm();
  };
  return (
    <button type="button" {...rest} disabled={disabled} onClick={handleClick}>
      {children}
      {mark && <CreditMark tone="inherit" size={markSize} />}
    </button>
  );
}
