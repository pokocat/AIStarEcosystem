"use client";

import { useRouter } from "next/navigation";
import { HomePage } from "@/components/HomePage";
import { useLang } from "@/lib/lang-context";

export default function HomeRoute() {
  const router = useRouter();
  const { lang, setLang } = useLang();
  return <HomePage onEnter={() => router.push("/portal")} lang={lang} setLang={setLang} />;
}
