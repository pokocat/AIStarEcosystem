"use client";

// metadata 由根 layout.tsx 提供；client component 不导出 metadata。
import { MusicLanding } from "@/components/landing/MusicLanding";

export default function MusicLandingPage() {
  return <MusicLanding />;
}
