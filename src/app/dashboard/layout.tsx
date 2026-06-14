import Link from "next/link";
import { CalendarDays, Image as ImageIcon, Clock } from "lucide-react";
import { SignOutButton } from "@/components/SignOutButton";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const nav = [
  { href: "/dashboard", label: "Appointments", icon: CalendarDays },
  { href: "/dashboard/hero", label: "Hero section", icon: ImageIcon },
  { href: "/dashboard/availability", label: "Availability", icon: Clock },
];

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createSupabaseServerClient();
  const email = supabase
    ? (await supabase.auth.getUser()).data.user?.email
    : undefined;

  return (
    <div className="min-h-screen bg-ivory">
      <div className="mx-auto flex max-w-content flex-col gap-8 px-6 py-8 lg:flex-row lg:px-10">
        <aside className="lg:w-64 lg:shrink-0">
          <div className="rounded-2xl border border-sage/40 bg-white/70 p-6">
            <Link href="/" className="font-heading text-xl">
              Sacred Hoof &amp; Hand
            </Link>
            <p className="mt-1 truncate text-xs text-charcoal/50">{email ?? "Dashboard"}</p>

            <nav className="mt-6 space-y-1">
              {nav.map((item) => {
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-charcoal/80 hover:bg-sage/20"
                  >
                    <Icon className="h-4 w-4 text-sage" />
                    {item.label}
                  </Link>
                );
              })}
            </nav>

            <div className="mt-6 border-t border-sage/30 pt-4">
              <SignOutButton />
            </div>
          </div>
        </aside>

        <main className="flex-1">{children}</main>
      </div>
    </div>
  );
}
