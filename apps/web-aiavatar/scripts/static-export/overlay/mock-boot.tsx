"use client";
import { useEffect } from "react";
import "./mock-routes";
/** Registers the sample responses, and loads Google Fonts without blocking first paint when it is unreachable. */
export function MockBoot({ fonts }: { fonts: string }) {
  useEffect(() => {
    const load = () => {
      const link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = fonts;
      document.head.appendChild(link);
    };
    // Added before the load event, an unreachable stylesheet would hold that event back too.
    if (document.readyState === "complete") load();
    else window.addEventListener("load", load, { once: true });
  }, [fonts]);
  return null;
}
