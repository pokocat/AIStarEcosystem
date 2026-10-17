import type { Metadata } from "next";
import { InvitationRegistration } from "@/ip/invitation-registration";
import "@/styles/invitation-registration.css";

export const metadata: Metadata = {
  title: "一份来自朋友的邀请 · IP Studio",
  description: "让灵感成形，让 IP 出圈。验证手机号，加入 IP Studio。",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};
export default async function InvitePage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  return <InvitationRegistration invitationCode={code}/>;
}
