/**
 * The "From the field" gallery on the home page.
 *
 * ─── ADDING A PHOTO ────────────────────────────────────────────────────────
 * 1. Drop the file in `public/gallery/`. WebP keeps the page fast — convert
 *    a phone photo with:
 *      npx sharp-cli -i photo.jpg -o public/gallery/name.webp resize 1200 1600 --fit inside
 * 2. Add an entry below with its real pixel width/height (so the tile reserves
 *    the right space and nothing jumps as it loads).
 *
 * ─── ADDING A VIDEO ────────────────────────────────────────────────────────
 * Upload to YouTube, then add an entry with the id from the watch URL —
 * `youtube.com/watch?v=ABC123xyz` → `youtubeId: "ABC123xyz"`. A `poster` is
 * optional; without one the tile renders a warm placeholder with a play button.
 *
 * Order here is the order on the page. Newest-and-best first works well: the
 * first few tiles are what most people actually look at.
 */

export type GalleryItem =
  | {
      type: "image";
      /** Path under /public, e.g. "/gallery/session-table.webp". */
      src: string;
      /** Intrinsic pixel size — prevents layout shift while loading. */
      width: number;
      height: number;
      /** Described for screen readers. Say what is happening, not "photo of". */
      alt: string;
      /** Optional line shown under the tile and in the lightbox. */
      caption?: string;
    }
  | {
      type: "video";
      /** The `v=` parameter from the YouTube watch URL. */
      youtubeId: string;
      /** Shown on the tile and used as the player's accessible name. */
      title: string;
      /** Optional still frame under /public. Falls back to a warm placeholder. */
      poster?: { src: string; width: number; height: number };
      caption?: string;
    };

export const GALLERY_ITEMS: GalleryItem[] = [
  {
    type: "image",
    src: "/gallery/session-table.webp",
    width: 1200,
    height: 1600,
    alt: "A client resting face down on a massage table in a fenced pasture while a chestnut horse stands over them, nose lowered toward their head.",
    caption: "Out in the field — the herd stays close through the whole session.",
  },
  {
    type: "image",
    src: "/gallery/herd-visit.webp",
    width: 1200,
    height: 1600,
    alt: "A chestnut horse leaning in over a client on the table, with a second horse watching from the shade of an open shelter.",
    caption: "The horses come in when they are ready, not before.",
  },
  {
    type: "image",
    src: "/gallery/shade-and-shelter.webp",
    width: 1200,
    height: 1600,
    alt: "Two horses in a Colorado pasture under tall summer clouds, one in the shelter and one beside the table.",
    caption: "An afternoon with the herd in Fairplay.",
  },

  // Once the session video is up on YouTube, uncomment this and paste the id:
  // {
  //   type: "video",
  //   youtubeId: "REPLACE_WITH_YOUTUBE_ID",
  //   title: "A session with the horses",
  //   caption: "A few minutes in the pasture, start to finish.",
  // },
];

/**
 * Tiles shown before the "Show more" button appears. Six fills two rows of the
 * three-column layout; anything past that stays folded away until asked for.
 */
export const GALLERY_INITIAL_COUNT = 6;
