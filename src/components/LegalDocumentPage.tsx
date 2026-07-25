import Link from "next/link";
import { Footer } from "@/components/Footer";
import { Navbar } from "@/components/Navbar";
import type { LegalBlock, LegalDocument } from "@/lib/legal";

type CompanionDocument = {
  href: string;
  label: string;
};

export function LegalDocumentPage({
  document,
  companion,
}: {
  document: LegalDocument;
  companion: CompanionDocument;
}) {
  return (
    <main className="min-h-screen bg-ivory">
      <div className="relative overflow-hidden bg-charcoal">
        <div
          aria-hidden="true"
          className="absolute -right-24 top-10 h-72 w-72 rounded-full bg-sage/15 blur-3xl"
        />
        <div
          aria-hidden="true"
          className="absolute -left-20 bottom-0 h-52 w-52 rounded-full bg-terracotta/15 blur-3xl"
        />
        <Navbar />
        <header className="section relative pb-16 pt-32 text-ivory md:pb-20 md:pt-36">
          <p className="eyebrow text-gold">{document.eyebrow}</p>
          <h1 className="mt-4 max-w-4xl text-4xl leading-tight md:text-6xl">
            {document.title}
          </h1>
          <p className="mt-5 max-w-2xl text-base leading-7 text-ivory/70 md:text-lg">
            {document.summary}
          </p>
        </header>
      </div>

      <div className="section grid gap-10 py-12 md:py-16 lg:grid-cols-[minmax(0,1fr)_17rem] lg:items-start">
        <article className="overflow-hidden rounded-3xl border border-sage/40 bg-white/80 shadow-sm">
          <div className="border-b border-sage/30 bg-sage/10 px-6 py-6 sm:px-9">
            <p className="text-sm leading-6 text-charcoal/70">
              {document.readingNotice}
            </p>
          </div>

          <div className="space-y-10 px-6 py-8 sm:px-9 sm:py-10">
            <div className="space-y-4 text-base leading-7 text-charcoal/75">
              {document.introduction.map((paragraph) => (
                <p key={paragraph}>{paragraph}</p>
              ))}
            </div>

            {document.sections.map((section) => (
              <section
                key={section.id}
                id={section.id}
                className="scroll-mt-8 border-t border-sage/30 pt-9"
              >
                <div className="flex items-start gap-4">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-terracotta/10 text-sm font-bold text-terracotta">
                    {section.number}
                  </span>
                  <div className="min-w-0 flex-1">
                    <h2 className="text-2xl leading-tight text-charcoal md:text-3xl">
                      {section.title}
                    </h2>
                    <div className="mt-4 space-y-4 text-[0.95rem] leading-7 text-charcoal/75">
                      {section.blocks.map((block, index) => (
                        <LegalBlockView
                          key={`${section.id}-${block.type}-${index}`}
                          block={block}
                        />
                      ))}
                    </div>
                  </div>
                </div>
              </section>
            ))}

            {document.closing && document.closing.length > 0 && (
              <div className="rounded-2xl border border-gold/40 bg-gold/10 p-6 font-heading text-xl leading-relaxed text-charcoal/80">
                {document.closing.map((paragraph) => (
                  <p key={paragraph}>{paragraph}</p>
                ))}
              </div>
            )}
          </div>
        </article>

        <aside className="space-y-5 lg:sticky lg:top-8">
          <div className="rounded-2xl border border-sage/40 bg-white/70 p-5">
            <p className="eyebrow">Document details</p>
            <dl className="mt-4 space-y-3 text-sm">
              <div>
                <dt className="text-charcoal/45">Effective date</dt>
                <dd className="mt-0.5 font-semibold text-charcoal">
                  {document.effectiveDate}
                </dd>
              </div>
              <div>
                <dt className="text-charcoal/45">Version</dt>
                <dd className="mt-0.5 font-semibold text-charcoal">
                  {document.version}
                </dd>
              </div>
            </dl>
          </div>

          <nav
            aria-label={`${document.shortTitle} sections`}
            className="rounded-2xl border border-sage/40 bg-white/70 p-5"
          >
            <p className="eyebrow">On this page</p>
            <ol className="mt-4 space-y-2.5 text-sm text-charcoal/65">
              {document.sections.map((section) => (
                <li key={section.id}>
                  <a
                    href={`#${section.id}`}
                    className="flex gap-2 hover:text-terracotta"
                  >
                    <span className="w-5 shrink-0 text-charcoal/35">
                      {section.number}.
                    </span>
                    <span>{section.title}</span>
                  </a>
                </li>
              ))}
            </ol>
          </nav>

          <div className="rounded-2xl bg-sage/20 p-5 text-sm leading-6 text-charcoal/65">
            <p>Also review our companion document:</p>
            <Link
              href={companion.href}
              className="mt-2 inline-block font-semibold text-terracotta underline decoration-terracotta/30 underline-offset-4 hover:decoration-terracotta"
            >
              {companion.label}
            </Link>
          </div>
        </aside>
      </div>

      <Footer />
    </main>
  );
}

function LegalBlockView({ block }: { block: LegalBlock }) {
  if (block.type === "list") {
    return (
      <ul className="list-disc space-y-2 pl-5 marker:text-terracotta">
        {block.items.map((item) => (
          <li key={item} className="pl-1">
            {item}
          </li>
        ))}
      </ul>
    );
  }

  if (block.type === "contact") {
    return (
      <address className="not-italic">
        <span className="block font-semibold text-charcoal">{block.name}</span>
        <a
          href={`mailto:${block.email}`}
          className="text-terracotta underline decoration-terracotta/30 underline-offset-4 hover:decoration-terracotta"
        >
          {block.email}
        </a>
      </address>
    );
  }

  return <p>{block.text}</p>;
}
