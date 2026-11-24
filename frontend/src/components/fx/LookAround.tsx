"use client";

// "Look around": turns a finished render into a 3D scene you can drag to explore.
// The render is projected onto a mesh shaped by its depth map, so moving the camera
// gives real parallax (near furniture shifts more than the far wall). Nothing is
// invented: at rest the view is exactly the original image.
import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import * as THREE from "three";
import { Icon } from "@/components/ui/Icon";
import { estimateDepth, type DepthMap } from "@/lib/depth";

type Props = { src: string | null; id: string; title?: string; onClose: () => void };

const FOV = 50; // vertical field of view used to un-project the image, degrees
const MAX_YAW = THREE.MathUtils.degToRad(22);
const MAX_PITCH = THREE.MathUtils.degToRad(11);
const GRID = 220; // mesh columns; rows follow the aspect ratio
const BG = new THREE.Color("#12100E");

export function LookAround({ src, id, title, onClose }: Props) {
  const host = useRef<HTMLDivElement>(null);
  const [stage, setStage] = useState<"model" | "depth" | "ready" | "error">("model");
  const [download, setDownload] = useState(0);
  const [aspect, setAspect] = useState(1.5);
  const [hint, setHint] = useState(true);

  // Close on Escape.
  useEffect(() => {
    if (!src) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [src, onClose]);

  useEffect(() => {
    if (!src || !host.current) return;
    let disposed = false;
    let cleanup = () => {};
    setStage("model");
    setDownload(0);
    setHint(true);

    (async () => {
      try {
        const [texture, depth] = await Promise.all([
          loadTexture(src),
          estimateDepth(src, id, (p) => {
            setDownload(p);
            if (p >= 100) setStage("depth");
          }).then((d) => {
            setStage("depth");
            return d;
          }),
        ]);
        if (disposed || !host.current) return;
        const img = texture.image as HTMLImageElement;
        setAspect(img.width / img.height);
        cleanup = mountScene(host.current, texture, depth, img.width / img.height, () => setHint(false));
        setStage("ready");
      } catch (e) {
        console.error("Look around failed", e);
        if (!disposed) setStage("error");
      }
    })();

    return () => {
      disposed = true;
      cleanup();
    };
  }, [src, id]);

  return (
    <AnimatePresence>
      {src && (
        <motion.div
          className="fixed inset-0 z-[95] flex items-center justify-center bg-ink/80 p-3 backdrop-blur-md sm:p-8"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          role="dialog"
          aria-modal
          aria-label="Look around your render"
        >
          <motion.div
            className="glass-dark relative w-full max-w-[min(1400px,calc((100vh_-_9rem)_*_var(--ar)))] overflow-hidden rounded-[22px]"
            style={{ ["--ar" as string]: aspect }}
            initial={{ scale: 0.96, y: 12 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.97, opacity: 0 }}
            transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-3 border-b border-white/10 px-5 py-3">
              <div className="min-w-0">
                <p className="truncate text-[14px] font-semibold text-ivory">{title ?? "Your render"} · Look around</p>
                <p className="text-[12px] text-ivory/55">Drag to look around · scroll or pinch to zoom</p>
              </div>
              <button onClick={onClose} className="rounded-lg p-2 text-ivory/70 transition hover:bg-white/10 hover:text-ivory" aria-label="Close">
                <Icon name="x" className="h-5 w-5" />
              </button>
            </div>

            <div className="relative w-full" style={{ aspectRatio: String(aspect) }}>
              {/* Show the flat image underneath while 3D loads, so there is never a blank box. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={src} alt="" className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-700 ${stage === "ready" ? "opacity-0" : "opacity-40"}`} />
              <div ref={host} className={`absolute inset-0 touch-none transition-opacity duration-700 ${stage === "ready" ? "cursor-grab opacity-100 active:cursor-grabbing" : "opacity-0"}`} />

              {stage !== "ready" && (
                <div className="absolute inset-0 grid place-items-center">
                  <div className="glass-dark w-[min(320px,85%)] rounded-2xl p-5 text-center text-ivory">
                    {stage === "error" ? (
                      <>
                        <Icon name="info" className="mx-auto h-6 w-6 text-bronze-light" />
                        <p className="mt-2 text-[14px] font-semibold">3D view isn&apos;t available here</p>
                        <p className="mt-1 text-[12.5px] text-ivory/60">Your browser couldn&apos;t run the depth model. Try Chrome, Edge or Safari on a computer.</p>
                      </>
                    ) : (
                      <>
                        <span className="mx-auto grid h-11 w-11 animate-float place-items-center rounded-2xl bg-bronze/20 text-bronze-light">
                          <Icon name="orbit" className="h-6 w-6" />
                        </span>
                        <p className="mt-3 text-[14px] font-semibold">{stage === "model" ? "Preparing 3D view…" : "Building depth…"}</p>
                        <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/10">
                          <motion.div
                            className="h-full rounded-full bg-bronze"
                            animate={{ width: stage === "depth" ? "100%" : `${Math.max(6, download * 0.9)}%` }}
                            transition={{ ease: "easeOut" }}
                          />
                        </div>
                        <p className="mt-2 text-[11.5px] text-ivory/50">
                          {stage === "model" && download > 0 && download < 100
                            ? `First time only: downloading the 3D engine (~27 MB) · ${Math.round(download)}%`
                            : "Runs on your device; nothing is uploaded"}
                        </p>
                      </>
                    )}
                  </div>
                </div>
              )}

              <AnimatePresence>
                {stage === "ready" && hint && (
                  <motion.div
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    transition={{ delay: 0.4 }}
                    className="pointer-events-none absolute bottom-4 left-1/2 flex -translate-x-1/2 items-center gap-2 rounded-full bg-ink/70 px-4 py-2 text-[12.5px] text-ivory backdrop-blur"
                  >
                    <motion.span animate={{ x: [-6, 6, -6] }} transition={{ duration: 2.2, repeat: Infinity, ease: "easeInOut" }}>
                      <Icon name="orbit" className="h-4 w-4 text-bronze-light" />
                    </motion.span>
                    Drag to look around
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function loadTexture(src: string) {
  return new Promise<THREE.Texture>((resolve, reject) => {
    const loader = new THREE.TextureLoader();
    loader.setCrossOrigin("anonymous");
    loader.load(
      src,
      (t) => {
        t.colorSpace = THREE.NoColorSpace; // pass pixels through untouched
        t.minFilter = THREE.LinearMipmapLinearFilter;
        t.anisotropy = 8;
        resolve(t);
      },
      undefined,
      reject,
    );
  });
}

/** Builds the depth mesh and runs the render loop. Returns a disposer. */
function mountScene(el: HTMLDivElement, texture: THREE.Texture, depth: DepthMap, aspect: number, onInteract: () => void) {
  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
  renderer.outputColorSpace = THREE.LinearSRGBColorSpace;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setClearColor(BG);
  el.appendChild(renderer.domElement);
  renderer.domElement.style.width = "100%";
  renderer.domElement.style.height = "100%";

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(FOV, aspect, 0.05, 100);

  // ---- Geometry: un-project every grid vertex along its pixel ray to its depth ----
  const cols = GRID;
  const rows = Math.max(2, Math.round(GRID / aspect));
  const geo = new THREE.PlaneGeometry(1, 1, cols, rows);
  const pos = geo.attributes.position as THREE.BufferAttribute;
  const uv = geo.attributes.uv as THREE.BufferAttribute;
  const sampler = makeDepthSampler(depth, cols, rows);
  const tanHalf = Math.tan(THREE.MathUtils.degToRad(FOV / 2));
  let sum = 0;
  for (let i = 0; i < pos.count; i++) {
    const u = uv.getX(i);
    const v = uv.getY(i);
    const dist = sampler(u, 1 - v); // image rows go top-down
    sum += dist;
    pos.setXYZ(i, (u - 0.5) * 2 * dist * tanHalf * aspect, (v - 0.5) * 2 * dist * tanHalf, -dist);
  }
  pos.needsUpdate = true;
  geo.computeBoundingSphere();
  const pivot = sum / pos.count; // orbit around the middle of the room

  const material = new THREE.ShaderMaterial({
    uniforms: { map: { value: texture }, bg: { value: new THREE.Vector3(BG.r, BG.g, BG.b) } },
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: /* glsl */ `
      uniform sampler2D map; uniform vec3 bg; varying vec2 vUv;
      void main() {
        vec3 c = texture2D(map, vUv).rgb;
        float e = min(min(vUv.x, 1.0 - vUv.x), min(vUv.y, 1.0 - vUv.y));
        gl_FragColor = vec4(mix(bg, c, smoothstep(0.0, 0.03, e)), 1.0);
      }`,
    side: THREE.DoubleSide,
  });
  const mesh = new THREE.Mesh(geo, material);
  scene.add(mesh);

  // ---- Camera: orbit a point in the room; at rest it sits exactly where the photo was taken ----
  const target = new THREE.Vector3(0, 0, -pivot);
  const state = { yaw: 0, pitch: 0, zoom: 1, tYaw: 0, tPitch: 0, tZoom: 1 };
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  let dragging = false;
  let last = { x: 0, y: 0 };
  let lastInput = performance.now();
  const pointers = new Map<number, { x: number; y: number }>();
  let pinch = 0;

  const resize = () => {
    const w = el.clientWidth;
    const h = el.clientHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  };
  resize();
  const ro = new ResizeObserver(resize);
  ro.observe(el);

  const clampYaw = (y: number) => THREE.MathUtils.clamp(y, -MAX_YAW, MAX_YAW);
  const clampPitch = (p: number) => THREE.MathUtils.clamp(p, -MAX_PITCH, MAX_PITCH);

  const onDown = (e: PointerEvent) => {
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    el.setPointerCapture(e.pointerId);
    dragging = true;
    last = { x: e.clientX, y: e.clientY };
    lastInput = performance.now();
    onInteract();
  };
  const onMove = (e: PointerEvent) => {
    if (pointers.has(e.pointerId)) pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.size === 2) {
      const [a, b] = [...pointers.values()];
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      if (pinch) state.tZoom = THREE.MathUtils.clamp(state.tZoom * (d / pinch), 1, 1.8);
      pinch = d;
      return;
    }
    if (!dragging) return;
    const rect = el.getBoundingClientRect();
    state.tYaw = clampYaw(state.tYaw - ((e.clientX - last.x) / rect.width) * 1.4);
    state.tPitch = clampPitch(state.tPitch + ((e.clientY - last.y) / rect.height) * 0.9);
    last = { x: e.clientX, y: e.clientY };
    lastInput = performance.now();
  };
  const onUp = (e: PointerEvent) => {
    pointers.delete(e.pointerId);
    if (pointers.size < 2) pinch = 0;
    if (pointers.size === 0) dragging = false;
    lastInput = performance.now();
  };
  const onWheel = (e: WheelEvent) => {
    e.preventDefault();
    state.tZoom = THREE.MathUtils.clamp(state.tZoom * Math.exp(-e.deltaY * 0.0015), 1, 1.8);
    lastInput = performance.now();
    onInteract();
  };
  el.addEventListener("pointerdown", onDown);
  el.addEventListener("pointermove", onMove);
  el.addEventListener("pointerup", onUp);
  el.addEventListener("pointercancel", onUp);
  el.addEventListener("wheel", onWheel, { passive: false });

  // ---- Loop ----
  const start = performance.now();
  let raf = 0;
  const tick = (now: number) => {
    const t = (now - start) / 1000;
    const idle = now - lastInput > 2500 && !dragging;

    if (!reduce && t < 2.6 && !dragging && lastInput <= start + 1) {
      // Intro sweep so people notice it's 3D.
      const k = Math.sin((t / 2.6) * Math.PI);
      state.tYaw = Math.sin(t * 2.4) * MAX_YAW * 0.55 * k;
      state.tPitch = Math.sin(t * 1.3) * MAX_PITCH * 0.25 * k;
    } else if (idle && !reduce) {
      // Drift gently back toward the original framing.
      state.tYaw *= 0.985;
      state.tPitch *= 0.985;
    }

    const ease = 0.12;
    state.yaw += (state.tYaw - state.yaw) * ease;
    state.pitch += (state.tPitch - state.pitch) * ease;
    state.zoom += (state.tZoom - state.zoom) * ease;

    const r = pivot;
    camera.position.set(
      target.x + r * Math.sin(state.yaw) * Math.cos(state.pitch),
      target.y + r * Math.sin(state.pitch),
      target.z + r * Math.cos(state.yaw) * Math.cos(state.pitch),
    );
    camera.lookAt(target);
    if (camera.zoom !== state.zoom) {
      camera.zoom = state.zoom;
      camera.updateProjectionMatrix();
    }
    renderer.render(scene, camera);
    raf = requestAnimationFrame(tick);
  };
  raf = requestAnimationFrame(tick);

  return () => {
    cancelAnimationFrame(raf);
    ro.disconnect();
    el.removeEventListener("pointerdown", onDown);
    el.removeEventListener("pointermove", onMove);
    el.removeEventListener("pointerup", onUp);
    el.removeEventListener("pointercancel", onUp);
    el.removeEventListener("wheel", onWheel);
    geo.dispose();
    material.dispose();
    texture.dispose();
    renderer.dispose();
    renderer.domElement.remove();
  };
}

/**
 * Returns sampler(u, v) -> distance from the camera (1 = nearest .. ~5 = farthest).
 * The depth map is relative inverse depth, so it is normalised with robust percentiles,
 * smoothed per grid cell (avoids jagged "rubber" edges) and converted to distance.
 */
function makeDepthSampler(depth: DepthMap, cols: number, rows: number) {
  const { data, width, height } = depth;

  // Robust range (2nd..98th percentile).
  const hist = new Uint32Array(256);
  for (let i = 0; i < data.length; i++) hist[data[i]]++;
  const pick = (q: number) => {
    let acc = 0;
    const goal = data.length * q;
    for (let v = 0; v < 256; v++) if ((acc += hist[v]) >= goal) return v;
    return 255;
  };
  const lo = pick(0.02);
  const hi = Math.max(lo + 1, pick(0.98));

  // Integral image for fast box averages.
  const iw = width + 1;
  const integral = new Float64Array(iw * (height + 1));
  for (let y = 0; y < height; y++) {
    let row = 0;
    for (let x = 0; x < width; x++) {
      row += data[y * width + x];
      integral[(y + 1) * iw + x + 1] = integral[y * iw + x + 1] + row;
    }
  }
  const rx = Math.max(1, Math.round(width / cols / 2) + 1);
  const ry = Math.max(1, Math.round(height / rows / 2) + 1);
  const NEAR = 0.2; // nearest:farthest distance ratio of about 1:5 suits interiors

  return (u: number, v: number) => {
    const cx = Math.round(u * (width - 1));
    const cy = Math.round(v * (height - 1));
    const x0 = Math.max(0, cx - rx);
    const x1 = Math.min(width, cx + rx + 1);
    const y0 = Math.max(0, cy - ry);
    const y1 = Math.min(height, cy + ry + 1);
    const total = integral[y1 * iw + x1] - integral[y0 * iw + x1] - integral[y1 * iw + x0] + integral[y0 * iw + x0];
    const avg = total / ((x1 - x0) * (y1 - y0));
    const n = THREE.MathUtils.clamp((avg - lo) / (hi - lo), 0, 1); // 1 = closest
    return 1 / (NEAR + (1 - NEAR) * n);
  };
}
