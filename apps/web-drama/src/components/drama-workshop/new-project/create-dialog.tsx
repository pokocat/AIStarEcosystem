"use client";

// 新建短剧 · 对话框 + 热门结构浮层 —— 与「短视频」新建一致的对话框体验：
// 居中对话框（一句话故事 → 新建短剧），对话框「上方」悬浮一层「热门结构」浮层，
// 可展开挑、可收起。选中后以 pill 形式回填到对话框，作为新建时的故事框架。
// 提交 = 真实 createProject → 进工作台（一句话想法已经填进故事大纲，下一步让 AI 写分集剧情）。
//
// v0.197 命名：这里的「热门结构」读的是运营目录 catalog.templates（题材套路：集数 + 钩子），
// 不是模板广场里的「模板」（RecipesApi，别人做好的作品，做同款会带分集剧情和角色）。
// 两份数据不同，名字也分开，免得用户以为两处看到的是同一批东西。
import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Check, ChevronDown, ChevronLeft, ChevronUp, Layers, MessageCircle, Network, Plus, Sparkles, Wand2, X } from "lucide-react";
import { VideoCover } from "@/components/drama-workshop/video-cover";
import { PreviewModal } from "@/components/drama-workshop/preview-modal";
import { getTplMeta, type ContentType, type Template } from "@/mocks/drama-workshop";
import { BrainstormApi, ProjectsApi } from "@/api";
import { invalidate } from "@/lib/drama-query";
import type { CreateProjectInput } from "@/api/projects";
import { useDramaCatalog } from "@/lib/use-drama-catalog";
import { HotTopicChips } from "@/components/drama-workshop/hot-topic-chips";
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
  const cat = useDramaCatalog(); // 运营可维护：内容类型 / 热门结构 / 近期热点 / 推荐点子
  const inputRef = React.useRef<HTMLTextAreaElement>(null);
  const creating = React.useRef(false);

  const [idea, setIdea] = React.useState(initialIdea);
  const [picked, setPicked] = React.useState<Picked | null>(null);
  // v0.79：做成互动剧 —— 新建为 interactive 形态，进工作台直接到「互动编排」（分支图 + 互动点），每集仍逐集制作。
  const [interactive, setInteractive] = React.useState(false);
  const [previewTpl, setPreviewTpl] = React.useState<Picked | null>(null); // 先预览，确认后才套用
  const [overlayOpen, setOverlayOpen] = React.useState(focusTemplate);
  const [sparkN, setSparkN] = React.useState(0);

  // 短剧 = 多集连续剧：热门结构浮层只列「有多集结构」的类型（悬疑/宫斗/甜宠…）。
  // 单条结构（企业宣传片/公益/口播/自传）属短视频，不在新建短剧里露出。
  const typesWithTpl = React.useMemo(
    () => cat.contentTypes.filter((t) => t.key !== "custom" && (cat.templates[t.key] ?? []).some((tp) => tp.eps > 1)),
    [cat],
  );
  // 运营把目录模板清空时（catalog templates: {}），不渲染浮层空壳 —— 退回纯对话框。
  const hasTemplates = typesWithTpl.length > 0;
  const [browseKey, setBrowseKey] = React.useState("");
  React.useEffect(() => {
    if (!browseKey && typesWithTpl.length) setBrowseKey(typesWithTpl[0].key);
  }, [browseKey, typesWithTpl]);
  const browseType = cat.contentTypes.find((t) => t.key === browseKey) ?? null;
  const browseTpls = browseType ? (cat.templates[browseType.key] ?? []).filter((tp) => tp.eps > 1) : [];

  const canSubmit = idea.trim().length > 0 || !!picked || interactive;

  const pickTpl = (p: Picked) => {
    setPicked(p);
    setOverlayOpen(false); // 收起浮层，模板以 pill 落进对话框
    inputRef.current?.focus();
  };

  // 「随机来一个」：按顺序轮流从运营维护的推荐点子里取一条（不是 AI 生成的）。
  const spark = () => {
    const pool = cat.ideas.filter((r) => !r.personal && r.hook);
    if (!pool.length) return;
    const r = pool[sparkN % pool.length];
    setSparkN((n) => n + 1);
    setIdea(r.hook);
    inputRef.current?.focus();
  };

  const buildInput = (seed: string): CreateProjectInput => {
    let base: CreateProjectInput;
    if (picked) {
      const { tpl, type } = picked;
      const vertical = !/16:9/.test(type.ratio);
      const cover = getTplMeta(tpl).cover;
      base = {
        title: (seed || tpl.name).slice(0, 24),
        type: type.name,
        typeKey: type.key,
        mode: "template",
        ratio: vertical ? "9:16" : "16:9",
        episodes: tpl.eps > 0 ? tpl.eps : vertical ? 12 : 1,
        logline: seed,
        mainline: getTplMeta(tpl).desc, // 结构的一句话梗概作主线，喂给大纲 AI 起草
        coverFrom: cover.from,
        coverTo: cover.to,
      };
    } else {
      const custom = cat.contentTypes.find((t) => t.key === "custom");
      base = {
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
    }
    // 互动剧形态：进工作台后由「互动编排」AI 起草整张分支图 / 手动搭，各集再走六阶段出片。
    return interactive ? { ...base, mode: "interactive", title: base.title || "未命名互动剧" } : base;
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
      invalidate("/me/drama/projects");
      const q = interactive ? "" : picked ? "?from=template" : "";
      router.push(`/projects/${detail.meta.id}${q}`);
      toast.success(
        interactive
          ? "互动剧建好了，先搭剧情分支"
          : picked
            ? `已按「${picked.tpl.name}」建好短剧，先看看故事大纲`
            : "短剧建好了，下一步让 AI 写分集剧情",
      );
    } catch (e) {
      creating.current = false;
      toast.error(aiErrorMessage(e, "没建成，请重试"));
    }
  };

  // 还没想清楚：带着输入框里的话去和 AI 聊（聊完在聊天页里一样能新建短剧）。
  const chatting = React.useRef(false);
  const chatFirst = async () => {
    if (chatting.current) return;
    chatting.current = true;
    try {
      const detail = await BrainstormApi.createBrainstorm(idea.trim() || undefined);
      router.push(`/dashboard?b=${encodeURIComponent(detail.meta.id)}&from=projects`);
    } catch (e) {
      chatting.current = false;
      toast.error(aiErrorMessage(e, "没能开始对话，请重试"));
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
        <div className="hm-new-back" style={{ position: "relative", maxWidth: 880, margin: "0 auto", padding: "16px 24px 0" }}>
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => router.push("/projects")}>
            <ChevronLeft size={16} /> 返回我的短剧
          </button>
        </div>

        {/* hero 文案 */}
        <div className="hm-new-hero" style={{ maxWidth: 700, margin: "0 auto", padding: "22px 28px 4px", textAlign: "center", position: "relative" }}>
          <div className="faint" style={{ fontSize: 13.5, fontWeight: 600, marginBottom: 8 }}>新建短剧</div>
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
          <div className="muted" style={{ marginTop: 8, fontSize: 14.5, lineHeight: 1.6 }}>
            一句话想法就够，建好后让 AI 写分集剧情、拆分镜。想照着热门剧的套路来，可以先选一个<strong style={{ color: "var(--ink-2)" }}>热门结构</strong>。
          </div>
        </div>

        {/* 创作区：模板浮层（上）+ 对话框（下） */}
        <div className="hm-new-body" style={{ maxWidth: 700, margin: "0 auto", padding: "14px 28px 0", position: "relative" }}>
          {/* 热门结构浮层（运营没配任何结构时整体不渲染，避免空壳） */}
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
                <div className="grow col" style={{ gap: 1, minWidth: 0 }}>
                  <span style={{ fontWeight: 800, fontSize: 13.5 }}>选个热门结构（可选）</span>
                  <span className="faint" style={{ fontSize: 11 }}>照热门剧的套路定主线，不选也行</span>
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

              {/* 结构卡 · 横向条 */}
              <div className="row scroll gap-3" style={{ padding: "12px 16px 16px", overflowX: "auto", alignItems: "stretch" }}>
                {browseTpls.map((tp) => {
                  const m = getTplMeta(tp);
                  const on = picked?.tpl.id === tp.id;
                  return (
                    <button
                      key={tp.id}
                      type="button"
                      onClick={() => browseType && setPreviewTpl({ tpl: tp, type: browseType })}
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
                          {tp.eps > 1 ? `${tp.eps} 集` : "单条"}
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
              <span style={{ fontWeight: 700, fontSize: 13.5, flex: "none" }}>选个热门结构</span>
              <span className="faint" style={{ fontSize: 12, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {picked ? `已选：${picked.tpl.name}` : "可选，不选也行"}
              </span>
              <span className="grow" />
              <ChevronDown size={16} style={{ color: "var(--ink-3)", flex: "none" }} />
            </button>
            ))}

          {/* 对话框 */}
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
                    title="不用这个结构"
                    aria-label="不用这个结构"
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
                  ? "想改哪里写在这里，比如女主换成法医；不写也能直接新建"
                  : "一句话说说你的故事，比如：单亲妈妈白天送外卖、晚上学剪辑，三年后逆袭"
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
            <HotTopicChips
              topics={cat.hotTopics}
              shuffle
              onPick={(idea) => {
                setIdea(idea);
                inputRef.current?.focus();
              }}
            />

            <div className="row gap-2 hm-new-actions" style={{ padding: "10px 14px 12px", flexWrap: "wrap" }}>
              <button
                type="button"
                className="chip"
                onClick={spark}
                style={{ background: "var(--accent-soft)", color: "var(--accent)" }}
                title="从推荐点子里轮流挑一条填进输入框"
              >
                <Sparkles size={13} /> 随机来一个
              </button>
              <button
                type="button"
                className={"chip" + (interactive ? " on" : "")}
                aria-pressed={interactive}
                onClick={() => setInteractive((v) => !v)}
                title="观众在剧中做选择，选择决定剧情走向和结局"
              >
                {interactive ? <Check size={13} /> : <Network size={13} />} 做成互动剧
              </button>
              <span className="grow" />
              <button
                type="button"
                className="btn btn-grad"
                disabled={!canSubmit}
                onClick={() => void start()}
                style={{ height: 40, padding: "0 22px", flex: "none", opacity: canSubmit ? 1 : 0.5, cursor: canSubmit ? "pointer" : "not-allowed" }}
              >
                <Plus size={16} /> {interactive ? "新建互动剧" : "新建短剧"}
              </button>
            </div>
            {!canSubmit && (
              <div className="faint" style={{ fontSize: 11.5, padding: "0 14px 12px", textAlign: "right" }}>
                先写一句故事，或者选一个热门结构
              </div>
            )}
          </div>

          <div className="faint" style={{ fontSize: 11.5, textAlign: "center", marginTop: 12, lineHeight: 1.6 }}>
            新建不花积分，之后让 AI 写剧情、拆分镜、出图和视频时按次扣积分
          </div>

          <div className="row" style={{ justifyContent: "center", marginTop: 14 }}>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => void chatFirst()}>
              <MessageCircle size={15} /> 还没想清楚？先和 AI 聊聊
            </button>
          </div>
        </div>
      </div>

      {previewTpl && (
        <PreviewModal
          item={{
            cover: getTplMeta(previewTpl.tpl).cover,
            title: previewTpl.tpl.name,
            cat: previewTpl.type.name,
            desc: getTplMeta(previewTpl.tpl).desc,
            tpl: previewTpl.tpl,
            tags: previewTpl.tpl.hooks,
          }}
          onClose={() => setPreviewTpl(null)}
          actions={[
            {
              label: "用这个结构",
              icon: <Wand2 size={15} />,
              variant: "grad",
              onClick: () => {
                const p = previewTpl;
                setPreviewTpl(null);
                pickTpl(p);
              },
            },
          ]}
        />
      )}
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
