"use client";

// /producer/settings — 个人 / 公司设置
import { SettingsPage } from "@/components/producer/SettingsPage";
import { useProducerShell } from "@/lib/producer-shell-context";

export default function ProducerSettingsPage() {
  const { lang, setLang } = useProducerShell();
  return <SettingsPage lang={lang} setLang={setLang} />;
}
