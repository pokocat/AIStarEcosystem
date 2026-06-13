"use client";

// 通用媒体灯箱：点首帧大图 / 渲染视频 → 全屏预览（portal 到 body，避免被卡片 overflow/z-index 裁切）。
// 图像点开看大图；视频带原生 controls + 自动播放。Esc / 点遮罩 / 点 × 关闭。
import * as React from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";

export interface LightboxMedia {
  src: string;
  kind: "image" | "video";
}

export function MediaLightbox({ media, onClose }: { media: LightboxMedia | null; onClose: () => void }) {
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => setMounted(true), []);

  React.useEffect(() => {
    if (!media) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [media, onClose]);

  if (!mounted || !media) return null;

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label="媒体预览"
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 2000,
        background: "rgba(8,6,20,.86)",
        backdropFilter: "blur(4px)",
        display: "grid",
        placeItems: "center",
        padding: 32,
        animation: "drama-fade-in .14s ease-out",
      }}
    >
      <button
        type="button"
        aria-label="关闭预览"
        onClick={onClose}
        style={{
          position: "absolute",
          top: 18,
          right: 22,
          width: 38,
          height: 38,
          borderRadius: "50%",
          border: "none",
          cursor: "pointer",
          background: "rgba(255,255,255,.14)",
          color: "#fff",
          display: "grid",
          placeItems: "center",
        }}
      >
        <X size={20} />
      </button>
      {media.kind === "video" ? (
        <video
          src={media.src}
          controls
          autoPlay
          playsInline
          onClick={(e) => e.stopPropagation()}
          style={{
            maxWidth: "min(92vw, 460px)",
            maxHeight: "90vh",
            borderRadius: 14,
            background: "#000",
            boxShadow: "0 24px 80px -20px rgba(0,0,0,.7)",
          }}
        />
      ) : (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={media.src}
          alt="首帧预览"
          onClick={(e) => e.stopPropagation()}
          style={{
            maxWidth: "92vw",
            maxHeight: "90vh",
            borderRadius: 14,
            objectFit: "contain",
            boxShadow: "0 24px 80px -20px rgba(0,0,0,.7)",
          }}
        />
      )}
    </div>,
    document.body,
  );
}
