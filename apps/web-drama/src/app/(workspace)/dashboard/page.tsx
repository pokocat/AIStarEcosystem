"use client";

// 首页 · AI 开拍 — 设计真源 v4 screens-home-v3.jsx `Home3`:
// 居中 AI 对话框(短视频 / 短剧 一键切换 + 近期热点 + 今日灵感)+
// 封面式创意推荐(统一预览弹窗)+ 继续上次。
import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  ArrowRight,
  Clock,
  Edit,
  Film,
  Layers,
  RefreshCw,
  Sparkles,
  Wand2,
  Zap,
} from "lucide-react";
import { CreditButton, Thumb } from "@/components/drama-ui";
import { stageNameByNo } from "@/components/drama-workshop/stages-config";
import { PreviewModal } from "@/components/drama-workshop/preview-modal";
import { VideoCover } from "@/components/drama-workshop/video-cover";
import {
  CONTENT_TYPES,
  IDEA_TAGS,
  SHORT_FORMATS,
  ideaBeats,
  type IdeaRec,
  type ShortFormat,
} from "@/mocks/drama-workshop";
import { ProjectsApi } from "@/api";
import { useAsync } from "@/lib/drama-query";
import { useDramaCatalog } from "@/lib/use-drama-catalog";
import { aiErrorMessage } from "@/lib/ai-error";

function greeting() {
  const h = new Date().getHours();
  if (h < 5) return "夜深了";
  if (h < 11) return "早上好";
  if (h < 14) return "中午好";
  if (h < 18) return "下午好";
  return "晚上好";
}

export default function HomePage() {
  const router = useRouter();
  const [idea, setIdea] = React.useState("");
  const [mode, setMode] = React.useState<"short" | "drama">("short"); // 短视频在前且默认
  const [page, setPage] = React.useState(0);
  const [sparkN, setSparkN] = React.useState(0);
  const [preview, setPreview] = React.useState<IdeaRec | null>(null);
  const [fmtPreview, setFmtPreview] = React.useState<ShortFormat | null>(null);
  const inputRef = React.useRef<HTMLTextAreaElement>(null);
  const creating = React.useRef(false); // 防连点重复立项
  const cat = useDramaCatalog(); // 运营可维护的「近期热点 / 创意推荐」
  const recs = Array.from({ length: 6 }).map((_, i) => cat.ideas[(page * 6 + i) % Math.max(1, cat.ideas.length)]);
  // v0.66:「继续上次」取真实最近项目（无项目则不显示），不再用 mock PROJECTS。
  // 这里是短剧首页 → 只接最近的多集短剧；单集作品（宣传片等）的续做在「短视频工坊」。
  const projectsQ = useAsync("/me/drama/projects", () => ProjectsApi.listProjects());
  const main = projectsQ.data?.find((p) => p.episodes > 1);
  const isShort = mode === "short";
  const curFmt = SHORT_FORMATS[0];

  const goShortMake = (text?: string | null) => {
    // v0.73 修：点子经 sessionStorage 一次性带入（不入 URL，避免长文案/刷新重复请求）；
    // 自由文本进短视频不预设模版（不再强制 fmt=sell）。
    const seed = text?.trim();
    if (seed && typeof window !== "undefined") sessionStorage.setItem("drama.shorts.idea", seed);
    router.push("/shorts/make");
  };
  // 一句话点子 → 真实立项（DramaProject），再跳到新项目工作台补大纲。
  // 自由文本无题材选择，落到「通用 / 自定义」骨架；点子原文作为 logline，
  // 由工作台大纲阶段的 AI 起草消费（与 /projects/new 引导流一致）。
  const ideaCreate = async (
    text: string,
    opts?: { title?: string; coverFrom?: string; coverTo?: string },
  ) => {
    const seed = text.trim();
    if (!seed) {
      inputRef.current?.focus();
      return;
    }
    if (creating.current) return;
    const ct = CONTENT_TYPES.find((t) => t.key === "custom");
    creating.current = true;
    try {
      const detail = await ProjectsApi.createProject({
        title: (opts?.title?.trim() || seed).slice(0, 24),
        type: ct?.name ?? "通用 / 自定义",
        typeKey: ct?.key ?? "custom",
        mode: "guided",
        ratio: "9:16",
        episodes: 12,
        logline: seed,
        coverFrom: opts?.coverFrom ?? ct?.from,
        coverTo: opts?.coverTo ?? ct?.to,
      });
      router.push(`/projects/${detail.meta.id}`);
      toast.success("AI 已根据你的点子立项,接着补大纲就能开拍");
    } catch (e) {
      creating.current = false;
      toast.error(aiErrorMessage(e, "立项失败，请重试"));
    }
  };
  const submit = () => {
    // 空输入不可提交（按钮也会置灰）；聚焦输入框提示用户先写点子。
    if (!idea.trim()) {
      inputRef.current?.focus();
      return;
    }
    if (isShort) {
      goShortMake(idea);
      return;
    }
    void ideaCreate(idea.trim());
  };
  const fillRec = (r: IdeaRec) => {
    setIdea(r.hook);
    setPreview(null);
    inputRef.current?.focus();
  };
  const dailySpark = () => {
    if (isShort) {
      if (curFmt) setIdea(curFmt.sample);
      inputRef.current?.focus();
      return;
    }
    const pool = cat.ideas.filter((r) => !r.personal);
    const r = pool[sparkN % pool.length];
    setSparkN((n) => n + 1);
    setIdea(`${r.cat}向 · ${r.hook}`);
    inputRef.current?.focus();
  };
  // 套爆款模板 → 真实立项（template 模式），与短剧工坊的快捷立项一致。

  return (
    <div className="scroll ws-flush" style={{ background: "var(--bg)" }}>
      <div style={{ position: "relative", overflow: "hidden", paddingBottom: 48 }}>
        <div
          className="home-blob home-blob-a"
          style={{
            position: "absolute",
            top: -160,
            left: "18%",
            width: 420,
            height: 420,
            borderRadius: "50%",
            background: "radial-gradient(circle, color-mix(in oklch, var(--accent) 16%, transparent), transparent 70%)",
            pointerEvents: "none",
          }}
        />
        <div
          className="home-blob home-blob-b"
          style={{
            position: "absolute",
            top: -100,
            right: "12%",
            width: 380,
            height: 380,
            borderRadius: "50%",
            background: "radial-gradient(circle, color-mix(in oklch, var(--accent-2) 13%, transparent), transparent 70%)",
            pointerEvents: "none",
          }}
        />
        <div
          className="home-blob home-blob-c"
          style={{
            position: "absolute",
            top: 60,
            left: "46%",
            width: 300,
            height: 300,
            borderRadius: "50%",
            background: "radial-gradient(circle, color-mix(in oklch, var(--accent) 10%, transparent), transparent 70%)",
            pointerEvents: "none",
          }}
        />

        <div style={{ maxWidth: 760, margin: "0 auto", padding: "36px 40px 8px", position: "relative", textAlign: "center" }}>
          <div className="faint" style={{ fontSize: 13.5, fontWeight: 600, marginBottom: 8 }}>{greeting()},创作者</div>
          <h1 style={{ margin: 0, fontSize: 31, fontWeight: 800, letterSpacing: "-.02em", lineHeight: 1.25 }}>
            今天想做{isShort ? "一条" : "一部"}什么
            <span
              style={{
                background: "linear-gradient(120deg,var(--accent),var(--accent-2))",
                WebkitBackgroundClip: "text",
                backgroundClip: "text",
                color: "transparent",
              }}
            >
              {isShort ? "短视频" : "短剧"}
            </span>
            ?
          </h1>
          <div className="muted" style={{ marginTop: 8, fontSize: 14.5 }}>
            {isShort
              ? "说句话 —— AI 出口播脚本和分镜,单条速成,同样竖屏 9:16"
              : "一句话点子就够 —— AI 替你立项、铺大纲、写剧本、拆分镜,竖屏连载"}
          </div>

          {/* 类型切换 · 轻量分段(短视频在前) */}
          <div className="row" style={{ justifyContent: "center", marginTop: 16 }}>
            <div
              className="row"
              style={{
                background: "color-mix(in oklch, var(--surface) 78%, transparent)",
                border: "1px solid var(--line-soft)",
                borderRadius: 999,
                padding: 3,
                gap: 2,
              }}
            >
              {(
                [
                  { k: "short", icon: Zap, name: "短视频" },
                  { k: "drama", icon: Film, name: "短剧" },
                ] as const
              ).map((o) => {
                const on = mode === o.k;
                const OIcon = o.icon;
                return (
                  <button
                    key={o.k}
                    type="button"
                    onClick={() => setMode(o.k)}
                    className="row gap-2"
                    style={{
                      padding: "7px 18px",
                      borderRadius: 999,
                      fontWeight: 700,
                      fontSize: 13,
                      background: on ? "var(--surface)" : "transparent",
                      boxShadow: on ? "var(--shadow-sm)" : "none",
                      color: on ? "var(--accent)" : "var(--ink-3)",
                      transition: "color .15s, background .15s",
                    }}
                  >
                    <OIcon size={14} />
                    {o.name}
                  </button>
                );
              })}
            </div>
          </div>

          {/* 对话框 · 轻盈质感 */}
          <div
            className="col"
            style={{
              marginTop: 14,
              borderRadius: 20,
              overflow: "hidden",
              textAlign: "left",
              background: "var(--surface)",
              border: "1px solid var(--line-soft)",
              boxShadow: "0 18px 50px -24px color-mix(in oklch, var(--accent) 35%, transparent), 0 2px 8px rgba(20,10,50,.04)",
            }}
          >
            <textarea
              ref={inputRef}
              value={idea}
              onChange={(e) => setIdea(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  submit();
                }
              }}
              placeholder={
                isShort
                  ? "比如:" + (curFmt?.sample ?? "")
                  : "比如:单亲妈妈白天送外卖晚上学剪辑,三年后逆袭…(没灵感就点下面的 ✦ 今日灵感)"
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
              }}
            />

            {/* 热点轻提示:点一个填进输入框 */}
            <div className="row gap-2" style={{ padding: "4px 14px 0", flexWrap: "wrap", alignItems: "center" }}>
              <span className="row gap-1" style={{ fontSize: 11, fontWeight: 700, color: "var(--accent-2)", flex: "none" }}>
                <Zap size={12} /> 近期热点
              </span>
              {cat.hotTopics.map((h) => (
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
                onClick={dailySpark}
                style={{ background: "var(--accent-soft)", color: "var(--accent)" }}
                title={isShort ? "随机填个示例点子" : "AI 随机给一个创意"}
              >
                <Sparkles size={13} /> {isShort ? "给我灵感" : "今日灵感"}
              </button>
              {isShort && <span className="faint" style={{ fontSize: 11, alignSelf: "center" }}>随机来一个</span>}
              {!isShort && (
                <button type="button" className="chip" onClick={() => router.push("/projects/new?focus=template")}>
                  <Layers size={13} /> 套爆款模板
                </button>
              )}
              {!isShort && (
                <button type="button" className="chip" onClick={() => router.push("/projects/new")}>
                  <Wand2 size={13} /> 跟 AI 聊出故事
                </button>
              )}
              <span className="grow" />
              <CreditButton
                cost={isShort ? 10 : 6}
                onConfirm={submit}
                confirmTitle={isShort ? "开始制作短视频" : "开拍新剧"}
                className="btn btn-grad"
                style={{ height: 40, padding: "0 22px", flex: "none" }}
                markSize={15}
                disabled={!idea.trim()}
              >
                <Zap size={16} /> {isShort ? "开始制作" : "开拍"}
              </CreditButton>
            </div>
          </div>

          <div className="row" style={{ marginTop: 22, marginBottom: 12 }}>
            <span style={{ fontWeight: 700, fontSize: 13.5 }}>{isShort ? "短视频模板" : "创意推荐"}</span>
            <span className="faint" style={{ fontSize: 12, marginLeft: 8 }}>
              {isShort ? "点卡片看成片预览,满意一键套用就做" : "点卡片预览效果,满意一键开拍"}
            </span>
            <span className="grow" />
            {!isShort && (
              <button type="button" className="chip" onClick={() => setPage((p) => p + 1)}>
                <RefreshCw size={12} /> 换一批
              </button>
            )}
          </div>
        </div>

        {/* 封面式创意卡(紧凑竖版) */}
        <div style={{ maxWidth: 1000, margin: "0 auto", padding: "0 40px", position: "relative" }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(158px,1fr))", gap: 14 }}>
            {isShort &&
              SHORT_FORMATS.map((f, i) => (
                <button
                  key={f.key}
                  type="button"
                  className="card col fade-up"
                  onClick={() => setFmtPreview(f)}
                  style={{ padding: 0, overflow: "hidden", textAlign: "left", animationDelay: i * 35 + "ms", transition: "transform .15s, box-shadow .15s" }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.transform = "translateY(-3px)";
                    e.currentTarget.style.boxShadow = "var(--shadow-lg)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = "none";
                    e.currentTarget.style.boxShadow = "var(--shadow-sm)";
                  }}
                >
                  <VideoCover from={f.from} to={f.to} ratio="3/4" label="成片预览">
                    <span className="thumb-label" style={{ position: "absolute", top: 8, left: 8 }}>{f.tip}</span>
                    <span className="thumb-label num" style={{ position: "absolute", top: 8, right: 8 }}>{f.dur}s</span>
                  </VideoCover>
                  <div className="col gap-1" style={{ padding: "11px 13px 13px" }}>
                    <div style={{ fontWeight: 800, fontSize: 14 }}>{f.name}</div>
                    <div
                      className="faint"
                      style={{ fontSize: 12, lineHeight: 1.55, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}
                    >
                      {f.sample}
                    </div>
                  </div>
                </button>
              ))}
            {!isShort && recs.map((r, i) => (
              <button
                key={r.title}
                type="button"
                className="card col fade-up"
                onClick={() => setPreview(r)}
                style={{ padding: 0, overflow: "hidden", textAlign: "left", animationDelay: i * 35 + "ms", transition: "transform .15s, box-shadow .15s" }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = "translateY(-3px)";
                  e.currentTarget.style.boxShadow = "var(--shadow-lg)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = "none";
                  e.currentTarget.style.boxShadow = "var(--shadow-sm)";
                }}
              >
                <VideoCover from={r.from} to={r.to} ratio="3/4" label="效果预览">
                  <span className="thumb-label" style={{ position: "absolute", top: 8, left: 8 }}>{r.cat}</span>
                  {r.personal && (
                    <span
                      className="tag tag-pink"
                      style={{ position: "absolute", top: 8, right: 8, background: "rgba(255,255,255,.92)" }}
                    >
                      <Sparkles size={10} fill="currentColor" strokeWidth={0} /> 猜你想拍
                    </span>
                  )}
                </VideoCover>
                <div className="col gap-1" style={{ padding: "11px 13px 13px" }}>
                  <div style={{ fontWeight: 800, fontSize: 14 }}>{r.title}</div>
                  <div
                    className="faint"
                    style={{
                      fontSize: 12,
                      lineHeight: 1.55,
                      display: "-webkit-box",
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: "vertical",
                      overflow: "hidden",
                    }}
                  >
                    {r.hook}
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* 继续上次(轻量入口,完整列表在「短剧工坊」) */}
        {main && (
          <div style={{ maxWidth: 1000, margin: "0 auto", padding: "28px 40px 0", position: "relative" }}>
            <button
              type="button"
              className="card row gap-4 fade-up"
              onClick={() => router.push(`/projects/${main.id}`)}
              style={{ width: "100%", padding: 13, textAlign: "left", alignItems: "center" }}
              onMouseEnter={(e) => {
                e.currentTarget.style.boxShadow = "var(--shadow-lg)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.boxShadow = "var(--shadow-sm)";
              }}
            >
              <Thumb from={main.cover.from} to={main.cover.to} w={42} ratio="9/16" radius={9} stripes={false} />
              <div className="col gap-1 grow" style={{ minWidth: 0 }}>
                <div className="row gap-2">
                  <span className="tag tag-accent">
                    <Clock size={11} /> 继续上次
                  </span>
                  <span style={{ fontWeight: 800, fontSize: 14.5 }}>{main.title}</span>
                </div>
                <div className="muted" style={{ fontSize: 12.5 }}>
                  上次做到「{stageNameByNo(main.stage)}」· {main.updated}更新
                </div>
              </div>
              <span className="btn btn-primary btn-sm" style={{ flex: "none" }}>
                接着做 <ArrowRight size={14} />
              </span>
            </button>
          </div>
        )}
      </div>

      {preview && (
        <PreviewModal
          item={{
            cover: { from: preview.from, to: preview.to },
            title: preview.title,
            cat: preview.cat,
            desc: preview.hook,
            personal: preview.personal,
            tags: IDEA_TAGS[preview.cat] ?? ["爆款结构"],
            beats: ideaBeats(preview.cat),
            coverLabel: "效果预览 · 同题材成片片段",
          }}
          onClose={() => setPreview(null)}
          actions={[
            { label: "填进对话框改改", icon: <Edit size={15} />, variant: "line", onClick: () => fillRec(preview) },
            {
              label: "用这个开拍",
              icon: <Zap size={15} />,
              variant: "grad",
              cost: 6,
              onClick: () => {
                const rec = preview;
                setPreview(null);
                void ideaCreate(rec.hook, { title: rec.title, coverFrom: rec.from, coverTo: rec.to });
              },
            },
          ]}
        />
      )}
      {fmtPreview && (
        <PreviewModal
          item={{
            cover: { from: fmtPreview.from, to: fmtPreview.to },
            title: fmtPreview.name,
            cat: "短视频模板",
            desc: `示例:${fmtPreview.sample}`,
            tags: [fmtPreview.tip, `约 ${fmtPreview.dur}s`, "竖屏 9:16"],
            beats: (() => {
              let acc = 0;
              return fmtPreview.beats.map((b) => {
                const r = { range: `${acc}-${acc + b.dur}s`, beat: b.visual.slice(0, 18), est: `${b.dur}s` };
                acc += b.dur;
                return r;
              });
            })(),
            beatsLabel: "分镜节拍 · 套用后逐镜可改",
            coverLabel: "成片预览 · 同格式样片",
          }}
          onClose={() => setFmtPreview(null)}
          actions={[
            {
              label: "用这个模板开始制作",
              icon: <Zap size={15} />,
              variant: "grad",
              cost: 10,
              onClick: () => {
                const k = fmtPreview.key;
                setFmtPreview(null);
                router.push(`/shorts/make?fmt=${encodeURIComponent(k)}`);
              },
            },
          ]}
        />
      )}
    </div>
  );
}
