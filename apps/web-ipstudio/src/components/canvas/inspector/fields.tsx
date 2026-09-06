"use client";

// 属性面板的表单原语 —— 统一字号、统一 label 排版、统一折叠块。

import * as React from "react";
import { ChevronDown, Loader2, Upload } from "lucide-react";
import { USE_MOCK } from "@ai-star-eco/api-client";
import { MockBadge } from "@/components/common/mock-badge";

export function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="field-label block mb-1">{label}</span>
      {children}
      {hint && <span className="block mt-1 text-[10px] leading-relaxed" style={{ color: "var(--ink-3)" }}>{hint}</span>}
    </label>
  );
}

const controlStyle: React.CSSProperties = {
  background: "var(--surface-2)",
  border: "1px solid var(--line-2)",
  color: "var(--ink)",
};

export function TextInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className="w-full h-9 px-2.5 rounded-lg text-[12.5px] outline-none transition focus:border-[var(--primary)]"
      style={{ ...controlStyle, ...props.style }}
    />
  );
}

export function TextAreaInput(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      {...props}
      className="w-full px-2.5 py-2 rounded-lg text-[12.5px] leading-relaxed outline-none transition resize-y scrollbar-thin focus:border-[var(--primary)]"
      style={{ ...controlStyle, ...props.style }}
    />
  );
}

export function Collapsible({
  title, children, defaultOpen = false, meta,
}: { title: string; children: React.ReactNode; defaultOpen?: boolean; meta?: React.ReactNode }) {
  const [open, setOpen] = React.useState(defaultOpen);
  return (
    <div className="rounded-xl overflow-hidden" style={{ border: "1px solid var(--line-2)" }}>
      <button
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="w-full flex items-center gap-2 px-2.5 py-2 text-left transition"
        style={{ background: "var(--surface-2)" }}
      >
        <ChevronDown
          className="w-3.5 h-3.5 shrink-0 transition-transform"
          style={{ color: "var(--ink-3)", transform: open ? "none" : "rotate(-90deg)" }}
        />
        <span className="text-[11.5px] font-bold flex-1 min-w-0 truncate" style={{ color: "var(--ink-2)" }}>{title}</span>
        {meta}
      </button>
      {open && <div className="px-2.5 py-2.5" style={{ background: "var(--surface)" }}>{children}</div>}
    </div>
  );
}

export function PrimaryButton({
  children, loading, ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { loading?: boolean }) {
  return (
    <button
      {...rest}
      disabled={rest.disabled || loading}
      className="w-full h-9 rounded-lg text-[12.5px] font-bold transition hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-1.5"
      style={{ background: "var(--primary)", color: "var(--on-primary)", ...rest.style }}
    >
      {loading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
      {children}
    </button>
  );
}

export function GhostButton({
  children, loading, ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { loading?: boolean }) {
  return (
    <button
      {...rest}
      disabled={rest.disabled || loading}
      className="w-full h-9 rounded-lg text-[12.5px] font-semibold transition hover:bg-[var(--surface-2)] disabled:opacity-50 flex items-center justify-center gap-1.5"
      style={{ border: "1px solid var(--line-2)", color: "var(--ink)", background: "var(--surface)", ...rest.style }}
    >
      {loading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
      {children}
    </button>
  );
}

/** 图片上传（点选 + 拖入）。上传本身由调用方给的 onPick 承担。 */
export function ImageUploadField({
  imageUrl, fileName, uploading, onPick, aspect = "3/4", label = "图片",
}: {
  imageUrl?: string;
  fileName?: string;
  uploading?: boolean;
  onPick: (file: File) => void;
  aspect?: string;
  label?: string;
}) {
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = React.useState(false);

  const take = (files: FileList | null) => {
    const file = files?.[0];
    if (file) onPick(file);
  };

  return (
    <div>
      <span className="field-label block mb-1">{label}</span>
      <div
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => { e.preventDefault(); setDragOver(false); take(e.dataTransfer.files); }}
        onClick={() => inputRef.current?.click()}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") inputRef.current?.click(); }}
        className="relative rounded-xl overflow-hidden cursor-pointer transition"
        style={{
          aspectRatio: aspect,
          background: "var(--surface-2)",
          border: `1px ${imageUrl ? "solid" : "dashed"} ${dragOver ? "var(--primary)" : "var(--line-2)"}`,
        }}
      >
        {imageUrl ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={imageUrl} alt="" className="w-full h-full object-cover" />
            {USE_MOCK && <div className="absolute top-2 left-2"><MockBadge /></div>}
            <div
              className="absolute inset-x-0 bottom-0 px-2 py-1.5 text-[10px] truncate"
              style={{ background: "rgba(255,255,255,0.88)", color: "var(--ink-2)" }}
              title={fileName}
            >
              {uploading ? "上传中…" : fileName || "点一下可换图"}
            </div>
          </>
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-1.5 px-3 text-center">
            {uploading ? (
              <Loader2 className="w-5 h-5 animate-spin" style={{ color: "var(--primary)" }} />
            ) : (
              <Upload className="w-5 h-5" style={{ color: "var(--ink-4)" }} />
            )}
            <span className="text-[11px] font-semibold" style={{ color: "var(--ink-2)" }}>
              {uploading ? "上传中…" : "点一下选图，或拖进来"}
            </span>
            <span className="text-[10px]" style={{ color: "var(--ink-3)" }}>支持 JPG / PNG，不超过 15MB</span>
          </div>
        )}
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png"
        hidden
        onChange={(e) => { take(e.target.files); e.target.value = ""; }}
      />
    </div>
  );
}
