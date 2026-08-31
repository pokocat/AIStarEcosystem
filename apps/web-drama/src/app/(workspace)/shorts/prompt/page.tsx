"use client";

export const dynamic = "force-dynamic";

// 短视频「提示词直出」（v0.143）—— 与「AI 对话出脚本」并列的第二条入口。
// 已经写好完整提示词的用户不必再跟 AI 聊一遍：粘贴原文 → 免费拆解成人物卡 / 场景 /
// 全片画面基调 / 逐镜分镜 → 就地核对与修改 → 开始制作（扣一笔开拍费）→ 进工作台逐镜出片。
//
// 后端：POST /me/drama/shorts/parse-prompt（拆解，不落库不扣费）
//      + POST /me/drama/shorts（body.seed = 本页最终结果，建草稿并扣开拍费）。
import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  AlertTriangle,
  ChevronLeft,
  ChevronDown,
  ClipboardPaste,
  Clapperboard,
  Info,
  Loader2,
  Plus,
  RefreshCw,
  ScrollText,
  Sparkles,
  Trash2,
  Users,
  Zap,
} from "lucide-react";
import { CreditMark, Editable, dramaConfirm } from "@/components/drama-ui";
import { ShortsApi } from "@/api";
import type { ParsedShortPrompt, ParsedShortShot } from "@/api/shorts";
import { PROMPT_MAX_SHOTS, PROMPT_SHOT_MAX_SEC, PROMPT_SHOT_MIN_SEC, parsedTotalSec } from "@/lib/short-prompt-draft";
import { aiErrorMessage } from "@/lib/ai-error";
import { useDramaConfig } from "@/lib/use-drama-config";
import { invalidate } from "@/lib/drama-query";

/** 与后端 DramaShortPromptService 的输入上限一致（超出直接挡回，不静默截断用户设定）。 */
const MAX_PROMPT_CHARS = 20_000;
const MIN_PROMPT_CHARS = 20;

/** 「看看示例」填入的样例提示词 —— 演示最稳的写法：人物 / 场景 / 基调 / 带时间码的分镜。 */
const SAMPLE_PROMPT = `【角色】阿宁：二十五岁女生，齐耳短发，米白针织开衫配牛仔背带裤，左手戴一只旧机械表；性格慢热，开口前习惯先笑一下。
【角色】修表匠老周：六十岁上下，花白短发，深灰工装围裙，右眼架着单目放大镜；话少，手很稳。
【场景】老城区二楼咖啡馆，木质吧台与斑驳白墙，午后逆光，空气里有细小浮尘；暖黄与青灰对比。
【全片基调】电影感竖屏，自然光为主，轻微手持晃动，浅景深，胶片颗粒。
【分镜】
00:00-00:04 远景推近：阿宁抱着纸箱推门进来，门口风铃轻响。台词：旁白：搬来第七天，她还没敢开口。
00:04-00:10 中近景：她把旧机械表摘下放在吧台上，指尖在表盘上停了一秒。台词：阿宁：这块表……还能修吗？
00:10-00:16 特写：老周抬头，视线落在表盘裂纹上，眉头动了一下。音效：咖啡机蒸汽声
00:16-00:24 双人中景：老周把放大镜推到眼前，阿宁屏住呼吸看他的手。台词：老周：能修。就是得等。`;

export default function ShortPromptPage() {
  const router = useRouter();
  const cfg = useDramaConfig();
  const inFlight = React.useRef(false);

  const [prompt, setPrompt] = React.useState("");
  const [parsing, setParsing] = React.useState(false);
  const [parsed, setParsed] = React.useState<ParsedShortPrompt | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [starting, setStarting] = React.useState(false);
  const [bibleOpen, setBibleOpen] = React.useState(true);
  const topRef = React.useRef<HTMLDivElement>(null);

  const chars = prompt.trim().length;
  // 可用分镜 = 至少有画面或台词的镜头。全清空的分镜表不能开始制作（否则白付一笔开拍费）。
  const usableShots = (parsed?.shots ?? []).filter((s) => s.visual.trim() || s.voText.trim()).length;
  const tooLong = chars > MAX_PROMPT_CHARS;
  const canParse = chars >= MIN_PROMPT_CHARS && !tooLong && !parsing;
  const entryCost = cfg.prices.shortEntry;
  const totalSec = parsed ? parsedTotalSec(parsed) : 0;

  const runParse = async () => {
    if (!canParse) {
      if (chars > 0 && chars < MIN_PROMPT_CHARS) {
        setError(`提示词太短，拆不出分镜：至少写清画面、人物或台词（${MIN_PROMPT_CHARS} 字以上）。`);
      }
      return;
    }
    setParsing(true);
    setError(null);
    try {
      const result = await ShortsApi.parsePrompt({ prompt: prompt.trim() });
      setParsed(result);
      topRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      toast.success(`已拆成 ${result.shotCount} 镜，核对无误就可以开始制作`);
    } catch (e) {
      setError(aiErrorMessage(e, "提示词拆解失败，请稍后重试"));
    } finally {
      setParsing(false);
    }
  };

  /** 开始制作：确认费用 → 建草稿（后端按 seed 落人物卡 / 场景 / 分镜）→ 进工作台。 */
  const start = async () => {
    if (!parsed || inFlight.current) return;
    if (entryCost >= cfg.confirmThreshold) {
      const ok = await dramaConfirm({
        cost: entryCost,
        title: "开始制作这条短视频",
        body: `按拆解结果建一条草稿（${usableShots} 镜 · 约 ${totalSec} 秒），进工作台后可以继续改分镜、逐镜出片。`,
        confirmLabel: "确认开始",
      });
      if (!ok) return;
    }
    inFlight.current = true;
    setStarting(true);
    try {
      const detail = await ShortsApi.createDraft({
        seed: { ...parsed, promptSource: { raw: prompt.trim() } },
      });
      invalidate("/me/drama/shorts");
      router.push(`/shorts/make?draft=${encodeURIComponent(detail.meta.id)}`);
      // 成功即导航离开，保持 inFlight=true，避免离开过程中重复提交。
    } catch (e) {
      inFlight.current = false;
      setStarting(false);
      toast.error(aiErrorMessage(e, "建草稿失败，请重试"));
    }
  };

  const patchShot = (index: number, patch: Partial<ParsedShortShot>) => {
    setParsed((prev) =>
      prev ? { ...prev, shots: prev.shots.map((s, i) => (i === index ? { ...s, ...patch } : s)) } : prev,
    );
  };
  const removeShot = (index: number) => {
    setParsed((prev) =>
      prev ? { ...prev, shots: prev.shots.filter((_, i) => i !== index).map((s, i) => ({ ...s, no: i + 1 })) } : prev,
    );
  };
  const addShot = () => {
    setParsed((prev) =>
      prev && prev.shots.length < PROMPT_MAX_SHOTS
        ? {
            ...prev,
            shots: [
              ...prev.shots,
              {
                no: prev.shots.length + 1, timecode: "", durationSec: 4, sceneName: prev.scenes[0]?.name ?? "",
                castNames: [], beat: "", visual: "", size: "中景", move: "固定",
                voWho: "", voText: "", sfx: "", bgm: "", fx: "",
              },
            ],
          }
        : prev,
    );
  };

  return (
    <div style={{ maxWidth: 1040, margin: "0 auto", paddingBottom: parsed ? 96 : 32 }}>
      <div ref={topRef} />
      <div className="row gap-2" style={{ marginBottom: 12 }}>
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => router.push("/shorts")}>
          <ChevronLeft size={15} /> 返回短视频工坊
        </button>
        <span className="grow" />
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => router.push("/shorts/new")}>
          <Sparkles size={14} /> 没写好提示词？让 AI 帮你出
        </button>
      </div>

      {/* ── 输入区（拆解后收起为一行摘要，随时点开改原文重拆） ── */}
      {!parsed ? (
        <PromptInputCard
          prompt={prompt}
          onChange={(v) => {
            setPrompt(v);
            setError(null);
          }}
          chars={chars}
          tooLong={tooLong}
          canParse={canParse}
          parsing={parsing}
          error={error}
          entryCost={entryCost}
          onSample={() => {
            setPrompt(SAMPLE_PROMPT);
            setError(null);
          }}
          onParse={() => void runParse()}
        />
      ) : (
        <div className="card row gap-3" style={{ padding: "12px 16px", marginBottom: 14, alignItems: "center", flexWrap: "wrap" }}>
          <ClipboardPaste size={16} style={{ color: "var(--accent)", flex: "none" }} />
          <span style={{ fontWeight: 700, fontSize: 13.5, flex: "none" }}>已按你的提示词拆解</span>
          <span
            className="faint"
            style={{ fontSize: 12, flex: 1, minWidth: 120, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
            title={prompt}
          >
            {prompt.slice(0, 120)}
          </span>
          <span className="tag tag-accent" style={{ flex: "none" }}>{parsed.shots.length} 镜 · 约 {totalSec} 秒</span>
          <button type="button" className="chip" style={{ flex: "none" }} disabled={parsing} onClick={() => setParsed(null)}>
            <RefreshCw size={12} /> 改原文重拆
          </button>
        </div>
      )}

      {parsed && (
        <>
          {/* 拆解说明：截断 / 收口 / 未拆解等处理如实告知，不藏 */}
          {parsed.notes.length > 0 && (
            <div className="card col gap-1" style={{ padding: "12px 16px", marginBottom: 14, borderLeft: "3px solid var(--accent)" }}>
              <div className="row gap-2" style={{ alignItems: "center" }}>
                <Info size={14} style={{ color: "var(--accent)" }} />
                <span style={{ fontWeight: 700, fontSize: 12.5 }}>拆解说明</span>
              </div>
              {parsed.notes.map((n, i) => (
                <div key={i} className="muted" style={{ fontSize: 12, lineHeight: 1.7 }}>· {n}</div>
              ))}
            </div>
          )}

          {/* 作品信息 + 视觉设定（人物卡 / 场景 / 全片基调）—— 这里的字直接进逐镜出图与出片提示词 */}
          <div className="card col" style={{ padding: 0, overflow: "hidden", marginBottom: 16 }}>
            <div className="row gap-3" style={{ padding: "13px 18px", borderBottom: "1px solid var(--line-soft)" }}>
              <ScrollText size={17} style={{ color: "var(--accent)", flex: "none" }} />
              <span style={{ fontWeight: 800, fontSize: 14, flex: "none" }}>作品信息</span>
              <span className="faint" style={{ fontSize: 11, flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                标题与设定都可以直接改，改完再开始制作
              </span>
            </div>
            <div className="col gap-4" style={{ padding: 20 }}>
              <div className="col gap-2">
                <span style={LABEL}>标题</span>
                <input
                  value={parsed.title}
                  onChange={(e) => setParsed({ ...parsed, title: e.target.value })}
                  placeholder="给这条短视频起个标题"
                  style={{ ...INPUT, fontSize: 20, fontWeight: 800, letterSpacing: "-.01em" }}
                />
              </div>
              <div className="col gap-2">
                <span style={LABEL}>一句话说明</span>
                <textarea
                  value={parsed.logline}
                  onChange={(e) => setParsed({ ...parsed, logline: e.target.value })}
                  placeholder="这条片子讲什么"
                  rows={2}
                  style={{ ...INPUT, resize: "vertical", lineHeight: 1.7 }}
                />
              </div>
              {parsed.style.length > 0 && (
                <div className="row gap-2" style={{ flexWrap: "wrap", alignItems: "center" }}>
                  <span style={LABEL}>风格</span>
                  {parsed.style.map((s) => (
                    <span key={s} className="tag tag-accent" style={{ flex: "none", maxWidth: 160, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={s}>
                      {s}
                    </span>
                  ))}
                </div>
              )}

              <div style={{ height: 1, background: "var(--line-soft)" }} />

              <button
                type="button"
                className="row gap-2"
                onClick={() => setBibleOpen((v) => !v)}
                aria-expanded={bibleOpen}
                style={{ alignItems: "center", background: "none", border: "none", padding: 0, cursor: "pointer", width: "100%", textAlign: "left" }}
              >
                <Users size={15} style={{ color: "var(--accent)", flex: "none" }} />
                <span style={{ fontWeight: 700, fontSize: 13 }}>视觉设定</span>
                <span className="faint" style={{ fontSize: 11 }}>
                  {parsed.characters.length} 位角色 · {parsed.scenes.length} 个场景 · 每镜出图都按这里锁外观
                </span>
                <span className="grow" />
                <ChevronDown size={15} style={{ color: "var(--ink-3)", flex: "none", transform: bibleOpen ? "rotate(180deg)" : "none", transition: "transform .15s" }} />
              </button>

              {bibleOpen && (
                <div className="col gap-3">
                  {parsed.characters.length === 0 && parsed.scenes.length === 0 && (
                    <div className="muted" style={{ fontSize: 12.5, lineHeight: 1.7 }}>
                      这段提示词里没认出独立的人物或场景设定。回到上一步，把人物外貌、服装、道具单独写一段（例如「【角色】阿宁：齐耳短发…」），出图的人物长相就不容易跑。
                    </div>
                  )}
                  {parsed.characters.map((c, i) => (
                    <div key={i} className="col gap-2" style={CARD_INSET}>
                      <div className="row gap-2" style={{ alignItems: "center" }}>
                        <span style={AVATAR_DOT}>{(c.name || "角").slice(0, 1)}</span>
                        <input
                          value={c.name}
                          onChange={(e) =>
                            setParsed({
                              ...parsed,
                              characters: parsed.characters.map((x, xi) => (xi === i ? { ...x, name: e.target.value } : x)),
                            })
                          }
                          placeholder="角色名"
                          style={{ ...INPUT, border: "none", background: "transparent", fontWeight: 700, fontSize: 13.5, padding: 0 }}
                        />
                      </div>
                      <LabeledText
                        label="外观（进画面）"
                        hint="脸型 / 发型 / 服装 / 道具 / 配色；不要写台词与性格"
                        value={c.visual}
                        onChange={(v) =>
                          setParsed({
                            ...parsed,
                            characters: parsed.characters.map((x, xi) => (xi === i ? { ...x, visual: v } : x)),
                          })
                        }
                      />
                      <LabeledText
                        label="表演（不进画面）"
                        hint="性格 / 情绪 / 表演方式；只用于配音和表演，不进画面"
                        value={c.performance}
                        onChange={(v) =>
                          setParsed({
                            ...parsed,
                            characters: parsed.characters.map((x, xi) => (xi === i ? { ...x, performance: v } : x)),
                          })
                        }
                      />
                    </div>
                  ))}
                  {parsed.scenes.map((s, i) => (
                    <div key={i} className="col gap-2" style={CARD_INSET}>
                      <div className="row gap-2" style={{ alignItems: "center" }}>
                        <span className="tag tag-gray" style={{ flex: "none" }}>场景</span>
                        <input
                          value={s.name}
                          onChange={(e) =>
                            setParsed({ ...parsed, scenes: parsed.scenes.map((x, xi) => (xi === i ? { ...x, name: e.target.value } : x)) })
                          }
                          placeholder="场景名"
                          style={{ ...INPUT, border: "none", background: "transparent", fontWeight: 700, fontSize: 13.5, padding: 0 }}
                        />
                      </div>
                      <LabeledText
                        label="环境与光影"
                        hint="环境 / 光线 / 色调 / 空气感；不写人物"
                        value={s.visual}
                        onChange={(v) =>
                          setParsed({ ...parsed, scenes: parsed.scenes.map((x, xi) => (xi === i ? { ...x, visual: v } : x)) })
                        }
                      />
                    </div>
                  ))}
                  <div className="col gap-2" style={CARD_INSET}>
                    <LabeledText
                      label="全片画面基调"
                      hint="镜头语言 / 质感 / 整体调色；每一镜出图都会带上"
                      value={parsed.universalPrompt}
                      onChange={(v) => setParsed({ ...parsed, universalPrompt: v })}
                    />
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* 分镜表 */}
          <div className="row gap-2" style={{ marginBottom: 12, alignItems: "center", flexWrap: "wrap" }}>
            <Clapperboard size={16} style={{ color: "var(--accent)" }} />
            <span style={{ fontWeight: 800, fontSize: 16 }}>分镜表</span>
            <span className="tag tag-accent" style={{ flex: "none" }}>共 {parsed.shots.length} 镜 · 约 {totalSec} 秒</span>
            <span className="grow" />
            <span className="faint" style={{ fontSize: 11.5 }}>单镜 {PROMPT_SHOT_MIN_SEC}-{PROMPT_SHOT_MAX_SEC} 秒 · 文字点一下就能改</span>
          </div>
          <ShotPreviewTable
            shots={parsed.shots}
            characters={parsed.characters.map((c) => c.name).filter(Boolean)}
            onPatch={patchShot}
            onRemove={removeShot}
          />
          <div className="row gap-2" style={{ marginTop: 12, alignItems: "center", flexWrap: "wrap" }}>
            <button
              type="button"
              className="btn btn-line btn-sm"
              onClick={addShot}
              disabled={parsed.shots.length >= PROMPT_MAX_SHOTS}
              title={parsed.shots.length >= PROMPT_MAX_SHOTS ? `一条短视频最多 ${PROMPT_MAX_SHOTS} 镜` : undefined}
            >
              <Plus size={14} /> 加一镜
            </button>
            {parsed.shots.length >= PROMPT_MAX_SHOTS && (
              <span className="faint" style={{ fontSize: 11.5 }}>
                已到单条上限 {PROMPT_MAX_SHOTS} 镜，再多的内容建议拆成另一条短视频。
              </span>
            )}
          </div>

          {/* 悬浮 CTA */}
          <div className="row gap-2 pop-in" style={FLOATING_CTA}>
            <span className="faint" style={{ fontSize: 11.5, maxWidth: 240, lineHeight: 1.5 }}>
              {usableShots === 0
                ? "分镜都空着：至少给一镜填上画面或台词才能开始制作"
                : "先建一条草稿进工作台，之后逐镜出片按镜计费"}
            </span>
            <button
              type="button"
              className="btn btn-grad"
              disabled={starting || usableShots === 0}
              aria-busy={starting}
              title={usableShots === 0 ? "至少给一镜填上画面或台词" : undefined}
              onClick={() => void start()}
            >
              {starting ? <Loader2 size={15} className="spin" /> : <Zap size={15} />}
              {starting ? "正在建草稿…" : "开始制作"}
              <CreditMark tone="inherit" size={15} />
            </button>
          </div>
        </>
      )}
    </div>
  );
}

/** 输入卡：粘贴提示词 + 写法提示 + 免费拆解。 */
function PromptInputCard({
  prompt,
  onChange,
  chars,
  tooLong,
  canParse,
  parsing,
  error,
  entryCost,
  onSample,
  onParse,
}: {
  prompt: string;
  onChange: (v: string) => void;
  chars: number;
  tooLong: boolean;
  canParse: boolean;
  parsing: boolean;
  error: string | null;
  entryCost: number;
  onSample: () => void;
  onParse: () => void;
}) {
  return (
    <>
      <div style={{ textAlign: "center", padding: "6px 20px 18px" }}>
        <div className="faint" style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>提示词直出</div>
        <h1 style={{ margin: 0, fontSize: 28, fontWeight: 800, letterSpacing: "-.02em", lineHeight: 1.3 }}>
          把你写好的提示词，直接拆成
          <span style={{ background: "linear-gradient(120deg,var(--accent),var(--accent-2))", WebkitBackgroundClip: "text", backgroundClip: "text", color: "transparent" }}>
            分镜开拍
          </span>
        </h1>
        <div className="muted" style={{ marginTop: 8, fontSize: 14, lineHeight: 1.7 }}>
          粘贴原文，AI 按你的写法拆出人物卡、场景、画面基调和逐镜脚本。
          <strong style={{ color: "var(--ink-2)" }}>拆解免费</strong>，核对无误再开始制作。
        </div>
      </div>

      <div className="card col" style={{ padding: 0, overflow: "hidden" }}>
        <textarea
          value={prompt}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
              e.preventDefault();
              onParse();
            }
          }}
          placeholder={
            "把你的提示词整段粘进来。写法不限，下面这样最稳：\n" +
            "【角色】名字：脸型 / 发型 / 服装 / 道具（外貌单独写一段，出图更准）\n" +
            "【场景】地点 + 光线 + 色调\n" +
            "【全片基调】镜头语言 / 质感 / 调色\n" +
            "【分镜】00:00-00:04 远景推近：画面内容。台词：…"
          }
          rows={16}
          style={{
            width: "100%",
            border: "none",
            outline: "none",
            resize: "vertical",
            padding: "18px 20px",
            fontSize: 14,
            lineHeight: 1.85,
            fontFamily: "inherit",
            background: "transparent",
            color: "var(--ink)",
            minHeight: 300,
          }}
        />
        <div className="row gap-2" style={{ padding: "10px 16px 14px", borderTop: "1px solid var(--line-soft)", flexWrap: "wrap", alignItems: "center" }}>
          <button type="button" className="chip" onClick={onSample}>
            <ClipboardPaste size={13} /> 看看示例
          </button>
          {prompt.length > 0 && (
            <button type="button" className="chip" onClick={() => onChange("")}>
              清空
            </button>
          )}
          <span className="faint num" style={{ fontSize: 11.5, color: tooLong ? "var(--danger)" : undefined }}>
            {chars} / {MAX_PROMPT_CHARS} 字
          </span>
          <span className="grow" />
          <span className="faint" style={{ fontSize: 11.5 }}>拆解免费 · 开始制作扣 {entryCost} 积分</span>
          <button
            type="button"
            className="btn btn-grad"
            style={{ height: 40, padding: "0 20px", flex: "none", opacity: canParse ? 1 : 0.5, cursor: canParse ? "pointer" : "not-allowed" }}
            disabled={!canParse}
            aria-busy={parsing}
            onClick={onParse}
          >
            {parsing ? <Loader2 size={16} className="spin" /> : <Sparkles size={16} />}
            {parsing ? "正在拆解…" : "开始拆解"}
          </button>
        </div>
      </div>

      {error && (
        <div className="card row gap-2" role="alert" style={{ padding: "12px 16px", marginTop: 12, color: "var(--danger)", fontSize: 13, lineHeight: 1.6 }}>
          <AlertTriangle size={15} style={{ flex: "none", marginTop: 2 }} />
          <span style={{ overflowWrap: "anywhere" }}>{error}</span>
        </div>
      )}
      {tooLong && !error && (
        <div className="card row gap-2" style={{ padding: "12px 16px", marginTop: 12, color: "var(--danger)", fontSize: 13 }}>
          <AlertTriangle size={15} style={{ flex: "none" }} />
          <span>超过单次上限 {MAX_PROMPT_CHARS} 字，建议拆成多条短视频分别制作。</span>
        </div>
      )}

      <div className="card col gap-2" style={{ padding: "14px 18px", marginTop: 14 }}>
        <div className="row gap-2" style={{ alignItems: "center" }}>
          <Info size={14} style={{ color: "var(--accent)" }} />
          <span style={{ fontWeight: 700, fontSize: 12.5 }}>怎么写拆得更准</span>
        </div>
        {[
          "带时间码（如 01:08-01:43）就按时间码算每镜时长；没有时间码会按台词长度和画面复杂度估。",
          "人物外貌单独写一段，性格、口头禅和台词分开写：只有外貌会进每镜画面，混在一起每镜都会被带偏。",
          `单镜最长 ${PROMPT_SHOT_MAX_SEC} 秒，超过会按语义拆成多镜；整条超过 40 镜的部分不会拆解，建议分成多条制作。`,
        ].map((t) => (
          <div key={t} className="muted" style={{ fontSize: 12.5, lineHeight: 1.75 }}>· {t}</div>
        ))}
      </div>
    </>
  );
}

/** 拆解结果分镜表（预览 + 就地修改；此处还没有出片动作，故不带渲染按钮）。 */
function ShotPreviewTable({
  shots,
  characters,
  onPatch,
  onRemove,
}: {
  shots: ParsedShortShot[];
  characters: string[];
  onPatch: (index: number, patch: Partial<ParsedShortShot>) => void;
  onRemove: (index: number) => void;
}) {
  if (!shots.length) {
    return (
      <div className="card col center" style={{ padding: "36px 20px", textAlign: "center", gap: 10 }}>
        <Clapperboard size={22} style={{ color: "var(--ink-3)" }} />
        <div className="muted" style={{ fontSize: 13 }}>还没有分镜，点「加一镜」自己补，或回到上一步改原文重拆。</div>
      </div>
    );
  }
  let acc = 0;
  const starts = shots.map((s) => {
    const start = acc;
    acc += s.durationSec || 0;
    return start;
  });
  return (
    <div className="card" style={{ padding: 0, overflow: "hidden" }}>
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", minWidth: 880, borderCollapse: "collapse", fontSize: 13, tableLayout: "fixed" }}>
          <thead>
            <tr style={{ background: "var(--surface)" }}>
              <th style={{ ...TH, width: 104, textAlign: "center" }}>镜 · 时长</th>
              <th style={{ ...TH, width: 300 }}>画面内容</th>
              <th style={{ ...TH, width: 240 }}>台词 · 出场人物</th>
              <th style={{ ...TH, width: 110 }}>镜头</th>
              <th style={{ ...TH, width: 150 }}>音效 · BGM · 特效</th>
              <th style={{ ...TH, width: 44 }} aria-label="操作" />
            </tr>
          </thead>
          <tbody>
            {shots.map((s, i) => (
              <tr key={i}>
                <td style={{ ...TD, textAlign: "center" }}>
                  <div className="col gap-1" style={{ alignItems: "center" }}>
                    {s.beat && (
                      <span className="tag tag-accent" style={{ maxWidth: 88, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={s.beat}>
                        {s.beat}
                      </span>
                    )}
                    <span style={{ fontWeight: 800 }}>镜 {i + 1}</span>
                    <span className="faint num" style={{ fontSize: 11 }}>{fmtClock(starts[i])} 起</span>
                    <span className="row gap-1" style={{ alignItems: "center", justifyContent: "center" }}>
                      <input
                        type="number"
                        min={PROMPT_SHOT_MIN_SEC}
                        max={PROMPT_SHOT_MAX_SEC}
                        value={s.durationSec}
                        aria-label={`镜 ${i + 1} 时长（秒）`}
                        onChange={(e) => {
                          const raw = Number(e.target.value);
                          const next = Number.isFinite(raw)
                            ? Math.min(PROMPT_SHOT_MAX_SEC, Math.max(PROMPT_SHOT_MIN_SEC, Math.round(raw)))
                            : PROMPT_SHOT_MIN_SEC;
                          onPatch(i, { durationSec: next });
                        }}
                        style={{ width: 52, ...INPUT, textAlign: "center", padding: "2px 4px", fontSize: 12 }}
                      />
                      <span className="faint" style={{ fontSize: 11 }}>秒</span>
                    </span>
                    {s.timecode && (
                      <span className="faint num" style={{ fontSize: 10.5, maxWidth: 92, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={`原提示词时间码 ${s.timecode}`}>
                        原 {s.timecode}
                      </span>
                    )}
                  </div>
                </td>
                <td style={TD}>
                  <Editable block value={s.visual} placeholder="这一镜要拍什么" onCommit={(v) => onPatch(i, { visual: v })} style={{ lineHeight: 1.7 }} />
                  {s.sceneName && (
                    <div className="faint" style={{ fontSize: 11, marginTop: 4, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={`场景：${s.sceneName}`}>
                      场景 · {s.sceneName}
                    </div>
                  )}
                </td>
                <td style={TD}>
                  <div className="col gap-2">
                    <div className="row gap-1" style={{ alignItems: "baseline" }}>
                      <span className="faint" style={{ fontSize: 11, flex: "none" }}>{s.voWho || "旁白"}</span>
                      <Editable block value={s.voText} placeholder="这一镜要念的台词（可留空）" onCommit={(v) => onPatch(i, { voText: v })} style={{ lineHeight: 1.7 }} />
                    </div>
                    {characters.length > 0 && (
                      <div className="row gap-1" style={{ flexWrap: "wrap", alignItems: "center" }}>
                        {!s.castNames && (
                          <span
                            className="faint"
                            style={{ fontSize: 10.5, flex: "none" }}
                            title="拆解没标出这一镜有谁，出图会把所有角色都带上。点人物名可以指定。"
                          >
                            未标注
                          </span>
                        )}
                        {characters.map((name) => {
                          // 未标注（字段缺失）时视觉上按全员亮起 —— 与出图时的实际行为一致，不骗人。
                          const on = s.castNames ? s.castNames.includes(name) : true;
                          return (
                            <button
                              key={name}
                              type="button"
                              className="chip"
                              aria-pressed={on}
                              title={
                                on
                                  ? `${name} 出现在这一镜（点一下移出）`
                                  : `${name} 不在这一镜（点一下加入）`
                              }
                              onClick={() => {
                                // 未标注时先落成「全员」这一显式事实，再按点击增删，避免语义含糊。
                                const base = s.castNames ?? characters;
                                onPatch(i, {
                                  castNames: on ? base.filter((n) => n !== name) : [...base, name],
                                });
                              }}
                              style={{
                                height: 22,
                                fontSize: 11,
                                padding: "0 8px",
                                maxWidth: 100,
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                                whiteSpace: "nowrap",
                                background: on ? "var(--accent-soft)" : undefined,
                                color: on ? "var(--accent)" : "var(--ink-3)",
                                opacity: on ? 1 : 0.7,
                              }}
                            >
                              {name}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </td>
                <td style={TD}>
                  <div className="col gap-1">
                    <Editable value={s.size} placeholder="景别" onCommit={(v) => onPatch(i, { size: v })} />
                    <Editable value={s.move} placeholder="运镜" onCommit={(v) => onPatch(i, { move: v })} />
                  </div>
                </td>
                <td style={TD}>
                  <div className="col gap-1" style={{ fontSize: 12 }}>
                    <Editable block value={s.sfx} placeholder="音效（可留空）" onCommit={(v) => onPatch(i, { sfx: v })} />
                    <Editable block value={s.bgm} placeholder="BGM（可留空）" onCommit={(v) => onPatch(i, { bgm: v })} />
                    <Editable block value={s.fx} placeholder="特效氛围（可留空）" onCommit={(v) => onPatch(i, { fx: v })} />
                  </div>
                </td>
                <td style={{ ...TD, textAlign: "center" }}>
                  <button
                    type="button"
                    className="btn btn-icon btn-sm"
                    title={`删除镜 ${i + 1}`}
                    aria-label={`删除镜 ${i + 1}`}
                    onClick={() => onRemove(i)}
                    style={{ color: "var(--danger)" }}
                  >
                    <Trash2 size={14} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/** 带说明的多行字段（视觉设定里反复用到）。 */
function LabeledText({
  label,
  hint,
  value,
  onChange,
}: {
  label: string;
  hint: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="col gap-1">
      <div className="row gap-2" style={{ alignItems: "baseline", flexWrap: "wrap" }}>
        <span style={LABEL}>{label}</span>
        <span className="faint" style={{ fontSize: 11, flex: 1, minWidth: 0 }}>{hint}</span>
      </div>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={2}
        style={{ ...INPUT, resize: "vertical", fontSize: 12.5, lineHeight: 1.75 }}
      />
    </div>
  );
}

function fmtClock(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = Math.round(sec % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

const LABEL: React.CSSProperties = { fontSize: 11, fontWeight: 700, letterSpacing: ".06em", color: "var(--ink-3)", flex: "none" };
const INPUT: React.CSSProperties = {
  width: "100%",
  border: "1px solid var(--line)",
  borderRadius: 10,
  padding: "8px 10px",
  fontSize: 13.5,
  fontFamily: "inherit",
  color: "var(--ink)",
  background: "var(--surface-2)",
  outline: "none",
};
const CARD_INSET: React.CSSProperties = {
  padding: "12px 14px",
  borderRadius: 12,
  background: "var(--surface-2)",
  boxShadow: "inset 0 0 0 1px var(--line-soft)",
};
const AVATAR_DOT: React.CSSProperties = {
  width: 28,
  height: 28,
  borderRadius: "50%",
  background: "linear-gradient(135deg, color-mix(in oklch, var(--accent) 18%, #fff), color-mix(in oklch, var(--accent-2) 18%, #fff))",
  boxShadow: "inset 0 0 0 1px var(--line)",
  display: "grid",
  placeItems: "center",
  fontSize: 12,
  fontWeight: 800,
  color: "var(--accent-2)",
  flex: "none",
};
const TH: React.CSSProperties = {
  padding: "11px 12px",
  textAlign: "left",
  fontSize: 11,
  fontWeight: 700,
  color: "var(--ink-3)",
  letterSpacing: ".04em",
  borderBottom: "2px solid var(--line)",
  whiteSpace: "nowrap",
};
const TD: React.CSSProperties = { padding: "12px 12px", verticalAlign: "top", borderBottom: "1px solid var(--line-soft)" };
const FLOATING_CTA: React.CSSProperties = {
  position: "fixed",
  right: "max(12px, env(safe-area-inset-right))",
  bottom: "calc(22px + env(safe-area-inset-bottom))",
  zIndex: 80,
  background: "var(--surface)",
  padding: 10,
  borderRadius: 16,
  boxShadow: "var(--shadow-lg)",
  border: "1px solid var(--line-soft)",
  maxWidth: "calc(100vw - 24px)",
  flexWrap: "wrap",
  alignItems: "center",
};
