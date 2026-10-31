"use client";

import { useState } from "react";
import { UserRound } from "lucide-react";
import { idIssuer } from "@ai-star-eco/api-client";
import { isImpersonating } from "@ai-star-eco/api-client/impersonation-session";
import NotionAvatar from "@/vendor/react-notion-avatar";
import { ID_MODE, USE_MOCK, prepareIdentityProfileEdit, type MeIdentity } from "@/proto/api";
import { reportStudioError } from "@/ip/studio-errors";
import { accountAvatarUrl, defaultAccountAvatar } from "./account-avatar-config";

type AvatarIdentity = Pick<MeIdentity, "avatarSeed" | "avatarUrl">;

/** Uploaded account pictures take precedence; a broken picture falls back to the same account default. */
export function AccountAvatar({ identity, size = 36 }: { identity?: AvatarIdentity | null; size?: number }) {
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const url = accountAvatarUrl(identity?.avatarUrl);
  const generated = identity?.avatarSeed ? defaultAccountAvatar(identity.avatarSeed) : null;
  return <span aria-hidden="true" style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: size, height: size, flexShrink: 0, overflow: "hidden", borderRadius: "50%", background: generated?.bgColor || "var(--surface-3, #f6f6f5)", color: "var(--ink-2, #65707e)", verticalAlign: "middle" }}>
    {url && url !== failedUrl
      ? <img src={url} alt="" referrerPolicy="no-referrer" onError={() => setFailedUrl(url)} style={{ display: "block", width: "100%", height: "100%", objectFit: "cover" }} />
      : generated ? <NotionAvatar config={generated.config} bgColor={generated.bgColor} style={{ width: "100%", height: "100%" }} />
      : <UserRound size={Math.round(size * 0.55)} />}
  </span>;
}

/** Profile pictures remain owned and persisted by ID, together with its existing upload validation. */
export function EditableAccountAvatar({ identity, size = 54 }: { identity?: MeIdentity | null; size?: number }) {
  const canEdit = ID_MODE && !USE_MOCK && identity && !identity.demo && !isImpersonating() && Boolean(idIssuer());
  const avatar = <AccountAvatar identity={identity} size={size} />;
  if (!canEdit) return avatar;
  return <a href={`${idIssuer()}/account/profile`} target="_blank" rel="noopener noreferrer" aria-label="修改头像（在账号中心打开）"
    onClick={() => prepareIdentityProfileEdit(error => reportStudioError(error, { background: true }))}
    style={{ display: "inline-flex", flexDirection: "column", alignItems: "center", gap: 5, flexShrink: 0, color: "var(--ink)", textDecoration: "none", fontSize: 11 }}>
    {avatar}<span>修改头像</span>
  </a>;
}
