/** Bearer token lives in the fragment, so requests/referrers never include it. No localStorage. */
const TOKEN = /^[A-Za-z0-9_-]{43}$/;
export function enterpriseInvitationLink(origin: string, token: string): string {
  if (!TOKEN.test(token)) throw new Error("邀请链接无效，请重新创建。");
  return `${new URL(origin).origin}/enterprise/invite#token=${encodeURIComponent(token)}`;
}
export function readEnterpriseInvitationToken(hash: string): string | null {
  const token = new URLSearchParams(hash.replace(/^#/, "")).get("token");
  return token && TOKEN.test(token) ? token : null;
}
