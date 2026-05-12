"use client";

import { Clapperboard } from "lucide-react";
import { DevLoginScreen } from "@ai-star-eco/landing";

export default function LoginPage() {
  return (
    <DevLoginScreen
      label="AI 短剧"
      icon={Clapperboard}
      accentGradient="from-orange-500 via-amber-500 to-red-500"
      accentText="text-orange-300"
    />
  );
}
