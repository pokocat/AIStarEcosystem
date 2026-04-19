"use client";

import { useRouter } from "next/navigation";
import { ProducerIntro } from "@/components/ProducerIntro";
import { useLang } from "@/lib/lang-context";
import { useAuth } from "@/lib/auth-context";

export default function ProducerIntroRoute() {
  const router = useRouter();
  const { lang, setLang } = useLang();
  const { user } = useAuth();
  // 已登录直通控制台；新用户先走秘钥激活注册。
  const enter = () => router.push(user ? "/producer" : "/activate?redirect=/producer");
  return <ProducerIntro onEnterApp={enter} lang={lang} setLang={setLang} />;
}
