import { Point } from '../types';

/**
 * Loads an image from a URL/Source and returns an HTMLImageElement
 */
export const loadImage = (src: string): Promise<HTMLImageElement> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = (e) => reject(e);
    img.src = src;
  });
};

/**
 * Creates a canvas from an image or another canvas
 */
export const cloneCanvas = (source: CanvasImageSource, width: number, height: number): HTMLCanvasElement => {
  const canvas = document.createElement('canvas');
  canvas.width = Math.floor(width);
  canvas.height = Math.floor(height);
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Could not get canvas context');
  ctx.drawImage(source, 0, 0);
  return canvas;
};

/**
 * Calculates the angle of a line formed by two points in degrees
 */
export const calculateAngle = (p1: Point, p2: Point): number => {
  return Math.atan2(p2.y - p1.y, p2.x - p1.x) * (180 / Math.PI);
};

/**
 * Rotates an image by a specific angle (in degrees).
 * Expands canvas to fit rotated image to prevent clipping.
 */
export const rotateImage = (source: HTMLCanvasElement, angleDegrees: number): HTMLCanvasElement => {
  if (Math.abs(angleDegrees) < 0.01) {
    return cloneCanvas(source, source.width, source.height);
  }

  const angleRad = (angleDegrees * Math.PI) / 180;
  const absCos = Math.abs(Math.cos(angleRad));
  const absSin = Math.abs(Math.sin(angleRad));

  const newWidth = Math.ceil(source.width * absCos + source.height * absSin);
  const newHeight = Math.ceil(source.width * absSin + source.height * absCos);

  const canvas = document.createElement('canvas');
  canvas.width = newWidth;
  canvas.height = newHeight;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Context error');

  ctx.translate(newWidth / 2, newHeight / 2);
  ctx.rotate(angleRad);
  ctx.drawImage(source, -source.width / 2, -source.height / 2);

  return canvas;
};

/**
 * Scales an image by a ratio.
 */
export const scaleImage = (source: HTMLCanvasElement, scale: number): HTMLCanvasElement => {
  if (Math.abs(scale - 1) < 0.001) {
    return cloneCanvas(source, source.width, source.height);
  }

  const newWidth = Math.ceil(source.width * scale);
  const newHeight = Math.ceil(source.height * scale);

  const canvas = document.createElement('canvas');
  canvas.width = newWidth;
  canvas.height = newHeight;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Context error');

  ctx.drawImage(source, 0, 0, newWidth, newHeight);
  return canvas;
};

/**
 * Crops two images based on a common anchor point (center of interest).
 * Ensures both resulting images have exactly the same dimensions and the anchor point is at the same relative coordinates.
 */
export const cropImagesAligned = (
  left: HTMLCanvasElement,
  right: HTMLCanvasElement,
  pL: Point,
  pR: Point,
  equalZoom: boolean
): { left: HTMLCanvasElement; right: HTMLCanvasElement } => {
  // Use Math.floor to ensure integer coordinates for cropping
  
  // Distances from anchor to edges
  const L_left = pL.x;
  const R_left = pR.x;
  const cropLeft = Math.floor(Math.min(L_left, R_left)); // The maximum common distance to the left edge

  const L_right = left.width - pL.x;
  const R_right = right.width - pR.x;
  const cropRight = Math.floor(Math.min(L_right, R_right));

  let L_top = pL.y;
  let R_top = pR.y;
  let L_bottom = left.height - pL.y;
  let R_bottom = right.height - pR.y;

  const cropTop = Math.floor(Math.min(L_top, R_top));
  const cropBottom = Math.floor(Math.min(L_bottom, R_bottom));

  const finalWidth = cropLeft + cropRight;
  const finalHeight = cropTop + cropBottom;

  const createCropped = (source: HTMLCanvasElement, anchor: Point) => {
    const canvas = document.createElement('canvas');
    canvas.width = finalWidth;
    canvas.height = finalHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return canvas;

    // Source coordinates need to be derived from the anchor point and the calculated crop dimensions.
    // We want the anchor point to be at (cropLeft, cropTop) in the new image.
    // So source start X = anchor.x - cropLeft
    // Source start Y = anchor.y - cropTop
    
    // We use Math.floor on the source coordinates to snap to pixel grid
    const srcX = Math.floor(anchor.x - cropLeft);
    const srcY = Math.floor(anchor.y - cropTop);

    ctx.drawImage(
      source,
      srcX,
      srcY,
      finalWidth,
      finalHeight,
      0,
      0,
      finalWidth,
      finalHeight
    );
    return canvas;
  };

  return {
    left: createCropped(left, pL),
    right: createCropped(right, pR),
  };
};

export const mergeSideBySide = (left: HTMLCanvasElement, right: HTMLCanvasElement): HTMLCanvasElement => {
  const canvas = document.createElement('canvas');
  // Explicitly use integer width/height to avoid black bars
  const leftW = Math.floor(left.width);
  const leftH = Math.floor(left.height);
  const rightW = Math.floor(right.width);
  const rightH = Math.floor(right.height);

  canvas.width = leftW + rightW;
  canvas.height = Math.max(leftH, rightH);
  
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error("Context error");

  // Fill black (optional, but good if there's minor height difference)
  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Center vertically if heights differ (though they shouldn't after crop)
  const yL = Math.floor((canvas.height - leftH) / 2);
  const yR = Math.floor((canvas.height - rightH) / 2);

  ctx.drawImage(left, 0, yL);
  ctx.drawImage(right, leftW, yR);

  return canvas;
};