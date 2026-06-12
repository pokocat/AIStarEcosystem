"use client";

// 顶部项目条 — 设计真源:app.jsx Workbench `header`(项目封面+标题+类型 chip+
// 集数·时长·画幅+一键连跑+余额徽标)。
import * as React from "react";
import { ChevronLeft, LogOut, Zap } from "lucide-react";
import { Thumb } from "@/components/drama-ui";
import type { DramaProjectSummary, ProjectInfo } from "@/mocks/drama-workshop";

interface ProjectTopbarProps {
  meta: DramaProjectSummary;
  info: ProjectInfo;
  balance: number;
  /** 余额变化时短暂 pulse */
  balancePulseKey?: string | number;
  /** 窄视口隐藏集数·时长·画幅(标题优先) */
  hideMeta?: boolean;
  onHome?: () => void;
  onRunAll?: () => void;
  onLogout?: () => void;
}

export function ProjectTopbar({
  meta,
  info,
  balance,
  balancePulseKey,
  hideMeta,
  onHome,
  onRunAll,
  onLogout,
}: ProjectTopbarProps) {
  return (
    <header
      className="row"
      style={{
        height: 60,
        padding: "0 24px",
        borderBottom: "1px solid var(--line)",
        background: "var(--surface)",
        gap: 14,
        flex: "none",
      }}
    >
      <button
        type="button"
        className="btn btn-icon btn-ghost btn-sm"
        title="返回我的短剧"
        onClick={onHome}
      >
        <ChevronLeft size={16} />
      </button>
      <div className="row gap-3" style={{ minWidth: 0, flex: "0 1 auto" }}>
        <Thumb
          from={meta.cover.from}
          to={meta.cover.to}
          w={28}
          h={28}
          radius={8}
          stripes={false}
        />
        <div className="row gap-2" style={{ minWidth: 0 }}>
          <span
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
          <span className="tag tag-gray" style={{ flex: "none", whiteSpace: "nowrap" }}>{info.type}</span>
        </div>
      </div>
      {!hideMeta && (
        <div
          className="faint num"
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
      <div className="grow" />
      <button type="button" className="btn btn-line btn-sm" onClick={onRunAll}>
        <Zap size={14} /> 一键连跑
      </button>
      <div className="cost">
        <Zap size={14} /> 余额{" "}
        <b className="num balance-pulse" key={balancePulseKey ?? balance}>
          {balance.toLocaleString("zh-CN")}
        </b>
      </div>
      {onLogout && (
        <button
          type="button"
          className="btn btn-icon btn-ghost btn-sm"
          title="退出登录"
          onClick={onLogout}
        >
          <LogOut size={14} />
        </button>
      )}
    </header>
  );
}
