"use client";

import { useRouter } from "next/navigation";
import { HomePage } from "@/views/HomePage";
import { useDictionary } from "@/features/shared/hooks/use-dictionary";

export default function HomeRoute() {
  const router = useRouter();
  const { lang, copy, toggleLang } = useDictionary();

  return (
    <HomePage
      lang={lang}
      copy={copy}
      onEnter={() => router.push("/portal")}
      onToggleLang={toggleLang}
    />
  );
}
