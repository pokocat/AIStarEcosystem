"use client";

// /producer/artists — 艺人管理（列表 / 网格 + 详情弹窗；创建走「从 AiAvatar 引入数字人」）
import { MCNMatrix } from "@/components/producer/MCNMatrix";
import { useProducerShell } from "@/lib/producer-shell-context";

export default function ProducerArtistsPage() {
  const { lang } = useProducerShell();
  return <MCNMatrix lang={lang} />;
}
