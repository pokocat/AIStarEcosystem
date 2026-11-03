"use client";

import { ComingSoonProvider } from "@/components/incubation/ComingSoon";
import "@/components/incubation/incubation.css";

export default function IncubationLayout({ children }: { children: React.ReactNode }) {
  return <ComingSoonProvider>{children}</ComingSoonProvider>;
}
