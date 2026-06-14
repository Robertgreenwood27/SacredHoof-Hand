"use client";

import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

export function SignOutButton() {
  const router = useRouter();

  async function signOut() {
    const supabase = createClient();
    await supabase?.auth.signOut();
    router.push("/");
    router.refresh();
  }

  return (
    <button
      onClick={signOut}
      className="flex items-center gap-2 text-sm text-charcoal/60 hover:text-terracotta"
    >
      <LogOut className="h-4 w-4" /> Sign out
    </button>
  );
}
