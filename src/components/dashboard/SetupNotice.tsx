export function SetupNotice() {
  return (
    <div className="rounded-2xl border border-gold/40 bg-gold/10 p-6 text-sm leading-relaxed text-charcoal/80">
      <p className="font-semibold text-charcoal">Supabase isn&apos;t connected yet</p>
      <p className="mt-2">
        Add your Supabase URL and keys to <code>.env.local</code>, then run the SQL
        in <code>supabase/schema.sql</code> to create the tables. Once connected,
        appointments, hero content, and availability will appear here.
      </p>
      <p className="mt-2">
        See <code>README.md</code> for the full setup checklist.
      </p>
    </div>
  );
}
