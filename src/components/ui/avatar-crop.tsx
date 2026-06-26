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

/** Visible preview size in CSS px (canvas is 1:1 here — no DPR scaling needed for preview) */
const PREVIEW = 280;
/** Exported JPEG size */
const EXPORT_PX = 512;

export function AvatarCropModal({
  src,
  onConfirm,
  onClose,
}: {
  src: string;
  onConfirm: (blob: Blob) => void;
  onClose: () => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const [loaded, setLoaded] = useState(false);

  /** zoom=1: shortest side fills the circle exactly */
  const [zoom, setZoom] = useState(1);
  /** offset: image coordinate (in natural px) of the circle center */
  const [offset, setOffset] = useState({ x: 0, y: 0 });

  const dragStart = useRef<{
    px: number; py: number; ox: number; oy: number;
  } | null>(null);

  // ── Load ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    const img = new Image();
    img.onload = () => {
      imgRef.current = img;
      setZoom(1);
      setOffset({ x: img.naturalWidth / 2, y: img.naturalHeight / 2 });
      setLoaded(true);
    };
    img.src = src;
    return () => { setLoaded(false); imgRef.current = null; };
  }, [src]);

  // ── Helpers ────────────────────────────────────────────────────────────────
  /** How many natural image px fill the preview circle at current zoom. */
  function imgSpan(z: number) {
    const img = imgRef.current!;
    return Math.min(img.naturalWidth, img.naturalHeight) / z;
  }

  /** Keep the crop square fully inside the image. */
  function clamp(ox: number, oy: number, z: number) {
    const img = imgRef.current!;
    const half = imgSpan(z) / 2;
    return {
      x: Math.max(half, Math.min(img.naturalWidth  - half, ox)),
      y: Math.max(half, Math.min(img.naturalHeight - half, oy)),
    };
  }

  // ── Draw preview ───────────────────────────────────────────────────────────
  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    const img = imgRef.current;
    if (!canvas || !img) return;

    const ctx = canvas.getContext("2d")!;
    const R = PREVIEW / 2;
    const span = imgSpan(zoom);
    const sx = offset.x - span / 2;
    const sy = offset.y - span / 2;

    ctx.clearRect(0, 0, PREVIEW, PREVIEW);

    // ── dim area outside circle ──
    ctx.fillStyle = "rgba(0,0,0,0.55)";
    ctx.fillRect(0, 0, PREVIEW, PREVIEW);

    // ── clip to circle and draw image ──
    ctx.save();
    ctx.beginPath();
    ctx.arc(R, R, R, 0, Math.PI * 2);
    ctx.clip();
    ctx.drawImage(img, sx, sy, span, span, 0, 0, PREVIEW, PREVIEW);
    ctx.restore();

    // ── thin ring ──
    ctx.strokeStyle = "rgba(255,255,255,0.35)";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(R, R, R - 1, 0, Math.PI * 2);
    ctx.stroke();

    // ── rule-of-thirds grid (inside circle only) ──
    ctx.save();
    ctx.beginPath();
    ctx.arc(R, R, R, 0, Math.PI * 2);
    ctx.clip();
    ctx.strokeStyle = "rgba(255,255,255,0.15)";
    ctx.lineWidth = 1;
    for (let i = 1; i < 3; i++) {
      const v = (PREVIEW / 3) * i;
      ctx.beginPath(); ctx.moveTo(v, 0); ctx.lineTo(v, PREVIEW); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, v); ctx.lineTo(PREVIEW, v); ctx.stroke();
    }
    ctx.restore();
  }, [offset, zoom]);

  useEffect(() => { draw(); }, [draw, loaded]);

  // ── Pointer drag ───────────────────────────────────────────────────────────
  function onPointerDown(e: ReactPointerEvent<HTMLCanvasElement>) {
    e.currentTarget.setPointerCapture(e.pointerId);
    dragStart.current = { px: e.clientX, py: e.clientY, ox: offset.x, oy: offset.y };
  }

  function onPointerMove(e: ReactPointerEvent<HTMLCanvasElement>) {
    if (!dragStart.current || !imgRef.current) return;
    const span = imgSpan(zoom);
    const scale = span / PREVIEW; // image px per canvas px
    const next = clamp(
      dragStart.current.ox - (e.clientX - dragStart.current.px) * scale,
      dragStart.current.oy - (e.clientY - dragStart.current.py) * scale,
      zoom,
    );
    setOffset(next);
  }

  function onPointerUp() { dragStart.current = null; }

  function onWheel(e: ReactWheelEvent<HTMLCanvasElement>) {
    e.preventDefault();
    const delta = e.deltaY < 0 ? 0.1 : -0.1;
    setZoom((z) => {
      const next = Math.max(0.5, Math.min(6, z + delta));
      setOffset((o) => clamp(o.x, o.y, next));
      return next;
    });
  }

  // ── Export — offscreen canvas, NO decorations ──────────────────────────────
  function handleConfirm() {
    const img = imgRef.current;
    if (!img) return;

    const span = imgSpan(zoom);
    const sx = offset.x - span / 2;
    const sy = offset.y - span / 2;

    const off = document.createElement("canvas");
    off.width  = EXPORT_PX;
    off.height = EXPORT_PX;
    off.getContext("2d")!.drawImage(img, sx, sy, span, span, 0, 0, EXPORT_PX, EXPORT_PX);

    off.toBlob(
      (blob) => { if (blob) onConfirm(blob); },
      "image/jpeg",
      0.93,
    );
  }

  // ── Escape key ────────────────────────────────────────────────────────────
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
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

          {/* Canvas preview */}
          <div className="flex justify-center">
            <canvas
              ref={canvasRef}
              width={PREVIEW}
              height={PREVIEW}
              className="cursor-grab rounded-full active:cursor-grabbing"
              style={{ width: PREVIEW, height: PREVIEW, touchAction: "none" }}
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
              onPointerLeave={onPointerUp}
              onWheel={onWheel}
            />
          </div>

          <p className="mt-3 text-center text-xs text-neutral-500">
            Перетаскивайте · колёсико — масштаб
          </p>

          {/* Zoom slider */}
          <div className="mt-4 flex items-center gap-3">
            <ZoomOut className="h-4 w-4 shrink-0 text-neutral-500" />
            <input
              type="range"
              min={0.5}
              max={6}
              step={0.01}
              value={zoom}
              onChange={(e) => {
                const next = parseFloat(e.target.value);
                setZoom(next);
                setOffset((o) => clamp(o.x, o.y, next));
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
