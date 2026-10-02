"use client";

// 「电脑上更好用」提示：只在 ≤720 显示（CSS 控制），可以关掉，关掉之后在这台设备上不再出现（localStorage，读写失败就当没关过）。
import * as React from "react";
import { Monitor, X } from "lucide-react";

export interface DesktopHintProps {
  /** 记住「关掉了」用的键，不同页面各记各的（缺省全画布共用一个）。 */
  storageKey?: string;
  /** 提示正文；缺省「电脑上更好用：画面更大，编辑起来更顺手。」 */
  children?: React.ReactNode;
}

const PREFIX = "drama-canvas:desktop-hint:";

export function DesktopHint({ storageKey = "default", children }: DesktopHintProps) {
  const [hidden, setHidden] = React.useState(true);
  React.useEffect(() => {
    let dismissed = false;
    try {
      dismissed = window.localStorage.getItem(PREFIX + storageKey) === "1";
    } catch {
      dismissed = false;
    }
    setHidden(dismissed);
  }, [storageKey]);
  if (hidden) return null;
  return (
    <div className="cv-desktop-hint" role="note">
      <Monitor size={15} />
      <span className="cv-desktop-hint-text">{children ?? "电脑上更好用：画面更大，编辑起来更顺手。"}</span>
      <button
        type="button"
        className="btn btn-icon btn-ghost btn-sm tap-target"
        aria-label="不再提示"
        title="不再提示"
        onClick={() => {
          setHidden(true);
          try {
            window.localStorage.setItem(PREFIX + storageKey, "1");
          } catch {
            /* 存不下：这次关掉就行 */
          }
        }}
      >
        <X size={14} />
      </button>
    </div>
  );
}
