"use client";

import type { ReactNode } from "react";
import type { SocialAccount } from "@ai-star-eco/types/social-account";
import { cn } from "@ai-star-eco/ui/ui/utils";
import { SocialPlatformLogo } from "./SocialPlatformLogo";
import { platformAccountLabel, platformDisplayName } from "./social-account-labels";

type IdentitySize = "sm" | "md";

const AVATAR_SIZE_CLASS: Record<IdentitySize, string> = {
  sm: "h-8 w-8 text-[11px]",
  md: "h-9 w-9 text-xs",
};

const TITLE_CLASS: Record<IdentitySize, string> = {
  sm: "text-sm",
  md: "text-sm",
};

const SUBTITLE_CLASS: Record<IdentitySize, string> = {
  sm: "text-[11px]",
  md: "text-xs",
};

interface Props {
  account: SocialAccount;
  size?: IdentitySize;
  className?: string;
  titleClassName?: string;
  subtitleClassName?: string;
  meta?: ReactNode;
  metaClassName?: string;
}

export function SocialAccountIdentity({
  account,
  size = "md",
  className,
  titleClassName,
  subtitleClassName,
  meta,
  metaClassName,
}: Props) {
  const platformName = platformDisplayName(account.platform);
  const subtitle = [
    platformName,
    account.displayName || null,
    account.platformAccountId
      ? `${platformAccountLabel(account.platform)} ${account.platformAccountId}`
      : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <span className={cn("flex min-w-0 items-center gap-2.5", className)}>
      <span className={cn("relative shrink-0", AVATAR_SIZE_CLASS[size])}>
        {account.avatarUrl ? (
          <img
            src={account.avatarUrl}
            alt={account.accountName}
            className="h-full w-full rounded-full border border-zinc-200 object-cover"
            loading="lazy"
            decoding="async"
          />
        ) : (
          <span className="grid h-full w-full place-items-center rounded-full border border-zinc-200 bg-zinc-50 font-medium text-zinc-500">
            {(account.displayName || account.accountName || platformName).slice(0, 1)}
          </span>
        )}
        <SocialPlatformLogo
          platform={account.platform}
          size="xs"
          className="absolute -bottom-0.5 -right-0.5 ring-2 ring-white"
        />
      </span>
      <span className="min-w-0 flex-1">
        <span className={cn("block truncate font-medium text-zinc-800", TITLE_CLASS[size], titleClassName)}>
          {account.accountName}
        </span>
        <span className={cn("block truncate text-zinc-500", SUBTITLE_CLASS[size], subtitleClassName)}>
          {subtitle}
        </span>
        {meta ? (
          <span className={cn("mt-0.5 block truncate text-xs text-zinc-400", metaClassName)}>
            {meta}
          </span>
        ) : null}
      </span>
    </span>
  );
}
