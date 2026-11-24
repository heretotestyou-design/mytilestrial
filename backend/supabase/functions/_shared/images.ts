/** True if the bytes really are a JPEG, PNG or WebP (the declared MIME type can lie). */
export async function isRealImage(file: Blob): Promise<boolean> {
  const b = new Uint8Array(await file.slice(0, 12).arrayBuffer());
  const jpeg = b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff;
  const png = b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47;
  const webp = b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 && b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50;
  return jpeg || png || webp;
}

/** The PNG header contains the dimensions and color type without decoding the image. */
export async function pngInfo(file: File) {
  if (file.type !== "image/png") return null;
  const header = await file.slice(0, 29).arrayBuffer();
  if (header.byteLength !== 29) return null;
  const data = new DataView(header);
  if (data.getUint32(0) !== 0x89504e47 || data.getUint32(4) !== 0x0d0a1a0a ||
      data.getUint32(8) !== 13 || data.getUint32(12) !== 0x49484452) return null;
  const colorType = data.getUint8(25);
  return { width: data.getUint32(16), height: data.getUint32(20), hasAlpha: colorType === 4 || colorType === 6 };
}
