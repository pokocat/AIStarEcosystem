/** Keep the server's bounded image input while accepting ordinary camera originals. */
export const STUDIO_IMAGE_SOURCE_MAX_BYTES = 50 * 1024 * 1024;
export const STUDIO_IMAGE_UPLOAD_MAX_BYTES = 8 * 1024 * 1024;

export function validateStudioImageUpload(file: File) {
  if (!/\.(jpe?g|png)$/i.test(file.name)) throw new Error('请选择 JPG 或 PNG 图片');
  if (!file.size) throw new Error('图片是空的，请重新选择');
  if (file.size > STUDIO_IMAGE_SOURCE_MAX_BYTES) throw new Error('原始图片最多 50 MB，请选择较小的图片');
}

async function decodeImage(file: File): Promise<{ source: CanvasImageSource; width: number; height: number; close(): void }> {
  if (typeof createImageBitmap === 'function') {
    const image = await createImageBitmap(file);
    return { source: image, width: image.width, height: image.height, close: () => image.close() };
  }
  const url = URL.createObjectURL(file);
  try {
    const image = new Image(); image.src = url;
    await image.decode();
    return { source: image, width: image.naturalWidth, height: image.naturalHeight, close: () => URL.revokeObjectURL(url) };
  } catch (error) { URL.revokeObjectURL(url); throw error; }
}

/** Small files keep their original bytes. Large PNGs retain transparency; originals stay on the device. */
export async function prepareStudioImageUpload(file: File): Promise<File> {
  validateStudioImageUpload(file);
  if (file.size <= STUDIO_IMAGE_UPLOAD_MAX_BYTES) return file;
  let image: Awaited<ReturnType<typeof decodeImage>>;
  try { image = await decodeImage(file); }
  catch { throw new Error('图片无法读取，请重新选择 JPG 或 PNG 图片'); }
  try {
    if (!image.width || !image.height || image.width * image.height > 100_000_000)
      throw new Error('图片尺寸过大，请选择不超过 1 亿像素的图片');
    const mime = /\.png$/i.test(file.name) ? 'image/png' : 'image/jpeg';
    let ratio = Math.min(1, 4096 / Math.max(image.width, image.height));
    const canvas = document.createElement('canvas');
    try {
      for (let attempt = 0; attempt < 8; attempt++) {
        canvas.width = Math.max(1, Math.floor(image.width * ratio));
        canvas.height = Math.max(1, Math.floor(image.height * ratio));
        const context = canvas.getContext('2d');
        if (!context) throw new Error('当前浏览器无法处理大图，请换用新版浏览器');
        context.drawImage(image.source, 0, 0, canvas.width, canvas.height);
        const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob(
          result => result ? resolve(result) : reject(new Error('大图处理失败，请重新选择图片')), mime, .9));
        if (blob.size > 0 && blob.size <= STUDIO_IMAGE_UPLOAD_MAX_BYTES && blob.type === mime)
          return new File([blob], file.name, { type: mime, lastModified: file.lastModified });
        ratio *= .75;
      }
      throw new Error('图片处理后仍过大，请选择较小的图片');
    } finally { canvas.width = 0; canvas.height = 0; }
  } finally { image.close(); }
}
