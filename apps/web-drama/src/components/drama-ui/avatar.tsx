"use client";

// 数字人头像 — 按 avatarTheme 渲染色卡 + 已绑徽标。
// 视觉真源：components.jsx `Avatar`。
import * as React from "react";
import { Sparkles } from "lucide-react";
import { AVATAR_THEMES, type AvatarThemeKey } from "@/mocks/drama-workshop/avatar-themes";

interface AvatarProps {
  theme?: AvatarThemeKey | string;
  size?: number;
  bound?: boolean;
  ring?: boolean;
  title?: string;
}

export function Avatar({ theme = "default", size = 44, bound, ring, title }: AvatarProps) {
  const t = AVATAR_THEMES[theme] ?? AVATAR_THEMES.default;
  const label = (t.label ?? "?").charAt(0);
  const sparkleSize = Math.max(10, size * 0.26);
  return (
    <div
      title={title}
      style={{ position: "relative", flex: "none", width: size, height: size }}
    >
      <div
        style={{
          width: size,
          height: size,
          borderRadius: "50%",
          background: `linear-gradient(140deg, ${t.from}, ${t.to})`,
          display: "grid",
          placeItems: "center",
          color: "#fff",
          fontWeight: 700,
          fontSize: size * 0.34,
          boxShadow: ring
            ? `0 0 0 3px var(--surface), 0 0 0 5px ${t.from}`
            : "var(--shadow-sm)",
        }}
      >
        {label}
      </div>
      {bound && (
        <span
          title="已绑定数字人分身"
          style={{
            position: "absolute",
            right: -2,
            bottom: -2,
            width: Math.max(16, size * 0.42),
            height: Math.max(16, size * 0.42),
            borderRadius: "50%",
            background: "var(--accent)",
            display: "grid",
            placeItems: "center",
            boxShadow: "0 0 0 2px var(--surface)",
            color: "#fff",
          }}
        >
          <Sparkles size={sparkleSize} fill="currentColor" strokeWidth={0} />
        </span>
      )}
    </div>
  );
}
