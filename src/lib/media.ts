// Works out how to render a pasted media link in a post: a picture, a direct
// video file, or an embeddable YouTube / Vimeo video. Members can't upload to
// Storage, so every picture/video is an EXTERNAL link — this lets an admin
// just paste the URL and have it render inline.

export type MediaKind = "image" | "video" | "youtube" | "vimeo" | "file";

export interface MediaInfo {
  kind: MediaKind;
  /** For youtube / vimeo: the iframe src to embed. */
  embedUrl?: string;
}

function youtubeId(url: string): string | null {
  const m = url.match(
    /(?:youtube\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/|live\/)|youtu\.be\/)([A-Za-z0-9_-]{6,})/,
  );
  return m ? m[1] : null;
}

function vimeoId(url: string): string | null {
  const m = url.match(/vimeo\.com\/(?:video\/)?(\d+)/);
  return m ? m[1] : null;
}

/** Classify a media URL. Unknown links default to "image" (the most common
 *  case — many image CDNs serve pictures from extension-less URLs). */
export function classifyMedia(url: string): MediaInfo {
  const u = (url || "").trim();
  const path = u.split("?")[0].split("#")[0].toLowerCase();

  const yt = youtubeId(u);
  if (yt) return { kind: "youtube", embedUrl: `https://www.youtube.com/embed/${yt}` };

  const vm = vimeoId(u);
  if (vm) return { kind: "vimeo", embedUrl: `https://player.vimeo.com/video/${vm}` };

  if (/\.(mp4|webm|ogg|ogv|mov|m4v)$/.test(path)) return { kind: "video" };
  if (/\.(jpe?g|png|gif|webp|avif|svg|bmp|heic)$/.test(path)) return { kind: "image" };

  return { kind: "image" };
}

/** What to store in a post's `mediaType` field for a given link. */
export function storedMediaType(url: string): "image" | "video" {
  return classifyMedia(url).kind === "image" ? "image" : "video";
}
