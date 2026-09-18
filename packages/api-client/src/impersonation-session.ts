import { API_BASE_URL } from "./config";

export const IMPERSONATION_KEY = "aistareco.impersonation";
export const IMPERSONATION_PATH = "/auth/callback/impersonation";
const PRODUCTS = new Set(["drama", "music", "celebrity", "aiavatar", "star"]);
export interface ImpersonationSession {
  token: string;
  targetName: string;
  product: string;
  expiresAt: string;
}
const INVALID_SESSION: ImpersonationSession = {
  token: "imp_invalid", targetName: "当前用户", product: "", expiresAt: "1970-01-01T00:00:00Z",
};
export function validImpersonation(value: unknown): value is ImpersonationSession {
  if (!value || typeof value !== "object") return false;
  const v = value as Partial<ImpersonationSession>;
  return typeof v.token === "string" && /^imp_[A-Za-z0-9_-]{43}$/.test(v.token)
    && typeof v.targetName === "string" && typeof v.product === "string" && PRODUCTS.has(v.product)
    && typeof v.expiresAt === "string" && Number.isFinite(Date.parse(v.expiresAt));
}
export function getImpersonation(): ImpersonationSession | null {
  if (typeof window === "undefined") return null;
  let raw: string | null;
  try { raw = window.sessionStorage.getItem(IMPERSONATION_KEY); }
  catch { return null; }
  if (raw === null) return null;
  try {
    const value: unknown = JSON.parse(raw);
    return validImpersonation(value) ? value : INVALID_SESSION;
  } catch { return INVALID_SESSION; }
}
export function isImpersonating(): boolean { return getImpersonation() !== null; }
export function isImpersonationCallback(): boolean {
  return typeof window !== "undefined" && window.location.pathname?.replace(/\/+$/, "") === IMPERSONATION_PATH;
}
export function setImpersonation(session: ImpersonationSession) {
  if (!validImpersonation(session) || Date.parse(session.expiresAt) <= Date.now())
    throw new Error("附身登录信息无效，请从后台重新发起");
  // 不可用时明确报错，不降级成跨标签页的 localStorage。
  window.sessionStorage.setItem(IMPERSONATION_KEY, JSON.stringify(session));
}
export function expireImpersonation() {
  // 保留标记直到显式退出；回调页不再跳转自己，避免过期后的刷新死循环。
  if (typeof window !== "undefined" && !isImpersonationCallback())
    window.location.replace(IMPERSONATION_PATH + "?expired=1");
}
export async function exitImpersonation(): Promise<void> {
  const session = getImpersonation();
  if (session) {
    const response = await fetch(`${API_BASE_URL}/auth/impersonation/exit`, {
      method: "POST", headers: { Authorization: `Bearer ${session.token}` },
      cache: "no-store", signal: AbortSignal.timeout(15000),
    });
    if (!response.ok) throw new Error("退出没有完成，请重试");
    // 一个旧退出请求不能删除刚创建的新会话。
    if (getImpersonation()?.token !== session.token) return;
    window.sessionStorage.removeItem(IMPERSONATION_KEY);
  }
  // 整页重载清掉业务缓存；原账号令牌从未修改。
  window.location.replace("/");
}
