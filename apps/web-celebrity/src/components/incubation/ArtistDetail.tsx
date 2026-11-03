"use client";

// AI 艺人孵化 · 艺人详情：人设与孵化进度 + 矩阵账号 / 数字资产 / 短剧与视频 / 商业合作。
// 路演演示版，按钮都走 useComingSoon。

import * as React from "react";
import Link from "next/link";
import { ArrowLeft, Check, Plus, Send } from "lucide-react";
import { formatCompactNumber, formatPercent } from "@ai-star-eco/api-client/format";
import { Button, Card, Chip, Tabs } from "@/components/creator";
import {
  ACCOUNT_STATUS_META,
  ASSET_KIND_META,
  ASSET_KIND_ORDER,
  DEAL_STATUS_META,
  INCUBATION_STAGES,
  PLATFORM_META,
  WORK_KIND_META,
  WORK_STATUS_META,
  stageIndex,
} from "@/constants/incubation-ui";
import {
  DRAMA_KNOWLEDGE,
  artistTotals,
  type ArtistWork,
  type IncubationArtist,
  type MatrixAccount,
  type MatrixRole,
} from "@/mocks/incubation";
import { useComingSoon } from "./ComingSoon";
import { ArtistPortrait, DemoBadge, PlatformBadge, SectionTitle, StageBar, StatCell, formatWanYuan } from "./shared";

type TabId = "matrix" | "assets" | "works" | "deals";

const ROLE_ORDER: { role: MatrixRole; desc: string }[] = [
  { role: "主号", desc: "立人设，发最重要的内容" },
  { role: "剧情号", desc: "连载短剧，拉新粉" },
  { role: "带货号", desc: "挂商品，接带货" },
  { role: "生活号", desc: "日常种草，养亲近感" },
  { role: "切片号", desc: "二次剪辑，给主号引流" },
];

export function ArtistDetail({ artist }: { artist: IncubationArtist }) {
  const [tab, setTab] = React.useState<TabId>("matrix");
  const t = artistTotals(artist);
  const dramas = artist.works.filter((w) => w.kind === "drama");

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20, maxWidth: 1180 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
        <Link
          href="/incubation"
          style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 13, color: "var(--fg-2)", textDecoration: "none" }}
        >
          <ArrowLeft size={14} /> 返回 AI 艺人孵化
        </Link>
        <DemoBadge />
      </div>

      <ArtistHero artist={artist} />

      <div style={{ overflowX: "auto", maxWidth: "100%" }}>
        <Tabs
          active={tab}
          onSelect={(id) => setTab(id as TabId)}
          items={[
            { id: "matrix", label: "矩阵账号", count: t.accounts },
            { id: "assets", label: "数字资产", count: artist.assets.length },
            { id: "works", label: "短剧与视频", count: artist.works.length },
            { id: "deals", label: "商业合作", count: artist.deals.length },
          ]}
        />
      </div>

      {tab === "matrix" && <MatrixTab artist={artist} />}
      {tab === "assets" && <AssetsTab artist={artist} />}
      {tab === "works" && <WorksTab artist={artist} dramaCount={dramas.length} />}
      {tab === "deals" && <DealsTab artist={artist} />}
    </div>
  );
}

function ArtistHero({ artist }: { artist: IncubationArtist }) {
  const current = stageIndex(artist.stage);
  const t = artistTotals(artist);
  return (
    <Card style={{ padding: 20, display: "flex", gap: 22, flexWrap: "wrap" }}>
      <div style={{ width: 200, maxWidth: "100%" }}>
        <ArtistPortrait artist={artist} height={260} />
      </div>
      <div style={{ flex: "1 1 320px", minWidth: 0, display: "flex", flexDirection: "column", gap: 14 }}>
        <div>
          <div style={{ display: "flex", alignItems: "baseline", gap: 10, flexWrap: "wrap" }}>
            <h1 style={{ margin: 0, fontFamily: "var(--font-display)", fontSize: 26, fontWeight: 700, color: "var(--fg-0)" }}>
              {artist.name}
            </h1>
            <span style={{ fontSize: 13, color: "var(--fg-2)" }}>
              {artist.category} · {artist.tagline}
            </span>
          </div>
          <p style={{ margin: "8px 0 0", fontSize: 13.5, color: "var(--fg-1)", lineHeight: 1.7 }}>{artist.persona.summary}</p>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 10 }}>
          <PersonaField label="性格">
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {artist.persona.traits.map((x) => (
                <Chip key={x} tone="accent" size="sm">
                  {x}
                </Chip>
              ))}
            </div>
          </PersonaField>
          <PersonaField label="口头禅">「{artist.persona.catchphrase}」</PersonaField>
          <PersonaField label="目标人群">{artist.persona.audience}</PersonaField>
          <PersonaField label="声音">{artist.persona.voice}</PersonaField>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(110px, 1fr))", gap: 12 }}>
          <StatCell label="矩阵总粉丝" value={t.followers > 0 ? formatCompactNumber(t.followers) : "—"} />
          <StatCell label="近 7 日播放" value={t.plays7d > 0 ? formatCompactNumber(t.plays7d) : "—"} />
          <StatCell label="作品" value={t.works} />
          <StatCell label="商单" value={t.deals} />
        </div>
      </div>

      <div style={{ flex: "1 1 240px", minWidth: 0, display: "flex", flexDirection: "column", gap: 10 }}>
        <div style={{ fontSize: 12.5, fontWeight: 600, color: "var(--fg-0)" }}>孵化进度</div>
        <StageBar stage={artist.stage} progress={artist.stageProgress} />
        <ol style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 8 }}>
          {INCUBATION_STAGES.map((s, i) => {
            const done = i < current;
            const now = i === current;
            return (
              <li key={s.id} style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                <span
                  aria-hidden
                  style={{
                    width: 18,
                    height: 18,
                    borderRadius: "50%",
                    flexShrink: 0,
                    marginTop: 1,
                    display: "grid",
                    placeItems: "center",
                    background: done ? "var(--accent)" : now ? "var(--accent-soft)" : "var(--bg-2)",
                    color: done ? "#fff" : "var(--accent-strong)",
                    border: now ? "1px solid var(--accent)" : "1px solid transparent",
                    fontSize: 10,
                    fontWeight: 700,
                  }}
                >
                  {done ? <Check size={11} /> : now ? i + 1 : ""}
                </span>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: now ? 600 : 500, color: i > current ? "var(--fg-3)" : "var(--fg-0)" }}>
                    {s.label}
                    {now && <span style={{ fontSize: 11.5, color: "var(--accent-strong)", marginLeft: 6 }}>进行中 {artist.stageProgress}%</span>}
                  </div>
                  {now && <div style={{ fontSize: 11.5, color: "var(--fg-2)", marginTop: 2 }}>{s.steps.join(" · ")}</div>}
                </div>
              </li>
            );
          })}
        </ol>
      </div>
    </Card>
  );
}

function PersonaField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ padding: "10px 12px", borderRadius: "var(--radius-md)", background: "var(--bg-2)", minWidth: 0 }}>
      <div style={{ fontSize: 11, color: "var(--fg-2)", marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 13, color: "var(--fg-0)", lineHeight: 1.5 }}>{children}</div>
    </div>
  );
}

// ───────────────────────── 矩阵账号 ─────────────────────────

function MatrixTab({ artist }: { artist: IncubationArtist }) {
  const comingSoon = useComingSoon();
  const t = artistTotals(artist);
  const live = artist.accounts.filter((a) => a.status !== "pending");
  const avgEngagement = live.length > 0 ? live.reduce((s, a) => s + a.engagement, 0) / live.length : 0;

  const actions = (
    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
      <Button
        variant="secondary"
        size="sm"
        onClick={() => comingSoon({ title: "绑定新账号", desc: "扫码授权抖音、小红书、视频号等平台账号，挂到这个艺人名下。" })}
      >
        <Plus size={14} /> 绑定新账号
      </Button>
      <Button
        variant="dark"
        size="sm"
        onClick={() => comingSoon({ title: "一键分发", desc: "选一条内容，按平台自动改标题和封面，定时发到矩阵里的每个账号。" })}
      >
        <Send size={13} /> 一键分发
      </Button>
    </div>
  );

  if (artist.accounts.length === 0) {
    return (
      <Card style={{ padding: 28, display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 10 }}>
        <div style={{ fontSize: 15, fontWeight: 600, color: "var(--fg-0)" }}>还没开矩阵账号</div>
        <div style={{ fontSize: 13, color: "var(--fg-2)", lineHeight: 1.6, maxWidth: 520 }}>
          {artist.name}还在「{INCUBATION_STAGES[stageIndex(artist.stage)].label}」阶段。人设和第一批内容定下来之后，再按主号、剧情号、带货号的分工开账号。
        </div>
        <Button
          variant="dark"
          size="sm"
          onClick={() => comingSoon({ title: "规划矩阵", desc: "按艺人定位推荐开哪些平台、每个账号负责什么内容。" })}
        >
          规划矩阵账号
        </Button>
      </Card>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      <Card style={{ padding: 18 }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", gap: 14 }}>
          <StatCell label="矩阵账号" value={t.accounts} sub={`${t.liveAccounts} 个在运营`} />
          <StatCell label="覆盖平台" value={t.platforms} />
          <StatCell label="总粉丝" value={formatCompactNumber(t.followers)} />
          <StatCell label="近 7 日播放" value={formatCompactNumber(t.plays7d)} />
          <StatCell label="平均互动率" value={formatPercent(avgEngagement * 100, 1)} />
        </div>
      </Card>

      <section style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <SectionTitle title="矩阵分工" sub="每个账号负责一类内容，主号立人设，其他账号各自拉新、带货、引流" right={actions} />
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))", gap: 10 }}>
          {ROLE_ORDER.map(({ role, desc }) => {
            const list = artist.accounts.filter((a) => a.role === role);
            return (
              <div
                key={role}
                style={{
                  padding: 12,
                  borderRadius: "var(--radius-lg)",
                  border: "1px solid var(--line)",
                  background: role === "主号" ? "var(--accent-soft)" : "var(--bg-1)",
                  display: "flex",
                  flexDirection: "column",
                  gap: 8,
                  minWidth: 0,
                }}
              >
                <div>
                  <div style={{ fontSize: 13.5, fontWeight: 600, color: "var(--fg-0)" }}>{role}</div>
                  <div style={{ fontSize: 11.5, color: "var(--fg-2)", marginTop: 2 }}>{desc}</div>
                </div>
                {list.length === 0 ? (
                  <div style={{ fontSize: 12, color: "var(--fg-3)" }}>暂未开通</div>
                ) : (
                  list.map((a) => (
                    <div key={a.id} style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
                      <PlatformBadge platform={a.platform} size={20} />
                      <span
                        style={{ fontSize: 12.5, color: "var(--fg-1)", flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
                        title={a.name}
                      >
                        {a.name}
                      </span>
                      <span style={{ fontSize: 12, color: "var(--fg-2)", fontVariantNumeric: "tabular-nums" }}>
                        {a.status === "pending" ? "待开通" : formatCompactNumber(a.followers)}
                      </span>
                    </div>
                  ))
                )}
              </div>
            );
          })}
        </div>
      </section>

      <section style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <SectionTitle title="账号明细" />
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 12 }}>
          {artist.accounts.map((a) => (
            <AccountCard key={a.id} account={a} />
          ))}
        </div>
      </section>
    </div>
  );
}

function AccountCard({ account }: { account: MatrixAccount }) {
  const comingSoon = useComingSoon();
  const platform = PLATFORM_META[account.platform];
  const status = ACCOUNT_STATUS_META[account.status];
  const pending = account.status === "pending";
  return (
    <Card style={{ padding: 14, display: "flex", flexDirection: "column", gap: 12, minWidth: 0 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
        <PlatformBadge platform={account.platform} size={32} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{ fontSize: 14, fontWeight: 600, color: "var(--fg-0)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
            title={account.name}
          >
            {account.name}
          </div>
          <div style={{ fontSize: 11.5, color: "var(--fg-2)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {platform.label} · @{account.handle}
          </div>
        </div>
        <Chip tone={status.tone} size="sm">
          {status.label}
        </Chip>
      </div>
      <div style={{ display: "flex", gap: 6 }}>
        <Chip tone="neutral" size="sm">
          {account.role}
        </Chip>
      </div>
      {pending ? (
        <div style={{ fontSize: 12.5, color: "var(--fg-2)", lineHeight: 1.6 }}>账号还没开通，开通后这里显示粉丝和播放数据。</div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 8 }}>
          <MiniStat label="粉丝" value={formatCompactNumber(account.followers)} />
          <MiniStat label="7 日播放" value={formatCompactNumber(account.plays7d)} />
          <MiniStat label="30 日发布" value={account.posts30d} />
          <MiniStat label="互动率" value={formatPercent(account.engagement * 100, 1)} />
        </div>
      )}
      <Button
        variant="secondary"
        size="sm"
        style={{ alignSelf: "flex-start" }}
        onClick={() =>
          pending
            ? comingSoon({ title: "开通账号", desc: `按「${account.role}」的定位注册并授权${platform.label}账号。` })
            : comingSoon({ title: "账号数据", desc: "按天看粉丝增长、单条播放和带货转化。" })
        }
      >
        {pending ? "去开通" : "查看数据"}
      </Button>
    </Card>
  );
}

function MiniStat({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div style={{ minWidth: 0 }}>
      <div style={{ fontSize: 10.5, color: "var(--fg-3)", whiteSpace: "nowrap" }}>{label}</div>
      <div style={{ fontSize: 13.5, fontWeight: 600, color: "var(--fg-0)", fontVariantNumeric: "tabular-nums" }}>{value}</div>
    </div>
  );
}

// ───────────────────────── 数字资产 ─────────────────────────

function AssetsTab({ artist }: { artist: IncubationArtist }) {
  const comingSoon = useComingSoon();
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <SectionTitle
        title="数字资产"
        sub="这个艺人用到的人物、IP、场景、产品、声音和风格，每一项都有登记号和版本，出片时直接引用"
        right={
          <Button
            variant="dark"
            size="sm"
            onClick={() => comingSoon({ title: "新建资产", desc: "上传素材或用 AI 生成，登记成带版本的数字资产。" })}
          >
            <Plus size={14} /> 新建资产
          </Button>
        }
      />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 12 }}>
        {ASSET_KIND_ORDER.map((kind) => {
          const meta = ASSET_KIND_META[kind];
          const Icon = meta.icon;
          const list = artist.assets.filter((x) => x.kind === kind);
          return (
            <Card key={kind} style={{ padding: 14, display: "flex", flexDirection: "column", gap: 10, minWidth: 0 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span
                  aria-hidden
                  style={{ width: 32, height: 32, borderRadius: "var(--radius-md)", background: "var(--bg-2)", display: "grid", placeItems: "center", color: "var(--fg-1)" }}
                >
                  <Icon size={15} />
                </span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13.5, fontWeight: 600, color: "var(--fg-0)" }}>
                    {meta.label}
                    <span className="mono" style={{ fontSize: 11, color: "var(--fg-3)", marginLeft: 6 }}>
                      {meta.prefix}-
                    </span>
                  </div>
                  <div style={{ fontSize: 11.5, color: "var(--fg-2)" }}>{meta.desc}</div>
                </div>
                <span style={{ fontSize: 18, fontWeight: 700, color: "var(--fg-0)", fontFamily: "var(--font-display)" }}>{list.length}</span>
              </div>
              {list.length === 0 ? (
                <button
                  type="button"
                  onClick={() => comingSoon({ title: `添加${meta.label}`, desc: `给${artist.name}添加${meta.label}资产。` })}
                  style={{
                    padding: "10px 12px",
                    borderRadius: "var(--radius-md)",
                    border: "1px dashed var(--line-2)",
                    background: "transparent",
                    color: "var(--fg-2)",
                    fontSize: 12.5,
                    cursor: "pointer",
                    textAlign: "left",
                    fontFamily: "var(--font-sans)",
                  }}
                >
                  还没有，点这里添加
                </button>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {list.map((a) => (
                    <button
                      key={a.code}
                      type="button"
                      onClick={() => comingSoon({ title: "资产详情", desc: "查看历史版本、授权记录和用在了哪些作品里。" })}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                        padding: "8px 10px",
                        borderRadius: "var(--radius-md)",
                        background: "var(--bg-2)",
                        border: "none",
                        cursor: "pointer",
                        fontFamily: "var(--font-sans)",
                        textAlign: "left",
                        minWidth: 0,
                      }}
                    >
                      <span className="mono" style={{ fontSize: 11, color: "var(--fg-2)", flexShrink: 0 }}>
                        {a.code}
                      </span>
                      <span
                        style={{ fontSize: 12.5, color: "var(--fg-0)", flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
                        title={a.name}
                      >
                        {a.name}
                      </span>
                      <span className="mono" style={{ fontSize: 11, color: "var(--fg-3)" }}>
                        {a.version}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </Card>
          );
        })}
      </div>
    </div>
  );
}

// ───────────────────────── 短剧与视频 ─────────────────────────

function WorksTab({ artist, dramaCount }: { artist: IncubationArtist; dramaCount: number }) {
  const comingSoon = useComingSoon();
  const dramas = artist.works.filter((w) => w.kind === "drama");
  const videos = artist.works.filter((w) => w.kind !== "drama");

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 10 }}>
        <QuickAction
          title="写一部新短剧"
          desc={`按${artist.name}的人设出故事大纲和分集剧情`}
          onClick={() => comingSoon({ title: "AI 编剧", desc: "一句话出故事大纲和分集剧情，台词按艺人的口吻写。" })}
        />
        <QuickAction
          title="出一条口播"
          desc="写好文案，艺人自己出镜讲"
          onClick={() => comingSoon({ title: "数字人口播", desc: "用艺人的形象和声音出口播视频，口型对得上。" })}
        />
        <QuickAction
          title="做带货视频"
          desc="选商品、套模板，一次出多版"
          onClick={() => comingSoon({ title: "带货视频", desc: "选合作商品和脚本模板，批量出不同版本的带货视频。" })}
        />
      </div>

      <section style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <SectionTitle title="短剧" sub={dramaCount > 0 ? `${artist.name}出演的短剧` : "还没有短剧"} />
        {dramas.length > 0 && <WorkList works={dramas} />}
      </section>

      <section style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <SectionTitle title="短视频" sub={videos.length > 0 ? "口播、带货、剧情短片" : "还没有短视频"} />
        {videos.length > 0 && <WorkList works={videos} />}
      </section>

      <section style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <SectionTitle title="短剧知识库" sub="写剧本前先查：开场、结构、人设、植入和题材趋势" />
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: 10 }}>
          {DRAMA_KNOWLEDGE.map((k) => (
            <button
              key={k.id}
              type="button"
              className="incubation-tool"
              onClick={() => comingSoon({ title: k.title, desc: k.desc })}
              style={{
                textAlign: "left",
                padding: 14,
                borderRadius: "var(--radius-lg)",
                border: "1px solid var(--line)",
                background: "var(--bg-1)",
                cursor: "pointer",
                fontFamily: "var(--font-sans)",
                minWidth: 0,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                <Chip tone="neutral" size="sm">
                  {k.category}
                </Chip>
                <span style={{ fontSize: 11.5, color: "var(--fg-3)" }}>{k.count} 条</span>
              </div>
              <div style={{ fontSize: 13.5, fontWeight: 600, color: "var(--fg-0)", marginTop: 8 }}>{k.title}</div>
              <div style={{ fontSize: 12, color: "var(--fg-2)", marginTop: 4, lineHeight: 1.5 }}>{k.desc}</div>
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}

function QuickAction({ title, desc, onClick }: { title: string; desc: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="incubation-tool"
      style={{
        textAlign: "left",
        padding: "14px 16px",
        borderRadius: "var(--radius-lg)",
        border: "1px solid var(--line)",
        background: "var(--bg-1)",
        cursor: "pointer",
        fontFamily: "var(--font-sans)",
        display: "flex",
        alignItems: "center",
        gap: 12,
        minWidth: 0,
      }}
    >
      <span
        aria-hidden
        style={{ width: 30, height: 30, borderRadius: "50%", background: "var(--ink)", color: "#fff", display: "grid", placeItems: "center", flexShrink: 0 }}
      >
        <Plus size={14} />
      </span>
      <span style={{ minWidth: 0 }}>
        <span style={{ display: "block", fontSize: 13.5, fontWeight: 600, color: "var(--fg-0)" }}>{title}</span>
        <span style={{ display: "block", fontSize: 12, color: "var(--fg-2)", marginTop: 2 }}>{desc}</span>
      </span>
    </button>
  );
}

function WorkList({ works }: { works: ArtistWork[] }) {
  const comingSoon = useComingSoon();
  return (
    <Card style={{ padding: 0, overflow: "hidden" }}>
      {works.map((w, i) => {
        const kind = WORK_KIND_META[w.kind];
        const status = WORK_STATUS_META[w.status];
        const Icon = kind.icon;
        return (
          <button
            key={w.id}
            type="button"
            onClick={() => comingSoon({ title: "作品详情", desc: "看成片、分镜、各平台的播放和评论。" })}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              width: "100%",
              padding: "12px 16px",
              border: "none",
              borderTop: i === 0 ? "none" : "1px solid var(--line)",
              background: "transparent",
              cursor: "pointer",
              fontFamily: "var(--font-sans)",
              textAlign: "left",
              minWidth: 0,
            }}
          >
            <span
              aria-hidden
              style={{ width: 32, height: 32, borderRadius: "var(--radius-md)", background: "var(--bg-2)", display: "grid", placeItems: "center", color: "var(--fg-1)", flexShrink: 0 }}
            >
              <Icon size={15} />
            </span>
            <span style={{ flex: 1, minWidth: 0 }}>
              <span
                style={{ display: "block", fontSize: 13.5, fontWeight: 600, color: "var(--fg-0)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
                title={w.title}
              >
                {w.title}
              </span>
              <span style={{ display: "block", fontSize: 11.5, color: "var(--fg-2)", marginTop: 2 }}>
                {kind.label}
                {w.episodes ? ` · ${w.episodes} 集` : ""}
              </span>
            </span>
            <span style={{ fontSize: 12.5, color: "var(--fg-1)", whiteSpace: "nowrap", fontVariantNumeric: "tabular-nums" }}>
              {w.plays > 0 ? `${formatCompactNumber(w.plays)} 播放` : ""}
            </span>
            <Chip tone={status.tone} size="sm">
              {status.label}
            </Chip>
          </button>
        );
      })}
    </Card>
  );
}

// ───────────────────────── 商业合作 ─────────────────────────

function DealsTab({ artist }: { artist: IncubationArtist }) {
  const comingSoon = useComingSoon();
  const total = artist.deals.reduce((s, d) => s + d.amountCents, 0);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <SectionTitle
        title="商业合作"
        sub={artist.deals.length > 0 ? `合计 ${formatWanYuan(total)}` : `${artist.name}还没有商单，进入矩阵运营阶段后开放品牌对接`}
        right={
          <Button
            variant="dark"
            size="sm"
            onClick={() => comingSoon({ title: "对接新品牌", desc: "品牌方按人设和粉丝画像找艺人，报价、排期、交付在一处走完。" })}
          >
            <Plus size={14} /> 对接新品牌
          </Button>
        }
      />
      {artist.deals.length > 0 && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 12 }}>
          {artist.deals.map((d) => {
            const status = DEAL_STATUS_META[d.status];
            return (
              <Card key={d.id} style={{ padding: 14, display: "flex", flexDirection: "column", gap: 8, minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                  <span style={{ fontSize: 13.5, fontWeight: 600, color: "var(--fg-0)", minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={d.brand}>
                    {d.brand}
                  </span>
                  <Chip tone={status.tone} size="sm">
                    {status.label}
                  </Chip>
                </div>
                <div style={{ fontSize: 12, color: "var(--fg-2)" }}>{d.type}</div>
                <div style={{ fontFamily: "var(--font-display)", fontSize: 20, fontWeight: 700, color: "var(--fg-0)", fontVariantNumeric: "tabular-nums" }}>
                  {formatWanYuan(d.amountCents)}
                </div>
                <Button
                  variant="secondary"
                  size="sm"
                  style={{ alignSelf: "flex-start" }}
                  onClick={() => comingSoon({ title: "合作详情", desc: "合同、交付清单、投放数据和结算进度。" })}
                >
                  查看合作
                </Button>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
