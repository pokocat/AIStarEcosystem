"use client";

// 表单字段原语：Field（label + 错误） + Input/Textarea/Select 的轻量样式。
// 不引 react-hook-form，用受控 state；FormDialog 会聚合校验。

import * as React from "react";

interface FieldProps {
  label: React.ReactNode;
  hint?: React.ReactNode;
  error?: React.ReactNode;
  required?: boolean;
  children: React.ReactNode;
}

export function Field({ label, hint, error, required, children }: FieldProps) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 14 }}>
      <label style={{ fontSize: 12, color: "var(--fg-2)", fontWeight: 500, letterSpacing: 0.2 }}>
        {label}
        {required && <span style={{ color: "var(--danger)", marginLeft: 4 }}>*</span>}
      </label>
      {children}
      {error ? (
        <div style={{ fontSize: 11, color: "var(--danger)" }}>{error}</div>
      ) : hint ? (
        <div style={{ fontSize: 11, color: "var(--fg-3)" }}>{hint}</div>
      ) : null}
    </div>
  );
}

const inputBase: React.CSSProperties = {
  width: "100%",
  background: "var(--bg-1)",
  border: "1px solid var(--line-2)",
  borderRadius: "var(--radius-sm)",
  padding: "9px 12px",
  fontSize: 13,
  color: "var(--fg-0)",
  fontFamily: "var(--font-sans)",
  outline: "none",
  transition: "border-color 160ms ease, background 160ms ease",
};

export const TextInput = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  function TextInput({ style, ...rest }, ref) {
    return <input ref={ref} {...rest} style={{ ...inputBase, ...style }} />;
  }
);

export const TextArea = React.forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(
  function TextArea({ style, rows = 4, ...rest }, ref) {
    return (
      <textarea
        ref={ref}
        rows={rows}
        {...rest}
        style={{ ...inputBase, resize: "vertical", lineHeight: 1.5, ...style }}
      />
    );
  }
);

export const Select = React.forwardRef<HTMLSelectElement, React.SelectHTMLAttributes<HTMLSelectElement>>(
  function Select({ style, children, ...rest }, ref) {
    return (
      <select ref={ref} {...rest} style={{ ...inputBase, ...style }}>
        {children}
      </select>
    );
  }
);
