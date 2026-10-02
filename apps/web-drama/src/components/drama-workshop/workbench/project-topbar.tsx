"use client";

// 顶部项目条 — 设计真源:app.jsx Workbench `header`(项目封面+标题+类型 chip+
// 集数·时长·画幅+余额徽标)。
// v0.197：余额读真实钱包（useWallet，由 WorkshopShell 传入），点开去积分钱包；图标换成全站积分钻石。
// 手机上返回 / 退出不许被压扁、标题不许消失（样式见 styles/pages/workbench.css `.wb-topbar`）。
import * as React from "react";
import { ChevronLeft, LogOut, Users } from "lucide-react";
import { CreditMark, Thumb } from "@/components/drama-ui";
import { RenderTaskTopbarEntry } from "../render-task-dock";
import type { DramaProjectSummary, ProjectInfo } from "@/mocks/drama-workshop";

interface ProjectTopbarProps {
  meta: DramaProjectSummary;
  info: ProjectInfo;
  /** 积分余额；null = 还没读到 / 读失败，显示「—」（不拿任何默认数顶替）。 */
  balance: number | null;
  /** 余额变化时短暂 pulse */
  balancePulseKey?: string | number;
  /** 窄视口隐藏集数·时长·画幅(标题优先) */
  hideMeta?: boolean;
  /** 右侧状态槽（保存状态指示器等），渲染在余额徽标左侧。 */
  statusSlot?: React.ReactNode;
  onHome?: () => void;
  onLogout?: () => void;
  /** 点余额：去积分钱包。 */
  onBalance?: () => void;
  /** 剧集阶段在窄屏（≤1180）打开角色抽屉；不传则不显示「角色」按钮。 */
  onOpenCast?: () => void;
  /**
   * 「后台生成」面板平时钉在左轨底部；左轨藏起来（设定页 ≤860）或收窄（逐集制作 ≤1180）时，
   * 由顶栏的小入口补位。传当前是哪种左轨，CSS 决定什么宽度出现。
   */
  railKind?: "stage" | "episode";
}

export function ProjectTopbar({
  meta,
  info,
  balance,
  balancePulseKey,
  hideMeta,
  statusSlot,
  onHome,
  onLogout,
  onBalance,
  onOpenCast,
  railKind = "stage",
}: ProjectTopbarProps) {
  return (
    <header
      className="row wb-topbar"
      style={{
        height: 60,
        padding: "0 24px",
        borderBottom: "1px solid var(--line)",
        background: "var(--surface)",
        gap: 14,
        flex: "none",
        minWidth: 0,
      }}
    >
      <button
        type="button"
        className="btn btn-icon btn-ghost btn-sm wb-topbar-icon"
        title="返回我的短剧"
        aria-label="返回我的短剧"
        onClick={onHome}
        style={{ flex: "none" }}
      >
        <ChevronLeft size={16} />
      </button>
      <div className="row gap-3" style={{ minWidth: 0, flex: "1 1 auto" }}>
        <span className="wb-topbar-thumb" style={{ flex: "none", display: "inline-flex" }}>
          <Thumb
            from={meta.cover.from}
            to={meta.cover.to}
            w={28}
            h={28}
            radius={8}
            stripes={false}
          />
        </span>
        <div className="row gap-2" style={{ minWidth: 0, flex: "0 1 auto" }}>
          <span
            title={info.title}
            style={{
              fontWeight: 800,
              fontSize: 15,
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
              minWidth: 0,
            }}
          >
            {info.title}
          </span>
          <span className="tag tag-gray wb-topbar-type" style={{ flex: "none", whiteSpace: "nowrap" }}>{info.type}</span>
        </div>
        {!hideMeta && (
          <div
            className="faint num"
            title={`${info.episodes} 集 · ${info.duration} · ${info.ratio}`}
            style={{
              fontSize: 12,
              flex: "0 1 auto",
              minWidth: 0,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {info.episodes} 集 · {info.duration} · {info.ratio}
          </div>
        )}
      </div>
      {statusSlot && (
        <span className="wb-topbar-status" style={{ flex: "none", display: "inline-flex" }}>
          {statusSlot}
        </span>
      )}
      <span className={railKind === "episode" ? "wb-topbar-tasks wb-topbar-tasks--ep" : "wb-topbar-tasks"} style={{ flex: "none" }}>
        <RenderTaskTopbarEntry />
      </span>
      {onOpenCast && (
        <button
          type="button"
          className="btn btn-ghost btn-sm wb-cast-btn"
          title="看角色、绑定数字人"
          onClick={onOpenCast}
          style={{ flex: "none" }}
        >
          <Users size={14} /> <span className="ws-btn-label">角色</span>
        </button>
      )}
      <button
        type="button"
        className="cost wb-topbar-balance"
        title="积分余额，点开可充值、看明细"
        onClick={onBalance}
        style={{
          flex: "none",
          border: "none",
          background: "transparent",
          cursor: "pointer",
          padding: "6px 8px",
          borderRadius: 999,
          whiteSpace: "nowrap",
        }}
      >
        <CreditMark size={14} title="积分余额" />
        <span className="wb-topbar-balance-label">积分</span>
        <b className="num balance-pulse" key={balancePulseKey ?? balance ?? "none"}>
          {balance == null ? "—" : balance.toLocaleString("zh-CN")}
        </b>
      </button>
      {onLogout && (
        <button
          type="button"
          className="btn btn-icon btn-ghost btn-sm wb-topbar-icon"
          title="退出登录"
          aria-label="退出登录"
          onClick={onLogout}
          style={{ flex: "none" }}
        >
          <LogOut size={14} />
        </button>
      )}
    </header>
  );
}
