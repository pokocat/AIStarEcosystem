import { HTMLAttributes, ReactNode } from "react";

interface Props extends HTMLAttributes<HTMLDivElement> {
  glass?: boolean;
  children: ReactNode;
}

/**
 * Surface container. `glass` triggers the premium-theme glass recipe
 * (background gradient + blur) via the `.glass` utility class.
 */
export function Card({ glass, style, className, children, ...rest }: Props) {
  return (
    <div
      className={glass ? `glass ${className ?? ""}` : className}
      style={{
        background: glass ? undefined : "var(--bg-1)",
        border: glass ? undefined : "1px solid var(--line)",
        borderRadius: "var(--radius-lg)",
        ...style,
      }}
      {...rest}
    >
      {children}
    </div>
  );
}
