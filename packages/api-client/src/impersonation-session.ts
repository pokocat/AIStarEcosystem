import { API_BASE_URL } from "./config";

export const IMPERSONATION_KEY = "aistareco.impersonation";
export const IMPERSONATION_PATH = "/auth/callback/impersonation";
export interface ImpersonationSession {
  token: string;
  targetName: string;
  product: string;
  expiresAt: string;
}
export function getImpersonation(): ImpersonationSession | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(IMPERSONATION_KEY);
    if (!raw) return null;
    const value = JSON.parse(raw) as ImpersonationSession;
    return typeof value.token === "string" && value.token.startsWith("imp_")
      && typeof value.targetName === "string" && typeof value.product === "string"
      && Number.isFinite(Date.parse(value.expiresAt)) ? value : null;
  } catch { return null; }
}
export function isImpersonating(): boolean { return getImpersonation() !== null; }
export function setImpersonation(session: ImpersonationSession) {
  // sessionStorage 不可用时明确失败，不降级成跨标签页的 localStorage。
  window.sessionStorage.setItem(IMPERSONATION_KEY, JSON.stringify(session));
}
export function expireImpersonation() {
  // 保留标记直到显式退出；不悄悄恢复原账号后重放目标用户的请求。
  if (typeof window !== "undefined") window.location.replace(IMPERSONATION_PATH + "?expired=1");
}
export async function exitImpersonation(): Promise<void> {
  const session = getImpersonation();
  if (session) {
    const response = await fetch(`${API_BASE_URL}/auth/impersonation/exit`, {
      method: "POST", headers: { Authorization: `Bearer ${session.token}` },
    });
    if (!response.ok) throw new Error("退出没有完成，请重试");
    window.sessionStorage.removeItem(IMPERSONATION_KEY);
  }
  // 整页重载，清掉 React 与业务数据缓存；原账号令牌从未改动。
  window.location.replace("/");
}
