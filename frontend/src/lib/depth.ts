// In-browser depth estimation for the "Look around" viewer.
//
// Uses Depth Anything V2 (small) through transformers.js, loaded from the CDN only
// when first needed (keeps ONNX Runtime out of the app bundle). The quantized model
// is ~27 MB, downloaded once and cached by the browser; inference takes ~1-3 s on
// a laptop. Nothing is uploaded: the render never leaves the user's device.

const TRANSFORMERS_URL = "https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.0.2";
const MODEL = "onnx-community/depth-anything-v2-small";

export type DepthMap = { data: Uint8Array; width: number; height: number };

type Progress = { status: string; progress?: number; file?: string };
type DepthPipeline = (input: string) => Promise<{ depth: { data: Uint8Array; width: number; height: number; channels: number } }>;

let pipelinePromise: Promise<DepthPipeline> | null = null;
const listeners = new Set<(p: number) => void>();
const cache = new Map<string, Promise<DepthMap>>();

/** Starts downloading the model (safe to call repeatedly, e.g. on hover). */
export function preloadDepthModel(): Promise<DepthPipeline> {
  if (!pipelinePromise) {
    pipelinePromise = (async () => {
      const lib = await import(/* webpackIgnore: true */ TRANSFORMERS_URL);
      lib.env.allowLocalModels = false;
      const files = new Map<string, number>();
      return (await lib.pipeline("depth-estimation", MODEL, {
        dtype: "q8",
        device: "wasm",
        progress_callback: (p: Progress) => {
          if (p.status !== "progress" || !p.file) return;
          files.set(p.file, p.progress ?? 0);
          const avg = [...files.values()].reduce((a, b) => a + b, 0) / files.size;
          listeners.forEach((l) => l(avg));
        },
      })) as DepthPipeline;
    })().catch((e) => {
      pipelinePromise = null; // allow a retry
      throw e;
    });
  }
  return pipelinePromise;
}

/** Depth for an image URL (cached per key). Brighter = closer, values 0-255. */
export function estimateDepth(url: string, key: string, onDownload?: (percent: number) => void): Promise<DepthMap> {
  const hit = cache.get(key);
  if (hit) return hit;

  const job = (async () => {
    if (onDownload) listeners.add(onDownload);
    try {
      const run = await preloadDepthModel();
      const { depth } = await run(url);
      // Collapse to one channel in case the runtime returns RGB.
      const n = depth.width * depth.height;
      const data = depth.channels === 1 ? depth.data : Uint8Array.from({ length: n }, (_, i) => depth.data[i * depth.channels]);
      return { data, width: depth.width, height: depth.height };
    } finally {
      if (onDownload) listeners.delete(onDownload);
    }
  })();

  cache.set(key, job);
  job.catch(() => cache.delete(key));
  return job;
}
