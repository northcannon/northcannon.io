import { inflateSync } from 'node:zlib';

// Chromium screenshots are non-interlaced 8-bit RGB/RGBA PNGs. Reject other formats.
export function decodePNG(buffer) {
  if (buffer.subarray(0, 8).toString('hex') !== '89504e470d0a1a0a') throw new Error('Not PNG');
  let width, height, channels;
  const chunks = [];
  for (let offset = 8; offset < buffer.length;) {
    const size = buffer.readUInt32BE(offset);
    const type = buffer.toString('ascii', offset + 4, offset + 8);
    const data = buffer.subarray(offset + 8, offset + 8 + size);
    if (type === 'IHDR') {
      width = data.readUInt32BE(0); height = data.readUInt32BE(4);
      if (data[8] !== 8 || ![2, 6].includes(data[9]) || data[12] !== 0) throw new Error('Unsupported PNG');
      channels = data[9] === 2 ? 3 : 4;
    }
    if (type === 'IDAT') chunks.push(data);
    offset += size + 12;
  }
  const raw = inflateSync(Buffer.concat(chunks));
  const stride = width * channels;
  if (raw.length !== height * (stride + 1)) throw new Error('Invalid PNG size');
  const pixels = Buffer.alloc(height * stride);
  const paeth = (a, b, c) => {
    const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
    return pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
  };
  for (let y = 0; y < height; y++) {
    const filter = raw[y * (stride + 1)];
    if (filter > 4) throw new Error('Unknown PNG filter');
    for (let x = 0; x < stride; x++) {
      const i = y * stride + x;
      const a = x >= channels ? pixels[i - channels] : 0;
      const b = y ? pixels[i - stride] : 0;
      const c = y && x >= channels ? pixels[i - stride - channels] : 0;
      pixels[i] = raw[y * (stride + 1) + 1 + x] + [0, a, b, Math.floor((a + b) / 2), paeth(a, b, c)][filter];
    }
  }
  return { width, height, rgb(x, y) {
    if (x < 0 || x >= width || y < 0 || y >= height) throw new Error('Pixel outside PNG');
    const i = (y * width + x) * channels;
    return [...pixels.subarray(i, i + 3)];
  } };
}
export const luminance = rgb => rgb.map(v => v / 255).map(v => v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4).reduce((sum, v, i) => sum + v * [0.2126, 0.7152, 0.0722][i], 0);
export const contrast = (a, b) => (Math.max(luminance(a), luminance(b)) + 0.05) / (Math.min(luminance(a), luminance(b)) + 0.05);
