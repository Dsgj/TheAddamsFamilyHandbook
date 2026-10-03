/** A figure's pixel size, so its img reserves its box before the file arrives (AY2-06). */
export interface ImageSize {
  width: number;
  height: number;
}

/** Width and height from a PNG's IHDR or a JPEG's first SOF marker; null for anything else. */
export function imageSize(b: Uint8Array): ImageSize | null {
  const v = new DataView(b.buffer, b.byteOffset, b.byteLength);
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
