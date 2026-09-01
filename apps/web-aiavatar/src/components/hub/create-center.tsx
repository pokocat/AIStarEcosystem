"use client";
// ============================================================
// 创作（2026-09-01 五 Tab 定案）：中间凸起键的落点，一个真页面。
//   做人物 / 出片 / 添素材三组入口 + 进行中的任务。
//   分步流程本体仍在老 SPA（/studio），从这里推入 —— 返回回到本页。
// ============================================================
import React from "react";
import Link from "next/link";
import { JobApi } from "@/proto/api";
import type { Job } from "@/proto/data";
import { PlatformGateScreen, useRequireAuth } from "@/components/hub/auth";
import { studioHref, useHubData } from "@/components/hub/data";
import { Badge, Card, Chevron, HubScreen, LinkAction, LoadingBlock, NavBar, SectionHeader } from "@/components/hub/ui";

interface Entry {
  href: string;
  title: string;
  sub: string;
}

const MAKE_PEOPLE: Entry[] = [
  { href: "/studio?start=real", title: "真人复刻", sub: "上传一段本人出镜视频，做成会说话的数字人" },
  { href: "/studio?start=ai", title: "AI 原创人物", sub: "写清楚长相与性格，直接生成一个虚拟角色" },
  { href: studioHref("#/voice"), title: "克隆声音", sub: "录一段自己的声音，之后配音都用它" },
];

const MAKE_VIDEO: Entry[] = [
  { href: "/studio?start=compose", title: "合成出片", sub: "挑人物、场景、产品，直接生成成片" },
];

const MAKE_MATERIAL: Entry[] = [
  { href: "/studio?start=sheet", title: "新建素材", sub: "场景 / 产品 / 风格 / 品牌 IP，实拍上传或 AI 生成" },
];

function EntryList({ items }: { items: Entry[] }) {
  return (
    <Card pad={0}>
      {items.map((e, i) => (
        <Link
          key={e.href}
          href={e.href}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            padding: 14,
            textDecoration: "none",
            color: "inherit",
            borderBottom: i < items.length - 1 ? "1px solid var(--line)" : "none",
          }}
        >
          <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 3 }}>
            <span style={{ fontSize: 14.5, fontWeight: 800, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {e.title}
            </span>
            <span style={{ fontSize: 11.5, color: "var(--ink-3)", overflow: "hidden", textOverflow: "ellipsis" }}>{e.sub}</span>
          </div>
          <Chevron />
        </Link>
      ))}
    </Card>
  );
}

export function CreateCenter() {
  const authState = useRequireAuth();
  const ready = authState === "ok";
  const noPlatform = authState === "no-platform";
  const jobs = useHubData<Job[]>(() => JobApi.list(), [], [], ready);

  if (noPlatform) return <PlatformGateScreen />;
  if (!ready) return <HubScreen tabBar={false}>{null}</HubScreen>;

  const running = jobs.data.filter((j) => j.status === "running").slice(0, 3);

  return (
    <HubScreen tabBar>
      <NavBar title="创作" />

      <div style={{ margin: "6px 16px 0" }}>
        <SectionHeader title="做一个人物" />
        <EntryList items={MAKE_PEOPLE} />
      </div>

      <div style={{ margin: "18px 16px 0" }}>
        <SectionHeader title="用资产出片" />
        <EntryList items={MAKE_VIDEO} />
      </div>

      <div style={{ margin: "18px 16px 0" }}>
        <SectionHeader title="补素材" hint="出片时搭配使用" />
        <EntryList items={MAKE_MATERIAL} />
      </div>

      {(jobs.loading || running.length > 0) && (
        <div style={{ margin: "18px 16px 0" }}>
          <SectionHeader title="正在生成" action={<LinkAction href={studioHref("#/tasks")}>任务中心 ›</LinkAction>} />
          {jobs.loading ? (
            <LoadingBlock />
          ) : (
            <Card pad={0}>
              {running.map((j, i) => (
                <Link
                  key={j.id}
                  href={studioHref("#/tasks")}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                    padding: 14,
                    textDecoration: "none",
                    color: "inherit",
                    borderBottom: i < running.length - 1 ? "1px solid var(--line)" : "none",
                  }}
                >
                  <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 4 }}>
                    <span style={{ fontSize: 14, fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {j.charName || j.char}
                    </span>
                    <span style={{ fontSize: 11.5, color: "var(--ink-3)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {/* kind 是人话（"运镜短视频"），stage 是内部阶段名，不上界面 */}
                      {[j.kind, j.eta].filter(Boolean).join(" · ")}
                    </span>
                  </div>
                  <Badge tone="primary" dot>{`${Math.round(j.pct || 0)}%`}</Badge>
                </Link>
              ))}
            </Card>
          )}
        </div>
      )}
    </HubScreen>
  );
}
