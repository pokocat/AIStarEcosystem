import { Suspense } from "react";
import { EnterpriseWorkspace } from "@/ip/enterprise-workspace";
import "@/styles/enterprise.css";

export default function EnterprisePage() {
  return <Suspense><EnterpriseWorkspace /></Suspense>;
}
