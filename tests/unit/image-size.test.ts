import { describe, expect, it } from 'vitest';
import { imageSize } from '~/lib/handbook/image-size';

const webp = (type: string, data: Buffer) => {
  const b = Buffer.alloc(20 + data.length + (data.length % 2));
  b.write('RIFF');
  b.writeUInt32LE(b.length - 8, 4);
  b.write('WEBP', 8);
  b.write(type, 12);
  b.writeUInt32LE(data.length, 16);
  data.copy(b, 20);
  return b;
};

describe('WebP figure sizes', () => {
  it('reads lossy, lossless and extended headers', () => {
    const lossy = Buffer.alloc(10);
    lossy.set([0x9d, 1, 0x2a], 3);
    lossy.writeUInt16LE(640, 6);
    lossy.writeUInt16LE(480, 8);
    expect(imageSize(webp('VP8 ', lossy))).toEqual({ width: 640, height: 480 });
    const lossless = Buffer.alloc(5);
    lossless[0] = 0x2f;
    lossless.writeUInt32LE(639 | (479 << 14), 1);
    expect(imageSize(webp('VP8L', lossless))).toEqual({ width: 640, height: 480 });
    const extended = Buffer.alloc(10);
    extended.writeUIntLE(639, 4, 3);
    extended.writeUIntLE(479, 7, 3);
    expect(imageSize(webp('VP8X', extended))).toEqual({ width: 640, height: 480 });
  });

  it('refuses truncated chunks without throwing', () => {
    const data = webp('VP8X', Buffer.alloc(10));
    for (let end = 0; end < data.length; end++) expect(imageSize(data.subarray(0, end))).toBeNull();
  });
});
