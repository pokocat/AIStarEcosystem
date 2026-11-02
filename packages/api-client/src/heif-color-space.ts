/** Identify the primary image's Display P3 profile before putting libheif RGB pixels into ImageData.
 * libheif performs YCbCr → RGB, but simply treating its P3 RGB values as sRGB changes the colors.
 * The browser converts the explicitly tagged ImageData to the sRGB output canvas.
 */
export function heifPrimaryColorSpace(bytes: Uint8Array): PredefinedColorSpace {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  type Box = { type: string; start: number; end: number };
  const boxes = (start: number, end: number): Box[] => {
    const result: Box[] = [];
    for (let pos = start; pos + 8 <= end;) {
      let size = view.getUint32(pos), header = 8;
      if (size === 1) { if (pos + 16 > end) break; size = view.getUint32(pos + 8) * 2 ** 32 + view.getUint32(pos + 12); header = 16; }
      if (!size) size = end - pos;
      if (size < header || pos + size > end) break;
      result.push({ type: String.fromCharCode(...bytes.subarray(pos + 4, pos + 8)), start: pos + header, end: pos + size });
      pos += size;
    }
    return result;
  };
  try {
    const meta = boxes(0, bytes.length).find(b => b.type === 'meta');
    if (!meta) return 'srgb';
    const items = boxes(meta.start + 4, meta.end), pitm = items.find(b => b.type === 'pitm'), iprp = items.find(b => b.type === 'iprp');
    if (!pitm || !iprp) return 'srgb';
    const primary = bytes[pitm.start] === 0 ? view.getUint16(pitm.start + 4) : view.getUint32(pitm.start + 4);
    const properties = boxes(iprp.start, iprp.end), ipco = properties.find(b => b.type === 'ipco');
    if (!ipco) return 'srgb';
    const definitions = boxes(ipco.start, ipco.end);
    for (const ipma of properties.filter(b => b.type === 'ipma')) {
      const version = bytes[ipma.start], wide = !!(view.getUint32(ipma.start) & 1);
      const count = view.getUint32(ipma.start + 4); let pos = ipma.start + 8;
      for (let i = 0; i < count && pos < ipma.end; i++) {
        const item = version < 1 ? view.getUint16(pos) : view.getUint32(pos); pos += version < 1 ? 2 : 4;
        const associations = bytes[pos++];
        for (let j = 0; j < associations && pos < ipma.end; j++) {
          const index = wide ? view.getUint16(pos) & 0x7fff : bytes[pos] & 0x7f; pos += wide ? 2 : 1;
          const profile = definitions[index - 1];
          if (item !== primary || profile?.type !== 'colr') continue;
          const type = String.fromCharCode(...bytes.subarray(profile.start, profile.start + 4));
          if (type === 'nclx' && view.getUint16(profile.start + 4) === 12 && view.getUint16(profile.start + 6) === 13) return 'display-p3';
          if (type === 'prof' || type === 'rICC') {
            const icc = profile.start + 4;
            // ICC RGB colorant tags are in D50 XYZ; recognize Display P3 without relying on a localized profile name.
            const expected: Record<string, number[]> = { rXYZ: [.5151, .2412, -.0010], gXYZ: [.2920, .6922, .0419], bXYZ: [.1571, .0666, .7841] };
            const matches = new Set<string>(), tags = view.getUint32(icc + 128);
            for (let tag = 0; tag < tags && icc + 132 + tag * 12 + 12 <= profile.end; tag++) {
              const entry = icc + 132 + tag * 12, name = String.fromCharCode(...bytes.subarray(entry, entry + 4));
              if (!expected[name]) continue;
              const value = icc + view.getUint32(entry + 4) + 8;
              if (value + 12 <= profile.end && expected[name].every((v, c) => Math.abs(view.getInt32(value + c * 4) / 65536 - v) < .008)) matches.add(name);
            }
            if (matches.size === 3) return 'display-p3';
          }
        }
      }
    }
  } catch { /* Malformed metadata must not prevent an otherwise readable image from uploading. */ }
  return 'srgb';
}
