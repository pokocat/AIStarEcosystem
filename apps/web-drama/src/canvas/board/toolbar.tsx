"use client";

// 画布左下的工具条：资产抽屉、重置视角、重新排一下、隐藏连线、只看角色和场景、小地图、缩放。
import * as React from "react";
import { useReactFlow, useViewport } from "@xyflow/react";
import { FolderOpen, LayoutGrid, Map as MapIcon, Maximize, Users, Waypoints } from "lucide-react";
import { usePopover } from "./use-popover";

const cx = (...xs: (string | false | null | undefined)[]) => xs.filter(Boolean).join(" ");

export const FIT_PADDING = 0.12;

export interface BoardToolbarProps {
  drawerOpen: boolean;
  onToggleDrawer: () => void;
  onResetView: () => void;
  /** 只读时不给（重新排会改位置）。 */
  onRelayout?: () => void;
  hideEdges: boolean;
  onToggleEdges: () => void;
  onlyCast: boolean;
  onToggleOnlyCast: () => void;
  showMinimap: boolean;
  onToggleMinimap: () => void;
}

function ToolButton({
  label,
  pressed,
  onClick,
  children,
}: {
  label: string;
  pressed?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      className={cx("cvb-tool", pressed && "is-on")}
      aria-label={label}
      title={label}
      aria-pressed={pressed === undefined ? undefined : pressed}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

function ZoomControl() {
  const { zoom } = useViewport();
  const rf = useReactFlow();
  const pop = usePopover<HTMLDivElement>();
  const pick = (fn: () => void) => {
    fn();
    pop.setOpen(false);
  };
  return (
    <div className="cvb-zoom" ref={pop.ref}>
      <button
        type="button"
        className="cvb-tool cvb-zoom-btn"
        aria-haspopup="menu"
        aria-expanded={pop.open}
        aria-label={`缩放 ${Math.round(zoom * 100)}%`}
        title="缩放"
        onClick={() => pop.setOpen(!pop.open)}
      >
        <span className="num">{Math.round(zoom * 100)}%</span>
      </button>
      {pop.open && (
        <div className="cvb-menu cvb-menu-up" role="menu">
          <button type="button" role="menuitem" className="cvb-menu-item" onClick={() => pick(() => void rf.zoomTo(0.5, { duration: 200 }))}>
            50%
          </button>
          <button type="button" role="menuitem" className="cvb-menu-item" onClick={() => pick(() => void rf.zoomTo(1, { duration: 200 }))}>
            100%
          </button>
          <button
            type="button"
            role="menuitem"
            className="cvb-menu-item"
            onClick={() => pick(() => void rf.fitView({ padding: FIT_PADDING, maxZoom: 1, duration: 250 }))}
          >
            适应
          </button>
        </div>
      )}
    </div>
  );
}

export function BoardToolbar(p: BoardToolbarProps) {
  return (
    <div className="cvb-toolbar" role="toolbar" aria-label="画布工具">
      <ToolButton label="全部角色、场景和素材" pressed={p.drawerOpen} onClick={p.onToggleDrawer}>
        <FolderOpen size={17} />
      </ToolButton>
      <ToolButton label="重置视角" onClick={p.onResetView}>
        <Maximize size={16} />
      </ToolButton>
      {p.onRelayout && (
        <ToolButton label="重新排一下" onClick={p.onRelayout}>
          <LayoutGrid size={16} />
        </ToolButton>
      )}
      <span className="cvb-tool-sep" aria-hidden />
      <ToolButton label="隐藏连线" pressed={p.hideEdges} onClick={p.onToggleEdges}>
        <Waypoints size={16} />
      </ToolButton>
      <ToolButton label="只看角色和场景" pressed={p.onlyCast} onClick={p.onToggleOnlyCast}>
        <Users size={16} />
      </ToolButton>
      <ToolButton label="小地图" pressed={p.showMinimap} onClick={p.onToggleMinimap}>
        <MapIcon size={16} />
      </ToolButton>
      <span className="cvb-tool-sep" aria-hidden />
      <ZoomControl />
    </div>
  );
}
