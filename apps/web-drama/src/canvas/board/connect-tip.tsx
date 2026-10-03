"use client";

// 拖线经过连不上的地方（自己、分组、文字、已经连过的）时，鼠标旁边跟一句「这里连不上：…」。
// 单独一个组件订阅拖线状态：拖线时只有它跟着鼠标重画，画布其余部分不动。
import * as React from "react";
import { useConnection, type Node } from "@xyflow/react";
import { useBoardActions } from "./board-context";
import { checkConnection, rejectionText } from "./connect";

type Probe = { from: string; to: string; x: number; y: number } | null;

export function ConnectTip() {
  const { getDoc } = useBoardActions();
  const probe = useConnection<Node, Probe>((c) =>
    c.inProgress && c.toNode && c.isValid !== true ? { from: c.fromNode.id, to: c.toNode.id, x: c.pointer.x, y: c.pointer.y } : null,
  );
  if (!probe) return null;
  const check = checkConnection(getDoc(), probe.from, probe.to);
  if (check.ok) return null;
  return (
    <div className="cvb-conn-tip" role="status" style={{ left: probe.x + 14, top: probe.y + 14 }}>
      这里连不上：{rejectionText(check.reason)}
    </div>
  );
}
