import { InputHTMLAttributes } from "react";

interface Props extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  mono?: boolean;
}

export function Input({ label, mono, style, ...rest }: Props) {
  return (
    <label style={{ display: "block" }}>
      {label && (
        <div
          style={{
            fontSize: 11,
            color: "var(--fg-2)",
            marginBottom: 4,
            fontFamily: "var(--font-mono)",
            letterSpacing: 1,
            textTransform: "uppercase",
          }}
        >
          {label}
        </div>
      )}
      <input
        style={{
          width: "100%",
          padding: "8px 10px",
          background: "var(--bg-2)",
          color: "var(--fg-0)",
          border: "1px solid var(--line-2)",
          borderRadius: "var(--radius-md)",
          fontSize: 13,
          fontFamily: mono ? "var(--font-mono)" : "var(--font-sans)",
          outline: "none",
          ...style,
        }}
        {...rest}
      />
    </label>
  );
}
