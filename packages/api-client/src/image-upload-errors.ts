export type ImageUploadErrorCode = 'IMAGE_PROCESSING_TIMEOUT' | 'IMAGE_MEMORY_LIMIT' | 'IMAGE_HEIC_CONVERSION_FAILED'
  | 'IMAGE_NOT_RECOGNIZED' | 'IMAGE_DECODE_FAILED' | 'IMAGE_ENCODE_FAILED' | 'IMAGE_EMPTY';
const messages: Record<ImageUploadErrorCode, string> = {
  IMAGE_PROCESSING_TIMEOUT: '图片处理时间较长，请重试',
  IMAGE_MEMORY_LIMIT: '这张图片需要的内存较多，当前浏览器无法处理，可以先缩小图片或换设备上传',
  IMAGE_HEIC_CONVERSION_FAILED: '这张 HEIC 没能在浏览器里转换，可以先转成 JPG 再上传',
  IMAGE_NOT_RECOGNIZED: '这个文件不是能识别的图片',
  IMAGE_DECODE_FAILED: '这张图片内容损坏或无法读取，可以重新导出为 JPG 后上传',
  IMAGE_ENCODE_FAILED: '浏览器没能处理这张图片，可以导出为 JPG 或换个浏览器上传',
  IMAGE_EMPTY: '图片文件是空的，请重新选择',
};
export class ImageUploadError extends Error {
  constructor(public readonly code: ImageUploadErrorCode) { super(messages[code]); this.name = 'ImageUploadError'; }
}
export function isImageMemoryError(error: unknown) {
  return error instanceof RangeError || /out of memory|memory allocation|array buffer allocation|cannot enlarge memory|\boom\b/i.test(error instanceof Error ? error.message : String(error));
}
export function heifFailureCode(error: unknown): ImageUploadErrorCode {
  return isImageMemoryError(error) ? 'IMAGE_MEMORY_LIMIT' : 'IMAGE_HEIC_CONVERSION_FAILED';
}
