// 收银台的两条错误判定（v0.197 评审后修复），单测见 checkout.test.tsx。
// 放在 page.tsx 外面：Next 的 page 模块只允许导出默认组件和路由配置。
import { ApiError } from "@ai-star-eco/api-client";
import { aiErrorMessage } from "@/lib/ai-error";

/** 订单不存在 / 不是本人的（404 / 403）：再怎么查也不会有结果，停止轮询。 */
export function isOrderGone(e: unknown): boolean {
  return e instanceof ApiError && (e.status === 404 || e.status === 403);
}

/** 下单失败给用户的话：渠道没配好单独说「换一种」，其余走统一的友好化（不直出后台细节）。 */
export function checkoutErrorMessage(e: unknown): string {
  if (e instanceof ApiError && e.code === "PAYMENT_CHANNEL_NOT_CONFIGURED") return "这种支付方式暂时用不了，请换一种。";
  return aiErrorMessage(e, "下单没成功，请稍后再试");
}
