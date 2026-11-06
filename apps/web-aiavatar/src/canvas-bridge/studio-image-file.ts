/** The media-import endpoint retains its 8 MiB / 8000 edge / 24MP policy; processing is shared. */
import { prepareImageForUpload } from '@ai-star-eco/api-client/image-upload';
import { STUDIO_MEDIA_IMAGE_LIMITS } from '@ai-star-eco/api-client/image-upload-policy';
export const STUDIO_IMAGE_UPLOAD_MAX_BYTES = STUDIO_MEDIA_IMAGE_LIMITS.maxBytes;
export const STUDIO_IMAGE_UPLOAD_MAX_EDGE = STUDIO_MEDIA_IMAGE_LIMITS.maxEdge;
export const STUDIO_IMAGE_UPLOAD_MAX_PIXELS = STUDIO_MEDIA_IMAGE_LIMITS.maxPixels;
export const prepareStudioImageUpload = (file: File) => prepareImageForUpload(file, STUDIO_MEDIA_IMAGE_LIMITS);
export function validateStudioImageUpload(file: File) {
  if (!file.size) throw new Error('图片文件为空，请重新选择');
}
