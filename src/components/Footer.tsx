import Link from "next/link";
import { Settings } from "lucide-react";

export function Footer() {
  return (
    <footer className="bg-charcoal py-14 text-ivory/80">
      <div className="section grid gap-10 md:grid-cols-3">
        <div>
          <h3 className="font-heading text-2xl text-ivory">Sacred Hoof &amp; Hand</h3>
          <p className="mt-3 max-w-xs text-sm leading-relaxed text-ivory/60">
            Healing through Reiki, presence, and compassionate connection.
          </p>
        </div>
        <div className="text-sm">
          <p className="mb-3 font-semibold uppercase tracking-wide text-gold">Explore</p>
          <ul className="space-y-2 text-ivory/70">
            <li><Link href="/#services" className="hover:text-gold">Sessions</Link></li>
            <li><Link href="/#vision" className="hover:text-gold">The vision</Link></li>
            <li><Link href="/book" className="hover:text-gold">Book a session</Link></li>
          </ul>
        </div>
        <div className="text-sm">
          <p className="mb-3 font-semibold uppercase tracking-wide text-gold">Connect</p>
          <ul className="space-y-2 text-ivory/70">
            {/* Placeholders — swap for real contact details */}
            <li><a href="mailto:hello@sacredhoofandhand.com" className="hover:text-gold">hello@sacredhoofandhand.com</a></li>
            <li><span>Serving virtually &amp; locally</span></li>
          </ul>
        </div>
      </div>
      <div className="section mt-10 flex items-center justify-between border-t border-ivory/10 pt-6 text-xs text-ivory/40">
        <span>© {new Date().getFullYear()} Sacred Hoof &amp; Hand. All rights reserved.</span>
        <Link
          href="/login"
          aria-label="Practitioner sign in"
          title="Practitioner sign in"
          className="text-ivory/20 transition hover:text-gold"
        >
          <Settings className="h-4 w-4" />
        </Link>
      </div>
    </footer>
  );
}
