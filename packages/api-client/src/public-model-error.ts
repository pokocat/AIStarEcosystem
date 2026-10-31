/** Supplier operating information is not a customer error reason. Actual customer credit errors are preserved. */
export const MODEL_SERVICE_UNAVAILABLE = '生成服务暂时不可用，请稍后再试或联系平台处理。';
const ACCOUNT = /余额|额度|配额|预扣|扣费|计费|费率|定价|成本|充值|单价|收费|账户权益|账户欠费|balance|quota|billing|credits?|pricing|payment|\b(?:costs?|budgets?|fees?|funds?)\b|insufficient[_ -]?funds|(?:USD|CNY|RMB|[¥￥$])\s*[0-9]/i;
const PRIVATE = /预扣费|用户剩余额度|供应商.{0,12}(?:余额|额度|账户)|服务方.{0,12}(?:余额|额度|账户)|(?:api[_ -]?key|authorization|secret|credential)\s*[:=]|invalid api[ _-]?key|incorrect api[ _-]?key|鉴权失败|密钥无效|无可用渠道|no available channel|Bearer\s+|https?:\/\/|渠道.{0,12}(?:余额|额度|密钥)|Traceback|java\.[a-z]+\.|at com\./i;
const CONTEXT = /上游|供应商|服务方|生成服务|模型服务|模型端|数字人服务|引擎|provider|upstream|channel/i;
const CODE = /^(?:AI_(?:CALL|PROVIDER)|IMAGE_|VIDEO_|MUSIC_|DAP_MODEL_|STUDIO_(?:IMAGE|SPEECH|LIP_SYNC)|CLIP_ENGINE_|DRAMA_(?:IMAGE|VIDEO|RENDER|AI)).*/i;
const COST = /(?:USD|CNY|RMB|[¥￥$])\s*[+-]?(?:[0-9]|\.[0-9])/i;
const WALLET = /^(?:PAYMENT_REQUIRED|STUDIO_PAYMENT_REQUIRED|STUDIO_USAGE_PENDING|INSUFFICIENT_CREDITS|INSUFFICIENT_BALANCE|BALANCE_INSUFFICIENT|(?:CREDITS?|WALLET|RECHARGE|WITHDRAW|ENTERPRISE_(?:POINTS|CREDITS?))_.*)$/;
const TRACE = /(?:[·。]\s*)?追查号[：:\s]+([A-HJ-NP-Z2-9]{12})(?:\s*[—-].*)?$/;

export function publicModelErrorMessage(message: string, code?: string): string {
  const privateAccount = !WALLET.test(code || '') && (COST.test(message) || (CODE.test(code || '') || CONTEXT.test(message)) && ACCOUNT.test(message));
  if (!message || (!PRIVATE.test(message) && !privateAccount)) return message;
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
    const next = typeof current === 'string' && (errorField || errorMessage) ? publicModelErrorMessage(current, code)
      : sanitizeModelErrorFields(current, error || ['error', 'errors', 'lastError', 'textError', 'planError'].includes(key), code);
    if (next !== current) { if (result === row) result = { ...row }; result[key] = next; }
  }
  return result as T;
}
