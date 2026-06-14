"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Loader2, Mail } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { env } from "@/lib/env";

function LoginForm() {
  const params = useSearchParams();
  const redirect = params.get("redirect") ?? "/dashboard";
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [message, setMessage] = useState("");

  async function sendLink(e: React.FormEvent) {
    e.preventDefault();
    const supabase = createClient();
    if (!supabase) {
      setStatus("error");
      setMessage(
        "Supabase isn't configured yet. Add your keys to .env.local to enable login.",
      );
      return;
    }
    setStatus("sending");
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${env.siteUrl}/auth/callback?redirect=${encodeURIComponent(redirect)}`,
      },
    });
    if (error) {
      setStatus("error");
      setMessage(error.message);
    } else {
      setStatus("sent");
    }
  }

  return (
    <div className="w-full max-w-md rounded-3xl border border-sage/40 bg-white/80 p-10 shadow-sm">
      <Link href="/" className="font-heading text-2xl">
        Sacred Hoof &amp; Hand
      </Link>
      <h1 className="mt-6 text-3xl">Practitioner login</h1>
      <p className="mt-2 text-sm text-charcoal/60">
        Enter your email and we&apos;ll send you a secure magic link — no password
        needed.
      </p>

      {status === "sent" ? (
        <div className="mt-8 rounded-xl bg-sage/20 p-6 text-center">
          <Mail className="mx-auto h-8 w-8 text-sage" />
          <p className="mt-3 font-medium">Check your inbox</p>
          <p className="mt-1 text-sm text-charcoal/60">
            We sent a sign-in link to <strong>{email}</strong>.
          </p>
        </div>
      ) : (
        <form onSubmit={sendLink} className="mt-8 space-y-4">
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            className="w-full rounded-xl border border-sage/50 bg-white px-4 py-3 text-sm outline-none focus:border-terracotta focus:ring-2 focus:ring-gold/40"
          />
          <button
            type="submit"
            disabled={status === "sending"}
            className="btn-primary w-full"
          >
            {status === "sending" ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" /> Sending…
              </>
            ) : (
              "Send magic link"
            )}
          </button>
          {status === "error" && (
            <p className="rounded-lg bg-terracotta/15 px-3 py-2 text-sm text-terracotta">
              {message}
            </p>
          )}
        </form>
      )}

      <Link
        href="/"
        className="mt-6 block text-center text-sm text-charcoal/50 underline"
      >
        ← Back home
      </Link>
    </div>
  );
}

export default function LoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-sage/20 px-6">
      <Suspense fallback={null}>
        <LoginForm />
      </Suspense>
    </main>
  );
}
