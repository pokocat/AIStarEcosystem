"use client";

// 脚本工坊详细版 · cinematic 三列：
//   左 1.0 — 脚本草稿列表（按剧集分组、搜索、状态过滤）
//   中 2.4 — 主体编辑区（剧本元信息 + 场景列表 + 当前场景内容编辑）
//   右 1.0 — AI 建议面板（弧光 / 桥段 / 节奏建议，可一键应用）

import * as React from "react";
import {
  AlignLeft,
  Bot,
  CheckCircle2,
  ClipboardList,
  Clock,
  Drama,
  Lightbulb,
  Plus,
  Save,
  Search,
  Sparkles,
  Wand2,
} from "lucide-react";
import { Button, Card, Chip } from "@/components/premium";
import { formatCny } from "@/lib/cast-derive";

interface Scene {
  id: string;
  title: string;
  location: string;
  durationSec: number;
  body: string;
}

interface ScriptDraft {
  id: string;
  series: string;
  episode: string;
  title: string;
  status: "draft" | "in-review" | "approved";
  progress: number; // 0–100
  updatedAt: string;
  costCredits: number;
  scenes: Scene[];
}

const STATUS_LABEL: Record<ScriptDraft["status"], string> = {
  draft: "草稿",
  "in-review": "送审",
  approved: "已通过",
};
const STATUS_TONE: Record<ScriptDraft["status"], "neutral" | "warning" | "success"> = {
  draft: "neutral",
  "in-review": "warning",
  approved: "success",
};

const SCRIPTS: ScriptDraft[] = [
  {
    id: "drama-script-d-001-ep09",
    series: "暮色未央",
    episode: "EP09",
    title: "剧情转折 · 雨夜追问",
    status: "in-review",
    progress: 82,
    updatedAt: "2 小时前",
    costCredits: 12_000,
    scenes: [
      { id: "s1", title: "第 1 场 · 警局走廊", location: "警局 · 内", durationSec: 90, body: "苏念踩着积水穿过走廊，回头看了一眼审讯室的灯光。雨声透过玻璃淹没了她的脚步。" },
      { id: "s2", title: "第 2 场 · 地下停车场", location: "停车场 · 内夜", durationSec: 120, body: "陆烬靠在车旁等她。看到苏念出来，他扔掉烟，走上前。两人对视，谁也没先开口。" },
      { id: "s3", title: "第 3 场 · 回忆 · 童年雨夜", location: "巷弄 · 外夜", durationSec: 75, body: "（建议加入）小苏念蹲在屋檐下，头发淋湿。一个模糊的身影把伞举到她头顶。镜头不拍清那个人的脸。" },
      { id: "s4", title: "第 4 场 · 车内对峙", location: "车内", durationSec: 180, body: "陆烬打开车门，犹豫了一下，把伞递给苏念。'你以为追问下去就能得到答案？'苏念没接伞，看着雨。" },
      { id: "s5", title: "第 5 场 · 揭示", location: "天桥 · 外夜", durationSec: 60, body: "镜头拉远到天桥。两人各自走向相反方向。字幕：'真相不在他们之间'。" },
    ],
  },
  {
    id: "drama-script-d-002-ep10",
    series: "盛夏来信",
    episode: "EP10",
    title: "角色弧光 · 林晓的转变",
    status: "draft",
    progress: 64,
    updatedAt: "昨天 18:30",
    costCredits: 8_000,
    scenes: [
      { id: "s1", title: "第 1 场 · 教室", location: "教室 · 日内", durationSec: 110, body: "夏日的阳光照进教室。林晓在黑板前讲解题目，回头看到走神的男生，笑了笑。" },
      { id: "s2", title: "第 2 场 · 操场角落", location: "操场 · 日外", durationSec: 90, body: "下课铃响。林晓走到操场角落，看到那个男生独自坐着。她坐下来，掏出耳机递过去一只。" },
      { id: "s3", title: "第 3 场 · 信箱", location: "校门口 · 日外", durationSec: 45, body: "林晓往信箱里投了一封信。镜头特写信封：'写给三年后的我'。" },
    ],
  },
  {
    id: "drama-script-d-003-promo",
    series: "摩天与月光",
    episode: "宣传 · 30s",
    title: "宣传切片 · 主版本待选",
    status: "approved",
    progress: 95,
    updatedAt: "今晨 03:12",
    costCredits: 4_500,
    scenes: [
      { id: "s1", title: "切片 · 蒙太奇 v1", location: "拼接", durationSec: 30, body: "高楼 → 月光 → 苏念回眸 → 陆烬关上电梯 → 字幕：'命运的两端'。" },
      { id: "s2", title: "切片 · 蒙太奇 v2", location: "拼接", durationSec: 30, body: "陆烬独自走向阳台 → 闪回两人争吵 → 黑屏 → 字幕：'谁在等谁'。" },
    ],
  },
  {
    id: "drama-script-d-004-pilot",
    series: "雾隐 · 1992",
    episode: "试播",
    title: "试播 · 雾散开端",
    status: "draft",
    progress: 28,
    updatedAt: "3 天前",
    costCredits: 6_000,
    scenes: [
      { id: "s1", title: "第 1 场 · 山间公路", location: "公路 · 雾", durationSec: 60, body: "1992 年。雾色中，一辆吉普车缓缓驶来。Aiko 坐在副驾，手里捏着一封发黄的信。" },
      { id: "s2", title: "第 2 场 · 旅馆前台", location: "旅馆 · 内", durationSec: 90, body: "Aiko 推开门。前台老板抬头看她，眼神警觉。'雾里的客人，最好别多问。'" },
    ],
  },
];

interface AiSuggestion {
  id: string;
  title: string;
  body: string;
  scope: "scene" | "arc" | "rhythm";
  appliesToSceneId?: string;
}

const SUGGESTIONS_BY_SCRIPT: Record<string, AiSuggestion[]> = {
  "drama-script-d-001-ep09": [
    { id: "s-1", title: "强化女主动机", body: "在第 3 场加入童年回忆，让观众理解苏念为什么坚持追问。回忆镜头不拍清对方脸，留悬念到 EP12。", scope: "arc", appliesToSceneId: "s3" },
    { id: "s-2", title: "节奏调整", body: "第 4 场对峙过长（180 秒），建议拆成两个 90 秒小段，中间插入第 5 场天桥镜头作为情绪缓冲。", scope: "rhythm", appliesToSceneId: "s4" },
    { id: "s-3", title: "结尾留白", body: "第 5 场字幕'真相不在他们之间'可换成更具体的暗示，比如'真相藏在第三个人的伞下'，引导观众期待 EP10。", scope: "scene", appliesToSceneId: "s5" },
  ],
  "drama-script-d-002-ep10": [
    { id: "s-1", title: "合并 EP10/EP11 次线", body: "EP10 和 EP11 都聚焦林晓的成长，建议把次要叙事线（朋友离开）从 EP11 提前到 EP10 第 3 场之后，节奏更紧。", scope: "arc" },
    { id: "s-2", title: "信件意象延展", body: "第 3 场的'写给三年后的我'是亮点，建议在 EP12 让林晓收到这封信，形成首尾呼应。", scope: "rhythm", appliesToSceneId: "s3" },
  ],
  "drama-script-d-003-promo": [
    { id: "s-1", title: "选定 v1 作为主版本", body: "v1 蒙太奇节奏更紧凑，开场 3 秒抓眼球；v2 太抒情，适合做长版预告。", scope: "scene" },
  ],
  "drama-script-d-004-pilot": [
    { id: "s-1", title: "前 30 秒锚定剧种", body: "目前开场偏文艺，建议第 1 场加入一个轻微的悬疑符号（比如信封上的奇怪邮戳），明确「悬疑短剧」定位。", scope: "scene", appliesToSceneId: "s1" },
    { id: "s-2", title: "Aiko 形象训练", body: "Aiko 当前演技值 72，建议先在形象锻造炉锁定一版「冷感雾色」造型，再开拍。", scope: "arc" },
  ],
};

const SCOPE_LABEL: Record<AiSuggestion["scope"], string> = {
  scene: "场景",
  arc: "弧光",
  rhythm: "节奏",
};
const SCOPE_TONE: Record<AiSuggestion["scope"], "accent" | "violet" | "info"> = {
  scene: "accent",
  arc: "violet",
  rhythm: "info",
};

type StatusFilter = "all" | ScriptDraft["status"];

export function ScriptsView() {
  const [activeId, setActiveId] = React.useState(SCRIPTS[0].id);
  const [activeSceneId, setActiveSceneId] = React.useState(SCRIPTS[0].scenes[0].id);
  const [query, setQuery] = React.useState("");
  const [statusFilter, setStatusFilter] = React.useState<StatusFilter>("all");

  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    return SCRIPTS.filter((s) => {
      if (statusFilter !== "all" && s.status !== statusFilter) return false;
      if (!q) return true;
      return (
        s.title.toLowerCase().includes(q) ||
        s.series.toLowerCase().includes(q) ||
        s.episode.toLowerCase().includes(q)
      );
    });
  }, [query, statusFilter]);

  const active = SCRIPTS.find((s) => s.id === activeId) ?? SCRIPTS[0];
  const activeScene = active.scenes.find((s) => s.id === activeSceneId) ?? active.scenes[0];
  const suggestions = SUGGESTIONS_BY_SCRIPT[active.id] ?? [];

  function selectScript(id: string) {
    setActiveId(id);
    const s = SCRIPTS.find((x) => x.id === id);
    if (s) setActiveSceneId(s.scenes[0]?.id ?? "");
  }

  const totalSec = active.scenes.reduce((s, x) => s + x.durationSec, 0);
  const totalChar = active.scenes.reduce((s, x) => s + x.body.length, 0);
  const avgProgress = Math.round(
    SCRIPTS.reduce((s, x) => s + x.progress, 0) / SCRIPTS.length,
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      {/* 顶部 */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-end",
          gap: 24,
        }}
      >
        <div>
          <div className="eyebrow">脚本工坊 · AI 辅助创作</div>
          <h1
            style={{
              fontSize: 36,
              fontWeight: 700,
              letterSpacing: "var(--tracking-tight)",
              fontFamily: "var(--font-display)",
              margin: "10px 0 8px",
              lineHeight: 1.05,
            }}
          >
            脚本{" "}
            <span
              className="text-gradient-gold"
              style={{ fontFamily: "var(--font-serif)", fontStyle: "italic", fontWeight: 400 }}
            >
              工坊
            </span>
          </h1>
          <div style={{ fontSize: 13.5, color: "var(--fg-2)" }}>
            {SCRIPTS.length} 份草稿 · 平均完成度 {avgProgress}% · 当前编辑《{active.series}》{active.episode}
          </div>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <Button variant="secondary" size="md">
            <ClipboardList size={14} /> 提交全部待审
          </Button>
          <Button variant="primary" size="md">
            <Plus size={14} /> 新建脚本
          </Button>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 2.4fr 1fr", gap: 18 }}>
        {/* 左侧脚本列表 */}
        <Card style={{ padding: "20px 22px" }}>
          <div className="eyebrow" style={{ marginBottom: 12 }}>草稿</div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              padding: "8px 12px",
              borderRadius: "var(--radius-md)",
              background: "rgba(255,255,255,0.04)",
              border: "1px solid var(--line-2)",
              marginBottom: 10,
            }}
          >
            <Search size={13} color="var(--fg-2)" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="搜索剧名 / 集数 / 标题…"
              style={{
                flex: 1,
                background: "transparent",
                border: "none",
                outline: "none",
                color: "var(--fg-0)",
                fontSize: 12,
                fontFamily: "var(--font-sans)",
              }}
            />
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginBottom: 14 }}>
            {(["all", "draft", "in-review", "approved"] as StatusFilter[]).map((id) => (
              <button
                key={id}
                onClick={() => setStatusFilter(id)}
                style={pillBtn(statusFilter === id)}
              >
                {id === "all" ? "全部" : STATUS_LABEL[id as ScriptDraft["status"]]}
              </button>
            ))}
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {filtered.length === 0 ? (
              <div
                style={{
                  padding: 16,
                  fontSize: 12,
                  color: "var(--fg-3)",
                  textAlign: "center",
                }}
              >
                无匹配脚本
              </div>
            ) : (
              filtered.map((s) => {
                const isActive = active.id === s.id;
                return (
                  <button
                    key={s.id}
                    onClick={() => selectScript(s.id)}
                    style={{
                      padding: "12px 14px",
                      textAlign: "left",
                      borderRadius: "var(--radius-md)",
                      background: isActive
                        ? "color-mix(in srgb, var(--accent) 12%, transparent)"
                        : "rgba(255,255,255,0.02)",
                      border: isActive
                        ? "1px solid color-mix(in srgb, var(--accent) 50%, transparent)"
                        : "1px solid var(--line)",
                      cursor: "pointer",
                      fontFamily: "var(--font-sans)",
                      transition: "background 160ms, border-color 160ms",
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                      <div
                        className="mono"
                        style={{ fontSize: 10, color: "var(--fg-3)", letterSpacing: 0.4 }}
                      >
                        {s.series} · {s.episode}
                      </div>
                      <Chip tone={STATUS_TONE[s.status]}>{STATUS_LABEL[s.status]}</Chip>
                    </div>
                    <div
                      style={{
                        fontSize: 13,
                        fontWeight: 600,
                        color: isActive ? "var(--fg-0)" : "var(--fg-1)",
                        fontFamily: "var(--font-display)",
                        marginBottom: 8,
                      }}
                    >
                      {s.title}
                    </div>
                    <div
                      style={{
                        height: 3,
                        background: "rgba(255,255,255,0.06)",
                        borderRadius: 2,
                        overflow: "hidden",
                      }}
                    >
                      <div
                        style={{
                          width: `${s.progress}%`,
                          height: "100%",
                          background: "var(--gradient-gold)",
                        }}
                      />
                    </div>
                    <div
                      className="mono"
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        fontSize: 10,
                        color: "var(--fg-3)",
                        marginTop: 6,
                        letterSpacing: 0.3,
                      }}
                    >
                      <span>{s.progress}%</span>
                      <span>{s.updatedAt}</span>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </Card>

        {/* 中间编辑区 */}
        <Card style={{ padding: 0, display: "flex", flexDirection: "column" }}>
          {/* 头部 meta */}
          <div
            style={{
              padding: "20px 26px",
              borderBottom: "1px solid var(--line)",
            }}
          >
            <div
              className="mono"
              style={{ fontSize: 10, color: "var(--fg-3)", letterSpacing: 0.6, marginBottom: 6 }}
            >
              {active.series} · {active.episode} · 草稿 · {active.updatedAt}
            </div>
            <div
              style={{
                fontSize: 24,
                fontWeight: 700,
                fontFamily: "var(--font-display)",
                color: "var(--fg-0)",
                letterSpacing: "var(--tracking-tight)",
              }}
            >
              {active.title}
            </div>
            <div
              style={{
                display: "flex",
                gap: 16,
                marginTop: 12,
                fontFamily: "var(--font-mono)",
                fontSize: 11,
                color: "var(--fg-2)",
              }}
            >
              <span>
                <Drama size={11} style={{ verticalAlign: -1, marginRight: 4 }} />
                {active.scenes.length} 场
              </span>
              <span>
                <Clock size={11} style={{ verticalAlign: -1, marginRight: 4 }} />
                总时长 {Math.round(totalSec / 60)} 分 {totalSec % 60} 秒
              </span>
              <span>
                <AlignLeft size={11} style={{ verticalAlign: -1, marginRight: 4 }} />
                {totalChar} 字
              </span>
              <span style={{ color: "var(--accent)", marginLeft: "auto" }}>
                生成成本 {formatCny(active.costCredits)}
              </span>
            </div>
          </div>

          {/* 场景列表 + 编辑 */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", flex: 1, minHeight: 460 }}>
            <div style={{ padding: "16px 18px", borderRight: "1px solid var(--line)", overflow: "auto" }}>
              <div className="eyebrow" style={{ marginBottom: 10 }}>场景顺序</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {active.scenes.map((sc) => {
                  const isActive = activeSceneId === sc.id;
                  return (
                    <button
                      key={sc.id}
                      onClick={() => setActiveSceneId(sc.id)}
                      style={{
                        padding: "9px 11px",
                        textAlign: "left",
                        borderRadius: "var(--radius-sm)",
                        background: isActive
                          ? "color-mix(in srgb, var(--accent) 12%, transparent)"
                          : "transparent",
                        border: isActive
                          ? "1px solid color-mix(in srgb, var(--accent) 45%, transparent)"
                          : "1px solid transparent",
                        cursor: "pointer",
                        fontFamily: "var(--font-sans)",
                        transition: "background 160ms",
                      }}
                    >
                      <div
                        style={{
                          fontSize: 12.5,
                          color: isActive ? "var(--fg-0)" : "var(--fg-1)",
                          fontWeight: isActive ? 600 : 500,
                          marginBottom: 2,
                        }}
                      >
                        {sc.title}
                      </div>
                      <div
                        className="mono"
                        style={{ fontSize: 10, color: "var(--fg-3)", letterSpacing: 0.3 }}
                      >
                        {sc.location} · {sc.durationSec}s
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 当前场景编辑 */}
            <div style={{ padding: "20px 24px", display: "flex", flexDirection: "column", gap: 14 }}>
              <div>
                <div className="eyebrow" style={{ marginBottom: 6 }}>{activeScene.location} · {activeScene.durationSec} 秒</div>
                <div
                  style={{
                    fontSize: 18,
                    fontWeight: 600,
                    fontFamily: "var(--font-display)",
                    color: "var(--fg-0)",
                  }}
                >
                  {activeScene.title}
                </div>
              </div>

              <div
                style={{
                  flex: 1,
                  padding: "18px 20px",
                  borderRadius: "var(--radius-md)",
                  background: "rgba(0,0,0,0.3)",
                  border: "1px solid var(--line-2)",
                  fontSize: 14,
                  lineHeight: 1.85,
                  color: "var(--fg-1)",
                  fontFamily: "var(--font-serif)",
                  whiteSpace: "pre-wrap",
                }}
              >
                {activeScene.body}
              </div>

              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div className="mono" style={{ fontSize: 11, color: "var(--fg-3)", letterSpacing: 0.3 }}>
                  {activeScene.body.length} 字 · 约 {Math.ceil(activeScene.body.length / 4)} 秒朗读
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <Button variant="ghost" size="sm">
                    <Wand2 size={13} /> AI 改写
                  </Button>
                  <Button variant="primary" size="sm">
                    <Save size={13} /> 保存
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </Card>

        {/* 右侧 AI 建议 */}
        <Card glass style={{ padding: "22px 22px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
            <Bot size={14} color="var(--accent)" />
            <div className="eyebrow" style={{ marginBottom: 0 }}>AI 建议（{suggestions.length}）</div>
          </div>

          {suggestions.length === 0 ? (
            <div style={{ fontSize: 12, color: "var(--fg-3)", padding: "20px 0", textAlign: "center" }}>
              暂无建议
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {suggestions.map((sg, i) => (
                <div
                  key={sg.id}
                  style={{
                    padding: "14px 16px",
                    borderRadius: "var(--radius-md)",
                    background: "rgba(255,255,255,0.02)",
                    border: "1px solid var(--line)",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      marginBottom: 8,
                    }}
                  >
                    <div
                      className="mono"
                      style={{ fontSize: 10, color: "var(--fg-3)", letterSpacing: 0.5 }}
                    >
                      {String(i + 1).padStart(2, "0")}
                    </div>
                    <Chip tone={SCOPE_TONE[sg.scope]}>{SCOPE_LABEL[sg.scope]}</Chip>
                  </div>
                  <div
                    style={{
                      fontSize: 13,
                      fontWeight: 600,
                      color: "var(--fg-0)",
                      marginBottom: 6,
                      fontFamily: "var(--font-display)",
                    }}
                  >
                    {sg.title}
                  </div>
                  <div
                    style={{
                      fontSize: 12,
                      color: "var(--fg-2)",
                      lineHeight: 1.6,
                      marginBottom: 10,
                      fontStyle: "italic",
                      fontFamily: "var(--font-serif)",
                    }}
                  >
                    "{sg.body}"
                  </div>
                  <div style={{ display: "flex", gap: 6 }}>
                    <Button
                      variant="primary"
                      size="sm"
                      style={{ flex: 1, fontSize: 11 }}
                      onClick={() => sg.appliesToSceneId && setActiveSceneId(sg.appliesToSceneId)}
                    >
                      <CheckCircle2 size={12} /> 应用建议
                    </Button>
                    {sg.appliesToSceneId && (
                      <Button
                        variant="ghost"
                        size="sm"
                        style={{ fontSize: 11 }}
                        onClick={() => setActiveSceneId(sg.appliesToSceneId!)}
                      >
                        定位
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          <div
            style={{
              marginTop: 22,
              padding: "12px 14px",
              borderRadius: "var(--radius-md)",
              background: "color-mix(in srgb, var(--accent) 8%, transparent)",
              border: "1px solid color-mix(in srgb, var(--accent) 22%, transparent)",
              display: "flex",
              gap: 8,
              fontSize: 11,
              color: "var(--fg-1)",
              lineHeight: 1.6,
            }}
          >
            <Lightbulb size={12} color="var(--accent)" style={{ flexShrink: 0, marginTop: 2 }} />
            <div>
              建议覆盖三类：场景级（单场建议）、弧光（人物长线）、节奏（时长节奏）。
              点 "应用建议" 会跳到对应场景。
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}

function pillBtn(active: boolean): React.CSSProperties {
  return {
    padding: "5px 10px",
    borderRadius: "var(--radius-pill)",
    fontSize: 11,
    background: active
      ? "color-mix(in srgb, var(--accent) 14%, transparent)"
      : "transparent",
    border: active
      ? "1px solid color-mix(in srgb, var(--accent) 50%, transparent)"
      : "1px solid var(--line-2)",
    color: active ? "var(--accent)" : "var(--fg-1)",
    cursor: "pointer",
    fontFamily: "var(--font-sans)",
    transition: "background 160ms, border-color 160ms",
  };
}
