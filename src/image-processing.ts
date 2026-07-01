import JSZip from 'jszip';
import type { CropAdjustments, ImageCropBox, SplitPiece, StickerPiece } from './types';

type RGB = { r: number; g: number; b: number };

interface Snapshot {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  imageData: ImageData;
  width: number;
  height: number;
}

interface ComponentBox extends ImageCropBox {
  area: number;
}

const namedColors: Record<string, RGB> = {
  white: { r: 255, g: 255, b: 255 },
  black: { r: 0, g: 0, b: 0 },
  red: { r: 239, g: 68, b: 68 },
  blue: { r: 59, g: 130, b: 246 },
  green: { r: 34, g: 197, b: 94 },
  yellow: { r: 234, g: 179, b: 8 },
  pink: { r: 236, g: 72, b: 153 },
  purple: { r: 168, g: 85, b: 247 },
};

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

const parseColor = (value = 'white'): RGB => {
  const normalized = value.trim().toLowerCase();
  if (namedColors[normalized]) return namedColors[normalized];

  const hex = normalized.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
  if (hex) {
    const raw = hex[1].length === 3
      ? hex[1].split('').map((char) => `${char}${char}`).join('')
      : hex[1];
    return {
      r: parseInt(raw.slice(0, 2), 16),
      g: parseInt(raw.slice(2, 4), 16),
      b: parseInt(raw.slice(4, 6), 16),
    };
  }

  return namedColors.white;
};

export const fileToDataUrl = (file: File) => new Promise<string>((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = () => resolve(String(reader.result));
  reader.onerror = () => reject(new Error('图片读取失败'));
  reader.readAsDataURL(file);
});

export const validateImageDataUrl = (dataUrl: string) => new Promise<void>((resolve, reject) => {
  const image = new Image();
  image.onload = () => {
    if ((image.naturalWidth || image.width) > 0 && (image.naturalHeight || image.height) > 0) {
      resolve();
      return;
    }
    reject(new Error('图片尺寸无效'));
  };
  image.onerror = () => reject(new Error('当前浏览器无法解码这张图片，请改用 PNG、JPG 或 WebP 后再上传。'));
  image.src = dataUrl;
});

const loadSnapshot = (dataUrl: string) => new Promise<Snapshot>((resolve, reject) => {
  const image = new Image();
  image.onload = () => {
    const canvas = document.createElement('canvas');
    canvas.width = image.naturalWidth || image.width;
    canvas.height = image.naturalHeight || image.height;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) {
      reject(new Error('无法创建 Canvas'));
      return;
    }
    ctx.drawImage(image, 0, 0);
    resolve({
      canvas,
      ctx,
      imageData: ctx.getImageData(0, 0, canvas.width, canvas.height),
      width: canvas.width,
      height: canvas.height,
    });
  };
  image.onerror = () => reject(new Error('图片加载失败'));
  image.src = dataUrl;
});

const edgePositions = (width: number, height: number) => {
  const positions: number[] = [];
  for (let x = 0; x < width; x += 1) {
    positions.push(x, (height - 1) * width + x);
  }
  for (let y = 1; y < height - 1; y += 1) {
    positions.push(y * width, y * width + width - 1);
  }
  return positions;
};

const dominantEdgeColor = (data: Uint8ClampedArray, width: number, height: number): RGB => {
  const buckets = new Map<string, { count: number; r: number; g: number; b: number }>();
  edgePositions(width, height).forEach((position) => {
    const idx = position * 4;
    if (data[idx + 3] <= 16) return;
    const key = `${data[idx] >> 4},${data[idx + 1] >> 4},${data[idx + 2] >> 4}`;
    const bucket = buckets.get(key) || { count: 0, r: 0, g: 0, b: 0 };
    bucket.count += 1;
    bucket.r += data[idx];
    bucket.g += data[idx + 1];
    bucket.b += data[idx + 2];
    buckets.set(key, bucket);
  });
  const best = [...buckets.values()].sort((a, b) => b.count - a.count)[0];
  if (!best) return namedColors.white;
  return {
    r: Math.round(best.r / best.count),
    g: Math.round(best.g / best.count),
    b: Math.round(best.b / best.count),
  };
};

const colorDistance = (data: Uint8ClampedArray, idx: number, color: RGB) => (
  Math.abs(data[idx] - color.r) + Math.abs(data[idx + 1] - color.g) + Math.abs(data[idx + 2] - color.b)
);

export const repairTransparency = async (dataUrl: string, backgroundColor = 'white', tolerance = 112) => {
  const snapshot = await loadSnapshot(dataUrl);
  const { data } = snapshot.imageData;
  const edgeColor = dominantEdgeColor(data, snapshot.width, snapshot.height);
  const configuredColor = parseColor(backgroundColor);
  const queue = new Int32Array(snapshot.width * snapshot.height);
  const visited = new Uint8Array(snapshot.width * snapshot.height);
  let head = 0;
  let tail = 0;

  const matches = (position: number) => {
    const idx = position * 4;
    if (data[idx + 3] <= 12) return true;
    return colorDistance(data, idx, edgeColor) <= tolerance || colorDistance(data, idx, configuredColor) <= tolerance;
  };

  const enqueue = (position: number) => {
    if (visited[position] || !matches(position)) return;
    visited[position] = 1;
    queue[tail] = position;
    tail += 1;
  };

  edgePositions(snapshot.width, snapshot.height).forEach(enqueue);

  while (head < tail) {
    const position = queue[head];
    head += 1;
    data[position * 4 + 3] = 0;
    const x = position % snapshot.width;
    const y = Math.floor(position / snapshot.width);
    if (x > 0) enqueue(position - 1);
    if (x < snapshot.width - 1) enqueue(position + 1);
    if (y > 0) enqueue(position - snapshot.width);
    if (y < snapshot.height - 1) enqueue(position + snapshot.width);
  }

  snapshot.ctx.putImageData(snapshot.imageData, 0, 0);
  return snapshot.canvas.toDataURL('image/png');
};

const normalizeBox = (snapshot: Snapshot, box: ImageCropBox, padding = 0): ImageCropBox => ({
  minX: Math.round(clamp(box.minX - padding, 0, snapshot.width - 1)),
  minY: Math.round(clamp(box.minY - padding, 0, snapshot.height - 1)),
  maxX: Math.round(clamp(box.maxX + padding, 0, snapshot.width - 1)),
  maxY: Math.round(clamp(box.maxY + padding, 0, snapshot.height - 1)),
});

const crop = (snapshot: Snapshot, box: ImageCropBox, padding = 20) => {
  const normalized = normalizeBox(snapshot, box, padding);
  return cropBox(snapshot, normalized);
};

const cropBox = (snapshot: Snapshot, box: ImageCropBox) => {
  const x = clamp(box.minX, 0, snapshot.width - 1);
  const y = clamp(box.minY, 0, snapshot.height - 1);
  const right = clamp(box.maxX, x, snapshot.width - 1);
  const bottom = clamp(box.maxY, y, snapshot.height - 1);
  const width = Math.max(1, right - x + 1);
  const height = Math.max(1, bottom - y + 1);
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  canvas.width = width;
  canvas.height = height;
  ctx?.drawImage(snapshot.canvas, x, y, width, height, 0, 0, width, height);
  return canvas.toDataURL('image/png');
};

const findComponents = (snapshot: Snapshot): ComponentBox[] => {
  const { data } = snapshot.imageData;
  const total = snapshot.width * snapshot.height;
  const visited = new Uint8Array(total);
  const queue = new Int32Array(total);
  const minArea = Math.max(80, Math.floor(total * 0.00035));
  const components: ComponentBox[] = [];
  const opaque = (position: number) => data[position * 4 + 3] > 24;

  for (let start = 0; start < total; start += 1) {
    if (visited[start] || !opaque(start)) continue;
    let head = 0;
    let tail = 0;
    let area = 0;
    let minX = snapshot.width;
    let minY = snapshot.height;
    let maxX = 0;
    let maxY = 0;

    visited[start] = 1;
    queue[tail] = start;
    tail += 1;

    while (head < tail) {
      const position = queue[head];
      head += 1;
      const x = position % snapshot.width;
      const y = Math.floor(position / snapshot.width);
      area += 1;
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);

      const neighbors = [position - 1, position + 1, position - snapshot.width, position + snapshot.width];
      neighbors.forEach((next) => {
        if (next < 0 || next >= total || visited[next] || !opaque(next)) return;
        const nx = next % snapshot.width;
        const ny = Math.floor(next / snapshot.width);
        if (Math.abs(nx - x) + Math.abs(ny - y) !== 1) return;
        visited[next] = 1;
        queue[tail] = next;
        tail += 1;
      });
    }

    const boxWidth = maxX - minX + 1;
    const boxHeight = maxY - minY + 1;
    if (area >= minArea && boxWidth > 20 && boxHeight > 20) {
      components.push({ minX, minY, maxX, maxY, area });
    }
  }

  return components;
};

const sortReadingOrder = (boxes: ComponentBox[]) => {
  const rowHeight = boxes.map((box) => box.maxY - box.minY).sort((a, b) => a - b)[Math.floor(boxes.length / 2)] || 1;
  const tolerance = Math.max(24, rowHeight * 0.45);
  return [...boxes].sort((a, b) => {
    const ay = (a.minY + a.maxY) / 2;
    const by = (b.minY + b.maxY) / 2;
    if (Math.abs(ay - by) <= tolerance) return a.minX - b.minX;
    return ay - by;
  });
};

export const splitAuto = async (dataUrl: string, expectedCount: number, backgroundColor: string) => {
  const transparent = await repairTransparency(dataUrl, backgroundColor);
  const snapshot = await loadSnapshot(transparent);
  const padding = Math.round(Math.min(snapshot.width, snapshot.height) * 0.018);
  const components = sortReadingOrder(findComponents(snapshot))
    .sort((a, b) => b.area - a.area)
    .slice(0, expectedCount)
    .sort((a, b) => {
      const ay = (a.minY + a.maxY) / 2;
      const by = (b.minY + b.maxY) / 2;
      return Math.abs(ay - by) < 32 ? a.minX - b.minX : ay - by;
    });

  return components.map((box): SplitPiece => ({
    box: normalizeBox(snapshot, box, padding),
    sourceDataUrl: transparent,
    dataUrl: crop(snapshot, box, padding),
  }));
};

const opaqueBoundsInRegion = (snapshot: Snapshot, region: ImageCropBox): ComponentBox | null => {
  const { data } = snapshot.imageData;
  let minX = snapshot.width;
  let minY = snapshot.height;
  let maxX = 0;
  let maxY = 0;
  let area = 0;

  for (let y = region.minY; y <= region.maxY; y += 1) {
    for (let x = region.minX; x <= region.maxX; x += 1) {
      const idx = (y * snapshot.width + x) * 4;
      if (data[idx + 3] <= 24) continue;
      area += 1;
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
    }
  }

  const minArea = Math.max(32, Math.floor((region.maxX - region.minX + 1) * (region.maxY - region.minY + 1) * 0.002));
  if (area < minArea) return null;
  return { minX, minY, maxX, maxY, area };
};

export const splitGrid = async (dataUrl: string, rows: number, columns: number, backgroundColor: string) => {
  const transparent = await repairTransparency(dataUrl, backgroundColor);
  const snapshot = await loadSnapshot(transparent);
  const pieces: SplitPiece[] = [];
  const cellWidth = snapshot.width / columns;
  const cellHeight = snapshot.height / rows;

  for (let row = 0; row < rows; row += 1) {
    for (let column = 0; column < columns; column += 1) {
      const box = {
        minX: Math.round(column * cellWidth),
        minY: Math.round(row * cellHeight),
        maxX: Math.round((column + 1) * cellWidth - 1),
        maxY: Math.round((row + 1) * cellHeight - 1),
      };
      const contentBox = opaqueBoundsInRegion(snapshot, normalizeBox(snapshot, box));
      const finalBox = contentBox
        ? normalizeBox(snapshot, contentBox, Math.round(Math.min(cellWidth, cellHeight) * 0.06))
        : normalizeBox(snapshot, box);
      pieces.push({ box: finalBox, sourceDataUrl: transparent, dataUrl: cropBox(snapshot, finalBox) });
    }
  }

  return pieces;
};

export const recropStickerFromSource = async (
  sourceDataUrl: string,
  baseBox: ImageCropBox,
  adjustments: CropAdjustments,
) => {
  const snapshot = await loadSnapshot(sourceDataUrl);
  const boxWidth = Math.max(1, baseBox.maxX - baseBox.minX + 1);
  const boxHeight = Math.max(1, baseBox.maxY - baseBox.minY + 1);
  const nextBox: ImageCropBox = {
    minX: Math.round(baseBox.minX + boxWidth * (adjustments.left / 100)),
    maxX: Math.round(baseBox.maxX - boxWidth * (adjustments.right / 100)),
    minY: Math.round(baseBox.minY + boxHeight * (adjustments.top / 100)),
    maxY: Math.round(baseBox.maxY - boxHeight * (adjustments.bottom / 100)),
  };

  const minDimension = 8;
  if (nextBox.maxX - nextBox.minX + 1 < minDimension) {
    const centerX = Math.round((nextBox.minX + nextBox.maxX) / 2);
    nextBox.minX = centerX - Math.floor(minDimension / 2);
    nextBox.maxX = nextBox.minX + minDimension - 1;
  }
  if (nextBox.maxY - nextBox.minY + 1 < minDimension) {
    const centerY = Math.round((nextBox.minY + nextBox.maxY) / 2);
    nextBox.minY = centerY - Math.floor(minDimension / 2);
    nextBox.maxY = nextBox.minY + minDimension - 1;
  }

  return cropBox(snapshot, normalizeBox(snapshot, nextBox));
};

export const downloadDataUrl = (dataUrl: string, filename: string) => {
  const link = document.createElement('a');
  link.href = dataUrl;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

const dataUrlToBase64 = (dataUrl: string) => dataUrl.split(',')[1] || '';

export const downloadZip = async (pieces: StickerPiece[], filename = 'stickers.zip') => {
  const zip = new JSZip();
  pieces.forEach((piece) => {
    zip.file(`sticker-${String(piece.index).padStart(2, '0')}.png`, dataUrlToBase64(piece.dataUrl), { base64: true });
  });
  const blob = await zip.generateAsync({ type: 'blob' });
  const url = URL.createObjectURL(blob);
  downloadDataUrl(url, filename);
  URL.revokeObjectURL(url);
};
