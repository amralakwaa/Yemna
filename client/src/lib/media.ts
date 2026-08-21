const DEFAULT_MAX_BYTES = 1.5 * 1024 * 1024;
const DEFAULT_MAX_DIMENSION = 2048;

function canvasToFile(canvas: HTMLCanvasElement, type: string, quality: number, name: string): Promise<File> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(blob => {
      if (!blob) {
        reject(new Error("تعذر ضغط الصورة"));
        return;
      }
      resolve(new File([blob], name, { type: blob.type || type, lastModified: Date.now() }));
    }, type, quality);
  });
}

/** Compresses browser images before upload; videos and already-small images pass through unchanged. */
export async function compressImageForUpload(file: File, options: { maxBytes?: number; maxDimension?: number; quality?: number } = {}): Promise<File> {
  if (!file.type.startsWith("image/") || file.size <= (options.maxBytes ?? DEFAULT_MAX_BYTES)) return file;
  if (typeof document === "undefined" || typeof createImageBitmap !== "function") return file;

  const bitmap = await createImageBitmap(file);
  try {
    const maxDimension = options.maxDimension ?? DEFAULT_MAX_DIMENSION;
    const scale = Math.min(1, maxDimension / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const context = canvas.getContext("2d");
    if (!context) return file;
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);

    const maxBytes = options.maxBytes ?? DEFAULT_MAX_BYTES;
    let quality = options.quality ?? 0.82;
    let compressed = await canvasToFile(canvas, "image/jpeg", quality, file.name.replace(/\.[^.]+$/, ".jpg"));
    while (compressed.size > maxBytes && quality > 0.5) {
      quality -= 0.08;
      compressed = await canvasToFile(canvas, "image/jpeg", quality, compressed.name);
    }
    return compressed.size < file.size ? compressed : file;
  } finally {
    bitmap.close();
  }
}
