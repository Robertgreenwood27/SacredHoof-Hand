"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { Play } from "lucide-react";
import { FILM } from "@/lib/film";

/**
 * The 30-second film, in a dark band between the horse programme and the
 * gallery — the one polished piece before the candid photos.
 *
 * Content lives in src/lib/film.ts; this file only decides how it looks.
 * Nothing downloads until someone presses play: the video is `preload="none"`
 * and only the poster frame is fetched while a visitor is scrolling past.
 */
export function FilmSection() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [started, setStarted] = useState(false);

  const start = () => {
    setStarted(true);
    // Controls appear either way, so a browser that declines the gesture still
    // leaves the visitor a play button of its own.
    videoRef.current?.play().catch(() => {});
  };

  return (
    <section id="film" className="bg-charcoal py-24 text-ivory">
      <div className="section grid items-center gap-10 lg:grid-cols-2 lg:gap-14">
        {/* On a phone the film belongs between the copy and the buttons —
            nobody should have to scroll back up to book after watching it. The
            wrapper collapses to `contents` so its two halves become grid items
            of their own and the player can sit between them; from lg it turns
            back into one block and takes the left column. */}
        <div className="contents lg:block">
          <div className="order-1 lg:order-none">
            <p className="eyebrow text-gold">The film</p>
            <h2 className="mt-3 text-4xl text-ivory md:text-5xl">
              Thirty seconds in the pasture
            </h2>
            <p className="mt-5 text-lg font-light leading-relaxed text-ivory/75">
              Big sky, a table in the field, and a horse who decides on her own
              when to come close. This is the pace of it — nothing hurried,
              nothing asked of you.
            </p>
            <p className="mt-3 text-sm text-ivory/50">
              {FILM.runtime} · best with sound
            </p>
          </div>

          <div className="order-3 flex flex-col gap-3 sm:flex-row lg:order-none lg:mt-9">
            <Link href="/book?service=equine-60" className="btn-primary">
              Book a session with the horses
            </Link>
            <Link
              href="/#gallery"
              className="inline-flex items-center justify-center gap-2 rounded-full border border-ivory/50 px-7 py-3 text-sm font-semibold uppercase tracking-wide text-ivory transition hover:bg-ivory hover:text-charcoal focus:outline-none focus-visible:ring-2 focus-visible:ring-gold focus-visible:ring-offset-2 focus-visible:ring-offset-charcoal"
            >
              See more from the field
            </Link>
          </div>
        </div>

        {/* Filmed on a phone, so the player is a portrait pane rather than a
            full-width band — at 16:9 it would tower over the copy beside it. */}
        <div className="order-2 mx-auto w-full max-w-[17rem] sm:max-w-[19rem] lg:order-none lg:mx-0 lg:ml-auto lg:max-w-[21rem]">
          <div
            className={`relative overflow-hidden rounded-3xl border border-gold/25 bg-black shadow-2xl ${FILM.aspect}`}
          >
            <video
              ref={videoRef}
              src={FILM.src}
              poster={FILM.poster}
              preload="none"
              playsInline
              controls={started}
              aria-label={FILM.title}
              className="h-full w-full object-cover"
            />
            {!started && (
              <button
                type="button"
                onClick={start}
                aria-label={`Play the film: ${FILM.title}`}
                // Undimmed at rest, like the gallery tiles — a phone has no
                // hover, and the badge is affordance enough.
                className="group absolute inset-0 flex items-center justify-center bg-charcoal/0 transition-colors hover:bg-charcoal/20 focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-gold"
              >
                <span className="flex h-16 w-16 items-center justify-center rounded-full bg-ivory shadow-lg transition group-hover:scale-105">
                  <Play className="ml-1 h-7 w-7 fill-terracotta text-terracotta" />
                </span>
              </button>
            )}
          </div>
          {/* The film carries its meaning in music and on-screen words, so it
              is spelled out here for anyone who cannot see or hear it. */}
          <p className="sr-only">{FILM.description}</p>
        </div>
      </div>
    </section>
  );
}
