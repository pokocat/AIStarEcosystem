// ─────────────────────────────────────────────────────────────────────────────
// lib/ai-error.ts — AI 交互错误的统一脱敏封装。
//
// 所有「AI 生成 / 渲染」类动作的 catch 分支都应经过 aiErrorMessage()，避免把后台
// 技术细节（上游响应体 JSON、HTTP 状态码、端点名、异常类名、堆栈）直出给用户。
// 后端已在源头封装（友好文案 + 追查号），本函数是前端兜底：即便某条链路漏了，
// 用户也只会看到友好文案；如果消息里带「追查号」，会保留下来方便找客服复述。
//
// 干净的业务/引导文案（如「积分不足」「请先填写主题」「未绑定模型端点」）原样透出。
// ─────────────────────────────────────────────────────────────────────────────

// 命中即判定为「疑似后台技术细节泄漏」，替换成友好兜底文案。
// 只匹配真正的技术噪声特征（HTTP 状态码 / JSON 错误对象 / 上游错误类型 / 异常类名 /
// 堆栈），不匹配中文业务词，以免误伤正常引导文案。
const TECHNICAL_LEAK =
  /HTTP\s*\d{3}|upstream_error|OpenAIException|NotFoundError|\{\s*"?error"?\s*:|"type"\s*:\s*"|status[_-]?code|Traceback|\b[A-Za-z][A-Za-z.]*Exception\b/;

/**
 * 把任意错误转成对用户友好的文案。
 * @param e        catch 到的错误（Error / string / unknown）
 * @param fallback 兜底友好文案（按场景定制，如「大纲生成失败，请稍后重试」）
 */
export function aiErrorMessage(e: unknown, fallback = "AI 生成失败，请稍后重试"): string {
  const raw = (e instanceof Error ? e.message : typeof e === "string" ? e : "").trim();
  if (!raw) return fallback;
  const trace = raw.match(/追查号\s*([A-Za-z0-9]+)/)?.[1];
  // 没有技术泄漏特征 → 视为干净的业务/引导文案，原样透出（已含「追查号」就一并保留）。
  if (!TECHNICAL_LEAK.test(raw)) return raw;
  // 有泄漏特征 → 用兜底文案，仅保留「追查号」。
  return trace ? `${fallback}（追查号 ${trace}）` : fallback;
}
