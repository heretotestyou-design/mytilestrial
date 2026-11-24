import type { WallCorners } from "./wallSelection";

type ImageBounds = { x: number; y: number; width: number; height: number };

function canvas(width: number, height: number) {
  const image = document.createElement("canvas");
  image.width = width;
  image.height = height;
  const context = image.getContext("2d");
  if (!context) throw new Error("This browser couldn't prepare the wall image.");
  return { image, context };
}

async function decode(src: string) {
  const image = new Image();
  image.src = src;
  await image.decode().catch(() => { throw new Error("Couldn't open the room or render image."); });
  return image;
}

function asPng(image: HTMLCanvasElement) {
  return new Promise<Blob>((resolve, reject) => image.toBlob((blob) => {
    if (blob) resolve(blob);
    else reject(new Error("Couldn't save the wall image."));
  }, "image/png"));
}

function trace(context: CanvasRenderingContext2D, corners: WallCorners, bounds: ImageBounds) {
  const [first, ...rest] = corners;
  context.beginPath();
  context.moveTo(bounds.x + first.x * bounds.width, bounds.y + first.y * bounds.height);
  rest.forEach((point) => context.lineTo(bounds.x + point.x * bounds.width, bounds.y + point.y * bounds.height));
  context.closePath();
}

/** The model gets a standard-size canvas and a transparent PNG mask for the wall. */
export async function prepareWallEdit(room: File, corners: WallCorners) {
  const url = URL.createObjectURL(room);
  let original: HTMLImageElement;
  try {
    original = await decode(url);
  } finally {
    URL.revokeObjectURL(url);
  }
  const ratio = original.naturalWidth / original.naturalHeight;
  const width = ratio > 1.2 ? 1536 : 1024;
  const height = ratio < 1 / 1.2 ? 1536 : 1024;
  const scale = Math.min(width / original.naturalWidth, height / original.naturalHeight);
  const fittedWidth = Math.max(1, Math.round(original.naturalWidth * scale));
  const fittedHeight = Math.max(1, Math.round(original.naturalHeight * scale));
  const bounds = { x: Math.floor((width - fittedWidth) / 2), y: Math.floor((height - fittedHeight) / 2), width: fittedWidth, height: fittedHeight };
  const prepared = canvas(width, height);
  const mask = canvas(width, height);
  prepared.context.fillStyle = "#181818";
  prepared.context.fillRect(0, 0, width, height);
  prepared.context.drawImage(original, bounds.x, bounds.y, bounds.width, bounds.height);
  mask.context.fillRect(0, 0, width, height);
  mask.context.globalCompositeOperation = "destination-out";
  trace(mask.context, corners, bounds);
  mask.context.fill();
  const [roomPng, maskPng] = await Promise.all([asPng(prepared.image), asPng(mask.image)]);

  async function compose(result: string) {
    const edited = await decode(result);
    const outputScale = Math.min(1, 2560 / Math.max(original.naturalWidth, original.naturalHeight));
    const output = canvas(Math.max(1, Math.round(original.naturalWidth * outputScale)), Math.max(1, Math.round(original.naturalHeight * outputScale)));
    const outputBounds = { x: 0, y: 0, width: output.image.width, height: output.image.height };
    output.context.drawImage(original, 0, 0, outputBounds.width, outputBounds.height);
    trace(output.context, corners, outputBounds);
    output.context.clip();
    const xScale = edited.naturalWidth / width;
    const yScale = edited.naturalHeight / height;
    output.context.drawImage(edited,
      bounds.x * xScale, bounds.y * yScale, bounds.width * xScale, bounds.height * yScale,
      0, 0, outputBounds.width, outputBounds.height);
    return asPng(output.image);
  }

  return { room: new File([roomPng], "room.png", { type: "image/png" }), mask: new File([maskPng], "wall-mask.png", { type: "image/png" }), compose };
}
