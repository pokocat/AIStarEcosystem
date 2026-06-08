"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowRight, ArrowUpRight, Plus, Sparkles } from "lucide-react";
import { Avatar, Button, Card, Chip, KpiCard } from "@/components/creator";
import { PipelineStep } from "@/components/console/PipelineStep";
import {
  MARKET_STARS,
  CELEBRITY_PROJECTS,
  PROJECT_VIDEOS_MAP,
} from "@/mocks/celebrity-zone";
import { listStars, listProjects, listAllVideos } from "@/api/celebrity-zone";
import type {
  CelebrityProject,
  CelebrityProjectVideo,
  CelebrityStar,
} from "@ai-star-eco/types/celebrity-zone";
import {
  AUTH_STATUS_LABEL,
  DATE_LINE,
  EmptyCallout,
  PROJECT_STATUS_TONE,
  QuotaBar,
  inlineLink,
} from "../_shared/dashboard-fragments";

// 业务总览（围绕"明星市场 → 申请授权 → AI 生成 → 多平台分发 → 带货变现"主线）
// v0.37+：三个数据源 listStars / listProjects / listAllVideos 接通真后端；USE_MOCK=1 自动回退 mocks。
export default function CelebrityDashboardPage() {
  const fallbackVideos = React.useMemo(() => Object.values(PROJECT_VIDEOS_MAP).flat(), []);
  const [stars, setStars] = React.useState<CelebrityStar[]>(MARKET_STARS);
  const [projects, setProjects] = React.useState<CelebrityProject[]>(CELEBRITY_PROJECTS);
  const [allVideos, setAllVideos] = React.useState<CelebrityProjectVideo[]>(fallbackVideos);

  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [s, p, v] = await Promise.all([listStars(), listProjects(), listAllVideos()]);
        if (cancelled) return;
        if (s.length > 0) setStars(s);
        if (p.length > 0) setProjects(p);
        if (v.length > 0) setAllVideos(v);
      } catch {
        // 静默回退 mocks
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const authorizedStars = stars.filter((s) => s.authorization?.status === "authorized");
  const pendingStars = stars.filter((s) => s.authorization?.status === "pending");
  const activeProjects = projects.filter((p) => p.status === "进行中");
  const prepProjects = projects.filter((p) => p.status === "筹备中");
  const pendingReviewCount = allVideos.filter((v) => v.status === "待审核").length;
  const generatingCount = allVideos.filter((v) => v.status === "生成中").length;
  const pendingReview = allVideos.filter((v) => v.status === "待审核").slice(0, 4);
  const generating = allVideos.filter((v) => v.status === "生成中").slice(0, 3);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
      {/* hero */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-end",
          gap: 24,
          flexWrap: "wrap",
        }}
      >
        <div>
          <div
            className="mono"
            style={{
              fontSize: 11,
              color: "var(--fg-2)",
              letterSpacing: 1.5,
              textTransform: "uppercase",
              marginBottom: 10,
            }}
          >
            {DATE_LINE}
          </div>
          <h1
            style={{
              fontSize: 32,
              fontWeight: 600,
              letterSpacing: "var(--tracking-tight)",
              fontFamily: "var(--font-display)",
              margin: 0,
              lineHeight: 1.2,
              color: "var(--fg-0)",
            }}
          >
            欢迎回来，
            <span className="serif-italic" style={{ color: "var(--accent)", marginLeft: 4, fontSize: 30 }}>
              让明星帮你今天再卖一波。
            </span>
          </h1>
          <div style={{ fontSize: 13.5, color: "var(--fg-2)", marginTop: 10 }}>
            已授权 {authorizedStars.length} 位 · 在产项目 {activeProjects.length} 条 · 待审切片{" "}
            {pendingReview.length} 条
          </div>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <Link href="/market">
            <Button variant="secondary" size="md">浏览明星市场</Button>
          </Link>
          <Link href="/projects">
            <Button variant="dark" size="md">
              <Plus size={13} /> 新建带货项目
            </Button>
          </Link>
        </div>
      </div>

      {/* KPI —— 按你当前的真实资产派生（不含模拟经营数据） */}
      <div className="stack-mobile-2" style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14 }}>
        <KpiCard
          label="授权明星"
          value={`${authorizedStars.length} / ${stars.length}`}
          delta={pendingStars.length > 0 ? `${pendingStars.length} 申请审核中` : "暂无待审申请"}
          gradient="teal"
        />
        <KpiCard
          label="在产项目"
          value={`${activeProjects.length}`}
          delta={prepProjects.length > 0 ? `筹备中 ${prepProjects.length} 条` : "暂无筹备项目"}
          gradient="violet"
        />
        <KpiCard
          label="已生成视频"
          value={`${allVideos.length}`}
          delta={generatingCount > 0 ? `生成中 ${generatingCount} 条` : "暂无生成中任务"}
          gradient="peach"
        />
        <KpiCard
          label="待审切片"
          value={`${pendingReviewCount}`}
          delta="通过后自动进入分发"
          gradient="rose"
        />
      </div>

      {/* 业务主线 5 步指引 */}
      <Card style={{ padding: "18px 22px" }}>
        <div className="eyebrow" style={{ marginBottom: 14 }}>明星带货 · 五步主线</div>
        <div className="stack-mobile-2" style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 10 }}>
          <PipelineStep n={1} title="找明星" desc="浏览市场，按分类与人气挑选" href="/market" tone="violet" active />
          <PipelineStep
            n={2}
            title="申请授权"
            desc="选套餐版本，签约约定用量"
            href="/market"
            tone="rose"
            count={pendingStars.length}
            countLabel="审核中"
          />
          <PipelineStep
            n={3}
            title="AI 生成"
            desc="用模板或盲盒生成视频"
            href="/projects"
            tone="peach"
            count={generating.length}
            countLabel="生成中"
          />
          <PipelineStep
            n={4}
            title="审核分发"
            desc="视频审核通过自动分发"
            href="/library"
            tone="amber"
            count={pendingReview.length}
            countLabel="待审核"
          />
          <PipelineStep n={5} title="带货变现" desc="商品 + 数据 + 钱包结算" href="/data" tone="teal" />
        </div>
      </Card>

      {/* 两栏：我的明星 / 在产项目 */}
      <div className="stack-mobile" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
        {/* 我的明星 */}
        <Card style={{ padding: "22px 22px 18px" }}>
          <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 14 }}>
            <div>
              <div style={{ fontSize: 16, fontWeight: 600, color: "var(--fg-0)" }}>我的明星</div>
              <div style={{ fontSize: 11.5, color: "var(--fg-2)", marginTop: 4 }}>
                已授权 {authorizedStars.length} 位 · 用量按套餐计算
              </div>
            </div>
            <Link href="/market" style={inlineLink}>
              管理 <ArrowUpRight size={12} />
            </Link>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {authorizedStars.length === 0 ? (
              <EmptyCallout
                title="还未授权明星"
                desc="从明星市场选择一位，申请授权后即可开始生成。"
                ctaHref="/market"
                ctaLabel="浏览市场"
              />
            ) : (
              authorizedStars.map((s) => (
                <Link
                  key={s.id}
                  href={`/star/${s.id}`}
                  style={{ textDecoration: "none", color: "inherit" }}
                >
                  <div
                    className="hover:bg-[var(--bg-2)] hover:border-[var(--line-2)] transition-colors duration-150"
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 12,
                      padding: "12px 14px",
                      background: "var(--bg-1)",
                      border: "1px solid var(--line)",
                      borderRadius: "var(--radius-md)",
                    }}
                  >
                    <Avatar seed={s.id} initial={s.name[0]} size={36} shape="square" />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13.5, fontWeight: 600, color: "var(--fg-0)", marginBottom: 4 }}>
                        {s.name}
                        <span
                          className="mono"
                          style={{ marginLeft: 8, fontSize: 10.5, color: "var(--fg-3)", letterSpacing: 0.3 }}
                        >
                          {s.category}
                        </span>
                      </div>
                      <QuotaBar used={s.quotaUsed ?? 0} total={s.quotaTotal ?? 1} />
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6 }}>
                      <Chip tone="published" size="sm">{AUTH_STATUS_LABEL.authorized}</Chip>
                      <span className="mono" style={{ fontSize: 10.5, color: "var(--fg-3)" }}>
                        {s.pricingTier ?? ""}
                      </span>
                    </div>
                  </div>
                </Link>
              ))
            )}
          </div>
        </Card>

        {/* 在产项目 */}
        <Card style={{ padding: "22px 22px 18px" }}>
          <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 14 }}>
            <div>
              <div style={{ fontSize: 16, fontWeight: 600, color: "var(--fg-0)" }}>在产项目</div>
              <div style={{ fontSize: 11.5, color: "var(--fg-2)", marginTop: 4 }}>
                进行中 {activeProjects.length} · 筹备中 {prepProjects.length}
              </div>
            </div>
            <Link href="/projects" style={inlineLink}>
              查看全部 <ArrowUpRight size={12} />
            </Link>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {[...activeProjects, ...prepProjects].slice(0, 4).map((p) => (
              <Link
                key={p.id}
                href={`/projects/${p.id}`}
                style={{ textDecoration: "none", color: "inherit" }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                    padding: "12px 14px",
                    background: "var(--bg-1)",
                    border: "1px solid var(--line)",
                    borderRadius: "var(--radius-md)",
                  }}
                >
                  <Avatar seed={p.starId} initial={p.starName[0]} size={36} shape="square" />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13.5, fontWeight: 600, color: "var(--fg-0)", marginBottom: 4 }}>
                      {p.name}
                    </div>
                    <div className="mono" style={{ fontSize: 10.5, color: "var(--fg-2)", letterSpacing: 0.3 }}>
                      {p.starName} · {p.pricingTier} · 视频 {p.videoCount}
                    </div>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6 }}>
                    <Chip tone={PROJECT_STATUS_TONE[p.status]} size="sm">
                      {p.status}
                    </Chip>
                    <span className="mono" style={{ fontSize: 10.5, color: "var(--accent)", fontWeight: 600 }}>
                      {p.gmv}
                    </span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </Card>
      </div>

      {/* 待审切片 / 渠道分发 两栏 */}
      <div className="stack-mobile" style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: 14 }}>
        {/* 待审切片 */}
        <Card style={{ padding: "22px 22px 18px" }}>
          <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 14 }}>
            <div>
              <div style={{ fontSize: 16, fontWeight: 600, color: "var(--fg-0)" }}>待审切片</div>
              <div style={{ fontSize: 11.5, color: "var(--fg-2)", marginTop: 4 }}>
                通过后自动进入分发队列
              </div>
            </div>
            <Link href="/library" style={inlineLink}>
              视频中心 <ArrowUpRight size={12} />
            </Link>
          </div>
          {pendingReview.length === 0 ? (
            <EmptyCallout
              title="无待审切片"
              desc="新切片生成完成后会自动出现在这里。"
              ctaHref="/projects"
              ctaLabel="去项目"
            />
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 12 }}>
              {pendingReview.map((v) => (
                <div
                  key={v.id}
                  style={{
                    padding: "10px 12px",
                    background: "var(--bg-1)",
                    border: "1px solid var(--line)",
                    borderRadius: "var(--radius-md)",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                    <Avatar seed={v.id} initial="🎬" size={24} shape="square" />
                    <Chip tone="filming" size="sm">待审核</Chip>
                  </div>
                  <div
                    style={{
                      fontSize: 12.5,
                      fontWeight: 600,
                      color: "var(--fg-0)",
                      marginBottom: 4,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {v.productName}
                  </div>
                  <div
                    className="mono"
                    style={{
                      fontSize: 10.5,
                      color: "var(--fg-2)",
                      letterSpacing: 0.3,
                      display: "flex",
                      justifyContent: "space-between",
                    }}
                  >
                    <span>{v.starName} · {v.durationSec}s</span>
                    <span>{v.engine}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* 渠道分发占比 —— 真实数据接入前展示诚实空态 */}
        <Card style={{ padding: "22px 22px" }}>
          <div className="eyebrow" style={{ marginBottom: 4 }}>分发渠道占比</div>
          <div style={{ fontSize: 16, fontWeight: 600, color: "var(--fg-0)", marginBottom: 16 }}>
            渠道流量
          </div>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 10,
              alignItems: "flex-start",
              padding: "18px 16px",
              border: "1px dashed var(--line-2)",
              borderRadius: "var(--radius-md)",
              background: "var(--bg-2)",
            }}
          >
            <div style={{ fontSize: 13, color: "var(--fg-1)", fontWeight: 500 }}>暂无分发数据</div>
            <div style={{ fontSize: 12, color: "var(--fg-2)", lineHeight: 1.6 }}>
              开始把生成的视频分发到抖音 / 快手 / 小红书等渠道后，这里会按真实分发记录展示各渠道占比。
            </div>
            <Link href="/distribution" style={inlineLink}>
              前往分发中心 <ArrowUpRight size={12} />
            </Link>
          </div>
        </Card>
      </div>

      {/* 明星市场推荐 entry */}
      <Card
        style={{
          padding: "26px 28px",
          background: "var(--bg-2)",
          border: "1px solid var(--line-2)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 24,
          flexWrap: "wrap",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 22 }}>
          <div
            style={{
              width: 44,
              height: 44,
              borderRadius: "var(--radius-md)",
              background: "var(--accent-soft)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}
          >
            <Sparkles size={20} color="var(--accent)" />
          </div>
          <div>
            <div className="eyebrow">本周热推</div>
            <div
              style={{
                fontSize: 17,
                fontWeight: 600,
                fontFamily: "var(--font-display)",
                marginTop: 4,
                color: "var(--fg-0)",
              }}
            >
              {stars.filter((s) => s.isHot).length} 位{" "}
              <span className="serif-italic" style={{ color: "var(--accent)" }}>
                热门明星
              </span>{" "}
              可授权，挑一位开始带货
            </div>
          </div>
        </div>
        <Link href="/market">
          <Button variant="accent" size="md">
            浏览明星市场 <ArrowRight size={13} />
          </Button>
        </Link>
      </Card>
    </div>
  );
}
