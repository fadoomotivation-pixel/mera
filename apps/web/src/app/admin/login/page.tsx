import { redirect } from "next/navigation";

/** MERA MAKAN has one sign-in page. This route is kept so older links,
 * bookmarks and anything already printed on partner material still work —
 * it simply forwards to /login, which routes by role after authentication. */
export default function LegacyLoginRedirect() {
  redirect("/login");
}
