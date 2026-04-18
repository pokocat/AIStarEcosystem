"use client";

import { useRouter } from "next/navigation";
import { Portal, type PortalRole } from "@/components/Portal";
import { useLang } from "@/lib/lang-context";

export default function PortalRoute() {
  const router = useRouter();
  const { lang, setLang } = useLang();

  const handleSelect = (role: PortalRole) => {
    if (role === "fan") router.push("/fan");
    else if (role === "producer_intro") router.push("/producer-intro");
    else if (role === "studio") router.push("/coach");
  };

  return <Portal onSelectRole={handleSelect} lang={lang} setLang={setLang} />;
}
