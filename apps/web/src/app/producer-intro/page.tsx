"use client";

import { useRouter } from "next/navigation";
import { ProducerIntro } from "@/components/ProducerIntro";
import { useLang } from "@/lib/lang-context";

export default function ProducerIntroRoute() {
  const router = useRouter();
  const { lang, setLang } = useLang();
  return <ProducerIntro onEnterApp={() => router.push("/producer")} lang={lang} setLang={setLang} />;
}
