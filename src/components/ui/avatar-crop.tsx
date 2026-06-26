"use client";

import {
  useEffect,
  useRef,
  useState,
  useCallback,
  type PointerEvent as ReactPointerEvent,
  type WheelEvent as ReactWheelEvent,
} from "react";
import { motion, AnimatePresence } from "motion/react";
import { X, ZoomIn, ZoomOut, Check } from "lucide-react";
import { Button } from "@/components/ui/button";

const SIZE = 300; // canvas / preview diameter in px

export function AvatarCropModal({
  src,
  onConfirm,
  onClose,
}: {
  src: string;             // object URL from file picker
  onConfirm: (blob: Blob) => void;
  onClose: () => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const [loaded, setLoaded] = useState(false);

  // zoom: fraction of the image's shorter dimension that fills the circle
  const [zoom, setZoom] = useState(1);
  // offset: pan in image pixels (center of circle maps to this image coord)
  const [offset, setOffset] = useState({ x: 0, y: 0 });

  const dragStart = useRef<{ px: number; py: number; ox: number; oy: number } | null>(null);

  // Load image once src changes
  useEffect(() => {
    const img = new Image();
    img.onload = () => {
      imgRef.current = img;
      setZoom(1);
      setOffset({ x: img.naturalWidth / 2, y: img.naturalHeight / 2 });
      setLoaded(true);
    };
    img.src = src;
    return () => {
      setLoaded(false);
      imgRef.current = null;
    };
  }, [src]);

  // Draw whenever state changes
  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    const img = imgRef.current;
    if (!canvas || !img) return;
    const ctx = canvas.getContext("2d")!;
    const R = SIZE / 2;

    // How many image pixels fit the circle at current zoom
    const minDim = Math.min(img.naturalWidth, img.naturalHeight);
    const imgSpan = minDim / zoom; // image pixels shown across circle diameter

    const scale = SIZE / imgSpan; // canvas px per image px
    const sx = offset.x - imgSpan / 2;
    const sy = offset.y - imgSpan / 2;

    ctx.clearRect(0, 0, SIZE, SIZE);

    // Clip to circle
    ctx.save();
    ctx.beginPath();
    ctx.arc(R, R, R, 0, Math.PI * 2);
    ctx.clip();
    ctx.drawImage(
      img,
      sx, sy, imgSpan, imgSpan,
      0, 0, SIZE, SIZE,
    );
    ctx.restore();

    // Dark ring
    ctx.strokeStyle = "rgba(255,255,255,0.25)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(R, R, R - 1, 0, Math.PI * 2);
    ctx.stroke();

    // Grid overlay
    ctx.strokeStyle = "rgba(255,255,255,0.12)";
    ctx.lineWidth = 1;
    for (let i = 1; i < 3; i++) {
      const x = (SIZE / 3) * i;
      const y = (SIZE / 3) * i;
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, SIZE); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(SIZE, y); ctx.stroke();
    }
    void scale; // suppress unused warning
  }, [offset, zoom]);

  useEffect(() => { draw(); }, [draw, loaded]);

  // Clamp offset so the circle stays within the image
  function clampOffset(ox: number, oy: number, currentZoom: number) {
    const img = imgRef.current!;
    const minDim = Math.min(img.naturalWidth, img.naturalHeight);
    const half = (minDim / currentZoom) / 2;
    return {
      x: Math.max(half, Math.min(img.naturalWidth - half, ox)),
      y: Math.max(half, Math.min(img.naturalHeight - half, oy)),
    };
  }

  function onPointerDown(e: ReactPointerEvent<HTMLCanvasElement>) {
    e.currentTarget.setPointerCapture(e.pointerId);
    dragStart.current = { px: e.clientX, py: e.clientY, ox: offset.x, oy: offset.y };
  }

  function onPointerMove(e: ReactPointerEvent<HTMLCanvasElement>) {
    if (!dragStart.current || !imgRef.current) return;
    const img = imgRef.current;
    const minDim = Math.min(img.naturalWidth, img.naturalHeight);
    const imgSpan = minDim / zoom;
    const pxPerImgPx = SIZE / imgSpan;

    const dx = (e.clientX - dragStart.current.px) / pxPerImgPx;
    const dy = (e.clientY - dragStart.current.py) / pxPerImgPx;
    const next = clampOffset(
      dragStart.current.ox - dx,
      dragStart.current.oy - dy,
      zoom,
    );
    setOffset(next);
  }

  function onPointerUp() { dragStart.current = null; }

  function onWheel(e: ReactWheelEvent<HTMLCanvasElement>) {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -0.08 : 0.08;
    setZoom((z) => {
      const next = Math.max(0.5, Math.min(5, z + delta));
      setOffset((o) => clampOffset(o.x, o.y, next));
      return next;
    });
  }

  function handleConfirm() {
    const canvas = canvasRef.current!;
    canvas.toBlob(
      (blob) => { if (blob) onConfirm(blob); },
      "image/jpeg",
      0.92,
    );
  }

  // Escape key
  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === "Escape") onClose(); }
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [onClose]);

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[100] flex items-center justify-center">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="absolute inset-0 bg-black/75 backdrop-blur-sm"
        />
        <motion.div
          initial={{ opacity: 0, scale: 0.94, y: 16 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.94, y: 16 }}
          transition={{ type: "spring", stiffness: 340, damping: 30 }}
          className="glass-strong relative z-10 w-full max-w-sm rounded-2xl p-6 shadow-2xl"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-neutral-100">Выбрать область</h2>
            <button
              onClick={onClose}
              className="rounded-md p-1.5 text-neutral-400 transition hover:bg-white/5 hover:text-neutral-200"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Canvas */}
          <div className="flex justify-center">
            <canvas
              ref={canvasRef}
              width={SIZE}
              height={SIZE}
              className="cursor-grab rounded-full active:cursor-grabbing"
              style={{ width: SIZE, height: SIZE, touchAction: "none" }}
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
              onPointerLeave={onPointerUp}
              onWheel={onWheel}
            />
          </div>

          {/* Hint */}
          <p className="mt-3 text-center text-xs text-neutral-500">
            Перетаскивайте · колёсиком прокрутки — масштаб
          </p>

          {/* Zoom slider */}
          <div className="mt-4 flex items-center gap-3">
            <ZoomOut className="h-4 w-4 shrink-0 text-neutral-500" />
            <input
              type="range"
              min={0.5}
              max={5}
              step={0.01}
              value={zoom}
              onChange={(e) => {
                const next = parseFloat(e.target.value);
                setZoom(next);
                setOffset((o) => clampOffset(o.x, o.y, next));
              }}
              className="h-1.5 flex-1 cursor-pointer appearance-none rounded-full bg-white/10 accent-sky-400"
            />
            <ZoomIn className="h-4 w-4 shrink-0 text-neutral-500" />
          </div>

          {/* Actions */}
          <div className="mt-5 flex gap-3">
            <Button variant="secondary" className="flex-1" onClick={onClose}>
              Отмена
            </Button>
            <Button className="flex-1" onClick={handleConfirm} disabled={!loaded}>
              <Check className="h-4 w-4" />
              Готово
            </Button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
