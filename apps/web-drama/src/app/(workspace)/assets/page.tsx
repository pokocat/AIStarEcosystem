"use client";

export const dynamic = "force-dynamic";

// 素材资产（v0.7）：占位页。统一管理剧本/视频/图片/音频/数字人/模板的资产中心即将上线。
import * as React from "react";
import { FileText, Film, FolderOpen, Image as ImageIcon, Music, Users, LayoutTemplate } from "lucide-react";
import { Card } from "@/components/premium";
import { ViewHeader, ComingSoon } from "@/components/common";

const CATEGORIES = [
  { icon: <FileText size={18} />, label: "剧本", desc: "长文本 / 分镜脚本与版本" },
  { icon: <Film size={18} />, label: "视频", desc: "成片与片段素材" },
  { icon: <ImageIcon size={18} />, label: "图片", desc: "海报 / 参考图 / 封面" },
  { icon: <Music size={18} />, label: "音频", desc: "配音 / 音效 / BGM" },
  { icon: <Users size={18} />, label: "数字人", desc: "自定义演员形象" },
  { icon: <LayoutTemplate size={18} />, label: "模板", desc: "自制片头片尾 / 转场" },
];

export default function AssetsPage() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
      <ViewHeader
        eyebrow="素材资产"
        title={
          <>
            素材{" "}
            <span className="text-gradient-gold" style={{ fontFamily: "var(--font-serif)", fontStyle: "italic", fontWeight: 400 }}>
              资产中心
            </span>
          </>
        }
        meta="统一管理剧本、视频、图片、音频、数字人与自制模板。"
      />

      <ComingSoon
        icon={<FolderOpen size={22} />}
        title="素材资产管理中心"
        eta="后续版本"
        description="云端存储、标签智能检索、团队共享与权限隔离即将上线。当前可在「短剧创作」与「演员 IP 阵容」中直接生成并使用素材。"
      />

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 14 }}>
        {CATEGORIES.map((c) => (
          <Card key={c.label} style={{ padding: "18px 20px", display: "flex", gap: 14, alignItems: "center", opacity: 0.85 }}>
            <div
              style={{
                width: 40,
                height: 40,
                borderRadius: "var(--radius-md)",
                background: "var(--surface-2)",
                color: "var(--fg-2)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
              }}
            >
              {c.icon}
            </div>
            <div>
              <div style={{ fontSize: 14, fontWeight: 600, color: "var(--fg-1)", fontFamily: "var(--font-display)" }}>{c.label}</div>
              <div style={{ fontSize: 11.5, color: "var(--fg-3)", marginTop: 2 }}>{c.desc}</div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
