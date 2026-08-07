import Link from "next/link";

export function Navbar({ onLight = false }: { onLight?: boolean }) {
  const textColor = onLight
    ? "text-charcoal"
    : "text-ivory drop-shadow-sm";
  const bookStyle = onLight
    ? "border-charcoal/40 hover:bg-charcoal hover:text-ivory"
    : "border-ivory/60 hover:bg-ivory hover:text-charcoal";

  return (
    <header className="absolute inset-x-0 top-0 z-30">
      <nav className="section flex items-center justify-between py-6">
        <Link
          href="/"
          className={`font-heading text-xl font-semibold md:text-2xl ${textColor}`}
        >
          Sacred Hoof &amp; Hand
        </Link>
        <div
          className={`flex items-center gap-6 text-sm font-semibold uppercase tracking-wide ${textColor}`}
        >
          <Link href="/#services" className="hidden hover:text-gold sm:inline">
            Sessions
          </Link>
          <Link href="/#horses" className="hidden hover:text-gold sm:inline">
            The Horses
          </Link>
          <Link href="/donate" className="hidden hover:text-gold sm:inline">
            Donate
          </Link>
          <Link
            href="/book"
            className={`rounded-full border px-5 py-2 ${bookStyle}`}
          >
            Book
          </Link>
        </div>
      </nav>
    </header>
  );
}
