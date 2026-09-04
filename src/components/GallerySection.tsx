"use client";

import Image from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Play, X } from "lucide-react";
import {
  GALLERY_INITIAL_COUNT,
  GALLERY_ITEMS,
  type GalleryItem,
} from "@/lib/gallery";

/**
 * "From the field" — real moments from herd days, in a CSS masonry layout.
 *
 * Content lives in src/lib/gallery.ts; this file only decides how it looks.
 * Tiles open in a lightbox, and video tiles only load the YouTube player once
 * opened, so nothing is requested from Google while someone is just scrolling.
 */
export function GallerySection() {
  const [expanded, setExpanded] = useState(false);
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  if (GALLERY_ITEMS.length === 0) return null;

  const hasMore = GALLERY_ITEMS.length > GALLERY_INITIAL_COUNT;
  const visible =
    hasMore && !expanded
      ? GALLERY_ITEMS.slice(0, GALLERY_INITIAL_COUNT)
      : GALLERY_ITEMS;

  return (
    <section id="gallery" className="bg-ivory py-24">
      <div className="section">
        <div className="mx-auto max-w-2xl text-center">
          <p className="eyebrow">From the field</p>
          <h2 className="mt-3 text-4xl md:text-5xl">Moments with the herd</h2>
          <p className="mt-5 text-lg font-light leading-relaxed text-charcoal/75">
            Unposed and unhurried — a look at what a session out on the land
            actually looks like.
          </p>
        </div>

        {/* CSS masonry: each tile keeps its own height and stacks into columns.
            Two columns even on phones — a full-width portrait photo would run
            taller than the screen. */}
        <div className="mt-14 columns-2 gap-3 sm:gap-4 lg:columns-3">
          {visible.map((item, index) => (
            <GalleryTile
              key={itemKey(item)}
              item={item}
              onOpen={() => setOpenIndex(index)}
            />
          ))}
        </div>

        {hasMore && !expanded && (
          <div className="mt-10 text-center">
            <button
              type="button"
              onClick={() => setExpanded(true)}
              className="btn-secondary"
            >
              Show all {GALLERY_ITEMS.length} moments
            </button>
          </div>
        )}
      </div>

      {openIndex !== null && (
        <Lightbox
          items={visible}
          index={openIndex}
          onIndexChange={setOpenIndex}
          onClose={() => setOpenIndex(null)}
        />
      )}
    </section>
  );
}

function itemKey(item: GalleryItem): string {
  return item.type === "image" ? item.src : `yt-${item.youtubeId}`;
}

/* ---------------------------------------------------------------- tiles --- */

function GalleryTile({
  item,
  onOpen,
}: {
  item: GalleryItem;
  onOpen: () => void;
}) {
  const label =
    item.type === "image" ? "View photo" : `Play video: ${item.title}`;

  return (
    <figure className="mb-3 break-inside-avoid sm:mb-4">
      <button
        type="button"
        onClick={onOpen}
        aria-label={label}
        className="group relative block w-full overflow-hidden rounded-2xl border border-gold/25 bg-sage/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-gold focus-visible:ring-offset-2"
      >
        <TileMedia item={item} />
        {/* Deepens the photo on hover so the tile reads as clickable. */}
        <span className="pointer-events-none absolute inset-0 bg-charcoal/0 transition-colors duration-300 group-hover:bg-charcoal/15" />
        {item.type === "video" && (
          <span className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <span className="flex h-11 w-11 items-center justify-center rounded-full bg-ivory shadow-md transition group-hover:scale-105 sm:h-14 sm:w-14">
              <Play className="ml-0.5 h-5 w-5 fill-terracotta text-terracotta sm:h-6 sm:w-6" />
            </span>
          </span>
        )}
      </button>
      {item.caption && (
        // Too cramped beside a half-width phone tile; the lightbox still shows it.
        <figcaption className="mt-2 hidden px-1 text-sm leading-relaxed text-charcoal/60 sm:block">
          {item.caption}
        </figcaption>
      )}
    </figure>
  );
}

function TileMedia({ item }: { item: GalleryItem }) {
  // A tile is roughly a third of the 72rem container on desktop and half the
  // screen below that — this keeps Next from shipping oversized files.
  const sizes = "(min-width: 1024px) 22rem, 46vw";

  // Everything here sits well below the fold, so all of it stays lazy — the
  // hero keeps the preload budget to itself.
  if (item.type === "image") {
    return (
      <Image
        src={item.src}
        alt={item.alt}
        width={item.width}
        height={item.height}
        sizes={sizes}
        className="h-auto w-full transition-transform duration-500 group-hover:scale-[1.03]"
      />
    );
  }

  if (item.poster) {
    return (
      <Image
        src={item.poster.src}
        alt=""
        width={item.poster.width}
        height={item.poster.height}
        sizes={sizes}
        className="h-auto w-full transition-transform duration-500 group-hover:scale-[1.03]"
      />
    );
  }

  // No still frame yet — a warm placeholder that still reads as a video. A
  // half-width phone tile has no room for the title under the play badge, so
  // there it is carried by the button's aria-label alone.
  return (
    <span className="flex aspect-video w-full items-end bg-gradient-to-br from-sage/40 via-ivory to-gold/30 p-3 sm:p-4">
      <span className="line-clamp-2 font-heading text-lg leading-tight text-charcoal/70 max-sm:hidden">
        {item.title}
      </span>
    </span>
  );
}

/* ------------------------------------------------------------ lightbox --- */

function Lightbox({
  items,
  index,
  onIndexChange,
  onClose,
}: {
  items: GalleryItem[];
  index: number;
  onIndexChange: (next: number) => void;
  onClose: () => void;
}) {
  const item = items[index];
  const closeRef = useRef<HTMLButtonElement>(null);

  const step = useCallback(
    (delta: number) => {
      onIndexChange((index + delta + items.length) % items.length);
    },
    [index, items.length, onIndexChange],
  );

  // Keyboard control, and hold the page still behind the overlay.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
      if (event.key === "ArrowRight") step(1);
      if (event.key === "ArrowLeft") step(-1);
    };
    document.addEventListener("keydown", onKey);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeRef.current?.focus();
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previousOverflow;
    };
  }, [onClose, step]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Gallery"
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center bg-charcoal/95 p-4 backdrop-blur-sm sm:p-8"
    >
      <button
        ref={closeRef}
        type="button"
        onClick={onClose}
        aria-label="Close gallery"
        className="absolute right-4 top-4 flex h-11 w-11 items-center justify-center rounded-full bg-ivory/15 text-ivory transition hover:bg-ivory/30 focus:outline-none focus-visible:ring-2 focus-visible:ring-gold"
      >
        <X className="h-5 w-5" />
      </button>

      {items.length > 1 && (
        <>
          <LightboxArrow side="left" onClick={() => step(-1)} />
          <LightboxArrow side="right" onClick={() => step(1)} />
        </>
      )}

      {/* Clicks on the media itself must not dismiss the overlay. */}
      <figure
        onClick={(event) => event.stopPropagation()}
        className="flex max-h-full w-full max-w-4xl flex-col items-center gap-4"
      >
        {item.type === "image" ? (
          <Image
            src={item.src}
            alt={item.alt}
            width={item.width}
            height={item.height}
            sizes="(min-width: 1024px) 56rem, 92vw"
            className="max-h-[76vh] w-auto rounded-2xl object-contain"
          />
        ) : (
          <div className="aspect-video w-full overflow-hidden rounded-2xl bg-black">
            <iframe
              // nocookie, and mounted only on open, so YouTube sees nobody who
              // merely scrolled past the gallery.
              src={`https://www.youtube-nocookie.com/embed/${item.youtubeId}?autoplay=1&rel=0`}
              title={item.title}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              className="h-full w-full"
            />
          </div>
        )}

        {item.caption && (
          <figcaption className="max-w-xl text-center text-sm leading-relaxed text-ivory/80">
            {item.caption}
          </figcaption>
        )}
      </figure>
    </div>
  );
}

function LightboxArrow({
  side,
  onClick,
}: {
  side: "left" | "right";
  onClick: () => void;
}) {
  const Icon = side === "left" ? ChevronLeft : ChevronRight;
  return (
    <button
      type="button"
      aria-label={side === "left" ? "Previous" : "Next"}
      onClick={(event) => {
        event.stopPropagation();
        onClick();
      }}
      className={`absolute top-1/2 z-10 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-ivory/15 text-ivory transition hover:bg-ivory/30 focus:outline-none focus-visible:ring-2 focus-visible:ring-gold ${
        side === "left" ? "left-2 sm:left-6" : "right-2 sm:right-6"
      }`}
    >
      <Icon className="h-6 w-6" />
    </button>
  );
}
