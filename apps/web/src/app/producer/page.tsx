"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { LoadingPanel } from "@/features/shared/components/page-feedback";

export default function ProducerRoute() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/producer/overview");
  }, [router]);
  return <LoadingPanel label="Redirecting..." />;
}
