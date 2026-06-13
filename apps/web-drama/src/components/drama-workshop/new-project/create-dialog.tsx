"use client";

// 新建短剧 · 对话框 + 模板浮层 —— 与「短视频」新建一致的对话框体验：
// 居中 AI 对话框（一句话点子 → 立项），对话框「上方」悬浮一层「套爆款模板」浮层，
// 可展开挑模板、可收起。选模板后以 pill 形式回填到对话框，作为立项的骨架。
// 提交 = 真实 createProject（不再 mock /projects/p1）→ 进六阶段工作台补大纲。
import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ChevronDown, ChevronLeft, ChevronUp, Layers, Sparkles, Wand2, X, Zap } from "lucide-react";
import { VideoCover } from "@/components/drama-workshop/video-cover";
import { getTplMeta, type ContentType, type Template } from "@/mocks/drama-workshop";
import { ProjectsApi } from "@/api";
import type { CreateProjectInput } from "@/api/projects";
import { useDramaCatalog } from "@/lib/use-drama-catalog";
import { aiErrorMessage } from "@/lib/ai-error";

type Picked = { tpl: Template; type: ContentType };

export function CreateDialog({
  initialIdea = "",
  focusTemplate = false,
}: {
  initialIdea?: string;
  focusTemplate?: boolean;
}) {
  const router = useRouter();
  const cat = useDramaCatalog(); // 运营可维护：内容类型 / 模板 / 近期热点 / 创意推荐
  const inputRef = React.useRef<HTMLTextAreaElement>(null);
  const creating = React.useRef(false);

  const [idea, setIdea] = React.useState(initialIdea);
  const [picked, setPicked] = React.useState<Picked | null>(null);
  const [overlayOpen, setOverlayOpen] = React.useState(focusTemplate);
  const [sparkN, setSparkN] = React.useState(0);

  // 只展示「确有模板」的内容类型（排除「通用/自定义」）。
  const typesWithTpl = React.useMemo(
    () => cat.contentTypes.filter((t) => t.key !== "custom" && (cat.templates[t.key]?.length ?? 0) > 0),
    [cat],
  );
  // 运营把目录模板清空时（catalog templates: {}），不渲染浮层空壳 —— 退回纯对话框。
  const hasTemplates = typesWithTpl.length > 0;
  const [browseKey, setBrowseKey] = React.useState("");
  React.useEffect(() => {
    if (!browseKey && typesWithTpl.length) setBrowseKey(typesWithTpl[0].key);
  }, [browseKey, typesWithTpl]);
  const browseType = cat.contentTypes.find((t) => t.key === browseKey) ?? null;
  const browseTpls = browseType ? cat.templates[browseType.key] ?? [] : [];

  const canSubmit = idea.trim().length > 0 || !!picked;

  const pickTpl = (tpl: Template) => {
    if (!browseType) return;
    setPicked({ tpl, type: browseType });
    setOverlayOpen(false); // 收起浮层，模板以 pill 落进对话框
    inputRef.current?.focus();
  };

  const spark = () => {
    const pool = cat.ideas.filter((r) => !r.personal);
    if (!pool.length) return;
    const r = pool[sparkN % pool.length];
    setSparkN((n) => n + 1);
    setIdea(`${r.cat}向 · ${r.hook}`);
    inputRef.current?.focus();
  };

  const buildInput = (seed: string): CreateProjectInput => {
    if (picked) {
      const { tpl, type } = picked;
      const vertical = !/16:9/.test(type.ratio);
      const cover = getTplMeta(tpl).cover;
      return {
        title: (seed || tpl.name).slice(0, 24),
        type: type.name,
        typeKey: type.key,
        mode: "template",
        ratio: vertical ? "9:16" : "16:9",
        episodes: tpl.eps > 0 ? tpl.eps : vertical ? 12 : 1,
        logline: seed,
        mainline: getTplMeta(tpl).desc, // 模板一句话梗概作主线，喂给大纲 AI 起草
        coverFrom: cover.from,
        coverTo: cover.to,
      };
    }
    const custom = cat.contentTypes.find((t) => t.key === "custom");
    return {
      title: seed.slice(0, 24) || "未命名短剧",
      type: custom?.name ?? "通用 / 自定义",
      typeKey: custom?.key ?? "custom",
      mode: "guided",
      ratio: "9:16",
      episodes: 12,
      logline: seed,
      coverFrom: custom?.from,
      coverTo: custom?.to,
    };
  };

  const start = async () => {
    if (!canSubmit) {
      inputRef.current?.focus();
      return;
    }
    if (creating.current) return;
    creating.current = true;
    try {
      const detail = await ProjectsApi.createProject(buildInput(idea.trim()));
      router.push(`/projects/${detail.meta.id}${picked ? "?from=template" : ""}`);
      toast.success(picked ? "已套用模板立项,接着改大纲就能用" : "AI 已据你的点子立项,接着补大纲就能开拍");
    } catch (e) {
      creating.current = false;
      toast.error(aiErrorMessage(e, "立项失败，请重试"));
    }
  };

  return (
    <div className="scroll ws-flush" style={{ background: "var(--bg)" }}>
      <div style={{ position: "relative", overflow: "hidden", minHeight: "100%", paddingBottom: 56 }}>
        {/* 氛围光斑（与首页一致的 hero 质感） */}
        <div className="home-blob home-blob-a" style={blob(-150, "20%", undefined, 400, "var(--accent)", 16)} />
        <div className="home-blob home-blob-b" style={blob(-90, undefined, "14%", 360, "var(--accent-2)", 13)} />
        <div className="home-blob home-blob-c" style={blob(70, "48%", undefined, 280, "var(--accent)", 10)} />

        {/* 返回 */}
        <div style={{ position: "relative", maxWidth: 880, margin: "0 auto", padding: "16px 24px 0" }}>
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => router.push("/projects")}>
            <ChevronLeft size={16} /> 返回短剧工坊
          </button>
        </div>

        {/* hero 文案 */}
        <div style={{ maxWidth: 700, margin: "0 auto", padding: "22px 28px 4px", textAlign: "center", position: "relative" }}>
          <div className="faint" style={{ fontSize: 13.5, fontWeight: 600, marginBottom: 8 }}>开一部新短剧</div>
          <h1 style={{ margin: 0, fontSize: 30, fontWeight: 800, letterSpacing: "-.02em", lineHeight: 1.25 }}>
            说说你想拍的
            <span
              style={{
                background: "linear-gradient(120deg,var(--accent),var(--accent-2))",
                WebkitBackgroundClip: "text",
                backgroundClip: "text",
                color: "transparent",
              }}
            >
              短剧
            </span>
          </h1>
          <div className="muted" style={{ marginTop: 8, fontSize: 14.5 }}>
            一句话点子就够 —— AI 替你立项、铺大纲、写剧本、拆分镜。也可以先从上方<strong style={{ color: "var(--ink-2)" }}>套个爆款模板</strong>开场。
          </div>
        </div>

        {/* 创作区：模板浮层（上）+ 对话框（下） */}
        <div style={{ maxWidth: 700, margin: "0 auto", padding: "14px 28px 0", position: "relative" }}>
          {/* —— 模板浮层（无可用模板时整体不渲染，避免空壳） —— */}
          {hasTemplates &&
            (overlayOpen ? (
            <div
              className="card pop-in col"
              style={{ padding: 0, overflow: "hidden", marginBottom: 12, boxShadow: "var(--shadow-lg)", border: "1px solid var(--line)" }}
            >
              <div className="row gap-2" style={{ padding: "12px 16px", borderBottom: "1px solid var(--line-soft)" }}>
                <span className="icon-badge" style={{ width: 30, height: 30, borderRadius: 9 }}>
                  <Layers size={16} />
                </span>
                <div className="grow col" style={{ gap: 1 }}>
                  <span style={{ fontWeight: 800, fontSize: 13.5 }}>套爆款模板</span>
                  <span className="faint" style={{ fontSize: 11 }}>挑一个验证过的爆款结构,AI 按它铺大纲</span>
                </div>
                <button type="button" className="btn btn-icon btn-ghost btn-sm" title="收起" onClick={() => setOverlayOpen(false)}>
                  <ChevronUp size={15} />
                </button>
              </div>

              {/* 内容类型 */}
              <div className="row scroll gap-2" style={{ padding: "11px 16px 0", overflowX: "auto" }}>
                {typesWithTpl.map((t) => (
                  <button
                    key={t.key}
                    type="button"
                    className={"chip" + (browseKey === t.key ? " on" : "")}
                    style={{ flex: "none" }}
                    onClick={() => setBrowseKey(t.key)}
                  >
                    {t.name}
                  </button>
                ))}
              </div>

              {/* 模板卡 · 横向条 */}
              <div className="row scroll gap-3" style={{ padding: "12px 16px 16px", overflowX: "auto", alignItems: "stretch" }}>
                {browseTpls.map((tp) => {
                  const m = getTplMeta(tp);
                  const on = picked?.tpl.id === tp.id;
                  return (
                    <button
                      key={tp.id}
                      type="button"
                      onClick={() => pickTpl(tp)}
                      className="col"
                      style={{
                        flex: "none",
                        width: 170,
                        textAlign: "left",
                        borderRadius: 14,
                        overflow: "hidden",
                        padding: 0,
                        cursor: "pointer",
                        background: "var(--surface)",
                        border: on ? "2px solid var(--accent)" : "1px solid var(--line)",
                        boxShadow: on ? "var(--shadow-accent)" : "none",
                        transition: "border-color .15s, box-shadow .15s, transform .15s",
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.transform = "translateY(-2px)")}
                      onMouseLeave={(e) => (e.currentTarget.style.transform = "none")}
                    >
                      <VideoCover from={m.cover.from} to={m.cover.to} ratio="16/10">
                        <span className="thumb-label" style={{ position: "absolute", top: 8, right: 8 }}>
                          {tp.eps > 1 ? `${tp.eps} 集` : "单集"}
                        </span>
                      </VideoCover>
                      <div className="col gap-1" style={{ padding: "9px 11px 11px" }}>
                        <div style={{ fontWeight: 700, fontSize: 12.5, lineHeight: 1.3 }}>{tp.name}</div>
                        <div
                          className="faint"
                          style={{
                            fontSize: 11,
                            lineHeight: 1.45,
                            height: 32,
                            overflow: "hidden",
                            display: "-webkit-box",
                            WebkitLineClamp: 2,
                            WebkitBoxOrient: "vertical",
                          }}
                        >
                          {m.desc}
                        </div>
                        <div className="row gap-1" style={{ flexWrap: "wrap", marginTop: 2 }}>
                          {tp.hooks.slice(0, 2).map((h, i) => (
                            <span key={i} className="tag tag-gray" style={{ height: 18, fontSize: 10, padding: "0 6px" }}>
                              {h}
                            </span>
                          ))}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          ) : (
            <button
              type="button"
              className="card row gap-2"
              onClick={() => setOverlayOpen(true)}
              style={{ width: "100%", padding: "11px 16px", marginBottom: 12, boxShadow: "var(--shadow-lg)", border: "1px solid var(--line)", cursor: "pointer", textAlign: "left" }}
            >
              <span className="icon-badge" style={{ width: 28, height: 28, borderRadius: 8 }}>
                <Layers size={15} />
              </span>
              <span style={{ fontWeight: 700, fontSize: 13.5, flex: "none" }}>套爆款模板</span>
              <span className="faint" style={{ fontSize: 12, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {picked ? `已选 · ${picked.tpl.name}` : "挑一个验证过的爆款结构开场"}
              </span>
              <span className="grow" />
              <ChevronDown size={16} style={{ color: "var(--ink-3)", flex: "none" }} />
            </button>
            ))}

          {/* —— 对话框 —— */}
          <div
            className="col"
            style={{
              borderRadius: 20,
              overflow: "hidden",
              textAlign: "left",
              background: "var(--surface)",
              border: "1px solid var(--line-soft)",
              boxShadow: "0 18px 50px -24px color-mix(in oklch, var(--accent) 35%, transparent), 0 2px 8px rgba(20,10,50,.04)",
            }}
          >
            {/* 已选模板 pill */}
            {picked && (
              <div className="row" style={{ padding: "12px 16px 0" }}>
                <span
                  className="row gap-2"
                  style={{ maxWidth: "100%", background: "var(--accent-soft)", color: "var(--accent)", borderRadius: 999, padding: "5px 8px 5px 5px" }}
                >
                  <span
                    style={{
                      width: 28,
                      height: 19,
                      borderRadius: 5,
                      flex: "none",
                      background: `linear-gradient(135deg, ${getTplMeta(picked.tpl).cover.from}, ${getTplMeta(picked.tpl).cover.to})`,
                    }}
                  />
                  <span style={{ fontSize: 12, fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {picked.type.name} · {picked.tpl.name}
                  </span>
                  <button
                    type="button"
                    title="移除模板"
                    onClick={() => setPicked(null)}
                    className="row"
                    style={{ flex: "none", cursor: "pointer", color: "inherit", background: "transparent", border: "none", padding: 0 }}
                  >
                    <X size={13} />
                  </button>
                </span>
              </div>
            )}

            <textarea
              ref={inputRef}
              value={idea}
              onChange={(e) => setIdea(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  void start();
                }
              }}
              placeholder={
                picked
                  ? "想加点你的特色?可不填,直接立项也行…"
                  : "用一句话说说你的故事…比如:单亲妈妈白天送外卖晚上学剪辑,三年后逆袭"
              }
              style={{
                width: "100%",
                minHeight: 76,
                border: "none",
                outline: "none",
                resize: "none",
                padding: "14px 18px 4px",
                fontSize: 14.5,
                lineHeight: 1.6,
                background: "transparent",
                fontFamily: "inherit",
                color: "var(--ink)",
              }}
            />

            {/* 近期热点 */}
            <div className="row gap-2" style={{ padding: "4px 14px 0", flexWrap: "wrap", alignItems: "center" }}>
              <span className="row gap-1" style={{ fontSize: 11, fontWeight: 700, color: "var(--accent-2)", flex: "none" }}>
                <Zap size={12} /> 近期热点
              </span>
              {cat.hotTopics.slice(0, 4).map((h) => (
                <button
                  key={h.label}
                  type="button"
                  className="chip"
                  style={{ height: 26, fontSize: 11.5, padding: "0 10px" }}
                  title={h.idea}
                  onClick={() => {
                    setIdea(h.idea);
                    inputRef.current?.focus();
                  }}
                >
                  {h.label}
                </button>
              ))}
            </div>

            <div className="row gap-2" style={{ padding: "10px 14px 12px", flexWrap: "wrap" }}>
              <button
                type="button"
                className="chip"
                onClick={spark}
                style={{ background: "var(--accent-soft)", color: "var(--accent)" }}
                title="AI 随机给一个创意"
              >
                <Sparkles size={13} /> 今日灵感
              </button>
              <span className="grow" />
              <button
                type="button"
                className="btn btn-grad"
                disabled={!canSubmit}
                onClick={() => void start()}
                style={{ height: 40, padding: "0 22px", flex: "none", opacity: canSubmit ? 1 : 0.5, cursor: canSubmit ? "pointer" : "not-allowed" }}
              >
                <Wand2 size={16} /> 开始立项
              </button>
            </div>
          </div>

          <div className="faint" style={{ fontSize: 11.5, textAlign: "center", marginTop: 12 }}>
            立项免费 · 大纲 / 剧本 / 分镜等 AI 动作在工作台里按次计费
          </div>
        </div>
      </div>
    </div>
  );
}

/** 氛围光斑样式（hero 背景）。 */
function blob(top: number, left: string | undefined, right: string | undefined, size: number, color: string, pct: number): React.CSSProperties {
  return {
    position: "absolute",
    top,
    left,
    right,
    width: size,
    height: size,
    borderRadius: "50%",
    background: `radial-gradient(circle, color-mix(in oklch, ${color} ${pct}%, transparent), transparent 70%)`,
    pointerEvents: "none",
  };
}
