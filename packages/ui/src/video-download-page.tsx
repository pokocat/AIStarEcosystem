"use client";

import { useEffect, useRef, useState } from "react";
import { gsap } from "gsap";
import { ArrowUpRight, Download } from "lucide-react";
import { isWeChatBrowser } from "./video-download";

type DownloadLinks = {
  previewUrl: string;
  downloadUrl: string;
  filename: string;
  expiresAt: number;
};

type DownloadState =
  | { status: "loading" | "expired" | "failed" }
  | { status: "ready"; weChat: boolean; links: DownloadLinks };

export function VideoDownloadPage({ apiBase, product }: { apiBase: string; product: string }) {
  const [state, setState] = useState<DownloadState>({ status: "loading" });
  const [previewFailed, setPreviewFailed] = useState(false);
  const download = useRef<HTMLAnchorElement>(null);
  const card = useRef<HTMLDivElement>(null);
  const autoStarted = useRef(false);

  useEffect(() => {
    const ticket = window.location.hash.slice(1);
    if (ticket.length > 4096 || !/^[\w-]+\.[\w-]+\.[\w-]+$/.test(ticket)) {
      setState({ status: "expired" });
      return;
    }
    const controller = new AbortController();
    const weChat = isWeChatBrowser(navigator.userAgent);
    fetch(`${apiBase}/media-download/resolve`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ticket }),
      credentials: "omit",
      signal: controller.signal,
    }).then(async response => {
      if (response.status === 410) {
        setState({ status: "expired" });
        return;
      }
      if (!response.ok) throw new Error("Download unavailable");
      const { data } = await response.json() as { data: DownloadLinks };
      if (!controller.signal.aborted) setState({ status: "ready", weChat, links: data });
    }).catch(() => {
      if (!controller.signal.aborted) setState({ status: "failed" });
    });
    return () => controller.abort();
  }, [apiBase]);

  useEffect(() => {
    if (state.status !== "ready") return;
    const timer = window.setTimeout(() => setState({ status: "expired" }), Math.max(0, state.links.expiresAt - Date.now()));
    if (!state.weChat && state.links.expiresAt > Date.now() && !autoStarted.current && download.current) {
      autoStarted.current = true;
      download.current.click();
    }
    return () => window.clearTimeout(timer);
  }, [state]);

  useEffect(() => {
    if (state.status !== "ready" || !state.weChat || !card.current) return;
    const motion = gsap.matchMedia();
    motion.add("(prefers-reduced-motion: no-preference)", () => {
      gsap.from(".video-download-guide, .video-download-player", {
        opacity: 0, y: 6, scale: 0.99, duration: 0.28, stagger: 0.05, ease: "power2.out",
      });
    }, card.current);
    return () => motion.revert();
  }, [state]);

  return (
    <main className="video-download-page">
      <header className="video-download-brand">{product}</header>
      <div className="video-download-card" ref={card}>
        <h1>视频下载</h1>
        {state.status === "loading" && <p role="status">正在加载视频…</p>}
        {state.status === "expired" && <p role="status">下载链接已失效，请返回作品页重新下载。</p>}
        {state.status === "failed" && <><p role="status">视频加载失败，请重试。</p><button type="button" onClick={() => window.location.reload()}>重试</button></>}
        {state.status === "ready" && (
          <>
            <h2>{state.links.filename}</h2>
            {state.weChat ? (
              <>
                <div className="video-download-guide">
                  <ArrowUpRight aria-hidden size={22} />
                  <p>点击微信右上角「···」，选择<strong>「在浏览器打开」</strong>下载视频。</p>
                </div>
                {previewFailed ? <p role="status">视频预览失败，请在浏览器中打开后下载。</p> : (
                  <div className="video-download-player">
                    <video src={state.links.previewUrl} controls playsInline preload="metadata" aria-label="视频预览" onError={() => setPreviewFailed(true)} />
                  </div>
                )}
              </>
            ) : (
              <>
                <p>如果浏览器未自动下载，请点击下方按钮。</p>
                <a ref={download} href={state.links.downloadUrl} download={state.links.filename} rel="noreferrer">
                  <Download aria-hidden size={18} /> 下载视频
                </a>
              </>
            )}
          </>
        )}
      </div>
    </main>
  );
}
