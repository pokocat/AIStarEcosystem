"use client";

import { useContext } from "react";
import { ProducerWorkspaceContext } from "@/features/producer/providers/producer-workspace-provider";

export function useProducerWorkspace() {
  const context = useContext(ProducerWorkspaceContext);
  if (!context) {
    throw new Error("useProducerWorkspace must be used within ProducerWorkspaceProvider");
  }

  return context;
}
