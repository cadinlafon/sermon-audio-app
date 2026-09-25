// A short burst of confetti (skipped when reduced motion is on).
export function celebrate() {
  if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
  const canvas = document.createElement("canvas");
  canvas.style.cssText = "position:fixed;inset:0;width:100%;height:100%;pointer-events:none;z-index:9500";
  canvas.width = window.innerWidth; canvas.height = window.innerHeight;
  document.body.appendChild(canvas);
  const ctx = canvas.getContext("2d");
  const colors = ["#c97c2e", "#e08930", "#fde8b8", "#2f8a4a", "#3b6ea8", "#b3432c"];
  const bits = Array.from({ length: 120 }, () => ({ x: canvas.width / 2, y: canvas.height * 0.4, vx: (Math.random() - 0.5) * 14, vy: -Math.random() * 14 - 4, s: 4 + Math.random() * 6, c: colors[Math.floor(Math.random() * colors.length)], r: Math.random() * 6 }));
  const start = performance.now();
  const frame = (now) => {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    for (const b of bits) { b.vy += 0.35; b.x += b.vx; b.y += b.vy; b.r += 0.2; ctx.save(); ctx.translate(b.x, b.y); ctx.rotate(b.r); ctx.fillStyle = b.c; ctx.fillRect(-b.s / 2, -b.s / 2, b.s, b.s * 0.6); ctx.restore(); }
    if (now - start < 2600) requestAnimationFrame(frame); else canvas.remove();
  };
  requestAnimationFrame(frame);
}
