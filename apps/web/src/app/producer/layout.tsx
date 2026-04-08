import type { ReactNode } from "react";
import { ProducerShell } from "@/features/producer/components/producer-shell";
import { ProducerWorkspaceProvider } from "@/features/producer/providers/producer-workspace-provider";

export default function ProducerLayout({ children }: { children: ReactNode }) {
  return (
    <ProducerWorkspaceProvider>
      <ProducerShell>{children}</ProducerShell>
    </ProducerWorkspaceProvider>
  );
}
