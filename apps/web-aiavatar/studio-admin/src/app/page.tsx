import { redirect } from "next/navigation";
import { studioAdminPath } from "@/lib/app-path";

export default function HomePage() {
  redirect(studioAdminPath("/business"));
}
