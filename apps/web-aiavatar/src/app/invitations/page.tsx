import { Suspense } from "react";
import { InvitationWorkspace } from "@/ip/invitation-workspace";
import "@/styles/invitations.css";

export default function InvitationsPage() {
  return <Suspense><InvitationWorkspace /></Suspense>;
}
