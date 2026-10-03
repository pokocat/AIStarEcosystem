"use client";

export const dynamic = "force-dynamic";

// 短视频「粘贴写好的脚本」（v0.143 起；v0.197 前叫「提示词直出」）—— 与「从一句话开始」并列的第二条入口。
// 已经写好脚本 / 分镜稿 / AI 视频提示词的用户不必再跟 AI 聊一遍：粘贴原文 → 免费拆解成人物卡 / 场景 /
// 全片画面基调 / 逐镜分镜 → 就地核对与修改 → 开始制作（扣一笔开拍费）→ 进制作页逐镜出片。
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
  Scissors,
  ScrollText,
  Sparkles,
  Trash2,
  Users,
  Zap,
} from "lucide-react";
import { CreditMark, Editable, dramaConfirm } from "@/components/drama-ui";
import { ShortsApi } from "@/api";
import { newClientRequestId } from "@/api/shorts";
import type { ParsedShortPrompt, ParsedShortShot } from "@/api/shorts";
import {
  PROMPT_MAX_SHOTS,
  PROMPT_SHOT_MAX_SEC,
  PROMPT_SHOT_MIN_SEC,
  cutPromptTail,
  parsedTotalSec,
} from "@/lib/short-prompt-draft";
import { aiErrorMessage } from "@/lib/ai-error";
import { useDramaConfig } from "@/lib/use-drama-config";
import { invalidate } from "@/lib/drama-query";
import { notifyWalletChanged } from "@/lib/use-wallet";
import { confirmShortStart } from "@/components/drama-workshop/short-start-confirm";

/** 与后端 DramaShortPromptService 的输入上限一致（超出直接挡回，不静默截断用户设定）。 */
const MAX_PROMPT_CHARS = 20_000;
const MIN_PROMPT_CHARS = 20;
/** 与后端 DramaShortPromptService.RATE_LIMIT_MAX / RATE_LIMIT_WINDOW 一致：拆解不扣积分，但按账号限频。 */
const PARSE_RATE_LIMIT = "5 分钟内最多拆 10 次";

/**
 * 「剩下的部分另开一页拆」：把剩下的原文交给新标签页。
 * 用 localStorage + 一次性 token（URL 里只带 token，不带用户原文）；新页读到就删。
 * 不用 sessionStorage：noopener 打开的新标签页不继承它。
 */
const TAIL_KEY_PREFIX = "drama.shorts.promptTail.";

/** 「填入示例」用的样例原文 —— 演示最稳的写法：标题 / 一句话 / 人物 / 场景 / 画风 / 带时间码的分镜。 */
const SAMPLE_PROMPT = `【标题】修表
【一句话】搬来第七天的女孩，把一块旧表交给了楼下的修表匠。
【角色】阿宁：二十五岁女生，齐耳短发，米白针织开衫配牛仔背带裤，左手戴一只旧机械表；性格慢热，开口前习惯先笑一下。
【角色】修表匠老周：六十岁上下，花白短发，深灰工装围裙，右眼架着单目放大镜；话少，手很稳。
【场景】老城区二楼咖啡馆，木质吧台与斑驳白墙，午后逆光，空气里有细小浮尘；暖黄与青灰对比。
【整体画风】电影感竖屏，自然光为主，轻微手持晃动，浅景深，胶片颗粒。
【分镜】
00:00-00:04 远景推近：阿宁抱着纸箱推门进来，门口风铃轻响。台词：旁白：搬来第七天，她还没敢开口。
00:04-00:10 中近景：她把旧机械表摘下放在吧台上，指尖在表盘上停了一秒。台词：阿宁：这块表……还能修吗？
00:10-00:16 特写：老周抬头，视线落在表盘裂纹上，眉头动了一下。音效：咖啡机蒸汽声
00:16-00:24 双人中景：老周把放大镜推到眼前，阿宁屏住呼吸看他的手。台词：老周：能修。就是得等。`;

export default function ShortPromptPage() {
  const router = useRouter();
  const cfg = useDramaConfig();
  const inFlight = React.useRef(false);
  // 幂等键：同一份拆解结果的多次「开始制作」（含失败重试）共用一个，避免重复扣开拍费。
  const requestIdRef = React.useRef<string | null>(null);

  const [prompt, setPrompt] = React.useState("");
  const [parsing, setParsing] = React.useState(false);
  // 拆解实测 30-90 秒（长提示词更久）。只给按钮转圈用户会以为卡死，所以显式报时 + 可取消。
  const [elapsed, setElapsed] = React.useState(0);
  const abortRef = React.useRef<AbortController | null>(null);
  const [parsed, setParsed] = React.useState<ParsedShortPrompt | null>(null);
  // 拆解刚返回时的那一份：parsed 与它不是同一个对象 = 用户在预览页改过（任何编辑都会生成新对象）。
  const parsedFromServerRef = React.useRef<ParsedShortPrompt | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [starting, setStarting] = React.useState(false);
  const [bibleOpen, setBibleOpen] = React.useState(true);
  const topRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (!parsing) return;
    setElapsed(0);
    const t = window.setInterval(() => setElapsed((v) => v + 1), 1000);
    return () => window.clearInterval(t);
  }, [parsing]);
  React.useEffect(() => () => abortRef.current?.abort(), []);

  // 从上一页「剩下的部分另开一页拆」过来：按 URL 里的 token 取出剩下的原文，取完就删。
  // ref 守门：开发模式 StrictMode 会把 effect 跑两遍，第二遍读到的已经是删掉的空值，会误报「没取到」。
  const tailReadRef = React.useRef(false);
  React.useEffect(() => {
    if (tailReadRef.current) return;
    tailReadRef.current = true;
    const token = new URLSearchParams(window.location.search).get("tail");
    if (!token) return;
    let tail: string | null = null;
    try {
      tail = localStorage.getItem(TAIL_KEY_PREFIX + token);
      localStorage.removeItem(TAIL_KEY_PREFIX + token);
    } catch {
      tail = null;
    }
    router.replace("/shorts/prompt");
    if (tail) {
      setPrompt(tail);
      toast.success("剩下的段落已经放进输入框，点「开始拆解」接着拆");
    } else {
      toast.error("没取到剩下的段落，请回上一页手动复制");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const chars = prompt.trim().length;
  // 可用分镜 = 至少有画面或台词的镜头。全清空的分镜表不能开始制作（否则白付一笔开拍费）。
  const usableShots = (parsed?.shots ?? []).filter((s) => s.visual.trim() || s.voText.trim()).length;
  const tooLong = chars > MAX_PROMPT_CHARS;
  const canParse = chars >= MIN_PROMPT_CHARS && !tooLong && !parsing;
  // 「开始拆解」变灰时就地说原因（手机上没有 hover，写在 title 里等于没写）。
  const parseBlockedReason = parsing
    ? null
    : chars === 0
      ? "先把原文粘进来"
      : chars < MIN_PROMPT_CHARS
        ? `至少写 ${MIN_PROMPT_CHARS} 个字`
        : tooLong
          ? `超过 ${MAX_PROMPT_CHARS} 字了`
          : null;
  const entryCost = cfg.prices.shortEntry;
  const totalSec = parsed ? parsedTotalSec(parsed) : 0;

  const runParse = async () => {
    if (!canParse) {
      if (chars > 0 && chars < MIN_PROMPT_CHARS) {
        setError(`内容太短，拆不出分镜。至少写 ${MIN_PROMPT_CHARS} 个字，把画面、人物或台词写清楚。`);
      }
      return;
    }
    setParsing(true);
    setError(null);
    const controller = new AbortController();
    abortRef.current = controller;
    try {
      const result = await ShortsApi.parsePrompt({ prompt: prompt.trim() }, controller.signal);
      if (controller.signal.aborted) return; // 已取消：结果不再落地（mock 分支不看 signal）
      setParsed(result);
      parsedFromServerRef.current = result;
      requestIdRef.current = null; // 新的一份拆解结果 = 新的创建意图
      topRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      toast.success(`拆成了 ${result.shotCount} 镜。看一遍，没问题就点「开始制作」`);
    } catch (e) {
      if (controller.signal.aborted) return; // 用户主动取消不是失败，不弹错
      setError(aiErrorMessage(e, "拆分镜失败，请稍后重试"));
    } finally {
      // 只收自己那一次的尾：取消后马上重试时，被取消的旧请求仍会走到这里
      // （mock 分支不消费 signal，900ms 后照样 resolve），不能把新请求的状态清掉。
      if (abortRef.current === controller) {
        abortRef.current = null;
        setParsing(false);
      }
    }
  };

  const cancelParse = () => {
    abortRef.current?.abort();
    abortRef.current = null;
    setParsing(false);
  };

  /** 用户在预览页改过拆解结果吗（改过的话，丢弃前必须先确认）。 */
  const isDirty = () => !!parsed && parsed !== parsedFromServerRef.current;

  /**
   * 剩下的部分另开一页拆（分卷）：命中 40 镜上限时，按最后一镜的时间码在原文里切一刀，
   * 把后半段交给新标签页接着拆。纯字符串定位用户自己的原文，不猜内容、不改内容。
   * **当前这页的拆解结果和用户的修改一律不动** —— 这 N 镜照常在这里「开始制作」。
   * 新标签页打不开（被拦截 / 存储不可用）时才退回「在本页替换」，而且先确认。
   */
  const continueTail = async () => {
    const tail = cutPromptTail(prompt, parsed?.truncatedAfterTimecode, parsed?.truncatedMidSegment);
    if (!tail) {
      toast.error("没找到这次拆到了原文的哪一行，请手动复制剩下的段落，另拆一条");
      return;
    }
    const token = newClientRequestId();
    let stored = false;
    try {
      localStorage.setItem(TAIL_KEY_PREFIX + token, tail);
      stored = true;
    } catch {
      stored = false;
    }
    if (stored) {
      const win = window.open(`/shorts/prompt?tail=${encodeURIComponent(token)}`, "_blank");
      if (win) {
        toast.success("剩下的段落在新标签页里接着拆；这一页的分镜照常可以开始制作");
        return;
      }
      try {
        localStorage.removeItem(TAIL_KEY_PREFIX + token);
      } catch {
        /* 清不掉也无妨：新页从没打开，这个 token 不会被读到 */
      }
    }
    const ok = await dramaConfirm({
      title: "在这一页接着拆剩下的部分？",
      body: `新标签页没能打开。继续的话，这里的 ${parsed?.shots.length ?? 0} 镜拆解结果${isDirty() ? "和你改过的内容" : ""}会被换掉。想先把这一条做出来，就取消，先点「开始制作」。`,
      tone: "danger",
      confirmLabel: "换成剩下的部分",
    });
    if (!ok) return;
    setPrompt(tail);
    setParsed(null);
    parsedFromServerRef.current = null;
    setError(null);
    topRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    toast.success("剩下的段落已经放进输入框，点「开始拆解」接着拆");
  };

  /** 回到输入态改原文：预览页改过的话先确认，不静默丢掉用户的修改。 */
  const backToEdit = async () => {
    if (isDirty()) {
      const ok = await dramaConfirm({
        title: "回去改原文？",
        body: "你在这里改过的标题、人物和分镜会丢掉。改完原文要重新拆一遍（拆解免费）。",
        tone: "danger",
        confirmLabel: "回去改原文",
      });
      if (!ok) return;
    }
    setParsed(null);
    parsedFromServerRef.current = null;
  };

  /** 填入示例：输入框里已经有内容时先确认，不静默覆盖用户粘贴的原文。 */
  const fillSample = async () => {
    if (prompt.trim() && prompt !== SAMPLE_PROMPT) {
      const ok = await dramaConfirm({
        title: "用示例替换现在的内容？",
        body: `输入框里的 ${chars} 个字会被示例换掉，换了就找不回来。`,
        tone: "danger",
        confirmLabel: "替换成示例",
      });
      if (!ok) return;
    }
    setPrompt(SAMPLE_PROMPT);
    setError(null);
  };

  /** 开始制作：确认费用 → 建草稿（后端按 seed 落人物卡 / 场景 / 分镜）→ 进工作台。 */
  const start = async () => {
    if (!parsed || inFlight.current) return;
    // 扣费确认全站只走 confirmShortStart（阈值、标题、计费说明、按钮都在那儿），这里只写前半句。
    const ok = await confirmShortStart(
      cfg,
      `用这份分镜建一条短视频草稿（${usableShots} 镜，约 ${totalSec} 秒），进去后还能接着改。`,
    );
    if (!ok) return;
    inFlight.current = true;
    setStarting(true);
    try {
      if (!requestIdRef.current) requestIdRef.current = newClientRequestId();
      const detail = await ShortsApi.createDraft({
        seed: { ...parsed, promptSource: { raw: prompt.trim() } },
        clientRequestId: requestIdRef.current,
      });
      invalidate("/me/drama/shorts");
      notifyWalletChanged(); // 建草稿这一步扣了开拍费
      router.push(`/shorts/make?draft=${encodeURIComponent(detail.meta.id)}`);
      // 成功即导航离开，保持 inFlight=true，避免离开过程中重复提交。
    } catch (e) {
      inFlight.current = false;
      setStarting(false);
      toast.error(aiErrorMessage(e, "建草稿失败，请重试"));
    }
  };

  /** 人物 / 场景增删：删角色同时清掉各镜对他的引用，删场景把引用它的镜头退回默认场景。 */
  const addCharacter = () => {
    setParsed((prev) =>
      prev ? { ...prev, characters: [...prev.characters, { name: "", visual: "", performance: "" }] } : prev,
    );
  };
  const removeCharacter = (index: number) => {
    setParsed((prev) => {
      if (!prev) return prev;
      const gone = prev.characters[index]?.name;
      return {
        ...prev,
        characters: prev.characters.filter((_, i) => i !== index),
        shots: gone
          ? prev.shots.map((sh) => (sh.castNames ? { ...sh, castNames: sh.castNames.filter((n) => n !== gone) } : sh))
          : prev.shots,
      };
    });
  };
  const addScene = () => {
    setParsed((prev) => (prev ? { ...prev, scenes: [...prev.scenes, { name: "", visual: "" }] } : prev));
  };
  const removeScene = (index: number) => {
    setParsed((prev) => {
      if (!prev) return prev;
      const gone = prev.scenes[index]?.name;
      return {
        ...prev,
        scenes: prev.scenes.filter((_, i) => i !== index),
        shots: gone ? prev.shots.map((sh) => (sh.sceneName === gone ? { ...sh, sceneName: "" } : sh)) : prev.shots,
      };
    });
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
    <div className={parsed ? "se-prompt-page has-cta" : "se-prompt-page"}>
      <div ref={topRef} />
      <div className="row gap-2 se-prompt-topbar">
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => router.push("/shorts")}>
          <ChevronLeft size={15} /> 返回我的短视频
        </button>
        <span className="grow" />
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => router.push("/shorts/new")}>
          <Sparkles size={14} /> 只有想法？从一句话开始
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
          elapsed={elapsed}
          onCancel={cancelParse}
          error={error}
          entryCost={entryCost}
          parseBlockedReason={parseBlockedReason}
          onSample={() => void fillSample()}
          onParse={() => void runParse()}
        />
      ) : (
        <div className="card row gap-3" style={{ padding: "12px 16px", marginBottom: 14, alignItems: "center", flexWrap: "wrap" }}>
          <ClipboardPaste size={16} style={{ color: "var(--accent)", flex: "none" }} />
          <span style={{ fontWeight: 700, fontSize: 13.5, flex: "none" }}>已拆成分镜</span>
          <span
            className="faint"
            style={{ fontSize: 12, flex: 1, minWidth: 120, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
            title={prompt}
          >
            {prompt.slice(0, 120)}
          </span>
          <span className="tag tag-accent" style={{ flex: "none" }}>{parsed.shots.length} 镜 · 约 {totalSec} 秒</span>
          <button type="button" className="chip" style={{ flex: "none" }} disabled={parsing} onClick={() => void backToEdit()}>
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
              {/* 命中 40 镜上限且原文有时间码 → 剩下的段落在新标签页里接着拆，这一页的结果不动 */}
              {!!parsed.truncatedAfterTimecode && (
                <div className="row gap-2" style={{ marginTop: 4, alignItems: "center", flexWrap: "wrap" }}>
                  <button type="button" className="btn btn-line btn-sm" onClick={() => void continueTail()}>
                    <Scissors size={13} /> 剩下的部分另开一页拆
                  </button>
                  <span className="faint" style={{ fontSize: 11.5 }}>
                    这 {parsed.shots.length} 镜照常在这里做成一条，剩下的段落在新标签页里接着拆
                  </span>
                </div>
              )}
            </div>
          )}

          {/* 作品信息 + 人物与画面设定（人物卡 / 场景 / 全片基调）—— 这里的字直接进逐镜出图与出片提示词 */}
          <div className="card col" style={{ padding: 0, overflow: "hidden", marginBottom: 16 }}>
            <div className="row gap-3" style={{ padding: "13px 18px", borderBottom: "1px solid var(--line-soft)" }}>
              <ScrollText size={17} style={{ color: "var(--accent)", flex: "none" }} />
              <span style={{ fontWeight: 800, fontSize: 14, flex: "none" }}>作品信息</span>
              <span
                className="faint"
                style={{ fontSize: 11, flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
                title="标题和下面的设定都能直接改"
              >
                标题和下面的设定都能直接改
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
                className="row gap-2 se-bible-toggle"
                onClick={() => setBibleOpen((v) => !v)}
                aria-expanded={bibleOpen}
                aria-label={bibleOpen ? "收起人物与画面设定" : "展开人物与画面设定"}
                style={{ alignItems: "center", background: "none", border: "none", padding: 0, cursor: "pointer", width: "100%", textAlign: "left" }}
              >
                <Users size={15} style={{ color: "var(--accent)", flex: "none" }} />
                <span className="se-bible-title" style={{ fontWeight: 700, fontSize: 13 }}>人物与画面设定</span>
                <span className="faint se-bible-hint">
                  {parsed.characters.length} 位角色 · {parsed.scenes.length} 个场景 · 每一镜出图都照这里画
                </span>
                <span className="grow" />
                <ChevronDown size={15} style={{ color: "var(--ink-3)", flex: "none", transform: bibleOpen ? "rotate(180deg)" : "none", transition: "transform .15s" }} />
              </button>

              {bibleOpen && (
                <div className="col gap-3">
                  {parsed.characters.length === 0 && parsed.scenes.length === 0 && (
                    <div className="muted" style={{ fontSize: 12.5, lineHeight: 1.7 }}>
                      原文里没找到单独写的人物或场景。可以点「改原文重拆」，把人物外貌、服装、道具单独写一段（例如「【角色】阿宁：齐耳短发…」），每一镜的人物长相会更稳；也可以直接在这里添加。
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
                        <button
                          type="button"
                          className="btn btn-icon btn-sm"
                          title={`删除角色${c.name ? `「${c.name}」` : ""}`}
                          aria-label={`删除角色${c.name ? `「${c.name}」` : ""}`}
                          onClick={() => removeCharacter(i)}
                          style={{ flex: "none", color: "var(--danger)" }}
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                      <LabeledText
                        label="外貌（出图用）"
                        hint="脸型、发型、服装、道具、配色。台词和性格别写在这里"
                        value={c.visual}
                        onChange={(v) =>
                          setParsed({
                            ...parsed,
                            characters: parsed.characters.map((x, xi) => (xi === i ? { ...x, visual: v } : x)),
                          })
                        }
                      />
                      <LabeledText
                        label="性格与表演（不影响画面）"
                        hint="性格、情绪、说话方式。配音和表演时参考，不影响画面"
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
                        <button
                          type="button"
                          className="btn btn-icon btn-sm"
                          title={`删除场景${s.name ? `「${s.name}」` : ""}`}
                          aria-label={`删除场景${s.name ? `「${s.name}」` : ""}`}
                          onClick={() => removeScene(i)}
                          style={{ flex: "none", color: "var(--danger)" }}
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                      <LabeledText
                        label="环境与光影"
                        hint="环境、光线、色调、空气感。不写人物"
                        value={s.visual}
                        onChange={(v) =>
                          setParsed({ ...parsed, scenes: parsed.scenes.map((x, xi) => (xi === i ? { ...x, visual: v } : x)) })
                        }
                      />
                    </div>
                  ))}
                  <div className="row gap-2" style={{ flexWrap: "wrap" }}>
                    <button type="button" className="btn btn-line btn-sm" onClick={addCharacter}>
                      <Plus size={13} /> 加一位角色
                    </button>
                    <button type="button" className="btn btn-line btn-sm" onClick={addScene}>
                      <Plus size={13} /> 加一个场景
                    </button>
                    <span className="faint" style={{ fontSize: 11, alignSelf: "center" }}>
                      没写外貌的角色，每一镜的长相可能不一样
                    </span>
                  </div>

                  <div className="col gap-2" style={CARD_INSET}>
                    <LabeledText
                      label="整体画风"
                      hint="镜头风格、质感、整体调色，每一镜出图都会用上"
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
            <span className="faint" style={{ fontSize: 11.5 }}>每镜 {PROMPT_SHOT_MIN_SEC}-{PROMPT_SHOT_MAX_SEC} 秒 · 文字点一下就能改</span>
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
                一条最多 {PROMPT_MAX_SHOTS} 镜，更多的内容请另做一条短视频。
              </span>
            )}
          </div>

          {/* 悬浮 CTA（≤720 贴底通栏，见 styles/pages/shorts-entry.css） */}
          <div className="se-cta pop-in">
            <span className="faint se-cta-note" style={usableShots === 0 ? { color: "var(--danger)" } : undefined}>
              {usableShots === 0
                ? "分镜都是空的，至少给一镜写上画面或台词"
                : `扣 ${entryCost} 积分建草稿，之后每一镜出首帧、生成视频另外计费`}
            </span>
            <button
              type="button"
              className="btn btn-grad"
              disabled={starting || usableShots === 0}
              aria-busy={starting}
              onClick={() => void start()}
            >
              {starting ? <Loader2 size={15} className="spin" /> : <Zap size={15} />}
              {starting ? "正在建草稿…" : "开始制作"}
              <CreditMark tone="inherit" size={15} label={entryCost} />
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
  elapsed,
  onCancel,
  error,
  entryCost,
  parseBlockedReason,
  onSample,
  onParse,
}: {
  prompt: string;
  onChange: (v: string) => void;
  chars: number;
  tooLong: boolean;
  canParse: boolean;
  parsing: boolean;
  /** 已等待秒数：拆解要 30-90 秒，必须让用户看到「在动」而不是以为卡死。 */
  elapsed: number;
  onCancel: () => void;
  error: string | null;
  entryCost: number;
  /** 「开始拆解」不能点时的原因，就地显示在字数旁边。 */
  parseBlockedReason: string | null;
  onSample: () => void;
  onParse: () => void;
}) {
  return (
    <>
      <div className="se-prompt-hero">
        <div className="faint" style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>粘贴写好的脚本</div>
        <h1 className="se-prompt-hero-title">
          把写好的脚本拆成
          <span style={{ background: "linear-gradient(120deg,var(--accent),var(--accent-2))", WebkitBackgroundClip: "text", backgroundClip: "text", color: "transparent" }}>
            分镜
          </span>
        </h1>
        <div className="muted se-prompt-hero-sub" style={{ marginTop: 8, fontSize: 14, lineHeight: 1.7 }}>
          脚本、分镜稿、AI 视频提示词都可以。AI 按原文拆出人物、场景、整体画风和每一镜的画面与台词。
          <strong style={{ color: "var(--ink-2)" }}>拆解免费</strong>，看过没问题再点「开始制作」。
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
          aria-label="原文"
          placeholder={
            "把写好的脚本、分镜稿或 AI 视频提示词整段粘进来。写法不限，按下面的格式拆得最准：\n" +
            "【角色】名字：脸型、发型、服装、道具（外貌单独写一段，出图更准）\n" +
            "【场景】地点、光线、色调\n" +
            "【整体画风】镜头风格、质感、调色\n" +
            "【分镜】00:00-00:04 远景推近：画面内容。台词：…"
          }
          rows={12}
          className="se-prompt-input"
        />
        <div className="row gap-2 se-prompt-actions">
          <button type="button" className="chip" onClick={onSample}>
            <ClipboardPaste size={13} /> 填入示例
          </button>
          {prompt.length > 0 && (
            <button type="button" className="chip" onClick={() => onChange("")}>
              清空
            </button>
          )}
          <span className="faint num" style={{ fontSize: 11.5, color: tooLong ? "var(--danger)" : undefined }}>
            {chars} / {MAX_PROMPT_CHARS} 字
          </span>
          {parseBlockedReason && chars > 0 && (
            <span role="status" style={{ fontSize: 11.5, fontWeight: 600, color: "var(--danger)" }}>
              {parseBlockedReason}
            </span>
          )}
          <span className="grow" />
          <span className="faint se-prompt-cost-hint" style={{ fontSize: 11.5 }}>拆解免费，开始制作扣 {entryCost} 积分</span>
          <button
            type="button"
            className="btn btn-grad se-prompt-parse-btn"
            style={{ opacity: canParse ? 1 : 0.5, cursor: canParse ? "pointer" : "not-allowed" }}
            disabled={!canParse}
            aria-busy={parsing}
            title={parseBlockedReason ?? undefined}
            onClick={onParse}
          >
            {parsing ? <Loader2 size={16} className="spin" /> : <Sparkles size={16} />}
            {parsing ? `正在拆解 ${elapsed} 秒` : "开始拆解"}
          </button>
        </div>
      </div>

      {parsing && (
        <div className="card col gap-2" role="status" aria-live="polite" style={{ padding: "14px 18px", marginTop: 12 }}>
          <div className="row gap-2" style={{ alignItems: "center", flexWrap: "wrap" }}>
            <Loader2 size={15} className="spin" style={{ color: "var(--accent)" }} />
            <strong style={{ fontSize: 13 }}>正在拆分镜</strong>
            <span className="faint num" style={{ fontSize: 12 }}>已等 {elapsed} 秒</span>
            <span className="grow" />
            <button type="button" className="chip" onClick={onCancel}>取消</button>
          </div>
          {/* 不做假进度条：只如实说明这一步慢在哪、要等多久，超时再给出下一步。 */}
          <div className="muted" style={{ fontSize: 12.5, lineHeight: 1.7 }}>
            {elapsed < 30
              ? "要从原文里逐镜拆出人物、场景和台词，通常 30–90 秒。先别关这个页面，关了这次的结果就没了。"
              : elapsed < 120
                ? "还在拆。几千字、几十镜的原文超过 90 秒很常见，先别关页面。"
                : `已经超过 2 分钟，这次可能特别慢。可以取消，把原文删短一点再试。拆解不花积分，但${PARSE_RATE_LIMIT}，取消的这次也算在里面。`}
          </div>
        </div>
      )}

      {error && (
        <div className="card row gap-2" role="alert" style={{ padding: "12px 16px", marginTop: 12, color: "var(--danger)", fontSize: 13, lineHeight: 1.6 }}>
          <AlertTriangle size={15} style={{ flex: "none", marginTop: 2 }} />
          <span style={{ overflowWrap: "anywhere" }}>{error}</span>
        </div>
      )}
      {tooLong && !error && (
        <div className="card row gap-2" style={{ padding: "12px 16px", marginTop: 12, color: "var(--danger)", fontSize: 13 }}>
          <AlertTriangle size={15} style={{ flex: "none" }} />
          <span>一次最多 {MAX_PROMPT_CHARS} 字，超出的部分请分成几条分别做。</span>
        </div>
      )}

      <div className="card col gap-2" style={{ padding: "14px 18px", marginTop: 14 }}>
        <div className="row gap-2" style={{ alignItems: "center" }}>
          <Info size={14} style={{ color: "var(--accent)" }} />
          <span style={{ fontWeight: 700, fontSize: 12.5 }}>怎么写拆得更准</span>
        </div>
        {[
          "带时间码（如 01:08-01:43）就按时间码算每镜时长；没有时间码会按台词长短和画面估算。",
          "人物外貌单独写一段，性格、口头禅和台词另写。每一镜出图只看外貌，混在一起人物长相容易跑偏。",
          `每镜最长 ${PROMPT_SHOT_MAX_SEC} 秒，更长的会自动拆成几镜。一条最多 ${PROMPT_MAX_SHOTS} 镜，超出的部分拆完后可以另开一页接着拆。`,
          `拆解不花积分，${PARSE_RATE_LIMIT}。`,
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
        <div className="muted" style={{ fontSize: 13 }}>还没有分镜。点「加一镜」自己写，或点「改原文重拆」回去改原文。</div>
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
    <div className="card se-shot-wrap" style={{ padding: 0, overflow: "hidden" }}>
      <div className="se-shot-scroll">
        {/* 容器窄于 860 时每一镜变一张卡（td 的 data-label 当小标题），见 styles/pages/shorts-entry.css */}
        <table className="se-shot-table">
          <thead>
            <tr>
              <th style={{ width: 104, textAlign: "center" }}>镜 · 时长</th>
              <th style={{ width: 300 }}>画面内容</th>
              <th style={{ width: 240 }}>台词 · 出场人物</th>
              <th style={{ width: 110 }}>景别 · 运镜</th>
              <th style={{ width: 150 }}>音效 · BGM · 特效</th>
              <th style={{ width: 44 }} aria-label="操作" />
            </tr>
          </thead>
          <tbody>
            {shots.map((s, i) => (
              <tr key={i}>
                <td className="se-shot-no">
                  <div className="se-shot-head">
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
                      <span className="faint num" style={{ fontSize: 10.5, maxWidth: 110, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={`原文里的时间码 ${s.timecode}`}>
                        原文 {s.timecode}
                      </span>
                    )}
                  </div>
                </td>
                <td data-label="画面内容">
                  <Editable block value={s.visual} placeholder="这一镜要拍什么" onCommit={(v) => onPatch(i, { visual: v })} style={{ lineHeight: 1.7 }} />
                  {s.sceneName && (
                    <div className="faint" style={{ fontSize: 11, marginTop: 4, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={`场景：${s.sceneName}`}>
                      场景 · {s.sceneName}
                    </div>
                  )}
                </td>
                <td data-label="台词 · 出场人物">
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
                            title="原文没写这一镜有谁，出图时默认所有角色都出镜。点名字可以去掉不在场的人。"
                          >
                            默认全员
                          </span>
                        )}
                        {characters.map((name) => {
                          // 未标注（字段缺失）时视觉上按全员亮起 —— 与出图时的实际行为一致，不骗人。
                          const on = s.castNames ? s.castNames.includes(name) : true;
                          return (
                            <button
                              key={name}
                              type="button"
                              className="chip se-cast-chip"
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
                              // 尺寸在 shorts-entry.css 的 .se-cast-chip（≤720 放大到 32px 点击区），这里只留随状态变的颜色
                              style={{
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
                <td data-label="景别 · 运镜">
                  <div className="col gap-1">
                    <Editable value={s.size} placeholder="景别" onCommit={(v) => onPatch(i, { size: v })} />
                    <Editable value={s.move} placeholder="运镜" onCommit={(v) => onPatch(i, { move: v })} />
                  </div>
                </td>
                <td data-label="音效 · BGM · 特效">
                  <div className="col gap-1" style={{ fontSize: 12 }}>
                    <Editable block value={s.sfx} placeholder="音效（可留空）" onCommit={(v) => onPatch(i, { sfx: v })} />
                    <Editable block value={s.bgm} placeholder="BGM（可留空）" onCommit={(v) => onPatch(i, { bgm: v })} />
                    <Editable block value={s.fx} placeholder="特效氛围（可留空）" onCommit={(v) => onPatch(i, { fx: v })} />
                  </div>
                </td>
                <td className="se-shot-del">
                  <button
                    type="button"
                    className="btn btn-icon btn-sm tap-target"
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

/** 带说明的多行字段（「人物与画面设定」里反复用到）。 */
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
        <span className="faint se-field-hint">{hint}</span>
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
