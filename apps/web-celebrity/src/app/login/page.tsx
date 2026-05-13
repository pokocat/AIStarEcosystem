"use client";

import { Megaphone } from "lucide-react";
import { DevLoginScreen } from "@ai-star-eco/landing";

export default function LoginPage() {
  return (
    <DevLoginScreen
      label="AI 明星带货"
      icon={Megaphone}
      accentGradient="from-amber-500 via-orange-500 to-pink-500"
      accentText="text-amber-300"
      selectedClassName="border-amber-400/50 bg-amber-500/10"
      defaultPostLoginPath="/console"
    />
  );
}
