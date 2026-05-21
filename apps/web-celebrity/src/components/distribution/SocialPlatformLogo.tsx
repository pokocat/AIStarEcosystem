"use client";

import * as React from "react";
import type { SocialPlatform } from "@ai-star-eco/types/social-account";
import { cn } from "@ai-star-eco/ui/ui/utils";
import {
  platformDisplayName,
  platformFallbackClass,
  platformIconUrl,
} from "./social-account-labels";

type LogoSize = "xs" | "sm" | "md";

const SIZE_CLASS: Record<LogoSize, string> = {
  xs: "h-4 w-4 text-[9px]",
  sm: "h-5 w-5 text-[10px]",
  md: "h-6 w-6 text-[11px]",
};

interface Props {
  platform: SocialPlatform | string;
  size?: LogoSize;
  className?: string;
}

export function SocialPlatformLogo({ platform, size = "sm", className }: Props) {
  const [failed, setFailed] = React.useState(false);
  const label = platformDisplayName(platform);
  const src = platformIconUrl(platform);
  const sizeClass = SIZE_CLASS[size];

  React.useEffect(() => {
    setFailed(false);
  }, [platform, src]);

  return (
    <span
      className={cn(
        "inline-grid shrink-0 place-items-center overflow-hidden rounded-full border border-zinc-200 bg-white shadow-sm",
        sizeClass,
        className,
      )}
      aria-label={label}
      title={label}
    >
      {src && !failed ? (
        <img
          src={src}
          alt=""
          className="h-full w-full object-cover"
          loading="lazy"
          decoding="async"
          onError={() => setFailed(true)}
        />
      ) : (
        <span
          className={cn(
            "grid h-full w-full place-items-center font-semibold",
            platformFallbackClass(platform),
          )}
        >
          {label.slice(0, 1)}
        </span>
      )}
    </span>
  );
}
