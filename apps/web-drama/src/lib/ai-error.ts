// ─────────────────────────────────────────────────────────────────────────────
// lib/ai-error.ts — AI 交互错误的统一「友好化」封装。
//
// 所有「AI 生成 / 渲染」类动作的 catch 分支都应经过 aiErrorMessage()，避免把后台
// 技术细节（上游响应体 JSON、HTTP 状态码、端点名、异常类名、堆栈）直出给用户。
//
// v0.88：用户实测真模型链路时反馈「报错都带『追查号 XXXX』看着像 bug」。改为：
//   ① 优先按 ApiError.code 给**可操作的友好文案**（超时/未配置/调用失败/积分不足…）；
//   ② 干净的业务引导文案原样透出，但**抹掉尾部「· 追查号 XXXX」**（对用户是噪声）；
//   ③ 只有真·技术泄漏才回落兜底文案，并**保留追查号**供用户找客服复述。
// 服务端日志/错误日志后台仍有完整追查号，不影响排障。
// ─────────────────────────────────────────────────────────────────────────────

// 命中即判定为「疑似后台技术细节泄漏」，替换成友好兜底文案。
const TECHNICAL_LEAK =
  /HTTP\s*\d{3}|upstream_error|OpenAIException|NotFoundError|\{\s*"?error"?\s*:|"type"\s*:\s*"|status[_-]?code|Traceback|\b[A-Za-z][A-Za-z.]*Exception\b/;

// 按错误码给「可操作」的友好文案（ApiError 自带 code）。
const FRIENDLY_BY_CODE: Record<string, string> = {
  // 未配置类（引导去后台绑定）
  AI_NOT_CONFIGURED: "还没接入大模型 —— 去管理后台给「短剧脚本起草」用途绑定一个模型端点后再试。",
  PROMPT_NOT_CONFIGURED: "这个 AI 动作的提示词还没配置 —— 去后台「短剧专区 · 提示词设置」补一下就能用。",
  IMAGE_NOT_CONFIGURED: "出图还没接入模型 —— 去后台给「图像生成」用途绑个端点再试。",
  VIDEO_NOT_CONFIGURED: "出视频还没接入模型 —— 去后台给「视频生成」用途绑个端点再试。",
  // 超时 / 调用不稳（建议重试）
  AI_PROVIDER_TIMEOUT: "AI 想得有点久、这次超时了 —— 稍等一下再点一次就好（内容多时偶尔会这样）。",
  AI_CALL_FAILED: "AI 服务这会儿不太稳，稍后再点一次试试。",
  IMAGE_CALL_FAILED: "出图这会儿不太稳，稍后再点一次。",
  IMAGE_STORE_FAILED: "出图存储出了点小问题，稍后再试一次。",
  VIDEO_SUBMIT_FAILED: "出视频提交失败了，稍后再点一次。",
  VIDEO_POLL_FAILED: "出视频进度没查到，稍等再看看。",
  // 输出无法解析（换说法/重试）
  AI_BAD_OUTPUT: "AI 这次没整明白 —— 换个说法或再点一次。",
  IMAGE_BAD_OUTPUT: "出图没拿到结果，再点一次试试。",
  // 会话
  UNAUTHORIZED: "登录状态过期了，请重新登录一下。",
};

// 积分 / 余额不足（兜底匹配，含 402 业务码与中文）。
const CREDIT_HINT = "积分不够啦 —— 先去「积分钱包」充一点再继续～";
const CREDIT_RE = /INSUFFICIENT|BALANCE|NOT_ENOUGH|余额不足|积分不足|积分不够/i;

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
  // 干净的业务/引导文案 → 原样透出（追查号已抹掉）。
  if (!TECHNICAL_LEAK.test(clean)) return clean;
  // 真·技术泄漏 → 兜底，保留追查号供报障。
  return trace ? `${fallback}（追查号 ${trace}）` : fallback;
}
