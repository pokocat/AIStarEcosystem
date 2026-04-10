"use client";

import { useRouter } from "next/navigation";
import { ProducerIntroPage } from "@/views/ProducerIntroPage";
import { useDictionary } from "@/features/shared/hooks/use-dictionary";

export default function ProducerIntroRoute() {
  const router = useRouter();
  const { lang, copy, toggleLang } = useDictionary();

  return (
    <ProducerIntroPage
      lang={lang}
      copy={copy.producer.intro}
      onEnterApp={() => router.push("/producer/overview")}
      onToggleLang={toggleLang}
    />
  );
}
