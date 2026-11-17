'use strict';

// Pure-JS ISO/IEC 18004 QR Code encoder (Byte mode, Error Correction Level M, Versions 1..10)
// Zero external dependencies so QR codes render reliably on server & browser without third-party CDNs.

const GF_EXP = new Uint8Array(512);
const GF_LOG = new Uint8Array(256);

(function initGaloisField() {
  let x = 1;
  for (let i = 0; i < 255; i++) {
    GF_EXP[i] = x;
    GF_LOG[x] = i;
    x <<= 1;
    if (x & 0x100) x ^= 0x11d;
  }
  for (let i = 255; i < 512; i++) {
    GF_EXP[i] = GF_EXP[i - 255];
  }
})();

function gfMul(a, b) {
  if (a === 0 || b === 0) return 0;
  return GF_EXP[GF_LOG[a] + GF_LOG[b]];
}

function getRsGeneratorPoly(ecCount) {
  let poly = [1];
  for (let i = 0; i < ecCount; i++) {
    const next = new Array(poly.length + 1).fill(0);
    const factor = GF_EXP[i];
    for (let j = 0; j < poly.length; j++) {
      next[j] ^= poly[j];
      next[j + 1] ^= gfMul(poly[j], factor);
    }
    poly = next;
  }
  return poly;
}

function computeRsEc(data, ecCount) {
  const gen = getRsGeneratorPoly(ecCount);
  const res = new Uint8Array(data.length + ecCount);
  res.set(data);
  for (let i = 0; i < data.length; i++) {
    const coeff = res[i];
    if (coeff !== 0) {
      for (let j = 1; j < gen.length; j++) {
        res[i + j] ^= gfMul(gen[j], coeff);
      }
    }
  }
  return res.slice(data.length);
}

// Level M (approx. 15% recovery), Versions 1..10
const VERSION_SPECS = [
  null,
  { version: 1, size: 21, dataBytes: 16, ecPerBlock: 10, blocks: [[1, 16]], align: [] },
  { version: 2, size: 25, dataBytes: 28, ecPerBlock: 16, blocks: [[1, 28]], align: [6, 18] },
  { version: 3, size: 29, dataBytes: 44, ecPerBlock: 26, blocks: [[1, 44]], align: [6, 22] },
  { version: 4, size: 33, dataBytes: 64, ecPerBlock: 18, blocks: [[2, 32]], align: [6, 26] },
  { version: 5, size: 37, dataBytes: 86, ecPerBlock: 24, blocks: [[2, 43]], align: [6, 30] },
  { version: 6, size: 41, dataBytes: 108, ecPerBlock: 16, blocks: [[4, 27]], align: [6, 34] },
  { version: 7, size: 45, dataBytes: 124, ecPerBlock: 18, blocks: [[4, 31]], align: [6, 22, 38] },
  { version: 8, size: 49, dataBytes: 154, ecPerBlock: 22, blocks: [[2, 38], [2, 39]], align: [6, 24, 42] },
  { version: 9, size: 53, dataBytes: 182, ecPerBlock: 22, blocks: [[3, 36], [2, 37]], align: [6, 26, 46] },
  { version: 10, size: 57, dataBytes: 216, ecPerBlock: 26, blocks: [[4, 43], [1, 44]], align: [6, 28, 50] }
];

function selectVersion(byteLen) {
  for (let v = 1; v < VERSION_SPECS.length; v++) {
    const spec = VERSION_SPECS[v];
    const headerBits = v <= 9 ? 4 + 8 : 4 + 16;
    const neededBytes = Math.ceil((headerBits + byteLen * 8) / 8);
    if (neededBytes <= spec.dataBytes) {
      return spec;
    }
  }
  throw new Error('Conteúdo excede o tamanho máximo suportado pelo gerador de QR Code.');
}

function encodeDataCodewords(bytes, spec) {
  const bits = [];
  function pushBits(val, len) {
    for (let i = len - 1; i >= 0; i--) {
      bits.push((val >>> i) & 1);
    }
  }

  // Mode indicator 0100 (Byte mode)
  pushBits(0b0100, 4);
  // Character count indicator
  pushBits(bytes.length, spec.version <= 9 ? 8 : 16);
  // Payload bytes
  for (let i = 0; i < bytes.length; i++) {
    pushBits(bytes[i], 8);
  }

  const maxBits = spec.dataBytes * 8;
  const terminatorLen = Math.min(4, maxBits - bits.length);
  pushBits(0, terminatorLen);

  while (bits.length % 8 !== 0) {
    bits.push(0);
  }

  const codewords = [];
  for (let i = 0; i < bits.length; i += 8) {
    let b = 0;
    for (let j = 0; j < 8; j++) {
      b = (b << 1) | bits[i + j];
    }
    codewords.push(b);
  }

  let padIdx = 0;
  while (codewords.length < spec.dataBytes) {
    codewords.push(padIdx % 2 === 0 ? 0xec : 0x11);
    padIdx++;
  }
  return new Uint8Array(codewords);
}

function buildFinalBitStream(dataCodewords, spec) {
  const dataBlocks = [];
  const ecBlocks = [];
  let offset = 0;

  for (const [groupCount, blockDataLen] of spec.blocks) {
    for (let c = 0; c < groupCount; c++) {
      const slice = dataCodewords.slice(offset, offset + blockDataLen);
      offset += blockDataLen;
      dataBlocks.push(slice);
      ecBlocks.push(computeRsEc(slice, spec.ecPerBlock));
    }
  }

  const interleaved = [];
  const maxDataLen = Math.max(...dataBlocks.map((b) => b.length));
  for (let i = 0; i < maxDataLen; i++) {
    for (const block of dataBlocks) {
      if (i < block.length) interleaved.push(block[i]);
    }
  }
  for (let i = 0; i < spec.ecPerBlock; i++) {
    for (const block of ecBlocks) {
      interleaved.push(block[i]);
    }
  }

  const bits = [];
  for (const cw of interleaved) {
    for (let b = 7; b >= 0; b--) {
      bits.push((cw >>> b) & 1);
    }
  }
  return bits;
}

function drawFinderPattern(modules, isFunction, row, col) {
  const size = modules.length;
  for (let dy = -1; dy <= 7; dy++) {
    for (let dx = -1; dx <= 7; dx++) {
      const r = row + dy;
      const c = col + dx;
      if (r < 0 || r >= size || c < 0 || c >= size) continue;
      const inOuter = dy >= 0 && dy <= 6 && (dx === 0 || dx === 6) ||
                      dx >= 0 && dx <= 6 && (dy === 0 || dy === 6);
      const inInner = dy >= 2 && dy <= 4 && dx >= 2 && dx <= 4;
      modules[r][c] = (inOuter || inInner) ? 1 : 0;
      isFunction[r][c] = true;
    }
  }
}

function drawAlignmentPattern(modules, isFunction, centerR, centerC) {
  for (let dy = -2; dy <= 2; dy++) {
    for (let dx = -2; dx <= 2; dx++) {
      const r = centerR + dy;
      const c = centerC + dx;
      const dist = Math.max(Math.abs(dy), Math.abs(dx));
      modules[r][c] = (dist === 2 || dist === 0) ? 1 : 0;
      isFunction[r][c] = true;
    }
  }
}

function calcFormatInfoBits(maskPattern) {
  // Error correction level M = 00
  const data = (0b00 << 3) | (maskPattern & 0b111);
  let rem = data << 10;
  const poly = 0b10100110111;
  for (let i = 14; i >= 10; i--) {
    if ((rem >>> i) & 1) {
      rem ^= poly << (i - 10);
    }
  }
  return ((data << 10) | rem) ^ 0b101010000010010;
}

function calcVersionInfoBits(version) {
  let rem = version << 12;
  const poly = 0b1111100100101;
  for (let i = 17; i >= 12; i--) {
    if ((rem >>> i) & 1) {
      rem ^= poly << (i - 12);
    }
  }
  return (version << 12) | rem;
}

function applyFormatAndVersionInfo(modules, isFunction, version, maskPattern) {
  const size = modules.length;
  const fmt = calcFormatInfoBits(maskPattern);

  for (let i = 0; i < 15; i++) {
    const bit = (fmt >>> i) & 1;

    // Vertical copy (top-left, then bottom-left)
    if (i < 6) {
      modules[i][8] = bit;
      isFunction[i][8] = true;
    } else if (i < 8) {
      modules[i + 1][8] = bit;
      isFunction[i + 1][8] = true;
    } else {
      modules[size - 15 + i][8] = bit;
      isFunction[size - 15 + i][8] = true;
    }

    // Horizontal copy (right-to-left around top-right and top-left)
    if (i < 8) {
      modules[8][size - 1 - i] = bit;
      isFunction[8][size - 1 - i] = true;
    } else if (i < 9) {
      modules[8][15 - i] = bit;
      isFunction[8][15 - i] = true;
    } else {
      modules[8][15 - i - 1] = bit;
      isFunction[8][15 - i - 1] = true;
    }
  }

  // Dark module
  modules[size - 8][8] = 1;
  isFunction[size - 8][8] = true;

  if (version >= 7) {
    const verBits = calcVersionInfoBits(version);
    for (let i = 0; i < 18; i++) {
      const bit = (verBits >>> i) & 1;
      const a = Math.floor(i / 3);
      const b = size - 11 + (i % 3);
      modules[a][b] = bit;
      isFunction[a][b] = true;
      modules[b][a] = bit;
      isFunction[b][a] = true;
    }
  }
}

function maskCondition(mask, r, c) {
  switch (mask) {
    case 0: return (r + c) % 2 === 0;
    case 1: return r % 2 === 0;
    case 2: return c % 3 === 0;
    case 3: return (r + c) % 3 === 0;
    case 4: return (Math.floor(r / 2) + Math.floor(c / 3)) % 2 === 0;
    case 5: return ((r * c) % 2 + (r * c) % 3) === 0;
    case 6: return (((r * c) % 2 + (r * c) % 3) % 2) === 0;
    case 7: return (((r + c) % 2 + (r * c) % 3) % 2) === 0;
    default: return false;
  }
}

function evaluatePenalty(modules) {
  const size = modules.length;
  let penalty = 0;

  // N1: horizontal & vertical runs >= 5
  for (let r = 0; r < size; r++) {
    let runColor = modules[r][0];
    let runLen = 1;
    for (let c = 1; c < size; c++) {
      if (modules[r][c] === runColor) {
        runLen++;
      } else {
        if (runLen >= 5) penalty += 3 + (runLen - 5);
        runColor = modules[r][c];
        runLen = 1;
      }
    }
    if (runLen >= 5) penalty += 3 + (runLen - 5);
  }
  for (let c = 0; c < size; c++) {
    let runColor = modules[0][c];
    let runLen = 1;
    for (let r = 1; r < size; r++) {
      if (modules[r][c] === runColor) {
        runLen++;
      } else {
        if (runLen >= 5) penalty += 3 + (runLen - 5);
        runColor = modules[r][c];
        runLen = 1;
      }
    }
    if (runLen >= 5) penalty += 3 + (runLen - 5);
  }

  // N2: 2x2 blocks
  for (let r = 0; r < size - 1; r++) {
    for (let c = 0; c < size - 1; c++) {
      const v = modules[r][c];
      if (v === modules[r][c + 1] && v === modules[r + 1][c] && v === modules[r + 1][c + 1]) {
        penalty += 3;
      }
    }
  }

  // N3: finder-like 1:1:3:1:1 pattern with 4 light modules on either side
  function countPattern(arr) {
    let hits = 0;
    for (let i = 0; i <= arr.length - 11; i++) {
      if (
        arr[i] === 1 && arr[i + 1] === 0 && arr[i + 2] === 1 && arr[i + 3] === 1 &&
        arr[i + 4] === 1 && arr[i + 5] === 0 && arr[i + 6] === 1 &&
        arr[i + 7] === 0 && arr[i + 8] === 0 && arr[i + 9] === 0 && arr[i + 10] === 0
      ) hits++;
      if (
        arr[i] === 0 && arr[i + 1] === 0 && arr[i + 2] === 0 && arr[i + 3] === 0 &&
        arr[i + 4] === 1 && arr[i + 5] === 0 && arr[i + 6] === 1 && arr[i + 7] === 1 &&
        arr[i + 8] === 1 && arr[i + 9] === 0 && arr[i + 10] === 1
      ) hits++;
    }
    return hits * 40;
  }
  for (let r = 0; r < size; r++) {
    penalty += countPattern(modules[r]);
  }
  for (let c = 0; c < size; c++) {
    const colArr = new Array(size);
    for (let r = 0; r < size; r++) colArr[r] = modules[r][c];
    penalty += countPattern(colArr);
  }

  // N4: dark module ratio deviation from 50%
  let dark = 0;
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      if (modules[r][c] === 1) dark++;
    }
  }
  const pct = (dark * 100) / (size * size);
  const k = Math.abs(Math.floor(pct / 5) * 5 - 50) / 5;
  const k2 = Math.abs(Math.ceil(pct / 5) * 5 - 50) / 5;
  penalty += Math.min(k, k2) * 10;

  return penalty;
}

function encodeQrMatrix(text) {
  const utf8Bytes = Buffer.from(String(text || ''), 'utf8');
  const spec = selectVersion(utf8Bytes.length);
  const size = spec.size;
  const dataCodewords = encodeDataCodewords(utf8Bytes, spec);
  const bitStream = buildFinalBitStream(dataCodewords, spec);

  const baseModules = Array.from({ length: size }, () => new Uint8Array(size));
  const isFunction = Array.from({ length: size }, () => new Array(size).fill(false));

  // 1. Finder patterns & separators
  drawFinderPattern(baseModules, isFunction, 0, 0);
  drawFinderPattern(baseModules, isFunction, 0, size - 7);
  drawFinderPattern(baseModules, isFunction, size - 7, 0);

  // 2. Timing patterns
  for (let i = 8; i < size - 8; i++) {
    const bit = i % 2 === 0 ? 1 : 0;
    baseModules[6][i] = bit;
    isFunction[6][i] = true;
    baseModules[i][6] = bit;
    isFunction[i][6] = true;
  }

  // 3. Alignment patterns (skip corners covered by finder patterns)
  for (const r of spec.align) {
    for (const c of spec.align) {
      if ((r <= 8 && c <= 8) || (r <= 8 && c >= size - 9) || (r >= size - 9 && c <= 8)) {
        continue;
      }
      drawAlignmentPattern(baseModules, isFunction, r, c);
    }
  }

  // 4. Reserve format & version areas before placing data bits
  applyFormatAndVersionInfo(baseModules, isFunction, spec.version, 0);

  // 5. Place data bits in standard zig-zag order
  let bitIdx = 0;
  let upward = true;
  for (let right = size - 1; right >= 1; right -= 2) {
    if (right === 6) right = 5;
    for (let vert = 0; vert < size; vert++) {
      const r = upward ? (size - 1 - vert) : vert;
      for (let lr = 0; lr < 2; lr++) {
        const c = right - lr;
        if (!isFunction[r][c]) {
          baseModules[r][c] = bitIdx < bitStream.length ? bitStream[bitIdx++] : 0;
        }
      }
    }
    upward = !upward;
  }

  // 6. Pick optimal mask pattern (0..7)
  let bestMask = 0;
  let bestPenalty = Infinity;
  let bestMatrix = null;

  for (let mask = 0; mask < 8; mask++) {
    const candidate = baseModules.map((row) => new Uint8Array(row));
    for (let r = 0; r < size; r++) {
      for (let c = 0; c < size; c++) {
        if (!isFunction[r][c] && maskCondition(mask, r, c)) {
          candidate[r][c] ^= 1;
        }
      }
    }
    applyFormatAndVersionInfo(candidate, isFunction, spec.version, mask);
    const pen = evaluatePenalty(candidate);
    if (pen < bestPenalty) {
      bestPenalty = pen;
      bestMask = mask;
      bestMatrix = candidate;
    }
  }

  return {
    version: spec.version,
    size,
    mask: bestMask,
    modules: bestMatrix
  };
}

function renderQrSvg(text, options = {}) {
  const qr = encodeQrMatrix(text);
  const quiet = Number.isInteger(options.quietZone) ? options.quietZone : 3;
  const total = qr.size + quiet * 2;
  const fg = options.darkColor || '#0F172A';
  const bg = options.lightColor || '#FFFFFF';

  const rects = [];
  for (let r = 0; r < qr.size; r++) {
    let runStart = -1;
    for (let c = 0; c < qr.size; c++) {
      const isDark = qr.modules[r][c] === 1;
      if (isDark && runStart === -1) {
        runStart = c;
      } else if (!isDark && runStart !== -1) {
        rects.push(`M${runStart + quiet},${r + quiet}h${c - runStart}v1h-${c - runStart}z`);
        runStart = -1;
      }
    }
    if (runStart !== -1) {
      rects.push(`M${runStart + quiet},${r + quiet}h${qr.size - runStart}v1h-${qr.size - runStart}z`);
    }
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${total} ${total}" width="240" height="240" shape-rendering="crispEdges" role="img" aria-label="QR Code CLIENTE VIP"><rect width="${total}" height="${total}" fill="${bg}"/><path d="${rects.join('')}" fill="${fg}"/></svg>`;
}

module.exports = { encodeQrMatrix, renderQrSvg };
