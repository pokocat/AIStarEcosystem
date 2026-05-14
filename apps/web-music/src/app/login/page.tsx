"use client";

import { Music } from "lucide-react";
import { DevLoginScreen } from "@ai-star-eco/landing";

export default function LoginPage() {
  return (
    <DevLoginScreen
      label="AI 音乐人"
      icon={Music}
      accentGradient="from-violet-500 via-fuchsia-500 to-purple-600"
      accentText="text-fuchsia-300"
      selectedClassName="border-fuchsia-400/50 bg-fuchsia-500/10"
      defaultPostLoginPath="/dashboard"
    />
  );
}
