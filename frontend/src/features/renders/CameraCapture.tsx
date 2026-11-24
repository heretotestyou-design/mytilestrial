"use client";

// In-app camera for laptops/desktops: live preview, capture, retake, use.
// (Phones use the native camera app via <input capture>, which gives better photos.)
import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { Modal } from "@/components/ui/Modal";

type Props = {
  open: boolean;
  title: string;
  onClose: () => void;
  onCapture: (file: File) => void;
};

type Status = "starting" | "live" | "captured" | "error";

/** Friendly message for getUserMedia failures. */
export function cameraError(e: unknown): string {
  const name = e instanceof DOMException ? e.name : "";
  if (name === "NotAllowedError" || name === "SecurityError") return "Camera access was blocked. Allow the camera for this site in your browser's address bar, then try again.";
  if (name === "NotFoundError" || name === "OverconstrainedError") return "No camera was found on this device. Upload a photo instead.";
  if (name === "NotReadableError") return "Your camera is being used by another app. Close it and try again.";
  return "Couldn't start the camera. Upload a photo instead.";
}

export function CameraCapture({ open, title, onClose, onCapture }: Readonly<Props>) {
  const video = useRef<HTMLVideoElement>(null);
  const stream = useRef<MediaStream | null>(null);
  const [status, setStatus] = useState<Status>("starting");
  const [error, setError] = useState<string | null>(null);
  const [shot, setShot] = useState<{ url: string; file: File } | null>(null);
  const [facing, setFacing] = useState<"environment" | "user">("environment");
  const [cameras, setCameras] = useState(0);

  const stop = useCallback(() => {
    stream.current?.getTracks().forEach((t) => t.stop());
    stream.current = null;
  }, []);

  // Start (or restart, when switching cameras) the live preview.
  useEffect(() => {
    if (!open || shot) return;
    let cancelled = false;
    setStatus("starting");
    setError(null);
    (async () => {
      try {
        if (!navigator.mediaDevices?.getUserMedia) throw new DOMException("", "NotFoundError");
        const s = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: facing }, width: { ideal: 1920 }, height: { ideal: 1080 } },
          audio: false,
        });
        if (cancelled) return s.getTracks().forEach((t) => t.stop());
        stop();
        stream.current = s;
        if (video.current) {
          video.current.srcObject = s;
          await video.current.play().catch(() => {});
        }
        const devices = await navigator.mediaDevices.enumerateDevices().catch(() => []);
        if (!cancelled) {
          setCameras(devices.filter((d) => d.kind === "videoinput").length);
          setStatus("live");
        }
      } catch (e) {
        if (!cancelled) {
          setError(cameraError(e));
          setStatus("error");
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, facing, shot, stop]);

  // Release the camera whenever the dialog closes.
  useEffect(() => {
    if (open) return;
    stop();
    setShot((s) => {
      if (s) URL.revokeObjectURL(s.url);
      return null;
    });
  }, [open, stop]);
  useEffect(() => stop, [stop]);

  function capture() {
    const v = video.current;
    if (!v || !v.videoWidth) return;
    const canvas = document.createElement("canvas");
    canvas.width = v.videoWidth;
    canvas.height = v.videoHeight;
    canvas.getContext("2d")?.drawImage(v, 0, 0);
    canvas.toBlob(
      (blob) => {
        if (!blob) return;
        const file = new File([blob], `camera-${Date.now()}.jpg`, { type: "image/jpeg" });
        stop();
        setShot({ url: URL.createObjectURL(blob), file });
        setStatus("captured");
      },
      "image/jpeg",
      0.92,
    );
  }

  function retake() {
    if (shot) URL.revokeObjectURL(shot.url);
    setShot(null);
  }

  function use() {
    if (!shot) return;
    onCapture(shot.file);
    onClose();
  }

  return (
    <Modal open={open} onClose={onClose} label={title} className="max-w-2xl">
      <div className="flex items-center justify-between gap-4 border-b border-ink/[0.06] px-5 py-3.5">
        <p className="text-[15px] font-semibold">{title}</p>
        <button onClick={onClose} className="rounded-lg p-2 text-stone-600 hover:bg-ink/5 hover:text-ink" aria-label="Close camera">
          <Icon name="x" className="h-5 w-5" />
        </button>
      </div>

      <div className="relative aspect-[4/3] bg-ink">
        {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
        <video ref={video} playsInline muted className={`absolute inset-0 h-full w-full object-cover ${shot ? "hidden" : ""} ${facing === "user" ? "-scale-x-100" : ""}`} />
        {shot && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={shot.url} alt="Captured photo" className="absolute inset-0 h-full w-full object-cover" />
        )}
        {status === "starting" && (
          <div className="absolute inset-0 grid place-items-center text-[13px] text-ivory/70">
            <span className="flex items-center gap-2.5">
              <span className="h-5 w-5 animate-spin rounded-full border-2 border-white/25 border-t-white" /> Starting camera…
            </span>
          </div>
        )}
        {status === "error" && (
          <div className="absolute inset-0 grid place-items-center p-8 text-center">
            <div>
              <span className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-white/10 text-ivory">
                <Icon name="camera" className="h-6 w-6" />
              </span>
              <p role="alert" className="mx-auto mt-3 max-w-sm text-[13.5px] text-ivory/80">{error}</p>
            </div>
          </div>
        )}
      </div>

      <div className="flex items-center justify-between gap-3 px-5 py-4">
        {shot ? (
          <>
            <Button variant="outline" onClick={retake}>Retake</Button>
            <Button variant="bronze" onClick={use}>
              <Icon name="check" className="h-4 w-4" /> Use this photo
            </Button>
          </>
        ) : (
          <>
            {cameras > 1 ? (
              <Button variant="outline" onClick={() => setFacing((f) => (f === "user" ? "environment" : "user"))} disabled={status !== "live"}>
                <Icon name="switchCamera" className="h-4 w-4" /> Switch camera
              </Button>
            ) : (
              <span className="text-[12.5px] text-stone-500">Hold the camera straight on, in good light.</span>
            )}
            <Button variant="bronze" onClick={capture} disabled={status !== "live"}>
              <Icon name="camera" className="h-4 w-4" /> Take photo
            </Button>
          </>
        )}
      </div>
    </Modal>
  );
}
