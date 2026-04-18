"use client";

import { useRouter } from "next/navigation";
import { FanAppFull } from "@/components/FanAppFull";
import { useLang } from "@/lib/lang-context";

export default function FanRoute() {
  const router = useRouter();
  const { lang, setLang } = useLang();
  return <FanAppFull onBack={() => router.push("/portal")} lang={lang} setLang={setLang} />;
}
