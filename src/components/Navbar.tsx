import Link from "next/link";

export function Navbar() {
  return (
    <header className="absolute inset-x-0 top-0 z-30">
      <nav className="section flex items-center justify-between py-6">
        <Link
          href="/"
          className="font-heading text-xl font-semibold text-ivory drop-shadow-sm md:text-2xl"
        >
          Sacred Hoof &amp; Hand
        </Link>
        <div className="flex items-center gap-6 text-sm font-semibold uppercase tracking-wide text-ivory">
          <Link href="/#services" className="hidden hover:text-gold sm:inline">
            Sessions
          </Link>
          <Link href="/#vision" className="hidden hover:text-gold sm:inline">
            Vision
          </Link>
          <Link
            href="/book"
            className="rounded-full border border-ivory/60 px-5 py-2 hover:bg-ivory hover:text-charcoal"
          >
            Book
          </Link>
          <Link href="/login" className="hover:text-gold">
            Login
          </Link>
        </div>
      </nav>
    </header>
  );
}
