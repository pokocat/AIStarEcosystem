"use client";

// 积分消耗公共组件 —— 全站统一：生成处不再裸露积分数字，改用钻石标记提示「有积分开销」，
// 真正的消耗数额放进点击后的确认弹窗里告知用户（后台计费）。
//
// - <CreditMark/>   钻石标记（不带数字），贴在「会消耗积分」的按钮 / 提示上。
// - <CreditButton/> 钻石标记 + 点击二次确认（弹窗里展示本次消耗）的按钮，确认后才执行 onConfirm。
//
// 设计约束见 AGENTS.md §8：禁止浏览器原生 confirm，统一走 dramaConfirm。
//
// v0.197：动作执行完调 notifyWalletChanged()，让顶栏 / 工作台的余额重读（之前顶栏只在挂载时读一次）。
// onConfirm 返回 Promise 就等它结束再通知；不返回的（多数是「提交任务后立刻返回」）延迟 1.5 秒再通知，
// 给服务端扣费留时间。
//
// v0.197 评审后：一次点击从「读配置 → 弹确认 → onConfirm 的 Promise 结束」整段期间，再点一律不算。
// 之前读配置那一下是 await，小额免打扰的按钮（如 6 积分的写大纲）连点两下，两次都会走到 onConfirm，
// 扣两份积分。现在用 ref 同步上锁（setState 要等下一次渲染才生效，挡不住同一帧里的第二下），
// 期间按钮带 aria-busy / aria-disabled 和禁用样式。不设原生 disabled：确认框关闭时要把焦点还回这个按钮，
// 禁用的按钮接不住焦点。
//
// 复核后：只锁本实例不够。切阶段 / 切集会把整个按钮换成新实例，旧请求还在跑，新按钮的锁从空闲开始，
// 又能点一次、再扣一份。会被卸载重挂的扣费入口传 lockKey：锁放进模块级的 action-lock，
// 组件卸载不释放、动作结束才释放，新挂上的按钮读到的就是「在途」。
import * as React from "react";
import { Gem } from "lucide-react";
import { dramaConfirm } from "./confirm-dialog";
import { acquireActionLock, useActionLock } from "./action-lock";
import { getDramaConfig } from "@/api/drama-config";
import { notifyWalletChanged } from "@/lib/use-wallet";

const WALLET_REFRESH_DELAY_MS = 1500;

/** 执行扣费动作，结束后通知余额重读。返回的 Promise 在 onConfirm 的 Promise 结束时才结束（按钮靠它解锁）。 */
async function runAndRefreshWallet(fn: () => void | Promise<unknown>): Promise<void> {
  let ret: void | Promise<unknown>;
  try {
    ret = fn();
  } catch (e) {
    notifyWalletChanged();
    throw e;
  }
  if (ret && typeof (ret as Promise<unknown>).then === "function") {
    // 用 finally 不 catch：失败要照样往外抛（全局报错提示靠 unhandledrejection 接住），
    // 这里只是顺带刷新余额，不能把错误吞掉。整条链只有这一处往外抛，所以不会报两遍。
    try {
      await ret;
    } finally {
      notifyWalletChanged();
    }
  } else {
    setTimeout(notifyWalletChanged, WALLET_REFRESH_DELAY_MS);
  }
}

export interface CreditMarkProps {
  size?: number;
  /** gold = 金色钻石（浅底/提示用）；inherit = 跟随按钮文字色（深色填充按钮上用） */
  tone?: "gold" | "inherit";
  /** 可选附加文案，如积分数 10 或 "积分"；默认只显示钻石图标 */
  label?: string | number;
  style?: React.CSSProperties;
  title?: string;
}

/** 钻石标记：提示「此操作会消耗积分」，不展示具体数字。 */
export function CreditMark({ size = 13, tone = "gold", label, style, title = "会消耗积分" }: CreditMarkProps) {
  return (
    <span
      className="credit-mark"
      title={title}
      aria-label={title}
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
  /** 用户在弹窗里点「确认」后执行。返回 Promise 时，等它结束再刷新余额。 */
  onConfirm: () => void | Promise<unknown>;
  /** 确认弹窗标题，默认「确认生成」（写成「生成这一镜的视频？」这类说清要做什么的问句更好） */
  confirmTitle?: React.ReactNode;
  /** 确认弹窗补充说明 */
  confirmBody?: React.ReactNode;
  /** 确认按钮文案，默认「确认生成」 */
  confirmLabel?: string;
  /** 是否在 children 末尾自动渲染钻石标记，默认 true */
  mark?: boolean;
  /** 钻石标记尺寸，默认 13 */
  markSize?: number;
  /** 强制弹确认——绕过「小额免打扰」阈值（用于金额小但需警示的操作，如跳过首帧直接出片）。 */
  alwaysConfirm?: boolean;
  /**
   * 点击时即时求值的「阻断性警告」（如出片前的一致性问题）。返回非空数组时，无论金额大小都弹
   * 一个 danger 确认弹窗（警告列表 + confirmBody + 本次费用合并为同一个弹窗），确认「仍要继续」才执行；
   * 返回空数组时维持原有行为（小额免打扰 / alwaysConfirm）。不传时零影响（向后兼容）。
   */
  getWarnings?: () => string[];
  /**
   * 跨实例的在途锁 key，约定 `<动作>:<对象 id>`（如 `outline:<projectId>`，见 action-lock.ts）。
   * 传了它，锁不跟着这个按钮实例走：动作没结束时切走再回来（按钮被卸载重挂），新按钮照样显示在途、点了不算；
   * 同一个 key 的几个按钮互斥。不传只锁本实例 —— 会被卸载重挂的扣费入口（切阶段、切集、弹窗里）都应该传。
   */
  lockKey?: string;
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
  alwaysConfirm = false,
  getWarnings,
  lockKey,
  children,
  disabled,
  title,
  ...rest
}: CreditButtonProps) {
  // 在途锁：ref 是本实例的真闸（同步生效），state 只管样式与 aria。
  // 传了 lockKey 时再加一道模块级的锁（跨实例），sharedBusy 让重挂后的新按钮也显示在途。
  const busyRef = React.useRef(false);
  const [localBusy, setLocalBusy] = React.useState(false);
  const sharedBusy = useActionLock(lockKey);
  const busy = localBusy || sharedBusy;

  /** 按金额 / 警告决定要不要弹确认；返回 true = 该执行 onConfirm。 */
  const askToRun = async (): Promise<boolean> => {
    // 阻断性警告（如出片前一致性未就绪）：合并「警告 + 原确认说明 + 本次费用」为单个 danger 弹窗，
    // 避免「费用确认 + 一致性警告」两个叠加弹窗（v0.103）。
    const warnings = getWarnings?.() ?? [];
    if (warnings.length) {
      const ok = await dramaConfirm({
        cost,
        tone: "danger",
        title: "这一镜可能和别的镜对不上，仍要生成？",
        body: (
          <div className="col gap-2" style={{ fontSize: 13, lineHeight: 1.6 }}>
            {confirmBody && <div>{confirmBody}</div>}
            <div>下面几项还没准备好，生成出来的人物或场景可能和别的镜不一样：</div>
            <ul style={{ margin: "2px 0", paddingLeft: 18 }}>
              {warnings.map((w, i) => (
                <li key={i}>{w}</li>
              ))}
            </ul>
            <span className="faint" style={{ fontSize: 12 }}>
              可以先给角色补上定妆照、给这一场选好场景参考图，或者按顺序先生成上一镜，再回来生成这一镜。
            </span>
          </div>
        ),
        confirmLabel: "仍要生成",
        cancelLabel: "先不生成",
      });
      return ok;
    }
    // 小额免打扰（v0.66）：消耗低于阈值（admin「短剧专区」可配，默认 10）直接执行。
    // alwaysConfirm 的操作（金额小但需警示，如跳过首帧直接出片）不吃免打扰，始终弹确认。
    if (!alwaysConfirm) {
      let threshold = 10;
      try {
        threshold = (await getDramaConfig()).confirmThreshold;
      } catch {
        /* 配置拉取失败用默认阈值 */
      }
      if (cost < threshold) return true;
    }
    return dramaConfirm({ cost, title: confirmTitle, body: confirmBody, confirmLabel });
  };

  const handleClick = async (e: React.MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    if (disabled || busyRef.current) return;
    // 跨实例的锁在第一个 await 之前同步占住；占不到 = 同 key 的动作还没结束（可能是上一个实例发起的）。
    const release = lockKey ? acquireActionLock(lockKey) : null;
    if (lockKey && !release) return;
    busyRef.current = true;
    setLocalBusy(true);
    try {
      if (await askToRun()) await runAndRefreshWallet(onConfirm);
    } finally {
      busyRef.current = false;
      release?.();
      setLocalBusy(false);
    }
  };

  return (
    <button
      type="button"
      {...rest}
      // 没传 title 时写清花多少（小额的点了直接执行、不弹确认，只能靠这里知道）
      title={title ?? `会消耗 ${cost} 积分`}
      disabled={disabled}
      aria-busy={busy || undefined}
      aria-disabled={busy || rest["aria-disabled"] || undefined}
      onClick={handleClick}
    >
      {children}
      {mark && <CreditMark tone="inherit" size={markSize} />}
    </button>
  );
}
