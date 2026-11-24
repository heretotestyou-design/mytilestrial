"use client";

// Glowing particle constellation that drifts and parts around the cursor.
// Dependency-free canvas 2D. Pauses when off-screen; static when the user
// prefers reduced motion.
import { useEffect, useRef } from "react";

type Props = {
  className?: string;
  density?: number; // particles per 10,000 px²
  color?: string; // "r,g,b"
  linkDistance?: number;
};

type P = { x: number; y: number; vx: number; vy: number; r: number; a: number };

export function ParticleField({ className, density = 0.9, color = "210,180,140", linkDistance = 120 }: Props) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const mouse = { x: -9999, y: -9999 };
    let particles: P[] = [];
    let w = 0;
    let h = 0;
    let raf = 0;
    let visible = true;

    function resize() {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const rect = canvas!.getBoundingClientRect();
      w = rect.width;
      h = rect.height;
      canvas!.width = w * dpr;
      canvas!.height = h * dpr;
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);
      // O(n²) links per frame: keep n small, and lighter still on small screens.
      const count = Math.min(Math.round(((w * h) / 10000) * density), w < 768 ? 40 : 90);
      particles = Array.from({ length: count }, () => ({
        x: Math.random() * w,
        y: Math.random() * h,
        vx: (Math.random() - 0.5) * 0.25,
        vy: (Math.random() - 0.5) * 0.25,
        r: Math.random() * 1.4 + 0.4,
        a: Math.random() * 0.6 + 0.25,
      }));
    }

    function frame() {
      ctx!.clearRect(0, 0, w, h);
      for (const p of particles) {
        if (!reduce) {
          const dx = p.x - mouse.x;
          const dy = p.y - mouse.y;
          const d2 = dx * dx + dy * dy;
          if (d2 < 14000) {
            const f = (14000 - d2) / 14000;
            p.vx += (dx / Math.sqrt(d2 + 1)) * f * 0.06;
            p.vy += (dy / Math.sqrt(d2 + 1)) * f * 0.06;
          }
          p.vx *= 0.985;
          p.vy *= 0.985;
          p.vx += (Math.random() - 0.5) * 0.01;
          p.vy += (Math.random() - 0.5) * 0.01;
          p.x += p.vx;
          p.y += p.vy;
          if (p.x < -10) p.x = w + 10;
          if (p.x > w + 10) p.x = -10;
          if (p.y < -10) p.y = h + 10;
          if (p.y > h + 10) p.y = -10;
        }
      }

      // links
      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const a = particles[i];
          const b = particles[j];
          const dx = a.x - b.x;
          const dy = a.y - b.y;
          const d = Math.sqrt(dx * dx + dy * dy);
          if (d < linkDistance) {
            ctx!.strokeStyle = `rgba(${color},${(1 - d / linkDistance) * 0.12})`;
            ctx!.lineWidth = 0.6;
            ctx!.beginPath();
            ctx!.moveTo(a.x, a.y);
            ctx!.lineTo(b.x, b.y);
            ctx!.stroke();
          }
        }
      }

      // dots with glow
      ctx!.shadowColor = `rgba(${color},0.9)`;
      ctx!.shadowBlur = 8;
      for (const p of particles) {
        ctx!.fillStyle = `rgba(${color},${p.a})`;
        ctx!.beginPath();
        ctx!.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx!.fill();
      }
      ctx!.shadowBlur = 0;

      if (!reduce && visible) raf = requestAnimationFrame(frame);
    }

    function onMove(e: PointerEvent) {
      const r = canvas!.getBoundingClientRect();
      mouse.x = e.clientX - r.left;
      mouse.y = e.clientY - r.top;
    }
    function onLeave() {
      mouse.x = mouse.y = -9999;
    }

    const io = new IntersectionObserver(([entry]) => {
      const was = visible;
      visible = entry.isIntersecting;
      if (visible && !was && !reduce) raf = requestAnimationFrame(frame);
    });
    io.observe(canvas);

    resize();
    frame();
    window.addEventListener("resize", resize);
    window.addEventListener("pointermove", onMove, { passive: true });
    document.addEventListener("pointerleave", onLeave);

    return () => {
      cancelAnimationFrame(raf);
      io.disconnect();
      window.removeEventListener("resize", resize);
      window.removeEventListener("pointermove", onMove);
      document.removeEventListener("pointerleave", onLeave);
    };
  }, [density, color, linkDistance]);

  return <canvas ref={ref} aria-hidden className={className} style={{ width: "100%", height: "100%" }} />;
}
