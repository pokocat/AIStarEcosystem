"use client";

import * as React from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="zh-CN">
      <body>
        <main style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: 24 }}>
          <section
            style={{
              maxWidth: 560,
              width: "100%",
              border: "1px solid #e5e7eb",
              borderRadius: 12,
              padding: 24,
              fontFamily:
                '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
            }}
          >
            <h1 style={{ margin: 0, fontSize: 20 }}>后台启动失败</h1>
            <p style={{ color: "#6b7280", lineHeight: 1.7 }}>
              根布局加载时发生错误，请重试或查看浏览器控制台。
            </p>
            <pre
              style={{
                maxHeight: 160,
                overflow: "auto",
                border: "1px solid #e5e7eb",
                borderRadius: 8,
                background: "#f9fafb",
                padding: 12,
                fontSize: 12,
                whiteSpace: "pre-wrap",
              }}
            >
              {error.message}
            </pre>
            <button
              type="button"
              onClick={reset}
              style={{
                marginTop: 16,
                height: 36,
                border: 0,
                borderRadius: 8,
                background: "#111827",
                color: "white",
                padding: "0 14px",
                cursor: "pointer",
              }}
            >
              重试
            </button>
          </section>
        </main>
      </body>
    </html>
  );
}
