/* eslint-disable @next/next/no-img-element */
"use client";

import { useT } from "@/context/LanguageContext";
import { classifyMedia } from "@/lib/media";

export default function MediaAttachment({
  url,
  type,
  name,
}: {
  url: string;
  type?: "image" | "video" | "file";
  name?: string;
}) {
  const { t } = useT();

  // Uploaded documents keep their stored "file" type; everything else is
  // decided from the URL so a pasted picture or video link always renders.
  if (type === "file") {
    return (
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-2 flex items-center gap-2 rounded-xl bg-brand-soft px-3 py-2 text-xs font-semibold text-brand"
      >
        📄 <span className="truncate">{name ?? t("attachment")}</span>
      </a>
    );
  }

  const info = classifyMedia(url);

  if (info.kind === "youtube" || info.kind === "vimeo") {
    return (
      <div className="mt-2 aspect-video w-full overflow-hidden rounded-xl bg-black">
        <iframe
          src={info.embedUrl}
          title={name ?? t("attachedVideo")}
          className="h-full w-full"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          allowFullScreen
        />
      </div>
    );
  }

  if (info.kind === "video" || type === "video") {
    return (
      <video
        src={url}
        controls
        playsInline
        preload="metadata"
        className="mt-2 max-h-80 w-full rounded-xl bg-black"
      />
    );
  }

  return (
    <a href={url} target="_blank" rel="noopener noreferrer" className="block">
      <img
        src={url}
        alt={name ?? t("attachedImage")}
        className="mt-2 max-h-72 w-auto max-w-full rounded-xl object-contain"
        loading="lazy"
      />
    </a>
  );
}
