"use client";

import { useRouter } from "next/navigation";
import { PortalPage } from "@/views/PortalPage";
import { useDictionary } from "@/features/shared/hooks/use-dictionary";

export default function PortalRoute() {
  const router = useRouter();
  const { lang, copy, toggleLang } = useDictionary();

  return (
    <PortalPage
      lang={lang}
      copy={copy.portal}
      onToggleLang={toggleLang}
      onSelectRole={(role) => {
        if (role === "fan") {
          router.push("/fan");
          return;
        }

        if (role === "coach") {
          router.push("/coach");
          return;
        }

        router.push("/producer/overview");
      }}
    />
  );
}
