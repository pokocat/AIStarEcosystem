"use client";

// 「近期热点」快捷输入 —— 首页 / 新建短剧 / 新建短视频三处共用。
// 此前三处各写一遍相同 markup，条数策略却各不相同（随机 3 / 前 4 / 不限），
// 新建短视频那处于是会把运营配的十几条整句钩子全铺出来。这里收成一份：
// 统一条数上限、chip 只显示短标签（整句进 title 与点击填充）、定宽防溢出。
import * as React from "react";
import { Zap } from "lucide-react";
import type { HotTopic } from "@/api/catalog";
import { hotTopicLabel } from "@/lib/hot-topic-label";

interface Props {
  topics: HotTopic[];
  /** 最多显示几条（默认 4）。 */
  max?: number;
  /** 每次进页随机取一批（首页用；不随渲染抖动）。默认按配置顺序取前 max 条。 */
  shuffle?: boolean;
  /** 点一个 chip：把整句钩子填进输入框。 */
  onPick: (idea: string) => void;
}

export function HotTopicChips({ topics, max = 4, shuffle = false, onPick }: Props) {
  const picks = React.useMemo(() => {
    const all = topics ?? [];
    if (all.length <= max) return all;
    return (shuffle ? [...all].sort(() => Math.random() - 0.5) : all).slice(0, max);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [topics, max, shuffle]);

  if (!picks.length) return null;

  return (
    <div className="row gap-2" style={{ padding: "4px 14px 0", flexWrap: "wrap", alignItems: "center" }}>
      <span className="row gap-1" style={{ fontSize: 11, fontWeight: 700, color: "var(--accent-2)", flex: "none" }}>
        <Zap size={12} /> 近期热点
      </span>
      {picks.map((h, i) => (
        <button
          key={(h.idea || h.label) + i}
          type="button"
          className="chip"
          style={{
            height: 26,
            fontSize: 11.5,
            padding: "0 10px",
            maxWidth: 168,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
          title={h.idea || h.label}
          onClick={() => onPick(h.idea || h.label)}
        >
          {hotTopicLabel(h.label || h.idea)}
        </button>
      ))}
    </div>
  );
}
