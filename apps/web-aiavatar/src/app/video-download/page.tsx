import type { Metadata } from "next";
import { API_BASE_URL } from "@ai-star-eco/api-client/config";
import { VideoDownloadPage } from "@ai-star-eco/ui/video-download-page";
import "@ai-star-eco/ui/styles/video-download.css";

export const metadata: Metadata = {
  title: "视频下载 · IP Studio",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

export default function Page() {
  return <VideoDownloadPage apiBase={API_BASE_URL} product="IP Studio" />;
}
