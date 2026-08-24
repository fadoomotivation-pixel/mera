"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { clearSession } from "@/lib/api";

const LINKS = [
  { href: "/admin/dashboard", label: "Dashboard" },
  { href: "/admin/business-rules", label: "Business Rules" },
];

export function AdminNav() {
  const pathname = usePathname();
  return (
    <header className="border-b border-ink-900/10 bg-ink-900 text-white">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
        <div className="flex items-center gap-6">
          <span className="font-extrabold tracking-tight">MERA MAKAN · Admin</span>
          <nav className="flex gap-4 text-sm">
            {LINKS.map((l) => (
              <Link key={l.href} href={l.href} className={pathname === l.href ? "font-semibold text-brand-200" : "text-white/70 hover:text-white"}>
                {l.label}
              </Link>
            ))}
          </nav>
        </div>
        <button
          onClick={() => {
            clearSession();
            window.location.href = "/admin/login";
          }}
          className="text-sm text-white/70 hover:text-white"
        >
          Log out
        </button>
      </div>
    </header>
  );
}
