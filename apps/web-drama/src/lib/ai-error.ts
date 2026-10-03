// ─────────────────────────────────────────────────────────────────────────────
// lib/ai-error.ts — AI 交互错误的统一「友好化」封装。
//
// 所有「AI 生成 / 渲染」类动作的 catch 分支都应经过 aiErrorMessage()，避免把后台
// 技术细节（上游响应体 JSON、HTTP 状态码、端点名、异常类名、堆栈）直出给用户。
//
// v0.88：用户实测真模型链路时反馈「报错都带『追查号 XXXX』看着像 bug」。改为：
//   ① 优先按 ApiError.code 给**可操作的友好文案**（超时/未配置/调用失败/积分不足…）；
//   ② 干净的业务引导文案原样透出，但**抹掉尾部「· 追查号 XXXX」**（对用户是噪声）；
//   ③ 只有真·技术泄漏才回落兜底文案，并**保留编号**供用户找客服复述（界面上叫「问题编号」）。
// v0.197：写给运营的「去管理后台配置 X」一律换成「还没开通」（FEATURE_NOT_READY）。
// 服务端日志/错误日志后台仍有完整追查号，不影响排障。
// ─────────────────────────────────────────────────────────────────────────────

// 命中即判定为「疑似后台技术细节泄漏」，替换成友好兜底文案。
const TECHNICAL_LEAK =
  /HTTP\s*\d{3}|upstream_error|OpenAIException|NotFoundError|\{\s*"?error"?\s*:|"type"\s*:\s*"|status[_-]?code|Traceback|\b[A-Za-z][A-Za-z.]*Exception\b/;

/** 功能没开通（服务端没配模型 / 提示词）时给用户的话。
 *  v0.197：之前写的是「去管理后台给 X 用途绑定端点」—— 那是给运营看的，用户打不开后台，看了也做不了什么。 */
export const FEATURE_NOT_READY = "这个功能还没开通，请联系平台开通后再用。";

// 按错误码给「可操作」的友好文案（ApiError 自带 code）。
const FRIENDLY_BY_CODE: Record<string, string> = {
  // 未配置类：用户能做的只有联系平台
  AI_NOT_CONFIGURED: "AI 写作功能还没开通，请联系平台开通后再用。",
  PROMPT_NOT_CONFIGURED: FEATURE_NOT_READY,
  IMAGE_NOT_CONFIGURED: "生成图片的功能还没开通，请联系平台开通后再用。",
  VIDEO_NOT_CONFIGURED: "生成视频的功能还没开通，请联系平台开通后再用。",
  // 短视频配音：服务端原文写的是「当前环境没配配音引擎」，给用户看不懂
  DRAMA_SHORT_TTS_NOT_CONFIGURED: "配音功能还没开通，请联系平台开通后再用。",
  // 生产上配音先撞到的是数字人引擎的检查（ShiliuService.required()），原文「数字人视频引擎尚未配置」
  // 在 drama 里读着像另一个功能坏了。drama 只有配音会走到它。
  CLIP_ENGINE_NOT_CONFIGURED: "数字人配音还没开通，请联系平台开通后再用。",
  // 超时 / 调用不稳（建议重试）
  AI_PROVIDER_TIMEOUT: "这次生成超时了，内容多的时候偶尔会这样，稍后再试一次。",
  AI_CALL_FAILED: "AI 服务暂时连不上，稍后再试一次。",
  IMAGE_CALL_FAILED: "图片没生成出来，稍后再试一次。",
  IMAGE_STORE_FAILED: "图片生成了但没保存下来，请再试一次。",
  VIDEO_SUBMIT_FAILED: "视频任务没提交上，稍后再试一次。",
  VIDEO_POLL_FAILED: "暂时查不到视频进度，任务可能还在生成，过一会儿再来看看。",
  // 输出无法解析（换说法/重试）
  AI_BAD_OUTPUT: "这次生成的内容用不了，换个说法或再试一次。",
  IMAGE_BAD_OUTPUT: "这次没拿到图片，再试一次。",
  // 会话
  UNAUTHORIZED: "登录已过期，请重新登录。",
};

// 积分 / 余额不足（兜底匹配，含 402 业务码与中文）。
const CREDIT_HINT = "积分不够了，去「积分钱包」充值后再继续。";
const CREDIT_RE = /INSUFFICIENT|BALANCE|NOT_ENOUGH|余额不足|积分不足|积分不够/i;

// 服务端写给运营的「去后台配置」引导（如「未为「视频生成」绑定 AI 模型端点。请到 管理后台 → …」）。
// 用户打不开后台，换成「还没开通」。注意别误伤「生成仍在后台进行」这类说明。
const ADMIN_GUIDE_RE = /管理后台|(?:去|到)\s*后台|后台\s*[「→]|模型端点|绑定.{0,12}端点/;

/** 抹掉消息尾部的「· 追查号 XXXX」（对用户是噪声；服务端日志仍有）。 */
function stripTrace(s: string): string {
  return s.replace(/\s*[·•・|]?\s*追查号\s*[A-Za-z0-9]+\s*$/u, "").trim();
}

/**
 * 把任意错误转成对用户友好的文案。
 * @param e        catch 到的错误（ApiError / Error / string / unknown）
 * @param fallback 兜底友好文案（按场景定制，如「大纲生成失败，请稍后重试」）
 */
export function aiErrorMessage(e: unknown, fallback = "AI 生成失败，请稍后重试"): string {
  const code = e && typeof e === "object" && "code" in e ? String((e as { code?: unknown }).code ?? "") : "";
  if (code && FRIENDLY_BY_CODE[code]) return FRIENDLY_BY_CODE[code];
  if (code && CREDIT_RE.test(code)) return CREDIT_HINT;

  const raw = (e instanceof Error ? e.message : typeof e === "string" ? e : "").trim();
  const trace = raw.match(/追查号\s*([A-Za-z0-9]+)/)?.[1];
  const clean = stripTrace(raw);
  if (!clean) return fallback;
  if (CREDIT_RE.test(clean)) return CREDIT_HINT;
  if (ADMIN_GUIDE_RE.test(clean)) return FEATURE_NOT_READY;
  // 干净的业务/引导文案 → 原样透出（追查号已抹掉）。
  if (!TECHNICAL_LEAK.test(clean)) return clean;
  // 真·技术泄漏 → 兜底，保留编号供报障（界面上统一叫「问题编号」）。
  return trace ? `${fallback}（问题编号 ${trace}）` : fallback;
}
