"use client";

import { useEffect, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import { X, Download } from "lucide-react";

type LightboxItem =
  | { kind: "image"; src: string; name?: string }
  | { kind: "video"; src: string; name?: string };

export function MediaLightbox({
  item,
  onClose,
}: {
  item: LightboxItem | null;
  onClose: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (!item) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [item, onClose]);

  return (
    <AnimatePresence>
      {item && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/90 backdrop-blur-md"
          />

          {/* Content */}
          <motion.div
            initial={{ opacity: 0, scale: 0.92 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.92 }}
            transition={{ type: "spring", stiffness: 340, damping: 30 }}
            className="relative z-10 flex max-h-[92dvh] max-w-[92vw] flex-col items-center"
            onClick={(e) => e.stopPropagation()}
          >
            {item.kind === "image" ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={item.src}
                alt={item.name ?? ""}
                className="max-h-[85dvh] max-w-[92vw] rounded-xl object-contain shadow-2xl"
                draggable={false}
              />
            ) : (
              <video
                ref={videoRef}
                src={item.src}
                controls
                autoPlay
                className="max-h-[85dvh] max-w-[92vw] rounded-xl shadow-2xl"
              />
            )}

            {/* Name bar */}
            {item.name && (
              <p className="mt-2 truncate text-sm text-neutral-400">{item.name}</p>
            )}
          </motion.div>

          {/* Toolbar */}
          <div className="absolute right-4 top-4 z-20 flex items-center gap-2">
            {item.kind === "image" && (
              <a
                href={item.src}
                download={item.name}
                title="Скачать"
                className="flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-neutral-300 backdrop-blur hover:bg-white/20 hover:text-white"
              >
                <Download className="h-4 w-4" />
              </a>
            )}
            <button
              onClick={onClose}
              title="Закрыть"
              className="flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-neutral-300 backdrop-blur hover:bg-white/20 hover:text-white"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>
      )}
    </AnimatePresence>
  );
}
