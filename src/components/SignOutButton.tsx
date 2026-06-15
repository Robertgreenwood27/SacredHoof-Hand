import { LogOut } from "lucide-react";
import { signOut } from "@/app/login/actions";

export function SignOutButton() {
  return (
    <form action={signOut}>
      <button
        type="submit"
        className="flex items-center gap-2 text-sm text-charcoal/60 hover:text-terracotta"
      >
        <LogOut className="h-4 w-4" /> Sign out
      </button>
    </form>
  );
}
