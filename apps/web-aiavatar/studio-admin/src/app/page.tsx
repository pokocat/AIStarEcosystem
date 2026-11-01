import { redirect } from "next/navigation";

export default function HomePage() {
  // Next applies the configured basePath to server redirects. Passing an
  // already-prefixed path here would produce /admin/admin/business.
  redirect("/business");
}
