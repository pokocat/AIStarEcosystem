"use client";

import { useEffect, useRef, useState, type ComponentPropsWithoutRef } from "react";
import { refreshImageUrl } from "@/canvas-bridge/image-storage";

type Media = { id: string; key?: string | null; url?: string | null };
type Position = { identity: string; time: number; paused: boolean; rate: number };

/** Polling re-signs the same asset every few seconds. Keep its source until the user
 * changes version or the media actually fails; never remount a fullscreen video. */
export function DirectorVideo({ media, onError, onLoadedMetadata, ...props }: Omit<ComponentPropsWithoutRef<"video">, "src"> & { media: Media }) {
  const identity = JSON.stringify([media.id, media.key]);
  const [source, setSource] = useState<{ identity: string; url?: string; suppressAutoplay?: boolean }>({ identity, url: media.url || undefined });
  const [failed, setFailed] = useState(false);
  const video = useRef<HTMLVideoElement>(null);
  const pending = useRef<Position | null>(null);
  const attempted = useRef(false);
  const renewing = useRef(false);
  const epoch = useRef(0);

  // A changed version must take effect immediately, but a fresh signature for the
  // same version must not change src (even if the rest of the work has changed).
  if (source.identity !== identity || (!source.url && media.url)) {
    setSource({ identity, url: media.url || undefined });
  }
  useEffect(() => {
    attempted.current = false;
    renewing.current = false;
    pending.current = null;
    setFailed(false);
    return () => { epoch.current++; };
  }, [identity]);

  const renew = async () => {
    if (renewing.current) return;
    if (!media.key) { setFailed(true); return; }
    const current = epoch.current;
    const element = video.current;
    // Keep the original position if a failed renewal is retried manually.
    pending.current ??= element ? { identity, time: element.currentTime, paused: element.paused, rate: element.playbackRate } : null;
    attempted.current = true;
    renewing.current = true;
    setFailed(false);
    try {
      const url = await refreshImageUrl(media.key);
      if (current !== epoch.current) return;
      setSource({ identity, url, suppressAutoplay: pending.current?.paused });
      // Local storage can re-sign to the identical URL. Explicitly reload only in
      // that case; changing src already asks the browser to load a new resource.
      if (url === source.url && element) {
        if (pending.current?.paused) element.autoplay = false;
        element.load();
      }
    } catch {
      if (current === epoch.current) setFailed(true);
    } finally {
      if (current === epoch.current) renewing.current = false;
    }
  };

  return <>
    <video {...props} ref={video} src={source.identity === identity ? source.url : media.url || undefined}
      autoPlay={source.identity === identity && source.suppressAutoplay ? false : props.autoPlay}
      onError={event => {
        onError?.(event);
        if (renewing.current) return;
        if (attempted.current) { setFailed(true); return; }
        void renew();
      }}
      onLoadedMetadata={event => {
        const saved = pending.current;
        if (saved?.identity === identity) {
          const element = event.currentTarget;
          pending.current = null;
          element.currentTime = Number.isFinite(element.duration) ? Math.min(saved.time, element.duration) : saved.time;
          element.playbackRate = saved.rate;
          if (saved.paused) element.pause();
          else void element.play().catch(() => { /* Native controls remain available if autoplay is blocked. */ });
        }
        onLoadedMetadata?.(event);
      }}/>
    {failed && <div role="status"><button type="button" className="ip-brand-secondary" onClick={() => void renew()}>视频加载失败，重新加载</button></div>}
  </>;
}
