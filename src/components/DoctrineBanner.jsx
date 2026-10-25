import { useRef } from "react";

////////////////////////////////////////////////////////////////
// DOCTRINE BANNER
//
// The header photo on the Doctrine page. The photo itself is never cropped
// or re-uploaded: how it's framed is saved beside it as four numbers, so
// it can be re-adjusted any time and the original stays intact.
//   focusX / focusY   0–100  which part of the photo is centered in view
//   zoom              1–3    1 = fill the banner, 2 = twice as close…
//   height            px     how tall the banner is
// The defaults (50, 50, 1, 200) are exactly how the banner looked before
// these settings existed. The public page and the admin preview both render
// through this component, so what you see when adjusting is what visitors get.
////////////////////////////////////////////////////////////////

export const BANNER_DEFAULTS = { focusX: 50, focusY: 50, zoom: 1, height: 200 };
export const BANNER_LIMITS = { zoom: [1, 3], height: [120, 360] };

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const toNum = (v, fallback) => (Number.isFinite(Number(v)) && v !== "" && v !== null && v !== undefined ? Number(v) : fallback);

// Settings as stored on the doctrine week document -> clean, in-range numbers.
export function bannerSettings(doc) {
  return {
    focusX: clamp(toNum(doc?.imageFocusX, BANNER_DEFAULTS.focusX), 0, 100),
    focusY: clamp(toNum(doc?.imageFocusY, BANNER_DEFAULTS.focusY), 0, 100),
    zoom: clamp(toNum(doc?.imageZoom, BANNER_DEFAULTS.zoom), ...BANNER_LIMITS.zoom),
    height: clamp(Math.round(toNum(doc?.imageHeight, BANNER_DEFAULTS.height)), ...BANNER_LIMITS.height),
  };
}

/**
 * @param {string}   url
 * @param {object}   settings   { focusX, focusY, zoom, height } (see bannerSettings)
 * @param {boolean}  bleed      extend to the card's edges (public page) instead of a plain box
 * @param {function} onChange   when given, the banner can be dragged to reposition; called with { focusX, focusY }
 */
export default function DoctrineBanner({ url, settings, bleed = false, onChange }) {
  const { focusX, focusY, zoom, height } = settings;
  const boxRef = useRef(null);
  const imgRef = useRef(null);
  const drag = useRef(null);

  const wrapStyle = {
    position: "relative",
    overflow: "hidden",
    height: `${height}px`,
    background: "var(--color-fdf1de)",
    ...(bleed
      ? { width: "calc(100% + 44px)", margin: "-24px -22px 20px" }
      : { width: "100%", borderRadius: "10px", border: "1px solid var(--color-eddfc8)" }),
    ...(onChange ? { cursor: drag.current ? "grabbing" : "grab", touchAction: "none", userSelect: "none" } : {}),
  };

  // The photo sits in a box `zoom` times the banner's size; the box is shifted
  // and the photo positioned inside it so that (focusX, focusY) stays in view.
  const imgStyle = {
    position: "absolute",
    width: `${zoom * 100}%`,
    height: `${zoom * 100}%`,
    left: `${-(zoom - 1) * focusX}%`,
    top: `${-(zoom - 1) * focusY}%`,
    objectFit: "cover",
    objectPosition: `${focusX}% ${focusY}%`,
    display: "block",
    pointerEvents: "none",
  };

  const onPointerDown = (e) => {
    if (!onChange || !boxRef.current || !imgRef.current) return;
    boxRef.current.setPointerCapture?.(e.pointerId);
    drag.current = { x: e.clientX, y: e.clientY, fx: focusX, fy: focusY };
  };

  const onPointerMove = (e) => {
    const d = drag.current;
    const img = imgRef.current;
    if (!d || !onChange || !img || !img.naturalWidth) return;
    const box = boxRef.current.getBoundingClientRect();
    // How far the photo overflows the banner on each axis at this zoom — that
    // is the distance one full 0→100 focus sweep has to cover.
    const cover = Math.max((box.width * zoom) / img.naturalWidth, (box.height * zoom) / img.naturalHeight);
    const extraX = img.naturalWidth * cover - box.width;
    const extraY = img.naturalHeight * cover - box.height;
    // Dragging the photo right/down reveals what's to its left/above.
    const nx = extraX > 1 ? clamp(d.fx - ((e.clientX - d.x) / extraX) * 100, 0, 100) : d.fx;
    const ny = extraY > 1 ? clamp(d.fy - ((e.clientY - d.y) / extraY) * 100, 0, 100) : d.fy;
    onChange({ focusX: Math.round(nx * 10) / 10, focusY: Math.round(ny * 10) / 10 });
  };

  const endDrag = () => { drag.current = null; };

  return (
    <div
      ref={boxRef}
      style={wrapStyle}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
    >
      <img ref={imgRef} src={url} alt="" style={imgStyle} draggable={false} />
    </div>
  );
}
