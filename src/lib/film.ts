/**
 * The short film on the home page — a 30-second piece cut for social, shown
 * here in its own band above the photo gallery.
 *
 * ─── REPLACING THE FILM ────────────────────────────────────────────────────
 * It is served straight from `public/`, not YouTube, so the page stays quiet:
 * nothing is requested from anyone until a visitor presses play, and there are
 * no recommendations or branding on top of it afterwards. The trade is that we
 * pay for the bytes, so the file has to be compressed before it lands here.
 *
 * 1. Encode to H.264/AAC with the moov atom up front (`+faststart`), or the
 *    browser has to fetch the whole file before it can start playing:
 *      ffmpeg -i raw.mp4 -c:v libx264 -preset slow -crf 28 -pix_fmt yuv420p \
 *        -c:a aac -b:a 96k -movflags +faststart public/video/name.mp4
 *    CRF 28 took the original 22 MB export down to 4.8 MB with no visible
 *    difference at the size it actually plays. Aim to stay under ~6 MB.
 * 2. Pull a poster frame from a moment that reads well as a still:
 *      ffmpeg -ss 10 -i raw.mp4 -frames:v 1 -vf scale=720:1280 \
 *        -c:v libwebp -quality 72 public/video/name-poster.webp
 *    The poster is a plain <video poster> rather than a next/image, so the
 *    still stays put if the video itself ever fails to load.
 * 3. Update the fields below, including `aspect` if the new cut is not vertical.
 */

export const FILM = {
  /** Path under /public. */
  src: "/video/velvet-bridle.mp4",
  /** Still frame shown before play, and again if playback fails. */
  poster: "/video/velvet-bridle-poster.webp",
  /** Tailwind aspect ratio — this cut is vertical, filmed on a phone. */
  aspect: "aspect-[9/16]",
  /** Used as the player's accessible name and on the play button. */
  title: "Reiki with the horses — a 30-second film",
  /** Spoken by nobody: the film is music and on-screen text, described here
   *  so the section still makes sense to a screen reader or with sound off. */
  description:
    "Thirty seconds in the pasture: a client face down on the table under a big Colorado sky, a horse lowering its nose to their head, and the words Breathe, Reconnect, Remember.",
  runtime: "0:30",
};
