"use client";

import { Suspense, useActionState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Loader2, Lock } from "lucide-react";
import { signIn, type SignInState } from "./actions";

function LoginForm() {
  const params = useSearchParams();
  const redirect = params.get("redirect") ?? "/dashboard";
  const [state, formAction, pending] = useActionState<SignInState, FormData>(
    signIn,
    {},
  );

  return (
    <div className="w-full max-w-md rounded-3xl border border-sage/40 bg-white/80 p-10 shadow-sm">
      <Link href="/" className="font-heading text-2xl">
        Sacred Hoof &amp; Hand
      </Link>
      <div className="mt-6 flex items-center gap-2 text-charcoal/50">
        <Lock className="h-4 w-4" />
        <span className="text-xs font-semibold uppercase tracking-wide">
          Practitioner access
        </span>
      </div>
      <h1 className="mt-2 text-3xl">Sign in</h1>
      <p className="mt-2 text-sm text-charcoal/60">
        Enter your email and password to manage sessions and content.
      </p>

      <form action={formAction} className="mt-8 space-y-4">
        <input type="hidden" name="redirect" value={redirect} />
        <label className="block">
          <span className="mb-1 block text-sm font-medium text-charcoal/80">Email</span>
          <input
            type="email"
            name="email"
            required
            autoComplete="username"
            placeholder="you@example.com"
            className="w-full rounded-xl border border-sage/50 bg-white px-4 py-3 text-sm outline-none focus:border-terracotta focus:ring-2 focus:ring-gold/40"
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-sm font-medium text-charcoal/80">Password</span>
          <input
            type="password"
            name="password"
            required
            autoComplete="current-password"
            placeholder="••••••••"
            className="w-full rounded-xl border border-sage/50 bg-white px-4 py-3 text-sm outline-none focus:border-terracotta focus:ring-2 focus:ring-gold/40"
          />
        </label>

        <button type="submit" disabled={pending} className="btn-primary w-full">
          {pending ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" /> Signing in…
            </>
          ) : (
            "Sign in"
          )}
        </button>

        {state.error && (
          <p className="rounded-lg bg-terracotta/15 px-3 py-2 text-sm text-terracotta">
            {state.error}
          </p>
        )}
      </form>

      <Link href="/" className="mt-6 block text-center text-sm text-charcoal/50 underline">
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
