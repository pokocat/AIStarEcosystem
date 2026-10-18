import type { Metadata } from "next";
import { EnterpriseInvitationLanding } from "@/ip/enterprise-invitation-landing";
import "@/styles/enterprise-invitation.css";

export const metadata: Metadata = {
  title: "一份企业创作邀请 · IP Studio",
  description: "接受企业邀请，使用企业分配的积分开始创作。",
  robots: { index: false, follow: false }, referrer: "no-referrer",
};
export default function EnterpriseInvitePage() { return <EnterpriseInvitationLanding />; }
