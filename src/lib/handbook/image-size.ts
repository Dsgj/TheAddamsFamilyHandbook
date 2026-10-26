/** A figure's pixel size, so its img reserves its box before the file arrives (AY2-06). */
export interface ImageSize {
  width: number;
  height: number;
}

/** Dimensions from PNG, JPEG and WebP headers; null for unsupported or truncated data. */
export function imageSize(b: Uint8Array): ImageSize | null {
  const v = new DataView(b.buffer, b.byteOffset, b.byteLength);
  if (b.length >= 20 && v.getUint32(0) === 0x52494646 && v.getUint32(8) === 0x57454250) {
    // RIFF chunks are padded to an even length; skip metadata before the image chunk.
    for (let i = 12; i + 8 <= b.length;) {
      const type = v.getUint32(i);
      const length = v.getUint32(i + 4, true);
      const p = i + 8;
      if (p + length > b.length) return null;
      const u24 = (at: number) => b[at]! | (b[at + 1]! << 8) | (b[at + 2]! << 16);
      if (type === 0x56503858 && length >= 10)
        return { width: 1 + u24(p + 4), height: 1 + u24(p + 7) };
      if (type === 0x5650384c && length >= 5 && b[p] === 0x2f) {
        const bits = v.getUint32(p + 1, true);
        return { width: 1 + (bits & 0x3fff), height: 1 + ((bits >>> 14) & 0x3fff) };
      }
      if (
        type === 0x56503820 &&
        length >= 10 &&
        b[p + 3] === 0x9d &&
        b[p + 4] === 1 &&
        b[p + 5] === 0x2a
      )
        return {
          width: v.getUint16(p + 6, true) & 0x3fff,
          height: v.getUint16(p + 8, true) & 0x3fff,
        };
      i = p + length + (length % 2);
    }
    return null;
  }
  if (b.length >= 24 && v.getUint32(0) === 0x89504e47 && v.getUint32(12) === 0x49484452)
    return { width: v.getUint32(16), height: v.getUint32(20) };
  if (b.length < 4 || v.getUint16(0) !== 0xffd8) return null;
  for (let i = 2; i + 9 < b.length;) {
    if (b[i] !== 0xff) return null;
    const m = b[i + 1]!;
    if (m === 0xff) {
      i++; // a fill byte before the marker
      continue;
    }
    // SOF0–SOF15 carry the frame size; C4 (DHT), C8 (JPG) and CC (DAC) share the range.
    if (m >= 0xc0 && m <= 0xcf && m !== 0xc4 && m !== 0xc8 && m !== 0xcc)
      return { width: v.getUint16(i + 7), height: v.getUint16(i + 5) };
    i += 2 + v.getUint16(i + 2);
  }
  return null;
}
