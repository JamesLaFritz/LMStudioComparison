/**
 * Minimal, dependency-free PNG decoder.
 *
 * The gate must run from a bare checkout with nothing installed but Playwright,
 * so it cannot depend on `pngjs` or `sharp`. Playwright hands us 8-bit
 * non-interlaced PNGs from `page.screenshot()`; that is the only shape this
 * decoder claims to handle, and it throws loudly rather than guessing on
 * anything else.
 *
 * Only luminance is retained. Every observable in the gate is a
 * brightness/geometry measurement (centroids, extents, radial profiles, frame
 * differences), and keeping one channel per pixel instead of four keeps a
 * 200-frame burst inside a sane memory budget.
 */

import zlib from 'node:zlib';

const SIG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

const CHANNELS = { 0: 1, 2: 3, 4: 2, 6: 4 };

/**
 * @param {Buffer} buf raw PNG bytes
 * @returns {{width:number, height:number, lum:Uint8Array}} luminance image,
 *   row-major, one byte per pixel
 */
export function decodePng(buf) {
  if (buf.length < 8 || !buf.subarray(0, 8).equals(SIG)) {
    throw new Error('decodePng: not a PNG (bad signature)');
  }

  let off = 8;
  let hdr = null;
  const idatParts = [];

  while (off + 8 <= buf.length) {
    const len = buf.readUInt32BE(off);
    const type = buf.toString('latin1', off + 4, off + 8);
    const data = buf.subarray(off + 8, off + 8 + len);
    off += 12 + len; // length + type + data + crc

    if (type === 'IHDR') {
      hdr = {
        width: data.readUInt32BE(0),
        height: data.readUInt32BE(4),
        bitDepth: data[8],
        colorType: data[9],
        compression: data[10],
        filter: data[11],
        interlace: data[12]
      };
    } else if (type === 'IDAT') {
      idatParts.push(data);
    } else if (type === 'IEND') {
      break;
    }
  }

  if (!hdr) throw new Error('decodePng: no IHDR chunk');
  if (hdr.bitDepth !== 8) {
    throw new Error(`decodePng: unsupported bit depth ${hdr.bitDepth} (need 8)`);
  }
  if (hdr.interlace !== 0) {
    throw new Error('decodePng: interlaced PNG is not supported');
  }
  const channels = CHANNELS[hdr.colorType];
  if (!channels) {
    throw new Error(`decodePng: unsupported colour type ${hdr.colorType}`);
  }

  const raw = zlib.inflateSync(Buffer.concat(idatParts));

  const { width, height } = hdr;
  const stride = width * channels;
  const expected = (stride + 1) * height;
  if (raw.length < expected) {
    throw new Error(
      `decodePng: short IDAT — got ${raw.length} bytes, expected ${expected}`
    );
  }

  // Un-filter in place into a scratch buffer holding the reconstructed bytes.
  const recon = Buffer.allocUnsafe(stride * height);
  let rpos = 0;
  for (let y = 0; y < height; y++) {
    const ft = raw[rpos++];
    const rowStart = y * stride;
    const prevStart = rowStart - stride;

    for (let x = 0; x < stride; x++) {
      const rawByte = raw[rpos + x];
      const a = x >= channels ? recon[rowStart + x - channels] : 0; // left
      const b = y > 0 ? recon[prevStart + x] : 0; // up
      const c = y > 0 && x >= channels ? recon[prevStart + x - channels] : 0; // up-left

      let value;
      switch (ft) {
        case 0:
          value = rawByte;
          break;
        case 1:
          value = rawByte + a;
          break;
        case 2:
          value = rawByte + b;
          break;
        case 3:
          value = rawByte + ((a + b) >> 1);
          break;
        case 4: {
          const p = a + b - c;
          const pa = Math.abs(p - a);
          const pb = Math.abs(p - b);
          const pc = Math.abs(p - c);
          const pred = pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
          value = rawByte + pred;
          break;
        }
        default:
          throw new Error(`decodePng: bad filter type ${ft} on row ${y}`);
      }
      recon[rowStart + x] = value & 0xff;
    }
    rpos += stride;
  }

  // Collapse to luminance. Rec. 601 weights in fixed point.
  const lum = new Uint8Array(width * height);
  for (let i = 0, p = 0; i < lum.length; i++, p += channels) {
    if (channels >= 3) {
      lum[i] = (recon[p] * 77 + recon[p + 1] * 150 + recon[p + 2] * 29) >> 8;
    } else {
      lum[i] = recon[p];
    }
  }

  return { width, height, lum };
}
