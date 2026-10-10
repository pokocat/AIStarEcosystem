"use client";

// Existing workflows stay intact, inside the same account workspace as /me.
import React, { Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { App, type StudioStart } from "@/proto/app";
import { HubTabBar } from "@/components/hub/ui";
import { PlatformGateScreen, useRequireAuth } from "@/components/hub/auth";
import { AccountWorkspace, useStudioHash } from "@/shell/account-workspace";
import { accountPageKey, studioEntryDestination } from "@/shell/account-navigation";

const STARTS: StudioStart[] = ["sheet", "real", "ai", "compose"];

function StudioInner() {
  const router = useRouter();
  const sp = useSearchParams();
  const hash = useStudioHash();
  const raw = sp.get("start") || (sp.get("create") === "1" ? "sheet" : null);
  const start = STARTS.find(s => s === raw);
  const auth = useRequireAuth();
  const [ready, setReady] = React.useState(false);
  React.useEffect(() => {
    const destination = studioEntryDestination(window.location.hash, window.location.search);
    if (destination) { router.replace(destination); return; }
    setReady(true);
  }, [router, hash, start]);
  if (auth === "no-platform") return <PlatformGateScreen />;
  if (!ready || auth !== "ok") return null;
  return <AccountWorkspace tool>
    <App embedded start={start} tabBar={<HubTabBar />} onRootBack={accountPageKey(hash) ? () => router.push("/me") : undefined} />
  </AccountWorkspace>;
}

export default function StudioPage() {
  return <Suspense fallback={null}><StudioInner /></Suspense>;
}
