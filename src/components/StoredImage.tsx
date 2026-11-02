"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { getScreenshotUrl } from "@/lib/supabase/screenshots";

type StoredImageProps = {
  path: string;
  alt: string;
  className?: string;
  zoomable?: boolean;
};

export default function StoredImage({ path, alt, className = "", zoomable = false }: StoredImageProps) {
  const [url, setUrl] = useState<string | null>(path.startsWith("data:") ? path : null);
  const [zoomed, setZoomed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getScreenshotUrl(path).then((result) => {
      if (!cancelled) setUrl(result);
    });
    return () => {
      cancelled = true;
    };
  }, [path]);

  if (!url) return <div className={`bg-black/5 animate-pulse ${className}`} />;
  if (!zoomable) return <img src={url} alt={alt} className={className} />;

  return (
    <>
      <button type="button" onClick={() => setZoomed(true)} className="block w-full h-full cursor-zoom-in" aria-label={`Open ${alt}`}>
        <img src={url} alt={alt} className={className} />
      </button>
      {zoomed && <ImageViewer url={url} alt={alt} onClose={() => setZoomed(false)} />}
    </>
  );
}

function ImageViewer({ url, alt, onClose }: { url: string; alt: string; onClose: () => void }) {
  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => event.key === "Escape" && onClose();
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [onClose]);

  return createPortal(
    <div className="fixed inset-0 z-[100] bg-black/85 grid place-items-center p-4 fade-in" onClick={onClose} role="dialog" aria-modal="true" aria-label={alt}>
      <button onClick={onClose} className="absolute top-4 right-4 size-10 grid place-items-center rounded-full bg-white/10 text-white hover:bg-white/20" aria-label="Close">
        <X size={20} />
      </button>
      <img src={url} alt={alt} className="max-h-[calc(100dvh-2rem)] max-w-[calc(100vw-2rem)] rounded-lg object-contain" onClick={(event) => event.stopPropagation()} />
    </div>,
    document.body
  );
}
