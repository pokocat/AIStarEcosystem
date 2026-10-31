"use client";
// 「场景·专项创作」已并入「AI 视频」（docs/studio-scene-creation.md §2）；旧链接直接转过去。
import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function ScenesPage() {
  const router = useRouter();
  useEffect(() => { router.replace("/video"); }, [router]);
  return null;
}
