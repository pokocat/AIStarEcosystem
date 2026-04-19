"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { FanAppFull } from "@/components/FanAppFull";
import { useLang } from "@/lib/lang-context";

function FanRouteContent() {
  const router = useRouter();
  const { lang, setLang } = useLang();
  return <FanAppFull onBack={() => router.push("/portal")} lang={lang} setLang={setLang} />;
}

export default function FanRoute() {
  return (
    <React.Suspense fallback={<div className="flex min-h-screen items-center justify-center text-sm text-muted-foreground">正在加载粉丝端...</div>}>
      <FanRouteContent />
    </React.Suspense>
  );
}
