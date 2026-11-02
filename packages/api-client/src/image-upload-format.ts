import { IMAGE_UPLOAD_MAX_EDGE, IMAGE_ENCODE_MAX_PIXELS } from "./image-upload-policy";

export type ImageKind = 'jpeg' | 'png' | 'heif' | 'other';

/** Selection hint only. Actual format detection below uses bytes, including compatible ftyp brands. */
export function isUploadImage(file: Pick<File, 'type' | 'name'>) {
  return file.type.startsWith('image/') || /\.(jpe?g|png|heic|heif|webp|avif|gif|bmp|tiff?)$/i.test(file.name);
}
export function imageKind(bytes: Uint8Array): ImageKind {
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'jpeg';
  if ([137, 80, 78, 71, 13, 10, 26, 10].every((v, i) => bytes[i] === v)) return 'png';
  if (bytes.length >= 16 && String.fromCharCode(...bytes.subarray(4, 8)) === 'ftyp') {
    const size = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength).getUint32(0);
    const brands: string[] = [];
    for (let i = 8; i + 4 <= Math.min(size, bytes.length); i += 4) {
      if (i !== 12) brands.push(String.fromCharCode(...bytes.subarray(i, i + 4)));
    }
    // mif1/msf1 alone do not identify a codec. AVIF also uses this container.
    if (brands.some(b => ['heic', 'heix', 'heim', 'heis', 'hevc', 'hevx'].includes(b))) return 'heif';
    if (brands.some(b => ['mif1', 'msf1'].includes(b)) && !brands.some(b => ['avif', 'avis'].includes(b))) return 'heif';
  }
  return 'other';
}

/** Header-only fast path avoids decoding an ordinary compliant JPEG/PNG at all. */
export function imageHeaderSize(b: Uint8Array, kind = imageKind(b)): { width: number; height: number } | null {
  const view = new DataView(b.buffer, b.byteOffset, b.byteLength);
  if (kind === 'png' && b.length >= 24) return { width: view.getUint32(16), height: view.getUint32(20) };
  if (kind !== 'jpeg') return null;
  let offset = 2;
  while (offset + 4 <= b.length) {
    if (b[offset++] !== 0xff) return null;
    while (b[offset] === 0xff) offset++;
    const marker = b[offset++];
    if (marker === 0xda || marker === 0xd9) return null;
    if (marker === 0x01 || marker >= 0xd0 && marker <= 0xd7) continue;
    if (offset + 2 > b.length) return null;
    const length = view.getUint16(offset);
    if (length < 2 || offset + length > b.length) return null;
    if ([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf].includes(marker) && length >= 7)
      return { height: view.getUint16(offset + 3), width: view.getUint16(offset + 5) };
    offset += length;
  }
  return null;
}

export function fitUploadImage(width: number, height: number, maxEdge = IMAGE_UPLOAD_MAX_EDGE, maxPixels = IMAGE_ENCODE_MAX_PIXELS) {
  const ratio = Math.min(1, maxEdge / Math.max(width, height), Math.sqrt(maxPixels / (width * height)));
  return { width: Math.max(1, Math.floor(width * ratio)), height: Math.max(1, Math.floor(height * ratio)) };
}
