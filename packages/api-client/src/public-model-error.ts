/** Supplier operating information is not a customer error reason. Actual customer credit errors are preserved. */
export const MODEL_SERVICE_UNAVAILABLE = '生成服务暂时不可用，请稍后再试或联系平台处理。';
const ACCOUNT = /余额|额度|配额|预扣|扣费|计费|费率|定价|成本|充值|单价|收费|账户权益|账户欠费|balance|quota|billing|credits?|pricing|payment|\b(?:costs?|budgets?|fees?|funds?)\b|insufficient[_ -]?funds|(?:USD|CNY|RMB|[¥￥$])\s*[0-9]/i;
const PRIVATE = /预扣费|用户剩余额度|供应商.{0,12}(?:余额|额度|账户)|服务方.{0,12}(?:余额|额度|账户)|(?:api[_ -]?key|authorization|secret|credential)\s*[:=]|invalid api[ _-]?key|incorrect api[ _-]?key|鉴权失败|密钥无效|无可用渠道|no available channel|Bearer\s+|https?:\/\/|渠道.{0,12}(?:余额|额度|密钥)|Traceback|java\.[a-z]+\.|at com\./i;
const CONTEXT = /上游|供应商|服务方|生成服务|模型服务|模型端|数字人服务|引擎|provider|upstream|channel/i;
const CODE = /^(?:AI_(?:CALL|PROVIDER)|IMAGE_|VIDEO_|MUSIC_|DAP_MODEL_|STUDIO_(?:IMAGE|SPEECH|LIP_SYNC)|CLIP_ENGINE_|DRAMA_(?:IMAGE|VIDEO|RENDER|AI)).*/i;
const COST = /(?:USD|CNY|RMB|[¥￥$])\s*[+-]?(?:[0-9]|\.[0-9])/i;
const WALLET = /^(?:PAYMENT_REQUIRED|STUDIO_PAYMENT_REQUIRED|STUDIO_USAGE_PENDING|INSUFFICIENT_CREDITS|INSUFFICIENT_BALANCE|BALANCE_INSUFFICIENT|(?:CREDITS?|WALLET|RECHARGE|WITHDRAW|ENTERPRISE_(?:POINTS|CREDITS?))_.*)$/;
const TRACE = /(?:[·。]\s*)?追查号[：:\s]+([A-HJ-NP-Z2-9]{12})(?:\s*[—-].*)?$/;

export function isProviderModelError(code: string): boolean { return CODE.test(code); }
export function isCustomerWalletError(code: string): boolean { return WALLET.test(code); }

/** Read-time companion to ProviderContentModeration.historical; old records no longer have structured provenance. */
function historicalModeration(message: string): string {
  const prefix = '图片未通过生成服务的内容审核：';
  const index = message.indexOf(prefix);
  if (index < 0) return message;
  const reason = message.slice(index + prefix.length);
  const image = /(?:参考(?:图|图片)|输入(?:图|图片|图像)|(?:input|reference) images?)[^。；;.!?]{0,40}(?:未通过|违反|涉及|敏感|blocked|rejected|flagged|viola)/i.test(reason);
  const prompt = /(?:提示词|输入文本|文本提示|input text|text prompt|the prompt)[^。；;.!?]{0,40}(?:未通过|违反|涉及|敏感|blocked|rejected|flagged|viola)/i.test(reason);
  const output = /(?:(?:生成的|输出的)(?:图片|图像|视频|内容)|generated (?:image|video|content)|output (?:image|video|content))[^。；;.!?]{0,40}(?:未通过|违反|涉及|敏感|blocked|rejected|flagged|viola)/i.test(reason);
  const topic = /violence|violent|暴力/i.test(reason) ? '暴力内容' : /self-harm|self_harm|自伤/i.test(reason) ? '自伤相关内容'
    : /sexual|色情/i.test(reason) ? '色情内容' : /harassment|骚扰/i.test(reason) ? '骚扰内容'
    : /未成年|青少年|儿童/.test(reason) ? '未成年人相关内容' : '';
  const hint = topic ? `服务方提示可能涉及${topic}。` : '';
  const text = image && !prompt && !output ? `参考图片未通过内容审核。${hint}请检查或更换参考图片后再生成。`
    : prompt && !image && !output ? `输入文本未通过内容审核。${hint}请修改生成描述或文案后再生成。`
    : output && !image && !prompt ? `生成结果未通过内容审核。${hint}请调整生成描述或参考素材后再生成。`
    : `本次生成未通过内容审核。${hint}服务方未说明触发对象，请检查参考素材和生成描述。`;
  const trace = message.match(TRACE)?.[1];
  return message.slice(0, index) + text + (trace ? ` · 追查号 ${trace}` : '');
}

// Companion to PublicModelErrorPolicy.reworded: old records and canvas documents still hold these. Keep the two in step.
const UNREADABLE = '生成服务未能完成这次请求，请稍后再试或换一个模型。';
const SUBMISSION_FAILED = '生成服务没有返回结果，这次生成失败。未完成部分的积分已退回，可以重新生成。';
const TECHNICAL = /map\[|[{}]|幂等|idempot|\bapi\b|token plan|exception\b|\b(?:http|status)\s*[:=]?\s*\d{3}\b|\b[a-z]+_[a-z_]+\b/i;
// 存下来的句子可能是我们自己写的中文（提到「API Key」「HTTP 404」都正常），只认绝不会是我们写的结构。
const DUMP = /map\[|[{}]|幂等|idempot|exception\b|\b[a-z]+_[a-z_]+\b/i;
const NO_INFORMATION = /^\s*(?:(?:(?:resource|model|task) )?not found|bad request|invalid request|request failed|(?:internal )?(?:server )?error|unknown error|(?:service )?unavailable|forbidden|unauthorized|failed)\s*\.?\s*$/i;
function translated(text: string): string | undefined {
  const duration = text.match(/reference video duration must be within (\d+)\.\.(\d+) seconds/i);
  if (duration) return `参考视频要 ${duration[1]}–${duration[2]} 秒，请调整后再试`;
  if (/may contain real person/i.test(text)) return '参考图片被模型识别为包含真人，当前模型不接受这类素材。请更换参考图片后再试，使用相同素材重试仍会失败';
  if (/has been retired|model_delisted/i.test(text)) return '这个视频模型已被提供方下架，不能再用它生成，请换一个模型';
  if (/rate.?limit|too many requests|overloaded|速率限制/i.test(text)) return '生成服务当前请求过多，请稍后再试';
  if (/cannot be decoded|invalid image|unsupported (?:image|format|media)/i.test(text)) return '参考素材无法读取，请更换后再试';
  return undefined;
}
function reworded(message: string): string {
  const trace = message.match(TRACE);
  const body = trace ? message.slice(0, trace.index).trim() : message;
  const suffix = trace ? ` · 追查号 ${trace[1]}` : '';
  if (body.startsWith('生成服务没有返回有效的任务信息')) return SUBMISSION_FAILED + suffix;
  const known = translated(body);
  if (known) return known + suffix;
  const cleaned = body.replace(/[（(](?:上游 ?|HTTP )\d{3}[)）]/g, '').replace('被上游拒收', '被生成服务拒绝').replace('上游原因', '原因');
  if (!/\p{Script=Han}/u.test(cleaned)) return TECHNICAL.test(cleaned) || NO_INFORMATION.test(cleaned) ? UNREADABLE + suffix : `${UNREADABLE.replace(/。$/, '')}（服务方提示：${cleaned}）${suffix}`;
  if (DUMP.test(cleaned)) return UNREADABLE + suffix;
  return cleaned === body ? message : cleaned + suffix;
}

export function publicModelErrorMessage(message: string, code?: string): string {
  if (!message) return message;
  const privateAccount = !WALLET.test(code || '') && (COST.test(message) || (CODE.test(code || '') || CONTEXT.test(message)) && ACCOUNT.test(message));
  if (!PRIVATE.test(message) && !privateAccount) {
    const moderated = historicalModeration(message);
    return !WALLET.test(code || '') && (CODE.test(code || '') || CONTEXT.test(moderated)) ? reworded(moderated) : moderated;
  }
  const trace = message.match(TRACE)?.[1];
  return MODEL_SERVICE_UNAVAILABLE + (trace ? ` · 追查号 ${trace}` : '');
}

/** Copies only changed error paths. Customer content/amounts and lookup IDs remain unchanged. */
export function sanitizeModelErrorFields<T>(value: T, inError = false, inheritedCode?: string): T {
  if (Array.isArray(value)) {
    const next = value.map(item => inError && typeof item === 'string' ? publicModelErrorMessage(item, inheritedCode) : sanitizeModelErrorFields(item, inError, inheritedCode));
    return (next.some((item, i) => item !== value[i]) ? next : value) as T;
  }
  if (!value || typeof value !== 'object') return value;
  const row = value as Record<string, unknown>;
  const error = inError || typeof row.code === 'string' && typeof row.message === 'string';
  const historicalReason = error && row.category === 'content_moderation' && typeof row.providerCode === 'string'
    && /^(?:content_policy_violation|content_filter|content_policy|safety_violation|moderation_blocked)$/i.test(row.providerCode);
  const code = typeof row.errorCode === 'string' ? row.errorCode : typeof row.error_code === 'string' ? row.error_code : error && typeof row.code === 'string' ? row.code : inheritedCode;
  let result = row;
  for (const [key, current] of Object.entries(row)) {
    if (error && (['upstreamBody', 'upstreamMessage', 'providerMessage', 'responseBody', 'rawResponse', 'internalDetail', 'apiKey', 'credentials'].includes(key)
      || CODE.test(code || '') && ['balance', 'remainingQuota', 'requiredQuota', 'providerBalance', 'supplierBalance', 'accountBalance', 'upstreamBalance', 'upstreamCost', 'providerPrice'].includes(key))) {
      if (result === row) result = { ...row }; delete result[key]; continue;
    }
    const errorField = ['errorMessage', 'error_message', 'errorDetails', 'failReason', 'fail_reason', 'lastError', 'textError', 'planError', 'needsUserReason', 'failureReason', 'error'].includes(key);
    const errorMessage = error && ['message', 'reason', 'detail', 'description'].includes(key)
      || key === 'message' && ['failed', 'error', 'rejected', 'needs_user', 'waiting', 'blocked', 'paused'].includes(String(row.status));
    const next = typeof current === 'string' && (errorField || errorMessage) ? publicModelErrorMessage(
      historicalReason && ['reason', 'message'].includes(key) && !current.startsWith('本次生成未通过内容审核。') && !/^(?:输入(?:文本|内容)|参考(?:图片|视频|音频)|生成结果)未通过内容审核。/.test(current)
        ? '图片未通过生成服务的内容审核：' + current : current, code)
      : sanitizeModelErrorFields(current, error || ['error', 'errors', 'lastError', 'textError', 'planError'].includes(key), code);
    if (next !== current) { if (result === row) result = { ...row }; result[key] = next; }
  }
  return result as T;
}
